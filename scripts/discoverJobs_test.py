import sys
import types
import unittest
from datetime import date

jobspy_stub = types.ModuleType("jobspy")
jobspy_stub.scrape_jobs = lambda **_kwargs: None
sys.modules.setdefault("jobspy", jobspy_stub)

from scripts.discoverJobs import annualize_salary, jobspy_metadata, normalize_posted_at  # noqa: E402


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
