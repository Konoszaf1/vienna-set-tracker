import { VIENNA_SALARY_MARKET_2026 } from "../data/salaryMarketVienna2026";

export const BASELINE = VIENNA_SALARY_MARKET_2026.levels.regular.target;

const LEAD = /\b(lead|architect|principal|head(?:\s+of)?|staff|manager)\b/i;
const SENIOR = /\b(senior|sr\.?|specialist|expert)\b/i;
const JUNIOR = /\b(junior|jr\.?|graduate|entry[- ]level)\b/i;
const INTERN = /\b(intern|trainee|praktikum|student|working\s+student)\b/i;

const AUTOMATION = /\b(sdet|automation|automatisier|engineer\s+in\s+test|test\s+developer)\b/i;
const MANUAL = /\b(manual|functional\s+tester|test\s+analyst)\b/i;
const SPECIALIST = /\b(performance|load|security|embedded|mobile|api|integration)\b/i;

const CODE_TECH = new Set([
  "java", "python", "c#", ".net", "c++", "go", "rust", "kotlin", "scala",
  "typescript", "javascript", "playwright", "cypress", "selenium", "appium",
  "junit", "pytest", "nunit", "rest assured",
]);
const PLATFORM_TECH = new Set([
  "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd",
  "jenkins", "github actions", "gitlab ci/cd", "azure devops",
]);

function rounded(value) {
  return Math.round(Number(value));
}

function finiteSalary(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 20 && number <= 250 ? number : null;
}

function annualThousands(value) {
  const number = finiteSalary(value);
  if (number != null) return number;
  const raw = Number(value);
  return Number.isFinite(raw) && raw >= 20_000 && raw <= 250_000 ? raw / 1000 : null;
}

function seniority(title) {
  if (LEAD.test(title)) return "lead";
  if (SENIOR.test(title)) return "senior";
  if (JUNIOR.test(title)) return "junior";
  if (INTERN.test(title)) return "intern";
  return "regular";
}

function applyAdjustment(range, [min, target, max], reasons, reason) {
  range.min += min;
  range.target += target;
  range.max += max;
  reasons.push(reason);
}

function modelRange(role) {
  const title = String(role.title || "");
  const level = seniority(title);
  const benchmark = VIENNA_SALARY_MARKET_2026.levels[level];
  const range = { min: benchmark.min, target: benchmark.target, max: benchmark.max };
  const reasons = [`2026 Vienna ${level} benchmark`];
  const tech = new Set((role.techStack || []).map(value => String(value).toLowerCase()));
  const searchable = `${title} ${[...tech].join(" ")}`;
  const codeSignals = [...tech].filter(value => CODE_TECH.has(value)).length;
  const platformSignals = [...tech].filter(value => PLATFORM_TECH.has(value)).length;
  const hasAutomation = AUTOMATION.test(searchable) || codeSignals > 0;

  if (hasAutomation) applyAdjustment(range, [1, 3, 5], reasons, "test automation scope");
  if (codeSignals >= 2) applyAdjustment(range, [1, 3, 5], reasons, "code-intensive stack");
  else if (codeSignals === 1) applyAdjustment(range, [0, 1, 2], reasons, "coding stack");
  if (platformSignals > 0) applyAdjustment(range, [0, 2, 4], reasons, "cloud/CI ownership");
  if (SPECIALIST.test(searchable)) applyAdjustment(range, [0, 2, 4], reasons, "specialist testing domain");
  if (MANUAL.test(searchable) && !hasAutomation) applyAdjustment(range, [-4, -5, -6], reasons, "manual-testing weighting");

  const companySalary = annualThousands(role.reportedSalary);
  if (companySalary != null) {
    const delta = (companySalary - range.target) * 0.3;
    range.min += delta;
    range.target += delta;
    range.max += delta;
    reasons.push("company-reported salary anchor");
  }

  return { ...range, level, benchmarkFloor: benchmark.benchmarkFloor, reasons, companySalary };
}

function normalizeRange(range) {
  let min = Math.max(24, rounded(range.min));
  let target = Math.max(min, rounded(range.target));
  let max = Math.max(target, rounded(range.max));
  if (max > 140) max = 140;
  if (target > max) target = max;
  if (min > target) min = target;
  return { min, target, max };
}

/**
 * Estimate a role's Vienna gross annual salary range in EUR thousands.
 * Evidence priority: advertised range > advertised minimum > company salary
 * anchor > 2026 Vienna role/skill benchmark.
 */
export function estimateSalaryRange(roleOrTitle) {
  const role = roleOrTitle && typeof roleOrTitle === "object"
    ? roleOrTitle
    : { title: String(roleOrTitle || ""), techStack: [] };
  const model = modelRange(role);
  const advertisedMin = annualThousands(role.advertisedSalaryMin);
  const advertisedMax = annualThousands(role.advertisedSalaryMax);

  if (advertisedMin != null && advertisedMax != null && advertisedMax > advertisedMin) {
    const min = Math.min(advertisedMin, advertisedMax);
    const max = Math.max(advertisedMin, advertisedMax);
    return {
      ...normalizeRange({ min, target: (min + max) / 2, max }),
      evidence: "advertised-range",
      confidence: "high",
      label: "Advertised range",
      level: model.level,
      benchmarkFloor: model.benchmarkFloor,
      reasons: ["salary range stated in listing"],
    };
  }

  if (advertisedMin != null) {
    const min = advertisedMin;
    const target = Math.max(model.target, min * 1.08);
    const max = Math.max(model.max, min * 1.22, target * 1.12);
    return {
      ...normalizeRange({ min, target, max }),
      evidence: "advertised-minimum",
      confidence: "medium-high",
      label: "Advertised floor + market range",
      level: model.level,
      benchmarkFloor: model.benchmarkFloor,
      reasons: ["minimum stated in listing", ...model.reasons],
    };
  }

  return {
    ...normalizeRange(model),
    evidence: model.companySalary != null ? "company-market-model" : "market-model",
    confidence: model.companySalary != null ? "medium" : "medium-low",
    label: model.companySalary != null ? "Company data + market range" : "Vienna market range",
    level: model.level,
    benchmarkFloor: model.benchmarkFloor,
    reasons: model.reasons,
  };
}

export function estimateSalary(roleOrTitle) {
  return estimateSalaryRange(roleOrTitle).target;
}
