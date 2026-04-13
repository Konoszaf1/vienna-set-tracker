#!/usr/bin/env python3
"""Discover test/QA/SDET jobs in Vienna via JobSpy (LinkedIn, Indeed, Google).

Complements the karriere.at + kununu scraping in search-jobs.mjs by searching
additional boards.  Each run **replaces** all previous jobspy-* entries in
public/jobs.json with a fresh set — stale discoveries drop off automatically
without a separate liveness checker.

Usage:
  python scripts/discoverJobs.py              # dry-run: show what would change
  python scripts/discoverJobs.py --apply      # merge into jobs.json
"""

import json
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
    r"|qa\s+engineer|quality\s+(?:assurance\s+)?engineer"
    r"|test\s*automatisier|testautomatisierung(?:sing|seng)"
    r"|software\s+test|testingenieur|test\s+architect|testarchitekt",
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

    # Partition: keep scraper entries, drop previous jobspy discoveries
    kept_jobs = [
        j for j in data.get("jobs", [])
        if not j.get("source", "").startswith("jobspy-")
    ]
    prev_count = len(data.get("jobs", [])) - len(kept_jobs)

    # Dedup index from kept (karriere.at + kununu) entries
    existing_urls = {j["url"] for j in kept_jobs}
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
            continue

        if results.empty:
            print("0 results")
            continue

        added = 0
        for _, row in results.iterrows():
            url = str(row.get("job_url", "")).strip()
            title = str(row.get("title", "")).strip()
            company = str(row.get("company", "")).strip()
            location = str(row.get("location", ""))
            site = str(row.get("site", ""))

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
        data["jobs"] = kept_jobs + discovered
        data["count"] = len(data["jobs"])
        data["lastUpdated"] = datetime.now(timezone.utc).isoformat()
        JOBS_FILE.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        GEOCACHE_FILE.write_text(
            json.dumps(geocache, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(
            f"\nWrote {data['count']} jobs to jobs.json "
            f"({len(discovered)} jobspy + {len(kept_jobs)} scrapers)"
        )
    else:
        print(f"\nDry run. Use --apply to write {len(discovered)} discoveries.")


if __name__ == "__main__":
    main()
