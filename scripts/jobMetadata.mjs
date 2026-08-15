import { parse } from "node-html-parser";

const PERIODS = {
  YEAR: 1,
  ANNUAL: 1,
  MONTH: 14,
  MONTHLY: 14,
  WEEK: 52,
  WEEKLY: 52,
  DAY: 260,
  DAILY: 260,
  HOUR: 38.5 * 52,
  HOURLY: 38.5 * 52,
};

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function normalizePublishedAt(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00.000Z`)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function annualizeSalary(value, period = "YEAR") {
  const amount = finitePositive(value);
  if (amount == null) return null;
  const factor = PERIODS[String(period || "YEAR").toUpperCase()] || 1;
  return Math.round(amount * factor);
}

function parseEuropeanNumber(value) {
  const compact = String(value || "").replace(/[^\d.,]/g, "");
  if (!compact) return null;
  const lastDot = compact.lastIndexOf(".");
  const lastComma = compact.lastIndexOf(",");
  let normalized = compact;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    normalized = compact
      .replace(decimal === "," ? /\./g : /,/g, "")
      .replace(decimal, ".");
  } else {
    const separator = lastComma >= 0 ? "," : lastDot >= 0 ? "." : null;
    if (separator) {
      const decimals = compact.length - compact.lastIndexOf(separator) - 1;
      normalized = decimals === 3
        ? compact.replace(new RegExp(`\\${separator}`, "g"), "")
        : compact.replace(separator, ".");
    }
  }
  return finitePositive(normalized);
}

function salaryFields(min, max, { period = "YEAR", currency = "EUR", source, kind } = {}) {
  if (currency && String(currency).toUpperCase() !== "EUR") return {};
  let annualMin = annualizeSalary(min, period);
  let annualMax = annualizeSalary(max, period);
  if (annualMin == null && annualMax == null) return {};
  if (annualMin != null && annualMax != null && annualMin > annualMax) {
    [annualMin, annualMax] = [annualMax, annualMin];
  }
  const inferredKind = kind || (annualMin != null && annualMax != null && annualMin !== annualMax ? "range" : "minimum");
  return {
    advertisedSalaryMin: annualMin ?? annualMax,
    advertisedSalaryMax: inferredKind === "range" ? (annualMax ?? annualMin) : null,
    advertisedSalaryCurrency: "EUR",
    advertisedSalaryPeriod: "year",
    advertisedSalaryKind: inferredKind,
    advertisedSalarySource: source || "listing",
  };
}

function findJobPosting(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  if (types.some(type => String(type).toLowerCase() === "jobposting")) return value;
  for (const child of Object.values(value)) {
    const found = findJobPosting(child);
    if (found) return found;
  }
  return null;
}

function structuredSalary(baseSalary) {
  if (!baseSalary || typeof baseSalary !== "object") return {};
  const value = baseSalary.value && typeof baseSalary.value === "object"
    ? baseSalary.value
    : baseSalary;
  const period = value.unitText || value.unitCode || baseSalary.unitText || "YEAR";
  const currency = baseSalary.currency || value.currency || "EUR";
  const min = value.minValue ?? value.value ?? baseSalary.value;
  const max = value.maxValue ?? null;
  return salaryFields(min, max, {
    period,
    currency,
    source: "job-posting-structured-data",
    kind: max != null ? "range" : "minimum",
  });
}

export function extractSalaryFromText(value) {
  const text = String(value || "").replace(/\s+/g, " ");
  const amount = "([0-9][0-9.\\s]*(?:,[0-9]{1,2})?)";
  const currency = "(?:€|EUR)";
  const separator = "(?:-|–|—|bis|und)";
  const periodPattern = "(jährlich|pro\\s+jahr|jahresbrutto|annual|monatlich|pro\\s+monat|brutto\\s*\\/\\s*monat)";
  const range = new RegExp(`${currency}\\s*${amount}\\s*${separator}\\s*(?:${currency}\\s*)?${amount}[^.]{0,60}?${periodPattern}`, "i").exec(text)
    || new RegExp(`${amount}\\s*${separator}\\s*${amount}\\s*${currency}[^.]{0,60}?${periodPattern}`, "i").exec(text);
  if (range) {
    const period = /monat/i.test(range.at(-1)) ? "MONTH" : "YEAR";
    return salaryFields(parseEuropeanNumber(range[1]), parseEuropeanNumber(range[2]), {
      period,
      source: "listing-text",
      kind: "range",
    });
  }

  const minimum = new RegExp(`(?:ab|mindestens|minimum|min\\.)[^€0-9]{0,20}(?:${currency}\\s*)?${amount}\\s*(?:${currency})?[^.]{0,60}?${periodPattern}`, "i").exec(text)
    || new RegExp(`${currency}\\s*${amount}[^.]{0,40}?(?:mindestens|minimum)[^.]{0,30}?${periodPattern}`, "i").exec(text);
  if (minimum) {
    const period = /monat/i.test(minimum.at(-1)) ? "MONTH" : "YEAR";
    return salaryFields(parseEuropeanNumber(minimum[1]), null, {
      period,
      source: "listing-text",
      kind: "minimum",
    });
  }
  return {};
}

export function extractJobPostingMetadata(html) {
  const root = parse(String(html || ""));
  let posting = null;
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      posting = findJobPosting(JSON.parse(script.text));
      if (posting) break;
    } catch {
      // Ignore unrelated or malformed JSON-LD blocks.
    }
  }

  const publishedAt = normalizePublishedAt(posting?.datePosted);
  const textSalary = extractSalaryFromText(root.textContent);
  const salary = Object.keys(structuredSalary(posting?.baseSalary)).length > 0
    ? structuredSalary(posting.baseSalary)
    : textSalary;
  return {
    ...(publishedAt ? {
      publishedAt,
      publishedAtSource: "job-posting-structured-data",
      publishedAtConfidence: "high",
    } : {}),
    ...salary,
  };
}
