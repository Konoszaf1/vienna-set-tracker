import { BASELINE, estimateSalary, estimateSalaryRange } from "./salaryEstimate";

describe("Vienna salary range model", () => {
  it("uses the 2026 regular target as its compatibility point estimate", () => {
    expect(BASELINE).toBe(61);
    expect(estimateSalary("QA Engineer")).toBe(61);
  });

  it.each([
    ["Junior QA Engineer", "junior", 51],
    ["Senior QA Engineer", "senior", 74],
    ["Lead Test Engineer", "lead", 88],
    ["Working Student QA", "intern", 36],
  ])("classifies %s as %s", (title, level, target) => {
    expect(estimateSalaryRange(title)).toMatchObject({ level, target });
  });

  it("adds bounded premiums for automation, code, platform, and specialist scope", () => {
    const range = estimateSalaryRange({
      title: "Test Automation Engineer API",
      techStack: ["Java", "Playwright", "Docker", "CI/CD"],
    });
    expect(range).toMatchObject({ evidence: "market-model", min: 54, target: 71, max: 88 });
    expect(range.reasons).toEqual(expect.arrayContaining([
      "test automation scope", "code-intensive stack", "cloud/CI ownership", "specialist testing domain",
    ]));
  });

  it("does not use employer rating or language as salary predictors", () => {
    const base = estimateSalaryRange({ title: "QA Engineer", techStack: [] });
    const noisy = estimateSalaryRange({
      title: "QA Engineer",
      techStack: [],
      langReq: "en",
      kununuScore: 4.9,
    });
    expect(noisy).toEqual(base);
  });

  it("treats a complete advertised range as high-confidence evidence", () => {
    expect(estimateSalaryRange({
      title: "Software Tester",
      advertisedSalaryMin: 54_439,
      advertisedSalaryMax: 69_905,
    })).toMatchObject({
      min: 54,
      target: 62,
      max: 70,
      evidence: "advertised-range",
      confidence: "high",
      label: "Advertised range",
    });
  });

  it("treats a legal advertised minimum as a floor, not the whole offer", () => {
    const range = estimateSalaryRange({
      title: "Senior Test Automation Engineer",
      techStack: ["Java", "Selenium"],
      advertisedSalaryMin: 60_000,
      advertisedSalaryKind: "minimum",
    });
    expect(range.min).toBe(60);
    expect(range.target).toBeGreaterThan(range.min);
    expect(range.max).toBeGreaterThan(range.target);
    expect(range).toMatchObject({ evidence: "advertised-minimum", confidence: "medium-high" });
  });

  it("uses company-wide reported salary only as a partial anchor", () => {
    const base = estimateSalaryRange({ title: "QA Engineer", techStack: [] });
    const anchored = estimateSalaryRange({ title: "QA Engineer", techStack: [], reportedSalary: 75 });
    expect(anchored.target).toBeGreaterThan(base.target);
    expect(anchored.target).toBeLessThan(75);
    expect(anchored.evidence).toBe("company-market-model");
  });
});
