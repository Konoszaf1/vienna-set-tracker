export function feedHealth(meta = {}, now = new Date(), staleAfterHours = 48) {
  const timestamp = meta.lastFullySuccessfulAt || meta.lastVerified || meta.lastUpdated || null;
  const parsed = timestamp ? new Date(timestamp) : null;
  const valid = parsed && !Number.isNaN(parsed.getTime());
  const ageHours = valid ? Math.max(0, (now.getTime() - parsed.getTime()) / 3_600_000) : Infinity;
  const stale = !valid || ageHours > staleAfterHours;
  const sourceStatuses = Object.values(meta.sourceHealth || {}).map(source => source?.status);
  const partial = Boolean(meta.partial || sourceStatuses.some(status =>
    ["partial", "error", "unavailable", "healthy-with-warnings"].includes(status)
  ));
  const status = stale ? "stale" : partial ? "partial" : "fresh";

  let ageLabel = "unknown";
  if (valid) {
    if (ageHours < 1) ageLabel = "less than an hour ago";
    else if (ageHours < 24) ageLabel = `${Math.floor(ageHours)}h ago`;
    else ageLabel = `${Math.floor(ageHours / 24)}d ago`;
  }

  return { status, stale, partial, timestamp, ageHours, ageLabel };
}
