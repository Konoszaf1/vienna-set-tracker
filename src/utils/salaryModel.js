/**
 * salaryModel.js — Pure salary estimation model for Vienna SDET roles.
 *
 * Built from first principles based on:
 *   - Vienna QA/SDET market baselines (Kununu, Glassdoor, kollektivvertrag)
 *   - Language requirement friction for non-German speakers
 *   - Company size/brand premium patterns
 *   - Tech stack modernity as a proxy for engineering culture maturity
 *   - Advertised salary anchoring when data is available
 *
 * The model uses additive adjustments from a baseline. Each adjustment
 * has a named reason and a euro-thousands delta. The final estimate is
 * the sum of baseline + all adjustments, clamped to a reasonable range.
 *
 * authorOverride: when a company's expected salary diverges from the
 * model for reasons the model can't capture (e.g., a specific role is
 * manager-level, or the author has inside information), an explicit
 * override with a reason is provided. The override replaces the model
 * output but the breakdown still shows what the model would have said.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base salary for a mid-level SDET in Vienna (EUR thousands, gross annual). */
const BASELINE = 63;

/** Clamp range — no estimate below floor or above ceiling. */
const FLOOR = 48;
const CEILING = 95;

// ---------------------------------------------------------------------------
// Industry premiums — reflect Vienna market pay bands by sector
// ---------------------------------------------------------------------------
const INDUSTRY_ADJUSTMENTS = {
  // High-paying sectors
  "Observability / AI Software": 12,
  "DevOps / Compliance SaaS": 8,
  "Test Automation Software": 6,
  "Banking & Finance": 6,
  "Banking & Finance / IT": 6,
  "Banking / Consumer Finance": 0,
  "Industrial Technology": 6,
  "FinTech / Crypto": 5,
  "HealthTech / MedTech": 5,
  "Sports Data & Analytics": 5,
  "Telecommunications": 4,
  "Telecommunications / IT Services": 3,
  "Safety-Critical Systems": 3,
  "Safety-Critical Communications": 3,
  "AI / SaaS / FinTech": 2,
  "FinTech / Investing": 0,

  // Mid-paying sectors
  "IT Consulting": 0,
  "IT Consulting / Software Dev": 0,
  "IT Consulting / QA Services": -2,
  "IT Services / Digital Transformation": 0,
  "Logistics / E-Commerce": 1,
  "Transport / Railway": 2,
  "Railway / IoT Technology": 1,
  "Intelligent Transportation": 0,
  "E-Commerce / Marketplace": 0,
  "Travel / Online Platform": 0,
  "Digital Security / Smart Cards": -2,
  "Security Technology": 1,
  "Electrical / Energy Tech": 1,
  "SaaS / Cloud": -2,
  "Developer Tools": -2,

  // Lower-paying sectors
  "Gaming & Betting": -1,
  "Gaming Technology": -3,
  "iGaming / Online Casino": 0,
  "Sports Betting / iGaming": 0,
  "Mobile App Development": -3,
};

// ---------------------------------------------------------------------------
// Tech stack modernity scoring
// ---------------------------------------------------------------------------

/**
 * Modern/in-demand tools signal a mature engineering culture that
 * typically pays better. Legacy tools signal the opposite.
 */
const MODERN_TECH = new Set([
  "Playwright", "TypeScript", "Cypress", "Kubernetes", "Docker",
  "CI/CD", "React", "Node.js", "Go", "Kotlin", "Jest",
  "Cucumber", "BDD", "Azure DevOps", "GitLab CI/CD",
  "Next.js", "AI/ML", "Cloud", "REST APIs",
]);

const LEGACY_TECH = new Set([
  "Tosca", "Manual Testing", "Microsoft TFS", "TFS",
  "AUTOSAR", "SOAP", "SoapUI", "SOAP UI", "Ranorex",
  "Embedded Testing", "ISTQB",
]);

function techModernityScore(techStack) {
  let modern = 0;
  let legacy = 0;
  for (const t of techStack) {
    if (MODERN_TECH.has(t)) modern++;
    if (LEGACY_TECH.has(t)) legacy++;
  }
  const total = techStack.length || 1;
  // Net modernity ratio: ranges roughly from -1 to +1
  return (modern - legacy) / total;
}

// ---------------------------------------------------------------------------
// Language requirement adjustment
// ---------------------------------------------------------------------------

/**
 * For a non-German speaker:
 *   - "en" (English-only) roles: no friction, slight premium (self-selection
 *     toward international companies that pay well)
 *   - "de-basic": minor friction, most roles manageable
 *   - "de-fluent": significant friction — either the candidate accepts
 *     a lower negotiating position, or the company is less international
 *
 * For a German speaker, these adjustments would be near zero.
 */
function langAdjustment(langReq, profile) {
  const speaksGerman = profile.germanLevel && profile.germanLevel !== "none";
  if (speaksGerman) return { delta: 0, reason: "German speaker — no language friction" };

  if (langReq === "en") {
    return { delta: 3, reason: "English-only role — international premium, no language barrier" };
  }
  if (langReq === "de-basic") {
    return { delta: 0, reason: "Basic German needed — manageable friction" };
  }
  if (langReq === "de-fluent") {
    return { delta: -3, reason: "Fluent German required — weaker negotiating position without it" };
  }
  return { delta: 0, reason: "Unknown language requirement" };
}

// ---------------------------------------------------------------------------
// Company reputation / brand premium
// ---------------------------------------------------------------------------

function reputationAdjustment(company) {
  const ratings = [company.kununuRating, company.glassdoorRating].filter(r => r != null);
  if (ratings.length === 0) return { delta: 0, reason: "No rating data available" };

  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  // Top-rated companies (4.3+) tend to attract strong candidates and pay to match
  // Low-rated companies (<3.3) may pay less or be lower-quality environments
  if (avg >= 4.5) return { delta: 4, reason: `Exceptional employer rating (${avg.toFixed(1)} avg)` };
  if (avg >= 4.0) return { delta: 2, reason: `Strong employer rating (${avg.toFixed(1)} avg)` };
  if (avg >= 3.5) return { delta: 0, reason: `Average employer rating (${avg.toFixed(1)} avg)` };
  return { delta: -2, reason: `Below-average employer rating (${avg.toFixed(1)} avg)` };
}

// ---------------------------------------------------------------------------
// Company size / brand premium
// ---------------------------------------------------------------------------

function brandPremium(company) {
  const tags = company.cultureTags || [];
  const isLargeEnterprise = tags.includes("large-enterprise");
  const isStartup = tags.includes("startup");

  // Large enterprises with international presence pay more on average
  if (isLargeEnterprise) {
    return { delta: 3, reason: "Large enterprise — structured pay bands, typically higher" };
  }
  // Small startups may pay less in cash (but more in equity/flexibility)
  if (isStartup && !tags.includes("international")) {
    return { delta: -2, reason: "Small domestic startup — typically lower base salary" };
  }
  return { delta: 0, reason: "Mid-size or international company — neutral brand factor" };
}

// ---------------------------------------------------------------------------
// Tech stack alignment with candidate CV
// ---------------------------------------------------------------------------

function techAlignmentAdjustment(company, cv) {
  if (!cv || !cv.primarySkills) return { delta: 0, reason: "No CV data — cannot assess tech alignment" };

  const allCvSkills = new Set([
    ...(cv.primarySkills || []).map(s => s.toLowerCase()),
    ...(cv.secondarySkills || []).map(s => s.toLowerCase()),
  ]);
  const companyTech = company.techStack.map(s => s.toLowerCase());

  let matches = 0;
  for (const t of companyTech) {
    if (allCvSkills.has(t)) matches++;
  }

  const ratio = companyTech.length ? matches / companyTech.length : 0;

  // Strong alignment means the candidate can negotiate harder
  if (ratio >= 0.5) return { delta: 2, reason: `Strong tech overlap (${matches}/${companyTech.length} stack match)` };
  if (ratio >= 0.3) return { delta: 1, reason: `Moderate tech overlap (${matches}/${companyTech.length} stack match)` };
  if (ratio > 0) return { delta: 0, reason: `Low tech overlap (${matches}/${companyTech.length} stack match)` };
  return { delta: -1, reason: "No tech stack overlap with CV" };
}

// ---------------------------------------------------------------------------
// Tech modernity adjustment
// ---------------------------------------------------------------------------

function techModernityAdjustment(company) {
  const score = techModernityScore(company.techStack);
  if (score >= 0.4) return { delta: 3, reason: "Modern/in-demand tech stack — higher market rates" };
  if (score >= 0.15) return { delta: 1, reason: "Mostly modern tech stack" };
  if (score <= -0.3) return { delta: -3, reason: "Legacy tech stack — lower market rates" };
  if (score < 0) return { delta: -1, reason: "Some legacy tech in stack" };
  return { delta: 0, reason: "Mixed tech stack — neutral" };
}

// ---------------------------------------------------------------------------
// Advertised salary anchoring
// ---------------------------------------------------------------------------

/**
 * Parse notes for advertised salary ranges. When a company advertises
 * a specific range, that's the strongest signal for expected salary.
 *
 * Patterns matched:
 *   "From 50k" or "from 48k" or "From 43k"
 *   "55.3k-70k" or "60.8k-77.7k"
 *   "65k+ bonus" or "65k+/85k+ senior"
 *   "~68k all-in advertised"
 *   "avg 59.7k-76.3k"
 */
function parseAdvertisedSalary(notes) {
  if (!notes) return null;

  // Match range patterns: "55.3k-70k", "60.8k-77.7k+bonus"
  const rangeMatch = notes.match(/(\d+(?:\.\d+)?)\s*k?\s*[-–]\s*(\d+(?:\.\d+)?)\s*k/i);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    // Filter out Kununu averages — they're data points, not job ads
    // Kununu patterns: "avg 45.5k", "QA avg 44.4k", "avg 59.7k-76.3k"
    const before = notes.substring(0, rangeMatch.index);
    const isKununu = /(?:kununu|avg|average|reviews)/i.test(before);
    if (!isKununu) {
      return { low, high, source: "advertised range" };
    }
  }

  // Match "~68k all-in" or "~68k advertised"
  const allInMatch = notes.match(/~\s*(\d+(?:\.\d+)?)\s*k\s*(?:all[- ]in|advertised)/i);
  if (allInMatch) {
    const val = parseFloat(allInMatch[1]);
    return { low: val, high: val, source: "advertised all-in" };
  }

  // Match "From 50k" or "From 48k" — Austrian legal minimum disclosure
  const fromMatch = notes.match(/(?:from|ab)\s+(\d+(?:\.\d+)?)\s*k/i);
  if (fromMatch) {
    const floor = parseFloat(fromMatch[1]);
    return { low: floor, high: null, source: "advertised floor" };
  }

  // Match "65k+ bonus (Senior: 85k+)"
  const seniorMatch = notes.match(/(\d+(?:\.\d+)?)\s*k\+.*(?:senior|sr)[:\s]*(\d+(?:\.\d+)?)\s*k\+/i);
  if (seniorMatch) {
    return { low: parseFloat(seniorMatch[1]), high: parseFloat(seniorMatch[2]), source: "advertised with senior band" };
  }

  return null;
}

function advertisedSalaryAdjustment(company, profile) {
  const parsed = parseAdvertisedSalary(company.notes);
  if (!parsed) return { delta: 0, reason: "No advertised salary data in notes", parsed: null };

  const roleLevel = profile.roleLevel || "mid";
  const isSenior = roleLevel.includes("senior") || roleLevel === "senior";

  if (parsed.source === "advertised range") {
    // For a mid-senior candidate, target near top of range
    const target = isSenior
      ? parsed.high
      : parsed.low + (parsed.high - parsed.low) * 0.7;
    const delta = Math.round(target - BASELINE);
    return {
      delta,
      reason: `Advertised ${parsed.low}k-${parsed.high}k — targeting ${Math.round(target)}k (${isSenior ? "senior" : "mid-senior"} positioning)`,
      parsed,
      isStrong: true,
    };
  }

  if (parsed.source === "advertised all-in") {
    const delta = Math.round(parsed.low - BASELINE);
    return {
      delta,
      reason: `Advertised ~${parsed.low}k all-in — anchoring to posted figure`,
      parsed,
      isStrong: true,
    };
  }

  if (parsed.source === "advertised floor") {
    // Austrian legal minimum disclosure is often 20-30% below actual.
    // Use a conservative 25% uplift — the floor is the legally required minimum.
    const estimated = Math.round(parsed.low * 1.25);
    const delta = estimated - BASELINE;
    return {
      delta,
      reason: `Advertised floor ${parsed.low}k — estimating ~${estimated}k for mid-senior (25% above minimum)`,
      parsed,
      isStrong: false,
    };
  }

  if (parsed.source === "advertised with senior band") {
    const target = isSenior ? parsed.high : parsed.low + (parsed.high - parsed.low) * 0.6;
    const delta = Math.round(target - BASELINE);
    return {
      delta,
      reason: `Advertised ${parsed.low}k+ (senior: ${parsed.high}k+) — targeting ${Math.round(target)}k`,
      parsed,
      isStrong: true,
    };
  }

  return { delta: 0, reason: "Unparseable advertised salary", parsed: null };
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * estimateSalary(company, profile, cv)
 *
 * Returns a structured breakdown:
 * {
 *   estimate: number,         // final salary estimate in EUR thousands
 *   baseline: number,         // starting baseline
 *   adjustments: Array<{name, delta, reason}>,
 *   total: number,            // sum of baseline + adjustments (before clamp)
 *   clamped: boolean,         // whether the result was clamped
 *   authorOverride: {value, reason} | null,
 *   isOverridden: boolean,
 * }
 */
export function estimateSalary(company, profile, cv) {
  const adjustments = [];

  // 1. Industry adjustment
  const industryDelta = INDUSTRY_ADJUSTMENTS[company.industry];
  if (industryDelta !== undefined && industryDelta !== 0) {
    adjustments.push({
      name: "Industry",
      delta: industryDelta,
      reason: `${company.industry} — ${industryDelta > 0 ? "above" : "below"}-average paying sector`,
    });
  } else if (industryDelta === 0) {
    adjustments.push({ name: "Industry", delta: 0, reason: `${company.industry} — average-paying sector` });
  } else {
    adjustments.push({ name: "Industry", delta: 0, reason: `${company.industry} — unknown sector (neutral)` });
  }

  // 2. Language requirement
  const lang = langAdjustment(company.langReq, profile);
  adjustments.push({ name: "Language", ...lang });

  // 3. Employer reputation
  const rep = reputationAdjustment(company);
  adjustments.push({ name: "Reputation", ...rep });

  // 4. Brand / company size
  const brand = brandPremium(company);
  adjustments.push({ name: "Brand/Size", ...brand });

  // 5. Tech modernity
  const techMod = techModernityAdjustment(company);
  adjustments.push({ name: "Tech Modernity", ...techMod });

  // 6. Tech alignment with CV
  const techAlign = techAlignmentAdjustment(company, cv);
  adjustments.push({ name: "Tech Alignment", ...techAlign });

  // 7. Advertised salary (can dominate if strong signal)
  const advert = advertisedSalaryAdjustment(company, profile);

  // If advertised salary is a strong signal, use it as the primary driver
  // and reduce other adjustments to secondary corrections
  let effectiveAdjustments;
  if (advert.isStrong) {
    // Strong advertised salary: use it as primary, keep lang/rep/brand as minor modifiers at 20%
    effectiveAdjustments = adjustments.map(a => ({
      ...a,
      delta: Math.round(a.delta * 0.2),
      reason: a.reason + " (reduced — advertised salary dominates)",
    }));
    effectiveAdjustments.push({
      name: "Advertised Salary",
      delta: advert.delta,
      reason: advert.reason,
    });
  } else {
    effectiveAdjustments = [...adjustments];
    if (advert.delta !== 0) {
      effectiveAdjustments.push({
        name: "Advertised Salary",
        delta: advert.delta,
        reason: advert.reason,
      });
    }
  }

  // Sum up
  const totalDelta = effectiveAdjustments.reduce((sum, a) => sum + a.delta, 0);
  const rawEstimate = BASELINE + totalDelta;
  const clamped = rawEstimate < FLOOR || rawEstimate > CEILING;
  const estimate = Math.max(FLOOR, Math.min(CEILING, Math.round(rawEstimate)));

  // Check for author override on the company record itself
  const override = company.authorOverride || null;

  return {
    estimate: override ? override.value : estimate,
    baseline: BASELINE,
    adjustments: effectiveAdjustments.filter(a => a.delta !== 0),
    allAdjustments: effectiveAdjustments,
    total: rawEstimate,
    clamped,
    authorOverride: override,
    isOverridden: !!override,
  };
}

// ---------------------------------------------------------------------------
// Job-level salary estimation (seniority modifier on top of company estimate)
// ---------------------------------------------------------------------------

const SENIOR_PATTERN = /\b(senior|sr\.?|lead|staff|principal|head\s+of)\b/i;
const JUNIOR_PATTERN = /\b(junior|jr\.?|trainee|intern|praktikum)\b/i;

/**
 * estimateJobSalary(company, job, profile, cv)
 *
 * Wraps estimateSalary with a seniority modifier derived from the job title.
 * Returns the same shape as estimateSalary, with an additional Seniority
 * adjustment when applicable.
 */
export function estimateJobSalary(company, job, profile, cv) {
  const base = estimateSalary(company, profile, cv);
  const title = job.title || "";

  let seniorityDelta = 0;
  let seniorityReason = "";

  if (SENIOR_PATTERN.test(title)) {
    seniorityDelta = 8;
    seniorityReason = "Senior-level title — seniority premium";
  } else if (JUNIOR_PATTERN.test(title)) {
    seniorityDelta = -15;
    seniorityReason = "Junior-level title — junior seniority adjustment";
  }

  if (seniorityDelta === 0) return base;

  const adjusted = Math.max(FLOOR, Math.min(CEILING, base.estimate + seniorityDelta));
  const entry = { name: "Seniority", delta: seniorityDelta, reason: seniorityReason };
  return {
    ...base,
    estimate: adjusted,
    adjustments: [...base.adjustments, entry],
    allAdjustments: [...base.allAdjustments, entry],
  };
}

// Export for use elsewhere
export { BASELINE, FLOOR, CEILING, parseAdvertisedSalary };
