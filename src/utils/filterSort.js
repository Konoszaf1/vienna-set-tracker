export function filterAndSort({ companies, companyInsights, search, filterLang, filterCulture, sortBy, salaryMin, salaryMax }) {
  return companies
    .filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
          !(c.industry || "").toLowerCase().includes(search.toLowerCase()) &&
          !c.techStack.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
      if (filterLang === "de-fluent" && c.langReq !== "de-fluent") return false;
      if (filterLang === "accessible" && c.langReq === "de-fluent") return false;
      if (filterCulture !== "all" && !c.cultureTags.includes(filterCulture)) return false;
      const estimate = companyInsights[c.id]?.salary?.estimate;
      if (salaryMin != null && (estimate == null || estimate < salaryMin)) return false;
      if (salaryMax != null && (estimate == null || estimate > salaryMax)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "newest") {
        const da = a.firstSeen || "";
        const db = b.firstSeen || "";
        return db.localeCompare(da); // newest first
      }
      if (sortBy === "salary") {
        const sa = companyInsights[a.id]?.salary?.estimate ?? -1;
        const sb = companyInsights[b.id]?.salary?.estimate ?? -1;
        return sb - sa;
      }
      if (sortBy === "match") {
        const ma = companyInsights[a.id]?.match?.score ?? -1;
        const mb = companyInsights[b.id]?.match?.score ?? -1;
        return mb - ma;
      }
      if (sortBy === "rating") {
        const ra = [a.kununuRating, a.glassdoorRating].filter(r => r != null);
        const rb = [b.kununuRating, b.glassdoorRating].filter(r => r != null);
        const avgA = ra.length ? ra.reduce((x, y) => x + y, 0) / ra.length : 0;
        const avgB = rb.length ? rb.reduce((x, y) => x + y, 0) / rb.length : 0;
        return avgB - avgA;
      }
      return 0;
    });
}
