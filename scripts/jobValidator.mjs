/**
 * Two-stage validator for Vienna SDET/QA job listings.
 *
 * Stage 1: Domain exclusion — hard-reject non-software "quality" roles
 *          (pharma, electrical, customer service, payroll, etc.).
 * Stage 2: Role-type whitelist — title must positively match an SDET/QA
 *          engineer pattern. Replaces the old loose keyword check.
 * Stage 3: Management filter — reject management titles unless they also
 *          contain a hands-on signal (engineer, developer, architect).
 *          Controlled by REJECT_MANAGEMENT flag.
 */

const URL_PATTERN = /^https:\/\/(www\.karriere\.at\/jobs\/\d+|www\.kununu\.com\/|www\.linkedin\.com\/jobs\/|at\.indeed\.com\/)/;
const MIN_TITLE_LENGTH = 10;
const BLOCKLISTED_COMPANIES = new Set([
  "jetzt bewerben",
  "alle jobs",
  "karriere.at",
  "mehr erfahren",
]);

/** Set to false to include management-level roles in results. */
export const REJECT_MANAGEMENT = true;

// Stage 1: Domain exclusion (checked against title)
const DOMAIN_EXCLUSIONS = [
  { re: /\bpharma/i, reason: "domain-pharma" },
  { re: /\barzneimittel/i, reason: "domain-pharma" },
  { re: /\bmedikament/i, reason: "domain-pharma" },
  { re: /\bklinisch/i, reason: "domain-pharma" },
  { re: /\bclinical/i, reason: "domain-pharma" },
  { re: /\belectrical\s+qa/i, reason: "domain-electrical" },
  { re: /\bqa\s*\/\s*qc/i, reason: "domain-electrical" },
  { re: /quality.*officer.*operations/i, reason: "domain-operations" },
  { re: /\bcustomer\s+care/i, reason: "domain-customer-service" },
  { re: /\bcall\s*cent(?:er|re)/i, reason: "domain-customer-service" },
  { re: /\bquality\s+excellence/i, reason: "domain-customer-service" },
  { re: /\bpayroll/i, reason: "domain-payroll" },
  { re: /\bfood\s+safety/i, reason: "domain-food" },
  { re: /\bgmp\b/i, reason: "domain-pharma" },
  { re: /\biso\s*9001/i, reason: "domain-manufacturing" },
  { re: /\bmanufacturing\s+quality/i, reason: "domain-manufacturing" },
  { re: /\blieferant/i, reason: "domain-supply-chain" },
];

// Stage 2: Role-type whitelist — must match at least one
const ROLE_WHITELIST = new RegExp([
  "sdet",
  "software\\s+engineer.*test",
  "engineer\\s+in\\s+test",
  "test\\s+(automation\\s+)?engineer",
  "automation\\s+engineer",
  "qa\\s+engineer",
  "quality\\s+(?:assurance\\s+)?engineer",
  "test\\s*automatisier",
  "testautomatisierung(?:sing|seng)",
  "software\\s+test",
  "testingenieur",
  "test\\s+architect",
  "testarchitekt",
].join("|"), "i");

// Stage 3: Management filter
// Note: "manager" uses suffix match (no leading \b) to catch German compounds
// like "Testmanager" and "Projektmanager".
const MANAGEMENT_PATTERN = /\b(?:head\s+of|leiter(?:in)?|leitung|gruppenleit|koordinator(?:in)?|coordinator|director)\b|manager(?:\*?:?in)?\b/i;
const HANDS_ON_SIGNAL = /engineer|entwickler|developer|architect|architekt/i;

export function validateJob(job) {
  if (!URL_PATTERN.test(job.url || "")) {
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

  // Stage 1: Domain exclusion
  for (const { re, reason } of DOMAIN_EXCLUSIONS) {
    if (re.test(title)) {
      return { valid: false, reason };
    }
  }

  // Stage 2: Role-type whitelist
  if (!ROLE_WHITELIST.test(title)) {
    return { valid: false, reason: "no-positive-match" };
  }

  // Stage 3: Management filter
  if (REJECT_MANAGEMENT && MANAGEMENT_PATTERN.test(title) && !HANDS_ON_SIGNAL.test(title)) {
    return { valid: false, reason: "management-role" };
  }

  return { valid: true, reason: null };
}
