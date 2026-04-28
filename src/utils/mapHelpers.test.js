import { describe, it, expect } from "vitest";
import { haversine, salaryColor, buildPopupHtml, computeStackingIndex, stemHeight, clusterSize, clusterAvgSalary } from "./mapHelpers";

/* ------------------------------------------------------------------ */
/*  haversine                                                         */
/* ------------------------------------------------------------------ */
describe("haversine", () => {
  it("returns 0 for identical points", () => {
    expect(haversine(48.2082, 16.3738, 48.2082, 16.3738)).toBe(0);
  });

  it("Stephansplatz → Schönbrunn ≈ 5.3 km (±0.2)", () => {
    const d = haversine(48.2082, 16.3738, 48.1845, 16.3122);
    expect(d).toBeGreaterThan(5.0);
    expect(d).toBeLessThan(5.5);
  });

  it("Stephansplatz → Prater ≈ 1.9 km (±0.2)", () => {
    const d = haversine(48.2082, 16.3738, 48.2166, 16.3957);
    expect(d).toBeGreaterThan(1.7);
    expect(d).toBeLessThan(2.1);
  });

  it("is symmetric", () => {
    const ab = haversine(48.2082, 16.3738, 48.1845, 16.3122);
    const ba = haversine(48.1845, 16.3122, 48.2082, 16.3738);
    expect(ab).toBeCloseTo(ba, 10);
  });
});

/* ------------------------------------------------------------------ */
/*  salaryColor                                                       */
/* ------------------------------------------------------------------ */
describe("salaryColor", () => {
  it("returns indigo for null/undefined", () => {
    expect(salaryColor(null)).toBe("#6366f1");
    expect(salaryColor(undefined)).toBe("#6366f1");
    expect(salaryColor(0)).toBe("#6366f1");
  });

  it("≥70 → green", () => {
    expect(salaryColor(70)).toBe("#10b981");
    expect(salaryColor(100)).toBe("#10b981");
  });

  it("60–69 → amber", () => {
    expect(salaryColor(60)).toBe("#f59e0b");
    expect(salaryColor(69)).toBe("#f59e0b");
  });

  it("55–59 → orange", () => {
    expect(salaryColor(55)).toBe("#fb923c");
    expect(salaryColor(59)).toBe("#fb923c");
  });

  it("<55 → red", () => {
    expect(salaryColor(54)).toBe("#ef4444");
    expect(salaryColor(30)).toBe("#ef4444");
  });
});

/* ------------------------------------------------------------------ */
/*  computeStackingIndex                                              */
/* ------------------------------------------------------------------ */
describe("computeStackingIndex", () => {
  it("returns empty object for empty array", () => {
    expect(computeStackingIndex([])).toEqual({});
  });

  it("assigns 0 to a single company", () => {
    const companies = [{ id: "a", lat: 48.2, lng: 16.3 }];
    expect(computeStackingIndex(companies)).toEqual({ a: 0 });
  });

  it("stacks companies at the same location", () => {
    const companies = [
      { id: "a", lat: 48.2000, lng: 16.3000 },
      { id: "b", lat: 48.2001, lng: 16.3001 }, // within ~22m
    ];
    const idx = computeStackingIndex(companies);
    expect(idx.a).toBe(0);
    expect(idx.b).toBe(1);
  });

  it("keeps distant companies in separate stacks", () => {
    const companies = [
      { id: "a", lat: 48.2000, lng: 16.3000 },
      { id: "b", lat: 48.2100, lng: 16.3100 }, // ~1.3 km away
    ];
    const idx = computeStackingIndex(companies);
    expect(idx.a).toBe(0);
    expect(idx.b).toBe(0);
  });

  it("stacks three companies at the same building", () => {
    const companies = [
      { id: "a", lat: 48.2000, lng: 16.3000 },
      { id: "b", lat: 48.20005, lng: 16.30005 },
      { id: "c", lat: 48.20010, lng: 16.30010 },
    ];
    const idx = computeStackingIndex(companies);
    expect(idx.a).toBe(0);
    expect(idx.b).toBe(1);
    expect(idx.c).toBe(2);
  });

  it("respects custom threshold", () => {
    const companies = [
      { id: "a", lat: 48.2000, lng: 16.3000 },
      { id: "b", lat: 48.2001, lng: 16.3001 },
    ];
    // Tiny threshold — should NOT stack
    const idx = computeStackingIndex(companies, 0.00001);
    expect(idx.a).toBe(0);
    expect(idx.b).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  stemHeight                                                        */
/* ------------------------------------------------------------------ */
describe("stemHeight", () => {
  it("returns 0 for position 0", () => {
    expect(stemHeight(0)).toBe(0);
  });

  it("returns 28px per slot by default", () => {
    expect(stemHeight(1)).toBe(28);
    expect(stemHeight(3)).toBe(84);
  });

  it("accepts custom slot height", () => {
    expect(stemHeight(2, 40)).toBe(80);
  });
});

/* ------------------------------------------------------------------ */
/*  clusterSize                                                       */
/* ------------------------------------------------------------------ */
describe("clusterSize", () => {
  it("returns 40 for count < 5", () => {
    expect(clusterSize(1)).toBe(40);
    expect(clusterSize(4)).toBe(40);
  });

  it("returns 48 for count 5–14", () => {
    expect(clusterSize(5)).toBe(48);
    expect(clusterSize(14)).toBe(48);
  });

  it("returns 56 for count >= 15", () => {
    expect(clusterSize(15)).toBe(56);
    expect(clusterSize(100)).toBe(56);
  });
});

/* ------------------------------------------------------------------ */
/*  clusterAvgSalary                                                  */
/* ------------------------------------------------------------------ */
describe("clusterAvgSalary", () => {
  it("returns null for empty array", () => {
    expect(clusterAvgSalary([])).toBeNull();
  });

  it("returns null when all estimates are null/undefined", () => {
    expect(clusterAvgSalary([null, undefined, 0])).toBeNull();
  });

  it("averages valid estimates, ignoring nulls", () => {
    expect(clusterAvgSalary([60, null, 80])).toBe(70);
  });

  it("returns the value for a single estimate", () => {
    expect(clusterAvgSalary([65])).toBe(65);
  });

  it("computes correct average for mixed values", () => {
    expect(clusterAvgSalary([71, 63, 48])).toBeCloseTo(60.67, 1);
  });
});

/* ------------------------------------------------------------------ */
/*  buildPopupHtml                                                    */
/* ------------------------------------------------------------------ */
describe("buildPopupHtml", () => {
  const baseCompany = {
    name: "TestCorp",
    address: "Karlsplatz 1, 1010 Wien",
    logo: "🏢",
    jobUrl: "https://example.com/job",
    techStack: ["React", "Node"],
    openRoles: [],
    kununuRating: null,
  };

  it("renders company name, address, and logo", () => {
    const html = buildPopupHtml({
      company: baseCompany,
      salary: null,
      distance: 3.5,
      color: "#10b981",
      estimate: 70,
    });
    expect(html).toContain("TestCorp");
    expect(html).toContain("Karlsplatz 1, 1010 Wien");
    expect(html).toContain("🏢");
  });

  it("escapes XSS in company name", () => {
    const xssCompany = { ...baseCompany, name: '<img src=x onerror=alert(1)>' };
    const html = buildPopupHtml({
      company: xssCompany,
      salary: null,
      distance: 1.0,
      color: "#6366f1",
      estimate: null,
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("escapes XSS in address", () => {
    const xssCompany = { ...baseCompany, address: '<script>alert("xss")</script>' };
    const html = buildPopupHtml({
      company: xssCompany,
      salary: null,
      distance: 1.0,
      color: "#6366f1",
      estimate: null,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("blocks javascript: URLs in jobUrl", () => {
    const malicious = { ...baseCompany, jobUrl: "javascript:alert(1)" };
    const html = buildPopupHtml({
      company: malicious,
      salary: null,
      distance: 2.0,
      color: "#6366f1",
      estimate: null,
    });
    expect(html).not.toContain("javascript:");
    // No "View listing" link should appear
    expect(html).not.toContain("View listing");
  });

  it("blocks javascript: URLs in role links", () => {
    const malicious = {
      ...baseCompany,
      openRoles: [{ title: "SDET", url: "javascript:alert(1)" }],
    };
    const html = buildPopupHtml({
      company: malicious,
      salary: { roles: [{ estimate: 63 }] },
      distance: 2.0,
      color: "#6366f1",
      estimate: 63,
    });
    expect(html).not.toContain("javascript:");
    // Role should render as a div (not a link)
    expect(html).toContain("SDET");
    expect(html).not.toMatch(/<a[^>]*javascript:/);
  });

  it("renders salary estimate when provided", () => {
    const html = buildPopupHtml({
      company: baseCompany,
      salary: null,
      distance: 5.0,
      color: "#10b981",
      estimate: 71,
    });
    expect(html).toContain("€71k");
  });

  it("omits salary block when estimate is null", () => {
    const html = buildPopupHtml({
      company: baseCompany,
      salary: null,
      distance: 5.0,
      color: "#6366f1",
      estimate: null,
    });
    expect(html).not.toContain("Salary");
  });

  it("shows correct commute label", () => {
    expect(buildPopupHtml({ company: baseCompany, salary: null, distance: 1.0, color: "#6366f1", estimate: null }))
      .toContain("🚶 walkable");
    expect(buildPopupHtml({ company: baseCompany, salary: null, distance: 3.0, color: "#6366f1", estimate: null }))
      .toContain("🚲 bikeable");
    expect(buildPopupHtml({ company: baseCompany, salary: null, distance: 8.0, color: "#6366f1", estimate: null }))
      .toContain("🚇 quick transit");
    expect(buildPopupHtml({ company: baseCompany, salary: null, distance: 15.0, color: "#6366f1", estimate: null }))
      .toContain("🚆 longer commute");
  });

  it("renders Kununu rating when present", () => {
    const rated = { ...baseCompany, kununuRating: 3.8 };
    const html = buildPopupHtml({
      company: rated,
      salary: null,
      distance: 2.0,
      color: "#6366f1",
      estimate: null,
    });
    expect(html).toContain("3.8");
    expect(html).toContain("Kununu");
  });

  it("renders tech stack badges", () => {
    const html = buildPopupHtml({
      company: baseCompany,
      salary: null,
      distance: 2.0,
      color: "#6366f1",
      estimate: null,
    });
    expect(html).toContain("React");
    expect(html).toContain("Node");
  });

  it("limits tech stack to 6 items", () => {
    const manyTech = {
      ...baseCompany,
      techStack: ["A", "B", "C", "D", "E", "F", "G", "H"],
    };
    const html = buildPopupHtml({
      company: manyTech,
      salary: null,
      distance: 2.0,
      color: "#6366f1",
      estimate: null,
    });
    expect(html).toContain("F");
    expect(html).not.toContain(">G<");
    expect(html).not.toContain(">H<");
  });

  it("renders open roles with safe URLs as links", () => {
    const withRoles = {
      ...baseCompany,
      openRoles: [
        { title: "Senior SDET", url: "https://example.com/role1" },
        { title: "Junior SDET", url: null },
      ],
    };
    const html = buildPopupHtml({
      company: withRoles,
      salary: { roles: [{ estimate: 71 }, { estimate: 48 }] },
      distance: 2.0,
      color: "#10b981",
      estimate: 71,
    });
    expect(html).toContain('href="https://example.com/role1"');
    expect(html).toContain("Senior SDET");
    expect(html).toContain("€71k");
    expect(html).toContain("Junior SDET");
    expect(html).toContain("€48k");
  });
});
