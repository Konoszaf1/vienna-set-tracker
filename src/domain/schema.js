// @ts-check

/**
 * schema.js — Canonical type definitions for the Vienna SET/SDET Tracker.
 *
 * This file is the single source of truth for data shapes flowing through
 * the app. Import types in consuming files with:
 *
 *   @typedef {import('../domain/schema.js').ScrapedJob} ScrapedJob
 *
 * No runtime code — only JSDoc @typedef declarations.
 */

// ---------------------------------------------------------------------------
// Scraped data layer (produced by scripts/, stored in public/jobs.json)
// ---------------------------------------------------------------------------

/**
 * A single job listing as emitted by the scraper pipeline.
 * Fields after `lng` are optional — karriere.at detail-page extraction
 * produces them, but JobSpy and kununu entries may omit them.
 *
 * @typedef {object} ScrapedJob
 * @property {string}   url        - Canonical listing URL
 * @property {string}   title      - Job title
 * @property {string}   company    - Company name (display form)
 * @property {string}   source     - Origin: "karriere", "kununu", "jobspy-linkedin", etc.
 * @property {string}   [address]  - Street address when available
 * @property {string}   [city]     - City name (usually "Wien")
 * @property {string}   [zip]      - Postal code
 * @property {number}   [lat]      - Latitude (WGS84)
 * @property {number}   [lng]      - Longitude (WGS84)
 * @property {string[]} [techStack] - Extracted tech keywords (karriere.at only)
 * @property {string}   [langReq]  - Language requirement: "en" | "de-basic" | "de-fluent"
 * @property {number}   [kununuScore] - Kununu employer rating (1-5)
 */

// ---------------------------------------------------------------------------
// Curated overlay layer (hand-maintained in public/company-overlay.json)
// ---------------------------------------------------------------------------

/**
 * Optional per-company overlay supplying fields that scrapers cannot
 * reliably produce. Keyed by normalised company name (lowercase, trimmed).
 *
 * @typedef {object} CompanyOverlay
 * @property {string}   [industry]     - Sector label matching INDUSTRY_ADJUSTMENTS keys
 * @property {string[]} [cultureTags]  - Tags from CULTURE_OPTIONS (e.g. "startup", "hybrid")
 * @property {string}   [notes]        - Free text; may contain advertised salary patterns
 * @property {{ value: number, reason: string }} [authorOverride] - Manual salary override
 */

// ---------------------------------------------------------------------------
// Enriched company (projected in App.jsx from scraped + overlay data)
// ---------------------------------------------------------------------------

/**
 * A company entry as consumed by models and components. Built by grouping
 * ScrapedJobs by company name and merging any CompanyOverlay fields.
 *
 * @typedef {object} EnrichedCompany
 * @property {string}        id             - Stable ID: "co-<normalised-name>"
 * @property {string}        name           - Display company name
 * @property {string}        logo           - Emoji placeholder
 * @property {string}        district       - City or district label
 * @property {string}        address        - Street address (may be "")
 * @property {number|null}   lat            - Office latitude
 * @property {number|null}   lng            - Office longitude
 * @property {number|null}   kununuRating   - Kununu score (1-5) or null
 * @property {number|null}   glassdoorRating - Glassdoor score or null (reserved)
 * @property {string[]}      cultureTags    - Culture/workstyle tags (from overlay)
 * @property {string[]}      techStack      - Union of techStack across all roles
 * @property {string[]}      languages      - Spoken languages (display only)
 * @property {string}        notes          - Free text (from overlay)
 * @property {string}        jobUrl         - Primary listing URL
 * @property {string}        industry       - Sector label (from overlay, "" if absent)
 * @property {string}        langReq        - Most accessible langReq across roles
 * @property {ScrapedJob[]}  openRoles      - All scraped jobs for this company
 * @property {string|null}   firstSeen      - ISO timestamp of earliest sighting
 * @property {{ value: number, reason: string }} [authorOverride] - Salary override
 */

// ---------------------------------------------------------------------------
// User profile & CV
// ---------------------------------------------------------------------------

/**
 * @typedef {object} HomeLocation
 * @property {number} lat     - Latitude
 * @property {number} lng     - Longitude
 * @property {string} address - Display address
 * @property {string} [label] - Optional label (e.g. "Home")
 */

/**
 * User profile configurable via SettingsModal.
 *
 * @typedef {object} Profile
 * @property {HomeLocation} home
 * @property {string}   germanLevel         - "none" | "basic" | "conversational" | "fluent"
 * @property {string}   [englishLevel]      - "fluent" etc.
 * @property {string}   roleLevel           - "junior" | "mid" | "mid-senior" | "senior" | "staff"
 * @property {string}   [targetRole]        - e.g. "SDET"
 * @property {number}   salaryFloor         - Minimum acceptable salary (€k)
 * @property {number}   salaryTarget        - Target salary (€k)
 * @property {number}   salaryStretch       - Stretch/aspirational salary (€k)
 * @property {number}   yearsExperience
 * @property {string[]} [preferredWorkStyle] - Tags from CULTURE_OPTIONS
 * @property {boolean}  [willingToCommute]
 * @property {number}   [maxCommuteKm]
 */

/**
 * Candidate CV data used by match and salary models.
 *
 * @typedef {object} CV
 * @property {string[]} primarySkills    - Core competencies
 * @property {string[]} secondarySkills  - Supporting skills
 * @property {string[]} [domainExperience] - Industry domains worked in
 * @property {string[]} [certifications]
 * @property {string}   [education]      - e.g. "bachelors", "masters"
 * @property {Record<string, string>} [languages] - Language proficiency map
 */

// ---------------------------------------------------------------------------
// Model outputs
// ---------------------------------------------------------------------------

/**
 * A single named adjustment in the salary breakdown.
 *
 * @typedef {object} SalaryAdjustment
 * @property {string} name   - Label (e.g. "Industry", "Language", "Seniority")
 * @property {number} delta  - EUR-thousands adjustment from baseline
 * @property {string} reason - Human-readable explanation
 */

/**
 * Return value of estimateSalary / estimateJobSalary.
 *
 * @typedef {object} SalaryEstimate
 * @property {number}             estimate        - Final salary estimate (€k)
 * @property {number}             baseline        - Starting baseline (€k)
 * @property {SalaryAdjustment[]} allAdjustments  - Adjustments that had data to operate on
 * @property {number}             dataPoints      - Count of adjustments with real data
 * @property {boolean}            clamped         - Whether result was clamped to range
 * @property {{ value: number, reason: string }|null} authorOverride
 * @property {boolean}            isOverridden    - Whether authorOverride is active
 */

/**
 * A single factor in the match score breakdown.
 *
 * @typedef {object} MatchFactor
 * @property {string}      name     - Factor label
 * @property {number}      score    - 0-100 factor score
 * @property {number}      weight   - Weight out of 100
 * @property {number}      weighted - Weighted contribution to total
 * @property {string}      reason   - Human-readable explanation
 * @property {object|null}  [details] - Optional extra data (e.g. matched techs)
 * @property {boolean}      hasData  - Whether this factor had real data (false = neutral placeholder)
 */

/**
 * Return value of matchScore.
 *
 * @typedef {object} MatchResult
 * @property {number}        score         - 0-100 overall match
 * @property {string}        grade         - "Excellent" | "Good" | "Fair" | "Weak"
 * @property {MatchFactor[]} factors       - Individual factor breakdowns
 * @property {string[]}      topStrengths  - Top positive factors
 * @property {string[]}      topConcerns   - Top negative factors
 */

/**
 * Pre-computed insights for a single company, keyed by company ID.
 *
 * @typedef {object} CompanyInsights
 * @property {SalaryEstimate|null}   salary - Best-role salary estimate
 * @property {MatchResult|null}      match  - Match score for best role
 * @property {SalaryEstimate[]|null} roles  - Per-role salary estimates
 */

// ---------------------------------------------------------------------------
// Filter/sort pipeline
// ---------------------------------------------------------------------------

/**
 * Parameters for the filterAndSort function.
 *
 * @typedef {object} FilterSortOptions
 * @property {EnrichedCompany[]} companies
 * @property {Record<string, CompanyInsights>} companyInsights
 * @property {string}      search        - Free-text search query
 * @property {string}      filterLang    - "all" | "accessible" | "de-fluent"
 * @property {string}      filterCulture - "all" | culture tag
 * @property {string}      sortBy        - "name" | "newest" | "salary" | "match" | "rating"
 * @property {number|null} salaryMin     - Min salary filter (€k) or null
 * @property {number|null} salaryMax     - Max salary filter (€k) or null
 */

// Force module scope so imports work
export {};
