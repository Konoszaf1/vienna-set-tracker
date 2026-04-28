import { describe, it, expect } from "vitest";
import {
  listingsOverTime,
  topEmployers,
  langReqBreakdown,
  salaryTierBreakdown,
  topTechStack,
  districtBreakdown,
} from "./analytics";

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
