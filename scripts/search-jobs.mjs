#!/usr/bin/env node
/**
 * Job scraper for Vienna SDET/QA roles.
 *
 * Sources: karriere.at (HTML scraping), kununu.com (Next.js __NEXT_DATA__),
 * and devjobs.at (Playwright browser scraping).
 * Extracts per-job addresses from karriere.at detail pages, geocodes via
 * Nominatim, deduplicates against the curated company dataset, and
 * writes the result to public/jobs.json.
 *
 * Compliance notes:
 *   - karriere.at, kununu.com, and devjobs.at are public job boards; search pages
 *     are freely accessible without login.
 *   - The script identifies itself via a custom User-Agent string.
 *   - Requests are rate-limited (1s karriere.at/devjobs.at, 2s kununu) to avoid
 *     putting meaningful load on any site.
 *   - If either site requests removal, disable the relevant searches in
 *     .github/workflows/job-search.yml immediately.
 */

import { chromium } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { parse } from "node-html-parser";
import { fileURLToPath } from "url";
import { writeJsonAtomic } from "./atomicJson.mjs";
import { datasetHash, hydrateJob, reconcileJobs } from "./jobLifecycle.mjs";
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
  { q: "test automation", label: "kununu: Test Automation", optional: true },
  { q: "QA engineer", label: "kununu: QA Engineer", optional: true },
  { q: "SDET", label: "kununu: SDET", optional: true },
  { q: "Testautomatisierung", label: "kununu: Testautomatisierung", optional: true },
  { q: "quality assurance", label: "kununu: Quality Assurance", optional: true },
  { q: "software tester", label: "kununu: Software Tester", optional: true },
];

const KUNUNU_PAGES_PER_SEARCH = 3; // 30 results/page, most Vienna hits are on early pages

const DEVJOBS_SEARCHES = [
  { slug: "qa-engineer", label: "devjobs.at: QA Engineer Wien" },
  { slug: "test-qa-engineer", label: "devjobs.at: Test/QA Engineer Wien" },
  { slug: "software-tester", label: "devjobs.at: Software Tester Wien" },
  { slug: "test-automation-engineer", label: "devjobs.at: Test Automation Engineer Wien" },
  { slug: "test-automation-developer", label: "devjobs.at: Test Automation Developer Wien" },
];

const DEVJOBS_BASE_URL = "https://devjobs.at";
const DEVJOBS_JOB_LINK_SELECTOR = 'a[href^="/job/"], a[href^="https://devjobs.at/job/"]';
const DEVJOBS_PAGE_DELAY_MS = 1000;

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
      return { jobs: [], complete: false, error: `HTTP ${res.status}` };
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
    return { jobs, complete: true };
  } catch (e) {
    console.error(`  Failed: ${slug}: ${e.message}`);
    return { jobs: [], complete: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// kununu.com job search (Next.js SSR — parse __NEXT_DATA__ JSON)
// ---------------------------------------------------------------------------

async function fetchKununuSearch({ q, label }) {
  const jobs = [];
  let complete = true;
  let reportedLastPage = 1;

  for (let page = 1; page <= KUNUNU_PAGES_PER_SEARCH; page++) {
    const url = `https://www.kununu.com/at/jobs?q=${encodeURIComponent(q)}&loc=Wien&page=${page}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error(`  HTTP ${res.status} for kununu page ${page}`);
        complete = false;
        break;
      }
      const html = await res.text();

      // Extract __NEXT_DATA__ JSON blob
      const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
      if (!match) {
        console.error(`  No __NEXT_DATA__ found on kununu page ${page}`);
        complete = false;
        break;
      }

      const data = JSON.parse(match[1]);
      const searchJobs = data?.props?.pageProps?.searchJobs;
      if (!searchJobs?.jobs) {
        complete = false;
        break;
      }

      const lastPage = searchJobs.pagination?.lastPage || 1;
      reportedLastPage = lastPage;

      for (const job of searchJobs.jobs) {
        // Filter to Vienna: stateCode AT-9 or Wien in city/region
        const isVienna =
          job.stateCode === "AT-9" ||
          /^(?:wien|vienna)(?:\s*,|$)/i.test(job.city || "") ||
          /^(?:wien|vienna)(?:\s*,|$)/i.test(job.region || "");
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
          techStack: [],
          langReq: "de-basic",
        });
      }

      if (page >= lastPage) break;
    } catch (e) {
      console.error(`  Failed kununu page ${page}: ${e.message}`);
      complete = false;
      break;
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  if (reportedLastPage > KUNUNU_PAGES_PER_SEARCH) complete = false;
  return { jobs, complete, error: complete ? null : "incomplete pagination or request" };
}

// ---------------------------------------------------------------------------
// devjobs.at search (Vercel-protected pages, so use Playwright)
// ---------------------------------------------------------------------------

function normalizeWhitespace(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function isViennaLocation(value) {
  return /(?:^|,\s*)(?:wien|vienna)(?=\s*(?:,|$))/i.test(normalizeWhitespace(value));
}

function parseMapCoordinates(mapHref) {
  const match = (mapHref || "").match(/[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) return { lat: null, lng: null };
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function extractDevjobsLocation(text, details, mapHref) {
  const rawCity = normalizeWhitespace(details.Ort || "");
  const city = isViennaLocation(rawCity) ? "Wien" : rawCity;
  const coords = parseMapCoordinates(mapHref);
  let address = city === "Wien" ? "Wien" : city;
  let zip = null;

  const section = (text.split("Job Standorte")[1] || "").split("Das ist dein Arbeitgeber")[0] || "";
  const lines = section
    .split(/\n+/)
    .map(normalizeWhitespace)
    .filter(Boolean)
    .filter(line =>
      !/Stadia Maps|OpenMapTiles|OpenStreetMap contributors/i.test(line) &&
      line !== "Österreich"
    );

  for (let i = 0; i < lines.length; i++) {
    if (!/^Standort\b/i.test(lines[i]) || !/wien/i.test(lines[i])) continue;

    const block = [];
    for (let j = i + 1; j < lines.length && !/^Standort\b/i.test(lines[j]); j++) {
      block.push(lines[j]);
    }

    const zipIndex = block.findIndex(line => /\b1\d{3}\s+Wien\b/i.test(line));
    if (zipIndex >= 0) {
      const postalLine = block[zipIndex];
      zip = postalLine.match(/\b(1\d{3})\s+Wien\b/i)?.[1] || null;
      const street = block.slice(0, zipIndex).reverse().find(line => !/^\d{4}\s+Wien$/i.test(line));
      address = street ? `${street}, ${postalLine}` : postalLine;
      break;
    }
  }

  return {
    address,
    city,
    zip,
    lat: coords.lat,
    lng: coords.lng,
  };
}

function parseDevjobsCardFallback(card, source) {
  const lines = (card.text || "")
    .split(/\n+/)
    .map(normalizeWhitespace)
    .filter(Boolean)
    .filter(line => !/^(top|easy apply|neu|merken|bewerben|matching)$/i.test(line));

  return {
    url: card.url,
    title: lines[0] || "",
    company: lines[1] || "",
    source,
    city: null,
    address: null,
    zip: null,
    lat: null,
    lng: null,
    techStack: [],
    langReq: "unknown",
  };
}

async function collectDevjobsCards(page) {
  return page.locator(DEVJOBS_JOB_LINK_SELECTOR).evaluateAll(anchors => {
    const normalize = value => (value || "").replace(/\s+/g, " ").trim();
    return anchors
      .map(anchor => ({
        url: anchor.href,
        text: normalize(anchor.innerText || anchor.textContent),
      }))
      .filter(card =>
        /^https:\/\/devjobs\.at\/job\//.test(card.url) &&
        /(?:^|[\s,])Wien(?=[\s,]|$)/i.test(card.text)
      );
  });
}

async function fetchDevjobsDetail(page, card, source) {
  try {
    await page.goto(card.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("h1", { timeout: 15000 });

    const detail = await page.evaluate(() => {
      const doc = globalThis.document;
      const normalize = value => (value || "").replace(/\s+/g, " ").trim();
      const details = {};
      for (const dt of doc.querySelectorAll("dt")) {
        const key = normalize(dt.textContent);
        const value = normalize(dt.parentElement?.querySelector("dd")?.textContent);
        if (key && value) details[key] = value;
      }

      const techHeading = [...doc.querySelectorAll("h2,h3")]
        .find(heading => normalize(heading.textContent) === "Job Technologien");
      const techList = techHeading?.parentElement?.nextElementSibling;
      const techStack = techList
        ? [...techList.querySelectorAll('a[href^="/jobs/"]')].map(link => normalize(link.textContent)).filter(Boolean)
        : [];

      const companyLink = [...doc.querySelectorAll('a[href^="/team/"], a[href^="https://devjobs.at/team/"]')]
        .find(link => normalize(link.textContent));
      const mapHref = [...doc.querySelectorAll('a[href*="google.com/maps/search"]')]
        .map(link => link.href)
        .find(Boolean) || "";

      return {
        title: normalize(doc.querySelector("h1")?.textContent),
        company: normalize(companyLink?.textContent),
        details,
        techStack,
        mapHref,
        text: doc.body.innerText || "",
      };
    });

    const fallback = parseDevjobsCardFallback(card, source);
    const location = extractDevjobsLocation(detail.text, detail.details, detail.mapHref);
    if (!isViennaLocation(detail.details.Ort)) return { job: null, complete: true };
    const techStack = detail.techStack.length > 0 ? detail.techStack : extractTechStack(detail.text);

    return {
      complete: true,
      job: {
        ...fallback,
        title: detail.title || fallback.title,
        company: detail.company || fallback.company,
        city: location.city,
        address: location.address,
        zip: location.zip,
        lat: location.lat,
        lng: location.lng,
        techStack,
        langReq: extractLangReq(detail.text),
      },
    };
  } catch (e) {
    console.warn(`  Could not fetch devjobs.at detail for ${card.url}: ${e.message}`);
    return { job: null, complete: false, error: e.message };
  }
}

async function fetchDevjobsSearch({ slug, label }, browser) {
  const context = await browser.newContext();
  const searchPage = await context.newPage();
  const cardsByUrl = new Map();

  try {
    await searchPage.goto(`${DEVJOBS_BASE_URL}/jobs/${slug}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await searchPage.waitForSelector(DEVJOBS_JOB_LINK_SELECTOR, { timeout: 15000 });
    await searchPage.waitForTimeout(500);

    const buttonPageCount = await searchPage.locator("button").evaluateAll(buttons => {
      const numericLabels = buttons
        .map(button => (button.innerText || "").trim())
        .filter(label => /^\d+$/.test(label))
        .map(Number);
      return Math.max(1, ...numericLabels);
    });
    const resultPageCount = await searchPage.locator("body").evaluate(body => {
      const match = body.innerText.match(/(\d+)\s+Stellenangebote gefunden/i);
      return match ? Math.ceil(Number(match[1]) / 15) : 1;
    });
    const pageCount = Math.max(buttonPageCount, resultPageCount);

    for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
      if (pageNo > 1) {
        await searchPage.getByRole("button", { name: String(pageNo), exact: true }).click();
        await searchPage.waitForTimeout(DEVJOBS_PAGE_DELAY_MS);
      }

      const cards = await collectDevjobsCards(searchPage);
      for (const card of cards) {
        if (!cardsByUrl.has(card.url)) cardsByUrl.set(card.url, card);
      }
    }

    const detailPage = await context.newPage();
    const jobs = [];
    let detailFailures = 0;
    for (const card of cardsByUrl.values()) {
      const detail = await fetchDevjobsDetail(detailPage, card, label);
      if (detail.job) jobs.push(detail.job);
      if (!detail.complete) detailFailures++;
      await detailPage.waitForTimeout(DEVJOBS_PAGE_DELAY_MS);
    }

    return {
      jobs,
      complete: detailFailures === 0,
      error: detailFailures > 0 ? `${detailFailures} detail pages failed` : null,
    };
  } catch (e) {
    console.error(`  Failed devjobs.at search ${slug}: ${e.message}`);
    return { jobs: [], complete: false, error: e.message };
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Tech stack extraction from job description text
// ---------------------------------------------------------------------------

const TECH_TERMS = [
  // Test automation frameworks
  { name: "Playwright", re: /\bPlaywright\b/i },
  { name: "Cypress", re: /\bCypress\b/i },
  { name: "Selenium", re: /\bSelenium\b/i },
  { name: "Appium", re: /\bAppium\b/i },
  { name: "Robot Framework", re: /\bRobot\s+Framework\b/i },
  { name: "Tosca", re: /\bTosca\b/i },
  { name: "Ranorex", re: /\bRanorex\b/i },
  { name: "Puppeteer", re: /\bPuppeteer\b/i },
  { name: "TestCafe", re: /\bTestCafe\b/i },
  // Test tools / practices
  { name: "REST Assured", re: /\bREST\s*Assured\b/i },
  { name: "Postman", re: /\bPostman\b/i },
  { name: "JUnit", re: /\bJUnit\b/i },
  { name: "TestNG", re: /\bTestNG\b/i },
  { name: "Jest", re: /\bJest\b/i },
  { name: "Cucumber", re: /\bCucumber\b/i },
  { name: "BDD", re: /\bBDD\b/ },
  { name: "ISTQB", re: /\bISTQB\b/ },
  { name: "Manual Testing", re: /\bmanual\s+test/i },
  { name: "SoapUI", re: /\bSoapUI\b/i },
  { name: "JMeter", re: /\bJMeter\b/i },
  { name: "Gatling", re: /\bGatling\b/i },
  { name: "k6", re: /\bk6\b/ },
  { name: "LoadRunner", re: /\bLoadRunner\b/i },
  { name: "TestRail", re: /\bTestRail\b/i },
  { name: "Xray", re: /\bXray\b/i },
  // Languages
  { name: "Java", re: /\bJava\b(?!\s*Script)/i },
  { name: "Python", re: /\bPython\b/i },
  { name: "TypeScript", re: /\bTypeScript\b/i },
  { name: "JavaScript", re: /\bJavaScript\b/i },
  { name: "C#", re: /\bC#/ },
  { name: ".NET", re: /\.NET\b/i },
  { name: "Kotlin", re: /\bKotlin\b/i },
  { name: "Go", re: /\bGolang\b/i },
  { name: "Scala", re: /\bScala\b/i },
  { name: "Ruby", re: /\bRuby\b/i },
  { name: "PHP", re: /\bPHP\b/ },
  { name: "SQL", re: /\bSQL\b/ },
  // Frameworks / platforms
  { name: "React", re: /\bReact\b/i },
  { name: "Angular", re: /\bAngular\b/i },
  { name: "Vue.js", re: /\bVue\.?js\b/i },
  { name: "Node.js", re: /\bNode\.?js\b/i },
  { name: "Spring", re: /\bSpring\s*Boot\b|\bSpring\s+Framework\b/i },
  { name: "Next.js", re: /\bNext\.?js\b/i },
  // DevOps / CI
  { name: "Docker", re: /\bDocker\b/i },
  { name: "Kubernetes", re: /\bKubernetes\b/i },
  { name: "CI/CD", re: /\bCI\/?CD\b/ },
  { name: "Jenkins", re: /\bJenkins\b/i },
  { name: "Azure DevOps", re: /\bAzure\s+DevOps\b/i },
  { name: "GitLab CI/CD", re: /\bGitLab\s+CI\b/i },
  { name: "GitHub Actions", re: /\bGitHub\s+Actions\b/i },
  { name: "Terraform", re: /\bTerraform\b/i },
  { name: "AWS", re: /\bAWS\b/ },
  // Tools
  { name: "Jira", re: /\bJira\b/i },
  { name: "Confluence", re: /\bConfluence\b/i },
  { name: "Git", re: /\bGit\b(?!\s*(?:Hub|Lab))/i },
  { name: "REST APIs", re: /\bREST\s+API/i },
  { name: "GraphQL", re: /\bGraphQL\b/i },
  { name: "SOAP", re: /\bSOAP\b/ },
  { name: "Kafka", re: /\bKafka\b/i },
  { name: "MongoDB", re: /\bMongoDB\b/i },
  { name: "PostgreSQL", re: /\bPostgres(?:QL)?\b/i },
  { name: "Agile", re: /\bAgile\b/i },
  { name: "Scrum", re: /\bScrum\b/i },
  { name: "Swagger", re: /\bSwagger\b|\bOpenAPI\b/i },
  { name: "Grafana", re: /\bGrafana\b/i },
  // Legacy
  { name: "TFS", re: /\bTFS\b/ },
  { name: "AUTOSAR", re: /\bAUTOSAR\b/ },
  { name: "Embedded Testing", re: /\bembedded\s+test/i },
];

function stripHtmlToText(html) {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function extractTechStack(html) {
  const text = stripHtmlToText(html);
  const found = new Set();
  for (const { name, re } of TECH_TERMS) {
    if (re.test(text)) found.add(name);
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// Language requirement extraction from job description text
// ---------------------------------------------------------------------------

function extractLangReq(html) {
  const text = stripHtmlToText(html);

  // Strong fluent-German signals
  if (/verhandlungssicher.*deutsch|deutsch.*verhandlungssicher/i.test(text)) return "de-fluent";
  if (/flie[sß]end.*deutsch|deutsch.*flie[sß]end/i.test(text)) return "de-fluent";
  if (/sehr\s+gut[e ].*deutsch|deutsch.*sehr\s+gut/i.test(text)) return "de-fluent";
  if (/deutsch.*\b(?:c1|c2)\b|\b(?:c1|c2)\b.*deutsch/i.test(text)) return "de-fluent";
  if (/muttersprach.*deutsch|deutsch.*muttersprach/i.test(text)) return "de-fluent";
  if (/perfekt.*deutsch|deutsch.*perfekt/i.test(text)) return "de-fluent";

  // English-primary workplace signals
  const hasEnglishWork = /(?:working|company)\s+language.*english|english.*(?:working|company)\s+language/i.test(text);
  const germanOptional = /deutsch.*(?:von\s+vorteil|wünschenswert|nice\s+to\s+have|a\s+plus)/i.test(text);
  const noGermanReq = !/\bdeutsch/i.test(text);

  if (hasEnglishWork) return "en";
  if (germanOptional) return "en";
  if (noGermanReq && /\benglish\b/i.test(text)) return "en";

  return "de-basic";
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
  let cache = {};
  if (existsSync(cachePath)) {
    try { cache = JSON.parse(readFileSync(cachePath, "utf-8")); } catch { /* corrupt cache — start fresh */ }
  }

  let cacheHits = 0, newLookups = 0, failures = 0;

  for (const job of jobs) {
    if (typeof job.lat === "number" && typeof job.lng === "number") {
      continue;
    }

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

  writeJsonAtomic(cachePath, cache);
  console.log(`Geocoded ${cacheHits + newLookups + failures} addresses (${cacheHits} cache hits, ${newLookups} new lookups, ${failures} failures)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startedAt = new Date().toISOString();
  const path = "public/jobs.json";
  let previousData = { jobs: [] };
  if (existsSync(path)) {
    try {
      previousData = JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      // Continue with an empty snapshot; validation prevents publishing bad output.
    }
  }

  const previousJobs = Array.isArray(previousData.jobs) ? previousData.jobs : [];
  const previousScraperJobs = previousJobs.filter(j => !String(j.source || "").startsWith("jobspy-"));
  const previousJobSpyJobs = previousJobs
    .filter(j => String(j.source || "").startsWith("jobspy-"))
    .map(j => hydrateJob(j, {
      now: startedAt,
      observed: false,
      fallbackFirstSeen: previousData.lastUpdated,
    }));
  const candidates = [];
  const completedSources = new Set();
  const queryHealth = {};
  const rejectionCounts = {};
  let accepted = 0;
  let rejected = 0;

  const recordResult = (label, result, { required = true } = {}) => {
    const previousCount = previousScraperJobs.filter(job =>
      [job.source, ...(job.sources || [])].includes(label)
    ).length;
    const countCliff = result.complete && previousCount > 0 && result.jobs.length === 0;
    const complete = result.complete && !countCliff;
    queryHealth[label] = {
      status: complete ? "healthy" : required ? "partial" : "unavailable",
      required,
      count: result.jobs.length,
      previousCount,
      error: result.error || (countCliff ? "unexpected zero-result source run" : null),
      checkedAt: startedAt,
    };
    if (complete) completedSources.add(label);

    for (const job of result.jobs) {
      const validation = validateJob(job);
      if (validation.valid) {
        candidates.push(job);
        accepted++;
      } else {
        rejected++;
        rejectionCounts[validation.reason] = (rejectionCounts[validation.reason] || 0) + 1;
      }
    }
  };

  // --- karriere.at ---
  console.log("Searching karriere.at for Vienna SDET/QA jobs...");
  for (const s of KARRIERE_SEARCHES) {
    const result = await fetchSearch(s);
    console.log(`  "${s.label}": ${result.jobs.length} results${result.complete ? "" : " (partial)"}`);
    recordResult(s.label, result);
    await new Promise(r => setTimeout(r, 1000));
  }

  // --- kununu ---
  console.log("\nSearching kununu.com for Vienna SDET/QA jobs...");
  for (const s of KUNUNU_SEARCHES) {
    const result = await fetchKununuSearch(s);
    console.log(`  "${s.label}": ${result.jobs.length} Vienna results${result.complete ? "" : " (partial)"}`);
    recordResult(s.label, result, { required: !s.optional });
  }

  // --- devjobs.at ---
  console.log("\nSearching devjobs.at for Vienna SDET/QA jobs...");
  let devjobsBrowser = null;
  try {
    devjobsBrowser = await chromium.launch({ headless: true });

    for (const s of DEVJOBS_SEARCHES) {
      const result = await fetchDevjobsSearch(s, devjobsBrowser);
      console.log(`  "${s.label}": ${result.jobs.length} results${result.complete ? "" : " (partial)"}`);
      recordResult(s.label, result);
    }
  } catch (e) {
    console.warn(`  WARNING: devjobs.at search skipped: ${e.message}`);
    for (const s of DEVJOBS_SEARCHES) {
      if (!queryHealth[s.label]) recordResult(s.label, { jobs: [], complete: false, error: e.message });
    }
  } finally {
    if (devjobsBrowser) await devjobsBrowser.close();
  }

  // Validation summary
  const reasonSummary = Object.entries(rejectionCounts)
    .map(([r, c]) => `${c} ${r}`)
    .join(", ");
  console.log(`\nValidation: ${accepted} accepted, ${rejected} rejected${reasonSummary ? ` (${reasonSummary})` : ""}`);

  if (completedSources.size === 0) {
    console.error("\nERROR: No source query completed. Preserving the existing feed.");
    process.exit(1);
  }

  if (candidates.length === 0 && previousScraperJobs.length === 0) {
    console.error("\nERROR: All completed searches returned zero valid results and there is no prior feed.");
    process.exit(1);
  }

  // --- Task 1: Fetch detail pages for address info (karriere.at only) ---
  const karriereJobs = candidates.filter(j => j.url.includes("karriere.at"));
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
        job.techStack = extractTechStack(html);
        job.langReq = extractLangReq(html);
      } else {
        job.address = null;
        job.city = null;
        job.zip = null;
        job.techStack = [];
        job.langReq = "unknown";
      }
    } catch (e) {
      console.warn(`  Could not fetch detail for ${job.title}: ${e.message}`);
      job.address = null;
      job.city = null;
      job.zip = null;
      job.techStack = [];
      job.langReq = "unknown";
    }
    if (i < karriereJobs.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.log(`  Extracted addresses for ${addressCount}/${karriereJobs.length} karriere.at jobs`);

  // --- Task 2: Geocode addresses ---
  console.log("\nGeocoding job addresses...");
  await geocodeJobs(candidates, "public/geocoding-cache.json");

  const lifecycle = reconcileJobs({
    previous: previousScraperJobs,
    current: candidates,
    completedSources,
    now: startedAt,
    missingThreshold: 2,
    fallbackFirstSeen: previousData.lastUpdated,
  });
  const jobs = [...lifecycle.jobs, ...previousJobSpyJobs].sort((a, b) =>
    String(a.company).localeCompare(String(b.company))
    || String(a.title).localeCompare(String(b.title))
    || String(a.id).localeCompare(String(b.id))
  );

  const allQueries = [...KARRIERE_SEARCHES, ...KUNUNU_SEARCHES, ...DEVJOBS_SEARCHES];
  const fullySuccessful = allQueries
    .filter(query => !query.optional)
    .every(query => queryHealth[query.label]?.status === "healthy");
  const hasSourceWarnings = allQueries.some(query => queryHealth[query.label]?.status !== "healthy");

  // --- Task 3: Write output to public/jobs.json ---
  const result = {
    ...previousData,
    lastUpdated: startedAt,
    contentUpdatedAt: startedAt,
    lastFullySuccessfulAt: fullySuccessful
      ? startedAt
      : (previousData.lastFullySuccessfulAt || previousData.lastUpdated || null),
    partial: !fullySuccessful,
    count: jobs.length,
    jobs,
    searchLinks: [
      { label: "karriere.at", url: "https://www.karriere.at/jobs/test-automation/in-wien" },
      { label: "kununu", url: "https://www.kununu.com/at/jobs?q=test+automation&loc=Wien" },
      { label: "devjobs.at", url: "https://devjobs.at/jobs/qa-engineer" },
      { label: "LinkedIn", url: "https://www.linkedin.com/jobs/search/?keywords=SDET&location=Vienna" },
      { label: "StepStone", url: "https://www.stepstone.at/jobs/test-automation/in-wien" },
      { label: "indeed.at", url: "https://at.indeed.com/jobs?q=SDET&l=Wien" },
    ],
    validation: {
      accepted,
      rejected,
      reasons: rejectionCounts,
      deduplicated: accepted - lifecycle.jobs.filter(job => job.lastSeenAt === startedAt).length,
    },
    sourceHealth: {
      ...(previousData.sourceHealth || {}),
      scraper: {
        status: fullySuccessful
          ? (hasSourceWarnings ? "healthy-with-warnings" : "healthy")
          : "partial",
        checkedAt: startedAt,
        queries: queryHealth,
      },
    },
    lifecycle: {
      closedThisRun: lifecycle.closed.length,
      retainedJobSpy: previousJobSpyJobs.length,
    },
    datasetHash: datasetHash(jobs),
  };

  writeJsonAtomic(path, result);
  console.log(`Wrote ${jobs.length} reconciled jobs to ${path}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
