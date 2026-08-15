import { ageInDays, formatListingAge, listingDate, matchesRecency } from "./listingRecency";

const NOW = new Date("2026-08-15T12:00:00.000Z");

describe("listing recency", () => {
  it("prefers source publication time over ingestion time", () => {
    expect(listingDate({
      publishedAt: "2026-08-01T00:00:00Z",
      firstSeenAt: "2026-08-14T00:00:00Z",
      publishedAtConfidence: "high",
    })).toEqual({
      timestamp: "2026-08-01T00:00:00.000Z",
      kind: "published",
      confidence: "high",
    });
  });

  it("labels first observation honestly when publication date is unavailable", () => {
    const job = { firstSeenAt: "2026-08-14T00:00:00Z" };
    expect(listingDate(job).kind).toBe("discovered");
    expect(formatListingAge(job, NOW)).toBe("Discovered 1 day ago");
  });

  it("calculates age and recency windows from publication date", () => {
    const job = { publishedAt: "2026-08-10T12:00:00Z", firstSeenAt: "2026-08-15T00:00:00Z" };
    expect(ageInDays(job.publishedAt, NOW)).toBe(5);
    expect(matchesRecency(job, "3", NOW)).toBe(false);
    expect(matchesRecency(job, "7", NOW)).toBe(true);
  });

  it("allows an explicit unknown-date filter", () => {
    expect(matchesRecency({}, "unknown", NOW)).toBe(true);
    expect(matchesRecency({ firstSeenAt: "2026-08-14" }, "unknown", NOW)).toBe(false);
  });
});
