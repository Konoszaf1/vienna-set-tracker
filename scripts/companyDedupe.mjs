/**
 * Company name normalization for deduplicating scraped job listings
 * against the curated company dataset.
 */

const CORPORATE_SUFFIXES = /\b(gmbh|ag|kg|gmbh\s*&\s*co\s*kg|austria|international|ltd|e\.?u\.?|inc|corp)\b/gi;

export function normalizeCompanyName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(CORPORATE_SUFFIXES, "")
    .replace(/\s+/g, " ")
    .trim();
}
