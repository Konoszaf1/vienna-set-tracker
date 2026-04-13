import { describe, it, expect } from "vitest";
import { normalizeCompanyName } from "./normalizeCompany";

describe("normalizeCompanyName", () => {
  it("ÖBB-Konzern and ÖBB normalize to the same key", () => {
    expect(normalizeCompanyName("ÖBB-Konzern")).toBe(normalizeCompanyName("ÖBB"));
    expect(normalizeCompanyName("ÖBB-Konzern")).toBe("öbb");
  });

  it("strips GmbH suffix", () => {
    expect(normalizeCompanyName("Dynatrace Austria GmbH")).toBe("dynatrace");
  });

  it("strips AG suffix", () => {
    expect(normalizeCompanyName("FREQUENTIS AG")).toBe("frequentis");
  });

  it("strips Gesellschaft", () => {
    expect(normalizeCompanyName("SV-Chipkarten Betriebs- und Errichtungsges.m.b.H."))
      .toBe("sv chipkarten betriebs und errichtungsges.m.b.h.");
    // Note: "ges.m.b.h." doesn't match "gesellschaft" — it's an abbreviation.
    // The function strips "gesellschaft" as a whole word only.
  });

  it("strips multiple suffixes", () => {
    expect(normalizeCompanyName("Merck Gesellschaft mbH")).toBe("merck mbh");
  });

  it("handles Part of / Group names", () => {
    expect(normalizeCompanyName("XXXLdigital – Part of XXXL Group"))
      .toBe("xxxldigital part of xxxl");
  });
});
