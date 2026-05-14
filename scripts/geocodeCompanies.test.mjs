import { describe, it, expect } from "vitest";
import {
  companyQueryVariants,
  decodeDuckDuckGoHref,
  extractViennaAddressFromText,
  scoreCandidateUrl,
} from "./geocodeCompanies.mjs";

describe("geocodeCompanies helpers", () => {
  it("builds normalized company query variants", () => {
    expect(companyQueryVariants(["Greentube GmbH"])).toEqual([
      "Greentube GmbH",
      "greentube",
    ]);
  });

  it("decodes DuckDuckGo redirect links", () => {
    const href = "/l/?kh=-1&uddg=https%3A%2F%2Fexample.com%2Fimpressum";
    expect(decodeDuckDuckGoHref(href)).toBe("https://example.com/impressum");
  });

  it("extracts common Vienna address formats from text", () => {
    expect(extractViennaAddressFromText("Geschäftsanschrift\nMarc-Aurel-Strasse 10-12/1. OG, 1010 Wien"))
      .toBe("Marc-Aurel-Strasse 10-12/1. OG, 1010 Wien");

    expect(extractViennaAddressFromText("Kontakt\nJohann-Boehm-Platz 1\nA-1020 Wien"))
      .toBe("Johann-Boehm-Platz 1, 1020 Wien");
  });

  it("prioritizes contact and impressum pages over generic URLs", () => {
    expect(scoreCandidateUrl("https://acme.at/impressum/", ["Acme GmbH"]))
      .toBeGreaterThan(scoreCandidateUrl("https://jobs.example.com/acme", ["Acme GmbH"]));
  });
});
