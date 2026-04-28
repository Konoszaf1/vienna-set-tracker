import { useMemo } from "react";
import {
  listingsOverTime,
  topEmployers,
  langReqBreakdown,
  salaryTierBreakdown,
  topTechStack,
  districtBreakdown,
} from "../utils/analytics";
import LineChart from "./charts/LineChart";
import BarChart from "./charts/BarChart";
import styles from "./AnalyticsView.module.css";

export default function AnalyticsView({ entries, jobs, salaryMap, firstSeenMap }) {
  const timeSeries = useMemo(() => listingsOverTime(firstSeenMap), [firstSeenMap]);
  const employers = useMemo(() => topEmployers(entries, 10), [entries]);
  const langs = useMemo(() => langReqBreakdown(entries), [entries]);
  const salary = useMemo(() => salaryTierBreakdown(entries, salaryMap), [entries, salaryMap]);
  const tech = useMemo(() => topTechStack(entries, 10), [entries]);
  const districts = useMemo(() => districtBreakdown(entries), [entries]);

  const cumulativePoints = timeSeries.points.map(p => ({ x: p.date, y: p.total }));
  const newPerDayPoints = timeSeries.points.map(p => ({ name: p.date.slice(5), value: p.new }));

  const totalRoles = jobs?.length || 0;
  const trackedDays = timeSeries.points.length;
  const newToday = timeSeries.points.length > 0 ? timeSeries.points[timeSeries.points.length - 1].new : 0;

  return (
    <div className={styles.container} data-testid="analytics-view">
      <div className={styles.summary}>
        <Stat label="Companies" value={entries.length} />
        <Stat label="Open roles" value={totalRoles} />
        <Stat label="Unique seen" value={timeSeries.totalUnique} />
        <Stat label="Tracked days" value={trackedDays} muted />
        <Stat label="New today" value={newToday} />
      </div>

      <Section title="Unique listings discovered over time" subtitle={`Cumulative — based on when this browser first saw each role`}>
        <LineChart points={cumulativePoints} ariaLabel="Cumulative unique listings over time" />
      </Section>

      <Section title="New listings per day" subtitle="Bars are days — taller means more roles first observed that day">
        <BarChart data={newPerDayPoints} ariaLabel="New listings per day" />
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

      <Section title="Listings by district" subtitle="Where Vienna's SET/SDET roles cluster">
        <BarChart data={districts} ariaLabel="Listings by district" color="#06b6d4" />
      </Section>
    </div>
  );
}

function Stat({ label, value, muted }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
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
