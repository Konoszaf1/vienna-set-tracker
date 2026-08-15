import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PROFILE_STORAGE_KEY } from "./constants";
import { filterAndSort } from "./utils/filterSort";
import defaultProfileData from "./data/defaultProfile.json";
import { estimateSalaryRange } from "./utils/salaryEstimate";
import { normalizeCompanyName } from "./utils/normalizeCompany";
import { resolveCompanyLocation } from "./utils/companyLocation";
import { deriveJobCompany, isRemoteRole } from "./utils/jobCompany";
import { feedHealth as deriveFeedHealth } from "./utils/feedHealth";
import { canonicalizeTechStack } from "./utils/normalizeTech";
import { listingDate } from "./utils/listingRecency";
import CompanyCard from "./components/CompanyCard";
import MapView from "./components/MapView";
import AnalyticsView from "./components/AnalyticsView";
import SettingsModal from "./components/SettingsModal";
import styles from './App.module.css';

const VALID_VIEWS = new Set(["grid", "map", "analytics"]);
const VALID_LANG_FILTERS = new Set(["all", "accessible", "de-fluent", "unknown"]);
const VALID_SORTS = new Set(["name", "newest", "salary", "rating"]);
const VALID_RECENCY = new Set(["all", "1", "3", "7", "14", "30", "unknown"]);

function queryParam(name, fallback, validValues) {
  const value = new URLSearchParams(window.location.search).get(name);
  return value && (!validValues || validValues.has(value)) ? value : fallback;
}

function numericQueryParam(name) {
  const raw = new URLSearchParams(window.location.search).get(name);
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function locationLabel(...values) {
  const text = values.filter(Boolean).join(" ");
  const postcode = text.match(/\b(1\d{3})\b/)?.[1];
  if (postcode) {
    const district = (Number(postcode) - 1000) / 10;
    if (Number.isInteger(district) && district >= 1 && district <= 23) return `${district}. Bezirk`;
  }
  if (/\b(?:wien|vienna)\b/i.test(text)) return "Wien (district unknown)";
  return values.find(Boolean) || "Unknown";
}

export default function App() {
  const [view, setView] = useState(() => queryParam("view", "grid", VALID_VIEWS));
  const [search, setSearch] = useState(() => queryParam("q", ""));
  const [filterLang, setFilterLang] = useState(() => queryParam("lang", "all", VALID_LANG_FILTERS));
  const [sortBy, setSortBy] = useState(() => queryParam("sort", "name", VALID_SORTS));
  const [salaryMin, setSalaryMin] = useState(() => numericQueryParam("min"));
  const [salaryMax, setSalaryMax] = useState(() => numericQueryParam("max"));
  const [recency, setRecency] = useState(() => queryParam("age", "all", VALID_RECENCY));
  const [jobs, setJobs] = useState([]);
  const [jobsMeta, setJobsMeta] = useState({});
  const [jobHistory, setJobHistory] = useState({ snapshots: [] });
  const [locationsCache, setLocationsCache] = useState({});
  const [locationOverrides, setLocationOverrides] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [dataWarnings, setDataWarnings] = useState([]);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const fetchControllerRef = useRef(null);

  const [profile, setProfile] = useState(() => {
    try {
      const s = localStorage.getItem(PROFILE_STORAGE_KEY);
      return s ? JSON.parse(s) : defaultProfileData;
    } catch { return defaultProfileData; }
  });

  const doFetch = useCallback(async (externalSignal) => {
    const h = Math.floor(Date.now() / 3600000);
    const signal = typeof AbortSignal.any === "function"
      ? AbortSignal.any([externalSignal, AbortSignal.timeout(15000)].filter(Boolean))
      : externalSignal;
    const fetchJson = async (path, fallback) => {
      try {
        const response = await fetch(import.meta.env.BASE_URL + path, { signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { value: await response.json(), warning: null };
      } catch (error) {
        if (error.name === "AbortError" && externalSignal?.aborted) throw error;
        return { value: fallback, warning: `${path.split("?")[0]} unavailable` };
      }
    };

    try {
      const response = await fetch(import.meta.env.BASE_URL + `jobs.json?h=${h}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const jobsData = await response.json();
      if (!Array.isArray(jobsData?.jobs)) throw new Error("Malformed jobs.json: jobs must be an array");

      setJobs(jobsData.jobs);
      setJobsMeta({
        lastUpdated: jobsData.lastUpdated || null,
        lastVerified: jobsData.lastVerified || null,
        lastFullySuccessfulAt: jobsData.lastFullySuccessfulAt || null,
        partial: Boolean(jobsData.partial),
        sourceHealth: jobsData.sourceHealth || {},
      });
      setFetchError(null);
      setLoading(false);
      setLastLoadedAt(new Date().toISOString());

      const [history, cache, manual] = await Promise.all([
        fetchJson(`job-history.json?h=${h}`, { snapshots: [] }),
        fetchJson(`company-locations.json?h=${h}`, {}),
        fetchJson(`company-locations-manual.json?h=${h}`, {}),
      ]);
      setJobHistory(history.value || { snapshots: [] });
      setLocationsCache(cache.value || {});
      setLocationOverrides(manual.value || {});
      setDataWarnings([history.warning, cache.warning, manual.warning].filter(Boolean));
    } catch (error) {
      if (error.name === "AbortError" && externalSignal?.aborted) return;
      setFetchError(error.message || "Failed to load jobs");
      setLoading(false);
    }
  }, []);

  const runFetch = useCallback(() => {
    fetchControllerRef.current?.abort();
    fetchControllerRef.current = new AbortController();
    return doFetch(fetchControllerRef.current.signal);
  }, [doFetch]);

  function handleRetry() {
    setLoading(true);
    setFetchError(null);
    runFetch();
  }

  useEffect(() => {
    runFetch();
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      runFetch();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      fetchControllerRef.current?.abort();
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [runFetch]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (view !== "grid") params.set("view", view);
    if (search) params.set("q", search);
    if (filterLang !== "all") params.set("lang", filterLang);
    if (sortBy !== "name") params.set("sort", sortBy);
    if (salaryMin != null) params.set("min", String(salaryMin));
    if (salaryMax != null) params.set("max", String(salaryMax));
    if (recency !== "all") params.set("age", recency);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [view, search, filterLang, sortBy, salaryMin, salaryMax, recency]);

  // Prefer feed-owned lifecycle dates; retain a bounded browser fallback for
  // legacy feeds so temporarily missing jobs do not become "new" on return.
  const firstSeenMap = useMemo(() => {
    if (jobs.length === 0) return {};
    const STORAGE_KEY = "sdet-first-seen";
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}
    const now = new Date().toISOString();
    const map = { ...stored };
    for (const j of jobs) {
      map[j.url] = j.firstSeenAt || stored[j.url] || now;
    }
    return Object.fromEntries(
      Object.entries(map)
        .sort(([, a], [, b]) => String(b).localeCompare(String(a)))
        .slice(0, 2000)
    );
  }, [jobs]);

  useEffect(() => {
    if (jobs.length === 0) return;
    try { localStorage.setItem("sdet-first-seen", JSON.stringify(firstSeenMap)); } catch {}
  }, [jobs, firstSeenMap]);

  const listingDateMap = useMemo(() => Object.fromEntries(
    jobs
      .map(job => [job.url, listingDate(job).timestamp])
      .filter(([, timestamp]) => Boolean(timestamp))
  ), [jobs]);

  // Group jobs by normalized company name (collapses ÖBB / ÖBB-Konzern etc.)
  const entries = useMemo(() => {
    const groups = {};
    for (const j of jobs) {
      const role = {
        ...j,
        company: deriveJobCompany(j),
        sourceCompany: j.company,
        firstSeenAt: j.firstSeenAt || firstSeenMap[j.url] || null,
      };
      const key = normalizeCompanyName(role.company);
      if (!groups[key]) groups[key] = [];
      groups[key].push(role);
    }

    return Object.entries(groups).map(([key, roles]) => {
      // Display the longest original company name (usually the most informative)
      const displayName = roles.reduce((a, b) => b.company.length > a.length ? b.company : a, roles[0].company);
      const first = roles[0];
      const roleDates = roles.map(r => listingDate(r).timestamp).filter(Boolean);
      const firstSeen = roleDates.length > 0
        ? roleDates.reduce((a, b) => a > b ? a : b)
        : null;
      const techStack = canonicalizeTechStack(roles.flatMap(r => r.techStack || []));
      const remoteOnly = roles.length > 0 && roles.every(isRemoteRole);

      // Pick the most common langReq across roles.
      // Ties break toward more restrictive: de-fluent > de-basic > en.
      const langCounts = {};
      for (const r of roles) {
        const l = r.langReq || "unknown";
        langCounts[l] = (langCounts[l] || 0) + 1;
      }
      const langOrder = ["de-fluent", "de-basic", "en", "unknown"];
      const langReq = langOrder.reduce((best, l) => {
        if ((langCounts[l] || 0) > (langCounts[best] || 0)) return l;
        if ((langCounts[l] || 0) === (langCounts[best] || 0) && langOrder.indexOf(l) < langOrder.indexOf(best)) return l;
        return best;
      }, "unknown");

      const resolved = resolveCompanyLocation(roles, locationsCache, locationOverrides);

      return {
        id: `co-${key.replace(/\s+/g, "-")}`,
        name: displayName,
        logo: "\u{1F3E2}",
        district: locationLabel(resolved.address, first.zip, first.address, first.city),
        address: resolved.address || first.address || "",
        lat: resolved.lat,
        lng: resolved.lng,
        locationSource: resolved.source,
        kununuRating: roles.find(r => r.kununuScore)?.kununuScore || null,
        techStack,
        jobUrl: first.url,
        langReq,
        openRoles: roles,
        firstSeen,
        remoteOnly,
      };
    });
  }, [jobs, firstSeenMap, locationsCache, locationOverrides]);

  // Evidence-ranked salary range per role; company summary uses the role with
  // the highest market target while retaining the full range and provenance.
  const salaryMap = useMemo(() => {
    const map = {};
    for (const c of entries) {
      const estimates = (c.openRoles || []).map(r => {
        const range = estimateSalaryRange(r);
        return { id: r.id, url: r.url, title: r.title, ...range, estimate: range.target };
      });
      const bestRange = estimates.length > 0
        ? estimates.reduce((a, b) => a.target > b.target ? a : b)
        : null;
      map[c.id] = { best: bestRange?.target ?? null, bestRange, roles: estimates };
    }
    return map;
  }, [entries]);

  const handleSaveProfile = useCallback((newProfile) => {
    setProfile(newProfile);
    try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile)); } catch {}
    const salaryFloor = Number(newProfile.salaryFloor);
    setSalaryMin(salaryFloor > 0 ? salaryFloor : null);
    setFilterLang(newProfile.germanLevel === "fluent" ? "all" : "accessible");
  }, []);

  const filtered = useMemo(() => {
    return filterAndSort({ companies: entries, salaryMap, search, filterLang, sortBy, salaryMin, salaryMax, recency });
  }, [entries, salaryMap, search, filterLang, sortBy, salaryMin, salaryMax, recency]);

  const displaySalaryMap = useMemo(() => {
    const map = {};
    for (const company of filtered) {
      const original = salaryMap[company.id]?.roles || [];
      const roles = company.openRoles.map(role => {
        const existing = original.find(item => (role.id && item.id === role.id) || item.url === role.url);
        if (existing) return existing;
        const range = estimateSalaryRange(role);
        return { id: role.id, url: role.url, title: role.title, ...range, estimate: range.target };
      });
      const bestRange = roles.length ? roles.reduce((a, b) => a.target > b.target ? a : b) : null;
      map[company.id] = {
        roles,
        best: bestRange?.target ?? null,
        bestRange,
      };
    }
    return map;
  }, [filtered, salaryMap]);

  const health = useMemo(() => deriveFeedHealth(jobsMeta), [jobsMeta]);
  const mappedCompanies = useMemo(
    () => filtered.map(company => ({ ...company, feedStatus: health.status })),
    [filtered, health.status]
  );
  const matchingRoleCount = filtered.reduce((total, company) => total + company.openRoles.length, 0);
  const hasActiveFilters = Boolean(search || filterLang !== "all" || salaryMin != null || salaryMax != null || recency !== "all");

  const resetFilters = () => {
    setSearch("");
    setFilterLang("all");
    setSalaryMin(null);
    setSalaryMax(null);
    setRecency("all");
  };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingText}>Loading dashboard...</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className={styles.loadingScreen} data-testid="error-screen">
        <div className={styles.loadingText}>Failed to load job data</div>
        <p style={{ color: '#a1a1aa', marginTop: 8 }}>{fetchError}</p>
        <button onClick={handleRetry} className={styles.settingsButton} style={{ marginTop: 16 }} data-testid="retry-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <div className={styles.headerSection}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.heading}>Vienna SET/SDET Tracker</h1>
              <p className={styles.subheading}>
                {hasActiveFilters
                  ? `${filtered.length} matching companies · ${matchingRoleCount} matching roles`
                  : `${entries.length} companies · ${jobs.length} open roles`}
              </p>
            </div>
            <div className={styles.headerActions}>
              <button onClick={runFetch} className={styles.settingsButton} data-testid="refresh-btn">Refresh</button>
              <button onClick={() => setSettingsOpen(true)} className={styles.settingsButton} data-testid="settings-btn">Settings</button>
            </div>
          </div>
        </div>

        <div className={styles.freshness} data-status={health.status} role="status" data-testid="feed-freshness">
          <span className={styles.freshnessTitle}>
            {health.stale
              ? "Feed is stale"
              : health.partial
                ? "Feed partially refreshed"
                : health.warning
                  ? "Feed verified · some discovery sources unavailable"
                  : "Feed verified"}
          </span>
          <span>
            Last fully refreshed {health.ageLabel}
            {lastLoadedAt ? ` · checked by this tab ${new Date(lastLoadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
          {dataWarnings.length > 0 && <span> · Optional data unavailable: {dataWarnings.join(", ")}</span>}
        </div>

        <div className={styles.controls}>
          <input
            placeholder="Search roles, companies, tech, source, or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${styles.input} ${styles.searchInput}`}
            aria-label="Search vacancies"
            data-testid="search-input"
          />

          <select value={filterLang} onChange={e => setFilterLang(e.target.value)} className={`${styles.input} ${styles.langSelect}`} data-testid="lang-select" aria-label="Language requirement filter">
            <option value="all">All Language Reqs</option>
            <option value="accessible">No Fluent German Needed</option>
            <option value="de-fluent">Fluent German Required</option>
            <option value="unknown">Language Unknown</option>
          </select>

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={`${styles.input} ${styles.sortSelect}`} data-testid="sort-select" aria-label="Sort order">
            <option value="name">Sort: Name</option>
            <option value="newest">Sort: Newest</option>
            <option value="salary">Sort: Salary</option>
            <option value="rating">Sort: Rating</option>
          </select>

          <select value={recency} onChange={e => setRecency(e.target.value)} className={`${styles.input} ${styles.sortSelect}`} data-testid="recency-select" aria-label="Listing recency filter">
            <option value="all">Any Posting Age</option>
            <option value="1">Posted/Found: 24 Hours</option>
            <option value="3">Posted/Found: 3 Days</option>
            <option value="7">Posted/Found: 7 Days</option>
            <option value="14">Posted/Found: 14 Days</option>
            <option value="30">Posted/Found: 30 Days</option>
            <option value="unknown">Posting Date Unknown</option>
          </select>

          <div className={styles.salaryRange}>
            <input
              type="number"
              placeholder="Min k"
              value={salaryMin ?? ""}
              onChange={e => setSalaryMin(e.target.value === "" ? null : parseInt(e.target.value, 10))}
              min="0"
              max="200"
              step="1"
              className={`${styles.input} ${styles.salaryInput}`}
              aria-label="Minimum salary in thousands EUR"
              data-testid="salary-min"
            />
            <input
              type="number"
              placeholder="Max k"
              value={salaryMax ?? ""}
              onChange={e => setSalaryMax(e.target.value === "" ? null : parseInt(e.target.value, 10))}
              min="0"
              max="200"
              step="1"
              className={`${styles.input} ${styles.salaryInput}`}
              aria-label="Maximum salary in thousands EUR"
              data-testid="salary-max"
            />
          </div>

          <div className={styles.viewToggle}>
            <button onClick={() => setView("grid")} aria-pressed={view === "grid"} className={`${styles.viewButton} ${view === "grid" ? styles.viewActive : ''}`} data-testid="view-toggle-grid">Cards</button>
            <button onClick={() => setView("map")} aria-pressed={view === "map"} className={`${styles.viewButton} ${view === "map" ? styles.viewActive : ''}`} data-testid="view-toggle-map">Map</button>
            <button onClick={() => setView("analytics")} aria-pressed={view === "analytics"} className={`${styles.viewButton} ${view === "analytics" ? styles.viewActive : ''}`} data-testid="view-toggle-analytics">Analytics</button>
          </div>

          {hasActiveFilters && <button onClick={resetFilters} className={styles.resetButton} data-testid="reset-filters">Reset filters</button>}
        </div>

        {view === "grid" && (
          <div className={styles.cardGrid} data-testid="card-grid">
            {filtered.map(c => (
              <CompanyCard key={c.id} company={c} salary={displaySalaryMap[c.id]} feedHealth={health} />
            ))}
            {filtered.length === 0 && (
              <div className={styles.emptyState} data-testid="empty-state">
                <p className={styles.emptyTitle}>No companies match your filters</p>
                <p className={styles.emptySubtitle}>Try adjusting your search or filters</p>
                {hasActiveFilters && <button onClick={resetFilters} className={styles.resetButton}>Reset all filters</button>}
              </div>
            )}
          </div>
        )}
        {view === "map" && (
          <MapView companies={mappedCompanies} profile={profile} salaryMap={displaySalaryMap} onHomeMove={handleSaveProfile} />
        )}
        {view === "analytics" && (
          <AnalyticsView
            entries={entries}
            jobs={jobs}
            salaryMap={salaryMap}
            firstSeenMap={listingDateMap}
            jobHistory={jobHistory}
            jobsMeta={jobsMeta}
          />
        )}
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        defaultProfile={defaultProfileData}
        onSave={handleSaveProfile}
      />
    </div>
  );
}
