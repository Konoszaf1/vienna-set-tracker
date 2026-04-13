import { useState, useEffect, useRef, useMemo } from "react";
import { DEFAULT_HOME, DEFAULT_HOME_ADDRESS } from "../constants";
import { escapeHtml, isSafeUrl } from "../utils/escape";
import styles from './MapView.module.css';

export default function MapView({ companies, profile, companyInsights, onHomeMove }) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const homeMarkerRef = useRef(null);
  const markersRef = useRef([]);
  const clusterGroupRef = useRef(null);
  const extraLayersRef = useRef([]);
  const prevHomeRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Derive home location from profile, falling back to neutral default
  const home = useMemo(() => {
    if (profile?.home?.lat && profile?.home?.lng) {
      return [profile.home.lat, profile.home.lng];
    }
    return DEFAULT_HOME;
  }, [profile]);

  const homeAddress = useMemo(() => {
    if (profile?.home?.address) return profile.home.address;
    return DEFAULT_HOME_ADDRESS;
  }, [profile]);

  useEffect(() => {
    if (window.L && window.L.markerClusterGroup) { setReady(true); return; }

    const loadLeaflet = window.L
      ? Promise.resolve(window.L)
      : import("leaflet").then(mod => { window.L = mod.default || mod; return window.L; });

    loadLeaflet.then(() =>
      import("leaflet.markercluster/dist/leaflet.markercluster.js")
    ).then(() => {
      setReady(true);
    });
  }, []);

  // Inject cluster + dark-theme styles once
  useEffect(() => {
    if (!ready) return;
    if (document.getElementById("lf-dark")) return;
    const s = document.createElement("style"); s.id = "lf-dark";
    s.textContent = `
      .dark-popup .leaflet-popup-content-wrapper{background:#09090b!important;color:#fafafa!important;border-radius:12px!important;border:1px solid #27272a!important;box-shadow:0 8px 32px rgba(0,0,0,.6)!important;padding:0!important}
      .dark-popup .leaflet-popup-content{margin:12px!important;line-height:1.4!important}
      .dark-popup .leaflet-popup-tip{background:#09090b!important;border:1px solid #27272a!important;border-top:none!important;border-left:none!important}
      .dark-popup .leaflet-popup-close-button{color:#71717a!important;font-size:18px!important;padding:6px 8px!important}
      .dark-popup .leaflet-popup-close-button:hover{color:#fafafa!important}
      .leaflet-control-zoom a{background:#18181b!important;color:#a1a1aa!important;border-color:#27272a!important}
      .leaflet-control-zoom a:hover{background:#27272a!important;color:#fafafa!important}
      .leaflet-control-attribution{background:rgba(9,9,11,.8)!important;color:#52525b!important}
      .leaflet-control-attribution a{color:#6366f1!important}
      /* MarkerCluster animations */
      .leaflet-cluster-anim .leaflet-marker-icon,.leaflet-cluster-anim .leaflet-marker-shadow{transition:transform .3s ease-out,opacity .3s ease-in}
      .leaflet-cluster-spider-leg{transition:stroke-dashoffset .3s ease-out,stroke-opacity .3s ease-in}
      /* Dark spider legs */
      .leaflet-cluster-spider-leg .leaflet-cluster-spider-leg-line{stroke:#6366f1;stroke-opacity:.5}
    `;
    document.head.appendChild(s);
  }, [ready]);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.L) return;
    const L = window.L;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(containerRef.current, {
        center: home, zoom: 13,
        zoomControl: true, attributionControl: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd", maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      prevHomeRef.current = home;
    }

    const map = mapInstanceRef.current;

    // Re-center only when home coordinates actually changed (e.g. Settings update)
    const prev = prevHomeRef.current;
    if (prev && (prev[0] !== home[0] || prev[1] !== home[1])) {
      map.setView(home, 13);
    }
    prevHomeRef.current = home;

    // Clear previous layers
    if (homeMarkerRef.current) { map.removeLayer(homeMarkerRef.current); homeMarkerRef.current = null; }
    markersRef.current.forEach(m => {
      if (m._homeLine) { map.removeLayer(m._homeLine); m._homeLine = null; }
    });
    markersRef.current = [];
    if (clusterGroupRef.current) { map.removeLayer(clusterGroupRef.current); clusterGroupRef.current = null; }
    extraLayersRef.current.forEach(l => map.removeLayer(l));
    extraLayersRef.current = [];

    const circles = [
      { r: 2000, label: "~10 min bike", color: "#10b981", dash: "8 4" },
      { r: 5000, label: "~20 min transit", color: "#f59e0b", dash: "12 6" },
      { r: 10000, label: "~35 min transit", color: "#ef4444", dash: "16 8" },
    ];
    circles.forEach(({ r, label, color, dash }) => {
      const circle = L.circle(home, { radius: r, color, fillColor: color, fillOpacity: 0.03, weight: 1.5, dashArray: dash, interactive: false }).addTo(map);
      extraLayersRef.current.push(circle);
      const angle = -0.3;
      const labelLat = home[0] + (r / 111320) * Math.cos(angle);
      const labelLng = home[1] + (r / (111320 * Math.cos(home[0] * Math.PI / 180))) * Math.sin(angle);
      const lbl = L.marker([labelLat, labelLng], {
        icon: L.divIcon({ className: "", html: `<div style="color:${color};font-size:10px;font-weight:600;font-family:DM Sans,sans-serif;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.5)">${label}</div>`, iconSize: [0, 0] }),
        interactive: false,
      }).addTo(map);
      extraLayersRef.current.push(lbl);
    });

    const dist = (lat1, lng1, lat2, lng2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const homeIcon = L.divIcon({
      className: "",
      html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:grab">
        <div style="background:#ef4444;color:#fff;font-size:13px;font-weight:700;padding:5px 12px;border-radius:10px;white-space:nowrap;font-family:DM Sans,sans-serif;box-shadow:0 2px 16px rgba(239,68,68,.5);border:2px solid #fca5a5">🏠 Home</div>
        <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid #ef4444;margin-top:-1px"></div>
        <div style="width:10px;height:10px;border-radius:50%;background:#ef4444;margin-top:2px;box-shadow:0 0 12px rgba(239,68,68,.8)"></div>
        <div style="font-size:9px;color:#fca5a5;margin-top:3px;font-family:DM Sans,sans-serif;font-weight:600;white-space:nowrap">drag to move</div>
      </div>`,
      iconSize: [0, 0], iconAnchor: [0, 45],
    });
    const homeMarker = L.marker(home, { icon: homeIcon, zIndexOffset: 1000, draggable: true })
      .addTo(map)
      .bindPopup(`<div style="font-family:DM Sans,sans-serif;padding:4px"><div style="font-size:15px;font-weight:700;color:#fafafa">🏠 Home Base</div><div style="font-size:12px;color:#a1a1aa;margin-top:4px">${escapeHtml(homeAddress)}</div><div style="font-size:10px;color:#52525b;margin-top:4px">Drag pin to move home</div></div>`, { className: "dark-popup", closeButton: true });
    homeMarkerRef.current = homeMarker;

    homeMarker.on("dragend", async () => {
      const pos = homeMarker.getLatLng();
      const lat = Math.round(pos.lat * 10000) / 10000;
      const lng = Math.round(pos.lng * 10000) / 10000;
      // Reverse-geocode to get address
      let address = `${lat}, ${lng}`;
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
        const res = await fetch(url, {
          headers: { "User-Agent": "vienna-set-tracker/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          const a = data.address || {};
          const parts = [a.road, a.house_number, a.postcode, a.suburb || a.city_district].filter(Boolean);
          if (parts.length > 0) address = parts.join(", ");
          else if (data.display_name) address = data.display_name.split(",").slice(0, 3).join(",").trim();
        }
      } catch { /* keep coordinate string */ }
      if (onHomeMove) {
        onHomeMove({ ...profile, home: { ...profile.home, lat, lng, address } });
      }
    });

    const salaryColor = (s) => !s ? "#6366f1" : s >= 70 ? "#10b981" : s >= 60 ? "#f59e0b" : s >= 55 ? "#fb923c" : "#ef4444";

    const mappable = companies.filter(c => c.lat != null && c.lng != null);

    // Compute vertical stacking index for markers at the same location.
    // Markers within ~20 m of each other get stacked so labels don't overlap.
    const SAME_SPOT = 0.0002; // ~22 m — same building
    const STACK_HEIGHT = 28;  // px per label slot
    const stackIndex = {};
    const grouped = [];
    for (const c of mappable) {
      let placed = false;
      for (const g of grouped) {
        if (Math.abs(g.lat - c.lat) < SAME_SPOT && Math.abs(g.lng - c.lng) < SAME_SPOT) {
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

    // Create cluster group with custom dark-themed icons.
    // disableClusteringAtZoom 15: at street level markers sit at true positions.
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 15,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const children = cluster.getAllChildMarkers();
        // Average salary color for the cluster
        const estimates = children.map(m => m._companyEstimate).filter(Boolean);
        const avgEstimate = estimates.length > 0 ? estimates.reduce((a, b) => a + b, 0) / estimates.length : null;
        const color = salaryColor(avgEstimate);
        const size = count < 5 ? 40 : count < 15 ? 48 : 56;

        return L.divIcon({
          className: "",
          html: `<div style="
            width:${size}px;height:${size}px;
            display:flex;align-items:center;justify-content:center;
            background:${color};color:#fff;
            font-size:${count < 5 ? 13 : 14}px;font-weight:700;font-family:DM Sans,sans-serif;
            border-radius:50%;
            border:3px solid ${color}60;
            box-shadow:0 3px 16px ${color}80,0 0 0 6px ${color}20;
            cursor:pointer;transition:transform .2s;
          ">${count}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    mappable.forEach(c => {
      const km = dist(home[0], home[1], c.lat, c.lng);
      const insight = companyInsights?.[c.id];
      const estimate = insight?.salary?.estimate;
      const matchResult = insight?.match;
      const color = salaryColor(estimate);
      const salaryLabel = estimate ? `€${estimate}k` : "";
      const eName = escapeHtml(c.name);
      const eId = escapeHtml(c.id);

      const openRoles = c.openRoles || [];
      const primaryUrl = openRoles.length > 0 ? openRoles[0].url : c.jobUrl;
      const safePrimaryUrl = isSafeUrl(primaryUrl) ? escapeHtml(primaryUrl) : null;

      const si = stackIndex[c.id] || 0;
      const stemH = si * STACK_HEIGHT;
      const stemHtml = stemH > 0
        ? `<div style="width:2px;height:${stemH}px;background:${color}50"></div>`
        : "";
      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" data-company="${eId}">
          <div style="background:${color};color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;white-space:nowrap;font-family:DM Sans,sans-serif;box-shadow:0 2px 12px ${color}60;border:2px solid ${color}40;transition:transform .2s">${escapeHtml(c.logo)} ${eName}${salaryLabel ? ` · ${salaryLabel}` : ""}</div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid ${color};margin-top:-1px"></div>
          ${stemHtml}
          <div style="width:8px;height:8px;border-radius:50%;background:${color};margin-top:2px;box-shadow:0 0 8px ${color}80"></div>
        </div>`,
        iconSize: [0, 0], iconAnchor: [0, 45 + stemH],
      });

      const commuteNote = km < 2 ? "🚶 walkable" : km < 5 ? "🚲 bikeable" : km < 12 ? "🚇 quick transit" : "🚆 longer commute";

      const matchRow = matchResult
        ? `<div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Match</div><div style="font-size:14px;font-weight:700;color:${matchResult.score >= 70 ? "#10b981" : matchResult.score >= 50 ? "#f59e0b" : "#ef4444"}">${matchResult.score}%</div></div>`
        : "";

      const eIndustry = escapeHtml(c.industry || "");
      const eAddress = escapeHtml(c.address || "");
      const eNotes = escapeHtml(c.notes || "");
      const eLogo = escapeHtml(c.logo);
      const eLangs = (c.languages || []).map(l => escapeHtml(l)).join(", ");
      const eTech = (c.techStack || []).slice(0, 6).map(t => `<span style="background:#10b98118;color:#10b981;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${escapeHtml(t)}</span>`).join("");
      const eCulture = (c.cultureTags || []).map(t => `<span style="background:#8b5cf618;color:#8b5cf6;padding:2px 6px;border-radius:4px;font-size:10px">${escapeHtml(t)}</span>`).join("");
      // Open roles section (for both curated+matched and scraped entries)
      const rolesHtml = openRoles.length > 0 ? `<div style="margin-top:8px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Open roles (${openRoles.length})</div>${openRoles.map((role, ri) => {
        const eTitle = escapeHtml(role.title);
        const roleUrl = isSafeUrl(role.url) ? escapeHtml(role.url) : null;
        const roleEst = insight?.roles?.[ri]?.estimate;
        const estLabel = roleEst ? ` · €${roleEst}k` : "";
        return roleUrl
          ? `<a href="${roleUrl}" target="_blank" rel="noopener noreferrer" style="display:block;padding:4px 6px;margin:2px 0;background:#18181b;border-radius:4px;color:#a1a1aa;text-decoration:none;font-size:11px;border:1px solid #27272a">${eTitle}<span style="color:#6366f1;font-weight:600">${estLabel}</span></a>`
          : `<div style="padding:4px 6px;margin:2px 0;background:#18181b;border-radius:4px;color:#a1a1aa;font-size:11px">${eTitle}${estLabel}</div>`;
      }).join("")}</div>` : "";

      const ratingsBlock = (c.kununuRating != null || c.glassdoorRating != null) ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
            <div style="background:#18181b;padding:6px 8px;border-radius:6px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Kununu</div><div style="font-size:14px;font-weight:700;color:#facc15">${c.kununuRating != null ? c.kununuRating+" ★" : "N/A"}</div></div>
            <div style="background:#18181b;padding:6px 8px;border-radius:6px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Glassdoor</div><div style="font-size:14px;font-weight:700;color:#facc15">${c.glassdoorRating != null ? c.glassdoorRating+" ★" : "N/A"}</div></div>
          </div>` : "";

      const statusBadge = `<span style="margin-left:auto;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;color:#06b6d4;background:#06b6d420;border:1px solid #06b6d430">Live</span>`;

      const popup = `
        <div style="font-family:DM Sans,sans-serif;min-width:260px;padding:4px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="font-size:28px">${eLogo}</span>
            <div>
              <div style="font-size:15px;font-weight:700;color:#fafafa">${eName}</div>
              <div style="font-size:11px;color:#a1a1aa">${eIndustry}</div>
            </div>
            ${statusBadge}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
            ${estimate?`<div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Salary</div><div style="font-size:16px;font-weight:700;color:${color}">€${estimate}k</div></div>`:""}
            <div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Distance</div><div style="font-size:14px;font-weight:700;color:#a1a1aa">${km.toFixed(1)} km</div></div>
            <div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Commute</div><div style="font-size:11px;font-weight:600;color:#a1a1aa">${commuteNote}</div></div>
          </div>
          ${matchRow ? `<div style="display:grid;grid-template-columns:1fr;gap:6px;margin-bottom:10px">${matchRow}</div>` : ""}
          ${ratingsBlock}
          ${eTech?`<div style="margin-bottom:8px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Tech</div><div style="display:flex;flex-wrap:wrap;gap:3px">${eTech}</div></div>`:""}
          ${eCulture?`<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${eCulture}</div>`:""}
          ${eAddress?`<div style="font-size:11px;color:#a1a1aa">📍 ${eAddress}</div>`:""}
          ${eLangs?`<div style="font-size:11px;color:#71717a;margin-top:2px">🗣 ${eLangs}</div>`:""}
          ${eNotes?`<div style="margin-top:8px;padding:6px 8px;background:#6366f110;border-left:2px solid #6366f1;border-radius:4px;font-size:11px;color:#a1a1aa;font-style:italic">${eNotes}</div>`:""}
          ${rolesHtml}
          ${safePrimaryUrl?`<div style="margin-top:10px"><a href="${safePrimaryUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;padding:8px;background:#6366f120;color:#6366f1;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;border:1px solid #6366f130">View listing ↗</a></div>`:""}
        </div>`;

      // Markers at true positions — clustering handles overlap
      const baseZ = Math.round((90 - c.lat) * 100);
      const marker = L.marker([c.lat, c.lng], { icon, zIndexOffset: baseZ })
        .bindPopup(popup, { maxWidth: 320, className: "dark-popup", closeButton: true });

      // Stash estimate on marker so cluster icon can read it
      marker._companyEstimate = estimate;

      marker.on("mouseover", () => {
        marker.setZIndexOffset(10000);
        if (marker._homeLine) return;
        marker._homeLine = L.polyline([home, [c.lat, c.lng]], { color, weight: 2, dashArray: "6 4", opacity: 0.6 }).addTo(map);
      });
      marker.on("mouseout", () => {
        if (!marker.isPopupOpen()) marker.setZIndexOffset(baseZ);
        if (marker._homeLine && !marker.isPopupOpen()) { map.removeLayer(marker._homeLine); marker._homeLine = null; }
      });
      marker.on("popupclose", () => {
        marker.setZIndexOffset(baseZ);
        if (marker._homeLine) { map.removeLayer(marker._homeLine); marker._homeLine = null; }
      });

      clusterGroup.addLayer(marker);
      markersRef.current.push(marker);
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;
  }, [ready, companies, home, homeAddress, companyInsights, onHomeMove, profile]);

  useEffect(() => () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } }, []);

  const legendItems = [
    { label: "€70k+", color: "#10b981" },
    { label: "€60–69k", color: "#f59e0b" },
    { label: "€55–59k", color: "#fb923c" },
    { label: "< €55k", color: "#ef4444" },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>📍 Vienna Office Map</h3>
        <div className={styles.legend}>
          {legendItems.map(s => (
            <div key={s.label} className={styles.legendItem}>
              <div className={styles.legendDot} style={{ background: s.color, boxShadow: `0 0 6px ${s.color}60` }} />
              <span className={styles.legendLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.mapWrapper}>
        {!ready ? (
          <div className={styles.loading}>Loading map…</div>
        ) : (
          <div ref={containerRef} className={styles.mapContainer} />
        )}
      </div>
    </div>
  );
}
