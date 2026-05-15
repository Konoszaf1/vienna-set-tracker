import { describe, it, expect } from "vitest";
import { makeSnapshot, mergeSnapshot, normalizeHistory } from "./updateJobHistory.mjs";

describe("updateJobHistory", () => {
  it("builds an active-job snapshot from verified jobs data", () => {
    const snapshot = makeSnapshot({
      lastUpdated: "2026-04-24T07:00:00Z",
      lastVerified: "2026-04-25T08:00:00Z",
      jobs: [
        { url: "https://example.com/a", company: "Dynatrace" },
        { url: "https://example.com/b", company: "Dynatrace" },
        { url: "https://example.com/c", company: "RINGANA" },
      ],
    }, {
      recordedAt: "2026-04-25T08:05:00Z",
    });

    expect(snapshot).toEqual({
      date: "2026-04-25",
      activeJobs: 3,
      activeCompanies: 2,
      sourceLastUpdated: "2026-04-24T07:00:00Z",
      sourceLastVerified: "2026-04-25T08:00:00Z",
      recordedAt: "2026-04-25T08:05:00Z",
    });
  });

  it("replaces same-day snapshots and keeps chronological order", () => {
    const history = {
      snapshots: [
        { date: "2026-04-27", activeJobs: 8 },
        { date: "2026-04-25", activeJobs: 5 },
      ],
    };
    const merged = mergeSnapshot(history, {
      date: "2026-04-27",
      activeJobs: 7,
      activeCompanies: 4,
      recordedAt: "2026-04-27T09:00:00Z",
    });

    expect(merged.snapshots.map(s => [s.date, s.activeJobs])).toEqual([
      ["2026-04-25", 5],
      ["2026-04-27", 7],
    ]);
    expect(merged.lastUpdated).toBe("2026-04-27T09:00:00Z");
  });

  it("normalizes missing or legacy history input", () => {
    expect(normalizeHistory(null)).toEqual({ snapshots: [] });
    expect(normalizeHistory([{ date: "2026-04-25", activeJobs: 5 }])).toEqual({
      snapshots: [{ date: "2026-04-25", activeJobs: 5 }],
    });
  });
});
