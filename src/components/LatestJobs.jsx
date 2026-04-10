import { useState, useEffect } from "react";
import styles from './LatestJobs.module.css';

export default function LatestJobs() {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "latest-jobs.json")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.lastUpdated) {
          d.ageInDays = (Date.now() - new Date(d.lastUpdated)) / 86400000;
        }
        setData(d);
      })
      .catch(() => {});
  }, []);

  if (!data || !data.jobs || data.jobs.length === 0) return null;

  if (data.ageInDays > 7) return null;

  const shown = expanded ? data.jobs : data.jobs.slice(0, 8);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>🔄 Live Job Feed</h3>
          <span className={styles.subtitle}>
            {data.count} listings — updated {new Date(data.lastUpdated).toLocaleDateString("en-AT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}{data.ageInDays > 3 && " (may be out of date)"}
          </span>
        </div>
        <div className={styles.searchLinks}>
          {data.searchLinks?.slice(0, 4).map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={styles.searchLink}>
              {l.label.split("—")[0].trim()}
            </a>
          ))}
        </div>
      </div>

      <div className={styles.jobGrid}>
        {shown.map((j, i) => (
          <a key={i} href={j.url} target="_blank" rel="noopener noreferrer" className={styles.jobCard}>
            <span className={styles.jobTitle}>{j.title}</span>
            <span className={styles.jobCompany}>{j.company}</span>
            <span className={styles.jobSource}>{j.source}</span>
          </a>
        ))}
      </div>

      {data.jobs.length > 8 && (
        <button onClick={() => setExpanded(!expanded)} className={styles.expandButton}>
          {expanded ? "Show less" : `Show all ${data.jobs.length} listings`}
        </button>
      )}
    </div>
  );
}
