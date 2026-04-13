// @ts-check

/**
 * nominatim.js — Shared client for OpenStreetMap Nominatim geocoding.
 *
 * Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
 * - Max 1 request per second
 * - Provide identifying Referer (browser sends this automatically)
 * - No large-scale bulk geocoding (client-side usage is inherently low-volume)
 *
 * This module enforces the 1 req/s limit via a simple queue. Both MapView
 * (reverse geocode on pin drag) and SettingsModal (forward geocode on
 * address lookup) route through here.
 */

const BASE = "https://nominatim.openstreetmap.org";
const MIN_INTERVAL_MS = 1100; // slightly above 1s to stay safe
const TIMEOUT_MS = 8000;

let lastRequestTime = 0;

/**
 * Throttled fetch — ensures at least MIN_INTERVAL_MS between Nominatim requests.
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function throttledFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime));
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();
  return fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
}

/**
 * Forward geocode: address string → { lat, lng } or null.
 * Appends ", Vienna, Austria" to bias results toward Vienna.
 *
 * @param {string} address
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function geocodeForward(address) {
  if (!address || address.trim().length < 3) return null;
  const q = encodeURIComponent(`${address}, Vienna, Austria`);
  const url = `${BASE}/search?q=${q}&format=json&limit=1&addressdetails=1`;
  const res = await throttledFetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.length === 0) return null;
  return {
    lat: Math.round(parseFloat(data[0].lat) * 10000) / 10000,
    lng: Math.round(parseFloat(data[0].lon) * 10000) / 10000,
  };
}

/**
 * Reverse geocode: lat/lng → address string or null.
 * Returns a formatted short address (road, house number, postcode, suburb).
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string | null>}
 */
export async function geocodeReverse(lat, lng) {
  const url = `${BASE}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
  const res = await throttledFetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const a = data.address || {};
  const parts = [a.road, a.house_number, a.postcode, a.suburb || a.city_district].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  if (data.display_name) return data.display_name.split(",").slice(0, 3).join(",").trim();
  return null;
}
