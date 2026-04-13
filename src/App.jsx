import { useState, useEffect, useCallback, useMemo } from "react";
import { PROFILE_STORAGE_KEY } from "./constants";
import { filterAndSort } from "./utils/filterSort";
import defaultProfileData from "./data/defaultProfile.json";
import { estimateSalary } from "./utils/salaryEstimate";
import { normalizeCompanyName } from "./utils/normalizeCompany";
import CompanyCard from "./components/CompanyCard";
import MapView from "./components/MapView";
import SettingsModal from "./components/SettingsModal";
import styles from './App.module.css';

export default function App() {
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [filterLang, setFilterLang] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [salaryMin, setSalaryMin] = useState(null);
  const [salaryMax, setSalaryMax] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [profile, setProfile] = useState(() => {
    try {
      const s = localStorage.getItem(PROFILE_STORAGE_KEY);
      return s ? JSON.parse(s) : defaultProfileData;
    } catch { return defaultProfileData; }
  });

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

  function handleRetry() {
    setLoading(true);
    setFetchError(null);
    doFetch();
  }

  useEffect(() => { doFetch(); }, []);

  // Track when each job URL was first seen (persisted in localStorage).
  const firstSeenMap = useMemo(() => {
    if (jobs.length === 0) return {};
    const STORAGE_KEY = "sdet-first-seen";
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
    try { localStorage.setItem("sdet-first-seen", JSON.stringify(firstSeenMap)); } catch {}
  }, [jobs, firstSeenMap]);

  // Group jobs by normalized company name (collapses ÖBB / ÖBB-Konzern etc.)
  const entries = useMemo(() => {
    const groups = {};
    for (const j of jobs) {
      const key = normalizeCompanyName(j.company);
      if (!groups[key]) groups[key] = [];
      groups[key].push(j);
    }

    return Object.entries(groups).map(([key, roles]) => {
      // Display the longest original company name (usually the most informative)
      const displayName = roles.reduce((a, b) => b.company.length > a.length ? b.company : a, roles[0].company);
      const first = roles[0];
      const roleDates = roles.map(r => firstSeenMap[r.url]).filter(Boolean);
      const firstSeen = roleDates.length > 0
        ? roleDates.reduce((a, b) => a < b ? a : b)
        : null;
      const techStack = [...new Set(roles.flatMap(r => r.techStack || []))];

      // Pick the most common langReq across roles.
      // Ties break toward more restrictive: de-fluent > de-basic > en.
      const langCounts = {};
      for (const r of roles) {
        const l = r.langReq || "de-basic";
        langCounts[l] = (langCounts[l] || 0) + 1;
      }
      const langOrder = ["de-fluent", "de-basic", "en"];
      const langReq = langOrder.reduce((best, l) => {
        if ((langCounts[l] || 0) > (langCounts[best] || 0)) return l;
        if ((langCounts[l] || 0) === (langCounts[best] || 0) && langOrder.indexOf(l) < langOrder.indexOf(best)) return l;
        return best;
      }, "de-basic");

      return {
        id: `co-${key.replace(/\s+/g, "-")}`,
        name: displayName,
        logo: "\u{1F3E2}",
        district: first.city || "Wien",
        address: first.address || "",
        lat: first.lat,
        lng: first.lng,
        kununuRating: roles.find(r => r.kununuScore)?.kununuScore || null,
        glassdoorRating: roles.find(r => r.glassdoorScore)?.glassdoorScore || null,
        techStack,
        jobUrl: first.url,
        langReq,
        openRoles: roles,
        firstSeen,
      };
    });
  }, [jobs, firstSeenMap]);

  // Simple seniority-based salary estimate per company (best across roles)
  const salaryMap = useMemo(() => {
    const map = {};
    for (const c of entries) {
      const estimates = (c.openRoles || []).map(r => ({
        title: r.title,
        estimate: estimateSalary(r.title),
      }));
      const best = estimates.length > 0
        ? estimates.reduce((a, b) => a.estimate > b.estimate ? a : b).estimate
        : null;
      map[c.id] = { best, roles: estimates };
    }
    return map;
  }, [entries]);

  const handleSaveProfile = useCallback((newProfile) => {
    setProfile(newProfile);
    try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile)); } catch {}
  }, []);

  const filtered = useMemo(() => {
    return filterAndSort({ companies: entries, salaryMap, search, filterLang, sortBy, salaryMin, salaryMax });
  }, [entries, salaryMap, search, filterLang, sortBy, salaryMin, salaryMax]);

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingText}>Loading dashboard...</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingText}>Failed to load job data</div>
        <p style={{ color: '#a1a1aa', marginTop: 8 }}>{fetchError}</p>
        <button onClick={handleRetry} className={styles.settingsButton} style={{ marginTop: 16 }}>Retry</button>
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
                {entries.length} companies · {jobs.length} open roles
              </p>
            </div>
            <div className={styles.headerActions}>
              <button onClick={() => setSettingsOpen(true)} className={styles.settingsButton}>Settings</button>
            </div>
          </div>
        </div>

        <div className={styles.controls}>
          <input
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${styles.input} ${styles.searchInput}`}
          />

          <select value={filterLang} onChange={e => setFilterLang(e.target.value)} className={`${styles.input} ${styles.langSelect}`}>
            <option value="all">All Language Reqs</option>
            <option value="accessible">No Fluent German Needed</option>
            <option value="de-fluent">Fluent German Required</option>
          </select>

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={`${styles.input} ${styles.sortSelect}`}>
            <option value="name">Sort: Name</option>
            <option value="newest">Sort: Newest</option>
            <option value="salary">Sort: Salary</option>
            <option value="rating">Sort: Rating</option>
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
            />
          </div>

          <div className={styles.viewToggle}>
            <button onClick={() => setView("grid")} className={`${styles.viewButton} ${view === "grid" ? styles.viewActive : ''}`}>Cards</button>
            <button onClick={() => setView("map")} className={`${styles.viewButton} ${view === "map" ? styles.viewActive : ''}`}>Map</button>
          </div>
        </div>

        {view === "grid" ? (
          <div className={styles.cardGrid}>
            {filtered.map(c => (
              <CompanyCard key={c.id} company={c} salary={salaryMap[c.id]} />
            ))}
            {filtered.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No companies match your filters</p>
                <p className={styles.emptySubtitle}>Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        ) : (
          <MapView companies={filtered} profile={profile} salaryMap={salaryMap} onHomeMove={handleSaveProfile} />
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
