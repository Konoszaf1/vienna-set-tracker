// @ts-check
/** @typedef {import('../domain/schema.js').ScrapedJob} ScrapedJob */

import { useState, useEffect } from "react";

/**
 * Fetches the scraped job feed from jobs.json.
 * Returns { jobs, loading, fetchError, retry }.
 */
export default function useJobFeed() {
  /** @type {[ScrapedJob[], Function]} */
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(/** @type {string|null} */ (null));

  function doFetch() {
    const h = Math.floor(Date.now() / 3600000);
    return fetch(import.meta.env.BASE_URL + `jobs.json?h=${h}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (d?.jobs) setJobs(d.jobs);
      })
      .catch(e => setFetchError(e.message || "Failed to load jobs"))
      .finally(() => setLoading(false));
  }

  function retry() {
    setLoading(true);
    setFetchError(null);
    doFetch();
  }

  useEffect(() => { doFetch(); }, []);

  return { jobs, loading, fetchError, retry };
}
