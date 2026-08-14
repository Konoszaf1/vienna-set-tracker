function roleEstimate(salaryMap, companyId, role, index) {
  const salary = salaryMap?.[companyId];
  const match = salary?.roles?.find(item =>
    (role.id && item.id === role.id) || (role.url && item.url === role.url)
  );
  return match?.estimate ?? salary?.roles?.[index]?.estimate ?? salary?.best ?? null;
}

function languageSummary(roles, fallback) {
  if (!roles?.length) return fallback || "unknown";
  const counts = {};
  for (const role of roles) {
    const language = role.langReq || "unknown";
    counts[language] = (counts[language] || 0) + 1;
  }
  const order = ["de-fluent", "de-basic", "en", "unknown"];
  return order.reduce((best, language) => {
    if ((counts[language] || 0) > (counts[best] || 0)) return language;
    return best;
  }, "unknown");
}

function roleMatches({ role, companyMatchesSearch, query, language, estimate, salaryMin, salaryMax }) {
  if (query && !companyMatchesSearch) {
    const text = [
      role.title,
      role.company,
      role.source,
      role.city,
      role.address,
      ...(role.techStack || []),
    ].filter(Boolean).join(" ").toLowerCase();
    if (!text.includes(query)) return false;
  }

  const roleLanguage = role.langReq || "unknown";
  if (language === "de-fluent" && roleLanguage !== "de-fluent") return false;
  if (language === "accessible" && !["en", "de-basic"].includes(roleLanguage)) return false;
  if (language === "unknown" && roleLanguage !== "unknown") return false;
  if (salaryMin != null && (estimate == null || estimate < salaryMin)) return false;
  if (salaryMax != null && (estimate == null || estimate > salaryMax)) return false;
  return true;
}

export function filterAndSort({ companies, salaryMap, search, filterLang, sortBy, salaryMin, salaryMax }) {
  const query = String(search || "").trim().toLowerCase();
  salaryMap ||= {};
  const filtered = [];

  for (const company of companies) {
    const companyText = [company.name, ...(company.techStack || [])].filter(Boolean).join(" ").toLowerCase();
    const companyMatchesSearch = !query || companyText.includes(query);
    const roles = Array.isArray(company.openRoles) ? company.openRoles : null;

    if (roles) {
      const matchingRoles = roles.filter((role, index) => roleMatches({
        role,
        companyMatchesSearch,
        query,
        language: filterLang,
        estimate: roleEstimate(salaryMap, company.id, role, index),
        salaryMin,
        salaryMax,
      }));
      if (matchingRoles.length === 0) continue;

      const estimates = matchingRoles
        .map(role => roleEstimate(salaryMap, company.id, role, roles.indexOf(role)))
        .filter(value => value != null);
      const dates = matchingRoles.map(role => role.firstSeenAt).filter(Boolean).sort();
      filtered.push({
        ...company,
        openRoles: matchingRoles,
        matchingRoleCount: matchingRoles.length,
        totalRoleCount: roles.length,
        matchingSalaryBest: estimates.length ? Math.max(...estimates) : null,
        firstSeen: dates.at(-1) || company.firstSeen || null,
        langReq: languageSummary(matchingRoles, company.langReq),
      });
      continue;
    }

    if (query && !companyMatchesSearch) continue;
    if (filterLang === "de-fluent" && company.langReq !== "de-fluent") continue;
    if (filterLang === "accessible" && !["en", "de-basic"].includes(company.langReq)) continue;
    if (filterLang === "unknown" && company.langReq !== "unknown") continue;
    const estimate = salaryMap[company.id]?.best;
    if (salaryMin != null && (estimate == null || estimate < salaryMin)) continue;
    if (salaryMax != null && (estimate == null || estimate > salaryMax)) continue;
    filtered.push(company);
  }

  return filtered.sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "newest") return String(b.firstSeen || "").localeCompare(String(a.firstSeen || ""));
    if (sortBy === "salary") {
      const salary = company => company.matchingSalaryBest ?? salaryMap[company.id]?.best ?? -1;
      return salary(b) - salary(a);
    }
    if (sortBy === "rating") {
      const rating = company => company.kununuRating ?? -1;
      return rating(b) - rating(a);
    }
    return 0;
  });
}
