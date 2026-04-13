const CORP_SUFFIXES = /\b(gmbh|ag|kg|konzern|austria|österreich|gruppe|group|holding|se|e\.u\.|gesellschaft|international|ltd|inc|corp)\b/gi;

/**
 * Normalize a company name for grouping/dedup.
 * Strips corporate suffixes, lowercases, collapses whitespace.
 */
export function normalizeCompanyName(name) {
  return name
    .toLowerCase()
    .replace(CORP_SUFFIXES, "")
    .replace(/[–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
