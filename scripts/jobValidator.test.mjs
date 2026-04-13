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

  it("valid SDET job passes", () => {
    expect(validateJob(valid())).toEqual({ valid: true, reason: null });
  });

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

  // ---- Stage 1: Domain exclusion ----

  it("pharma QA internship rejected (Merck-style)", () => {
    expect(validateJob(valid({ title: "Pharma Quality Assurance Specialist (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-pharma" });
  });

  it("clinical trial QA rejected", () => {
    expect(validateJob(valid({ title: "Clinical Quality Assurance Manager (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-pharma" });
  });

  it("electrical QA/QC rejected (Designer Group)", () => {
    expect(validateJob(valid({ title: "Electrical QA/QC Engineer" })))
      .toEqual({ valid: false, reason: "domain-electrical" });
  });

  it("quality officer operations rejected (Kwizda-style)", () => {
    expect(validateJob(valid({ title: "Quality Assurance Officer (m/w/d) - Operations" })))
      .toEqual({ valid: false, reason: "domain-operations" });
  });

  it("customer care quality rejected (Coca-Cola)", () => {
    expect(validateJob(valid({ title: "Customer Care Agent – Quality Excellence (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-customer-service" });
  });

  it("quality excellence rejected", () => {
    expect(validateJob(valid({ title: "Quality Excellence Specialist (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-customer-service" });
  });

  it("call centre QA rejected", () => {
    expect(validateJob(valid({ title: "Call Center Quality Analyst (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-customer-service" });
  });

  it("payroll quality rejected (WienIT)", () => {
    expect(validateJob(valid({ title: "Gruppenleitung Quality Management Payroll (w/m/d)" })))
      .toEqual({ valid: false, reason: "domain-payroll" });
  });

  it("food safety QA rejected", () => {
    expect(validateJob(valid({ title: "Food Safety Quality Assurance Lead (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-food" });
  });

  it("GMP quality rejected", () => {
    expect(validateJob(valid({ title: "GMP Quality Control Specialist (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-pharma" });
  });

  it("ISO 9001 auditor rejected", () => {
    expect(validateJob(valid({ title: "ISO 9001 Quality Auditor (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-manufacturing" });
  });

  it("manufacturing quality rejected", () => {
    expect(validateJob(valid({ title: "Manufacturing Quality Inspector (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-manufacturing" });
  });

  it("Arzneimittel QA rejected", () => {
    expect(validateJob(valid({ title: "Arzneimittel Quality Control Engineer (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-pharma" });
  });

  it("supply chain (Lieferant) quality rejected", () => {
    expect(validateJob(valid({ title: "Lieferant Qualitätssicherung Manager (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-supply-chain" });
  });

  it("klinisch-related quality rejected", () => {
    expect(validateJob(valid({ title: "Klinisch Quality Assurance Specialist (m/w/d)" })))
      .toEqual({ valid: false, reason: "domain-pharma" });
  });

  // ---- Stage 2: Role-type whitelist ----

  it("Test Automation Engineer accepted", () => {
    expect(validateJob(valid({ title: "Test Automation Engineer (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Senior Software Engineer in Test accepted", () => {
    expect(validateJob(valid({ title: "Senior Software Engineer in Test (f/m/x)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("QA Engineer accepted", () => {
    expect(validateJob(valid({ title: "QA Engineer (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Quality Assurance Engineer accepted", () => {
    expect(validateJob(valid({ title: "Quality Assurance Engineer (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Software Quality Engineer accepted (Ketryx)", () => {
    expect(validateJob(valid({ title: "Software Quality Engineer" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Testingenieur:in accepted (EVVA)", () => {
    expect(validateJob(valid({ title: "Testingenieur:in (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Testautomatisierungsingenieur accepted", () => {
    expect(validateJob(valid({ title: "Testautomatisierungsingenieur (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Software Test Engineer accepted", () => {
    expect(validateJob(valid({ title: "Software Test Engineer (all genders)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Senior Software Tester accepted (matches 'software test')", () => {
    expect(validateJob(valid({ title: "Senior Software Tester (w/m/x)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("System Test Engineer accepted (FREQUENTIS)", () => {
    expect(validateJob(valid({ title: "System Test Engineer (all genders)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("Testarchitekt accepted (IBM)", () => {
    expect(validateJob(valid({ title: "Testarchitekt (f/m/x)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("plain QA Specialist rejected (no positive match)", () => {
    expect(validateJob(valid({ title: "QA Specialist (all genders)" })))
      .toEqual({ valid: false, reason: "no-positive-match" });
  });

  it("QA-Tester:in rejected (no positive match)", () => {
    expect(validateJob(valid({ title: "QA-Tester:in Software" })))
      .toEqual({ valid: false, reason: "no-positive-match" });
  });

  it("C# Softwareentwickler Testsysteme rejected (developer, not tester)", () => {
    expect(validateJob(valid({ title: "C# Softwareentwickler Testsysteme (m/w/d)" })))
      .toEqual({ valid: false, reason: "no-positive-match" });
  });

  it("SAP Test Coordinator rejected (no positive match)", () => {
    expect(validateJob(valid({ title: "SAP S4 HANA Test Coordinator (all genders)" })))
      .toEqual({ valid: false, reason: "no-positive-match" });
  });

  it("plain Senior Frontend Developer rejected (no positive match)", () => {
    expect(validateJob(valid({ title: "Senior Frontend Developer (m/w/d)" })))
      .toEqual({ valid: false, reason: "no-positive-match" });
  });

  // ---- Stage 3: Management filter ----

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

  it("IT Test Manager*in rejected (WienIT)", () => {
    // Fails whitelist first (no engineer pattern), so reason is no-positive-match
    expect(validateJob(valid({ title: "IT Test Manager*in" })))
      .toEqual({ valid: false, reason: "no-positive-match" });
  });

  it("management title with hands-on signal accepted", () => {
    // "Director" triggers management, but "Engineer" is a hands-on signal
    expect(validateJob(valid({ title: "Director Test Automation Engineer (m/w/d)" })))
      .toEqual({ valid: true, reason: null });
  });

  it("management title without hands-on signal or whitelist match rejected", () => {
    // "Director of Quality" — no whitelist match, no hands-on signal
    expect(validateJob(valid({ title: "Director of Quality Assurance" })))
      .toEqual({ valid: false, reason: "no-positive-match" });
  });
});
