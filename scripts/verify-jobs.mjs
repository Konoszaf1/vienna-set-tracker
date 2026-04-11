#!/usr/bin/env node
/**
 * Liveness checker for the scraped job feed (public/jobs.json).
 *
 * Reads the job feed, GET-requests each URL, removes listings that
 * return HTTP errors or karriere.at soft-404 pages, and writes the
 * pruned file back. Designed to run weekly via GitHub Actions.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "vienna-set-tracker/1.0 (+https://github.com/Konoszaf1/vienna-set-tracker)";

const CONCURRENCY = 5;
const TIMEOUT_MS = 10000;

async function checkJob(job) {
  // JobSpy discoveries are refreshed daily by discoverJobs.py — stale
  // entries are replaced automatically, so skip liveness checks here.
  // (LinkedIn returns 999 to bots, Indeed redirects to login, etc.)
  if ((job.source || "").startsWith("jobspy-")) {
    return { status: "alive" };
  }

  try {
    const res = await fetch(job.url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });

    if (res.status >= 400) {
      return { status: "dead", reason: `HTTP ${res.status}` };
    }

    const html = await res.text();

    // karriere.at ships listing state in a Next.js hydration blob.
    // "isInactive":true or "active":false on jobDetail means the
    // listing is expired. These are authoritative flags, not prose
    // copy, so they're reliable signals.
    if (/karriere\.at/.test(job.url)) {
      const inactiveMatch = /"jobDetail":\s*\{[^}]*"isInactive":\s*true/i.test(html);
      const activeFalseMatch = /"jobDetail":\s*\{[^}]*"active":\s*false/i.test(html);
      if (inactiveMatch || activeFalseMatch) {
        return { status: "dead", reason: "karriere.at flagged inactive" };
      }

      if (html.length < 20000 && !/"jobDetail"/.test(html)) {
        return { status: "dead", reason: "no jobDetail found" };
      }
    }

    return { status: "alive" };
  } catch (e) {
    return { status: "error", reason: e.message };
  }
}

async function main() {
  const path = "public/jobs.json";

  if (!existsSync(path)) {
    console.log("No latest-jobs.json found, nothing to verify.");
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    console.log(`Cannot parse ${path}: ${e.message}`);
    process.exit(0);
  }

  if (!data.jobs || data.jobs.length === 0) {
    console.log("No jobs to verify.");
    process.exit(0);
  }

  console.log(`Verifying ${data.jobs.length} job listings...`);

  const alive = [];
  const dead = [];
  const errored = [];

  for (let i = 0; i < data.jobs.length; i += CONCURRENCY) {
    const batch = data.jobs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(j => checkJob(j)));

    for (let j = 0; j < batch.length; j++) {
      if (results[j].status === "alive") {
        alive.push(batch[j]);
      } else if (results[j].status === "dead") {
        dead.push(batch[j]);
        console.log(`  DEAD: ${batch[j].title} (${batch[j].company}) — ${results[j].reason}`);
      } else {
        errored.push(batch[j]);
        console.log(`  NETWORK ERROR: ${batch[j].title} (${batch[j].company}) — ${results[j].reason}`);
      }
    }

    if (i + CONCURRENCY < data.jobs.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\nResults: ${alive.length} alive, ${dead.length} dead, ${errored.length} network errors (kept)`);

  if (alive.length === 0) {
    console.error("ERROR: 0 jobs verified as alive. Refusing to write empty feed.");
    console.error("Check soft-404 patterns and karriere.at markup.");
    process.exit(1);
  }

  data.jobs = [...alive, ...errored];
  data.count = data.jobs.length;
  data.lastVerified = new Date().toISOString();
  writeFileSync(path, JSON.stringify(data, null, 2));

  if (dead.length > 0) {
    console.log(`Updated ${path} (removed ${dead.length} dead listings)`);
  } else {
    console.log("All listings are alive, updated lastVerified.");
  }
}

main();
