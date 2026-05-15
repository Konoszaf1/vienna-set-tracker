#!/usr/bin/env node
/**
 * Daily active-job history writer.
 *
 * Run after verify-jobs.mjs so public/jobs.json has already dropped listings
 * that returned 404/expired signals. The frontend uses this compact snapshot
 * series for the "active job openings over time" chart.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { pathToFileURL } from "url";

const JOBS_PATH = "public/jobs.json";
const HISTORY_PATH = "public/job-history.json";
const MAX_SNAPSHOTS = 730;

function dayKey(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function uniqueCompanyCount(jobs) {
  const companies = new Set(
    jobs
      .map(j => (j.company || "").trim().toLowerCase())
      .filter(Boolean)
  );
  return companies.size;
}

export function normalizeHistory(raw) {
  if (Array.isArray(raw)) return { snapshots: raw };
  if (!raw || typeof raw !== "object") return { snapshots: [] };
  return {
    ...raw,
    snapshots: Array.isArray(raw.snapshots) ? raw.snapshots : [],
  };
}

export function makeSnapshot(jobsData, options = {}) {
  const jobs = Array.isArray(jobsData?.jobs) ? jobsData.jobs : [];
  const recordedAt = options.recordedAt || new Date().toISOString();
  const date = dayKey(options.date || jobsData?.lastVerified || jobsData?.lastUpdated || recordedAt);

  if (!date) {
    throw new Error("Cannot determine snapshot date");
  }

  return {
    date,
    activeJobs: jobs.length,
    activeCompanies: uniqueCompanyCount(jobs),
    sourceLastUpdated: jobsData?.lastUpdated || null,
    sourceLastVerified: jobsData?.lastVerified || null,
    recordedAt,
  };
}

export function mergeSnapshot(historyInput, snapshot, limit = MAX_SNAPSHOTS) {
  const history = normalizeHistory(historyInput);
  const byDate = new Map();

  for (const s of history.snapshots) {
    const k = dayKey(s?.date);
    const activeJobs = Number(s?.activeJobs);
    if (!k || !Number.isFinite(activeJobs) || activeJobs < 0) continue;
    byDate.set(k, { ...s, date: k, activeJobs: Math.round(activeJobs) });
  }

  byDate.set(snapshot.date, snapshot);

  const snapshots = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(limit > 0 ? -limit : 0);

  return {
    ...history,
    lastUpdated: snapshot.recordedAt,
    snapshots,
  };
}

export function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeJobHistory({
  jobsPath = JOBS_PATH,
  historyPath = HISTORY_PATH,
  snapshotDate = process.env.JOB_HISTORY_DATE,
} = {}) {
  if (!existsSync(jobsPath)) {
    throw new Error(`No ${jobsPath} found`);
  }

  const jobsData = readJson(jobsPath, null);
  const history = readJson(historyPath, { snapshots: [] });
  const snapshot = makeSnapshot(jobsData, { date: snapshotDate });
  const updated = mergeSnapshot(history, snapshot);

  mkdirSync(dirname(historyPath), { recursive: true });
  writeFileSync(historyPath, JSON.stringify(updated, null, 2));
  return updated;
}

function main() {
  const updated = writeJobHistory();
  const latest = updated.snapshots[updated.snapshots.length - 1];
  console.log(`Updated ${HISTORY_PATH}: ${latest.activeJobs} active jobs on ${latest.date}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
