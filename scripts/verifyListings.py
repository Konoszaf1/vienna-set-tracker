#!/usr/bin/env python3
"""Verify and update company job listings using JobSpy.

For each company in companies.js, searches job boards for active
test/QA/SDET listings in Vienna. Outputs a JSON report and optionally
rewrites companies.js to drop companies without active listings and
update jobUrls for those with new ones.

Usage:
  python scripts/verifyListings.py              # dry-run: print report
  python scripts/verifyListings.py --apply      # rewrite companies.js
"""

import json
import re
import sys
import time
from pathlib import Path

from jobspy import scrape_jobs

COMPANIES_FILE = Path(__file__).resolve().parent.parent / "src" / "data" / "companies.js"

SEARCH_TERMS = [
    "test automation engineer",
    "QA engineer",
    "SDET",
    "software tester",
    "quality assurance engineer",
    "testautomation",
]


def parse_companies_js(path):
    """Extract company objects from the JS module."""
    text = path.read_text(encoding="utf-8")
    # Strip the export wrapper to get raw JSON array
    match = re.search(r"export const DEFAULT_COMPANIES\s*=\s*(\[.*\]);", text, re.DOTALL)
    if not match:
        raise ValueError("Could not parse DEFAULT_COMPANIES from companies.js")
    raw = match.group(1)
    # Handle JS object quirks: trailing commas, unquoted keys aren't an issue
    # for json.loads if the file is well-formed. The file uses double-quoted keys
    # so we just need to strip trailing commas before ] and }.
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    # Quote unquoted JS keys: word chars before a colon
    raw = re.sub(r"(?<=[{,\n])\s*(\w+)\s*:", r' "\1":', raw)
    return json.loads(raw)


def search_company(company_name):
    """Search for test/QA listings at a specific company in Vienna."""
    results = []
    for term in SEARCH_TERMS:
        query = f'"{company_name}" {term}'
        try:
            jobs = scrape_jobs(
                site_name=["indeed", "linkedin", "google"],
                search_term=query,
                google_search_term=f"{company_name} {term} Vienna Austria",
                location="Vienna, Austria",
                results_wanted=5,
                hours_old=720,  # last 30 days
                country_indeed="Austria",
            )
            if not jobs.empty:
                for _, row in jobs.iterrows():
                    results.append({
                        "title": str(row.get("title", "")),
                        "company": str(row.get("company", "")),
                        "url": str(row.get("job_url", "")),
                        "source": str(row.get("site", "")),
                        "date_posted": str(row.get("date_posted", "")),
                        "location": str(row.get("location", "")),
                    })
        except Exception as e:
            print(f"  Warning: search failed for '{query}': {e}", file=sys.stderr)
        time.sleep(1)  # rate-limit between searches
    return results


def is_relevant(job, company_name):
    """Check if a scraped job actually matches the company."""
    title = job["title"].lower()
    company = job["company"].lower()
    name_lower = company_name.lower()

    # Company name must appear in the scraped company field
    # Handle common variations (e.g. "ÖBB" in "ÖBB-Konzern")
    name_words = name_lower.replace("-", " ").split()
    if not any(w in company for w in name_words if len(w) > 2):
        return False

    # Title must be test/QA related
    qa_keywords = ["test", "qa", "quality", "sdet", "tester"]
    if not any(kw in title for kw in qa_keywords):
        return False

    return True


def main():
    apply = "--apply" in sys.argv

    companies = parse_companies_js(COMPANIES_FILE)
    print(f"Loaded {len(companies)} companies from companies.js\n")

    report = []

    for company in companies:
        name = company["name"]
        current_url = company.get("jobUrl", "")
        print(f"Searching: {name} ...", flush=True)

        raw_results = search_company(name)
        matched = [j for j in raw_results if is_relevant(j, name)]

        # Deduplicate by URL
        seen_urls = set()
        unique = []
        for j in matched:
            if j["url"] not in seen_urls:
                seen_urls.add(j["url"])
                unique.append(j)

        status = "ACTIVE" if unique else "NO_LISTING"
        best_url = unique[0]["url"] if unique else None

        entry = {
            "id": company["id"],
            "name": name,
            "status": status,
            "current_url": current_url,
            "best_url": best_url,
            "matches": unique,
        }
        report.append(entry)

        if unique:
            print(f"  ACTIVE - {len(unique)} listing(s) found")
            for j in unique[:3]:
                print(f"    [{j['source']}] {j['title']} - {j['url']}")
        else:
            print(f"  NO LISTING FOUND")
        print()

    # Summary
    active = [r for r in report if r["status"] == "ACTIVE"]
    dead = [r for r in report if r["status"] == "NO_LISTING"]

    print("=" * 60)
    print(f"ACTIVE: {len(active)} companies with listings")
    for r in active:
        print(f"  {r['name']}: {r['best_url']}")

    print(f"\nNO LISTING: {len(dead)} companies without listings")
    for r in dead:
        print(f"  {r['name']}")

    # Write report JSON
    report_path = Path(__file__).resolve().parent.parent / "listing-report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nFull report: {report_path}")

    if apply:
        # Keep only active companies, update their jobUrl
        kept = []
        for company in companies:
            entry = next(r for r in report if r["id"] == company["id"])
            if entry["status"] == "ACTIVE" and entry["best_url"]:
                company["jobUrl"] = entry["best_url"]
                kept.append(company)

        # Rewrite companies.js
        js_entries = json.dumps(kept, indent=2, ensure_ascii=False)
        new_content = f"export const DEFAULT_COMPANIES = {js_entries};\n"
        COMPANIES_FILE.write_text(new_content, encoding="utf-8")
        print(f"\nUpdated companies.js: {len(kept)} companies kept, {len(companies) - len(kept)} removed")
    else:
        print("\nDry run. Use --apply to update companies.js")


if __name__ == "__main__":
    main()
