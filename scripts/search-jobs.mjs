#!/usr/bin/env node
/**
 * Searches karriere.at for SDET/QA jobs in Vienna.
 * Outputs public/latest-jobs.json which the app loads at runtime.
 */

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
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const jobs = [];
    const titleRegex = /m-jobsListItem__titleLink"[^>]*href="(https:\/\/www\.karriere\.at\/jobs\/\d+)"[^>]*>\s*([^<]+)/gi;
    const compRegex = /m-jobsListItem__companyName[^"]*"[^>]*>([^<]+)/gi;

    const titles = [];
    const companies = [];
    let m;
    while ((m = titleRegex.exec(html)) !== null) {
      titles.push({ url: m[1].trim(), title: m[2].replace(/&amp;/g, "&").trim() });
    }
    while ((m = compRegex.exec(html)) !== null) {
      companies.push(m[1].replace(/&amp;/g, "&").trim());
    }

    for (let i = 0; i < titles.length; i++) {
      jobs.push({
        url: titles[i].url,
        title: titles[i].title,
        company: companies[i] || "",
        source: label,
      });
    }
    return jobs;
  } catch (e) {
    console.error(`Failed: ${slug}:`, e.message);
    return [];
  }
}

async function main() {
  console.log("Searching karriere.at for Vienna SDET/QA jobs...");

  const allJobs = new Map();

  for (const s of SEARCHES) {
    const jobs = await fetchSearch(s);
    console.log(`  "${s.label}": ${jobs.length} results`);
    for (const j of jobs) {
      if (j.url && !allJobs.has(j.url)) {
        allJobs.set(j.url, j);
      }
    }
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
  console.log(`Wrote ${allJobs.size} unique jobs to public/latest-jobs.json`);
}

main();
