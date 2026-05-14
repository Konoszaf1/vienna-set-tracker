const CORP_SUFFIXES = /\b(gmbh\s+co\s+kg|ges\s*m\s*b\s*h|m\s*b\s*h|gmbh|mbh|ag|kg|konzern|austria|österreich|gruppe|group|holding|se|e\s*u|gesellschaft|international|ltd|inc|corp)\b/gi;

/**
 * Normalize a company name for grouping/dedup.
 * Strips corporate suffixes, lowercases, collapses whitespace.
 */
export function normalizeCompanyName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\bpart\s+of\b.*$/i, " ")
    .replace(/&/g, " ")
    .replace(/[–—\-.,/()[\]]+/g, " ")
    .replace(CORP_SUFFIXES, "")
    .replace(/\s+/g, " ")
    .trim();
}
