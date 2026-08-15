/**
 * Vienna QA/SDET gross annual salary calibration, EUR thousands.
 *
 * The benchmark floors are derived from the Austrian IT collective agreement
 * effective 2026-01-01 (monthly base salary × 14 payments). Market targets are
 * calibrated against current Vienna QA/test-automation advertisements and are
 * deliberately ranges rather than promises about a specific employer.
 */
export const VIENNA_SALARY_MARKET_2026 = Object.freeze({
  asOf: "2026-08-15",
  currency: "EUR",
  annualPayments: 14,
  sources: Object.freeze([
    "https://www.wko.at/kollektivvertrag/kollektivvertrags-abschluss-informationstechnologie-2026",
    "https://www.karriere.at/gehalt/software-tester",
  ]),
  levels: Object.freeze({
    intern: Object.freeze({ min: 30, target: 36, max: 43, benchmarkFloor: 30 }),
    junior: Object.freeze({ min: 44, target: 51, max: 59, benchmarkFloor: 45.7 }),
    regular: Object.freeze({ min: 52, target: 61, max: 70, benchmarkFloor: 55.4 }),
    senior: Object.freeze({ min: 63, target: 74, max: 86, benchmarkFloor: 64.6 }),
    lead: Object.freeze({ min: 76, target: 88, max: 102, benchmarkFloor: 76.2 }),
  }),
});
