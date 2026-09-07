import sys
import types
import unittest
import json
import tempfile
from datetime import date
from pathlib import Path
from unittest.mock import patch

jobspy_stub = types.ModuleType("jobspy")
jobspy_stub.scrape_jobs = lambda **_kwargs: None
sys.modules.setdefault("jobspy", jobspy_stub)

from scripts.discoverJobs import annualize_salary, jobspy_metadata, normalize_posted_at  # noqa: E402
from scripts import discoverJobs as discovery  # noqa: E402


class SearchResults:
    """Minimal DataFrame boundary; tests do not need JobSpy or pandas installed."""

    def __init__(self, rows=()):
        self.rows = rows
        self.empty = not rows

    def iterrows(self):
        return enumerate(self.rows)


class JobSpyFailureTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(discovery.time, "sleep"))
        self.enterContext(patch("builtins.print"))
        self.enterContext(patch.object(discovery, "SEARCHES", ["SDET", "QA engineer", "software tester"]))

    def test_google_failure_preserves_other_board_results_and_stops_repeated_failures(self):
        def scrape(**kwargs):
            site, = kwargs["site_name"]
            if site == "google":
                raise RuntimeError("too many 429 error responses")
            return SearchResults([{"site": site}])

        health = {}
        with patch.object(discovery, "scrape_jobs", side_effect=scrape) as mock:
            results = list(discovery.search_by_site(health))
        self.assertEqual(len(results), 6)
        self.assertEqual(mock.call_count, 8)
        self.assertEqual(health["linkedin"]["status"], "healthy")
        self.assertEqual(health["google"]["status"], "error")
        self.assertEqual(health["google"]["skippedQueries"], ["software tester"])

    def test_transient_failure_allows_later_queries_to_recover(self):
        health = {}
        with patch.object(discovery, "SITES", ["linkedin"]), patch.object(
            discovery, "scrape_jobs", side_effect=[RuntimeError("timeout"), SearchResults(), SearchResults()]
        ):
            self.assertEqual(len(list(discovery.search_by_site(health))), 2)
        self.assertEqual(health["linkedin"]["status"], "partial")
        self.assertEqual(health["linkedin"]["skippedQueries"], [])

    def run_feed(self, scrape, apply=True):
        with tempfile.TemporaryDirectory() as directory:
            jobs_file = Path(directory) / "jobs.json"
            old_time = "2026-09-06T10:00:00+00:00"
            original = {
                "lastUpdated": old_time,
                "contentUpdatedAt": old_time,
                "lastFullySuccessfulAt": old_time,
                "count": 1,
                "jobs": [{
                    "id": "existing-id", "company": "Example", "title": "SDET",
                    "url": "https://www.linkedin.com/jobs/view/123",
                    "source": "jobspy-linkedin", "firstSeenAt": old_time,
                    "lastSeenAt": old_time, "consecutiveMisses": 1,
                }],
            }
            jobs_file.write_text(json.dumps(original))
            with patch.object(discovery, "JOBS_FILE", jobs_file), patch.object(
                discovery, "GEOCACHE_FILE", Path(directory) / "geocache.json"
            ), patch.object(discovery, "scrape_jobs", side_effect=scrape), patch.object(
                sys, "argv", ["discoverJobs.py", "--apply"] if apply else ["discoverJobs.py"]
            ):
                discovery.main()
            return original, json.loads(jobs_file.read_text())

    def test_total_outage_retains_jobs_and_freshness_and_records_error(self):
        before, after = self.run_feed(RuntimeError("blocked"))
        for field in ["lastUpdated", "contentUpdatedAt", "lastFullySuccessfulAt"]:
            self.assertEqual(after[field], before[field])
        for field in ["id", "firstSeenAt", "lastSeenAt", "consecutiveMisses"]:
            self.assertEqual(after["jobs"][0][field], before["jobs"][0][field])
        self.assertTrue(after["partial"])
        self.assertEqual(after["sourceHealth"]["jobspy"]["status"], "error")
        self.assertEqual(after["sourceHealth"]["jobspy"]["retained"], 1)

    def test_partial_outage_refreshes_observed_job_without_resetting_identity(self):
        def scrape(**kwargs):
            site, = kwargs["site_name"]
            if site == "google":
                raise RuntimeError("429")
            if site == "indeed":
                return SearchResults()
            return SearchResults([{
                "site": "linkedin", "company": "Example", "title": "SDET",
                "job_url": "https://www.linkedin.com/jobs/view/123", "location": "Vienna",
            }])

        before, after = self.run_feed(scrape)
        self.assertEqual(after["count"], 1)
        self.assertEqual(after["jobs"][0]["id"], "existing-id")
        self.assertEqual(after["jobs"][0]["firstSeenAt"], before["jobs"][0]["firstSeenAt"])
        self.assertNotEqual(after["jobs"][0]["lastSeenAt"], before["jobs"][0]["lastSeenAt"])
        self.assertEqual(after["jobs"][0]["consecutiveMisses"], 0)
        self.assertEqual(after["lastFullySuccessfulAt"], before["lastFullySuccessfulAt"])
        self.assertEqual(after["sourceHealth"]["jobspy"]["retained"], 0)
        self.assertEqual(after["sourceHealth"]["jobspy"]["status"], "partial")

    def test_dry_run_never_writes_during_outage(self):
        before, after = self.run_feed(RuntimeError("blocked"), apply=False)
        self.assertEqual(after, before)

    def test_successful_empty_searches_retain_prior_rows_and_flag_count_cliff(self):
        _, after = self.run_feed(lambda **_kwargs: SearchResults())
        self.assertEqual(after["count"], 1)
        self.assertTrue(after["sourceHealth"]["jobspy"]["countCliff"])
        self.assertEqual(after["sourceHealth"]["jobspy"]["boards"]["google"]["status"], "healthy")


class JobSpyMetadataTests(unittest.TestCase):
    def test_normalizes_source_publication_date(self):
        self.assertEqual(normalize_posted_at(date(2026, 8, 3)), "2026-08-03T00:00:00+00:00")
        self.assertIsNone(normalize_posted_at(float("nan")))

    def test_annualizes_austrian_monthly_salary_with_fourteen_payments(self):
        self.assertEqual(annualize_salary(3954, "monthly"), 55356)

    def test_extracts_date_and_advertised_range(self):
        metadata = jobspy_metadata({
            "date_posted": date(2026, 8, 3),
            "interval": "monthly",
            "min_amount": 3888.53,
            "max_amount": 4993.21,
            "currency": "EUR",
            "salary_source": "direct_data",
        }, "indeed")
        self.assertEqual(metadata["publishedAt"], "2026-08-03T00:00:00+00:00")
        self.assertEqual(metadata["advertisedSalaryMin"], 54439)
        self.assertEqual(metadata["advertisedSalaryMax"], 69905)
        self.assertEqual(metadata["advertisedSalaryKind"], "range")


if __name__ == "__main__":
    unittest.main()
