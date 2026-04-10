export const STORAGE_KEY = "vienna-set-dashboard-data";
export const PROFILE_STORAGE_KEY = "vienna-set-dashboard-profile";

// Neutral default home: Stephansplatz, Vienna city center.
// The actual user home is stored in the profile (defaultProfile.json or localStorage).
export const DEFAULT_HOME = [48.2082, 16.3738];
export const DEFAULT_HOME_ADDRESS = "Stephansplatz, 1010 Wien";

// Legacy aliases — kept so any other code referencing HOME still compiles.
// MapView and App now read from profile instead.
export const HOME = DEFAULT_HOME;
export const HOME_ADDRESS = DEFAULT_HOME_ADDRESS;

export const STATUS_OPTIONS = [
  { value: "interested", label: "Interested", color: "#6366f1", bg: "#6366f120" },
  { value: "applied", label: "Applied", color: "#f59e0b", bg: "#f59e0b20" },
  { value: "interviewing", label: "Interviewing", color: "#06b6d4", bg: "#06b6d420" },
  { value: "offer", label: "Offer", color: "#10b981", bg: "#10b98120" },
  { value: "rejected", label: "Rejected", color: "#ef4444", bg: "#ef444420" },
  { value: "withdrawn", label: "Withdrawn", color: "#6b7280", bg: "#6b728020" },
];

export const CULTURE_OPTIONS = [
  "startup", "corporate", "hybrid", "remote-friendly", "on-site",
  "international", "fast-paced", "agile", "growth", "traditional",
  "engineering-heavy", "AI-driven", "large-enterprise", "stable", "product-company",
];

export const LANG_OPTIONS = ["English", "German", "Both"];
