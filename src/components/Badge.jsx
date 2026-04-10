export default function Badge({ children, color = "#6366f1", bg }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.02em",
      color,
      backgroundColor: bg || color + "18",
      border: `1px solid ${color}30`,
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}
