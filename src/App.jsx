import { useState, useCallback, useMemo } from "react";
import { PROFILE_STORAGE_KEY, CULTURE_OPTIONS } from "./constants";
import { filterAndSort } from "./utils/filterSort";
import defaultProfileData from "./data/defaultProfile.json";
import defaultCvData from "./data/defaultCv.json";
import useJobFeed from "./hooks/useJobFeed";
import useFirstSeen from "./hooks/useFirstSeen";
import useCompanies from "./hooks/useCompanies";
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [profile, setProfile] = useState(() => {
    try {
      const s = localStorage.getItem(PROFILE_STORAGE_KEY);
      return s ? JSON.parse(s) : defaultProfileData;
    } catch { return defaultProfileData; }
  });
  const [cv] = useState(defaultCvData);

  const { jobs, loading, fetchError, retry: handleRetry } = useJobFeed();
  const firstSeenMap = useFirstSeen(jobs);
  const { entries, companyInsights } = useCompanies(jobs, firstSeenMap, profile, cv);

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
