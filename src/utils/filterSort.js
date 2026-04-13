export function filterAndSort({ companies, salaryMap, search, filterLang, sortBy, salaryMin, salaryMax }) {
  return companies
    .filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterLang === "de-fluent" && c.langReq !== "de-fluent") return false;
      if (filterLang === "accessible" && c.langReq === "de-fluent") return false;
      const estimate = salaryMap[c.id]?.best;
      if (salaryMin != null && (estimate == null || estimate < salaryMin)) return false;
      if (salaryMax != null && (estimate == null || estimate > salaryMax)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "newest") {
        const da = a.firstSeen || "";
        const db = b.firstSeen || "";
        return db.localeCompare(da);
      }
      if (sortBy === "salary") {
        const sa = salaryMap[a.id]?.best ?? -1;
        const sb = salaryMap[b.id]?.best ?? -1;
        return sb - sa;
      }
      if (sortBy === "rating") {
        const avg = (c) => {
          const k = c.kununuRating, g = c.glassdoorRating;
          if (k == null && g == null) return -1;
          if (k != null && g != null) return (k + g) / 2;
          return k ?? g;
        };
        return avg(b) - avg(a);
      }
      return 0;
    });
}
