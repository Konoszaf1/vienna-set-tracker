#!/usr/bin/env node
/**
 * karriere.at job scraper for Vienna SDET/QA roles.
 *
 * Purpose: Fetches public job listings from karriere.at search pages and
 * writes them to public/latest-jobs.json, which the Vienna SET/SDET Tracker
 * app loads at runtime to display a live job feed widget.
 *
 * Compliance notes:
 *   - karriere.at is a public job board; these search result pages are
 *     freely accessible without login.
 *   - The script identifies itself via a custom User-Agent string so
 *     karriere.at admins can reach out if they have concerns.
 *   - Requests are rate-limited to one per second (6 total) to avoid
 *     putting any meaningful load on the site.
 *   - If karriere.at requests removal, the maintainer should disable
 *     the .github/workflows/job-search.yml workflow immediately.
 */

import { parse } from "node-html-parser";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "vienna-set-tracker/1.0 (+https://github.com/Konoszaf1/vienna-set-tracker)";

const SEARCHES = [
  { slug: "test-automation/in-wien", label: "Test Automation Wien" },
  { slug: "sdet/in-wien", label: "SDET Wien" },
  { slug: "qa-engineer/in-wien", label: "QA Engineer Wien" },
  { slug: "software-tester/in-wien", label: "Software Tester Wien" },
  { slug: "testautomatisierung/in-wien", label: "Testautomatisierung Wien" },
  { slug: "quality-assurance/in-wien", label: "Quality Assurance Wien" },
];

async function fetchSearch({ slug, label }) {
  const url = `https://www.karriere.at/jobs/${slug}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`  HTTP ${res.status} for ${slug}`);
      return [];
    }
    const html = await res.text();
    const root = parse(html);
    const items = root.querySelectorAll(".m-jobsListItem");

    const jobs = [];
    for (const item of items) {
      const titleLink = item.querySelector(".m-jobsListItem__titleLink");
      const companyEl = item.querySelector(".m-jobsListItem__companyName");
      if (!titleLink) continue;

      const jobUrl = (titleLink.getAttribute("href") || "").trim();
      const title = titleLink.text.trim();
      const company = companyEl ? companyEl.text.trim() : "";

      if (jobUrl && title && company) {
        jobs.push({ url: jobUrl, title, company, source: label });
      }
    }
    return jobs;
  } catch (e) {
    console.error(`  Failed: ${slug}: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log("Searching karriere.at for Vienna SDET/QA jobs...");

  const allJobs = new Map();
  const failedSlugs = [];

  for (const s of SEARCHES) {
    const jobs = await fetchSearch(s);
    console.log(`  "${s.label}": ${jobs.length} results`);
    if (jobs.length === 0) {
      failedSlugs.push(s.slug);
    }
    for (const j of jobs) {
      if (!allJobs.has(j.url)) {
        allJobs.set(j.url, j);
      }
    }
    // Rate-limit: 1 second between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  if (allJobs.size === 0) {
    console.error("\nERROR: All searches returned zero results.");
    console.error("karriere.at may have changed its markup, or the site is unreachable.");
    console.error("Check .m-jobsListItem selector against the live page.");
    process.exit(1);
  }

  if (failedSlugs.length > 0) {
    console.warn(`\nWARNING: ${failedSlugs.length} search(es) returned zero results: ${failedSlugs.join(", ")}`);
  }

  const result = {
    lastUpdated: new Date().toISOString(),
    count: allJobs.size,
    jobs: [...allJobs.values()],
    searchLinks: [
      { label: "karriere.at", url: "https://www.karriere.at/jobs/test-automation/in-wien" },
      { label: "LinkedIn", url: "https://www.linkedin.com/jobs/search/?keywords=SDET&location=Vienna" },
      { label: "StepStone", url: "https://www.stepstone.at/jobs/test-automation/in-wien" },
      { label: "indeed.at", url: "https://at.indeed.com/jobs?q=SDET&l=Wien" },
    ],
  };

  const { writeFileSync, mkdirSync } = await import("fs");
  mkdirSync("public", { recursive: true });
  writeFileSync("public/latest-jobs.json", JSON.stringify(result, null, 2));
  console.log(`\nWrote ${allJobs.size} unique jobs to public/latest-jobs.json`);
}

main();
