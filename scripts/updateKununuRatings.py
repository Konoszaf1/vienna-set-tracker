#!/usr/bin/env python3
"""Scrape current kununu employer ratings and update companies.js.

For each company with a known kununu profile, fetches the rating from
structured JSON-LD data on the company page. Outputs a JSON report and
optionally rewrites kununuRating values in companies.js.

Usage:
  python scripts/updateKununuRatings.py              # dry-run: print report
  python scripts/updateKununuRatings.py --apply      # rewrite companies.js
"""

import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

COMPANIES_FILE = Path(__file__).resolve().parent.parent / "src" / "data" / "companies.js"

# Map company name → kununu.com/at/<slug>
# Discovered manually; only needs updating when companies are added/removed.
KUNUNU_SLUGS = {
    "Schrack Technik": "schrack-technik1",
    "ÖBB-Konzern": "oebb-konzern",
    "ADMIRAL Technologies": "admiral-sportwetten1",
    "Ketryx": "ketryx1",
    "Qnit Austria": "qnit-austria1",
    "EBCONT": "ebcont",
    "TourRadar": "tourradar1",
    "adesso Austria": "adesso-austria",
    "PKE Holding": "pke-electronics",
    "AUSTRIACARD": "austria-card1",
    "allaboutapps": "aaa-all-about-apps",
}

HEADERS = {
    "User-Agent": "ViennaSETTracker/1.0 (CI rating updater; +https://github.com)",
    "Accept-Language": "en-US,en;q=0.9",
}


def parse_companies_js(path):
    """Extract company objects from the JS module."""
    text = path.read_text(encoding="utf-8")
    match = re.search(r"export const DEFAULT_COMPANIES\s*=\s*(\[.*\]);", text, re.DOTALL)
    if not match:
        raise ValueError("Could not parse DEFAULT_COMPANIES from companies.js")
    raw = match.group(1)
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    raw = re.sub(r"(?<=[{,\n])\s*(\w+)\s*:", r' "\1":', raw)
    return json.loads(raw)


def fetch_kununu_rating(slug):
    """Fetch the overall employer rating from a kununu profile page.

    Parses JSON-LD structured data (schema.org AggregateRating) which is
    stable because kununu maintains it for Google rich snippets.
    Returns a float rounded to 1 decimal, or None on failure.
    """
    url = f"https://www.kununu.com/at/{slug}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  HTTP error for {slug}: {e}", file=sys.stderr)
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # Primary: JSON-LD structured data
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            # Can be a single object or a list
            items = data if isinstance(data, list) else [data]
            for item in items:
                rating_val = (
                    item.get("aggregateRating", {}).get("ratingValue")
                    or item.get("AggregateRating", {}).get("ratingValue")
                )
                if rating_val is not None:
                    val = round(float(rating_val), 1)
                    if 1.0 <= val <= 5.0:
                        return val
        except (json.JSONDecodeError, ValueError, TypeError):
            continue

    # Fallback: look for rating in meta tags or common patterns
    meta = soup.find("meta", {"itemprop": "ratingValue"})
    if meta and meta.get("content"):
        try:
            val = round(float(meta["content"]), 1)
            if 1.0 <= val <= 5.0:
                return val
        except ValueError:
            pass

    print(f"  Could not extract rating from {url}", file=sys.stderr)
    return None


def main():
    apply = "--apply" in sys.argv

    companies = parse_companies_js(COMPANIES_FILE)
    print(f"Loaded {len(companies)} companies from companies.js\n")

    report = []

    for company in companies:
        name = company["name"]
        old_rating = company.get("kununuRating")
        slug = KUNUNU_SLUGS.get(name)

        if slug is None:
            print(f"  {name}: SKIPPED (no kununu slug mapped)")
            report.append({
                "id": company["id"],
                "name": name,
                "slug": None,
                "old_rating": old_rating,
                "new_rating": None,
                "status": "SKIPPED",
            })
            continue

        print(f"  {name} (kununu.com/at/{slug}) ...", end=" ", flush=True)
        new_rating = fetch_kununu_rating(slug)

        if new_rating is None:
            status = "FAILED"
            print("FAILED")
        elif new_rating != old_rating:
            status = "CHANGED"
            print(f"{old_rating} -> {new_rating}")
        else:
            status = "SAME"
            print(f"{new_rating} (unchanged)")

        report.append({
            "id": company["id"],
            "name": name,
            "slug": slug,
            "old_rating": old_rating,
            "new_rating": new_rating,
            "status": status,
        })

        time.sleep(2)

    # Summary
    changed = [r for r in report if r["status"] == "CHANGED"]
    failed = [r for r in report if r["status"] == "FAILED"]
    same = [r for r in report if r["status"] == "SAME"]
    skipped = [r for r in report if r["status"] == "SKIPPED"]

    print(f"\n{'=' * 50}")
    print(f"CHANGED: {len(changed)}  SAME: {len(same)}  FAILED: {len(failed)}  SKIPPED: {len(skipped)}")
    for r in changed:
        print(f"  {r['name']}: {r['old_rating']} -> {r['new_rating']}")

    # Write report
    report_path = Path(__file__).resolve().parent.parent / "rating-report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nFull report: {report_path}")

    if apply:
        updates = 0
        for company in companies:
            entry = next(r for r in report if r["id"] == company["id"])
            if entry["new_rating"] is not None:
                company["kununuRating"] = entry["new_rating"]
                updates += 1

        js_entries = json.dumps(companies, indent=2, ensure_ascii=False)
        new_content = f"export const DEFAULT_COMPANIES = {js_entries};\n"
        COMPANIES_FILE.write_text(new_content, encoding="utf-8")
        print(f"\nUpdated companies.js: {updates} ratings written")
    else:
        print("\nDry run. Use --apply to update companies.js")


if __name__ == "__main__":
    main()
