import { describe, it, expect } from "vitest";
import { validateJob } from "./jobValidator.mjs";

const valid = (overrides = {}) => ({
  url: "https://www.karriere.at/jobs/7758914",
  title: "Senior SDET Engineer (m/w/d)",
  company: "Dynatrace Austria GmbH",
  ...overrides,
});

describe("validateJob", () => {
  // ---- Basic checks (URL, title length, company) ----

  it("karriere.at URL without numeric ID rejected", () => {
    expect(validateJob(valid({ url: "https://www.karriere.at/jobs/search" })))
      .toEqual({ valid: false, reason: "invalid-url" });
  });

  it("URL from unsupported domain rejected", () => {
    expect(validateJob(valid({ url: "https://www.stepstone.at/jobs/12345" })))
      .toEqual({ valid: false, reason: "invalid-url" });
  });

  it("kununu URL accepted", () => {
    expect(validateJob(valid({ url: "https://www.kununu.com/job-postings/at/6d9269ec" })))
      .toEqual({ valid: true, reason: null });
  });

  it("LinkedIn URL accepted", () => {
    expect(validateJob(valid({ url: "https://www.linkedin.com/jobs/view/4399047134" })))
      .toEqual({ valid: true, reason: null });
  });

  it("indeed.at URL accepted", () => {
    expect(validateJob(valid({ url: "https://at.indeed.com/viewjob?jk=60a4e80276772c49" })))
      .toEqual({ valid: true, reason: null });
  });

  it("title too short rejected", () => {
    expect(validateJob(valid({ title: "QA" })))
      .toEqual({ valid: false, reason: "short-title" });
  });

  it("empty company rejected", () => {
    expect(validateJob(valid({ company: "" })))
      .toEqual({ valid: false, reason: "empty-company" });
  });

  it("blocklisted company rejected", () => {
    expect(validateJob(valid({ company: "Jetzt bewerben" })))
      .toEqual({ valid: false, reason: "blocklisted-company" });
  });

  // ---- Acceptance: valid SDET titles that pass all gates (8+) ----

  it("Senior SDET Engineer accepted", () => {
    expect(validateJob(valid())).toEqual({ valid: true, reason: null });
  });

  it("Test Automation Engineer accepted (Qnit)", () => {
    expect(validateJob(valid({ title: "Test Automation Engineer (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Senior Software Engineer in Test accepted (Raiffeisen)", () => {
    expect(validateJob(valid({ title: "Senior Software Engineer in Test (f/m/x)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("QA Engineer accepted (RINGANA)", () => {
    expect(validateJob(valid({ title: "QA Engineer (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Quality Assurance Engineer accepted (ENPULSION)", () => {
    expect(validateJob(valid({ title: "Quality Assurance Engineer" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Testingenieur:in accepted (EVVA)", () => {
    expect(validateJob(valid({ title: "Testingenieur:in (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Software Test Engineer accepted (MELECS)", () => {
    expect(validateJob(valid({ title: "Software Test Engineer (all genders)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Testarchitekt accepted (IBM)", () => {
    expect(validateJob(valid({ title: "Testarchitekt (f/m/x)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("System Test Engineer accepted (FREQUENTIS)", () => {
    expect(validateJob(valid({ title: "System Test Engineer (all genders)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Senior Test Automation Engineer accepted (PKE)", () => {
    expect(validateJob(valid({ title: "Senior Test Automation Engineer (m/w/d) – Gefahrenmanagementsysteme" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Software Quality Engineer accepted (Ketryx)", () => {
    expect(validateJob(valid({ title: "Software Quality Engineer" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Agile Senior Software Testautomation Engineer accepted (ÖBB)", () => {
    expect(validateJob(valid({ title: "Agile Senior Software Testautomation Engineer (m/w/x)" })))
      .toEqual({ valid: true, reason: null });
  });

  // ---- Gate 1: Non-software domain exclusion (6+) ----

  it("pharma QA rejected (Merck)", () => {
    expect(validateJob(valid({ title: "Praktikum im Bereich Pharma Quality Assurance (d/m/w)" })))
      .toEqual({ valid: false, reason: "non-software-domain" });
  });

  it("clinical quality rejected", () => {
    expect(validateJob(valid({ title: "Clinical Quality Assurance Manager (m/w/d)" })))
      .toEqual({ valid: false, reason: "non-software-domain" });
  });

  it("electrical QA/QC rejected (Designer Group)", () => {
    expect(validateJob(valid({ title: "Electrical QA/QC Engineer" })))
      .toEqual({ valid: false, reason: "non-software-domain" });
  });

  it("quality officer operations rejected (Kwizda)", () => {
    expect(validateJob(valid({ title: "Quality Assurance Officer (m/w/d) - Operations" })))
      .toEqual({ valid: false, reason: "non-software-domain" });
  });

  it("customer care quality rejected (Coca-Cola)", () => {
    expect(validateJob(valid({ title: "Customer Care Agent – Quality Excellence (m/w/d)" })))
      .toEqual({ valid: false, reason: "non-software-domain" });
  });

  it("payroll quality rejected (WienIT)", () => {
    expect(validateJob(valid({ title: "Gruppenleitung Quality Management Payroll (w/m/d)" })))
      .toEqual({ valid: false, reason: "non-software-domain" });
  });

  it("GMP quality rejected", () => {
    expect(validateJob(valid({ title: "GMP Quality Control Specialist (m/w/d)" })))
      .toEqual({ valid: false, reason: "non-software-domain" });
  });

  it("food safety QA rejected", () => {
    expect(validateJob(valid({ title: "Food Safety Quality Assurance Lead (m/w/d)" })))
      .toEqual({ valid: false, reason: "non-software-domain" });
  });

  // ---- Gate 2: Not-SDET-role rejection (3+) ----

  it("QA Specialist rejected — not an SDET role (Journi)", () => {
    expect(validateJob(valid({ title: "QA Specialist (all genders)" })))
      .toEqual({ valid: false, reason: "not-sdet-role" });
  });

  it("QA-Tester:in rejected — not an SDET role (allaboutapps)", () => {
    expect(validateJob(valid({ title: "QA-Tester:in Software" })))
      .toEqual({ valid: false, reason: "not-sdet-role" });
  });

  it("C# Softwareentwickler Testsysteme rejected (Kapsch)", () => {
    expect(validateJob(valid({ title: "C# Softwareentwickler Testsysteme (m/w/d)" })))
      .toEqual({ valid: false, reason: "not-sdet-role" });
  });

  it("SAP Test Coordinator rejected (RHI Magnesita)", () => {
    expect(validateJob(valid({ title: "SAP S4 HANA Test Coordinator (all genders)" })))
      .toEqual({ valid: false, reason: "not-sdet-role" });
  });

  it("Senior Frontend Developer rejected", () => {
    expect(validateJob(valid({ title: "Senior Frontend Developer (m/w/d)" })))
      .toEqual({ valid: false, reason: "not-sdet-role" });
  });

  // ---- Gate 3: Management filter — rejected (5+) ----

  it("Head of Software Testing rejected (Ketryx)", () => {
    expect(validateJob(valid({ title: "Head of Software Testing" })))
      .toEqual({ valid: false, reason: "management-role" });
  });

  it("Testmanager Testautomatisierung rejected (BEKO)", () => {
    expect(validateJob(valid({ title: "Testmanager Testautomatisierung (m/w/x)" })))
      .toEqual({ valid: false, reason: "management-role" });
  });

  it("Junior Projektmanager – Testautomatisierung rejected (Automators)", () => {
    expect(validateJob(valid({ title: "Junior Projektmanager – Testautomatisierung" })))
      .toEqual({ valid: false, reason: "management-role" });
  });

  it("Leiter:in Testautomatisierung rejected", () => {
    expect(validateJob(valid({ title: "Leiter:in Testautomatisierung (m/w/d)" })))
      .toEqual({ valid: false, reason: "management-role" });
  });

  it("Leitung Software Testautomatisierung rejected", () => {
    expect(validateJob(valid({ title: "Leitung Software Testautomatisierung (m/w/d)" })))
      .toEqual({ valid: false, reason: "management-role" });
  });

  // ---- Gate 3: Management override — hands-on signal present (3+) ----

  it("Director Test Automation Engineer accepted (hands-on signal)", () => {
    expect(validateJob(valid({ title: "Director Test Automation Engineer (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Koordinator:in QA Engineer accepted (hands-on signal)", () => {
    expect(validateJob(valid({ title: "Koordinator:in QA Engineer (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Leiter Software Test Entwickler accepted (hands-on signal)", () => {
    expect(validateJob(valid({ title: "Leiter Software Test Entwickler (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });
});
