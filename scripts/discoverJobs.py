#!/usr/bin/env python3
"""Discover test/QA/SDET jobs in Vienna via JobSpy (LinkedIn, Indeed, Google).

Complements the karriere.at + kununu scraping in search-jobs.mjs by searching
additional boards. Each run reconciles discoveries with the prior feed; stale
rows remain until liveness verification confirms that they have closed.

Usage:
  python scripts/discoverJobs.py              # dry-run: show what would change
  python scripts/discoverJobs.py --apply      # merge into jobs.json
"""

import hashlib
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from jobspy import scrape_jobs

ROOT = Path(__file__).resolve().parent.parent
JOBS_FILE = ROOT / "public" / "jobs.json"
GEOCACHE_FILE = ROOT / "public" / "geocoding-cache.json"

USER_AGENT = (
    "vienna-set-tracker/1.0 "
    "(+https://github.com/Konoszaf1/vienna-set-tracker)"
)

# ---------------------------------------------------------------------------
# Search strategy — covers the full SDET/QA vocabulary in DACH region.
# Each term is searched across all SITES, so keep the list focused to
# avoid rate-limit issues while still casting a wide net.
# ---------------------------------------------------------------------------
SEARCHES = [
    "test automation engineer",
    "SDET",
    "QA engineer",
    "quality assurance engineer",
    "software tester",
    "test engineer",
    "QA automation",
    "Testautomatisierung",          # German — catches DACH-only postings
]

SITES = ["indeed", "linkedin", "google"]
RESULTS_PER_SITE = 25              # per search term per site
HOURS_OLD = 720                     # 30 days

# ---------------------------------------------------------------------------
# Validation — mirrors scripts/jobValidator.mjs three-stage filter
# ---------------------------------------------------------------------------

REJECT_MANAGEMENT = True

# Stage 1: Domain exclusion — non-software "quality" roles
DOMAIN_EXCLUSIONS = [
    (re.compile(r"\bpharma", re.I), "domain-pharma"),
    (re.compile(r"\barzneimittel", re.I), "domain-pharma"),
    (re.compile(r"\bmedikament", re.I), "domain-pharma"),
    (re.compile(r"\bklinisch", re.I), "domain-pharma"),
    (re.compile(r"\bclinical", re.I), "domain-pharma"),
    (re.compile(r"\belectrical\s+qa", re.I), "domain-electrical"),
    (re.compile(r"\bqa\s*/\s*qc", re.I), "domain-electrical"),
    (re.compile(r"quality.*officer.*operations", re.I), "domain-operations"),
    (re.compile(r"\bcustomer\s+care", re.I), "domain-customer-service"),
    (re.compile(r"\bcall\s*cent(?:er|re)", re.I), "domain-customer-service"),
    (re.compile(r"\bquality\s+excellence", re.I), "domain-customer-service"),
    (re.compile(r"\bpayroll", re.I), "domain-payroll"),
    (re.compile(r"\bfood\s+safety", re.I), "domain-food"),
    (re.compile(r"\bgmp\b", re.I), "domain-pharma"),
    (re.compile(r"\biso\s*9001", re.I), "domain-manufacturing"),
    (re.compile(r"\bmanufacturing\s+quality", re.I), "domain-manufacturing"),
    (re.compile(r"\blieferant", re.I), "domain-supply-chain"),
]

# Stage 2: Role-type whitelist — must match at least one
ROLE_WHITELIST = re.compile(
    r"sdet|software\s+engineer.*test|engineer\s+in\s+test"
    r"|test\s+(?:automation\s+)?engineer|automation\s+engineer"
    r"|qa\s+automation\s+engineer|technical\s+qa\s+lead"
    r"|qa\s+engineer|quality\s+(?:assurance\s+)?engineer"
    r"|test\s*automatisier|testautomatisierung(?:sing|seng)"
    r"|software\s+test|software[-\s]?tester"
    r"|testingenieur|test\s+architect|testarchitekt",
    re.IGNORECASE,
)

# Stage 3: Management filter
MANAGEMENT_PATTERN = re.compile(
    r"\b(?:head\s+of|leiter(?:in)?|leitung|gruppenleit"
    r"|koordinator(?:in)?|coordinator|director)\b"
    r"|manager(?:\*?:?in)?\b",
    re.IGNORECASE,
)
HANDS_ON_SIGNAL = re.compile(
    r"engineer|entwickler|developer|architect|architekt", re.IGNORECASE
)


def validate_title(title: str) -> tuple[bool, str | None]:
    """Apply the three-stage title filter. Returns (valid, reason)."""
    for pattern, reason in DOMAIN_EXCLUSIONS:
        if pattern.search(title):
            return False, reason
    if not ROLE_WHITELIST.search(title):
        return False, "no-positive-match"
    if REJECT_MANAGEMENT and MANAGEMENT_PATTERN.search(title) and not HANDS_ON_SIGNAL.search(title):
        return False, "management-role"
    return True, None

# Corporate suffixes stripped during company-name normalisation
CORP_SUFFIXES = re.compile(
    r"\b(gmbh|ag|kg|gmbh\s*&\s*co\.?\s*kg|austria|österreich|"
    r"international|ltd|e\.?u\.?|inc|corp|se|ges\.?m\.?b\.?h|"
    r"konzern|group|holding)\b",
    re.IGNORECASE,
)

AGGREGATOR_COMPANIES = {"devjobs"}
TRACKING_PARAMS = {"ref", "refid", "trk", "trackingid", "originalsubdomain", "src", "source"}

# Gender markers stripped from titles during dedup comparison
GENDER_MARKERS = re.compile(
    r"\s*\(m/[wfd](/[xd])?\)\s*|\s*\(all\s+genders?\)\s*",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_company(name: str) -> str:
    """Lowercase, strip corporate suffixes, collapse whitespace."""
    result = CORP_SUFFIXES.sub("", name.lower())
    return re.sub(r"\s+", " ", result).strip()


def derive_company(company: str, title: str) -> str:
    """Replace job-board aggregator names with the employer embedded in the title."""
    company = company.strip()
    if company.lower() in AGGREGATOR_COMPANIES:
        match = re.search(r"\s@\s(.+?)\s*$", title)
        if match:
            return match.group(1).strip()
    return company


def clean_title(title: str) -> str:
    """Strip gender markers for comparison."""
    return GENDER_MARKERS.sub(" ", title).strip()


def titles_overlap(a: str, b: str) -> bool:
    """True when >50 % of the shorter title's words appear in the other."""
    wa = set(re.findall(r"\w{2,}", clean_title(a).lower()))
    wb = set(re.findall(r"\w{2,}", clean_title(b).lower()))
    if not wa or not wb:
        return False
    return len(wa & wb) / min(len(wa), len(wb)) > 0.5


def canonicalize_url(value: str) -> str:
    """Remove fragments and known tracking parameters without losing job IDs."""
    try:
        parts = urllib.parse.urlsplit(value.strip())
        query = [
            (key, val)
            for key, val in urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
            if not key.lower().startswith("utm_") and key.lower() not in TRACKING_PARAMS
        ]
        path = parts.path.rstrip("/") or "/"
        return urllib.parse.urlunsplit((
            parts.scheme.lower(),
            parts.netloc.lower(),
            path,
            urllib.parse.urlencode(sorted(query)),
            "",
        ))
    except Exception:
        return value.strip()


def stable_job_id(job: dict) -> str:
    url = canonicalize_url(str(job.get("url", "")))
    parsed = urllib.parse.urlsplit(url)
    host = parsed.netloc.removeprefix("www.")
    patterns = [
        ("linkedin", r"/jobs/view/(\d+)"),
        ("karriere", r"/jobs/(\d+)"),
        ("devjobs", r"/job/([^/]+)"),
    ]
    for board, pattern in patterns:
        match = re.search(pattern, parsed.path)
        if match:
            return f"job-{board}-{match.group(1)}"
    if host.endswith("indeed.com"):
        job_key = dict(urllib.parse.parse_qsl(parsed.query)).get("jk")
        if job_key:
            return f"job-indeed-{job_key}"
    digest = hashlib.sha256((url or f"{job.get('company')}::{job.get('title')}").encode()).hexdigest()[:16]
    return f"job-{digest}"


def job_fingerprint(job: dict) -> str:
    return f"{normalize_company(str(job.get('company', '')))}::{clean_title(str(job.get('title', ''))).lower()}"


def hydrate_job(job: dict, now: str, observed: bool, fallback_first_seen: str | None = None) -> dict:
    result = dict(job)
    raw_url = str(result.get("url", "")).strip()
    canonical_url = canonicalize_url(raw_url)
    result["id"] = result.get("id") or stable_job_id(result)
    result["url"] = canonical_url
    result["urlAliases"] = list(dict.fromkeys([
        *result.get("urlAliases", []), raw_url, canonical_url
    ]))
    result["sources"] = list(dict.fromkeys([
        *result.get("sources", []), result.get("source")
    ]))
    result["techStack"] = result.get("techStack") or []
    result["langReq"] = result.get("langReq") or "unknown"
    first_seen = result.get("firstSeenAt") or fallback_first_seen or now
    result["firstSeenAt"] = first_seen
    result["lastSeenAt"] = now if observed else result.get("lastSeenAt", first_seen)
    result["status"] = "open"
    result["consecutiveMisses"] = 0 if observed else int(result.get("consecutiveMisses", 0))
    return result


def atomic_write_json(path: Path, value) -> None:
    temporary = path.with_name(f"{path.name}.tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def geocode(address: str, cache: dict):
    """Geocode via Nominatim with cache.  Returns (lat, lng) or (None, None)."""
    key = address.lower().strip()
    if key in cache:
        return cache[key].get("lat"), cache[key].get("lng")
    try:
        q = urllib.parse.quote(f"{address}, Vienna, Austria")
        url = (
            f"https://nominatim.openstreetmap.org/search"
            f"?q={q}&format=json&limit=1"
        )
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        if data:
            lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
            # Vienna bounding-box sanity check
            if 48.12 <= lat <= 48.33 and 16.18 <= lng <= 16.58:
                cache[key] = {"lat": lat, "lng": lng}
                return lat, lng
    except Exception as e:
        print(f"    Geocode failed for '{address}': {e}", file=sys.stderr)
    return None, None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    apply = "--apply" in sys.argv

    # --- Load existing feed ------------------------------------------------
    if JOBS_FILE.exists():
        data = json.loads(JOBS_FILE.read_text(encoding="utf-8"))
    else:
        data = {
            "lastUpdated": "",
            "count": 0,
            "jobs": [],
            "searchLinks": [],
            "validation": {},
        }

    # Keep every prior source until its own connector has produced a complete
    # replacement or liveness verification has confirmed closure.
    kept_jobs = [
        j for j in data.get("jobs", [])
        if not j.get("source", "").startswith("jobspy-")
    ]
    previous_jobspy = [
        j for j in data.get("jobs", [])
        if j.get("source", "").startswith("jobspy-")
    ]
    prev_count = len(previous_jobspy)

    # Dedup index from kept (karriere.at + kununu) entries
    existing_urls = {canonicalize_url(j["url"]) for j in kept_jobs}
    dedup_pairs: list[tuple[str, str]] = [
        (normalize_company(j.get("company", "")), j.get("title", ""))
        for j in kept_jobs
    ]

    # --- Geocoding cache ---------------------------------------------------
    geocache: dict = {}
    if GEOCACHE_FILE.exists():
        try:
            geocache = json.loads(GEOCACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass

    # --- Discover ----------------------------------------------------------
    print(f"Discovering jobs via JobSpy ({', '.join(SITES)}) ...")
    if prev_count:
        print(f"  Replacing {prev_count} previous jobspy entries with fresh results\n")

    discovered: list[dict] = []
    seen_urls: set[str] = set()
    any_succeeded = False
    failed_terms: list[str] = []

    for term in SEARCHES:
        print(f'  Searching: "{term}" ...', end=" ", flush=True)
        try:
            results = scrape_jobs(
                site_name=SITES,
                search_term=term,
                google_search_term=f"{term} Vienna Austria",
                location="Vienna, Austria",
                results_wanted=RESULTS_PER_SITE,
                hours_old=HOURS_OLD,
                country_indeed="Austria",
            )
            any_succeeded = True
        except Exception as e:
            print(f"FAILED ({e})")
            failed_terms.append(term)
            continue

        if results.empty:
            print("0 results")
            continue

        added = 0
        for _, row in results.iterrows():
            url = canonicalize_url(str(row.get("job_url", "")).strip())
            title = str(row.get("title", "")).strip()
            company = str(row.get("company", "")).strip()
            location = str(row.get("location", ""))
            site = str(row.get("site", ""))
            company = derive_company(company, title)

            # Basic validation
            if not url or not title or not company:
                continue
            if url in seen_urls or url in existing_urls:
                continue

            # Must be in Vienna
            if not re.search(r"vienna|wien", location, re.IGNORECASE):
                continue

            # Three-stage title filter (mirrors jobValidator.mjs)
            ok, reason = validate_title(title)
            if not ok:
                continue

            # Cross-source dedup: same company + similar title already tracked
            norm = normalize_company(company)
            if any(
                norm == ec and titles_overlap(title, et)
                for ec, et in dedup_pairs
            ):
                continue

            seen_urls.add(url)
            dedup_pairs.append((norm, title))

            # Normalise address
            addr = location or "Wien"
            addr = re.sub(r",?\s*Austria$", "", addr, flags=re.IGNORECASE)
            addr = re.sub(r"^Vienna$", "Wien", addr, flags=re.IGNORECASE)

            discovered.append({
                "url": url,
                "title": title,
                "company": company,
                "source": f"jobspy-{site}",
                "address": addr,
                "city": "Wien",
                "zip": None,
                "lat": None,
                "lng": None,
                "techStack": [],
                "langReq": "unknown",
            })
            added += 1

        print(f"{added} new")
        time.sleep(2)  # rate-limit between search terms

    # --- Safety check ------------------------------------------------------
    if not any_succeeded:
        print(
            "\nERROR: All JobSpy searches failed. "
            "Keeping previous discoveries unchanged."
        )
        sys.exit(1)

    print(f"\n{'─' * 55}")
    print(f"Discovered {len(discovered)} jobs across {', '.join(SITES)}")

    # --- Geocode -----------------------------------------------------------
    to_geocode = [j for j in discovered if j["address"] and j["address"] != "Wien"]
    if to_geocode:
        print(f"\nGeocoding {len(to_geocode)} addresses ...")
        ok = 0
        for job in to_geocode:
            lat, lng = geocode(job["address"], geocache)
            if lat is not None:
                job["lat"], job["lng"] = lat, lng
                ok += 1
            time.sleep(1)  # Nominatim: max 1 req/s
        print(f"  {ok}/{len(to_geocode)} geocoded successfully")

    # --- Report ------------------------------------------------------------
    if discovered:
        print()
        for j in discovered:
            print(f"  [{j['source']:15s}] {j['company']}: {j['title']}")

    # --- Write -------------------------------------------------------------
    if apply:
        now = datetime.now(timezone.utc).isoformat()
        previous_by_url = {}
        previous_by_fingerprint = {}
        merged_jobspy = []
        for old in previous_jobspy:
            hydrated = hydrate_job(old, now, observed=False, fallback_first_seen=data.get("lastUpdated"))
            hydrated["sourceStatus"] = "retained-until-verified"
            merged_jobspy.append(hydrated)
            previous_by_url[hydrated["url"]] = hydrated
            previous_by_fingerprint[job_fingerprint(hydrated)] = hydrated

        for found in discovered:
            incoming = hydrate_job(found, now, observed=True)
            existing = previous_by_url.get(incoming["url"]) or previous_by_fingerprint.get(job_fingerprint(incoming))
            if existing:
                first_seen = existing.get("firstSeenAt") or incoming["firstSeenAt"]
                existing.update({k: v for k, v in incoming.items() if v not in (None, "", [])})
                existing["firstSeenAt"] = first_seen
                existing["lastSeenAt"] = now
                existing["sourceStatus"] = "healthy"
                existing["urlAliases"] = list(dict.fromkeys([
                    *existing.get("urlAliases", []), *incoming.get("urlAliases", [])
                ]))
                existing["sources"] = list(dict.fromkeys([
                    *existing.get("sources", []), *incoming.get("sources", [])
                ]))
            else:
                incoming["sourceStatus"] = "healthy"
                merged_jobspy.append(incoming)
                previous_by_url[incoming["url"]] = incoming
                previous_by_fingerprint[job_fingerprint(incoming)] = incoming

        data["jobs"] = sorted(
            kept_jobs + merged_jobspy,
            key=lambda job: (
                str(job.get("company", "")).lower(),
                str(job.get("title", "")).lower(),
                str(job.get("id", "")),
            ),
        )
        data["count"] = len(data["jobs"])
        data["lastUpdated"] = now
        data["contentUpdatedAt"] = now
        count_cliff = prev_count > 0 and len(discovered) < math.ceil(prev_count * 0.25)
        pipeline_partial = bool(data.get("partial")) or bool(failed_terms) or count_cliff
        if not pipeline_partial:
            data["lastFullySuccessfulAt"] = now
        data["partial"] = pipeline_partial
        source_health = data.setdefault("sourceHealth", {})
        source_health["jobspy"] = {
            "status": "healthy" if not failed_terms and not count_cliff else "partial",
            "checkedAt": now,
            "failedQueries": failed_terms,
            "countCliff": count_cliff,
            "discovered": len(discovered),
            "retained": len(merged_jobspy) - len(discovered),
        }
        atomic_write_json(JOBS_FILE, data)
        atomic_write_json(GEOCACHE_FILE, geocache)
        print(
            f"\nWrote {data['count']} jobs to jobs.json "
            f"({len(merged_jobspy)} jobspy + {len(kept_jobs)} scrapers)"
        )
    else:
        print(f"\nDry run. Use --apply to write {len(discovered)} discoveries.")


if __name__ == "__main__":
    main()
