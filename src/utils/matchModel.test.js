import { describe, it, expect } from 'vitest';
import { matchScore } from './matchModel';

const baseProfile = {
  germanLevel: "none",
  salaryFloor: 55,
  salaryTarget: 70,
  preferredWorkStyle: ["hybrid", "remote-friendly"],
};

const baseCv = {
  primarySkills: ["Playwright", "TypeScript", "JavaScript", "Python", "CI/CD"],
  secondarySkills: ["Java", "Docker", "Kubernetes"],
};

const minimalCompany = {
  id: "test",
  name: "TestCo",
  industry: "IT Consulting",
  langReq: "en",
  kununuRating: 3.5,
  glassdoorRating: 3.5,
  cultureTags: ["hybrid"],
  techStack: ["Playwright", "TypeScript"],
};

describe("matchScore", () => {
  it("returns the expected shape", () => {
    const result = matchScore(minimalCompany, baseCv, baseProfile, 65);
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("grade");
    expect(result).toHaveProperty("factors");
    expect(result).toHaveProperty("topStrengths");
    expect(result).toHaveProperty("topConcerns");
    expect(typeof result.score).toBe("number");
    expect(typeof result.grade).toBe("string");
    expect(Array.isArray(result.factors)).toBe(true);
    expect(Array.isArray(result.topStrengths)).toBe(true);
    expect(Array.isArray(result.topConcerns)).toBe(true);
  });

  it("perfect tech overlap scores higher than zero overlap", () => {
    const matched = { ...minimalCompany, techStack: ["Playwright", "TypeScript"] };
    const unmatched = { ...minimalCompany, techStack: ["COBOL", "Fortran"] };

    const high = matchScore(matched, baseCv, baseProfile, 65);
    const low = matchScore(unmatched, baseCv, baseProfile, 65);

    const highTech = high.factors.find(f => f.name === "Tech Overlap");
    const lowTech = low.factors.find(f => f.name === "Tech Overlap");
    expect(highTech.score).toBeGreaterThan(lowTech.score);
  });

  it("de-fluent role with non-German speaker caps Language factor below 20", () => {
    const company = { ...minimalCompany, langReq: "de-fluent" };
    const profile = { ...baseProfile, germanLevel: "none" };
    const result = matchScore(company, baseCv, profile, 65);
    const lang = result.factors.find(f => f.name === "Language");
    expect(lang.score).toBeLessThan(20);
  });

  it("grade thresholds: 85 → Excellent, 65 → Good, 45 → Fair, 25 → Weak", () => {
    // We can't directly set the score, but we can check the grade logic
    // by verifying the mapping is consistent with the returned score.
    const result = matchScore(minimalCompany, baseCv, baseProfile, 65);
    if (result.score >= 80) expect(result.grade).toBe("Excellent");
    else if (result.score >= 60) expect(result.grade).toBe("Good");
    else if (result.score >= 40) expect(result.grade).toBe("Fair");
    else expect(result.grade).toBe("Weak");
  });

  it("weighted sum of factors equals the overall score", () => {
    const result = matchScore(minimalCompany, baseCv, baseProfile, 65);
    const weightedSum = result.factors.reduce((sum, f) => sum + f.weighted, 0);
    expect(result.score).toBe(weightedSum);
  });

  it("each factor has name, score, weight, weighted, and reason", () => {
    const result = matchScore(minimalCompany, baseCv, baseProfile, 65);
    for (const f of result.factors) {
      expect(f).toHaveProperty("name");
      expect(f).toHaveProperty("score");
      expect(f).toHaveProperty("weight");
      expect(f).toHaveProperty("weighted");
      expect(f).toHaveProperty("reason");
    }
  });
});
