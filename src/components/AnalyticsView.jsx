import { useMemo } from "react";
import {
  activeListingsOverTime,
  listingsOverTime,
  topEmployers,
  langReqBreakdown,
  salaryTierBreakdown,
  topTechStack,
  districtBreakdown,
  weeklyNewListings,
  sourceBreakdown,
  marketPulse,
} from "../utils/analytics";
import LineChart from "./charts/LineChart";
import BarChart from "./charts/BarChart";
import styles from "./AnalyticsView.module.css";

export default function AnalyticsView({ entries, jobs, salaryMap, firstSeenMap, jobHistory, jobsMeta }) {
  const activeSeries = useMemo(
    () => activeListingsOverTime({
      history: jobHistory,
      jobs,
      firstSeenMap,
      currentSnapshotDate: jobsMeta?.lastVerified || jobsMeta?.lastUpdated,
    }),
    [jobHistory, jobs, firstSeenMap, jobsMeta]
  );
  const timeSeries = useMemo(() => listingsOverTime(firstSeenMap), [firstSeenMap]);
  const employers = useMemo(() => topEmployers(entries, 10), [entries]);
  const langs = useMemo(() => langReqBreakdown(entries), [entries]);
  const salary = useMemo(() => salaryTierBreakdown(entries, salaryMap), [entries, salaryMap]);
  const tech = useMemo(() => topTechStack(entries, 10), [entries]);
  const districts = useMemo(() => districtBreakdown(entries), [entries]);
  const weeklyNew = useMemo(() => weeklyNewListings(firstSeenMap), [firstSeenMap]);
  const sources = useMemo(() => sourceBreakdown(jobs), [jobs]);
  const pulse = useMemo(() => marketPulse(jobHistory), [jobHistory]);

  const activePoints = activeSeries.points.map(p => ({ x: p.date, y: p.active }));
  const cumulativePoints = timeSeries.points.map(p => ({ x: p.date, y: p.total }));

  const totalRoles = jobs?.length || 0;
  const trackedDays = timeSeries.points.length;
  const newToday = timeSeries.points.length > 0 ? timeSeries.points[timeSeries.points.length - 1].new : 0;

  return (
    <div className={styles.container} data-testid="analytics-view">
      <div className={styles.summary}>
        <Stat label="Companies" value={entries.length} delta={pulse.companiesDelta} />
        <Stat label="Open roles" value={totalRoles} delta={pulse.jobsDelta} />
        <Stat label="Dated listings" value={timeSeries.totalUnique} />
        <Stat label="Tracked days" value={trackedDays} muted />
        <Stat label="Posted/found today" value={newToday} />
      </div>

      <Section title="Active job openings over time" subtitle="Daily live listing count after 404 and expired postings are pruned">
        <LineChart points={activePoints} ariaLabel="Active job openings over time" showArea={false} color="#10b981" />
      </Section>

      <Section title="Listings by known opening date" subtitle="Uses board publication dates where available and tracker discovery dates as a labelled fallback">
        <LineChart points={cumulativePoints} ariaLabel="Cumulative unique listings over time" />
      </Section>

      <Section title="Weekly posted/found listings" subtitle="Source publication dates with discovery-date fallback, grouped Monday to Sunday">
        <BarChart data={weeklyNew} ariaLabel="Weekly new listings" />
      </Section>

      <div className={styles.grid2}>
        <Section title="Top 10 employers" subtitle="By number of open roles in their group">
          <BarChart data={employers} ariaLabel="Top employers by open roles" />
        </Section>

        <Section title="Top 10 tech tags" subtitle="Across all currently-listed roles">
          <BarChart data={tech} ariaLabel="Most common tech stack" color="#10b981" />
        </Section>
      </div>

      <div className={styles.grid2}>
        <Section title="Language requirement" subtitle="How many companies require which level of German">
          <BarChart data={langs} ariaLabel="Language requirement distribution" color="#f59e0b" />
        </Section>

        <Section title="Salary tier distribution" subtitle="Buckets match the map's color palette">
          <BarChart data={salary} ariaLabel="Salary tier distribution" color="#fb923c" />
        </Section>
      </div>

      <div className={styles.grid2}>
        <Section title="Companies by office location" subtitle="Grouped by resolved Vienna district where available">
          <BarChart data={districts} ariaLabel="Companies by office location" color="#06b6d4" />
        </Section>

        <Section title="Listings by source" subtitle="Distribution across job boards and career pages">
          <BarChart data={sources} ariaLabel="Listings by source" color="#3b82f6" />
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value, muted, delta }) {
  const hasDelta = delta !== undefined && delta !== null;
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  let deltaClass = "";
  let deltaText = "";
  if (hasDelta) {
    if (isPositive) {
      deltaClass = styles.deltaPositive;
      deltaText = `↑ +${delta}`;
    } else if (isNegative) {
      deltaClass = styles.deltaNegative;
      deltaText = `↓ ${delta}`;
    } else {
      deltaClass = styles.deltaNeutral;
      deltaText = `→ 0`;
    }
  }

  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>
        <span>{label}</span>
        {hasDelta && <span className={`${styles.deltaBadge} ${deltaClass}`}>{deltaText}</span>}
      </div>
      <div className={`${styles.statValue} ${muted ? styles.statValueMuted : ""}`}>{value}</div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.title}>{title}</h3>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}
