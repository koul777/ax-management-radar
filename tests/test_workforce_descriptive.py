"""Response-denominator checks for descriptive-only AI perception charts."""

import importlib.util
import math
from pathlib import Path
import unittest

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODULE_SPEC = importlib.util.spec_from_file_location(
    "workforce_analysis", PROJECT_ROOT / "scripts/analyze_workforce_panels.py"
)
assert MODULE_SPEC is not None and MODULE_SPEC.loader is not None
MODULE = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(MODULE)
ai_perception_distribution = MODULE.ai_perception_distribution
WPS_PATH = PROJECT_ROOT / ".tmp/wps_data/WPS_W10_v10.dta"


class AIPerceptionDistributionTests(unittest.TestCase):
    def describe(self, rows, column="ai046"):
        frame = pd.DataFrame(rows, columns=["year", "sep", "ai001", "c_wgt23", column])
        return ai_perception_distribution(frame, column, metric_id="test", label="test")

    def test_unknown_is_its_own_response_and_stays_in_both_denominators(self):
        item = self.describe([
            [2023, 5, 1, 1, 1],
            [2023, 5, 1, 2, 2],
            [2023, 5, 1, 3, 3],
            [2023, 5, 1, 4, 99],
            [2023, 5, 1, 9, float("nan")],
            [2023, 5, 1, 9, 4],
        ])
        group = item["public"]
        self.assertEqual(item["usage"], "descriptive_only")
        self.assertEqual(group["raw_n"], 6)
        self.assertEqual(group["valid_n"], 4)
        self.assertEqual(group["informative_n"], 3)
        self.assertEqual(group["weighted_n"], 4)
        self.assertEqual([row["code"] for row in group["responses"]], [1, 2, 3, 99])
        self.assertEqual([row["n"] for row in group["responses"]], [1, 1, 1, 1])
        unknown = group["responses"][3]
        self.assertEqual(unknown["label"], "모름")
        self.assertAlmostEqual(unknown["share"], 0.25)
        self.assertAlmostEqual(unknown["weighted_share"], 0.4)
        self.assertAlmostEqual(sum(row["share"] for row in group["responses"]), 1.0)
        self.assertAlmostEqual(sum(row["weighted_share"] for row in group["responses"]), 1.0)

    def test_only_2023_current_adopters_and_recognized_sectors_are_eligible(self):
        item = self.describe([
            [2023, 5, 1, 1, 1],
            [2023, 5, 2, 1, 99],
            [2021, 5, 1, 1, 99],
            [2023, 1, 1, 1, 2],
            [2023, 4, 1, 1, 3],
            [2023, 9, 1, 1, 1],
            [2023, 5, float("nan"), 1, 1],
        ])
        self.assertEqual(item["public"]["raw_n"], 1)
        self.assertEqual(item["private"]["raw_n"], 2)
        self.assertEqual(item["public"]["responses"][3]["n"], 0)

    def test_nonpositive_or_nonfinite_weights_only_remove_weighted_responses(self):
        item = self.describe([
            [2023, 5, 1, 2, 1],
            [2023, 5, 1, 0, 2],
            [2023, 5, 1, -1, 3],
            [2023, 5, 1, float("nan"), 99],
            [2023, 5, 1, float("inf"), 99],
            [2023, 5, 1, 3, 99],
        ])
        group = item["public"]
        self.assertEqual(group["valid_n"], 6)
        self.assertEqual(group["informative_n"], 3)
        self.assertEqual(group["weighted_n"], 2)
        self.assertEqual([row["n"] for row in group["responses"]], [1, 1, 1, 3])
        self.assertEqual([row["weighted_n"] for row in group["responses"]], [1, 0, 0, 1])
        self.assertAlmostEqual(group["responses"][3]["share"], 0.5)
        self.assertAlmostEqual(group["responses"][3]["weighted_share"], 0.6)
        self.assertEqual(group["weighted_effective_n"], 1.9)

    def test_empty_group_has_null_proportions(self):
        item = self.describe([[2023, 1, 1, 1, 1]])
        group = item["public"]
        self.assertEqual(group["raw_n"], 0)
        self.assertEqual(group["valid_n"], 0)
        self.assertEqual(group["informative_n"], 0)
        self.assertEqual(group["weighted_n"], 0)
        self.assertIsNone(group["weighted_effective_n"])
        for response in group["responses"]:
            self.assertEqual(response["n"], 0)
            self.assertIsNone(response["share"])
            self.assertIsNone(response["weighted_share"])

    def test_no_valid_weights_has_null_weighted_not_raw_proportions(self):
        item = self.describe([[2023, 5, 1, 0, 99]])
        group = item["public"]
        self.assertEqual(group["valid_n"], 1)
        self.assertEqual(group["informative_n"], 0)
        self.assertEqual(group["responses"][3]["share"], 1)
        self.assertTrue(all(response["weighted_share"] is None for response in group["responses"]))

    def test_all_missing_item_responses_do_not_become_zero_proportions(self):
        item = self.describe([[2023, 5, 1, 1, float("nan")]])
        group = item["public"]
        self.assertEqual(group["raw_n"], 1)
        self.assertEqual(group["valid_n"], 0)
        self.assertTrue(all(response["share"] is None for response in group["responses"]))

    def test_safety_has_direction_appropriate_labels(self):
        item = self.describe([[2023, 5, 1, 1, 1]], column="ai048")
        self.assertEqual([category["label"] for category in item["categories"]], ["긍정", "부정", "영향 없음", "모름"])

    @unittest.skipUnless(WPS_PATH.is_file(), "Local WPS microdata are not available")
    def test_real_public_productivity_counts_preserve_ten_unknown_responses(self):
        frame = pd.read_stata(
            WPS_PATH,
            columns=["year", "sep", "ai001", "c_wgt23", "ai046"],
            convert_categoricals=False,
        )
        item = ai_perception_distribution(frame, "ai046", metric_id="productivity", label="생산성 변화 인식")
        group = item["public"]
        self.assertEqual(group["raw_n"], 21)
        self.assertEqual(group["valid_n"], 21)
        self.assertEqual(group["informative_n"], 11)
        self.assertEqual([row["n"] for row in group["responses"]], [4, 6, 1, 10])
        self.assertEqual(group["weighted_n"], 21)
        self.assertTrue(math.isclose(sum(row["share"] for row in group["responses"]), 1.0))
        self.assertTrue(math.isclose(sum(row["weighted_share"] for row in group["responses"]), 1.0))


if __name__ == "__main__":
    unittest.main()
