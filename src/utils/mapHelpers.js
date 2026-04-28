import { escapeHtml, isHttpUrl } from "./escape";

/**
 * Haversine distance between two lat/lng points in km.
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute vertical stacking index for markers at the same location.
 * Companies within `threshold` degrees (~22 m at default) share a stack.
 * Returns an object mapping company id → stack position (0-based).
 */
export function computeStackingIndex(companies, threshold = 0.0002) {
  const stackIndex = {};
  const grouped = [];
  for (const c of companies) {
    let placed = false;
    for (const g of grouped) {
      if (Math.abs(g.lat - c.lat) < threshold && Math.abs(g.lng - c.lng) < threshold) {
        stackIndex[c.id] = g.members.length;
        g.members.push(c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      stackIndex[c.id] = 0;
      grouped.push({ lat: c.lat, lng: c.lng, members: [c] });
    }
  }
  return stackIndex;
}

/**
 * Pixel height of the stem below a stacked marker label.
 */
export function stemHeight(stackPosition, slotHeight = 28) {
  return stackPosition * slotHeight;
}

/**
 * Cluster icon diameter based on child marker count.
 */
export function clusterSize(count) {
  return count < 5 ? 40 : count < 15 ? 48 : 56;
}

/**
 * Average salary estimate for a cluster of markers.
 * Ignores null/undefined estimates. Returns null if none are valid.
 */
export function clusterAvgSalary(estimates) {
  const valid = estimates.filter(Boolean);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

/**
 * Salary estimate → marker color.
 */
export function salaryColor(estimate) {
  if (!estimate) return "#6366f1";
  if (estimate >= 70) return "#10b981";
  if (estimate >= 60) return "#f59e0b";
  if (estimate >= 55) return "#fb923c";
  return "#ef4444";
}

/**
 * Build popup HTML for a map marker. All user-controlled fields are
 * run through escapeHtml; URLs are gated by isHttpUrl.
 */
export function buildPopupHtml({ company: c, salary: sal, distance: km, color, estimate }) {
  const eName = escapeHtml(c.name);
  const eAddress = escapeHtml(c.address || "");
  const eLogo = escapeHtml(c.logo);
  const safePrimaryUrl = isHttpUrl(c.jobUrl) ? escapeHtml(c.jobUrl) : null;
  const commuteNote = km < 2 ? "🚶 walkable" : km < 5 ? "🚲 bikeable" : km < 12 ? "🚇 quick transit" : "🚆 longer commute";

  const eTech = (c.techStack || []).slice(0, 6)
    .map(t => `<span style="background:#10b98118;color:#10b981;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${escapeHtml(t)}</span>`)
    .join("");

  const openRoles = c.openRoles || [];
  const rolesHtml = openRoles.length > 0 ? `<div style="margin-top:8px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Open roles (${openRoles.length})</div>${openRoles.map((role, ri) => {
    const eTitle = escapeHtml(role.title);
    const roleUrl = isHttpUrl(role.url) ? escapeHtml(role.url) : null;
    const roleEst = sal?.roles?.[ri]?.estimate;
    const estLabel = roleEst ? ` · €${roleEst}k` : "";
    return roleUrl
      ? `<a href="${roleUrl}" target="_blank" rel="noopener noreferrer" style="display:block;padding:4px 6px;margin:2px 0;background:#18181b;border-radius:4px;color:#a1a1aa;text-decoration:none;font-size:11px;border:1px solid #27272a">${eTitle}<span style="color:#6366f1;font-weight:600">${estLabel}</span></a>`
      : `<div style="padding:4px 6px;margin:2px 0;background:#18181b;border-radius:4px;color:#a1a1aa;font-size:11px">${eTitle}${estLabel}</div>`;
  }).join("")}</div>` : "";

  const ratingsBlock = c.kununuRating != null ? `<div style="margin-bottom:10px"><div style="background:#18181b;padding:6px 8px;border-radius:6px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Kununu</div><div style="font-size:14px;font-weight:700;color:#facc15">${c.kununuRating} ★</div></div></div>` : "";

  const statusBadge = `<span style="margin-left:auto;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;color:#06b6d4;background:#06b6d420;border:1px solid #06b6d430">Live</span>`;

  return `
    <div style="font-family:DM Sans,sans-serif;min-width:260px;padding:4px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:28px">${eLogo}</span>
        <div>
          <div style="font-size:15px;font-weight:700;color:#fafafa">${eName}</div>
        </div>
        ${statusBadge}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
        ${estimate ? `<div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Salary</div><div style="font-size:16px;font-weight:700;color:${color}">€${estimate}k</div></div>` : ""}
        <div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Distance</div><div style="font-size:14px;font-weight:700;color:#a1a1aa">${km.toFixed(1)} km</div></div>
        <div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Commute</div><div style="font-size:11px;font-weight:600;color:#a1a1aa">${commuteNote}</div></div>
      </div>
      ${ratingsBlock}
      ${eTech ? `<div style="margin-bottom:8px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Tech</div><div style="display:flex;flex-wrap:wrap;gap:3px">${eTech}</div></div>` : ""}
      ${eAddress ? `<div style="font-size:11px;color:#a1a1aa">📍 ${eAddress}</div>` : ""}
      ${rolesHtml}
      ${safePrimaryUrl ? `<div style="margin-top:10px"><a href="${safePrimaryUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;padding:8px;background:#6366f120;color:#6366f1;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;border:1px solid #6366f130">View listing ↗</a></div>` : ""}
    </div>`;
}
