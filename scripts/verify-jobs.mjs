#!/usr/bin/env node
/**
 * Liveness checker for public/latest-jobs.json.
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

const SOFT_404_PATTERNS = [
  /nicht mehr verf[uü]gbar/i,
  /stelle wurde entfernt/i,
  /position is no longer available/i,
  /dieses jobangebot ist leider nicht mehr aktiv/i,
];

async function checkJob(job) {
  try {
    const res = await fetch(job.url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });

    if (res.status >= 400) {
      return { alive: false, reason: `HTTP ${res.status}` };
    }

    const html = await res.text();
    for (const pattern of SOFT_404_PATTERNS) {
      if (pattern.test(html)) {
        return { alive: false, reason: "soft-404" };
      }
    }

    return { alive: true };
  } catch (e) {
    return { alive: false, reason: e.message };
  }
}

async function main() {
  const path = "public/latest-jobs.json";

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

  for (let i = 0; i < data.jobs.length; i += CONCURRENCY) {
    const batch = data.jobs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(j => checkJob(j)));

    for (let j = 0; j < batch.length; j++) {
      if (results[j].alive) {
        alive.push(batch[j]);
      } else {
        dead.push(batch[j]);
        console.log(`  DEAD: ${batch[j].title} (${batch[j].company}) — ${results[j].reason}`);
      }
    }

    if (i + CONCURRENCY < data.jobs.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\nResults: ${alive.length} alive, ${dead.length} dead`);

  if (dead.length > 0) {
    data.jobs = alive;
    data.count = alive.length;
    data.lastVerified = new Date().toISOString();
    writeFileSync(path, JSON.stringify(data, null, 2));
    console.log(`Updated ${path} (removed ${dead.length} dead listings)`);
  } else {
    console.log("All listings are alive, no changes needed.");
  }
}

main();
