import { describe, expect, it } from "vitest";
import {
  annualizeSalary,
  extractJobPostingMetadata,
  extractSalaryFromText,
  normalizePublishedAt,
} from "./jobMetadata.mjs";

describe("job posting metadata", () => {
  it("normalizes date-only publication values without using ingestion time", () => {
    expect(normalizePublishedAt("2026-08-03")).toBe("2026-08-03T00:00:00.000Z");
    expect(normalizePublishedAt("not-a-date")).toBeNull();
  });

  it("annualizes Austrian monthly salaries using fourteen payments", () => {
    expect(annualizeSalary(3954, "MONTH")).toBe(55356);
    expect(annualizeSalary(60000, "YEAR")).toBe(60000);
  });

  it("extracts publication date and advertised range from JobPosting JSON-LD", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      datePosted: "2026-08-02",
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "EUR",
        value: { "@type": "QuantitativeValue", minValue: 3888.53, maxValue: 4993.21, unitText: "MONTH" },
      },
    })}</script>`;
    expect(extractJobPostingMetadata(html)).toMatchObject({
      publishedAt: "2026-08-02T00:00:00.000Z",
      publishedAtConfidence: "high",
      advertisedSalaryMin: 54439,
      advertisedSalaryMax: 69905,
      advertisedSalaryKind: "range",
    });
  });

  it("parses Austrian annual minimum and monthly ranges from listing text", () => {
    expect(extractSalaryFromText("Mindestgehalt ab EUR 60.000 brutto pro Jahr")).toMatchObject({
      advertisedSalaryMin: 60000,
      advertisedSalaryMax: null,
      advertisedSalaryKind: "minimum",
    });
    expect(extractSalaryFromText("Gehalt: € 3.000 – € 4.300 brutto pro Monat")).toMatchObject({
      advertisedSalaryMin: 42000,
      advertisedSalaryMax: 60200,
      advertisedSalaryKind: "range",
    });
  });
});
