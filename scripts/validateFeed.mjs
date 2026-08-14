#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";
import { pathToFileURL } from "url";
import { datasetHash } from "./jobLifecycle.mjs";

const LANGUAGES = new Set(["en", "de-basic", "de-fluent", "unknown"]);

export function validateFeed(data, { now = new Date(), maxFullySuccessfulAgeHours = 72 } = {}) {
  const errors = [];
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  if (jobs.length === 0) errors.push("feed contains no jobs");
  if (data?.count !== jobs.length) errors.push(`count ${data?.count} does not match ${jobs.length} jobs`);

  const ids = new Set();
  for (const [index, job] of jobs.entries()) {
    const prefix = `jobs[${index}]`;
    for (const field of ["id", "url", "title", "company", "source", "firstSeenAt", "lastSeenAt"]) {
      if (!String(job?.[field] || "").trim()) errors.push(`${prefix}.${field} is required`);
    }
    if (job?.id && ids.has(job.id)) errors.push(`duplicate job id ${job.id}`);
    ids.add(job?.id);
    try {
      const url = new URL(job?.url);
      if (url.protocol !== "https:") errors.push(`${prefix}.url must use HTTPS`);
    } catch {
      errors.push(`${prefix}.url is invalid`);
    }
    if (!LANGUAGES.has(job?.langReq)) errors.push(`${prefix}.langReq is invalid`);
    if (!Array.isArray(job?.techStack)) errors.push(`${prefix}.techStack must be an array`);
    const hasLat = typeof job?.lat === "number";
    const hasLng = typeof job?.lng === "number";
    if (hasLat !== hasLng) errors.push(`${prefix} must provide both lat and lng`);
    if (hasLat && (job.lat < -90 || job.lat > 90 || job.lng < -180 || job.lng > 180)) {
      errors.push(`${prefix} coordinates are out of range`);
    }
  }

  if (data?.datasetHash !== datasetHash(jobs)) errors.push("datasetHash does not match canonical jobs");

  const lastFull = new Date(data?.lastFullySuccessfulAt || "");
  if (Number.isNaN(lastFull.getTime())) {
    errors.push("lastFullySuccessfulAt is required");
  } else {
    const ageHours = (now.getTime() - lastFull.getTime()) / 3_600_000;
    if (ageHours > maxFullySuccessfulAgeHours) {
      errors.push(`last fully successful source run is ${Math.floor(ageHours)} hours old`);
    }
  }

  return errors;
}

function main() {
  const path = "public/jobs.json";
  if (!existsSync(path)) throw new Error(`${path} does not exist`);
  const data = JSON.parse(readFileSync(path, "utf-8"));
  const errors = validateFeed(data);
  if (errors.length > 0) {
    console.error("Feed validation failed:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Feed validation passed: ${data.jobs.length} unique jobs, hash ${data.datasetHash.slice(0, 12)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
