// @ts-check
/** @typedef {import('../domain/schema.js').EnrichedCompany} EnrichedCompany */
/** @typedef {import('../domain/schema.js').Profile} Profile */
/** @typedef {import('../domain/schema.js').CV} CV */
/** @typedef {import('../domain/schema.js').MatchResult} MatchResult */

/**
 * matchModel.js — Pure company-candidate match scoring for Vienna SDET roles.
 *
 * Produces a 0-100 score reflecting how well a company matches a candidate's
 * profile and CV. Higher = better fit.
 *
 * Factors (weighted):
 *   - Tech stack overlap (35%)
 *   - Language accessibility (25%)
 *   - Culture/workstyle fit (20%)
 *   - Employer reputation (10%)
 *   - Salary alignment (10%)
 */

// ---------------------------------------------------------------------------
// Weight configuration
// ---------------------------------------------------------------------------

const WEIGHTS = {
  techOverlap: 35,
  languageAccess: 25,
  cultureFit: 20,
  reputation: 10,
  salaryFit: 10,
};

// ---------------------------------------------------------------------------
// Factor scoring functions (each returns 0-100 within its domain)
// ---------------------------------------------------------------------------

/**
 * Tech stack overlap: what fraction of the company's required tech
 * does the candidate know?
 */
function scoreTechOverlap(company, cv) {
  if (!cv || !cv.primarySkills) {
    return { score: 50, reason: "No CV data — assuming average overlap", details: null, hasData: false };
  }

  const primary = new Set((cv.primarySkills || []).map(s => s.toLowerCase()));
  const secondary = new Set((cv.secondarySkills || []).map(s => s.toLowerCase()));
  const companyTech = company.techStack.map(s => s.toLowerCase());

  if (companyTech.length === 0) {
    return { score: 50, reason: "No tech stack listed", details: null, hasData: false };
  }

  let primaryHits = 0;
  let secondaryHits = 0;
  const matched = [];
  const unmatched = [];

  for (const t of companyTech) {
    if (primary.has(t)) {
      primaryHits++;
      matched.push(t);
    } else if (secondary.has(t)) {
      secondaryHits++;
      matched.push(t);
    } else {
      unmatched.push(t);
    }
  }

  // Primary skills count fully, secondary at 60%
  const weightedHits = primaryHits + secondaryHits * 0.6;
  const ratio = weightedHits / companyTech.length;

  // Scale: 0% overlap = 10, 50% = 60, 100% = 100
  const score = Math.round(10 + ratio * 90);

  return {
    score,
    reason: `${matched.length}/${companyTech.length} tech match (${primaryHits} primary, ${secondaryHits} secondary)`,
    details: { matched, unmatched, primaryHits, secondaryHits },
    hasData: true,
  };
}

/**
 * Language accessibility: can the candidate work at this company
 * given the language requirement?
 */
function scoreLanguageAccess(company, profile) {
  const speaksGerman = profile.germanLevel && profile.germanLevel !== "none";
  const germanFluent = profile.germanLevel === "fluent";

  if (company.langReq === "en") {
    return { score: 100, reason: "English-only — fully accessible", hasData: true };
  }
  if (company.langReq === "de-basic") {
    if (germanFluent) return { score: 100, reason: "Basic German needed — fluent speaker", hasData: true };
    if (speaksGerman) return { score: 85, reason: "Basic German needed — some German skills", hasData: true };
    return { score: 55, reason: "Basic German needed — no German skills, but manageable", hasData: true };
  }
  if (company.langReq === "de-fluent") {
    if (germanFluent) return { score: 100, reason: "Fluent German required — speaker", hasData: true };
    if (speaksGerman) return { score: 40, reason: "Fluent German required — only basic German", hasData: true };
    return { score: 15, reason: "Fluent German required — no German skills, significant barrier", hasData: true };
  }
  return { score: 50, reason: "Unknown language requirement", hasData: false };
}

/**
 * Culture / workstyle fit: does the company's culture match
 * the candidate's preferences?
 */
function scoreCultureFit(company, profile) {
  const preferred = new Set(profile.preferredWorkStyle || []);
  const tags = company.cultureTags || [];

  if (preferred.size === 0 || tags.length === 0) {
    return { score: 50, reason: "No preference data — neutral", hasData: false };
  }

  let matches = 0;
  const matchedTags = [];
  for (const tag of tags) {
    if (preferred.has(tag)) {
      matches++;
      matchedTags.push(tag);
    }
  }

  // Bonus for workstyle alignment
  const ratio = matches / preferred.size;
  const score = Math.round(30 + ratio * 70);

  if (matchedTags.length > 0) {
    return { score, reason: `Matches: ${matchedTags.join(", ")}`, details: matchedTags, hasData: true };
  }
  return { score: 30, reason: "No culture tag overlap with preferences", hasData: true };
}

/**
 * Employer reputation: average of available ratings.
 */
function scoreReputation(company) {
  const ratings = [company.kununuRating, company.glassdoorRating].filter(r => r != null);
  if (ratings.length === 0) {
    return { score: 50, reason: "No ratings available", hasData: false };
  }

  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  // Scale: 1.0 = 0, 3.0 = 40, 4.0 = 70, 5.0 = 100
  const score = Math.round(Math.min(100, Math.max(0, (avg - 1) * 25)));

  return {
    score,
    reason: `${avg.toFixed(1)} average rating (${ratings.length} source${ratings.length > 1 ? "s" : ""})`,
    hasData: true,
  };
}

/**
 * Salary alignment: does the estimated salary match the candidate's
 * target range?
 */
function scoreSalaryFit(estimatedSalary, profile) {
  const target = profile.salaryTarget || 70;
  const floor = profile.salaryFloor || 55;

  if (estimatedSalary >= target) {
    return { score: 100, reason: `${estimatedSalary}k meets or exceeds ${target}k target`, hasData: true };
  }
  if (estimatedSalary >= floor) {
    // Linear scale from floor to target
    const ratio = (estimatedSalary - floor) / (target - floor);
    const score = Math.round(50 + ratio * 50);
    return { score, reason: `${estimatedSalary}k between floor (${floor}k) and target (${target}k)`, hasData: true };
  }
  // Below floor
  const shortfall = floor - estimatedSalary;
  const score = Math.max(0, Math.round(50 - shortfall * 5));
  return { score, reason: `${estimatedSalary}k below floor of ${floor}k`, hasData: true };
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * @param {EnrichedCompany} company
 * @param {CV} cv
 * @param {Profile} profile
 * @param {number} estimatedSalary
 * @returns {MatchResult}
 */
export function matchScore(company, cv, profile, estimatedSalary) {
  profile = profile || {};
  cv = cv || {};

  const factors = [];

  // 1. Tech overlap
  const tech = scoreTechOverlap(company, cv);
  factors.push({
    name: "Tech Overlap",
    score: tech.score,
    weight: WEIGHTS.techOverlap,
    weighted: Math.round(tech.score * WEIGHTS.techOverlap / 100),
    reason: tech.reason,
    details: tech.details,
    hasData: tech.hasData,
  });

  // 2. Language accessibility
  const lang = scoreLanguageAccess(company, profile);
  factors.push({
    name: "Language",
    score: lang.score,
    weight: WEIGHTS.languageAccess,
    weighted: Math.round(lang.score * WEIGHTS.languageAccess / 100),
    reason: lang.reason,
    hasData: lang.hasData,
  });

  // 3. Culture fit
  const culture = scoreCultureFit(company, profile);
  factors.push({
    name: "Culture Fit",
    score: culture.score,
    weight: WEIGHTS.cultureFit,
    weighted: Math.round(culture.score * WEIGHTS.cultureFit / 100),
    reason: culture.reason,
    hasData: culture.hasData,
  });

  // 4. Reputation
  const rep = scoreReputation(company);
  factors.push({
    name: "Reputation",
    score: rep.score,
    weight: WEIGHTS.reputation,
    weighted: Math.round(rep.score * WEIGHTS.reputation / 100),
    reason: rep.reason,
    hasData: rep.hasData,
  });

  // 5. Salary fit
  const sal = scoreSalaryFit(estimatedSalary || 60, profile);
  factors.push({
    name: "Salary Fit",
    score: sal.score,
    weight: WEIGHTS.salaryFit,
    weighted: Math.round(sal.score * WEIGHTS.salaryFit / 100),
    reason: sal.reason,
    hasData: sal.hasData,
  });

  // Overall weighted score
  const totalScore = factors.reduce((sum, f) => sum + f.weighted, 0);

  // Grade
  let grade;
  if (totalScore >= 80) grade = "Excellent";
  else if (totalScore >= 60) grade = "Good";
  else if (totalScore >= 40) grade = "Fair";
  else grade = "Weak";

  // Strengths and concerns
  const sorted = [...factors].sort((a, b) => b.score - a.score);
  const topStrengths = sorted
    .filter(f => f.score >= 70)
    .slice(0, 2)
    .map(f => f.reason);
  const topConcerns = sorted
    .filter(f => f.score < 50)
    .slice(-2)
    .reverse()
    .map(f => f.reason);

  return {
    score: totalScore,
    grade,
    factors,
    topStrengths,
    topConcerns,
  };
}

export { WEIGHTS };
