"""WPS AX missingness, eligibility, full-covariance contrasts and raw-data gates."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd
import statsmodels.api as sm

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("wps_ax", ROOT / "scripts/analyze_wps_ax.py")
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class TransformationTests(unittest.TestCase):
    def test_binary_preserves_missing_and_unknown(self):
        actual = MODULE.binary(pd.Series([1, 2, 99, np.nan, 0, 3]))
        self.assertEqual(actual.iloc[:2].tolist(), [1.0, 0.0])
        self.assertTrue(actual.iloc[2:].isna().all())

    def test_composite_requires_all_no_and_preserves_unknown(self):
        frame = pd.DataFrame([
            [1, 99, np.nan, 2, 99, 2], [2] * 6, [99] * 6,
            [2, 2, 2, 2, 2, 99], [2, 2, 2, 2, 2, np.nan], [np.nan] * 6,
        ], columns=[f"ai{number:03d}" for number in range(51, 57)])
        self.assertEqual(MODULE.discussion_composite(frame).tolist(), [1, 2, 99, 99, 99, 99])

    def test_distribution_unknown_in_denominator_and_invalid_weights_excluded(self):
        frame = pd.DataFrame({"value": [1, 2, 99, 99, np.nan, 1, 2],
                              "c_wgt23": [1, 2, 3, 0, 5, np.inf, -1]})
        actual = MODULE.distribution(frame, "value")
        self.assertEqual((actual["eligible_n"], actual["valid_n"], actual["informative_n"], actual["missing_n"]), (7, 6, 4, 1))
        self.assertEqual(actual["weighted_n"], 3)
        self.assertEqual([x["n"] for x in actual["responses"]], [2, 2, 2])
        self.assertAlmostEqual(actual["responses"][2]["weighted_share"], 0.5)
        self.assertAlmostEqual(sum(x["share"] for x in actual["responses"]), 1)
        self.assertAlmostEqual(sum(x["weighted_share"] for x in actual["responses"]), 1)

    def test_empty_or_zero_weight_denominators_are_null(self):
        empty = MODULE.distribution(pd.DataFrame({"value": [], "c_wgt23": []}), "value")
        self.assertTrue(all(x["share"] is None and x["weighted_share"] is None for x in empty["responses"]))
        zero = MODULE.distribution(pd.DataFrame({"value": [99], "c_wgt23": [0]}), "value")
        self.assertEqual(zero["responses"][2]["share"], 1)
        self.assertTrue(all(x["weighted_share"] is None for x in zero["responses"]))

    def test_full_covariance_contrast_not_root_sum_squared_se(self):
        params = pd.Series({"ai": 0.2, "ai_public": -0.1})
        covariance = pd.DataFrame([[0.04, -0.03], [-0.03, 0.09]], index=params.index, columns=params.index)
        actual = MODULE.linear_contrast(params, covariance, {"ai": 1, "ai_public": 1}, "public", "공공")
        self.assertAlmostEqual(actual["beta"], 0.1)
        self.assertAlmostEqual(actual["se"], np.sqrt(0.07))
        self.assertNotAlmostEqual(actual["se"], np.sqrt(0.13))
        self.assertLess(actual["ci_low"], actual["beta"])
        self.assertGreater(actual["ci_high"], actual["beta"])

    def test_contrast_matches_statsmodels_t_test(self):
        rng = np.random.default_rng(17)
        x = pd.DataFrame({"const": np.ones(120), "ai": rng.integers(0, 2, 120), "ai_public": rng.normal(size=120)})
        fit = sm.OLS(rng.normal(size=120), x).fit(cov_type="HC3", use_t=False)
        expected = fit.t_test(np.array([0, 1, 1]))
        actual = MODULE.linear_contrast(fit.params, fit.cov_params(), {"ai": 1, "ai_public": 1}, "public", "공공")
        self.assertAlmostEqual(actual["beta"], float(expected.effect.item()))
        self.assertAlmostEqual(actual["se"], float(expected.sd.item()))
        self.assertAlmostEqual(actual["p"], float(expected.pvalue.item()))
        self.assertAlmostEqual(actual["ci_low"], float(expected.conf_int()[0, 0]))

    def test_logit_derivative_gradient_matches_numeric_gradient(self):
        params = pd.Series({"const": -0.4, "hr_change": 0.3, "hr_change_public": -0.1})
        design = pd.DataFrame({"const": [1.0, 1.0, 1.0], "hr_change": [1.0, 2.0, 4.0],
                               "hr_change_public": [0.0, 2.0, 4.0]})
        estimate, gradient, _ = MODULE.logistic_derivative_and_gradient(
            design, params, {"hr_change": 1.0, "hr_change_public": 1.0})
        self.assertTrue(np.isfinite(estimate))
        numeric = []
        for column in params.index:
            shifted = params.copy()
            shifted[column] += 1e-6
            numeric.append((MODULE.logistic_derivative_and_gradient(
                design, shifted, {"hr_change": 1.0, "hr_change_public": 1.0})[0] - estimate) / 1e-6)
        np.testing.assert_allclose(gradient, numeric, rtol=1e-5, atol=1e-6)

    def test_delta_contrast_uses_full_covariance(self):
        covariance = pd.DataFrame([[0.04, -0.03], [-0.03, 0.09]])
        actual = MODULE.delta_method_contrast(0.1, np.array([1.0, 1.0]), covariance, "x", "x")
        self.assertAlmostEqual(actual["se"], np.sqrt(0.07))
        self.assertGreaterEqual(actual["p"], 0)
        self.assertLessEqual(actual["p"], 1)

    def test_linear_program_detects_complete_linear_separation(self):
        design = pd.DataFrame({"const": [1.0, 1.0, 1.0, 1.0], "x": [-2.0, -1.0, 1.0, 2.0]})
        actual = MODULE.logistic_separation_diagnostics(design, pd.Series([0.0, 0.0, 1.0, 1.0]))
        self.assertTrue(actual["detected"])
        self.assertEqual(actual["type"], "complete")
        self.assertGreater(actual["complete_margin"], 0)

    def test_linear_program_detects_zero_event_industry_quasi_separation(self):
        design = pd.DataFrame({"const": [1.0] * 6, "industry_L": [1.0, 1.0, 1.0, 0.0, 0.0, 0.0],
                               "x": [0.0, 1.0, 2.0, 0.0, 1.0, 2.0]})
        actual = MODULE.logistic_separation_diagnostics(design, pd.Series([0.0, 0.0, 0.0, 0.0, 1.0, 0.0]))
        self.assertTrue(actual["detected"])
        self.assertEqual(actual["type"], "quasi_complete")

    def test_linear_program_solver_failure_is_fail_closed(self):
        design = pd.DataFrame({"const": [1.0, 1.0], "x": [0.0, 1.0]})
        with patch.object(MODULE, "linprog", return_value=SimpleNamespace(success=False)):
            actual = MODULE.logistic_separation_diagnostics(design, pd.Series([0.0, 1.0]))
        self.assertIsNone(actual["detected"])
        self.assertEqual(actual["type"], "failed")
        self.assertFalse(actual["solver_success"])

    def test_logit_withholds_collapsed_sector_outcome(self):
        frame = pd.DataFrame({
            "id": range(12), "public": [0.0] * 6 + [1.0] * 6,
            "ai": [0.0, 1.0, 0.0, 1.0, 0.0, 1.0] + [0.0] * 6,
            "hr_change": [1.0, 2.0, 3.0, 4.0, 2.0, 3.0] * 2,
            "suggestion": [0.0, 1.0] * 6, "training_plan": [1.0, 0.0] * 6,
            "log_employees": np.linspace(1.0, 2.1, 12), "union_active": [0.0, 1.0] * 6,
            "union_dormant": [0.0] * 12, "industry": ["C"] * 12,
        })
        actual = MODULE.fit_readiness_logit_probability_sensitivity(frame)
        self.assertEqual(actual["status"], "withheld")
        self.assertIn("붕괴", actual["withheld_reason"])

    def test_logit_withholds_rare_sector_event(self):
        frame = pd.DataFrame({
            "id": range(12), "public": [0.0] * 6 + [1.0] * 6,
            "ai": [0.0, 1.0, 0.0, 1.0, 0.0, 1.0] + [1.0] + [0.0] * 5,
            "hr_change": [1.0, 2.0, 3.0, 4.0, 2.0, 3.0] * 2,
            "suggestion": [0.0, 1.0] * 6, "training_plan": [1.0, 0.0] * 6,
            "log_employees": np.linspace(1.0, 2.1, 12), "union_active": [0.0, 1.0] * 6,
            "union_dormant": [0.0] * 12, "industry": ["C"] * 12,
        })
        actual = MODULE.fit_readiness_logit_probability_sensitivity(frame)
        self.assertEqual(actual["status"], "withheld")
        self.assertIn("2개 미만", actual["withheld_reason"])

    def test_catalog_distinguishes_structural_missing_unknown_and_invalid(self):
        frame = pd.DataFrame({"value": [1, 2, 99, 7, np.nan], "c_wgt23": [1, 0, 3, 1, 1]})
        categories = [{"code": code, "label": str(code), "raw_code": code} for code in [1, 2, 99]]
        result = MODULE.categorical_distribution(frame, "value", categories, source_n=9)
        self.assertEqual(result["source_n"], 9)
        self.assertEqual(result["excluded_n"], 4)
        self.assertEqual(result["valid_n"], 3)
        self.assertEqual(result["unknown_n"], 1)
        self.assertEqual(result["missing_n"], 2)
        self.assertEqual(result["nonresponse_n"], 1)
        self.assertEqual(result["invalid_n"], 1)
        self.assertEqual(result["weighted_n"], 2)
        self.assertEqual(result["weighted_excluded_n"], 1)
        self.assertAlmostEqual(result["responses"][2]["share"], 1 / 3)
        self.assertAlmostEqual(result["responses"][2]["weighted_share"], 3 / 4)


@unittest.skipUnless(MODULE.SOURCE.is_file(), "Local WPS microdata unavailable")
class RawDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = pd.read_stata(MODULE.SOURCE, columns=MODULE.READ_COLUMNS, convert_categoricals=False)
        cls.frame = MODULE.prepare(cls.raw)
        cls.payload = MODULE.build_payload(cls.raw)

    def test_sector_samples_and_union_dormant_category(self):
        self.assertEqual(self.payload["meta"]["groups"]["public"]["n"], 96)
        self.assertEqual(self.payload["meta"]["groups"]["private"]["n"], 2273)
        self.assertEqual(self.payload["meta"]["groups"]["public"]["adopters"], 21)
        self.assertEqual(self.payload["meta"]["groups"]["private"]["adopters"], 150)
        self.assertEqual(int(self.frame.union_dormant.sum()), 106)
        self.assertEqual(int(self.frame.union_active.sum()), 705)
        self.assertEqual(set(self.frame.industry.unique()), set(MODULE.INDUSTRIES))

    def test_reeducation_eligibility_not_all_adopters(self):
        item = next(x for x in self.payload["governance"] if x["id"] == "ai061")
        self.assertEqual(item["public"]["eligible_n"], 10)
        self.assertEqual(item["private"]["eligible_n"], 60)
        self.assertEqual([x["n"] for x in item["public"]["responses"]], [8, 2, 0])
        self.assertEqual([x["n"] for x in item["private"]["responses"]], [51, 5, 4])

    def test_management_99_and_no_variation_retained(self):
        data = {x["id"]: x for x in self.payload["governance"]}
        self.assertEqual([x["n"] for x in data["ai055"]["public"]["responses"]], [7, 8, 6])
        self.assertEqual([x["n"] for x in data["ai057"]["public"]["responses"]], [0, 20, 1])
        self.assertEqual([x["n"] for x in data["ai057"]["private"]["responses"]], [0, 134, 16])
        self.assertEqual(self.payload["management_regression_status"]["status"], "not_estimable")
        self.assertGreater(data["discussion_any"]["public"]["responses"][2]["n"], 0)

    def test_all_models_full_rank_finite_covariance_and_valid_contrasts(self):
        self.assertEqual(len(self.payload["models"]), 10)
        for model in self.payload["models"]:
            with self.subTest(model=model["id"]):
                self.assertEqual(model["status"], "estimated")
                self.assertEqual(model["diagnostics"]["rank"], model["diagnostics"]["parameters"])
                self.assertTrue(model["diagnostics"]["covariance_symmetric"])
                self.assertGreaterEqual(model["diagnostics"]["covariance_min_eigenvalue"], -1e-8)
                self.assertLess(model["diagnostics"]["max_leverage"], 1)
                self.assertEqual(sum(group["n"] for group in model["groups"].values()), model["n"])
                contrasts = {row["id"]: row for row in model["contrasts"]}
                self.assertAlmostEqual(contrasts["ai_public"]["beta"] - contrasts["ai_private"]["beta"], contrasts["public_private_difference"]["beta"])
                for row in model["coefficients"] + model["contrasts"]:
                    self.assertTrue(all(np.isfinite(row[key]) for key in ["beta", "se", "ci_low", "ci_high", "p"]))
                    self.assertLessEqual(row["ci_low"], row["beta"])
                    self.assertGreaterEqual(row["ci_high"], row["beta"])
                    self.assertGreaterEqual(row["p"], 0)
                    self.assertLessEqual(row["p"], 1)

    def test_same_sample_conditional_models_and_weight_exclusions(self):
        models = {model["id"]: model for model in self.payload["models"]}
        for outcome in ["process", "product"]:
            self.assertEqual(models[outcome + "_baseline_ols"]["n"], 2369)
            self.assertEqual(models[outcome + "_conditional_ols"]["n"], 2369)
            self.assertEqual(models[outcome + "_baseline_wls"]["n"], 2148)
            self.assertEqual(models[outcome + "_baseline_wls"]["groups"]["public"]["n"], 95)
            self.assertEqual(models[outcome + "_baseline_wls"]["groups"]["private"]["n"], 2053)
            self.assertEqual(models[outcome + "_baseline_ols_nonfinance"]["n"], 2304)

    def test_no_attributed_perceptions_read_or_in_any_regression(self):
        prohibited = {f"ai{number:03d}" for number in range(45, 50)}
        self.assertFalse(prohibited.intersection(MODULE.COLUMNS))
        for model in self.payload["models"]:
            self.assertFalse(prohibited.intersection(row["id"] for row in model["coefficients"]))

    def test_categorical_controls_and_json_safe_aggregate_output(self):
        baseline = self.payload["models"][0]
        ids = {row["id"] for row in baseline["coefficients"]}
        self.assertIn("industry_K", ids)
        self.assertIn("union_dormant", ids)
        self.assertNotIn("industry_C", ids)
        self.assertNotIn("ind10", ids)
        json.dumps(self.payload, allow_nan=False)
        self.assertFalse(self.payload["source"]["individual_records_published"])

    def test_core_catalog_exact_30_items_and_correct_category_counts(self):
        items = self.payload["key_items"]
        self.assertEqual(len(items), 30)
        self.assertEqual(len({item["id"] for item in items}), 30)
        counts = pd.Series([item["category"] for item in items]).value_counts().to_dict()
        self.assertEqual(counts, {"ax_operations": 19, "attributed_perceptions": 5,
                                  "management_foundation": 3, "innovation_outcomes": 2, "ai_adoption": 1})
        for item in items:
            for key in ["concept", "role", "period", "source", "eligibility", "eligibility_rule", "measurement", "categories"]:
                self.assertTrue(item[key])
            for name in ["public", "private"]:
                group = item[name]
                self.assertEqual(group["source_n"], group["eligible_n"] + group["excluded_n"])
                self.assertEqual(group["eligible_n"], group["valid_n"] + group["missing_n"])
                self.assertEqual(group["missing_n"], group["invalid_n"] + group["nonresponse_n"])
                self.assertEqual(group["valid_n"], group["informative_n"] + group["unknown_n"])
                self.assertEqual(group["valid_n"], group["weighted_n"] + group["weighted_excluded_n"])
                self.assertEqual(sum(row["n"] for row in group["responses"]), group["valid_n"])
                self.assertAlmostEqual(sum(row["share"] for row in group["responses"]), 1)
                self.assertAlmostEqual(sum(row["weighted_share"] for row in group["responses"]), 1)

    def test_hr_reverse_scale_and_no_invented_99_options(self):
        items = {item["id"]: item for item in self.payload["key_items"]}
        hr = items["dq1029"]
        self.assertEqual([row["code"] for row in hr["categories"]], [1, 2, 3, 4, 5])
        self.assertEqual([row["raw_code"] for row in hr["categories"]], [5, 4, 3, 2, 1])
        self.assertEqual([row["n"] for row in hr["public"]["responses"]], [2, 9, 39, 38, 8])
        for column in ["ai001", "eq1004", "dq2016", "aq3014", "aq3015"]:
            self.assertEqual([row["code"] for row in items[column]["categories"]], [1, 2])
            self.assertEqual(items[column]["public"]["eligible_n"], 96)

    def test_core_attributed_perceptions_only_descriptive_and_branch_counts(self):
        items = {item["id"]: item for item in self.payload["key_items"]}
        self.assertEqual([row["n"] for row in items["ai046"]["public"]["responses"]], [4, 6, 1, 10])
        for column in MODULE.PERCEPTION_COLUMNS:
            self.assertEqual(items[column]["usage"], "descriptive_only_no_regression")
            self.assertEqual([row["code"] for row in items[column]["categories"]], [1, 2, 3, 99])
            self.assertEqual(items[column]["public"]["eligible_n"], 21)
            self.assertEqual(items[column]["public"]["excluded_n"], 75)
        self.assertEqual(items["ai061"]["public"]["eligible_n"], 10)
        self.assertEqual(items["ai061"]["public"]["excluded_n"], 86)
        self.assertEqual(items["ai061"]["private"]["eligible_n"], 60)
        self.assertEqual(items["ai061"]["private"]["excluded_n"], 2213)

    def test_lag_linkage_and_preexisting_ai_adopters_are_reported(self):
        audit = self.payload["readiness_audit"]
        self.assertEqual(audit["groups"]["public"]["linked2021_n"], 86)
        self.assertEqual(audit["groups"]["public"]["missing2021_n"], 10)
        self.assertEqual(audit["groups"]["private"]["linked2021_n"], 2051)
        self.assertEqual(audit["groups"]["private"]["missing2021_n"], 222)
        self.assertEqual(audit["groups"]["public"]["first_adoption_no_later_than2021_n"], 2)
        self.assertEqual(audit["groups"]["private"]["first_adoption_no_later_than2021_n"], 26)
        self.assertEqual(sum(group["sector_changed_n"] for group in audit["groups"].values()), 0)
        lag, _ = MODULE.readiness_cohort(self.raw)
        earlier = MODULE.prepare(self.raw, 2021).set_index("id")
        latest = MODULE.prepare(self.raw, 2023).set_index("id")
        for term in [*MODULE.MANAGEMENT_TERMS, "log_employees", "industry", "union_dormant"]:
            self.assertTrue(lag.set_index("id")[term].equals(earlier.loc[lag.id, term]))
        self.assertTrue(lag.set_index("id").ai.equals(latest.loc[lag.id, "ai"]))
        self.assertTrue(lag.set_index("id").weight.equals(latest.loc[lag.id, "weight"]))

    def test_readiness_models_contrasts_holm_and_diagnostics(self):
        models = self.payload["readiness_models"]
        self.assertEqual(len(models), 7)
        logit = next(model for model in models if model["id"] == "readiness_lag21_joint_logit_probability_sensitivity")
        self.assertEqual(logit["status"], "withheld")
        self.assertEqual(logit["n"], 2137)
        self.assertEqual(logit["groups"]["public"]["n"], 86)
        self.assertEqual(logit["groups"]["public"]["events"], 18)
        self.assertEqual(logit["same_complete_case_as"], "readiness_lag21_joint_ols")
        self.assertEqual(logit["attrition"]["final_n"], models[0]["attrition"]["final_n"])
        self.assertEqual(logit["contrasts"], [])
        self.assertEqual(logit["coefficients"], [])
        self.assertIn("준완전분리", logit["withheld_reason"])
        self.assertTrue(logit["diagnostics"]["separation"]["detected"])
        self.assertEqual(logit["diagnostics"]["separation"]["type"], "quasi_complete")
        zero_event_industries = {row["industry"] for row in logit["diagnostics"]["industry_event_counts"] if row["events"] == 0}
        self.assertTrue({"L", "P"}.issubset(zero_event_industries))
        lpm_models = [model for model in models if model["id"] != logit["id"]]
        expected = [(2137, 86, 18), (2137, 86, 18), (1931, 85, 18), (2079, 81, 17), (575, 55, 11), (2369, 96, 21)]
        for model, (n, public_n, public_events) in zip(lpm_models, expected):
            self.assertEqual(model["status"], "estimated")
            self.assertEqual(model["n"], n)
            self.assertEqual(model["groups"]["public"]["n"], public_n)
            self.assertEqual(model["groups"]["public"]["events"], public_events)
            self.assertEqual(len(model["contrasts"]), 9)
            self.assertEqual(model["diagnostics"]["rank"], model["diagnostics"]["parameters"])
            self.assertTrue(model["diagnostics"]["covariance_symmetric"])
            self.assertGreaterEqual(model["diagnostics"]["covariance_min_eigenvalue"], -1e-8)
            self.assertLess(model["diagnostics"]["max_leverage"], 1)
            contrasts = {row["id"]: row for row in model["contrasts"]}
            for term in MODULE.MANAGEMENT_TERMS:
                self.assertAlmostEqual(contrasts[term + "_public"]["beta"] - contrasts[term + "_private"]["beta"],
                                       contrasts[term + "_public_private_difference"]["beta"])
            self.assertFalse(set(MODULE.PERCEPTION_COLUMNS).intersection(row["id"] for row in model["coefficients"]))
        differences = [row for row in models[0]["contrasts"] if row["comparison"] == "public_private_difference"]
        self.assertEqual(len(differences), 3)
        ordered = sorted(differences, key=lambda row: row["p"])
        running = 0
        for i, row in enumerate(ordered):
            running = max(running, min(1, (3-i) * row["p"]))
            self.assertAlmostEqual(row["p_holm"], running)
        self.assertEqual(models[0]["multiplicity"]["family_size"], 3)

    def test_common_industry_and_double_year_finance_exclusions(self):
        audit = self.payload["readiness_audit"]
        included = [row for row in audit["industry_support"] if row["included_common_support"]]
        self.assertEqual({row["industry"] for row in included}, {"K", "M", "N", "Q", "R", "S"})
        self.assertTrue(all(row["public_n"] >= 5 and row["private_n"] >= 5 for row in included))
        self.assertEqual(sum(row["public_n"] + row["private_n"] for row in included), 575)
        lag, _ = MODULE.readiness_cohort(self.raw)
        no_finance = lag.loc[~lag.industry.eq("K") & ~lag.industry_2023.eq("K")]
        self.assertEqual(len(no_finance), 2079)

    def test_duplicate_prior_year_ids_rejected(self):
        duplicate = self.raw.loc[self.raw.year.eq(2021)].iloc[[0]]
        with self.assertRaisesRegex(ValueError, "Duplicate WPS 2021"):
            MODULE.readiness_cohort(pd.concat([self.raw, duplicate], ignore_index=True))


if __name__ == "__main__":
    unittest.main()
