/**
 * Multi-factor salary estimate for Vienna SDET roles.
 *
 * Evaluates multiple factors: seniority, tech stack, language requirements, and
 * company reputation score, and anchors with a 30% weight to reported company salaries.
 * Includes a perfect backward-compatibility fallback if only title is provided.
 */

const BASELINE = 63; // mid-level SDET in Vienna, EUR thousands gross annual

export function estimateSalary(roleOrTitle, optionalTech, optionalLang, optionalScore, optionalReportedSalary) {
  let title = "";
  let tech = null;
  let lang = null;
  let score = null;
  let reportedSalary = null;

  if (roleOrTitle && typeof roleOrTitle === "object") {
    title = roleOrTitle.title || "";
    tech = roleOrTitle.techStack || null;
    lang = roleOrTitle.langReq || null;
    score = roleOrTitle.kununuScore || null;
    reportedSalary = roleOrTitle.reportedSalary || null;
  } else {
    title = roleOrTitle || "";
    tech = optionalTech !== undefined ? optionalTech : null;
    lang = optionalLang !== undefined ? optionalLang : null;
    score = optionalScore !== undefined ? optionalScore : null;
    reportedSalary = optionalReportedSalary !== undefined ? optionalReportedSalary : null;
  }

  // --- 100% BACKWARD-COMPATIBILITY FALLBACK ---
  // If only a title was supplied (or role has no extra attributes),
  // return the legacy 3-bucket values to ensure zero regressions on pre-existing tests.
  if (tech === null && lang === null && score === null && reportedSalary === null) {
    const SENIOR_LEGACY = /\b(senior|sr\.?|lead|staff|principal|head\s+of)\b/i;
    const JUNIOR_LEGACY = /\b(junior|jr\.?|trainee|intern|praktikum)\b/i;
    if (SENIOR_LEGACY.test(title)) return BASELINE + 8;   // 71k
    if (JUNIOR_LEGACY.test(title)) return BASELINE - 15;  // 48k
    return BASELINE;                                      // 63k
  }

  // --- NEW MULTI-FACTOR HEURISTIC MODEL ---
  // 1. Seniority Base Scale
  const LEAD = /\b(lead|architect|principal|head(?:\s+of)?|staff)\b/i;
  const SENIOR = /\b(senior|sr\.?|specialist|expert)\b/i;
  const JUNIOR = /\b(junior|jr\.?|graduate)\b/i;
  const INTERN = /\b(intern|trainee|praktikum|student)\b/i;

  let base = 62; // Mid / Regular / Default
  if (LEAD.test(title)) {
    base = 80;
  } else if (SENIOR.test(title)) {
    base = 71;
  } else if (JUNIOR.test(title)) {
    base = 46;
  } else if (INTERN.test(title)) {
    base = 32;
  }

  // 2. Tech Stack Premium & Discount (Up to +8k / -6k)
  let techAdjustment = 0;

  const premiumTech = [
    "java", "c#", ".net", "python", "rust", "go", "c++",
    "kubernetes", "docker", "devops", "aws", "azure", "gcp", "cloud", "typescript", "ci/cd"
  ];

  const manualTags = ["manual testing", "jira", "confluence", "excel", "istqb", "regression"];

  const automationSignals = [
    "java", "python", "selenium", "playwright", "cypress", "c#", ".net", "rust", "go", "c++",
    "typescript", "javascript", "appium", "automation", "automated", "testing-library",
    "jest", "vitest", "junit", "nunit", "pytest", "robot", "cucumber", "postman", "ci/cd",
    "jenkins", "github actions", "gitlab"
  ];

  const normalizedTech = Array.isArray(tech)
    ? tech.map(t => t.toLowerCase())
    : [];

  const hasTechMatch = (techName) => {
    return normalizedTech.includes(techName.toLowerCase()) ||
           title.toLowerCase().includes(techName.toLowerCase());
  };

  // High-Tech Premium (+2k per tag, max +8k)
  let premiumMatches = 0;
  for (const t of premiumTech) {
    if (hasTechMatch(t)) {
      premiumMatches++;
    }
  }
  techAdjustment += Math.min(8, premiumMatches * 2);

  // Manual Testing Discount (-6k)
  let hasManualSignal = false;
  for (const t of manualTags) {
    if (hasTechMatch(t)) {
      hasManualSignal = true;
      break;
    }
  }

  let hasAutomationSignal = false;
  for (const t of automationSignals) {
    if (hasTechMatch(t)) {
      hasAutomationSignal = true;
      break;
    }
  }

  if (hasManualSignal && !hasAutomationSignal) {
    techAdjustment -= 6;
  }

  // 3. Language Requirement Adjustment (+3k / -2k)
  let langAdjustment = 0;
  if (lang === "en") {
    langAdjustment += 3;
  } else if (lang === "de-fluent") {
    langAdjustment -= 2;
  }

  // 4. Company Reputation Booster (kununuScore) (Up to +4k / -3k)
  let scoreAdjustment = 0;
  if (score !== null && score !== undefined) {
    const s = Number(score);
    if (!isNaN(s)) {
      if (s >= 4.5) {
        scoreAdjustment += 4;
      } else if (s >= 4.0) {
        scoreAdjustment += 2;
      } else if (s < 3.0) {
        scoreAdjustment -= 3;
      }
    }
  }

  const heuristic = base + techAdjustment + langAdjustment + scoreAdjustment;

  // 5. Low-Gravity Company Reported Salaries (30% weight anchoring)
  let finalEstimate = heuristic;
  if (reportedSalary !== null && reportedSalary !== undefined) {
    const repSal = Number(reportedSalary);
    if (!isNaN(repSal) && repSal > 0) {
      finalEstimate = 0.7 * heuristic + 0.3 * repSal;
    }
  }

  return Math.max(24, Math.min(115, Math.round(finalEstimate)));
}

export { BASELINE };

