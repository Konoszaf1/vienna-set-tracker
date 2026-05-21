#!/usr/bin/env node
/**
 * Liveness checker for the scraped job feed (public/jobs.json).
 *
 * Reads the job feed, checks each URL using a fast HTTP fetch or a headless
 * Playwright browser (for LinkedIn, Indeed, and failed requests), removes
 * listings that return HTTP errors or inactive indicators, and writes the
 * pruned file back. Designed to run daily/weekly via GitHub Actions.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { chromium } from "@playwright/test";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "vienna-set-tracker/1.0 (+https://github.com/Konoszaf1/vienna-set-tracker)";

const CONCURRENCY = 3; // Keep concurrency conservative for browser contexts
const TIMEOUT_MS = 15000;

export async function checkJob(job, browser) {
  const isIndeed = /indeed\.com/.test(job.url);
  const isLinkedIn = /linkedin\.com/.test(job.url);
  const isKununu = /kununu\.com/.test(job.url);

  // Fast HTTP fetch path for standard URLs (like karriere.at or kununu.com)
  if (!isIndeed && !isLinkedIn) {
    try {
      const res = await fetch(job.url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "follow",
      });

      if (res.status === 404) {
        return { status: "dead", reason: `HTTP 404` };
      }

      if (res.status < 400) {
        const html = await res.text();

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

        if (isKununu) {
          if (html.includes("Seite nicht gefunden") || html.includes("ERROR 404")) {
            return { status: "dead", reason: "Kununu page not found" };
          }
        }

        return { status: "alive" };
      }
      // If HTTP status is >= 400 (except 404), fall back to Playwright
    } catch (e) {
      // Fall back to Playwright on network/fetch errors
    }
  }

  // Playwright Headless Browser Path
  if (!browser) {
    // If browser couldn't launch, fall back to keeping the job to be safe
    return { status: "error", reason: "Browser not available for verification" };
  }

  let context = null;
  let page = null;
  try {
    // Let Playwright use its bundled Chromium's real, up-to-date user-agent
    context = await browser.newContext();
    page = await context.newPage();

    const response = await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    const status = response ? response.status() : 200;

    if (status === 404) {
      return { status: "dead", reason: "HTTP 404 via Playwright" };
    }

    // Use textContent('body') to get visible text only, avoiding
    // script tags, CSS, and other HTML noise that could false-positive.
    const text = await page.textContent("body");

    if (isLinkedIn) {
      if (
        /no longer accepting applications/i.test(text) ||
        /job not found/i.test(text) ||
        /page not found/i.test(text) ||
        /job no longer available/i.test(text)
      ) {
        return { status: "dead", reason: "LinkedIn inactive message" };
      }
    } else if (isIndeed) {
      if (
        /this job has expired/i.test(text) ||
        /this job posting has expired/i.test(text) ||
        /job has expired/i.test(text) ||
        /this job listing is no longer available/i.test(text) ||
        /this job is no longer available/i.test(text)
      ) {
        return { status: "dead", reason: "Indeed inactive message" };
      }
    } else if (isKununu) {
      if (/seite nicht gefunden/i.test(text)) {
        return { status: "dead", reason: "Kununu page not found via Playwright" };
      }
    } else if (/karriere\.at/.test(job.url)) {
      // karriere.at signals are in JSON data within script tags, not visible
      // text — use page.content() to access the full HTML source.
      const html = await page.content();
      const inactiveMatch = /"jobDetail":\s*\{[^}]*"isInactive":\s*true/i.test(html);
      const activeFalseMatch = /"jobDetail":\s*\{[^}]*"active":\s*false/i.test(html);
      if (inactiveMatch || activeFalseMatch) {
        return { status: "dead", reason: "karriere.at flagged inactive via Playwright" };
      }
    }

    return { status: "alive" };
  } catch (e) {
    return { status: "error", reason: `Playwright error: ${e.message}` };
  } finally {
    if (page) await page.close();
    if (context) await context.close();
  }
}

async function main() {
  const path = "public/jobs.json";

  if (!existsSync(path)) {
    console.log("No public/jobs.json found, nothing to verify.");
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

  console.log(`Verifying ${data.jobs.length} job listings (HTTP fetch + Playwright)...`);

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.warn(`WARNING: Failed to launch Playwright chromium browser: ${e.message}`);
    console.warn("Continuing checks using standard fetch only.");
  }

  const alive = [];
  const dead = [];
  const errored = [];

  for (let i = 0; i < data.jobs.length; i += CONCURRENCY) {
    const batch = data.jobs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(j => checkJob(j, browser)));

    for (let j = 0; j < batch.length; j++) {
      if (results[j].status === "alive") {
        alive.push(batch[j]);
      } else if (results[j].status === "dead") {
        dead.push(batch[j]);
        console.log(`  DEAD: ${batch[j].title} (${batch[j].company}) — ${results[j].reason}`);
      } else {
        errored.push(batch[j]);
        console.log(`  NETWORK/PLAYWRIGHT ERROR: ${batch[j].title} (${batch[j].company}) — ${results[j].reason}`);
      }
    }

    if (i + CONCURRENCY < data.jobs.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (browser) {
    await browser.close();
  }

  console.log(`\nResults: ${alive.length} alive, ${dead.length} dead, ${errored.length} errors (kept)`);

  if (alive.length === 0) {
    console.error("ERROR: 0 jobs verified as alive. Refusing to write empty feed.");
    console.error("Check soft-404 patterns, browser installation, and selectors.");
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

// Only run main() when executed directly, not when imported for testing.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
