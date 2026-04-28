// Coordinates that the upstream job sources return when they only know
// "Vienna" — they geocode the city itself, not an office. Treat these as
// "no real location" so we prefer any role with a more specific coord.
export const GENERIC_VIENNA_POINTS = [
  { lat: 48.1857192, lng: 16.4221587 },
  { lat: 48.1822872, lng: 16.3923295 },
  { lat: 48.2083537, lng: 16.3725042 },
];

const GENERIC_TOL = 0.001;

export function isGenericViennaCoord(lat, lng) {
  if (lat == null || lng == null) return true;
  return GENERIC_VIENNA_POINTS.some(
    p => Math.abs(p.lat - lat) < GENERIC_TOL && Math.abs(p.lng - lng) < GENERIC_TOL
  );
}

function cacheLookup(cache, name) {
  if (!cache || !name) return null;
  const key = name.toLowerCase().trim();
  const hit = cache[key];
  if (hit && hit.lat != null && hit.lng != null) {
    return { lat: hit.lat, lng: hit.lng, address: hit.address || null };
  }
  return null;
}

/**
 * Resolve the office location for a group of roles belonging to one company.
 *
 * Resolution priority:
 *   1. Manual override (matched by lowercased company name from any role)
 *   2. Geocoded cache (same lookup)
 *   3. Most-specific lat/lng among the roles, skipping the generic
 *      "Vienna centroid" points the scrapers fall back to
 *   4. Any role's lat/lng, even if generic — better something than nothing
 *   5. null lat/lng (caller decides what to do)
 */
export function resolveCompanyLocation(roles, locationsCache, manualOverrides) {
  const names = [...new Set(roles.map(r => r.company).filter(Boolean))];

  for (const name of names) {
    const hit = cacheLookup(manualOverrides, name);
    if (hit) return { ...hit, source: "manual" };
  }
  for (const name of names) {
    const hit = cacheLookup(locationsCache, name);
    if (hit) return { ...hit, source: "cache" };
  }

  const specific = roles.find(r =>
    r.lat != null && r.lng != null && !isGenericViennaCoord(r.lat, r.lng)
  );
  if (specific) {
    return { lat: specific.lat, lng: specific.lng, address: specific.address || null, source: "role-specific" };
  }

  const generic = roles.find(r => r.lat != null && r.lng != null);
  if (generic) {
    return { lat: generic.lat, lng: generic.lng, address: generic.address || null, source: "role-generic" };
  }

  return { lat: null, lng: null, address: null, source: "unresolved" };
}
