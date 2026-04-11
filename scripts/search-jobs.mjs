#!/usr/bin/env node
/**
 * Job scraper for Vienna SDET/QA roles.
 *
 * Sources: karriere.at (HTML scraping) and kununu.com (Next.js __NEXT_DATA__).
 * Extracts per-job addresses from karriere.at detail pages, geocodes via
 * Nominatim, deduplicates against the curated company dataset, and
 * writes the result to public/jobs.json.
 *
 * Compliance notes:
 *   - Both karriere.at and kununu.com are public job boards; search pages
 *     are freely accessible without login.
 *   - The script identifies itself via a custom User-Agent string.
 *   - Requests are rate-limited (1s karriere.at, 2s kununu) to avoid
 *     putting meaningful load on either site.
 *   - If either site requests removal, disable the relevant searches in
 *     .github/workflows/job-search.yml immediately.
 */

import { parse } from "node-html-parser";
import { validateJob } from "./jobValidator.mjs";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "vienna-set-tracker/1.0 (+https://github.com/Konoszaf1/vienna-set-tracker)";

const KARRIERE_SEARCHES = [
  { slug: "test-automation/in-wien", label: "Test Automation Wien" },
  { slug: "sdet/in-wien", label: "SDET Wien" },
  { slug: "qa-engineer/in-wien", label: "QA Engineer Wien" },
  { slug: "software-tester/in-wien", label: "Software Tester Wien" },
  { slug: "testautomatisierung/in-wien", label: "Testautomatisierung Wien" },
  { slug: "quality-assurance/in-wien", label: "Quality Assurance Wien" },
];

const KUNUNU_SEARCHES = [
  { q: "test automation", label: "kununu: Test Automation" },
  { q: "QA engineer", label: "kununu: QA Engineer" },
  { q: "SDET", label: "kununu: SDET" },
  { q: "Testautomatisierung", label: "kununu: Testautomatisierung" },
  { q: "quality assurance", label: "kununu: Quality Assurance" },
  { q: "software tester", label: "kununu: Software Tester" },
];

const KUNUNU_PAGES_PER_SEARCH = 3; // 30 results/page, most Vienna hits are on early pages


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
// kununu.com job search (Next.js SSR — parse __NEXT_DATA__ JSON)
// ---------------------------------------------------------------------------

async function fetchKununuSearch({ q, label }) {
  const jobs = [];

  for (let page = 1; page <= KUNUNU_PAGES_PER_SEARCH; page++) {
    const url = `https://www.kununu.com/at/jobs?q=${encodeURIComponent(q)}&loc=Wien&page=${page}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error(`  HTTP ${res.status} for kununu page ${page}`);
        break;
      }
      const html = await res.text();

      // Extract __NEXT_DATA__ JSON blob
      const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
      if (!match) {
        console.error(`  No __NEXT_DATA__ found on kununu page ${page}`);
        break;
      }

      const data = JSON.parse(match[1]);
      const searchJobs = data?.props?.pageProps?.searchJobs;
      if (!searchJobs?.jobs) break;

      const lastPage = searchJobs.pagination?.lastPage || 1;

      for (const job of searchJobs.jobs) {
        // Filter to Vienna: stateCode AT-9 or Wien in city/region
        const isVienna =
          job.stateCode === "AT-9" ||
          /wien/i.test(job.city || "") ||
          /wien/i.test(job.region || "");
        if (!isVienna) continue;

        const jobUrl = job.url
          ? `https://www.kununu.com${job.url}`
          : null;
        if (!jobUrl) continue;

        jobs.push({
          url: jobUrl,
          title: job.title || "",
          company: job.profile?.companyName || "",
          source: label,
          city: job.city || "Wien",
          address: job.city || "Wien",
          zip: null,
          kununuScore: job.profile?.score || null,
        });
      }

      if (page >= lastPage) break;
    } catch (e) {
      console.error(`  Failed kununu page ${page}: ${e.message}`);
      break;
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  return jobs;
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
  const allJobs = new Map();
  const failedSlugs = [];
  const rejectionCounts = {};
  let accepted = 0;
  let rejected = 0;

  // --- karriere.at ---
  console.log("Searching karriere.at for Vienna SDET/QA jobs...");
  for (const s of KARRIERE_SEARCHES) {
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
    await new Promise(r => setTimeout(r, 1000));
  }

  // --- kununu ---
  console.log("\nSearching kununu.com for Vienna SDET/QA jobs...");
  for (const s of KUNUNU_SEARCHES) {
    const jobs = await fetchKununuSearch(s);
    console.log(`  "${s.label}": ${jobs.length} Vienna results`);
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
  }

  // Validation summary
  const reasonSummary = Object.entries(rejectionCounts)
    .map(([r, c]) => `${c} ${r}`)
    .join(", ");
  console.log(`\nValidation: ${accepted} accepted, ${rejected} rejected${reasonSummary ? ` (${reasonSummary})` : ""}`);

  if (allJobs.size === 0) {
    console.error("\nERROR: All searches returned zero valid results.");
    console.error("karriere.at or kununu may have changed their markup.");
    process.exit(1);
  }

  if (failedSlugs.length > 0) {
    console.warn(`\nWARNING: ${failedSlugs.length} karriere.at search(es) returned zero results: ${failedSlugs.join(", ")}`);
  }

  // --- Task 1: Fetch detail pages for address info (karriere.at only) ---
  const jobs = [...allJobs.values()];
  const karriereJobs = jobs.filter(j => j.url.includes("karriere.at"));
  console.log(`\nFetching karriere.at detail pages for addresses (${karriereJobs.length} jobs)...`);
  let addressCount = 0;
  for (let i = 0; i < karriereJobs.length; i++) {
    const job = karriereJobs[i];
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
    if (i < karriereJobs.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.log(`  Extracted addresses for ${addressCount}/${karriereJobs.length} karriere.at jobs`);

  // --- Task 2: Geocode addresses ---
  console.log("\nGeocoding job addresses...");
  await geocodeJobs(jobs, "public/geocoding-cache.json");

  // --- Task 3: Write output to public/jobs.json ---
  const result = {
    lastUpdated: new Date().toISOString(),
    count: jobs.length,
    jobs,
    searchLinks: [
      { label: "karriere.at", url: "https://www.karriere.at/jobs/test-automation/in-wien" },
      { label: "kununu", url: "https://www.kununu.com/at/jobs?q=test+automation&loc=Wien" },
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
