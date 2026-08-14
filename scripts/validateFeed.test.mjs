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
});
