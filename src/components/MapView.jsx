import { useState, useEffect, useRef, useMemo } from "react";
import { DEFAULT_HOME, DEFAULT_HOME_ADDRESS, STATUS_OPTIONS } from "../constants";
import styles from './MapView.module.css';

export default function MapView({ companies, profile, companyInsights }) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const extraLayersRef = useRef([]);
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
    if (window.L) { setReady(true); return; }
    import("leaflet").then(mod => {
      window.L = mod.default || mod;
      setReady(true);
    });
  }, []);

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

      if (!document.getElementById("lf-dark")) {
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
          .leaflet-control-attribution a{color:#6366f1!important}`;
        document.head.appendChild(s);
      }
    }

    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
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
      html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer">
        <div style="background:#ef4444;color:#fff;font-size:13px;font-weight:700;padding:5px 12px;border-radius:10px;white-space:nowrap;font-family:DM Sans,sans-serif;box-shadow:0 2px 16px rgba(239,68,68,.5);border:2px solid #fca5a5">🏠 Home</div>
        <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid #ef4444;margin-top:-1px"></div>
        <div style="width:10px;height:10px;border-radius:50%;background:#ef4444;margin-top:2px;box-shadow:0 0 12px rgba(239,68,68,.8)"></div>
      </div>`,
      iconSize: [0, 0], iconAnchor: [0, 45],
    });
    L.marker(home, { icon: homeIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(`<div style="font-family:DM Sans,sans-serif;padding:4px"><div style="font-size:15px;font-weight:700;color:#fafafa">🏠 Home Base</div><div style="font-size:12px;color:#a1a1aa;margin-top:4px">${homeAddress}</div></div>`, { className: "dark-popup", closeButton: true });

    const salaryColor = (s) => !s ? "#6366f1" : s >= 70 ? "#10b981" : s >= 60 ? "#f59e0b" : s >= 55 ? "#fb923c" : "#ef4444";

    companies.forEach(c => {
      const km = dist(home[0], home[1], c.lat, c.lng);
      const color = salaryColor(c.myExpected);
      const salaryLabel = c.myExpected ? `€${c.myExpected}k` : "";

      // Get model estimate for popup display
      const insight = companyInsights?.[c.id];
      const modelEstimate = insight?.salary?.estimate;
      const matchResult = insight?.match;

      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" data-company="${c.id}">
          <div style="background:${color};color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;white-space:nowrap;font-family:DM Sans,sans-serif;box-shadow:0 2px 12px ${color}60;border:2px solid ${color}40;transition:transform .2s">${c.logo} ${c.name}${salaryLabel ? ` · ${salaryLabel}` : ""}</div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid ${color};margin-top:-1px"></div>
          <div style="width:8px;height:8px;border-radius:50%;background:${color};margin-top:2px;box-shadow:0 0 8px ${color}80"></div>
        </div>`,
        iconSize: [0, 0], iconAnchor: [0, 45],
      });

      const commuteNote = km < 2 ? "🚶 walkable" : km < 5 ? "🚲 bikeable" : km < 12 ? "🚇 quick transit" : "🚆 longer commute";
      const st = STATUS_OPTIONS.find(s => s.value === c.status) || STATUS_OPTIONS[0];

      // Model row for popup (only if model data available)
      const modelRow = modelEstimate
        ? `<div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Model</div><div style="font-size:14px;font-weight:700;color:${salaryColor(modelEstimate)}">€${modelEstimate}k</div></div>`
        : "";
      const matchRow = matchResult
        ? `<div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Match</div><div style="font-size:14px;font-weight:700;color:${matchResult.score >= 70 ? "#10b981" : matchResult.score >= 50 ? "#f59e0b" : "#ef4444"}">${matchResult.score}%</div></div>`
        : "";

      const popup = `
        <div style="font-family:DM Sans,sans-serif;min-width:260px;padding:4px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="font-size:28px">${c.logo}</span>
            <div>
              <div style="font-size:15px;font-weight:700;color:#fafafa">${c.name}</div>
              <div style="font-size:11px;color:#a1a1aa">${c.industry}</div>
            </div>
            <span style="margin-left:auto;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;color:${st.color};background:${st.bg};border:1px solid ${st.color}30">${st.label}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
            ${c.myExpected?`<div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Salary</div><div style="font-size:16px;font-weight:700;color:${color}">€${c.myExpected}k</div></div>`:""}
            <div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Distance</div><div style="font-size:14px;font-weight:700;color:#a1a1aa">${km.toFixed(1)} km</div></div>
            <div style="background:#18181b;padding:6px 8px;border-radius:6px;text-align:center"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Commute</div><div style="font-size:11px;font-weight:600;color:#a1a1aa">${commuteNote}</div></div>
          </div>
          ${(modelRow || matchRow) ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">${modelRow}${matchRow}</div>` : ""}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
            <div style="background:#18181b;padding:6px 8px;border-radius:6px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Kununu</div><div style="font-size:14px;font-weight:700;color:#facc15">${c.kununuRating != null ? c.kununuRating+" ★" : "N/A"}</div></div>
            <div style="background:#18181b;padding:6px 8px;border-radius:6px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Glassdoor</div><div style="font-size:14px;font-weight:700;color:#facc15">${c.glassdoorRating != null ? c.glassdoorRating+" ★" : "N/A"}</div></div>
          </div>
          <div style="margin-bottom:8px"><div style="font-size:8px;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Tech</div><div style="display:flex;flex-wrap:wrap;gap:3px">${c.techStack.slice(0,6).map(t=>`<span style="background:#10b98118;color:#10b981;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${t}</span>`).join("")}</div></div>
          <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${c.cultureTags.map(t=>`<span style="background:#8b5cf618;color:#8b5cf6;padding:2px 6px;border-radius:4px;font-size:10px">${t}</span>`).join("")}</div>
          <div style="font-size:11px;color:#a1a1aa">📍 ${c.address}</div>
          <div style="font-size:11px;color:#71717a;margin-top:2px">🗣 ${c.languages.join(", ")}</div>
          ${c.notes?`<div style="margin-top:8px;padding:6px 8px;background:#6366f110;border-left:2px solid #6366f1;border-radius:4px;font-size:11px;color:#a1a1aa;font-style:italic">${c.notes}</div>`:""}
          ${c.jobUrl?`<div style="margin-top:10px"><a href="${c.jobUrl}" target="_blank" style="display:block;text-align:center;padding:8px;background:#6366f120;color:#6366f1;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;border:1px solid #6366f130">View Job ↗</a></div>`:""}
        </div>`;

      const marker = L.marker([c.lat, c.lng], { icon })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 320, className: "dark-popup", closeButton: true });

      marker.on("mouseover", () => {
        if (marker._homeLine) return;
        marker._homeLine = L.polyline([home, [c.lat, c.lng]], { color, weight: 2, dashArray: "6 4", opacity: 0.6 }).addTo(map);
      });
      marker.on("mouseout", () => {
        if (marker._homeLine && !marker.isPopupOpen()) { map.removeLayer(marker._homeLine); marker._homeLine = null; }
      });
      marker.on("popupclose", () => {
        if (marker._homeLine) { map.removeLayer(marker._homeLine); marker._homeLine = null; }
      });

      markersRef.current.push(marker);
    });

    map.setView(home, 13);
  }, [ready, companies, home, homeAddress, companyInsights]);

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
