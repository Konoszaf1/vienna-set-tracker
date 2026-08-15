import { createHash } from "crypto";
import { normalizeCompanyName } from "../src/utils/normalizeCompany.js";
import { canonicalizeTechStack } from "../src/utils/normalizeTech.js";

const TRACKING_PARAMS = new Set([
  "ref", "refid", "trk", "trackingid", "originalsubdomain", "src", "source",
]);

export function canonicalizeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
}

export { canonicalizeTechStack };

export function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\((?:m\/[wfd](?:\/[xd])?|all genders?)\)/gi, " ")
    .replace(/[^\p{L}\p{N}#+.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function jobFingerprint(job) {
  return `${normalizeCompanyName(job?.company)}::${normalizeTitle(job?.title)}`;
}

function sourceNativeId(job, url) {
  const hostname = url.hostname.replace(/^www\./, "");
  const path = url.pathname;
  if (hostname === "karriere.at") return path.match(/\/jobs\/(\d+)/)?.[1];
  if (hostname === "linkedin.com") return path.match(/\/jobs\/view\/(\d+)/)?.[1];
  if (hostname.endsWith("indeed.com")) return url.searchParams.get("jk");
  if (hostname === "devjobs.at") return path.match(/\/job\/([^/]+)/)?.[1];
  if (hostname === "kununu.com") return path.split("/").filter(Boolean).at(-1);
  return null;
}

export function stableJobId(job) {
  const canonicalUrl = canonicalizeUrl(job?.url);
  try {
    const url = new URL(canonicalUrl);
    const nativeId = sourceNativeId(job, url);
    if (nativeId) {
      const hostname = url.hostname.replace(/^www\./, "");
      const board = hostname.endsWith("indeed.com") ? "indeed" : hostname.split(".")[0];
      return `job-${board}-${nativeId}`;
    }
  } catch {
    // Fall back to a content hash when the source URL is malformed.
  }
  const digest = createHash("sha256")
    .update(canonicalUrl || jobFingerprint(job))
    .digest("hex")
    .slice(0, 16);
  return `job-${digest}`;
}

function earlierTimestamp(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

export function hydrateJob(job, { now = new Date().toISOString(), observed = true, fallbackFirstSeen } = {}) {
  const canonicalUrl = canonicalizeUrl(job?.url);
  const firstSeenAt = job?.firstSeenAt || fallbackFirstSeen || now;
  return {
    ...job,
    id: job?.id || stableJobId(job),
    url: canonicalUrl,
    urlAliases: [...new Set([...(job?.urlAliases || []), job?.url, canonicalUrl].filter(Boolean))],
    sources: [...new Set([...(job?.sources || []), job?.source].filter(Boolean))],
    techStack: canonicalizeTechStack(job?.techStack),
    langReq: job?.langReq || "unknown",
    firstSeenAt,
    lastSeenAt: observed ? now : (job?.lastSeenAt || firstSeenAt),
    status: "open",
    consecutiveMisses: observed ? 0 : Number(job?.consecutiveMisses || 0),
  };
}

export function mergeJobs(existing, incoming, now = new Date().toISOString()) {
  const next = hydrateJob(incoming, { now });
  const previous = hydrateJob(existing, { now, observed: false });
  const merged = {
    ...previous,
    ...next,
    id: previous.id || next.id,
    firstSeenAt: earlierTimestamp(previous.firstSeenAt, next.firstSeenAt),
    lastSeenAt: now,
    urlAliases: [...new Set([...previous.urlAliases, ...next.urlAliases])],
    sources: [...new Set([...previous.sources, ...next.sources])],
    techStack: canonicalizeTechStack([...previous.techStack, ...next.techStack]),
    sourceStatus: "healthy",
    consecutiveMisses: 0,
  };

  merged.publishedAt = earlierTimestamp(previous.publishedAt, next.publishedAt);
  if (!merged.publishedAt) delete merged.publishedAt;

  for (const field of [
    "address", "city", "zip", "lat", "lng", "kununuScore", "glassdoorScore", "reportedSalary",
    "publishedAtSource", "publishedAtConfidence", "advertisedSalaryMin", "advertisedSalaryMax",
    "advertisedSalaryCurrency", "advertisedSalaryPeriod", "advertisedSalaryKind", "advertisedSalarySource",
  ]) {
    if ((next[field] == null || next[field] === "") && previous[field] != null && previous[field] !== "") {
      merged[field] = previous[field];
    }
  }
  if (next.langReq === "unknown" && previous.langReq !== "unknown") merged.langReq = previous.langReq;
  return merged;
}

function findMatch(indexes, job) {
  return indexes.byId.get(job.id)
    || indexes.byUrl.get(job.url)
    || indexes.byFingerprint.get(jobFingerprint(job));
}

function indexJob(indexes, job) {
  indexes.byId.set(job.id, job);
  indexes.byUrl.set(job.url, job);
  for (const url of job.urlAliases || []) indexes.byUrl.set(canonicalizeUrl(url), job);
  const fingerprint = jobFingerprint(job);
  if (fingerprint !== "::") indexes.byFingerprint.set(fingerprint, job);
}

export function reconcileJobs({
  previous = [],
  current = [],
  completedSources = [],
  now = new Date().toISOString(),
  missingThreshold = 2,
  fallbackFirstSeen,
} = {}) {
  const complete = new Set(completedSources);
  const indexes = { byId: new Map(), byUrl: new Map(), byFingerprint: new Map() };
  const jobs = [];

  for (const raw of current) {
    const incoming = hydrateJob(raw, { now, fallbackFirstSeen });
    const existing = findMatch(indexes, incoming);
    if (existing) {
      const merged = mergeJobs(existing, incoming, now);
      Object.assign(existing, merged);
      indexJob(indexes, existing);
    } else {
      jobs.push(incoming);
      indexJob(indexes, incoming);
    }
  }

  const closed = [];
  for (const raw of previous) {
    const previousJob = hydrateJob(raw, { now, observed: false, fallbackFirstSeen });
    const match = findMatch(indexes, previousJob);
    if (match) {
      const merged = mergeJobs(previousJob, match, now);
      Object.assign(match, merged);
      indexJob(indexes, match);
      continue;
    }

    const previousSources = previousJob.sources?.length
      ? previousJob.sources
      : [previousJob.source].filter(Boolean);
    if (!previousSources.every(source => complete.has(source))) {
      const retained = { ...previousJob, sourceStatus: "retained-after-partial-run" };
      jobs.push(retained);
      indexJob(indexes, retained);
      continue;
    }

    const consecutiveMisses = previousJob.consecutiveMisses + 1;
    if (consecutiveMisses < missingThreshold) {
      const probation = { ...previousJob, consecutiveMisses, sourceStatus: "missing-probation" };
      jobs.push(probation);
      indexJob(indexes, probation);
    } else {
      closed.push({
        ...previousJob,
        status: "closed",
        closedAt: now,
        closeReason: "missing-from-complete-source-run",
        consecutiveMisses,
      });
    }
  }

  jobs.sort((a, b) =>
    String(a.company).localeCompare(String(b.company))
    || String(a.title).localeCompare(String(b.title))
    || String(a.id).localeCompare(String(b.id))
  );
  return { jobs, closed };
}

export function datasetHash(jobs) {
  const stable = (jobs || []).map(job => ({
    id: job.id,
    url: job.url,
    title: job.title,
    company: job.company,
    status: job.status,
  }));
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}
