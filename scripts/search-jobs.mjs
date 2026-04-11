#!/usr/bin/env node
/**
 * karriere.at job scraper for Vienna SDET/QA roles.
 *
 * Purpose: Fetches public job listings from karriere.at search pages,
 * extracts per-job addresses from detail pages, geocodes them via
 * Nominatim, deduplicates against the curated company dataset, and
 * writes the result to public/jobs.json.
 *
 * Compliance notes:
 *   - karriere.at is a public job board; these search result pages are
 *     freely accessible without login.
 *   - The script identifies itself via a custom User-Agent string so
 *     karriere.at admins can reach out if they have concerns.
 *   - Requests are rate-limited to one per second to avoid putting any
 *     meaningful load on the site.
 *   - If karriere.at requests removal, the maintainer should disable
 *     the .github/workflows/job-search.yml workflow immediately.
 */

import { parse } from "node-html-parser";
import { validateJob } from "./jobValidator.mjs";
import { normalizeCompanyName } from "./companyDedupe.mjs";
import { DEFAULT_COMPANIES } from "../src/data/companies.js";

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

// Manual aliases for scraped names that don't match any curated company
// via normalization. Add entries here when you notice a scraped job that
// obviously belongs to a curated company but isn't matching.
// Format: "scraped normalized name": "curated company id"
const MANUAL_ALIASES = {
};

// ---------------------------------------------------------------------------
// Search-page scraping
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Detail-page address extraction (Task 1)
// ---------------------------------------------------------------------------

function extractJobLocation(html) {
  // The "locations" field in the Next.js hydration blob is the best signal.
  // Formats: "Wien", "Wien 2. Bezirk (Leopoldstadt)", etc.
  const locMatch = html.match(/"locations"\s*:\s*"([^"]+)"/);
  if (!locMatch) return null;

  const locStr = locMatch[1];

  // Try to extract district number and name
  const districtMatch = locStr.match(/Wien\s+(\d+)\.\s*Bezirk\s*\(([^)]+)\)/i);
  if (districtMatch) {
    const num = parseInt(districtMatch[1], 10);
    const name = districtMatch[2];
    const zip = `1${String(num).padStart(2, "0")}0`;
    return { address: `${name}, ${zip} Wien`, city: "Wien", zip };
  }

  // Just "Wien" or a Wien-containing string without district detail
  if (/wien/i.test(locStr)) {
    return { address: "Wien", city: "Wien", zip: null };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Nominatim geocoding (Task 2)
// ---------------------------------------------------------------------------

async function geocodeJobs(jobs, cachePath) {
  const { readFileSync, writeFileSync, existsSync } = await import("fs");

  let cache = {};
  if (existsSync(cachePath)) {
    try { cache = JSON.parse(readFileSync(cachePath, "utf-8")); } catch { /* corrupt cache — start fresh */ }
  }

  let cacheHits = 0, newLookups = 0, failures = 0;

  for (const job of jobs) {
    // Skip bare "Wien" — too generic to geocode meaningfully
    if (!job.address || job.address === "Wien") {
      job.lat = null;
      job.lng = null;
      continue;
    }

    const key = job.address.toLowerCase().trim();
    if (cache[key]) {
      job.lat = cache[key].lat;
      job.lng = cache[key].lng;
      cacheHits++;
      continue;
    }

    try {
      const q = encodeURIComponent(`${job.address}, Vienna, Austria`);
      const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          // Vienna bounding box check
          if (lat >= 48.12 && lat <= 48.33 && lng >= 16.18 && lng <= 16.58) {
            job.lat = lat;
            job.lng = lng;
            cache[key] = { lat, lng };
            newLookups++;
          } else {
            job.lat = null;
            job.lng = null;
            failures++;
          }
        } else {
          job.lat = null;
          job.lng = null;
          failures++;
        }
      } else {
        job.lat = null;
        job.lng = null;
        failures++;
      }
    } catch {
      job.lat = null;
      job.lng = null;
      failures++;
    }

    // Nominatim rate limit: 1 req/sec
    await new Promise(r => setTimeout(r, 1000));
  }

  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  console.log(`Geocoded ${cacheHits + newLookups + failures} addresses (${cacheHits} cache hits, ${newLookups} new lookups, ${failures} failures)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Searching karriere.at for Vienna SDET/QA jobs...");

  const allJobs = new Map();
  const failedSlugs = [];
  const rejectionCounts = {};
  let accepted = 0;
  let rejected = 0;

  for (const s of SEARCHES) {
    const jobs = await fetchSearch(s);
    console.log(`  "${s.label}": ${jobs.length} results`);
    if (jobs.length === 0) {
      failedSlugs.push(s.slug);
    }
    for (const j of jobs) {
      if (allJobs.has(j.url)) continue;
      const result = validateJob(j);
      if (result.valid) {
        allJobs.set(j.url, j);
        accepted++;
      } else {
        rejected++;
        rejectionCounts[result.reason] = (rejectionCounts[result.reason] || 0) + 1;
      }
    }
    // Rate-limit: 1 second between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  // Validation summary
  const reasonSummary = Object.entries(rejectionCounts)
    .map(([r, c]) => `${c} ${r}`)
    .join(", ");
  console.log(`\nValidation: ${accepted} accepted, ${rejected} rejected${reasonSummary ? ` (${reasonSummary})` : ""}`);

  if (allJobs.size === 0) {
    console.error("\nERROR: All searches returned zero valid results.");
    console.error("karriere.at may have changed its markup, or the site is unreachable.");
    console.error("Check .m-jobsListItem selector against the live page.");
    process.exit(1);
  }

  if (failedSlugs.length > 0) {
    console.warn(`\nWARNING: ${failedSlugs.length} search(es) returned zero results: ${failedSlugs.join(", ")}`);
  }

  // --- Task 1: Fetch detail pages for address info ---
  const jobs = [...allJobs.values()];
  console.log("\nFetching job detail pages for addresses...");
  let addressCount = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    try {
      const res = await fetch(job.url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const html = await res.text();
        const loc = extractJobLocation(html);
        if (loc) {
          job.address = loc.address;
          job.city = loc.city;
          job.zip = loc.zip;
          addressCount++;
        } else {
          job.address = null;
          job.city = null;
          job.zip = null;
        }
      } else {
        job.address = null;
        job.city = null;
        job.zip = null;
      }
    } catch (e) {
      console.warn(`  Could not fetch detail for ${job.title}: ${e.message}`);
      job.address = null;
      job.city = null;
      job.zip = null;
    }
    if (i < jobs.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.log(`  Extracted addresses for ${addressCount}/${jobs.length} jobs`);

  // --- Task 2: Geocode addresses ---
  console.log("\nGeocoding job addresses...");
  await geocodeJobs(jobs, "public/geocoding-cache.json");

  // --- Task 3: Dedupe against curated companies ---
  const curatedMap = {};
  for (const c of DEFAULT_COMPANIES) {
    curatedMap[normalizeCompanyName(c.name)] = c.id;
  }

  let matchedCount = 0;
  for (const job of jobs) {
    const normalized = normalizeCompanyName(job.company);
    const match = curatedMap[normalized] || MANUAL_ALIASES[normalized] || null;
    job.curatedCompanyId = match;
    if (match) matchedCount++;
  }
  console.log(`\nDedup: ${matchedCount} jobs matched to curated companies, ${jobs.length - matchedCount} unmatched`);

  // --- Task 4: Write output to public/jobs.json ---
  const result = {
    lastUpdated: new Date().toISOString(),
    count: jobs.length,
    jobs,
    searchLinks: [
      { label: "karriere.at", url: "https://www.karriere.at/jobs/test-automation/in-wien" },
      { label: "LinkedIn", url: "https://www.linkedin.com/jobs/search/?keywords=SDET&location=Vienna" },
      { label: "StepStone", url: "https://www.stepstone.at/jobs/test-automation/in-wien" },
      { label: "indeed.at", url: "https://at.indeed.com/jobs?q=SDET&l=Wien" },
    ],
    validation: { accepted, rejected, reasons: rejectionCounts },
  };

  const { writeFileSync, mkdirSync } = await import("fs");
  mkdirSync("public", { recursive: true });
  writeFileSync("public/jobs.json", JSON.stringify(result, null, 2));
  console.log(`Wrote ${jobs.length} unique jobs to public/jobs.json`);
}

main();
