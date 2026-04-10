import { describe, it, expect } from "vitest";
import { validateJob } from "./jobValidator.mjs";

const valid = (overrides = {}) => ({
  url: "https://www.karriere.at/jobs/7758914",
  title: "Senior SDET Engineer (m/w/d)",
  company: "Dynatrace Austria GmbH",
  ...overrides,
});

describe("validateJob", () => {
  it("valid SDET job passes", () => {
    expect(validateJob(valid())).toEqual({ valid: true, reason: null });
  });

  it("URL without numeric ID rejected", () => {
    const r = validateJob(valid({ url: "https://www.karriere.at/jobs/search" }));
    expect(r).toEqual({ valid: false, reason: "invalid-url" });
  });

  it("URL from different domain rejected", () => {
    const r = validateJob(valid({ url: "https://www.linkedin.com/jobs/12345" }));
    expect(r).toEqual({ valid: false, reason: "invalid-url" });
  });

  it('title "QA" alone rejected (too short)', () => {
    const r = validateJob(valid({ title: "QA" }));
    expect(r).toEqual({ valid: false, reason: "short-title" });
  });

  it('title "Senior Frontend Developer" rejected (no test keyword)', () => {
    const r = validateJob(valid({ title: "Senior Frontend Developer (m/w/d)" }));
    expect(r).toEqual({ valid: false, reason: "missing-test-keyword" });
  });

  it('title "Frontend Test Engineer" accepted (has test keyword)', () => {
    const r = validateJob(valid({ title: "Frontend Test Engineer (m/w/d)" }));
    expect(r).toEqual({ valid: true, reason: null });
  });

  it('German title "Testautomatisierungsingenieur" accepted', () => {
    const r = validateJob(valid({ title: "Testautomatisierungsingenieur (m/w/d)" }));
    expect(r).toEqual({ valid: true, reason: null });
  });

  it("empty company rejected", () => {
    const r = validateJob(valid({ company: "" }));
    expect(r).toEqual({ valid: false, reason: "empty-company" });
  });

  it('company "Jetzt bewerben" rejected', () => {
    const r = validateJob(valid({ company: "Jetzt bewerben" }));
    expect(r).toEqual({ valid: false, reason: "blocklisted-company" });
  });

  it("title without any test keyword rejected", () => {
    const r = validateJob(valid({ title: "Senior Software Engineer (m/w/d)" }));
    expect(r).toEqual({ valid: false, reason: "missing-test-keyword" });
  });
});
