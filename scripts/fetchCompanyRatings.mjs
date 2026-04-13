#!/usr/bin/env node
/**
 * Fetch company ratings from kununu.com and merge into the job feed.
 *
 * Reads public/jobs.json for the set of unique company names, queries
 * kununu search for each, caches results in public/company-ratings.json,
 * and merges ratings back into jobs.json.
 *
 * Run after search-jobs.mjs, before verify-jobs.mjs.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { parse } from "node-html-parser";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "vienna-set-tracker/1.0 (+https://github.com/Konoszaf1/vienna-set-tracker)";

const JOBS_PATH = "public/jobs.json";
const RATINGS_PATH = "public/company-ratings.json";
const MANUAL_RATINGS_PATH = "public/company-ratings-manual.json";
const CACHE_TTL_DAYS = 14;

function normalizeCompanyKey(name) {
  return name
    .toLowerCase()
    .replace(/\b(gmbh|ag|kg|konzern|austria|österreich|gruppe|group|holding|se|e\.u\.|gesellschaft|international|ltd|inc|corp)\b/gi, "")
    .replace(/[^a-zäöüß0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFresh(entry) {
  if (!entry?.fetchedAt) return false;
  const age = Date.now() - new Date(entry.fetchedAt).getTime();
  return age < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

async function fetchKununuRating(companyName) {
  const q = encodeURIComponent(companyName);
  const url = `https://www.kununu.com/at/search?q=${q}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Try __NEXT_DATA__ first (most reliable)
    const ndMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (ndMatch) {
      try {
        const data = JSON.parse(ndMatch[1]);
        const profiles = data?.props?.pageProps?.searchProfiles?.profiles;
        if (profiles?.length > 0) {
          const top = profiles[0];
          const score = top.score ?? top.overallScore ?? null;
          const reviews = top.reviewCount ?? top.totalReviews ?? null;
          if (score != null) {
            return { score: Math.round(score * 10) / 10, reviews: reviews ?? 0 };
          }
        }
      } catch { /* fall through to HTML parsing */ }
    }

    // Fallback: parse HTML for rating spans
    const root = parse(html);
    const scoreEl = root.querySelector('[class*="score"]') || root.querySelector('[data-test="score"]');
    if (scoreEl) {
      const score = parseFloat(scoreEl.text.replace(",", "."));
      if (!isNaN(score) && score >= 1 && score <= 5) {
        return { score, reviews: 0 };
      }
    }

    return null;
  } catch (e) {
    console.error(`  Failed to fetch kununu for "${companyName}": ${e.message}`);
    return null;
  }
}

async function main() {
  // Load jobs
  if (!existsSync(JOBS_PATH)) {
    console.error("No jobs.json found — run search-jobs.mjs first");
    process.exit(1);
  }
  const jobData = JSON.parse(readFileSync(JOBS_PATH, "utf-8"));
  const jobs = jobData.jobs || [];

  // Extract unique company names
  const companiesMap = new Map();
  for (const j of jobs) {
    const key = normalizeCompanyKey(j.company);
    if (!companiesMap.has(key)) {
      companiesMap.set(key, j.company);
    }
  }
  console.log(`Found ${companiesMap.size} unique companies in ${jobs.length} jobs`);

  // Load existing ratings cache
  let ratings = {};
  if (existsSync(RATINGS_PATH)) {
    try {
      ratings = JSON.parse(readFileSync(RATINGS_PATH, "utf-8"));
    } catch { /* start fresh */ }
  }

  // Fetch missing/stale kununu ratings
  let fetched = 0, cached = 0, failed = 0;
  for (const [key, displayName] of companiesMap) {
    if (ratings[key] && isFresh(ratings[key])) {
      cached++;
      continue;
    }

    console.log(`  Querying kununu for "${displayName}"...`);
    const result = await fetchKununuRating(displayName);
    if (result) {
      ratings[key] = {
        ...ratings[key],
        kununu: result,
        fetchedAt: new Date().toISOString(),
      };
      console.log(`    → ${result.score} ★ (${result.reviews} reviews)`);
      fetched++;
    } else {
      // Cache the miss to avoid re-fetching
      if (!ratings[key]) ratings[key] = {};
      ratings[key] = {
        ...ratings[key],
        kununu: null,
        fetchedAt: new Date().toISOString(),
      };
      failed++;
    }

    // Rate limit: 2s between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\nKununu: ${fetched} found, ${failed} not found, ${cached} cached`);

  // Merge manual Glassdoor ratings (overlay wins)
  if (existsSync(MANUAL_RATINGS_PATH)) {
    try {
      const manual = JSON.parse(readFileSync(MANUAL_RATINGS_PATH, "utf-8"));
      let merged = 0;
      for (const [name, data] of Object.entries(manual)) {
        if (name === "_schema") continue;
        const key = normalizeCompanyKey(name);
        if (!ratings[key]) ratings[key] = {};
        if (data.glassdoor != null) {
          ratings[key].glassdoor = data.glassdoor;
          merged++;
        }
      }
      if (merged > 0) console.log(`Merged ${merged} manual Glassdoor ratings`);
    } catch (e) {
      console.warn(`Warning: could not read ${MANUAL_RATINGS_PATH}: ${e.message}`);
    }
  }

  // Write ratings cache
  writeFileSync(RATINGS_PATH, JSON.stringify(ratings, null, 2));
  console.log(`Wrote ${Object.keys(ratings).length} entries to ${RATINGS_PATH}`);

  // Merge back into jobs.json: set kununuScore and glassdoorScore per job
  let enriched = 0;
  for (const j of jobs) {
    const key = normalizeCompanyKey(j.company);
    const entry = ratings[key];
    if (entry?.kununu?.score != null && j.kununuScore == null) {
      j.kununuScore = entry.kununu.score;
      enriched++;
    }
    if (entry?.glassdoor != null) {
      j.glassdoorScore = entry.glassdoor;
    }
  }

  writeFileSync(JOBS_PATH, JSON.stringify(jobData, null, 2));
  console.log(`Enriched ${enriched} jobs with kununu scores`);
}

main();
