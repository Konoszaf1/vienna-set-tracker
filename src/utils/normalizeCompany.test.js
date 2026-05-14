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
      .toBe("sv chipkarten betriebs und errichtungsges");
  });

  it("strips multiple suffixes", () => {
    expect(normalizeCompanyName("Merck Gesellschaft mbH")).toBe("merck");
  });

  it("handles Part of / Group names", () => {
    expect(normalizeCompanyName("XXXLdigital – Part of XXXL Group"))
      .toBe("xxxldigital");
  });

  it("normalizes punctuation and ampersands", () => {
    expect(normalizeCompanyName("Jarosch & Haas GmbH")).toBe("jarosch haas");
  });

  it("strips GmbH & Co KG as one legal suffix", () => {
    expect(normalizeCompanyName("Example GmbH & Co. KG")).toBe("example");
  });
});
