import { useState, useEffect, useCallback, useMemo } from "react";
import { STORAGE_KEY, PROFILE_STORAGE_KEY, STATUS_OPTIONS, CULTURE_OPTIONS } from "./constants";
import { DEFAULT_COMPANIES } from "./data/companies";
import defaultProfileData from "./data/defaultProfile.json";
import defaultCvData from "./data/defaultCv.json";
import { estimateSalary } from "./utils/salaryModel";
import { matchScore } from "./utils/matchModel";
import CompanyCard from "./components/CompanyCard";
import CompanyForm from "./components/CompanyForm";
import MapView from "./components/MapView";
import LatestJobs from "./components/LatestJobs";
import Modal from "./components/Modal";
import SettingsModal from "./components/SettingsModal";
import styles from './App.module.css';

export default function App() {
  const [companies, setCompanies] = useState([]);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLang, setFilterLang] = useState("all");
  const [filterCulture, setFilterCulture] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [modalOpen, setModalOpen] = useState(false);
  const [editCompany, setEditCompany] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Profile and CV — loaded from localStorage or seed defaults.
  // These are NOT subject to the force-reset that company data gets.
  const [profile, setProfile] = useState(defaultProfileData);
  const [cv, setCv] = useState(defaultCvData);

  useEffect(() => {
    // Load profile/CV from localStorage if available (not force-reset)
    try {
      const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
      }
    } catch { /* use defaults */ }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Strip residual myExpected from old localStorage data (migration)
        const updated = parsed.map(({ myExpected, ...rest }) => rest);
        const storedIds = new Set(updated.map(c => c.id));
        const missing = DEFAULT_COMPANIES.filter(c => !storedIds.has(c.id));
        const merged = [...updated, ...missing];
        setCompanies(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } else {
        setCompanies(DEFAULT_COMPANIES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_COMPANIES));
      }
    } catch {
      setCompanies(DEFAULT_COMPANIES);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_COMPANIES)); } catch {}
    }
    setLoading(false);
  }, []);

  // Compute salary estimates and match scores for all companies.
  // Memoized — only recomputed when companies, profile, or cv change.
  const companyInsights = useMemo(() => {
    const map = {};
    for (const c of companies) {
      const salary = estimateSalary(c, profile, cv);
      const match = matchScore(c, cv, profile, salary.estimate);
      map[c.id] = { salary, match };
    }
    return map;
  }, [companies, profile, cv]);

  const persist = useCallback((data) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.error("Storage error:", e); }
  }, []);

  const handleSave = useCallback((company) => {
    setCompanies(prev => {
      const existing = prev.find(c => c.id === company.id);
      const updated = existing ? prev.map(c => c.id === company.id ? company : c) : [...prev, company];
      persist(updated);
      return updated;
    });
    setModalOpen(false);
    setEditCompany(null);
  }, [persist]);

  const handleDelete = useCallback((id) => {
    if (!window.confirm("Are you sure you want to delete this company?")) return;
    setCompanies(prev => {
      const updated = prev.filter(c => c.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const handleEdit = useCallback((company) => {
    setEditCompany(company);
    setModalOpen(true);
  }, []);

  const handleReset = useCallback(() => {
    if (!window.confirm("Reset all data to defaults? Your changes will be lost.")) return;
    setCompanies(DEFAULT_COMPANIES);
    persist(DEFAULT_COMPANIES);
  }, [persist]);

  const handleSaveProfile = useCallback((newProfile) => {
    setProfile(newProfile);
    try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile)); } catch {}
  }, []);

  const filtered = useMemo(() => {
    return companies
      .filter(c => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
            !c.industry.toLowerCase().includes(search.toLowerCase()) &&
            !c.techStack.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
        if (filterStatus !== "all" && c.status !== filterStatus) return false;
        if (filterLang === "de-fluent" && c.langReq !== "de-fluent") return false;
        if (filterLang === "accessible" && c.langReq === "de-fluent") return false;
        if (filterCulture !== "all" && !c.cultureTags.includes(filterCulture)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "salary") {
          const sa = companyInsights[a.id]?.salary?.estimate ?? -1;
          const sb = companyInsights[b.id]?.salary?.estimate ?? -1;
          return sb - sa;
        }
        if (sortBy === "match") {
          const ma = companyInsights[a.id]?.match?.score ?? -1;
          const mb = companyInsights[b.id]?.match?.score ?? -1;
          return mb - ma;
        }
        if (sortBy === "rating") {
          const ra = [a.kununuRating, a.glassdoorRating].filter(r => r != null);
          const rb = [b.kununuRating, b.glassdoorRating].filter(r => r != null);
          const avgA = ra.length ? ra.reduce((x, y) => x + y, 0) / ra.length : 0;
          const avgB = rb.length ? rb.reduce((x, y) => x + y, 0) / rb.length : 0;
          return avgB - avgA;
        }
        return 0;
      });
  }, [companies, search, filterStatus, filterLang, filterCulture, sortBy, companyInsights]);

  const statusCounts = useMemo(() => {
    return STATUS_OPTIONS.map(s => ({
      ...s,
      count: companies.filter(c => c.status === s.value).length,
    }));
  }, [companies]);

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
                {companies.length} companies tracked · Software Engineer in Test roles
              </p>
            </div>
            <div className={styles.headerActions}>
              <button onClick={() => setSettingsOpen(true)} className={styles.resetButton}>⚙ Settings</button>
              <button onClick={handleReset} className={styles.resetButton}>Reset Data</button>
              <button onClick={() => { setEditCompany(null); setModalOpen(true); }} className={styles.addButton}>+ Add Company</button>
            </div>
          </div>
        </div>

        <div className={styles.statusBar}>
          {statusCounts.filter(s => s.count > 0).map(s => (
            <div key={s.value} className={styles.statusItem} style={{ '--status-color': s.color, '--status-bg': s.bg, '--status-border': s.color + '25' }}>
              <span className={styles.statusCount}>{s.count}</span>
              <span className={styles.statusLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.controls}>
          <input
            placeholder="Search companies, tech, industry..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${styles.input} ${styles.searchInput}`}
          />

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${styles.input} ${styles.statusSelect}`}>
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

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
            <option value="salary">Sort: Salary ↓</option>
            <option value="match">Sort: Match ↓</option>
            <option value="rating">Sort: Rating ↓</option>
          </select>

          <div className={styles.viewToggle}>
            <button onClick={() => setView("grid")} className={`${styles.viewButton} ${view === "grid" ? styles.viewActive : ''}`}>Cards</button>
            <button onClick={() => setView("map")} className={`${styles.viewButton} ${view === "map" ? styles.viewActive : ''}`}>Map</button>
          </div>
        </div>

        {view === "grid" ? (
          <div className={styles.cardGrid}>
            {filtered.map(c => (
              <CompanyCard key={c.id} company={c} onEdit={handleEdit} onDelete={handleDelete} insights={companyInsights[c.id]} />
            ))}
            {filtered.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No companies match your filters</p>
                <p className={styles.emptySubtitle}>Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        ) : (
          <MapView companies={filtered} profile={profile} companyInsights={companyInsights} />
        )}
      </div>

      <LatestJobs />

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditCompany(null); }} title={editCompany ? `Edit ${editCompany.name}` : "Add New Company"}>
        <CompanyForm company={editCompany} onSave={handleSave} onCancel={() => { setModalOpen(false); setEditCompany(null); }} />
      </Modal>

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
