"""Innovation-first HCCP-I analysis; private firms, not AI or a sector comparison.

Pre-specified on 2026-09-06 before fitting: internal talent development and
360-degree appraisal -> launch / development activity, 2017 HC3 and firm/year
FE. A source-instrument audit subsequently WITHHOLDS the two development
models: the question's section is business environment and its target does
not explicitly identify the respondent firm. Their original estimates are
preserved separately, not silently deleted or substituted with a new outcome.
One separate 2017 launch model examines worker/team-leader aggregates.
Source microdata are read-only; the output contains only aggregate estimates.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze_workforce_panels import HCCP_WAVES, read_stata_columns


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / ".tmp/hccp_source/4. STATA Data"
DEFAULT_OUTPUT = ROOT / "app/data/hccp-innovation-analysis.json"
MAIN_X = ["internal_talent", "appraisal_360"]
EXTENDED_X = ["hr_change", "participation", "autonomy", "elearning", "hris"]
CONTROL_COLUMNS = ["scale", "type", "industry"]
LABELS = {
    "internal_talent": "핵심인재 내부육성 시행",
    "appraisal_360": "다면평가 실시",
    "hr_change": "HR 변화·혁신 주도 역할 (기업 평균 1점)",
    "participation": "팀원의 문제해결·의사결정 참여 (팀장 평균 1점)",
    "autonomy": "팀원에게 부여한 업무 자율성 (팀장 평균 1점)",
    "elearning": "이러닝 실시 (AI 아님)",
    "hris": "인사정보시스템 운용 (AI 아님)",
}
OUTCOME_LABELS = {
    "launch": "지난 2년 신제품·개선제품 시장 출시",
    "development": "지난 2년 신상품 개발·도입 활동 정도",
}
COMMON_WARNINGS = [
    "HCCPⅠ 민간기업 분석이며 공공·민간 차이 또는 AI·AX 효과를 추정한 결과가 아닙니다.",
    "2017 조사 출시 결과는 2015~2016년을 묻습니다. 현재 상태의 조직관리 X가 결과기간 뒤일 수 있어 X→혁신의 인과 방향을 주장할 수 없습니다.",
    "같은 차수의 조건부 연관일 뿐, 같은 기준기간이나 선행 관리조건이 확보되었다는 뜻이 아닙니다. 역인과·시간가변 교란이 남습니다.",
    "비가중 분석입니다. 관측 표본의 연관이며 모집단 대표 추정으로 해석하지 않습니다.",
    "내부육성·다면평가를 사용했지만 선행연구의 전체 변수·표본·종속변수를 그대로 복제한 모형은 아닙니다.",
]
WITHHELD_REASON = (
    "C7A02_02는 원설문 '경영환경' 절에 위치하고, 문두에 '귀사'라는 측정대상이 명시되지 않습니다. "
    "기업 자체의 실현된 혁신성과로 확정할 근거가 부족하여 개발·도입 2개 모형을 표시 분석에서 보류합니다. "
    "계수는 재현·감사를 위해 보존하며, 해당 문항이 반드시 업계 전체를 뜻한다고 반대로 단정하지도 않습니다."
)


def outcome_audit() -> list[dict]:
    source = "HCCP_설문지(1~7차)_.pdf"
    timing = (
        "2017 조사에서 Y는 2015~2016년을 회고합니다. 내부육성·다면평가·HR 역할·참여·자율성·HRIS는 "
        "현재 상태 또는 기준기간이 명시되지 않은 관리 문항이며, 이러닝은 2016년 실시 여부입니다. "
        "이 X들을 같은 차수로 연결했다고 결과보다 앞선 관리조건이나 AX 처치가 확보되는 것은 아닙니다."
    )
    return [
        {"id": "launch", "column": "C7A01_07", "source_document": source,
         "physical_page": 284, "printed_page": 280, "section": "A.경영일반 / 1.기업 일반",
         "question_text": "지난 2년간(2015~2016년) 귀사는 신제품(상품/서비스) 또는 기존 제품(상품/서비스)을 크게 개선한 제품(상품/서비스)을 시장에 출시했습니까?",
         "choices": ["① 예", "② 아니오"], "survey_year": 2017, "reference_years": [2015, 2016],
         "measurement_status": "retained_general_innovation_only",
         "interpretation": "기업 자체의 제품·서비스 시장 출시 여부. AX 조직관리 실행, AI 도입, AI 기반 성과를 직접 측정하지 않으며 민간 일반혁신의 보조 결과로만 사용합니다.",
         "timing_note": timing},
        {"id": "development", "column": "C7A02_02", "source_document": source,
         "physical_page": 285, "printed_page": 281, "section": "A.경영일반 / 2.경영환경",
         "question_text": "지난 2년간(2015~2016년) 신제품(상품/서비스)의 개발 및 도입은 얼마나 있었습니까?",
         "choices": ["① 거의 없었음", "② 조금 있었음", "③ 어느 정도 있었음", "④ 많이 있었음"],
         "survey_year": 2017, "reference_years": [2015, 2016],
         "measurement_status": "withheld_ambiguous_target", "interpretation": WITHHELD_REASON,
         "timing_note": timing},
    ]


def valid_values(series: pd.Series, values: list[int]) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    return numeric.where(numeric.isin(values)).astype(float)


def binary_yes_no(series: pd.Series) -> pd.Series:
    """1=yes -> 1, 2=no -> 0; missing/skip/unknown remain missing."""
    values = valid_values(series, [1, 2])
    return values.eq(1).astype(float).where(values.notna())


def collapse_workers(worker: pd.DataFrame) -> pd.DataFrame:
    """One company row; each scale has its own valid-response denominator."""
    if worker["firm_id"].isna().any():
        raise ValueError("Missing worker firm identifier")
    columns = ["hr_change", "participation", "autonomy"]
    clean = worker[["firm_id"]].copy()
    for column in columns:
        clean[column] = valid_values(worker[column], [1, 2, 3, 4, 5])
    grouped = clean.groupby("firm_id", sort=True)
    means = grouped[columns].mean()
    counts = grouped[columns].count().rename(columns=lambda x: f"{x}_responses")
    return means.join(counts).join(grouped.size().rename("worker_rows")).reset_index()


def load_frames(directory: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    frames = []
    latest_workers = None
    for spec in HCCP_WAVES:
        if spec["wave"] < 4:
            continue
        wave = spec["wave"]
        prefix = f"C{wave}"
        requested = [spec["id_head"], spec["scale"], spec["type"], spec["industry"],
                     f"{prefix}B01_08_01", f"{prefix}D03_01_11", f"{prefix}A02_02",
                     spec["elearning"], spec["hris"]]
        if wave >= 5:
            requested.append(f"{prefix}A01_07")
        head = read_stata_columns(directory / spec["head"], requested)
        if head[spec["id_head"]].isna().any() or head[spec["id_head"]].duplicated().any():
            raise ValueError(f"Missing/duplicate company ID in wave {wave}")
        firm = pd.DataFrame({
            "firm_id": head[spec["id_head"]],
            "year": spec["year"],
            "scale": valid_values(head[spec["scale"]], [1, 2, 3, 4]),
            "type": valid_values(head[spec["type"]], [1, 2, 3]),
            "industry": valid_values(head[spec["industry"]], [1, 2, 3]),
            "internal_talent": valid_values(head[f"{prefix}B01_08_01"], [0, 1]),
            "appraisal_360": binary_yes_no(head[f"{prefix}D03_01_11"]),
            "development": valid_values(head[f"{prefix}A02_02"], [1, 2, 3, 4]),
            "launch": binary_yes_no(head[f"{prefix}A01_07"]) if wave >= 5 else np.nan,
            "elearning": binary_yes_no(head[spec["elearning"]]),
            "hris": binary_yes_no(head[spec["hris"]]),
        })
        if wave == 7:
            raw = read_stata_columns(directory / spec["work"],
                                     [spec["id_work"], "W706_04", "W723_01", "W723_03"])
            latest_workers = raw.rename(columns={spec["id_work"]: "firm_id", "W706_04": "hr_change",
                                                 "W723_01": "participation", "W723_03": "autonomy"})
            firm = firm.merge(collapse_workers(latest_workers), on="firm_id", how="left", validate="one_to_one")
        frames.append(firm)
    panel = pd.concat(frames, ignore_index=True)
    if panel.duplicated(["firm_id", "year"]).any():
        raise ValueError("Duplicate company-year observations")
    assert latest_workers is not None
    return panel, latest_workers


def independent_columns(frame: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Deterministic rank reduction, retaining columns in pre-specified order."""
    kept, dropped = [], []
    basis = np.empty((len(frame), 0), dtype=float)
    for name in frame:
        vector = frame[name].to_numpy(dtype=float)
        original_norm = np.linalg.norm(vector)
        residual = vector.copy()
        # Reorthogonalization protects rank decisions for nearly absorbed dummies.
        for _ in range(2):
            if basis.shape[1]:
                residual -= basis @ (basis.T @ residual)
        norm = np.linalg.norm(residual)
        if original_norm < 1e-10 or norm <= max(1e-10, original_norm * 1e-10):
            dropped.append(str(name))
        else:
            kept.append(name)
            basis = np.column_stack([basis, residual / norm])
    return frame[kept].copy(), dropped


def categorical_design(sample: pd.DataFrame, include_year: bool) -> pd.DataFrame:
    columns = CONTROL_COLUMNS + (["year"] if include_year else [])
    return pd.get_dummies(sample[columns].astype("category"), drop_first=True, dtype=float)


def fit_absorbed_cluster(y: pd.Series, x: pd.DataFrame, groups: pd.Series) -> dict:
    """Firm absorption + CR1 covariance with the FULL LSDV parameter count.

    Year/category dummies must already be in x. N includes only firms with >=2
    complete observations. K_full = number of firms + rank(within X), including
    the intercept/firm effects that were absorbed. Inference uses t_(G-1).
    """
    if not y.index.equals(x.index) or not y.index.equals(groups.index):
        raise ValueError("y, X and groups indexes must match")
    counts = groups.value_counts()
    if len(counts) < 2 or counts.min() < 2:
        raise ValueError("Cluster FE requires >=2 groups and no singleton firms")
    within_x = x - x.groupby(groups).transform("mean")
    within_y = y - y.groupby(groups).transform("mean")
    design, dropped = independent_columns(within_x)
    n, k = design.shape
    g = int(groups.nunique())
    full_k = g + k
    if not k or n <= full_k:
        raise ValueError("Insufficient residual degrees of freedom")
    matrix = design.to_numpy(dtype=float)
    response = within_y.to_numpy(dtype=float)
    beta = np.linalg.lstsq(matrix, response, rcond=None)[0]
    residuals = response - matrix @ beta
    bread = np.linalg.inv(matrix.T @ matrix)
    score = pd.DataFrame(matrix * residuals[:, None], index=design.index).groupby(groups).sum().to_numpy()
    correction = (g / (g - 1)) * ((n - 1) / (n - full_k))
    covariance = correction * bread @ (score.T @ score) @ bread
    covariance = (covariance + covariance.T) / 2
    se = np.sqrt(np.maximum(0, np.diag(covariance)))
    critical = stats.t.ppf(0.975, g - 1)
    with np.errstate(divide="ignore", invalid="ignore"):
        pvalues = 2 * stats.t.sf(np.abs(beta / se), g - 1)
    return {"names": list(design.columns), "params": beta, "se": se, "covariance": covariance,
            "pvalues": pvalues, "ci_low": beta - critical * se, "ci_high": beta + critical * se,
            "dropped": dropped, "rank": k, "full_parameter_count": full_k,
            "residual_df": n - full_k, "inference_df": g - 1,
            "cluster_correction": correction, "residuals": residuals,
            "fitted": y.to_numpy(dtype=float) - residuals}


def coefficient_rows(fit: dict, names: list[str]) -> list[dict]:
    rows = []
    for name in names:
        if name not in fit["names"]:
            continue
        i = fit["names"].index(name)
        values = {key: float(fit[key][i]) for key in ["params", "se", "ci_low", "ci_high", "pvalues"]}
        if not all(np.isfinite(value) for value in values.values()):
            raise ValueError(f"Nonfinite inference for {name}")
        rows.append({"id": name, "label": LABELS.get(name, name), "beta": values["params"],
                     "se": values["se"], "ci_low": values["ci_low"], "ci_high": values["ci_high"],
                     "p": values["pvalues"]})
    return rows


def estimate_model(frame: pd.DataFrame, outcome: str, x_names: list[str], *, model_id: str,
                   title: str, fixed_effects: bool) -> dict:
    eligible = frame.loc[frame["year"].isin([2013, 2015, 2017] if outcome == "launch" else [2011, 2013, 2015, 2017])].copy()
    required = ["firm_id", "year", outcome] + x_names + CONTROL_COLUMNS
    complete = eligible.dropna(subset=required).copy()
    singleton_rows = 0
    if fixed_effects:
        singleton = complete.groupby("firm_id")["firm_id"].transform("size").lt(2)
        singleton_rows = int(singleton.sum())
        complete = complete.loc[~singleton].copy()
    sample = complete.reset_index(drop=True)
    warnings = list(COMMON_WARNINGS)
    warnings.append("규모 4구간·기업형태 3범주·산업 3범주를 범주형으로 처리했습니다. 규모 코드를 연속 점수로 쓰지 않았습니다.")
    if outcome == "development":
        warnings.append("1~4 순서척도를 등간으로 취급한 선형회귀입니다. 순서형 모형의 강건성 검토는 아직 수행하지 않았습니다.")
    else:
        warnings.append("선형확률모형의 계수는 확률 단위입니다. 100을 곱하면 퍼센트포인트이며 인과적 위험차가 아닙니다.")
    if fixed_effects:
        warnings.append("기업 내 변화를 이용합니다. 기업 고정효과가 불변 특성을 흡수하며, 연도 고정효과와 기업 군집 CR1·t(G−1) 추론을 적용했습니다.")
    if "participation" in x_names:
        warnings.extend([
            "HR 역할은 전체 근로자, 참여·자율성은 팀장 응답의 기업별 단순 평균입니다. 문항별 유효응답 분모가 다릅니다.",
            "기업당 1개 행만 사용했습니다. 평균의 집계 타당성과 응답자 구성에 따른 오차는 완전히 검증되지 않았습니다.",
            "이러닝은 실시 여부, HRIS는 인사정보시스템입니다. 훈련비·AI 역량·AX 수준으로 해석하지 않습니다.",
        ])
    model = {
        "id": model_id, "title": title, "outcome": OUTCOME_LABELS[outcome],
        "outcome_id": outcome, "method": "기업·연도 고정효과 다중회귀 / 기업 군집 CR1, t(G−1)" if fixed_effects else "다중 선형확률회귀 / HC3, t 추론" if outcome == "launch" else "다중 선형회귀 / HC3, t 추론",
        "unit": "probability" if outcome == "launch" else "score", "n": int(len(sample)),
        "firms": int(sample["firm_id"].nunique()), "years": sorted(int(y) for y in sample["year"].unique()),
        "controls": ["종사자 규모(4범주)", "기업형태(3범주)", "산업대분류(3범주)"] + (["기업 고정효과", "연도 고정효과"] if fixed_effects else []),
        "coefficients": [], "contrasts": [], "warnings": warnings, "status": "not_estimable",
        "flow": {"eligible_rows": int(len(eligible)), "complete_rows_before_singletons": int(len(complete) + singleton_rows),
                 "missing_rows": int(len(eligible) - len(complete) - singleton_rows), "singleton_rows_removed": singleton_rows,
                 "final_rows": int(len(sample)), "final_firms": int(sample["firm_id"].nunique())},
    }
    if len(sample) < 15 or sample[outcome].nunique() < 2:
        model["warnings"].append("유효 표본 또는 종속변수 변이가 부족하여 추정하지 않았습니다.")
        return model
    categorical = categorical_design(sample, fixed_effects)
    x = pd.concat([sample[x_names].astype(float), categorical], axis=1)
    if fixed_effects:
        fit = fit_absorbed_cluster(sample[outcome], x, sample["firm_id"])
        model["inference"] = {key: fit[key] for key in ["rank", "full_parameter_count", "residual_df", "inference_df", "cluster_correction", "dropped"]}
        model["within_variation"] = {name: int(sample.groupby("firm_id")[name].nunique().gt(1).sum()) for name in x_names + [outcome]}
    else:
        x.insert(0, "const", 1.0)
        design, dropped = independent_columns(x)
        result = sm.OLS(sample[outcome].astype(float), design).fit(cov_type="HC3", use_t=True)
        ci = result.conf_int()
        fit = {"names": list(design.columns), "params": result.params.to_numpy(), "se": result.bse.to_numpy(),
               "pvalues": result.pvalues.to_numpy(), "ci_low": ci[0].to_numpy(), "ci_high": ci[1].to_numpy(),
               "dropped": dropped, "fitted": result.fittedvalues.to_numpy()}
        model["inference"] = {"rank": int(result.model.rank), "full_parameter_count": int(result.model.rank),
                              "residual_df": float(result.df_resid), "inference_df": float(result.df_resid), "dropped": dropped}
    model["coefficients"] = coefficient_rows(fit, x_names)
    if len(model["coefficients"]) != len(x_names):
        model["warnings"].append("일부 사전 지정 설명변수는 변이가 없거나 공선적이어서 식별되지 않았습니다. 삭제 목록을 공개합니다.")
    if fit["dropped"]:
        model["warnings"].append("흡수·공선성으로 제외된 열: " + ", ".join(fit["dropped"]))
    if outcome == "launch":
        # Ignore floating-point noise around exact 0/1; never clamp predictions.
        tolerance = 1e-10
        outside_raw = int(((fit["fitted"] < 0) | (fit["fitted"] > 1)).sum())
        outside = int(((fit["fitted"] < -tolerance) | (fit["fitted"] > 1 + tolerance)).sum())
        model["diagnostics"] = {"events": int(sample[outcome].sum()), "fitted_outside_unit_interval": outside,
                                "fitted_outside_unit_interval_raw": outside_raw, "unit_interval_tolerance": tolerance,
                                "fitted_min": float(np.min(fit["fitted"])), "fitted_max": float(np.max(fit["fitted"]))}
        if outside:
            model["warnings"].append(f"선형확률 적합값 {outside}/{len(sample)}개가 0~1을 벗어납니다. 값을 자르지 않았으며 개별 기업의 유효 확률 예측으로 사용하지 않습니다.")
    if "participation" in x_names:
        model["aggregation"] = {column: {"valid_response_rows": int(sample[f"{column}_responses"].sum()),
                                            "firms": int(sample[f"{column}_responses"].gt(0).sum()),
                                            "min_per_firm": int(sample[f"{column}_responses"].min()),
                                            "median_per_firm": float(sample[f"{column}_responses"].median()),
                                            "max_per_firm": int(sample[f"{column}_responses"].max())}
                                for column in ["hr_change", "participation", "autonomy"]}
    model["status"] = "estimated"
    return model


def analyze(directory: Path) -> dict:
    panel, workers = load_frames(directory)
    latest = panel.loc[panel["year"].eq(2017)].copy()
    models = []
    for outcome in ["launch", "development"]:
        models.append(estimate_model(latest, outcome, MAIN_X, model_id=f"hccp_{outcome}_2017",
                                     title=f"2017 HR 제도와 {OUTCOME_LABELS[outcome]}", fixed_effects=False))
        models.append(estimate_model(panel, outcome, MAIN_X, model_id=f"hccp_{outcome}_panel",
                                     title=f"기업 패널: HR 제도와 {OUTCOME_LABELS[outcome]}", fixed_effects=True))
    models.append(estimate_model(latest, "launch", EXTENDED_X, model_id="hccp_launch_management_2017",
                                 title="2017 조직관리·디지털 HR와 시장 출시 (별도 확장)", fixed_effects=False))
    # Preserve all five pre-specified estimates; eligibility for display is a
    # measurement decision, not a filter on coefficients, p-values or fit.
    withheld_models = [model for model in models if model["outcome_id"] == "development"]
    models = [model for model in models if model["outcome_id"] == "launch"]
    for model in models:
        model["measurement_status"] = "retained_general_innovation_only"
    for model in withheld_models:
        model["measurement_status"] = "withheld_ambiguous_target"
        model["withheld_reason"] = WITHHELD_REASON
        model["warnings"].insert(0, WITHHELD_REASON)
    trends = []
    for year, group in panel.groupby("year"):
        trends.append({"year": int(year), "firms": int(len(group)),
                       "launch_n": int(group["launch"].notna().sum()),
                       "launch_events": int(group["launch"].sum()) if group["launch"].notna().any() else None,
                       "launch_rate": float(group["launch"].mean()) if group["launch"].notna().any() else None,
                       "development_n": int(group["development"].notna().sum()), "development_mean": float(group["development"].mean()),
                       "internal_talent_n": int(group["internal_talent"].notna().sum()),
                       "appraisal_360_n": int(group["appraisal_360"].notna().sum())})
    return {
        "meta": {"title": "HCCP 독립 연구 · 일반 조직관리와 시장 출시", "subtitle": "민간 일반혁신 보조 분석 / 출시 3개 모형 유지·측정대상 불명확 개발 2개 모형 보류",
                 "scope": "제공된 HCCPⅠ 민간기업의 일반 조직관리·시장 출시 보조 연구. 공공 비교 및 직접 AI·AX 효과는 추정할 수 없습니다.",
                 "cautions": COMMON_WARNINGS + ["표시 Y는 귀사의 시장 출시 여부뿐입니다. 개발·도입 문항은 경영환경 절의 측정대상이 불명확하여 기존 2개 모형을 보류·별도 보존합니다.",
                                               "표시하는 출시 패널은 2013·2015·2017 조사입니다. 2017 조사 출시의 실제 참조기간은 2015~2016년입니다. 같은 근로자 개인 패널은 사용하지 않았습니다.",
                                               "AI 문항 부재는 보유한 HCCPⅠ의 한계입니다. 보유 HCCPⅡ 2020·2022 원자료의 채용단계별 보기 13은 AI면접이지만, 값13은 이진 AI 사용이 아니고 2021에는 문항이 없습니다. 응답 적격 분모·빈도는 아직 분석하지 않았으므로 이 HCCPⅠ 출시 결과에 결합하지 않습니다.",
                                               "유의성이 아닌 원문 측정타당성 감사로 표시 모형 3개·보류 모형 2개를 구분했습니다. 모든 사전 지정 계수는 보존하며 p값은 다중검정 보정 전입니다."],
                 "generated_at": datetime.now(timezone.utc).isoformat(), "years": [2013, 2015, 2017],
                 "source_years": [2011, 2013, 2015, 2017], "retained_model_count": len(models),
                 "withheld_model_count": len(withheld_models), "outcome_audit": outcome_audit(),
                 "source_audit": {"survey_pages_searched": 323, "ai_direct_question_found": False,
                                  "terms": ["인공지능", "AI", "머신러닝", "기계학습", "딥러닝"],
                                  "note": "보유 HCCPⅠ 1~7차 통합설문 전체 텍스트를 두 추출기로 검색하고 관련 원문 페이지를 확인했습니다. 자동화는 2009 공정변화 예시일 뿐 AI 문항이 아닙니다. Stata 16개 파일의 변수 라벨은 모두 비어 있어 부재 판단의 근거로 삼지 않았습니다.",
                                  "later_survey": {"name": "HCCPⅡ", "verified_years": [2020, 2022], "direct_ai_item": "C20/C22B03_011[A–F]13의 값 13: 채용 단계별 AI면접",
                                                   "physical_pages": [10, 69], "microdata_available": True,
                                                   "asked_in_2021": False, "eligibility_frequency_analyzed": False,
                                                   "url": "https://www.krivet.re.kr/ht/file/hccp/HCCP%E2%85%A1_%EC%84%A4%EB%AC%B8%EC%A7%80(1~4%EC%B0%A8)_20260703.pdf",
                                                   "note": "2020·2022 실제 원자료는 보유하지만 값13은 0/1 AI사용 더미가 아닙니다. 채용 단계의 비대상·채용 없음·미선택·모름을 포함한 응답 적격 분모와 빈도는 아직 분석하지 않았습니다. 전사적 AX 수준과 동일하지 않습니다."}},
                 "latest_firms": int(len(latest)), "latest_worker_rows": int(len(workers)),
                 "specification_locked": "2026-09-06 / 추정 전 모델·변수 역할 공유", "weighted": False},
        "outcomes": [{"id": "launch", "label": OUTCOME_LABELS["launch"], "column": "C5/C6/C7A01_07", "scale": "1=예 → 1, 2=아니오 → 0",
                      "years": [2013, 2015, 2017], "n": int(latest["launch"].notna().sum()), "events": int(latest["launch"].sum()),
                      "mean": float(latest["launch"].mean()), "measurement_status": "retained_general_innovation_only",
                      "note": "2017 조사에서 2015~2016년 시장 출시를 질문. N·출시 건수는 문항 응답 기업이며 회귀별 완전사례 표본과 다릅니다. AX 운영성과가 아닙니다."}],
        "withheld_outcomes": [{"id": "development", "label": OUTCOME_LABELS["development"], "column": "C4/C5/C6/C7A02_02", "scale": "1=거의 없음, 2=조금, 3=어느 정도, 4=많이",
                      "years": [2011, 2013, 2015, 2017], "n": int(latest["development"].notna().sum()), "mean": float(latest["development"].mean()),
                      "measurement_status": "withheld_ambiguous_target", "withheld_reason": WITHHELD_REASON,
                      "note": "문항 응답 자체는 보존하되 기업 자체의 혁신성과라는 해석과 표시 분석은 보류합니다."}],
        "models": models, "withheld_models": withheld_models, "trends": trends,
        "variable_map": [
            {"id": "internal_talent", "label": LABELS["internal_talent"], "columns": [f"C{w}B01_08_01" for w in [4, 5, 6, 7]], "coding": "0=미시행, 1=시행; -8/-9 제외", "source": "HCCP 코드북 Head_4th/5th/6th/7th_Table"},
            {"id": "appraisal_360", "label": LABELS["appraisal_360"], "columns": [f"C{w}D03_01_11" for w in [4, 5, 6, 7]], "coding": "1=실시→1, 2=미실시→0; -8/-9 제외", "source": "HCCP 코드북 Head_4th/5th/6th/7th_Table"},
            {"id": "hr_change", "columns": ["W706_04"], "coding": "1~5, 전체 근로자 유효 응답 기업 평균", "source": "Work_7th_Table 96~103행"},
            {"id": "participation", "columns": ["W723_01"], "coding": "1~5, 팀장 유효 응답 기업 평균", "source": "Work_7th_Table 784~791행"},
            {"id": "autonomy", "columns": ["W723_03"], "coding": "1~5, 팀장 유효 응답 기업 평균", "source": "Work_7th_Table 800~807행"},
            {"id": "elearning", "columns": ["C7C01_07_09"], "coding": "1=실시→1, 2=미실시→0", "source": "Head_7th_Table 1319~1323행"},
            {"id": "hris", "columns": ["C7D01_06"], "coding": "1=예→1, 2=아니오→0", "source": "Head_7th_Table 2573~2577행"},
        ],
        "references": [
            {"id": "lee2017", "title": "이상묵(2017) 인적자원관리제도를 통한 흡수역량 증진과 혁신", "url": "https://doi.org/10.23839/kabe.2017.32.1.187", "note": "내부인재 육성·다면평가 등의 HR 제도와 기술변화/개발활동, HCCP 기업 고정효과. 본 모형은 전체 논문 재현이 아님."},
            {"id": "sung2014", "title": "Sung & Choi(2014) 교육훈련 투자·학습·혁신", "url": "https://onlinelibrary.wiley.com/doi/full/10.1002/job.1897", "note": "훈련 투자·학습·혁신 분위기의 역할 구분 근거. 이러닝 여부를 해당 논문의 투자액과 동일시하지 않음."},
            {"id": "hccp_design", "title": "KRIVET HCCP 조사설계", "url": "https://www.krivet.re.kr/kor/sub.do?menuSn=18", "note": "제공된 HCCPⅠ의 민간기업 범위와 기업/근로자 관측 단위."},
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hccp", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    payload = analyze(args.hccp)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "latest_firms": payload["meta"]["latest_firms"],
                      "models": [{"id": m["id"], "n": m["n"], "firms": m["firms"], "status": m["status"]} for m in payload["models"]],
                      "withheld_models": [m["id"] for m in payload["withheld_models"]]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
