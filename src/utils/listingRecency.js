function validTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function listingDate(job = {}) {
  const publishedAt = validTimestamp(job.publishedAt);
  if (publishedAt) {
    return {
      timestamp: publishedAt,
      kind: "published",
      confidence: job.publishedAtConfidence || "high",
    };
  }
  const firstSeenAt = validTimestamp(job.firstSeenAt);
  if (firstSeenAt) {
    return { timestamp: firstSeenAt, kind: "discovered", confidence: "low" };
  }
  return { timestamp: null, kind: "unknown", confidence: "unknown" };
}

export function ageInDays(timestamp, now = new Date()) {
  const value = validTimestamp(timestamp);
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000));
}

export function formatListingAge(job, now = new Date()) {
  const recency = listingDate(job);
  const days = ageInDays(recency.timestamp, now);
  if (days == null) return "Date unknown";
  const age = days === 0 ? "today" : days === 1 ? "1 day ago" : `${days}d ago`;
  return `${recency.kind === "published" ? "Posted" : "Discovered"} ${age}`;
}

export function matchesRecency(job, value, now = new Date()) {
  if (!value || value === "all") return true;
  const { timestamp } = listingDate(job);
  if (value === "unknown") return timestamp == null;
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0 || !timestamp) return false;
  return now.getTime() - new Date(timestamp).getTime() <= days * 86_400_000;
}
