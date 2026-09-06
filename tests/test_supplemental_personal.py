import sys
import unittest
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import analyze_supplemental_personal as analysis


class SupplementalPersonalTests(unittest.TestCase):
    def test_transition_requires_unique_id_and_uses_only_common_people(self):
        before = pd.DataFrame({"ID": [1, 2, 3], "q23": [1, 2, 2]})
        after = pd.DataFrame({"id": [1, 2, 4], "Q24": [1, 1, 2]})
        result = analysis.kisdi_transition(before, after)
        self.assertEqual(result["n"], 2)
        self.assertEqual(sum(row["n"] for row in result["rows"]), 2)
        with self.assertRaises(ValueError):
            analysis.kisdi_transition(pd.DataFrame({"ID": [1, 1], "q23": [1, 2]}), after)

    def test_kmp_year_specific_measure_definitions_are_not_reused(self):
        q23 = next(q for q in analysis.KMP_QUESTIONS if q[0] == 2023 and q[1] == "p23k06002")
        q24 = next(q for q in analysis.KMP_QUESTIONS if q[0] == 2024 and q[1] == "p24d31002")
        self.assertNotEqual(q23[1], q24[1])
        self.assertIn("챗봇", q23[2])
        self.assertIn("생성형", q24[2])

    def test_user_followup_excludes_nonusers_instead_of_coding_zero(self):
        frame = pd.DataFrame({"use": [1, 2], "purpose": [1, float("nan")], "age": [1, 1]})
        question = analysis.make_question(
            frame, question_id="test", label="test", dimension="purpose", period=2024,
            universe_label="users", eligible=frame["use"].eq(1), base_universe=pd.Series(True, index=frame.index), groups=analysis._all_group(frame),
            code="purpose", labels={1: "Work", 2: "Study"}, unknown_codes=set(), source_note="test",
        )
        group = question["groups"][0]
        self.assertEqual(group["eligible_n"], 1)
        self.assertEqual(group["valid_n"], 1)
        self.assertEqual(group["missing_n"], 0)
        self.assertEqual(group["structural_missing_n"], 1)
        self.assertEqual(question["outside_universe_n"], 1)
        self.assertEqual(group["responses"][0]["n"], 1)

    def test_all_groups_have_complete_nonoverlapping_counts(self):
        frame = pd.DataFrame({
            "Age_group": [1, 2, None, 7], "DQ1": [1, 21, 12, None], "value": [1, 2, 1, 2],
        })
        groups = analysis.kisdi_groups(frame)
        question = analysis.make_question(
            frame, question_id="test", label="test", dimension="test", period=2024,
            universe_label="all", eligible=pd.Series(True, index=frame.index), base_universe=pd.Series(True, index=frame.index), groups=groups,
            code="value", labels={1: "Yes", 2: "No"}, unknown_codes=set(), source_note="test",
        )
        all_n = question["groups"][0]["eligible_n"]
        age_n = sum(group["eligible_n"] for group in question["groups"] if group["id"].startswith("age_"))
        employment_n = sum(group["eligible_n"] for group in question["groups"] if group["id"].startswith("employment_"))
        self.assertEqual(age_n, all_n)
        self.assertEqual(employment_n, all_n)

    def test_kmp_age_zero_to_six_is_outside_ai_question_universe(self):
        frame = pd.DataFrame({
            "p24age": [1, 1, 2], "p24age1": [6, 7, 12],
            "p24job1": [2, 2, 1], "p24job2": [9999, 9999, 1],
            "use": [2, 2, 1],
        })
        eligible = frame["p24age1"].ge(7)
        question = analysis.make_question(
            frame, question_id="test", label="test", dimension="ai_use", period=2024,
            universe_label="만 7세 이상", eligible=eligible, base_universe=pd.Series(True, index=frame.index),
            groups=analysis.kmp_groups(frame, 2024), code="use", labels={1: "있다", 2: "없다"},
            unknown_codes=set(), source_note="test",
        )
        all_group = question["groups"][0]
        child_group = next(group for group in question["groups"] if group["id"] == "age_0_6")
        self.assertEqual(all_group["eligible_n"], 2)
        self.assertEqual(question["outside_universe_n"], 1)
        self.assertEqual(child_group["eligible_n"], 0)
        self.assertEqual(child_group["structural_missing_n"], 1)

    def test_2022_kisdi_items_are_use_intentions_not_use_measures(self):
        q1 = next(q for q in analysis.KISDI_QUESTIONS if q[0] == 2022 and q[1] == "Q1_1")
        q2 = next(q for q in analysis.KISDI_QUESTIONS if q[0] == 2022 and q[1] == "Q2_12")
        self.assertEqual(q1[3], "use_intention")
        self.assertEqual(q2[3], "use_intention")
        self.assertIn("사용 의도", q1[2])

    def test_kmp_age_unknown_sentinel_is_not_age_eligible(self):
        age = pd.Series([6, 7, 120, 9999])
        eligible = age.between(7, analysis.KMP_ANALYTIC_AGE_MAX)
        self.assertEqual(eligible.tolist(), [False, True, True, False])


if __name__ == "__main__":
    unittest.main()
