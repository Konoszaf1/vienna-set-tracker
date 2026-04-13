// @ts-check
/** @typedef {import('../domain/schema.js').ScrapedJob} ScrapedJob */

import { useMemo, useEffect } from "react";

const STORAGE_KEY = "sdet-first-seen";

/**
 * Tracks when each job URL was first seen (persisted in localStorage).
 * Pure derivation in useMemo; side-effect write in useEffect.
 *
 * @param {ScrapedJob[]} jobs
 * @returns {Record<string, string>} Map of job URL → ISO timestamp
 */
export default function useFirstSeen(jobs) {
  const firstSeenMap = useMemo(() => {
    if (jobs.length === 0) return {};
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}
    const now = new Date().toISOString();
    const map = {};
    for (const j of jobs) {
      map[j.url] = stored[j.url] || now;
    }
    return map;
  }, [jobs]);

  useEffect(() => {
    if (jobs.length === 0) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(firstSeenMap)); } catch {}
  }, [jobs, firstSeenMap]);

  return firstSeenMap;
}
