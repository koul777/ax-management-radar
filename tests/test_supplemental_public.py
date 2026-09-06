"""Integrity checks for the KIPA supplemental aggregate export."""
from __future__ import annotations

import json
import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "app" / "data" / "supplemental-public.json"
LOCAL = ROOT / ".tmp" / "supplemental_public" / "local_aggregate_results.json"
ANALYZER_PATH = ROOT / "scripts" / "analyze_supplemental_public.py"
ANALYZER_SPEC = importlib.util.spec_from_file_location("supplemental_public_analyzer", ANALYZER_PATH)
assert ANALYZER_SPEC and ANALYZER_SPEC.loader
ANALYZER = importlib.util.module_from_spec(ANALYZER_SPEC)
ANALYZER_SPEC.loader.exec_module(ANALYZER)


class SupplementalPublicTests(unittest.TestCase):
    def setUp(self) -> None:
        self.public = json.loads(PUBLIC.read_text(encoding="utf-8"))
        self.local = json.loads(LOCAL.read_text(encoding="utf-8")) if LOCAL.exists() else None

    def test_authorized_public_file_contains_only_aggregate_statistics(self) -> None:
        expected = {
            "kipa_jobs_2015": (280, 10),
            "kipa_data_2019": (330, 14),
            "kipa_cloud_2022": (500, 18),
        }
        self.assertEqual(len(self.public["datasets"]), len(expected))
        serialized = json.dumps(self.public, ensure_ascii=False)
        self.assertNotIn("E:\\", serialized)
        self.assertNotIn(".sav", serialized.lower())
        for dataset in self.public["datasets"]:
            raw_n, question_count = expected[dataset["id"]]
            self.assertEqual(dataset["publication_status"], "approved")
            self.assertEqual(dataset["sample"]["raw_n"], raw_n)
            self.assertEqual(len(dataset["questions"]), question_count)
            self.assertEqual(dataset["models"], [])
            self.assertEqual(dataset["findings"], [])
            self.assertTrue(any("2026-09-06" in caution for caution in dataset["cautions"]))
            for question in dataset["questions"]:
                self.assertTrue(question["groups"])
                for group in question["groups"]:
                    self.assertNotIn("records", group)
                    self.assertNotIn("respondents", group)
                    self.assertNotIn("raw", group)
                    self.assertEqual(group["valid_n"], sum(response["n"] for response in group["responses"]))

    @unittest.skipIf(not LOCAL.exists(), "Local aggregate output has not been generated")
    def test_group_counts_category_sums_and_missingness_reconcile(self) -> None:
        for dataset in self.local["datasets"]:
            self.assertEqual(dataset["sample"]["raw_n"], dataset["sample"]["analysis_n"])
            for question in dataset["questions"]:
                for group in question["groups"]:
                    self.assertEqual(
                        group["eligible_n"],
                        group["valid_n"] + group["missing_n"],
                        f"{dataset['id']} {question['source_code']} {group['id']}",
                    )
                    self.assertEqual(group["valid_n"], sum(response["n"] for response in group["responses"]))
                    if group["valid_n"]:
                        self.assertAlmostEqual(sum(response["share"] for response in group["responses"]), 1.0, places=7)
                    else:
                        self.assertTrue(all(response["share"] is None for response in group["responses"]))

    @unittest.skipIf(not LOCAL.exists(), "Local aggregate output has not been generated")
    def test_directions_source_codes_and_noncausal_safeguards(self) -> None:
        expected_counts = {"kipa_jobs_2015": 10, "kipa_data_2019": 14, "kipa_cloud_2022": 18}
        for dataset in self.local["datasets"]:
            self.assertEqual(len(dataset["questions"]), expected_counts[dataset["id"]])
            self.assertEqual(dataset["models"], [])
            self.assertEqual(dataset["findings"], [])
            cautions = " ".join(dataset["cautions"]).lower()
            self.assertIn("인과효과를 식별하지 않는다", cautions)
            self.assertIn("공공/민간 비교가 아니다", cautions)
            for question in dataset["questions"]:
                self.assertTrue(question["source_code"])
                self.assertTrue(question["label"])
                self.assertIn("높은", question["direction"])
                self.assertIn("1~5", question["scale"])
        cloud = next(item for item in self.local["datasets"] if item["id"] == "kipa_cloud_2022")
        self.assertIn("institution_not_disclosed", {group["id"] for group in cloud["sample"]["groups"]})

    def test_unknown_valid_response_stays_in_valid_denominator(self) -> None:
        class Frame:
            def __init__(self) -> None:
                self.values = [1, 9, 99, None]

            def __len__(self) -> int:
                return len(self.values)

            def __getitem__(self, key: str) -> list[int | None]:
                self.assert_key(key)
                return self.values

            @staticmethod
            def assert_key(key: str) -> None:
                if key != "Q":
                    raise KeyError(key)

        groups = ANALYZER.question_groups(
            Frame(),
            {"group_variable": None, "groups": [("all", "전체", None)]},
            "Q",
            {"1": "전혀 그렇지 않다", "9": "모름", "99": "무응답"},
        )
        group = groups[0]
        self.assertEqual(group["eligible_n"], 4)
        self.assertEqual(group["valid_n"], 2)
        self.assertEqual(group["missing_n"], 2)
        self.assertEqual(group["unknown_n"], 1)
        self.assertEqual(sum(response["n"] for response in group["responses"]), 2)
        self.assertAlmostEqual(sum(response["share"] for response in group["responses"]), 1.0)

    def test_authorized_release_marks_only_explicit_release_copy_approved(self) -> None:
        pending = {
            "datasets": [{
                "publication_status": "pending_usage_confirmation",
                "cautions": ["공개 배포를 보류한다.", "다른 주의사항"],
            }]
        }
        released = ANALYZER.authorized_release(pending)
        self.assertEqual(pending["datasets"][0]["publication_status"], "pending_usage_confirmation")
        self.assertEqual(released["datasets"][0]["publication_status"], "approved")
        self.assertIn("허가", released["datasets"][0]["cautions"][0])


if __name__ == "__main__":
    unittest.main()
