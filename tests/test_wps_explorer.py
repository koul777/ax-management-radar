import sys
import unittest
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import analyze_wps_explorer as explorer


class WpsExplorerTests(unittest.TestCase):
    def test_size_bands_are_complete_and_nonoverlapping(self):
        workers = pd.Series([1, 29, 299, 300, 999, 1000, None, 29.5])
        valid_workers = explorer.valid_workers(workers)
        covered = sum(explorer.size_mask(valid_workers, group["id"]).astype(int) for group in explorer.SIZE_GROUPS[1:])
        self.assertEqual(covered.tolist(), [1] * 6 + [0, 0])
        self.assertTrue(pd.isna(explorer.valid_workers(workers).iloc[-1]))

    def test_small_distribution_suppresses_public_cells(self):
        result = explorer.suppress_distribution({"valid_n": 4, "responses": [{"n": 2, "share": 0.5, "weighted_n": 2, "weighted_share": 0.5}]})
        self.assertTrue(result["small_sample"])
        self.assertTrue(result["suppressed"])
        self.assertIsNone(result["responses"][0]["n"])
        self.assertIsNone(result["responses"][0]["share"])
        self.assertIsNone(result["responses"][0]["weighted_n"])
        self.assertIsNone(result["responses"][0]["weighted_share"])

    def test_non_small_distribution_is_not_suppressed(self):
        result = explorer.suppress_distribution({"valid_n": 5, "responses": [{"n": 3, "share": 0.6}]})
        self.assertFalse(result["suppressed"])
        self.assertEqual(result["responses"][0]["n"], 3)

    def test_weight_mapping_has_one_verified_column_per_wave(self):
        self.assertEqual(set(explorer.WEIGHTS), set(explorer.YEARS))
        self.assertEqual(explorer.WEIGHTS[2023], "c_wgt23")

    def test_weight_availability_requires_same_finite_positive_value(self):
        frame = pd.DataFrame({"c_wgt05": [0.0, float("inf"), -1.0]})
        _, _, available, _ = explorer.apply_year_weight(frame, 2005)
        self.assertFalse(available)

    def test_historic_metadata_does_not_inherit_2023_interpretation(self):
        item = {
            "period": "2023", "eligibility": "2023 public/private", "role": "2023 model",
            "note": "2023 note", "source": {"file": "2023 source", "section": "DQ1029", "columns": ["dq1029"]},
        }
        revised = explorer.historic_metadata(item, 2005)
        self.assertIn("WPS 기준연도 2005", revised["period"])
        self.assertNotIn("2023", " ".join(str(value) for value in revised.values()))
        self.assertEqual(revised["source"]["columns"], ["dq1029"])

    def test_unavailable_reasons_distinguish_not_measured_and_unverified(self):
        self.assertIn("미조사", explorer.unavailable_reason("aq3014", 2013))
        self.assertIn("미조사", explorer.unavailable_reason("ai001", 2021))
        self.assertIn("검증 전", explorer.unavailable_reason("dq1029", 2005))


if __name__ == "__main__":
    unittest.main()
