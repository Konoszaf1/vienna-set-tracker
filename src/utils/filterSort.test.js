import { describe, it, expect } from 'vitest';
import { filterAndSort } from './filterSort';

const companies = [
  {
    id: "a", name: "Alpha Corp", industry: "FinTech", langReq: "en",
    kununuRating: 4.0, glassdoorRating: 4.2, status: "interested",
    cultureTags: ["startup", "hybrid"], techStack: ["React", "TypeScript"],
  },
  {
    id: "b", name: "Beta GmbH", industry: "Gaming", langReq: "de-fluent",
    kununuRating: 3.0, glassdoorRating: 3.2, status: "applied",
    cultureTags: ["corporate", "on-site"], techStack: ["Java", "Selenium"],
  },
  {
    id: "c", name: "Gamma Systems", industry: "IT Consulting", langReq: "de-basic",
    kununuRating: 3.8, glassdoorRating: null, status: "interested",
    cultureTags: ["hybrid", "agile"], techStack: ["Python", "Playwright"],
  },
];

const insights = {
  a: { salary: { estimate: 75 }, match: { score: 88 } },
  b: { salary: { estimate: 55 }, match: { score: 42 } },
  c: { salary: { estimate: 65 }, match: { score: 71 } },
};

const defaults = {
  companies,
  companyInsights: insights,
  search: "",
  filterStatus: "all",
  filterLang: "all",
  filterCulture: "all",
  sortBy: "name",
};

describe("filterAndSort", () => {
  // ---- Search ----

  it("search matches company name case-insensitively", () => {
    const result = filterAndSort({ ...defaults, search: "alpha" });
    expect(result.map(c => c.id)).toEqual(["a"]);
  });

  it("search matches industry", () => {
    const result = filterAndSort({ ...defaults, search: "gaming" });
    expect(result.map(c => c.id)).toEqual(["b"]);
  });

  it("search matches tech stack", () => {
    const result = filterAndSort({ ...defaults, search: "playwright" });
    expect(result.map(c => c.id)).toEqual(["c"]);
  });

  // ---- Status filter ----

  it("status filter rejects non-matching statuses", () => {
    const result = filterAndSort({ ...defaults, filterStatus: "applied" });
    expect(result.map(c => c.id)).toEqual(["b"]);
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

  // ---- Culture filter ----

  it("culture filter requires the tag to be present", () => {
    const result = filterAndSort({ ...defaults, filterCulture: "startup" });
    expect(result.map(c => c.id)).toEqual(["a"]);
  });

  // ---- Sort ----

  it("sorts by salary descending", () => {
    const result = filterAndSort({ ...defaults, sortBy: "salary" });
    expect(result.map(c => c.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by match descending", () => {
    const result = filterAndSort({ ...defaults, sortBy: "match" });
    expect(result.map(c => c.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by rating descending (average of kununu/glassdoor)", () => {
    const result = filterAndSort({ ...defaults, sortBy: "rating" });
    // Alpha: avg 4.1, Gamma: 3.8 (only kununu), Beta: avg 3.1
    expect(result.map(c => c.id)).toEqual(["a", "c", "b"]);
  });

  it("sort by salary puts companies without insights last", () => {
    const noInsights = { a: insights.a, c: insights.c };
    const result = filterAndSort({ ...defaults, companyInsights: noInsights, sortBy: "salary" });
    expect(result[result.length - 1].id).toBe("b");
  });

  // ---- Salary range filter ----

  it("salaryMin excludes companies below the minimum", () => {
    const result = filterAndSort({ ...defaults, salaryMin: 60 });
    // a=75, c=65 pass; b=55 excluded
    expect(result.map(c => c.id)).toEqual(["a", "c"]);
  });

  it("salaryMax excludes companies above the maximum", () => {
    const result = filterAndSort({ ...defaults, salaryMax: 65 });
    // b=55, c=65 pass; a=75 excluded
    expect(result.map(c => c.id)).toEqual(["b", "c"]);
  });

  it("salaryMin + salaryMax keeps only companies in the inclusive range", () => {
    const result = filterAndSort({ ...defaults, salaryMin: 60, salaryMax: 70 });
    // only c=65 is in [60, 70]
    expect(result.map(c => c.id)).toEqual(["c"]);
  });

  it("both null applies no salary filter", () => {
    const result = filterAndSort({ ...defaults, salaryMin: null, salaryMax: null });
    expect(result.map(c => c.id)).toEqual(["a", "b", "c"]);
  });

  // ---- Open roles filter ----

  it("hasOpenRoles=true excludes companies without openRoles", () => {
    const withRoles = [
      { ...companies[0], openRoles: [{ title: "SDET", url: "https://example.com" }] },
      companies[1],
      { ...companies[2], openRoles: [] },
    ];
    const result = filterAndSort({ ...defaults, companies: withRoles, hasOpenRoles: true });
    expect(result.map(c => c.id)).toEqual(["a"]);
  });

  it("hasOpenRoles=false passes all companies through", () => {
    const result = filterAndSort({ ...defaults, hasOpenRoles: false });
    expect(result.map(c => c.id)).toEqual(["a", "b", "c"]);
  });
});
