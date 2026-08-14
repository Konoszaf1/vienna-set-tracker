/**
 * Three-gate validator for Vienna SDET/QA job listings.
 *
 * Gate 1: NON_SOFTWARE_DOMAIN — reject non-software "quality" roles
 * Gate 2: SDET_ROLE — title must positively match an SDET/QA engineer pattern
 * Gate 3: Management filter — reject management titles without hands-on signal
 */

const MIN_TITLE_LENGTH = 10;
const BLOCKLISTED_COMPANIES = new Set([
  "jetzt bewerben",
  "alle jobs",
  "karriere.at",
  "mehr erfahren",
]);

/** Set to false to include management-level roles in results. */
export const REJECT_MANAGEMENT = true;

// Gate 1: Non-software domain exclusion (single regex)
const NON_SOFTWARE_DOMAIN = new RegExp([
  "\\bpharma",
  "\\barzneimittel",
  "\\bmedikament",
  "\\bklinisch",
  "\\bclinical\\b",
  "\\bgmp\\b",
  "\\belectrical\\s+qa",
  "\\bqa\\s*\\/\\s*qc",
  "quality.*officer.*operations",
  "\\bcustomer\\s+care",
  "\\bcall\\s*cent(?:er|re)",
  "\\bquality\\s+excellence",
  "\\bpayroll",
  "\\bfood\\s+safety",
  "\\biso\\s*9001",
  "\\bmanufacturing\\s+quality",
  "\\blieferant",
].join("|"), "i");

// Gate 2: SDET role whitelist (must match at least one, with \b boundaries)
const SDET_ROLE = new RegExp([
  "\\bsdet\\b",
  "\\bsoftware\\s+engineer.*\\btest",
  "\\bengineer\\s+in\\s+test\\b",
  "\\btest\\s+(automation\\s+)?engineer\\b",
  "\\bautomation\\s+engineer\\b",
  "\\bqa\\s+automation\\s+engineer\\b",
  "\\bqa\\s+engineer\\b",
  "\\btechnical\\s+qa\\s+lead\\b",
  "\\bquality\\s+(?:assurance\\s+)?engineer\\b",
  "\\btest\\s*automatisier",
  "\\btestautomatisierung(?:sing|seng)",
  "\\bsoftware\\s+test",
  "\\bsoftware[-\\s]?tester\\b",
  "\\btestingenieur",
  "\\btest\\s+architect",
  "\\btestarchitekt",
].join("|"), "i");

// Gate 3: Management filter
// "manager" uses suffix match (no leading \b) to catch German compounds
// like "Testmanager" and "Projektmanager".
const MANAGEMENT_PATTERN = /\b(?:head\s+of|leiter(?:in)?|leitung|gruppenleit|koordinator(?:in)?|coordinator|director)\b|manager(?:\*?:?in)?\b/i;
const HANDS_ON_SIGNAL = /engineer|entwickler|developer|architect|architekt/i;

export function validateJob(job) {
  let validUrl = false;
  try {
    const url = new URL(job.url || "");
    validUrl = url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    // The validation result below reports malformed URLs uniformly.
  }
  if (!validUrl) {
    return { valid: false, reason: "invalid-url" };
  }

  const title = (job.title || "").trim();
  if (title.length < MIN_TITLE_LENGTH) {
    return { valid: false, reason: "short-title" };
  }

  const company = (job.company || "").trim();
  if (!company) {
    return { valid: false, reason: "empty-company" };
  }
  if (BLOCKLISTED_COMPANIES.has(company.toLowerCase())) {
    return { valid: false, reason: "blocklisted-company" };
  }

  // Gate 1: Domain exclusion
  if (NON_SOFTWARE_DOMAIN.test(title)) {
    return { valid: false, reason: "non-software-domain" };
  }

  // Gate 2: SDET role whitelist
  if (!SDET_ROLE.test(title)) {
    return { valid: false, reason: "not-sdet-role" };
  }

  // Gate 3: Management filter
  if (REJECT_MANAGEMENT && MANAGEMENT_PATTERN.test(title) && !HANDS_ON_SIGNAL.test(title)) {
    return { valid: false, reason: "management-role" };
  }

  return { valid: true, reason: null };
}
