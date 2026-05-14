const AGGREGATOR_COMPANIES = new Set(["devjobs"]);

export function deriveJobCompany(job) {
  const company = String(job?.company || "").trim();
  const title = String(job?.title || "").trim();
  if (!company) return company;

  if (AGGREGATOR_COMPANIES.has(company.toLowerCase())) {
    const employerMatch = title.match(/\s@\s(.+?)\s*$/);
    if (employerMatch?.[1]) {
      return employerMatch[1].trim();
    }
  }

  return company;
}

export function isRemoteRole(job) {
  const text = [
    job?.title,
    job?.address,
    job?.city,
    job?.location,
  ].filter(Boolean).join(" ");

  return /\b(remote|remote work|work from home|home office|fully remote|100%\s*remote)\b/i.test(text);
}
