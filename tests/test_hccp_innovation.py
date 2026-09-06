"""HCCP innovation coding, company aggregation, and full-DF FE inference."""

import importlib.util
from pathlib import Path
import unittest

import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("hccp_innovation", ROOT / "scripts/analyze_hccp_innovation.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class HCCPInnovationTests(unittest.TestCase):
    def test_yes_no_preserves_skip_and_unknown(self):
        actual = MODULE.binary_yes_no(pd.Series([1, 2, -8, -9, 0, 3, 99, np.nan]))
        self.assertEqual(actual.iloc[:2].tolist(), [1.0, 0.0])
        self.assertTrue(actual.iloc[2:].isna().all())

    def test_internal_development_uses_zero_one_not_one_two(self):
        actual = MODULE.valid_values(pd.Series([0, 1, 2, -8, -9]), [0, 1])
        self.assertEqual(actual.iloc[:2].tolist(), [0, 1])
        self.assertTrue(actual.iloc[2:].isna().all())

    def test_collapse_is_one_company_row_and_separate_denominators(self):
        worker = pd.DataFrame({"firm_id": [1, 1, 1, 2], "hr_change": [1, 3, 5, 4],
                               "participation": [4, -8, -8, 5], "autonomy": [3, -8, -9, 4]})
        result = MODULE.collapse_workers(worker).set_index("firm_id")
        self.assertEqual(len(result), 2)
        self.assertEqual(result.loc[1, "hr_change"], 3)
        self.assertEqual(result.loc[1, "hr_change_responses"], 3)
        self.assertEqual(result.loc[1, "participation_responses"], 1)
        self.assertEqual(result.loc[1, "participation"], 4)

    def test_scale_category_never_becomes_continuous_score(self):
        sample = pd.DataFrame({"scale": [1, 2, 3, 4], "type": [1, 2, 3, 1], "industry": [1, 2, 3, 1]})
        result = MODULE.categorical_design(sample, False)
        self.assertNotIn("scale", result.columns)
        self.assertEqual(sum(str(c).startswith("scale_") for c in result), 3)

    def synthetic_panel(self):
        rng = np.random.default_rng(5723)
        frame = pd.DataFrame([(firm, year) for firm in range(24) for year in range(4)
                              if not (firm % 3 == 0 and year == 0)], columns=["firm_id", "year"])
        frame["x"] = rng.normal(size=len(frame))
        frame["z"] = rng.normal(size=len(frame))
        frame["invariant"] = frame["firm_id"] % 2
        frame["y"] = 0.6 * frame.x - 0.3 * frame.z + frame.firm_id * 0.11 + frame.year * 0.2 + rng.normal(size=len(frame))
        return frame

    def test_absorbed_cluster_matches_explicit_firm_year_dummies(self):
        frame = self.synthetic_panel()
        years = pd.get_dummies(frame.year.astype("category"), prefix="year", drop_first=True, dtype=float)
        x = pd.concat([frame[["x", "z", "invariant"]], years], axis=1)
        result = MODULE.fit_absorbed_cluster(frame.y, x, frame.firm_id)
        explicit = pd.concat([frame[["x", "z"]], years,
                              pd.get_dummies(frame.firm_id.astype("category"), prefix="firm", drop_first=True, dtype=float)], axis=1)
        explicit = sm.add_constant(explicit)
        reference = sm.OLS(frame.y, explicit).fit(cov_type="cluster", cov_kwds={"groups": frame.firm_id,
                                                                                 "use_correction": True,
                                                                                 "df_correction": True}, use_t=True)
        indices = [result["names"].index("x"), result["names"].index("z")]
        np.testing.assert_allclose(result["params"][indices], reference.params[["x", "z"]], rtol=1e-10, atol=1e-10)
        np.testing.assert_allclose(result["covariance"][np.ix_(indices, indices)], reference.cov_params().loc[["x", "z"], ["x", "z"]], rtol=1e-10, atol=1e-10)
        np.testing.assert_allclose(result["pvalues"][indices], reference.pvalues[["x", "z"]], rtol=1e-10, atol=1e-10)
        self.assertEqual(result["inference_df"], 23)
        self.assertEqual(result["full_parameter_count"], explicit.shape[1])
        self.assertEqual(result["residual_df"], reference.df_resid)
        self.assertIn("invariant", result["dropped"])

    def test_ci_uses_number_of_firms_not_number_of_rows(self):
        frame = self.synthetic_panel()
        result = MODULE.fit_absorbed_cluster(frame.y, frame[["x", "z"]], frame.firm_id)
        ratio = (result["ci_high"] - result["params"]) / result["se"]
        np.testing.assert_allclose(ratio, stats.t.ppf(0.975, 23))

    def test_rank_reduction_prefers_prespecified_predictors(self):
        frame = pd.DataFrame({"const": [1., 1., 1.], "x": [0., 1., 2.], "duplicate": [0., 2., 4.], "zero": [0., 0., 0.]})
        design, dropped = MODULE.independent_columns(frame)
        self.assertEqual(list(design), ["const", "x"])
        self.assertEqual(dropped, ["duplicate", "zero"])

    @unittest.skipUnless(MODULE.DEFAULT_SOURCE.exists(), "Local HCCP microdata unavailable")
    def test_actual_2017_launch_and_teamleader_denominators(self):
        panel, workers = MODULE.load_frames(MODULE.DEFAULT_SOURCE)
        latest = panel.loc[panel.year.eq(2017)]
        self.assertEqual(len(latest), 474)
        self.assertEqual(latest.launch.notna().sum(), 474)
        self.assertEqual(latest.launch.sum(), 230)
        self.assertFalse(panel.duplicated(["firm_id", "year"]).any())
        self.assertEqual(latest.participation_responses.sum(), 1964)
        self.assertEqual(latest.hr_change_responses.sum(), 10005)
        self.assertEqual(len(workers), 10005)
        self.assertEqual(latest.participation.notna().sum(), 440)
        self.assertEqual(latest.hr_change.notna().sum(), 441)
        self.assertTrue(panel.loc[panel.year.eq(2011), "launch"].isna().all())

    @unittest.skipUnless(MODULE.DEFAULT_SOURCE.exists(), "Local HCCP microdata unavailable")
    def test_actual_five_prespecified_models_are_finite_and_separate_from_ai(self):
        payload = MODULE.analyze(MODULE.DEFAULT_SOURCE)
        self.assertEqual(len(payload["models"]), 3)
        self.assertEqual(len(payload["withheld_models"]), 2)
        self.assertEqual([outcome["id"] for outcome in payload["outcomes"]], ["launch"])
        self.assertEqual([outcome["id"] for outcome in payload["withheld_outcomes"]], ["development"])
        self.assertFalse(payload["meta"]["weighted"])
        self.assertIn("공공 비교", payload["meta"]["scope"])
        for model in payload["models"] + payload["withheld_models"]:
            self.assertEqual(model["status"], "estimated")
            self.assertEqual(model["flow"]["final_rows"], model["n"])
            self.assertEqual(model["flow"]["eligible_rows"],
                             model["flow"]["missing_rows"] + model["flow"]["singleton_rows_removed"] + model["n"])
            self.assertIn(model["unit"], ["probability", "score"])
            if model["unit"] == "probability":
                self.assertEqual(model["diagnostics"]["unit_interval_tolerance"], 1e-10)
                self.assertLessEqual(model["diagnostics"]["fitted_outside_unit_interval"],
                                     model["diagnostics"]["fitted_outside_unit_interval_raw"])
            if model["id"].endswith("_panel"):
                self.assertEqual(model["inference"]["inference_df"], model["firms"] - 1)
                self.assertEqual(model["n"] - model["inference"]["full_parameter_count"], model["inference"]["residual_df"])
                self.assertIn("industry_2.0", model["inference"]["dropped"])
            else:
                self.assertEqual(model["n"], model["firms"])
            for coefficient in model["coefficients"]:
                self.assertNotIn(coefficient["id"], ["ai", "public", "innovation_culture"])
                self.assertTrue(all(np.isfinite(coefficient[k]) for k in ["beta", "se", "ci_low", "ci_high", "p"]))
                self.assertLessEqual(coefficient["ci_low"], coefficient["beta"])
                self.assertGreaterEqual(coefficient["ci_high"], coefficient["beta"])
                self.assertGreaterEqual(coefficient["p"], 0)
                self.assertLessEqual(coefficient["p"], 1)

    @unittest.skipUnless(MODULE.DEFAULT_SOURCE.exists(), "Local HCCP microdata unavailable")
    def test_measurement_audit_preserves_but_withholds_ambiguous_development_models(self):
        payload = MODULE.analyze(MODULE.DEFAULT_SOURCE)
        for model in payload["models"]:
            self.assertEqual(model["outcome_id"], "launch")
            self.assertEqual(model["measurement_status"], "retained_general_innovation_only")
            self.assertTrue(any("결과기간 뒤" in warning for warning in model["warnings"]))
            self.assertTrue(any("AI·AX 효과" in warning for warning in model["warnings"]))
        for model in payload["withheld_models"]:
            self.assertEqual(model["outcome_id"], "development")
            self.assertEqual(model["measurement_status"], "withheld_ambiguous_target")
            self.assertIn("경영환경", model["withheld_reason"])
            self.assertIn("귀사", model["withheld_reason"])
            self.assertEqual(model["status"], "estimated")
            self.assertEqual(len(model["coefficients"]), 2)
        audit = {item["id"]: item for item in payload["meta"]["outcome_audit"]}
        self.assertEqual(audit["launch"]["physical_page"], 284)
        self.assertEqual(audit["launch"]["printed_page"], 280)
        self.assertIn("귀사는", audit["launch"]["question_text"])
        self.assertEqual(audit["development"]["physical_page"], 285)
        self.assertEqual(audit["development"]["printed_page"], 281)
        self.assertNotIn("귀사", audit["development"]["question_text"])
        self.assertEqual(audit["launch"]["reference_years"], [2015, 2016])
        self.assertEqual(audit["launch"]["survey_year"], 2017)
        self.assertIn("현재 상태", audit["launch"]["timing_note"])
        self.assertFalse(payload["meta"]["source_audit"]["ai_direct_question_found"])


if __name__ == "__main__":
    unittest.main()
