import { describe, it, expect } from 'vitest';
import { filterAndSort } from './filterSort';

const companies = [
  { id: "a", name: "Alpha Corp", langReq: "en" },
  { id: "b", name: "Beta GmbH", langReq: "de-fluent" },
  { id: "c", name: "Gamma Systems", langReq: "de-basic", firstSeen: "2026-04-10T00:00:00Z" },
];

const salaryMap = {
  a: { best: 71 },
  b: { best: 63 },
  c: { best: 48 },
};

const defaults = {
  companies,
  salaryMap,
  search: "",
  filterLang: "all",
  sortBy: "name",
  salaryMin: null,
  salaryMax: null,
};

describe("filterAndSort", () => {
  // ---- Search ----

  it("search matches company name case-insensitively", () => {
    const result = filterAndSort({ ...defaults, search: "alpha" });
    expect(result.map(c => c.id)).toEqual(["a"]);
  });

  it("search with no match returns empty", () => {
    const result = filterAndSort({ ...defaults, search: "zzz" });
    expect(result).toEqual([]);
  });

  // ---- Language filter ----

  it("'accessible' excludes de-fluent roles", () => {
    const result = filterAndSort({ ...defaults, filterLang: "accessible" });
    expect(result.every(c => c.langReq !== "de-fluent")).toBe(true);
    expect(result.length).toBe(2);
  });

  it("'de-fluent' includes only de-fluent roles", () => {
    const result = filterAndSort({ ...defaults, filterLang: "de-fluent" });
    expect(result.every(c => c.langReq === "de-fluent")).toBe(true);
    expect(result.length).toBe(1);
  });

  // ---- Sort ----

  it("sorts by name alphabetically", () => {
    const result = filterAndSort({ ...defaults, sortBy: "name" });
    expect(result.map(c => c.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by salary descending", () => {
    const result = filterAndSort({ ...defaults, sortBy: "salary" });
    expect(result.map(c => c.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by newest first", () => {
    const withDates = [
      { ...companies[0], firstSeen: "2026-04-08T00:00:00Z" },
      { ...companies[1], firstSeen: "2026-04-12T00:00:00Z" },
      { ...companies[2] },
    ];
    const result = filterAndSort({ ...defaults, companies: withDates, sortBy: "newest" });
    expect(result.map(c => c.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by rating descending (average of kununu/glassdoor)", () => {
    const withRatings = [
      { ...companies[0], kununuRating: 4.0, glassdoorRating: 4.2 },  // avg 4.1
      { ...companies[1], kununuRating: 3.0, glassdoorRating: null },  // 3.0
      { ...companies[2], kununuRating: null, glassdoorRating: null },  // -1
    ];
    const result = filterAndSort({ ...defaults, companies: withRatings, sortBy: "rating" });
    expect(result.map(c => c.id)).toEqual(["a", "b", "c"]);
  });

  it("sort by rating puts unrated companies last", () => {
    const mixed = [
      { ...companies[0], kununuRating: null, glassdoorRating: null },
      { ...companies[1], kununuRating: 3.5, glassdoorRating: null },
      { ...companies[2], kununuRating: null, glassdoorRating: 4.0 },
    ];
    const result = filterAndSort({ ...defaults, companies: mixed, sortBy: "rating" });
    // c=4.0, b=3.5, a=-1 (unrated last)
    expect(result.map(c => c.id)).toEqual(["c", "b", "a"]);
  });

  it("sort by salary puts companies without salary data last", () => {
    const partial = { a: salaryMap.a };
    const result = filterAndSort({ ...defaults, salaryMap: partial, sortBy: "salary" });
    expect(result[0].id).toBe("a");
  });

  // ---- Salary range filter ----

  it("salaryMin excludes companies below the minimum", () => {
    const result = filterAndSort({ ...defaults, salaryMin: 60 });
    expect(result.map(c => c.id)).toEqual(["a", "b"]);
  });

  it("salaryMax excludes companies above the maximum", () => {
    const result = filterAndSort({ ...defaults, salaryMax: 65 });
    expect(result.map(c => c.id)).toEqual(["b", "c"]);
  });

  it("salaryMin + salaryMax keeps only companies in the inclusive range", () => {
    const result = filterAndSort({ ...defaults, salaryMin: 50, salaryMax: 65 });
    expect(result.map(c => c.id)).toEqual(["b"]);
  });

  it("both null applies no salary filter", () => {
    const result = filterAndSort({ ...defaults, salaryMin: null, salaryMax: null });
    expect(result.map(c => c.id)).toEqual(["a", "b", "c"]);
  });
});
