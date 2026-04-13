#!/usr/bin/env node
/**
 * Final title filter — reads public/jobs.json, runs every job through
 * validateJob, writes back only the accepted listings.
 */

import { readFileSync, writeFileSync } from "fs";
import { validateJob } from "./jobValidator.mjs";

const path = "public/jobs.json";
const data = JSON.parse(readFileSync(path, "utf-8"));
const before = data.jobs.length;

data.jobs = data.jobs.filter(j => {
  const { valid, reason } = validateJob(j);
  if (!valid) console.log(`  FILTERED: ${j.title} (${j.company}) — ${reason}`);
  return valid;
});

data.count = data.jobs.length;
writeFileSync(path, JSON.stringify(data, null, 2));
console.log(`Final filter: ${before} → ${data.jobs.length} jobs (removed ${before - data.jobs.length})`);
