import { escapeHtml, isSafeUrl } from "./escape";

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
 * run through escapeHtml; URLs are gated by isSafeUrl.
 */
export function buildPopupHtml({ company: c, salary: sal, distance: km, color, estimate }) {
  const eName = escapeHtml(c.name);
  const eAddress = escapeHtml(c.address || "");
  const eLogo = escapeHtml(c.logo);
  const safePrimaryUrl = isSafeUrl(c.jobUrl) ? escapeHtml(c.jobUrl) : null;
  const commuteNote = km < 2 ? "🚶 walkable" : km < 5 ? "🚲 bikeable" : km < 12 ? "🚇 quick transit" : "🚆 longer commute";

  const eTech = (c.techStack || []).slice(0, 6)
    .map(t => `<span style="background:#10b98118;color:#10b981;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${escapeHtml(t)}</span>`)
    .join("");

  const openRoles = c.openRoles || [];
  const rolesHtml = openRoles.length > 0 ? `<div style="margin-top:8px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Open roles (${openRoles.length})</div>${openRoles.map((role, ri) => {
    const eTitle = escapeHtml(role.title);
    const roleUrl = isSafeUrl(role.url) ? escapeHtml(role.url) : null;
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
