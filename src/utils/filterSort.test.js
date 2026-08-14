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

  it("search matches tech stack", () => {
    const withTech = [
      { ...companies[0], techStack: ["React", "TypeScript"] },
      { ...companies[1], techStack: ["Java", "Selenium"] },
      { ...companies[2], techStack: ["Python", "Playwright"] },
    ];
    const result = filterAndSort({ ...defaults, companies: withTech, search: "playwright" });
    expect(result.map(c => c.id)).toEqual(["c"]);
  });

  it("search with no match returns empty", () => {
    const result = filterAndSort({ ...defaults, search: "zzz" });
    expect(result).toEqual([]);
  });

  it("searches role titles and returns only matching vacancies", () => {
    const roleCompany = [{
      id: "roles",
      name: "Example",
      langReq: "de-fluent",
      openRoles: [
        { id: "qa", title: "QA Automation Engineer", langReq: "en", url: "https://example/qa" },
        { id: "dev", title: "Backend Developer", langReq: "de-fluent", url: "https://example/dev" },
      ],
    }];
    const result = filterAndSort({ ...defaults, companies: roleCompany, search: "automation" });
    expect(result[0].openRoles.map(role => role.id)).toEqual(["qa"]);
    expect(result[0].matchingRoleCount).toBe(1);
    expect(result[0].totalRoleCount).toBe(2);
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

  it("filters mixed-language companies at vacancy level", () => {
    const mixed = [{
      id: "mixed",
      name: "efinio",
      langReq: "de-fluent",
      openRoles: [
        { id: "english", title: "QA Engineer", langReq: "en", url: "https://example/en" },
        { id: "german", title: "Test Engineer", langReq: "de-fluent", url: "https://example/de" },
      ],
    }];
    const result = filterAndSort({ ...defaults, companies: mixed, filterLang: "accessible" });
    expect(result).toHaveLength(1);
    expect(result[0].openRoles.map(role => role.id)).toEqual(["english"]);
  });

  it("does not present unknown language as accessible", () => {
    const unknown = [{ ...companies[0], id: "unknown", langReq: "unknown" }];
    expect(filterAndSort({ ...defaults, companies: unknown, filterLang: "accessible" })).toEqual([]);
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

  it("sorts by rating descending (kununu only)", () => {
    const withRatings = [
      { ...companies[0], kununuRating: 4.2 },
      { ...companies[1], kununuRating: 3.0 },
      { ...companies[2], kununuRating: null },
    ];
    const result = filterAndSort({ ...defaults, companies: withRatings, sortBy: "rating" });
    expect(result.map(c => c.id)).toEqual(["a", "b", "c"]);
  });

  it("sort by rating puts unrated companies last", () => {
    const mixed = [
      { ...companies[0], kununuRating: null },
      { ...companies[1], kununuRating: 3.5 },
      { ...companies[2], kununuRating: 4.0 },
    ];
    const result = filterAndSort({ ...defaults, companies: mixed, sortBy: "rating" });
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
