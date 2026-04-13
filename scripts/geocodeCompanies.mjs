#!/usr/bin/env node
/**
 * Resolve actual office locations for companies with generic/missing coordinates.
 *
 * Many job sources (JobSpy, kununu) only provide "Vienna" as the location,
 * which geocodes to a single city-center point. This script searches
 * Nominatim by company name to find actual office addresses.
 *
 * Persists results in public/company-locations.json so lookups happen once.
 * Designed to run as part of the daily job-search workflow.
 *
 * Usage:
 *   node scripts/geocodeCompanies.mjs              # dry-run
 *   node scripts/geocodeCompanies.mjs --apply      # write changes
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

const USER_AGENT =
  "vienna-set-tracker/1.0 (+https://github.com/Konoszaf1/vienna-set-tracker)";

const JOBS_PATH = "public/jobs.json";
const CACHE_PATH = "public/company-locations.json";

// Known generic coordinates that indicate "just Vienna, no real address"
const GENERIC_POINTS = [
  { lat: 48.1857192, lng: 16.4221587 }, // "vienna" / "vienna, vienna"
  { lat: 48.1822872, lng: 16.3923295 }, // "wien, w, at"
  { lat: 48.2083537, lng: 16.3725042 }, // another common Vienna centroid
];

// Vienna bounding box
const VIENNA_BOUNDS = { latMin: 48.12, latMax: 48.33, lngMin: 16.18, lngMax: 16.58 };

function isGenericCoord(lat, lng) {
  if (lat == null || lng == null) return true;
  return GENERIC_POINTS.some(
    p => Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lng - lng) < 0.001
  );
}

function isInVienna(lat, lng) {
  return (
    lat >= VIENNA_BOUNDS.latMin && lat <= VIENNA_BOUNDS.latMax &&
    lng >= VIENNA_BOUNDS.lngMin && lng <= VIENNA_BOUNDS.lngMax
  );
}

/**
 * Search Nominatim for a company office in Vienna.
 * Tries multiple query strategies in order of specificity.
 */
async function searchCompanyLocation(companyName) {
  const queries = [
    // 1. Exact company name as a POI in Vienna
    `${companyName}, Vienna, Austria`,
    // 2. Without common suffixes
    `${companyName.replace(/\b(gmbh|ag|kg|ltd|inc|corp|se|e\.u\.)\b/gi, "").trim()}, Vienna, Austria`,
    // 3. First word only (brand name) + Vienna — catches "Dynatrace", "Raiffeisen", etc.
    ...(companyName.split(/\s+/)[0].length >= 4
      ? [`${companyName.split(/\s+/)[0]}, Vienna, Austria`]
      : []),
  ];

  for (const q of queries) {
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(q)}&format=json&limit=3&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;

      const results = await res.json();

      for (const r of results) {
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);
        if (!isInVienna(lat, lng)) continue;
        // Skip if result is itself a generic city/state-level match
        if (["city", "state", "country", "county"].includes(r.type)) continue;
        if (r.class === "boundary" || r.class === "place") continue;

        const addr = r.address || {};
        const road = addr.road || "";
        const houseNumber = addr.house_number || "";
        const postcode = addr.postcode || "";
        const suburb = addr.suburb || addr.city_district || "";
        const displayParts = [road, houseNumber, postcode, suburb]
          .filter(Boolean)
          .join(", ");

        return {
          lat,
          lng,
          address: displayParts || r.display_name.split(",").slice(0, 3).join(",").trim(),
          source: "nominatim-company-search",
        };
      }
    } catch {
      // network error — skip this query variant
    }
    // Rate limit: Nominatim allows 1 req/s
    await new Promise(r => setTimeout(r, 1100));
  }

  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");

  if (!existsSync(JOBS_PATH)) {
    console.log("No jobs.json found.");
    process.exit(0);
  }

  const data = JSON.parse(readFileSync(JOBS_PATH, "utf-8"));
  const jobs = data.jobs || [];

  // Load persistent cache
  let cache = {};
  if (existsSync(CACHE_PATH)) {
    try { cache = JSON.parse(readFileSync(CACHE_PATH, "utf-8")); } catch { /* start fresh */ }
  }

  // Group jobs by company, identify which need location resolution
  const companyJobs = new Map();
  for (const job of jobs) {
    const key = job.company.toLowerCase().trim();
    if (!companyJobs.has(key)) companyJobs.set(key, []);
    companyJobs.get(key).push(job);
  }

  let resolved = 0, cached = 0, failed = 0, alreadyGood = 0;

  for (const [key, companyJobList] of companyJobs) {
    const sample = companyJobList[0];
    const name = sample.company;

    // Check if any job in this group already has a specific (non-generic) location
    const hasSpecific = companyJobList.some(j => !isGenericCoord(j.lat, j.lng));
    if (hasSpecific) {
      alreadyGood++;
      continue;
    }

    // Check cache first
    if (cache[key]) {
      if (cache[key].lat != null) {
        for (const j of companyJobList) {
          j.lat = cache[key].lat;
          j.lng = cache[key].lng;
          if (cache[key].address) j.address = cache[key].address;
        }
        cached++;
      } else {
        // Previously searched and not found — don't retry
        failed++;
      }
      continue;
    }

    // Search Nominatim
    console.log(`  Searching: ${name} ...`);
    const result = await searchCompanyLocation(name);

    if (result) {
      cache[key] = { lat: result.lat, lng: result.lng, address: result.address };
      for (const j of companyJobList) {
        j.lat = result.lat;
        j.lng = result.lng;
        j.address = result.address;
      }
      console.log(`    Found: ${result.address} (${result.lat.toFixed(5)}, ${result.lng.toFixed(5)})`);
      resolved++;
    } else {
      // Cache the miss so we don't re-query next run
      cache[key] = { lat: null, lng: null, address: null };
      console.log(`    Not found`);
      failed++;
    }

    // Rate limit between companies
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(
    `\nCompany locations: ${alreadyGood} already specific, ` +
    `${cached} from cache, ${resolved} newly resolved, ${failed} not found`
  );

  if (apply) {
    data.jobs = jobs;
    writeFileSync(JOBS_PATH, JSON.stringify(data, null, 2));
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    console.log(`\nWrote updated jobs.json and company-locations.json`);
  } else {
    // Still save the cache even in dry-run so lookups aren't wasted
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    console.log(`\nDry run. Use --apply to write location updates to jobs.json.`);
  }
}

main();
