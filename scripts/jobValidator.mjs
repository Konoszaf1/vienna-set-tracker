/**
 * Pure validation function for scraped job listings.
 * Source-agnostic — accepts karriere.at, kununu, and JobSpy URLs
 * (LinkedIn, Indeed, Glassdoor, Google).
 * Takes a job object, returns { valid: boolean, reason: string | null }.
 */

const URL_PATTERN = /^https:\/\/(www\.karriere\.at\/jobs\/\d+|www\.kununu\.com\/|www\.linkedin\.com\/|.*\.linkedin\.com\/|.*\.indeed\.com\/|.*\.glassdoor\.\w+\/|jobs\.google\.com\/)/;
const MIN_TITLE_LENGTH = 10;
const BLOCKLISTED_COMPANIES = new Set([
  "jetzt bewerben",
  "alle jobs",
  "karriere.at",
  "mehr erfahren",
]);
const TEST_KEYWORDS = /test|qa|sdet|quality|automation|automatisierung|prüfung|tester/i;
const NON_TEST_ROLES = /frontend|backend|full\s*stack|fullstack|mobile\s+developer|devops\s+engineer/i;

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

  if (!TEST_KEYWORDS.test(title)) {
    return { valid: false, reason: "missing-test-keyword" };
  }

  // Cheap insurance: if a non-test role title somehow passed the keyword
  // check above (e.g. rules reordered later), catch it here.
  if (NON_TEST_ROLES.test(title) && !TEST_KEYWORDS.test(title)) {
    return { valid: false, reason: "non-test-role" };
  }

  return { valid: true, reason: null };
}
