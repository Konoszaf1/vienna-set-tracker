/**
 * Seniority-only salary estimate for Vienna SDET roles.
 *
 * The scraper doesn't produce enough structured data (industry, ratings,
 * advertised ranges) to feed a multi-factor model. This function keys
 * off the one reliable signal in the data: the job title.
 */

const BASELINE = 63; // mid-level SDET in Vienna, EUR thousands gross annual

const SENIOR = /\b(senior|sr\.?|lead|staff|principal|head\s+of)\b/i;
const JUNIOR = /\b(junior|jr\.?|trainee|intern|praktikum)\b/i;

export function estimateSalary(title) {
  if (SENIOR.test(title)) return BASELINE + 8;   // ~71k
  if (JUNIOR.test(title)) return BASELINE - 15;  // ~48k
  return BASELINE;                                // ~63k
}

export { BASELINE };
