import { describe, it, expect } from 'vitest';
import { estimateSalary, estimateJobSalary, parseAdvertisedSalary, BASELINE, CEILING } from './salaryModel';

// ---------------------------------------------------------------------------
// Reusable fixtures
// ---------------------------------------------------------------------------

const baseProfile = {
  germanLevel: "none",
  roleLevel: "mid-senior",
  salaryFloor: 55,
  salaryTarget: 70,
  salaryStretch: 85,
  yearsExperience: 5,
};

const baseCv = {
  primarySkills: ["Playwright", "TypeScript", "JavaScript", "Python", "CI/CD", "Selenium", "Cypress", "REST APIs", "Git", "Jira"],
  secondarySkills: ["Java", "C#", "Docker", "Kubernetes", "Jenkins", "Azure DevOps", "Postman", "SQL", "Agile", "BDD"],
};

const minimalCompany = {
  id: "test",
  name: "TestCo",
  industry: "IT Consulting",
  langReq: "en",
  kununuRating: null,
  glassdoorRating: null,
  cultureTags: [],
  techStack: [],
  notes: "",
};

// ---------------------------------------------------------------------------
// parseAdvertisedSalary
// ---------------------------------------------------------------------------

describe("parseAdvertisedSalary", () => {
  it("parses range pattern (55k-70k)", () => {
    const r = parseAdvertisedSalary("Advertised 55k-70k gross");
    expect(r).toEqual({ low: 55, high: 70, source: "advertised range" });
  });

  it("parses range with decimals (60.8k-77.7k)", () => {
    const r = parseAdvertisedSalary("Range 60.8k-77.7k");
    expect(r).toEqual({ low: 60.8, high: 77.7, source: "advertised range" });
  });

  it("parses all-in pattern (~68k all-in)", () => {
    const r = parseAdvertisedSalary("~68k all-in advertised");
    expect(r).toEqual({ low: 68, high: 68, source: "advertised all-in" });
  });

  it("parses floor pattern (from 50k)", () => {
    const r = parseAdvertisedSalary("From 50k per year");
    expect(r).toEqual({ low: 50, high: null, source: "advertised floor" });
  });

  it("parses senior band pattern (65k+/85k+)", () => {
    const r = parseAdvertisedSalary("65k+ bonus (Senior: 85k+)");
    expect(r).toEqual({ low: 65, high: 85, source: "advertised with senior band" });
  });

  it("filters out Kununu false-positives", () => {
    const r = parseAdvertisedSalary("Kununu QA avg 45.5k-60k. 22 reviews.");
    expect(r).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseAdvertisedSalary("No salary info here")).toBeNull();
    expect(parseAdvertisedSalary("")).toBeNull();
    expect(parseAdvertisedSalary(null)).toBeNull();
    expect(parseAdvertisedSalary(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// estimateSalary — shape and basic behavior
// ---------------------------------------------------------------------------

describe("estimateSalary", () => {
  it("returns the expected shape", () => {
    const result = estimateSalary(minimalCompany, baseProfile, baseCv);
    expect(result).toHaveProperty("estimate");
    expect(result).toHaveProperty("baseline", BASELINE);
    expect(result).toHaveProperty("adjustments");
    expect(result).toHaveProperty("allAdjustments");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("clamped");
    expect(result).toHaveProperty("authorOverride");
    expect(result).toHaveProperty("isOverridden");
    expect(typeof result.estimate).toBe("number");
    expect(Array.isArray(result.allAdjustments)).toBe(true);
  });

  it("returns author override value when present", () => {
    const company = {
      ...minimalCompany,
      authorOverride: { value: 80, reason: "Manager-level role" },
    };
    const result = estimateSalary(company, baseProfile, baseCv);
    expect(result.estimate).toBe(80);
    expect(result.isOverridden).toBe(true);
    expect(result.authorOverride.reason).toBe("Manager-level role");
  });

  it("non-German speaker on de-fluent role gets lower estimate than en role", () => {
    const enCompany = { ...minimalCompany, langReq: "en" };
    const deCompany = { ...minimalCompany, langReq: "de-fluent" };
    const profile = { ...baseProfile, germanLevel: "none" };

    const enResult = estimateSalary(enCompany, profile, baseCv);
    const deResult = estimateSalary(deCompany, profile, baseCv);

    expect(enResult.estimate).toBeGreaterThan(deResult.estimate);

    const enLang = enResult.allAdjustments.find(a => a.name === "Language");
    const deLang = deResult.allAdjustments.find(a => a.name === "Language");
    expect(enLang.delta).toBeGreaterThan(deLang.delta);
  });

  it("clamps above ceiling to exactly CEILING", () => {
    const company = {
      ...minimalCompany,
      industry: "Observability / AI Software",
      kununuRating: 5.0,
      glassdoorRating: 5.0,
      cultureTags: ["large-enterprise"],
      techStack: ["Playwright", "TypeScript", "Cypress", "Docker", "CI/CD"],
      notes: "85k-110k advertised",
    };
    const result = estimateSalary(company, baseProfile, baseCv);
    expect(result.estimate).toBe(CEILING);
    expect(result.clamped).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Spot-check calibration against real companies
  // -----------------------------------------------------------------------

  it("Entain estimate falls within reasonable band", () => {
    const entain = {
      id: "1", name: "Entain", industry: "Gaming & Betting", langReq: "en",
      kununuRating: 3.4, glassdoorRating: 3.6,
      cultureTags: ["corporate", "hybrid", "international"],
      techStack: ["C#", ".NET", "Selenium", "Playwright", "Appium", "Jira", "Xray"],
      notes: "Kununu QA avg ~45.5k. 22 reviews.",
    };
    const result = estimateSalary(entain, baseProfile, baseCv);
    expect(result.estimate).toBeGreaterThanOrEqual(57);
    expect(result.estimate).toBeLessThanOrEqual(77);
  });

  it("Dynatrace estimate falls within reasonable band", () => {
    const dynatrace = {
      id: "11", name: "Dynatrace", industry: "Observability / AI Software", langReq: "en",
      kununuRating: 4.7, glassdoorRating: 4.0,
      cultureTags: ["international", "hybrid", "growth", "agile"],
      techStack: ["Java", "Go", "Selenium", "Playwright", "Puppeteer", "CI/CD", "Kubernetes"],
      notes: "No matching IC role open (Apr 2026). TAE filled, Coach too senior. Watch for new postings.",
    };
    const result = estimateSalary(dynatrace, baseProfile, baseCv);
    expect(result.estimate).toBeGreaterThanOrEqual(75);
    expect(result.estimate).toBeLessThanOrEqual(95);
  });

  it("Novomatic estimate falls within reasonable band", () => {
    const novomatic = {
      id: "7", name: "Novomatic", industry: "Gaming Technology", langReq: "de-fluent",
      kununuRating: 3.8, glassdoorRating: 3.4,
      cultureTags: ["corporate", "on-site", "traditional"],
      techStack: ["Selenium", "Tosca", "Appium", "Jira", "Embedded Testing"],
      notes: "Kununu QA avg 44.4k (4 reports). 376 reviews. HQ in Gumpoldskirchen.",
    };
    const result = estimateSalary(novomatic, baseProfile, baseCv);
    expect(result.estimate).toBeGreaterThanOrEqual(45);
    expect(result.estimate).toBeLessThanOrEqual(65);
  });
});

// ---------------------------------------------------------------------------
// estimateJobSalary — seniority modifier
// ---------------------------------------------------------------------------

describe("estimateJobSalary", () => {
  it("senior title adds seniority premium on top of base estimate", () => {
    const base = estimateSalary(minimalCompany, baseProfile, baseCv);
    const result = estimateJobSalary(minimalCompany, { title: "Senior SDET Engineer" }, baseProfile, baseCv);
    expect(result.estimate).toBe(Math.min(CEILING, base.estimate + 8));
    expect(result.allAdjustments.some(a => a.name === "Seniority" && a.delta === 8)).toBe(true);
  });

  it("junior title applies negative adjustment", () => {
    const base = estimateSalary(minimalCompany, baseProfile, baseCv);
    const result = estimateJobSalary(minimalCompany, { title: "Junior QA Tester" }, baseProfile, baseCv);
    expect(result.estimate).toBe(Math.max(48, base.estimate - 15));
    expect(result.allAdjustments.some(a => a.name === "Seniority" && a.delta === -15)).toBe(true);
  });

  it("plain title matches base estimateSalary output", () => {
    const base = estimateSalary(minimalCompany, baseProfile, baseCv);
    const result = estimateJobSalary(minimalCompany, { title: "SDET Engineer" }, baseProfile, baseCv);
    expect(result.estimate).toBe(base.estimate);
  });
});
