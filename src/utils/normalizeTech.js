const TECH_NAMES = new Map([
  ["jira", "Jira"],
  ["github actions", "GitHub Actions"],
  ["github action", "GitHub Actions"],
  ["gitlab ci", "GitLab CI"],
  ["ci/cd", "CI/CD"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["cypress", "Cypress"],
  ["playwright", "Playwright"],
  ["selenium", "Selenium"],
]);

export function canonicalizeTechStack(values) {
  const result = new Map();
  for (const value of Array.isArray(values) ? values : []) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    const rawKey = raw.toLowerCase().replace(/\s+/g, " ");
    const display = TECH_NAMES.get(rawKey) || raw;
    result.set(display.toLowerCase(), display);
  }
  return [...result.values()].sort((a, b) => a.localeCompare(b));
}
