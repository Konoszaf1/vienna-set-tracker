import { useMemo } from "react";
import styles from "./Charts.module.css";

const ROW_H = 24;
const ROW_GAP = 4;
const PAD_LEFT = 140;
const PAD_RIGHT = 40;
const VB_W = 600;

/**
 * Horizontal SVG bar chart.
 *
 * `data` is `[{ name: string, value: number }, …]`. Rows render
 * top-to-bottom in the order provided.
 */
export default function BarChart({ data, ariaLabel = "Bar chart", color = "#6366f1" }) {
  const { rows, vbH } = useMemo(() => {
    if (!data || data.length === 0) return { rows: [], vbH: 100 };
    const max = Math.max(1, ...data.map(d => d.value));
    const innerW = VB_W - PAD_LEFT - PAD_RIGHT;
    const rows = data.map((d, i) => ({
      ...d,
      y: i * (ROW_H + ROW_GAP),
      barW: (d.value / max) * innerW,
    }));
    const vbH = data.length * (ROW_H + ROW_GAP);
    return { rows, vbH };
  }, [data]);

  if (!data || data.length === 0) {
    return <div className={styles.empty}>No data.</div>;
  }

  return (
    <svg
      className={styles.svg}
      style={{ height: vbH }}
      viewBox={`0 0 ${VB_W} ${vbH}`}
      role="img"
      aria-label={ariaLabel}
    >
      {rows.map((r, i) => (
        <g key={i}>
          <text
            className={styles.tick}
            x={PAD_LEFT - 8} y={r.y + ROW_H / 2 + 3}
            textAnchor="end"
          >
            {truncate(r.name, 20)}
          </text>
          <rect
            className={styles.bar}
            x={PAD_LEFT} y={r.y}
            width={Math.max(2, r.barW)} height={ROW_H}
            rx="3"
            style={color !== "#6366f1" ? { fill: color } : undefined}
          >
            <title>{`${r.name}: ${r.value}`}</title>
          </rect>
          <text
            className={styles.barLabel}
            x={PAD_LEFT + r.barW + 6}
            y={r.y + ROW_H / 2 + 3}
          >
            {r.value}
          </text>
        </g>
      ))}
    </svg>
  );
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
