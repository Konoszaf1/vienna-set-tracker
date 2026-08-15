import { describe, expect, it } from "vitest";
import { datasetHash, hydrateJob } from "./jobLifecycle.mjs";
import { validateFeed } from "./validateFeed.mjs";

const NOW = "2026-08-14T10:00:00.000Z";

function validFeed() {
  const jobs = [hydrateJob({
    url: "https://jobs.example.com/qa-1",
    title: "QA Automation Engineer",
    company: "Example GmbH",
    source: "example",
    techStack: [],
    langReq: "unknown",
  }, { now: NOW })];
  return {
    count: jobs.length,
    jobs,
    datasetHash: datasetHash(jobs),
    lastFullySuccessfulAt: NOW,
  };
}

describe("validateFeed", () => {
  it("accepts a healthy canonical feed", () => {
    expect(validateFeed(validFeed(), { now: new Date(NOW) })).toEqual([]);
  });

  it("rejects duplicate IDs and a mismatched hash", () => {
    const feed = validFeed();
    feed.jobs.push({ ...feed.jobs[0], url: "https://jobs.example.com/qa-2" });
    feed.count = 2;
    expect(validateFeed(feed, { now: new Date(NOW) })).toEqual(expect.arrayContaining([
      expect.stringContaining("duplicate job id"),
      "datasetHash does not match canonical jobs",
    ]));
  });

  it("rejects an old fully-successful run", () => {
    const feed = validFeed();
    feed.lastFullySuccessfulAt = "2026-08-01T00:00:00.000Z";
    expect(validateFeed(feed, { now: new Date(NOW), maxFullySuccessfulAgeHours: 72 }))
      .toContainEqual(expect.stringContaining("last fully successful source run"));
  });

  it("accepts source-owned publication and advertised salary evidence", () => {
    const feed = validFeed();
    Object.assign(feed.jobs[0], {
      publishedAt: "2026-08-12T00:00:00.000Z",
      publishedAtSource: "job-posting-structured-data",
      publishedAtConfidence: "high",
      advertisedSalaryMin: 55_000,
      advertisedSalaryMax: 70_000,
      advertisedSalaryCurrency: "EUR",
      advertisedSalaryPeriod: "year",
      advertisedSalaryKind: "range",
    });
    feed.datasetHash = datasetHash(feed.jobs);
    expect(validateFeed(feed, { now: new Date("2026-08-14T10:00:00.000Z") })).toEqual([]);
  });

  it("rejects future publication dates and malformed salary ranges", () => {
    const feed = validFeed();
    Object.assign(feed.jobs[0], {
      publishedAt: "2026-08-20T00:00:00.000Z",
      publishedAtConfidence: "guessed",
      advertisedSalaryMin: 70_000,
      advertisedSalaryMax: 50_000,
      advertisedSalaryCurrency: "USD",
      advertisedSalaryPeriod: "month",
      advertisedSalaryKind: "guess",
    });
    feed.datasetHash = datasetHash(feed.jobs);
    expect(validateFeed(feed, { now: new Date(NOW) })).toEqual(expect.arrayContaining([
      expect.stringContaining("publishedAt is in the future"),
      expect.stringContaining("publishedAtConfidence is invalid"),
      expect.stringContaining("advertisedSalaryMax"),
      expect.stringContaining("advertisedSalaryCurrency"),
    ]));
  });
});
