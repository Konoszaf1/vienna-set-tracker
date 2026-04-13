// @ts-check
/** @typedef {import('../domain/schema.js').ScrapedJob} ScrapedJob */
/** @typedef {import('../domain/schema.js').EnrichedCompany} EnrichedCompany */
/** @typedef {import('../domain/schema.js').Profile} Profile */
/** @typedef {import('../domain/schema.js').CV} CV */

import { useMemo } from "react";
import { estimateJobSalary } from "../utils/salaryModel";
import { matchScore } from "../utils/matchModel";

/**
 * Groups scraped jobs into enriched company entries and computes
 * salary/match insights for each company.
 *
 * @param {ScrapedJob[]} jobs
 * @param {Record<string, string>} firstSeenMap
 * @param {Profile} profile
 * @param {CV} cv
 */
export default function useCompanies(jobs, firstSeenMap, profile, cv) {
  /** @type {EnrichedCompany[]} */
  const entries = useMemo(() => {
    const groups = {};
    for (const j of jobs) {
      const key = j.company.toLowerCase().trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(j);
    }

    return Object.entries(groups).map(([key, roles]) => {
      const first = roles[0];
      const roleDates = roles.map(r => firstSeenMap[r.url]).filter(Boolean);
      const firstSeen = roleDates.length > 0
        ? roleDates.reduce((a, b) => a < b ? a : b)
        : null;
      const techStack = [...new Set(roles.flatMap(r => r.techStack || []))];
      const roleLangs = roles.map(r => r.langReq).filter(Boolean);
      let langReq = "de-basic";
      if (roleLangs.includes("en")) langReq = "en";
      else if (roleLangs.includes("de-basic")) langReq = "de-basic";
      else if (roleLangs.includes("de-fluent")) langReq = "de-fluent";

      return {
        id: `co-${key.replace(/\s+/g, "-")}`,
        name: first.company,
        logo: "\u{1F3E2}",
        district: first.city || "Wien",
        address: first.address || "",
        lat: first.lat ?? null,
        lng: first.lng ?? null,
        kununuRating: roles.find(r => r.kununuScore)?.kununuScore || null,
        glassdoorRating: null,
        cultureTags: [],
        techStack,
        languages: ["English"],
        notes: "",
        jobUrl: first.url,
        industry: "",
        langReq,
        openRoles: roles,
        firstSeen,
      };
    });
  }, [jobs, firstSeenMap]);

  const companyInsights = useMemo(() => {
    const map = {};
    for (const c of entries) {
      const roles = c.openRoles?.map(role => estimateJobSalary(c, role, profile, cv)) || null;
      if (roles && roles.length > 0) {
        const best = roles.reduce((a, b) => a.estimate > b.estimate ? a : b);
        map[c.id] = { salary: best, match: matchScore(c, cv, profile, best.estimate), roles };
      } else {
        map[c.id] = { salary: null, match: null, roles: null };
      }
    }
    return map;
  }, [entries, profile, cv]);

  return { entries, companyInsights };
}
