#!/usr/bin/env node
/**
 * Final title filter — reads public/jobs.json, runs every job through
 * validateJob, writes back only the accepted listings.
 */

import { readFileSync } from "fs";
import { pathToFileURL } from "url";
import { writeJsonAtomic } from "./atomicJson.mjs";
import { validateJob } from "./jobValidator.mjs";

export function filterFeed(data) {
  const before = data.jobs.length;
  data.jobs = data.jobs.filter(j => {
    const { valid, reason } = validateJob(j);
    if (!valid) console.log(`  FILTERED: ${j.title} (${j.company}) — ${reason}`);
    return valid;
  });
  data.count = data.jobs.length;
  return { data, removed: before - data.jobs.length };
}

function main() {
  const path = "public/jobs.json";
  const input = JSON.parse(readFileSync(path, "utf-8"));
  const before = input.jobs.length;
  const { data, removed } = filterFeed(input);
  writeJsonAtomic(path, data);
  console.log(`Final filter: ${before} → ${data.jobs.length} jobs (removed ${removed})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
