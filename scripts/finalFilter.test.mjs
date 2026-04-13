import { describe, it, expect } from "vitest";
import { validateJob } from "./jobValidator.mjs";

describe("finalFilter logic", () => {
  const makeJob = (title, company = "TestCorp") => ({
    title,
    company,
    url: "https://www.karriere.at/jobs/9999999",
    source: "karriere.at",
  });

  it("keeps valid SDET jobs", () => {
    const job = makeJob("Senior Test Automation Engineer (m/w/d)");
    expect(validateJob(job)).toEqual({ valid: true, reason: null });
  });

  it("filters non-software-domain titles", () => {
    const job = makeJob("Pharma Quality Assurance Engineer");
    expect(validateJob(job)).toEqual({ valid: false, reason: "non-software-domain" });
  });

  it("filters non-SDET titles", () => {
    const job = makeJob("Frontend Developer (m/w/d)");
    expect(validateJob(job)).toEqual({ valid: false, reason: "not-sdet-role" });
  });

  it("filters management titles without hands-on signal", () => {
    const job = makeJob("Leitung Software Testautomatisierung");
    expect(validateJob(job)).toEqual({ valid: false, reason: "management-role" });
  });

  it("keeps management title WITH hands-on signal", () => {
    const job = makeJob("Test Automation Engineer & Coordinator");
    // Has "coordinator" (management) but also "engineer" (hands-on)
    expect(validateJob(job)).toEqual({ valid: true, reason: null });
  });

  it("simulates filter reducing job count", () => {
    const jobs = [
      makeJob("Senior Test Automation Engineer (m/w/d)"),
      makeJob("Pharma QA/QC Specialist"),
      makeJob("SDET Engineer (m/w/d)"),
      makeJob("Call Center Quality Manager"),
    ];

    const filtered = jobs.filter(j => validateJob(j).valid);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].title).toContain("Test Automation");
    expect(filtered[1].title).toContain("SDET");
  });

  it("updates count after filtering", () => {
    const data = {
      jobs: [
        makeJob("Senior Test Automation Engineer (m/w/d)"),
        makeJob("Pharma QA/QC Specialist"),
      ],
      count: 2,
    };

    data.jobs = data.jobs.filter(j => validateJob(j).valid);
    data.count = data.jobs.length;

    expect(data.count).toBe(1);
    expect(data.jobs[0].title).toContain("Test Automation");
  });
});
