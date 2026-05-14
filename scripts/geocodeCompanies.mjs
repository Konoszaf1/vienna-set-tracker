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
import { pathToFileURL } from "url";
import { parse } from "node-html-parser";
import { deriveJobCompany, isRemoteRole } from "../src/utils/jobCompany.js";
import { normalizeCompanyName } from "../src/utils/normalizeCompany.js";

const USER_AGENT =
  "vienna-set-tracker/1.0 (+https://github.com/Konoszaf1/vienna-set-tracker)";

const JOBS_PATH = "public/jobs.json";
const CACHE_PATH = "public/company-locations.json";
const MANUAL_LOCATIONS_PATH = "public/company-locations-manual.json";
const MISS_RETRY_DAYS = 30;
const ADDRESS_DISCOVERY_RESULT_LIMIT = 6;

const SEARCH_RESULT_BLOCKLIST = [
  "duckduckgo.com",
  "facebook.com",
  "glassdoor.",
  "indeed.",
  "karriere.at",
  "kununu.",
  "linkedin.",
  "reddit.com",
  "stepstone.",
  "xing.com",
];

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

function isUsableLocation(entry) {
  return entry?.lat != null && entry?.lng != null;
}

function locationCacheKeys(companyNames) {
  const keys = [];
  for (const name of companyNames) {
    if (!name) continue;
    keys.push(name.toLowerCase().trim());
    keys.push(normalizeCompanyName(name));
  }
  return [...new Set(keys.filter(Boolean))];
}

function findCachedLocation(cache, keys) {
  for (const key of keys) {
    if (isUsableLocation(cache[key])) return cache[key];
  }

  for (const [cacheKey, entry] of Object.entries(cache)) {
    if (!isUsableLocation(entry)) continue;
    const normalizedCacheKey = normalizeCompanyName(cacheKey);
    if (keys.includes(normalizedCacheKey)) return entry;
  }

  return null;
}

function rememberLocation(cache, keys, entry) {
  for (const key of keys) {
    cache[key] = {
      lat: entry.lat,
      lng: entry.lng,
      address: entry.address || null,
    };
  }
}

function isFreshMiss(entry) {
  if (!entry || isUsableLocation(entry)) return false;
  if (!entry.lastTried) return false;
  const age = Date.now() - new Date(entry.lastTried).getTime();
  return age < MISS_RETRY_DAYS * 24 * 60 * 60 * 1000;
}

function rememberMiss(cache, keys) {
  const miss = {
    lat: null,
    lng: null,
    address: null,
    lastTried: new Date().toISOString(),
  };
  for (const key of keys) {
    cache[key] = miss;
  }
}

function applyLocation(companyJobList, location) {
  for (const job of companyJobList) {
    job.lat = location.lat;
    job.lng = location.lng;
    if (location.address) job.address = location.address;
  }
}

function companyQueryVariants(companyNames) {
  const variants = [];

  for (const name of companyNames) {
    const normalized = normalizeCompanyName(name);
    const firstWord = normalized.split(/\s+/)[0] || "";

    variants.push(name);
    variants.push(normalized);
    if (firstWord.length >= 4) variants.push(firstWord);
  }

  return [...new Set(variants.map(v => v.trim()).filter(v => v.length >= 3))];
}

function decodeDuckDuckGoHref(href) {
  if (!href) return null;
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return null;
  }
  return null;
}

function isBlockedSearchResult(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SEARCH_RESULT_BLOCKLIST.some(blocked => host.includes(blocked));
  } catch {
    return true;
  }
}

function scoreCandidateUrl(url, companyNames) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const normalizedNames = companyNames.map(normalizeCompanyName).filter(Boolean);
    const brandTokens = normalizedNames.flatMap(n => n.split(/\s+/)).filter(t => t.length >= 4);

    let score = 0;
    if (/impressum|kontakt|contact|location|standort/.test(path)) score += 8;
    if (brandTokens.some(token => host.includes(token))) score += 5;
    if (/firmen\.wko\.at|firmeninfo\.at|wirtschaft\.at|unternehmen24\.info|kompany\./.test(host)) score += 3;
    if (/job|career|karriere|stellenangebot/.test(path)) score -= 4;
    return score;
  } catch {
    return -Infinity;
  }
}

function extractViennaAddressFromText(text) {
  const compact = text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

  const patterns = [
    /([A-ZÄÖÜ][\p{L} .'-]+(?:strasse|straße|gasse|platz|weg|allee|ring|kai|zeile|markt)\s+\d+[A-Za-z0-9/ .-]*,\s*(?:A-)?1\d{3}\s+Wien)/iu,
    /((?:A-)?1\d{3}\s+Wien,\s*[A-ZÄÖÜ][\p{L} .'-]+(?:strasse|straße|gasse|platz|weg|allee|ring|kai|zeile|markt)\s+\d+[A-Za-z0-9/ .-]*)/iu,
    /([A-ZÄÖÜ][\p{L} .'-]+(?:strasse|straße|gasse|platz|weg|allee|ring|kai|zeile|markt)\s+\d+[A-Za-z0-9/ .-]*\n(?:A-)?1\d{3}\s+Wien)/iu,
    /((?:A-)?1\d{3}\s+Wien\n[A-ZÄÖÜ][\p{L} .'-]+(?:strasse|straße|gasse|platz|weg|allee|ring|kai|zeile|markt)\s+\d+[A-Za-z0-9/ .-]*)/iu,
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/\n/g, ", ")
        .replace(/\s+/g, " ")
        .replace(/\bA-(?=1\d{3}\b)/g, "")
        .trim();
    }
  }

  return null;
}

function stripHtmlToText(html) {
  const root = parse(html);
  root.querySelectorAll("script, style, noscript, svg").forEach(node => node.remove());
  return root.text;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") || "";
  if (type && !/text\/html|text\/plain|application\/xhtml\+xml/i.test(type)) return null;
  return res.text();
}

async function searchCompanyPages(companyNames) {
  const query = `${companyNames[0]} Wien Impressum Kontakt Adresse`;
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  if (!html) return [];

  const root = parse(html);
  const links = root.querySelectorAll("a.result__a, a.result__url, a[href]");
  const urls = [];
  for (const link of links) {
    const href = link.getAttribute("href");
    const decoded = decodeDuckDuckGoHref(href);
    if (!decoded || isBlockedSearchResult(decoded)) continue;
    urls.push(decoded);
  }

  return [...new Set(urls)]
    .map(candidate => ({ candidate, score: scoreCandidateUrl(candidate, companyNames) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, ADDRESS_DISCOVERY_RESULT_LIMIT)
    .map(item => item.candidate);
}

async function discoverCompanyAddress(companyNames) {
  try {
    const pages = await searchCompanyPages(companyNames);
    for (const pageUrl of pages) {
      const html = await fetchText(pageUrl);
      if (!html) continue;

      const address = extractViennaAddressFromText(stripHtmlToText(html));
      if (address) return { address, sourceUrl: pageUrl };

      await new Promise(r => setTimeout(r, 500));
    }
  } catch {
    // Search/address discovery is best-effort. Direct Nominatim remains primary.
  }

  return null;
}

async function geocodeAddress(address) {
  const q = `${address}, Austria`;
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}&format=json&limit=3&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const results = await res.json();
  for (const r of results) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (!isInVienna(lat, lng)) continue;
    return {
      lat,
      lng,
      address,
      source: "address-search",
    };
  }

  return null;
}

/**
 * Search Nominatim for a company office in Vienna.
 * Tries multiple query strategies in order of specificity.
 */
async function searchCompanyLocation(companyNames) {
  const queries = companyQueryVariants(companyNames)
    .flatMap(name => [
      `${name}, Vienna, Austria`,
      `${name} office, Vienna, Austria`,
    ]);

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

  let manualLocations = {};
  if (existsSync(MANUAL_LOCATIONS_PATH)) {
    try { manualLocations = JSON.parse(readFileSync(MANUAL_LOCATIONS_PATH, "utf-8")); } catch { /* ignore corrupt manual overlay */ }
  }

  // Group jobs by the same normalized company key used by the frontend.
  const companyJobs = new Map();
  for (const job of jobs) {
    const derivedCompany = deriveJobCompany(job);
    if (derivedCompany && derivedCompany !== job.company) {
      job.sourceCompany = job.company;
      job.company = derivedCompany;
    }
    const key = normalizeCompanyName(job.company) || job.company.toLowerCase().trim();
    if (!companyJobs.has(key)) companyJobs.set(key, []);
    companyJobs.get(key).push(job);
  }

  let resolved = 0, discovered = 0, cached = 0, manual = 0, failed = 0, alreadyGood = 0, remoteOnly = 0;

  for (const [key, companyJobList] of companyJobs) {
    const names = [...new Set(companyJobList.map(j => j.company).filter(Boolean))];
    const cacheKeys = locationCacheKeys([key, ...names]);

    if (companyJobList.every(isRemoteRole)) {
      remoteOnly++;
      continue;
    }

    // Check if any job in this group already has a specific (non-generic) location
    const specific = companyJobList.find(j => !isGenericCoord(j.lat, j.lng));
    if (specific) {
      rememberLocation(cache, cacheKeys, {
        lat: specific.lat,
        lng: specific.lng,
        address: specific.address || null,
      });
      alreadyGood++;
      continue;
    }

    const manualLocation = findCachedLocation(manualLocations, cacheKeys);
    if (manualLocation) {
      rememberLocation(cache, cacheKeys, manualLocation);
      applyLocation(companyJobList, manualLocation);
      manual++;
      continue;
    }

    // Check cache first
    const cachedLocation = findCachedLocation(cache, cacheKeys);
    if (cachedLocation) {
      rememberLocation(cache, cacheKeys, cachedLocation);
      applyLocation(companyJobList, cachedLocation);
      cached++;
      continue;
    }

    if (cacheKeys.every(cacheKey => isFreshMiss(cache[cacheKey]))) {
      failed++;
      continue;
    }

    // Search Nominatim
    console.log(`  Searching: ${names.join(" / ")} ...`);
    const result = await searchCompanyLocation(names);

    if (result) {
      rememberLocation(cache, cacheKeys, result);
      applyLocation(companyJobList, result);
      console.log(`    Found: ${result.address} (${result.lat.toFixed(5)}, ${result.lng.toFixed(5)})`);
      resolved++;
    } else {
      const address = await discoverCompanyAddress(names);
      const addressLocation = address ? await geocodeAddress(address.address) : null;
      if (addressLocation) {
        rememberLocation(cache, cacheKeys, addressLocation);
        applyLocation(companyJobList, addressLocation);
        console.log(`    Found via address: ${addressLocation.address} (${addressLocation.lat.toFixed(5)}, ${addressLocation.lng.toFixed(5)})`);
        discovered++;
      } else {
        // Cache the miss so we don't re-query every run.
        rememberMiss(cache, cacheKeys);
        console.log(`    Not found`);
        failed++;
      }
    }

    // Rate limit between companies
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(
    `\nCompany locations: ${alreadyGood} already specific, ` +
    `${manual} manual, ${cached} from cache, ${resolved} direct, ` +
    `${discovered} address-discovered, ${remoteOnly} remote-only, ${failed} not found`
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

export {
  companyQueryVariants,
  decodeDuckDuckGoHref,
  extractViennaAddressFromText,
  scoreCandidateUrl,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
