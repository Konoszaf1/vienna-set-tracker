import { useMemo, useState } from "react";
import styles from "./Charts.module.css";

const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
const VB_W = 600;
const VB_H = 220;

/**
 * Minimal SVG line chart.
 *
 * `points` is `[{ x: string|Date, y: number }, …]`. The x-axis renders as
 * categorical labels (one per point, thinned for legibility); the y-axis
 * renders 0…max with a couple of gridlines.
 */
export default function LineChart({ points, ariaLabel = "Line chart", showArea = true }) {
  const [hover, setHover] = useState(null);

  const { path, areaPath, scaledPoints, ticks, xLabels } = useMemo(() => {
    if (!points || points.length === 0) {
      return { path: "", areaPath: "", scaledPoints: [], ticks: [], xLabels: [] };
    }
    const max = Math.max(1, ...points.map(p => p.y));
    const innerW = VB_W - PAD.left - PAD.right;
    const innerH = VB_H - PAD.top - PAD.bottom;
    const denom = Math.max(1, points.length - 1);

    const scaled = points.map((p, i) => ({
      ...p,
      sx: PAD.left + (i / denom) * innerW,
      sy: PAD.top + innerH - (p.y / max) * innerH,
    }));

    const path = scaled.map((p, i) => `${i === 0 ? "M" : "L"}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(" ");
    const baseY = PAD.top + innerH;
    const areaPath = path
      ? `${path} L${scaled[scaled.length - 1].sx.toFixed(1)},${baseY} L${scaled[0].sx.toFixed(1)},${baseY} Z`
      : "";

    const tickValues = [0, Math.round(max / 2), max];
    const ticks = tickValues.map(t => ({
      value: t,
      y: PAD.top + innerH - (t / max) * innerH,
    }));

    // Thin x-labels: aim for ≤ 8 visible labels regardless of count.
    const stride = Math.max(1, Math.ceil(points.length / 8));
    const xLabels = scaled
      .filter((_, i) => i % stride === 0 || i === scaled.length - 1)
      .map(p => ({ x: p.sx, label: shortDate(p.x) }));

    return { path, areaPath, scaledPoints: scaled, ticks, xLabels };
  }, [points]);

  if (!points || points.length === 0) {
    return <div className={styles.empty}>No data yet — keep the dashboard open across a few days.</div>;
  }

  return (
    <svg className={styles.svg} viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map(t => (
        <g key={t.value}>
          <line
            className={styles.gridline}
            x1={PAD.left} x2={VB_W - PAD.right}
            y1={t.y} y2={t.y}
          />
          <text className={styles.tick} x={PAD.left - 6} y={t.y + 3} textAnchor="end">
            {t.value}
          </text>
        </g>
      ))}

      {showArea && <path className={styles.area} d={areaPath} />}
      <path className={styles.line} d={path} />

      {scaledPoints.map((p, i) => (
        <circle
          key={i}
          className={styles.point}
          cx={p.sx} cy={p.sy} r={hover === i ? 4 : 2.5}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <title>{`${shortDate(p.x)}: ${p.y}`}</title>
        </circle>
      ))}

      {xLabels.map((l, i) => (
        <text
          key={i}
          className={styles.tick}
          x={l.x} y={VB_H - 8}
          textAnchor="middle"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}

function shortDate(v) {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return v.slice(5); // "MM-DD"
  }
  if (v instanceof Date) return v.toISOString().slice(5, 10);
  return String(v);
}
