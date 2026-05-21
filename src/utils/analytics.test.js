import { describe, it, expect } from "vitest";
import {
  activeListingsOverTime,
  listingsOverTime,
  topEmployers,
  langReqBreakdown,
  salaryTierBreakdown,
  topTechStack,
  districtBreakdown,
  weeklyNewListings,
  sourceBreakdown,
  marketPulse,
} from "./analytics";

describe("activeListingsOverTime", () => {
  it("uses persisted active-job snapshots and fills missing days", () => {
    const history = {
      snapshots: [
        { date: "2026-04-25", activeJobs: 5 },
        { date: "2026-04-27", activeJobs: 3 },
      ],
    };
    const jobs = [{ url: "a" }, { url: "b" }, { url: "c" }, { url: "d" }];

    expect(activeListingsOverTime({
      history,
      jobs,
      currentSnapshotDate: "2026-04-28T09:00:00Z",
    }).points).toEqual([
      { date: "2026-04-25", active: 5 },
      { date: "2026-04-26", active: 5 },
      { date: "2026-04-27", active: 3 },
      { date: "2026-04-28", active: 4 },
    ]);
  });

  it("falls back to currently live listings and ignores removed URLs", () => {
    const firstSeenMap = {
      a: "2026-04-25T10:00:00Z",
      removed: "2026-04-26T10:00:00Z",
      c: "2026-04-27T10:00:00Z",
    };
    const jobs = [{ url: "a" }, { url: "c" }];

    expect(activeListingsOverTime({
      firstSeenMap,
      jobs,
      now: new Date("2026-04-28T09:00:00Z"),
    }).points).toEqual([
      { date: "2026-04-25", active: 1 },
      { date: "2026-04-26", active: 1 },
      { date: "2026-04-27", active: 2 },
      { date: "2026-04-28", active: 2 },
    ]);
  });

  it("returns no points when there are no jobs or snapshots", () => {
    expect(activeListingsOverTime({ jobs: [], firstSeenMap: {} }).points).toEqual([]);
  });
});

describe("listingsOverTime", () => {
  it("returns empty for empty map", () => {
    expect(listingsOverTime({})).toEqual({ points: [], totalUnique: 0 });
  });

  it("buckets by day and computes cumulative", () => {
    const map = {
      a: "2026-04-25T10:00:00Z",
      b: "2026-04-25T11:00:00Z",
      c: "2026-04-27T09:00:00Z",
    };
    const { points, totalUnique } = listingsOverTime(map);
    expect(totalUnique).toBe(3);
    // Dense series: 25th, 26th, 27th
    expect(points).toEqual([
      { date: "2026-04-25", new: 2, total: 2 },
      { date: "2026-04-26", new: 0, total: 2 },
      { date: "2026-04-27", new: 1, total: 3 },
    ]);
  });

  it("ignores invalid timestamps", () => {
    const { totalUnique } = listingsOverTime({ a: "not-a-date", b: "2026-04-25T00:00:00Z" });
    expect(totalUnique).toBe(1);
  });

  it("a single day yields a single point", () => {
    const { points } = listingsOverTime({ a: "2026-04-29T08:00:00Z" });
    expect(points).toEqual([{ date: "2026-04-29", new: 1, total: 1 }]);
  });
});

describe("topEmployers", () => {
  it("ranks by openRoles length and limits to n", () => {
    const entries = [
      { name: "A", openRoles: [{}, {}] },
      { name: "B", openRoles: [{}, {}, {}] },
      { name: "C", openRoles: [{}] },
      { name: "D", openRoles: [] },
    ];
    expect(topEmployers(entries, 2)).toEqual([
      { name: "B", value: 3 },
      { name: "A", value: 2 },
    ]);
  });

  it("filters out companies with zero roles", () => {
    const entries = [{ name: "Empty", openRoles: [] }];
    expect(topEmployers(entries)).toEqual([]);
  });

  it("handles missing openRoles", () => {
    expect(topEmployers([{ name: "X" }])).toEqual([]);
  });
});

describe("langReqBreakdown", () => {
  it("counts each lang requirement", () => {
    const entries = [
      { langReq: "de-fluent" },
      { langReq: "de-fluent" },
      { langReq: "de-basic" },
      { langReq: "en" },
      { langReq: "en" },
      { langReq: "en" },
    ];
    const out = langReqBreakdown(entries);
    expect(out.find(b => b.key === "de-fluent").value).toBe(2);
    expect(out.find(b => b.key === "de-basic").value).toBe(1);
    expect(out.find(b => b.key === "en").value).toBe(3);
  });

  it("ignores unknown lang values", () => {
    const out = langReqBreakdown([{ langReq: "klingon" }]);
    expect(out.every(b => b.value === 0)).toBe(true);
  });
});

describe("salaryTierBreakdown", () => {
  const entries = [
    { id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "f" },
  ];
  const salaryMap = {
    a: { best: 75 },  // high
    b: { best: 65 },  // midhi
    c: { best: 57 },  // mid
    d: { best: 50 },  // low
    e: { best: null },
    f: {},            // missing best
  };

  it("buckets each entry into the right tier", () => {
    const out = salaryTierBreakdown(entries, salaryMap);
    expect(out.find(b => b.key === "high").value).toBe(1);
    expect(out.find(b => b.key === "midhi").value).toBe(1);
    expect(out.find(b => b.key === "mid").value).toBe(1);
    expect(out.find(b => b.key === "low").value).toBe(1);
    expect(out.find(b => b.key === "none").value).toBe(2);
  });

  it("treats boundary 70 as high and 60 as midhi", () => {
    const out = salaryTierBreakdown(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      { a: { best: 70 }, b: { best: 60 }, c: { best: 55 } }
    );
    expect(out.find(b => b.key === "high").value).toBe(1);
    expect(out.find(b => b.key === "midhi").value).toBe(1);
    expect(out.find(b => b.key === "mid").value).toBe(1);
  });
});

describe("topTechStack", () => {
  it("counts unique-per-company tech tags and ranks them", () => {
    const entries = [
      { techStack: ["React", "TypeScript", "Cypress"] },
      { techStack: ["React", "Java"] },
      { techStack: ["Java", "Spring", "Cypress"] },
    ];
    const out = topTechStack(entries, 3);
    expect(out).toEqual([
      { name: "React", value: 2 },
      { name: "Cypress", value: 2 },
      { name: "Java", value: 2 },
    ]);
  });

  it("limits to n and handles missing techStack", () => {
    const entries = [{ techStack: ["A"] }, {}, { techStack: ["A", "B"] }];
    expect(topTechStack(entries, 1)).toEqual([{ name: "A", value: 2 }]);
  });
});

describe("districtBreakdown", () => {
  it("counts and sorts districts", () => {
    const entries = [
      { district: "Wien" },
      { district: "Wien" },
      { district: "Linz" },
    ];
    expect(districtBreakdown(entries)).toEqual([
      { name: "Wien", value: 2 },
      { name: "Linz", value: 1 },
    ]);
  });

  it("falls back to Unknown when district is missing", () => {
    expect(districtBreakdown([{}])).toEqual([{ name: "Unknown", value: 1 }]);
  });
});

describe("weeklyNewListings", () => {
  it("returns empty for empty firstSeenMap", () => {
    expect(weeklyNewListings({})).toEqual([]);
  });

  it("groups firstSeenMap dates by ISO week Monday and formats them correctly", () => {
    const map = {
      a: "2026-05-13T09:00:00Z", // Wednesday (week May 11–17)
      b: "2026-05-14T09:00:00Z", // Thursday (week May 11–17)
      c: "2026-05-20T10:00:00Z", // Wednesday (week May 18–24)
    };
    const out = weeklyNewListings(map);
    expect(out).toEqual([
      { name: "May 11–17", value: 2 },
      { name: "May 18–24", value: 1 },
    ]);
  });

  it("gaps in weeks are filled with zero-value weeks", () => {
    const map = {
      a: "2026-05-13T09:00:00Z", // May 11–17
      c: "2026-05-27T10:00:00Z", // May 25–31
    };
    const out = weeklyNewListings(map);
    expect(out).toEqual([
      { name: "May 11–17", value: 1 },
      { name: "May 18–24", value: 0 },
      { name: "May 25–31", value: 1 },
    ]);
  });
});

describe("sourceBreakdown", () => {
  it("ranks and counts jobs by source domain", () => {
    const jobs = [
      { url: "https://www.karriere.at/jobs/1" },
      { url: "https://karriere.at/jobs/2" },
      { url: "https://www.linkedin.com/jobs/3" },
      { url: "https://at.linkedin.com/jobs/4" },
      { url: "https://example.com/jobs/5" },
      { url: "invalid-url" },
    ];
    const out = sourceBreakdown(jobs);
    expect(out).toEqual([
      { name: "karriere.at", value: 2 },
      { name: "LinkedIn", value: 2 },
      { name: "example.com", value: 1 },
      { name: "Other", value: 1 },
    ]);
  });
});

describe("marketPulse", () => {
  it("returns empty structure when history snapshots are empty", () => {
    expect(marketPulse({})).toEqual({
      weekAgoJobs: null,
      currentJobs: null,
      jobsDelta: null,
      weekAgoCompanies: null,
      currentCompanies: null,
      companiesDelta: null,
    });
  });

  it("calculates jobs and companies week-over-week deltas correctly using 7 days ago", () => {
    const history = {
      snapshots: [
        { date: "2026-05-14", activeJobs: 40, activeCompanies: 30 },
        { date: "2026-05-20", activeJobs: 43, activeCompanies: 32 },
        { date: "2026-05-21", activeJobs: 45, activeCompanies: 33 }, // current (latest)
      ]
    };
    const out = marketPulse(history);
    expect(out).toEqual({
      weekAgoJobs: 40,
      currentJobs: 45,
      jobsDelta: 5,
      weekAgoCompanies: 30,
      currentCompanies: 33,
      companiesDelta: 3,
    });
  });

  it("falls back to closest snapshot if exact 7-day-prior is not present", () => {
    const history = {
      snapshots: [
        { date: "2026-05-15", activeJobs: 40, activeCompanies: 30 }, // 6 days prior (closest)
        { date: "2026-05-21", activeJobs: 45, activeCompanies: 33 }, // current (latest)
      ]
    };
    const out = marketPulse(history);
    expect(out).toEqual({
      weekAgoJobs: 40,
      currentJobs: 45,
      jobsDelta: 5,
      weekAgoCompanies: 30,
      currentCompanies: 33,
      companiesDelta: 3,
    });
  });
});

