import { useState, useEffect, useCallback, useMemo } from "react";
import { PROFILE_STORAGE_KEY, CULTURE_OPTIONS } from "./constants";
import { filterAndSort } from "./utils/filterSort";
import defaultProfileData from "./data/defaultProfile.json";
import defaultCvData from "./data/defaultCv.json";
import { estimateJobSalary } from "./utils/salaryModel";
import { matchScore } from "./utils/matchModel";
import CompanyCard from "./components/CompanyCard";
import MapView from "./components/MapView";
import SettingsModal from "./components/SettingsModal";
import styles from './App.module.css';

export default function App() {
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [filterLang, setFilterLang] = useState("all");
  const [filterCulture, setFilterCulture] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [salaryMin, setSalaryMin] = useState(null);
  const [salaryMax, setSalaryMax] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState(defaultProfileData);
  const [cv] = useState(defaultCvData);

  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (storedProfile) {
        setProfile(JSON.parse(storedProfile)); // eslint-disable-line react-hooks/set-state-in-effect -- mount-time load
      }
    } catch {}
  }, []);

  useEffect(() => {
    const h = Math.floor(Date.now() / 3600000);
    fetch(import.meta.env.BASE_URL + `jobs.json?h=${h}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.jobs) setJobs(d.jobs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Track when each job URL was first seen (persisted in localStorage).
  // Prunes entries for URLs no longer in the feed so it doesn't grow unbounded.
  const firstSeenMap = useMemo(() => {
    const STORAGE_KEY = "sdet-first-seen";
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}
    const now = new Date().toISOString();
    const activeUrls = new Set(jobs.map(j => j.url));
    let changed = false;
    // Add new entries
    for (const j of jobs) {
      if (!stored[j.url]) {
        stored[j.url] = now;
        changed = true;
      }
    }
    // Prune stale entries (jobs removed from the feed)
    for (const url of Object.keys(stored)) {
      if (!activeUrls.has(url)) {
        delete stored[url];
        changed = true;
      }
    }
    if (changed) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch {}
    }
    return stored;
  }, [jobs]);

  // Group jobs by company name into company entries
  const entries = useMemo(() => {
    const groups = {};
    for (const j of jobs) {
      const key = j.company.toLowerCase().trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(j);
    }

    return Object.entries(groups).map(([key, roles]) => {
      const first = roles[0];
      // Compute earliest firstSeen across all roles for this company
      const roleDates = roles.map(r => firstSeenMap[r.url]).filter(Boolean);
      const firstSeen = roleDates.length > 0
        ? roleDates.reduce((a, b) => a < b ? a : b)
        : null;
      return {
        id: `co-${key.replace(/\s+/g, "-")}`,
        name: first.company,
        logo: "\u{1F3E2}",
        district: first.city || "Wien",
        address: first.address || "",
        lat: first.lat,
        lng: first.lng,
        kununuRating: roles.find(r => r.kununuScore)?.kununuScore || null,
        glassdoorRating: null,
        cultureTags: [],
        techStack: [],
        languages: ["English"],
        notes: "",
        jobUrl: first.url,
        industry: "",
        langReq: "de-basic",
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

  const handleSaveProfile = useCallback((newProfile) => {
    setProfile(newProfile);
    try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile)); } catch {}
  }, []);

  const filtered = useMemo(() => {
    return filterAndSort({ companies: entries, companyInsights, search, filterLang, filterCulture, sortBy, salaryMin, salaryMax });
  }, [entries, companyInsights, search, filterLang, filterCulture, sortBy, salaryMin, salaryMax]);

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingText}>Loading dashboard...</div>
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
            placeholder="Search companies, tech, industry..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${styles.input} ${styles.searchInput}`}
          />

          <select value={filterLang} onChange={e => setFilterLang(e.target.value)} className={`${styles.input} ${styles.langSelect}`}>
            <option value="all">All Language Reqs</option>
            <option value="accessible">No Fluent German Needed</option>
            <option value="de-fluent">Fluent German Required</option>
          </select>

          <select value={filterCulture} onChange={e => setFilterCulture(e.target.value)} className={`${styles.input} ${styles.cultureSelect}`}>
            <option value="all">All Cultures</option>
            {CULTURE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={`${styles.input} ${styles.sortSelect}`}>
            <option value="name">Sort: Name</option>
            <option value="newest">Sort: Newest</option>
            <option value="salary">Sort: Salary</option>
            <option value="match">Sort: Match</option>
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
              <CompanyCard key={c.id} company={c} insights={companyInsights[c.id]} />
            ))}
            {filtered.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No companies match your filters</p>
                <p className={styles.emptySubtitle}>Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        ) : (
          <MapView companies={filtered} profile={profile} companyInsights={companyInsights} onHomeMove={handleSaveProfile} />
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
