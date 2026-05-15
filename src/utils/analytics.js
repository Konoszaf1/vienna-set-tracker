/**
 * Aggregation helpers for the analytics view.
 * All functions are pure — they return chart-ready data shapes.
 */

const DAY_MS = 86400000;

/**
 * "2026-04-29" for a Date or ISO string.
 */
function dayKey(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Unique listings observed per day (by URL), and the running cumulative.
 *
 *   firstSeenMap = { [url]: ISO timestamp }
 *
 * Returns:
 *   {
 *     points: [{ date: "2026-04-29", new: 3, total: 12 }, …],
 *     totalUnique: 12,
 *   }
 *
 * The series is dense — every day between the earliest and latest firstSeen
 * (inclusive) gets an entry, even days with zero new listings — so the
 * cumulative line doesn't visually "jump" over gaps.
 */
export function listingsOverTime(firstSeenMap) {
  const buckets = new Map();
  for (const ts of Object.values(firstSeenMap || {})) {
    const k = dayKey(ts);
    if (!k) continue;
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }

  if (buckets.size === 0) return { points: [], totalUnique: 0 };

  const days = [...buckets.keys()].sort();
  const start = new Date(days[0]);
  const end = new Date(days[days.length - 1]);
  const points = [];
  let total = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const k = dayKey(new Date(t));
    const n = buckets.get(k) || 0;
    total += n;
    points.push({ date: k, new: n, total });
  }
  return { points, totalUnique: total };
}

function snapshotPointsFromHistory(history, currentJobs, currentSnapshotDate) {
  const snapshots = Array.isArray(history)
    ? history
    : Array.isArray(history?.snapshots)
      ? history.snapshots
      : [];

  const byDate = new Map();
  for (const s of snapshots) {
    const k = dayKey(s?.date);
    const activeJobs = Number(s?.activeJobs);
    if (!k || !Number.isFinite(activeJobs) || activeJobs < 0) continue;
    byDate.set(k, Math.round(activeJobs));
  }

  if (byDate.size === 0) return [];

  const currentDate = dayKey(currentSnapshotDate);
  if (currentDate && Array.isArray(currentJobs)) {
    byDate.set(currentDate, currentJobs.length);
  }

  const days = [...byDate.keys()].sort();
  const start = new Date(days[0]);
  const end = new Date(days[days.length - 1]);
  const points = [];
  let lastValue = 0;

  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const k = dayKey(new Date(t));
    if (byDate.has(k)) lastValue = byDate.get(k);
    points.push({ date: k, active: lastValue });
  }

  return points;
}

function snapshotPointsFromLiveListings(firstSeenMap, currentJobs, now) {
  const liveUrls = new Set(
    (currentJobs || [])
      .map(j => j?.url)
      .filter(Boolean)
  );

  if (liveUrls.size === 0) return [];

  const buckets = new Map();
  for (const url of liveUrls) {
    const k = dayKey(firstSeenMap?.[url] || now);
    if (!k) continue;
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }

  if (buckets.size === 0) return [];

  const days = [...buckets.keys()].sort();
  const start = new Date(days[0]);
  const end = new Date(dayKey(now) || days[days.length - 1]);
  const points = [];
  let active = 0;

  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const k = dayKey(new Date(t));
    active += buckets.get(k) || 0;
    points.push({ date: k, active });
  }

  return points;
}

/**
 * Active job openings over time.
 *
 * Prefer persisted daily snapshots from public/job-history.json, which are
 * written after the liveness verifier prunes 404/expired listings. If that
 * history file does not exist yet, fall back to the browser's current live
 * jobs plus first-seen dates, so removed jobs are not counted.
 */
export function activeListingsOverTime({
  history,
  jobs,
  firstSeenMap,
  now = new Date(),
  currentSnapshotDate,
} = {}) {
  const historyPoints = snapshotPointsFromHistory(history, jobs, currentSnapshotDate);
  if (historyPoints.length > 0) return { points: historyPoints };

  return { points: snapshotPointsFromLiveListings(firstSeenMap, jobs, now) };
}

/**
 * Top-N employers by number of open roles (jobs in their group).
 * `entries` is the App's grouped company list.
 */
export function topEmployers(entries, n = 10) {
  return [...entries]
    .map(c => ({ name: c.name, value: c.openRoles?.length || 0 }))
    .filter(e => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/**
 * Language requirement distribution across companies.
 */
export function langReqBreakdown(entries) {
  const labels = { "de-fluent": "Fluent German", "de-basic": "Basic German", "en": "English / accessible" };
  const counts = { "de-fluent": 0, "de-basic": 0, "en": 0 };
  for (const c of entries) {
    if (counts[c.langReq] != null) counts[c.langReq]++;
  }
  return Object.entries(counts).map(([key, value]) => ({ name: labels[key], key, value }));
}

/**
 * Salary tier distribution from the salaryMap. Tier thresholds match the
 * map's marker color palette (≥70 / 60–69 / 55–59 / <55 / unknown).
 */
export function salaryTierBreakdown(entries, salaryMap) {
  const buckets = [
    { name: "≥ €70k",  key: "high",  value: 0 },
    { name: "€60–69k", key: "midhi", value: 0 },
    { name: "€55–59k", key: "mid",   value: 0 },
    { name: "< €55k",  key: "low",   value: 0 },
    { name: "Unknown", key: "none",  value: 0 },
  ];
  for (const c of entries) {
    const s = salaryMap?.[c.id]?.best;
    if (s == null) buckets[4].value++;
    else if (s >= 70) buckets[0].value++;
    else if (s >= 60) buckets[1].value++;
    else if (s >= 55) buckets[2].value++;
    else buckets[3].value++;
  }
  return buckets;
}

/**
 * Top-N tech tags across all entries (deduplicated within each company).
 */
export function topTechStack(entries, n = 10) {
  const counts = new Map();
  for (const c of entries) {
    for (const t of c.techStack || []) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/**
 * Listings per Vienna district (entries[].district).
 * Districts that aren't recognised collapse into "Other".
 */
export function districtBreakdown(entries) {
  const counts = new Map();
  for (const c of entries) {
    const d = (c.district || "Unknown").trim();
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
