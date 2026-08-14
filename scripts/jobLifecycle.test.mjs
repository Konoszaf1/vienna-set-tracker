import { describe, expect, it } from "vitest";
import {
  canonicalizeTechStack,
  canonicalizeUrl,
  datasetHash,
  hydrateJob,
  reconcileJobs,
  stableJobId,
} from "./jobLifecycle.mjs";

const NOW = "2026-08-14T10:00:00.000Z";
const job = (overrides = {}) => ({
  url: "https://www.linkedin.com/jobs/view/123?utm_source=x",
  title: "QA Engineer (m/w/d)",
  company: "Example GmbH",
  source: "jobspy-linkedin",
  ...overrides,
});

describe("job lifecycle", () => {
  it("canonicalizes only tracking URL parameters", () => {
    expect(canonicalizeUrl("https://at.indeed.com/viewjob?utm_source=x&jk=abc#top"))
      .toBe("https://at.indeed.com/viewjob?jk=abc");
  });

  it("creates stable source-native IDs", () => {
    expect(stableJobId(job())).toBe("job-linkedin-123");
    expect(stableJobId(job({ url: "https://at.indeed.com/viewjob?jk=abc" })))
      .toBe("job-indeed-abc");
  });

  it("canonicalizes tech labels", () => {
    expect(canonicalizeTechStack(["JIRA", "Jira", "github actions"]))
      .toEqual(["GitHub Actions", "Jira"]);
  });

  it("preserves firstSeenAt when a listing is observed again", () => {
    const previous = hydrateJob(job({ firstSeenAt: "2026-05-01T00:00:00.000Z" }), {
      now: "2026-05-01T00:00:00.000Z",
    });
    const result = reconcileJobs({ previous: [previous], current: [job()], now: NOW });
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].firstSeenAt).toBe("2026-05-01T00:00:00.000Z");
    expect(result.jobs[0].lastSeenAt).toBe(NOW);
  });

  it("retains jobs from a failed source without advancing misses", () => {
    const previous = hydrateJob(job(), { now: "2026-05-01T00:00:00.000Z" });
    const result = reconcileJobs({ previous: [previous], current: [], completedSources: [], now: NOW });
    expect(result.jobs[0].sourceStatus).toBe("retained-after-partial-run");
    expect(result.jobs[0].consecutiveMisses).toBe(0);
  });

  it("does not age a merged listing while any contributing source is incomplete", () => {
    const previous = hydrateJob(job({ source: "board-a", sources: ["board-a", "board-b"] }), {
      now: "2026-05-01T00:00:00.000Z",
    });
    const result = reconcileJobs({
      previous: [previous],
      current: [],
      completedSources: ["board-a"],
      now: NOW,
    });
    expect(result.jobs[0]).toMatchObject({
      sourceStatus: "retained-after-partial-run",
      consecutiveMisses: 0,
    });
  });

  it("requires two complete-source misses before closing", () => {
    const previous = hydrateJob(job(), { now: "2026-05-01T00:00:00.000Z" });
    const first = reconcileJobs({
      previous: [previous], current: [], completedSources: [previous.source], now: NOW,
    });
    expect(first.jobs[0].sourceStatus).toBe("missing-probation");
    const second = reconcileJobs({
      previous: first.jobs,
      current: [],
      completedSources: [previous.source],
      now: "2026-08-15T10:00:00.000Z",
    });
    expect(second.jobs).toHaveLength(0);
    expect(second.closed[0].status).toBe("closed");
  });

  it("merges exact company/title duplicates across source URLs", () => {
    const result = reconcileJobs({
      current: [
        job({ source: "board-a" }),
        job({ source: "board-b", url: "https://jobs.example.test/456", techStack: ["JIRA"] }),
      ],
      now: NOW,
    });
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].sources).toEqual(["board-a", "board-b"]);
    expect(result.jobs[0].urlAliases).toContain("https://jobs.example.test/456");
  });

  it("produces the same hash for repeated stable input", () => {
    const hydrated = [hydrateJob(job(), { now: NOW })];
    expect(datasetHash(hydrated)).toBe(datasetHash(hydrated));
  });
});
