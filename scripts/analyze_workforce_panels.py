"""Build the WPS 2023 AI/public-private analysis and HCCP benchmark payload.

The script deliberately keeps the two surveys separate. WPS provides the direct
public/private and AI measures. HCCP provides a historical private-enterprise
benchmark for digital HR infrastructure and innovation culture.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
import statsmodels.api as sm


WPS_BASE_COLUMNS = [
    "id", "year", "sep", "sb", "ind", "ind10", "reg", "c_wgt23",
    "epq1011", "mq1001", "aq3014", "aq3015", "aq3016", "aq3017",
    "aq3018", "dq1028", "dq1029", "dq2016", "dq2026", "dq2027",
    "dq2028", "eq1001", "eq1002", "eq1004", "eq1005", "eq1007",
    "eq1008",
]
WPS_AI_COLUMNS = [f"ai{i:03d}" for i in range(1, 84)]
WPS_ICT_COLUMNS = [
    "ict001", "ict003", "ict004", "ict005", "ict006", "ict007",
    "ict018", "ict019", "ict020r1", "ict020r2", "ict020r3",
    "ict020r4", "ict020r5", "ict020r6", "ict020r7", "ict021",
    "ict022", "ict030", "ict031", "ict032", "ict033", "ict034",
    "ict035",
]


def finite_number(value: object) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def rounded(value: object, digits: int = 4) -> float | None:
    number = finite_number(value)
    return None if number is None else round(number, digits)


def valid(series: pd.Series, allowed: Iterable[int | float]) -> pd.Series:
    return series.where(series.isin(list(allowed)))


def weighted_mean(values: pd.Series, weights: pd.Series) -> tuple[float | None, int, float | None]:
    frame = pd.DataFrame({"value": values, "weight": weights}).dropna()
    frame = frame[frame["weight"] > 0]
    if frame.empty:
        return None, 0, None
    weight_sum = frame["weight"].sum()
    mean = np.average(frame["value"], weights=frame["weight"])
    effective_n = weight_sum**2 / np.square(frame["weight"]).sum()
    return rounded(mean), int(len(frame)), rounded(effective_n, 1)


def weighted_rate(mask: pd.Series, weights: pd.Series) -> tuple[float | None, int, float | None]:
    return weighted_mean(mask.astype(float), weights)


def group_metric(
    frame: pd.DataFrame,
    values: pd.Series,
    *,
    label: str,
    metric_id: str,
    kind: str,
    note: str,
) -> dict:
    groups = {}
    for group_id, group_mask in {
        "public": frame["public"].eq(1),
        "private": frame["public"].eq(0),
    }.items():
        mean, n, effective_n = weighted_mean(values[group_mask], frame.loc[group_mask, "weight"])
        groups[group_id] = {"value": mean, "n": n, "effective_n": effective_n}
    public_value = groups["public"]["value"]
    private_value = groups["private"]["value"]
    gap = None if public_value is None or private_value is None else rounded(public_value - private_value)
    return {
        "id": metric_id,
        "label": label,
        "kind": kind,
        "public": groups["public"],
        "private": groups["private"],
        "gap": gap,
        "note": note,
    }


def binary_metric(
    frame: pd.DataFrame,
    column: str,
    positive: int | float,
    *,
    label: str,
    metric_id: str,
    note: str,
    eligible: pd.Series | None = None,
) -> dict:
    values = valid(frame[column], [1, 2, 3, 4, 5, 99])
    if eligible is not None:
        values = values.where(eligible)
    binary = values.where(values.notna()).eq(positive).where(values.notna())
    return group_metric(frame, binary.astype(float), label=label, metric_id=metric_id, kind="rate", note=note)


def scale_metric(
    frame: pd.DataFrame,
    column: str,
    *,
    label: str,
    metric_id: str,
    note: str,
    reverse: bool = False,
) -> dict:
    values = valid(frame[column], [1, 2, 3, 4, 5])
    if reverse:
        values = 6 - values
    return group_metric(frame, values, label=label, metric_id=metric_id, kind="scale", note=note)


def ai_perception_distribution(
    frame: pd.DataFrame,
    column: str,
    *,
    metric_id: str,
    label: str,
) -> dict:
    """Describe all response categories among 2023 current AI adopters.

    Code 99 is an explicit uncertainty response, not a zero or missing value.
    Raw proportions retain respondents without valid survey weights; weighted
    proportions use finite, positive weights and retain 99 in their denominator.
    These subjective perceptions are not regression outcomes.
    """
    labels = ["긍정", "부정", "영향 없음", "모름"] if column == "ai048" else ["증가", "감소", "영향 없음", "모름"]
    categories = [
        {"code": code, "label": response_label}
        for code, response_label in zip([1, 2, 3, 99], labels)
    ]
    adopters = frame.loc[frame["year"].eq(2023) & frame["ai001"].eq(1)].copy()
    groups = {}
    for group_id, group_mask in {
        "public": adopters["sep"].eq(5),
        "private": adopters["sep"].isin([1, 2, 3, 4]),
    }.items():
        group = adopters.loc[group_mask]
        responses = pd.to_numeric(group[column], errors="coerce")
        recognized = responses.isin([1, 2, 3, 99])
        weights = pd.to_numeric(group["c_wgt23"], errors="coerce").astype(float)
        weighted = recognized & weights.gt(0) & np.isfinite(weights)
        valid_n = int(recognized.sum())
        weight_sum = float(weights.loc[weighted].sum())
        effective_n = (
            weight_sum**2 / float(np.square(weights.loc[weighted]).sum())
            if weight_sum > 0 else None
        )
        groups[group_id] = {
            "raw_n": int(len(group)),
            "valid_n": valid_n,
            "informative_n": int((recognized & responses.ne(99)).sum()),
            "weighted_n": int(weighted.sum()),
            "weighted_effective_n": rounded(effective_n, 1),
            "responses": [
                {
                    **category,
                    "n": int((recognized & responses.eq(category["code"])).sum()),
                    "share": float((recognized & responses.eq(category["code"])).sum()) / valid_n if valid_n else None,
                    "weighted_n": int((weighted & responses.eq(category["code"])).sum()),
                    "weighted_share": float(weights.loc[weighted & responses.eq(category["code"])].sum()) / weight_sum if weight_sum > 0 else None,
                }
                for category in categories
            ],
        }
    return {
        "id": metric_id,
        "column": column,
        "label": label,
        "usage": "descriptive_only",
        "note": "2023년 현재 AI 활용 사업체의 주관적 영향 인식이다. 회귀변수로 사용하지 않고 응답분포로만 제시한다. 모름(99)을 별도 범주로 유지하며, 가중 비율은 양의 유효 가중치가 있는 응답을 기준으로 계산한다.",
        "categories": categories,
        **groups,
    }


def fit_weighted_logit(frame: pd.DataFrame, outcome: str, predictors: list[str]) -> dict:
    columns = [outcome, "weight", *predictors]
    model_frame = frame[columns].replace([np.inf, -np.inf], np.nan).dropna()
    model_frame = model_frame[model_frame["weight"] > 0].copy()
    normalized_weight = model_frame["weight"] / model_frame["weight"].mean()
    x = sm.add_constant(model_frame[predictors].astype(float), has_constant="add")
    y = model_frame[outcome].astype(float)
    result = sm.GLM(
        y,
        x,
        family=sm.families.Binomial(),
        freq_weights=normalized_weight,
    ).fit(cov_type="HC3")
    prediction = result.predict(x)
    positive = prediction[y.eq(1)]
    negative = prediction[y.eq(0)]
    tjur_r2 = positive.mean() - negative.mean()
    coefficients = {}
    for name in predictors:
        coefficients[name] = {
            "beta": rounded(result.params[name]),
            "odds_ratio": rounded(np.exp(result.params[name])),
            "p": rounded(result.pvalues[name]),
            "significant": bool(result.pvalues[name] < 0.05),
        }
    return {
        "n": int(result.nobs),
        "events": int(y.sum()),
        "tjur_r_squared": rounded(tjur_r2),
        "aic": rounded(result.aic, 2),
        "coefficients": coefficients,
    }


def two_way_demean(
    frame: pd.DataFrame,
    columns: list[str],
    *,
    entity: str,
    time: str,
    tolerance: float = 1e-10,
    max_iterations: int = 200,
) -> pd.DataFrame:
    """Residualize an unbalanced panel against entity and time effects.

    Alternating projections are used so this remains tractable without adding
    thousands of firm dummy columns. The returned values are equivalent to
    absorbing firm and survey-year fixed effects up to the convergence limit.
    """
    values = frame[columns].astype(float).copy()
    for _ in range(max_iterations):
        before = values.to_numpy(copy=True)
        values = values - values.groupby(frame[entity]).transform("mean")
        values = values - values.groupby(frame[time]).transform("mean")
        if np.nanmax(np.abs(values.to_numpy() - before)) < tolerance:
            break
    return values


def fit_two_way_fe(
    frame: pd.DataFrame,
    outcome: str,
    predictors: list[str],
    *,
    entity: str = "firm_id",
    time: str = "year",
    treatment: str | None = None,
) -> dict:
    """Fit a two-way fixed-effects linear probability/score model.

    Standard errors are clustered at the firm level. Binary outcomes are fit as
    linear probability models so the absorbed coefficients remain directly
    interpretable as percentage-point changes.
    """
    columns = [entity, time, outcome, *predictors]
    model_frame = frame[columns].replace([np.inf, -np.inf], np.nan).dropna().copy()
    repeated = model_frame.groupby(entity)[entity].transform("size").ge(2)
    model_frame = model_frame[repeated].copy()
    transformed = two_way_demean(
        model_frame,
        [outcome, *predictors],
        entity=entity,
        time=time,
    )
    usable_predictors = [
        column for column in predictors
        if transformed[column].abs().max() > 1e-12
    ]
    result = sm.OLS(
        transformed[outcome],
        transformed[usable_predictors],
    ).fit(
        cov_type="cluster",
        cov_kwds={"groups": model_frame[entity], "use_correction": True},
    )
    residual_sum = float(np.square(result.resid).sum())
    total_sum = float(np.square(transformed[outcome]).sum())
    coefficients = {}
    for name in usable_predictors:
        coefficients[name] = {
            "beta": rounded(result.params[name]),
            "se": rounded(result.bse[name]),
            "p": rounded(result.pvalues[name]),
            "ci_low": rounded(result.conf_int().loc[name, 0]),
            "ci_high": rounded(result.conf_int().loc[name, 1]),
            "significant": bool(result.pvalues[name] < 0.05),
        }
    return {
        "n": int(result.nobs),
        "firms": int(model_frame[entity].nunique()),
        "years": [int(value) for value in sorted(model_frame[time].unique())],
        "treated_firms": int(model_frame.loc[model_frame[treatment].eq(1), entity].nunique()) if treatment else None,
        "within_r_squared": rounded(1 - residual_sum / total_sum) if total_sum else None,
        "coefficients": coefficients,
    }


def analyze_wps_panel(full_frame: pd.DataFrame) -> dict:
    """Reconstruct AI exposure histories from the WPS 2023 adoption year.

    WPS first asks the direct AI module in 2023. We therefore carry the 2023
    current-adopter status and reported first-adoption year back across the same
    establishments' 2015-2023 histories. This is a retrospective survivor
    panel, not a prospective AI panel.
    """
    cohort = full_frame[full_frame["year"].eq(2023)][["id", "sep", "ai001", "ai002"]].copy()
    cohort["ever_ai"] = valid(cohort["ai001"], [1, 2]).eq(1).astype(float)
    cohort["adoption_year"] = cohort["ai002"].where(cohort["ever_ai"].eq(1) & cohort["ai002"].between(2000, 2023))
    cohort["public"] = cohort["sep"].eq(5).astype(float)
    cohort = cohort[["id", "ever_ai", "adoption_year", "public"]]

    panel = full_frame[full_frame["year"].between(2015, 2023)].copy()
    panel = panel.merge(cohort, on="id", how="inner", validate="many_to_one")
    panel = panel.rename(columns={"id": "firm_id"})
    panel["post_ai"] = (
        panel["ever_ai"].eq(1)
        & panel["adoption_year"].notna()
        & panel["year"].ge(panel["adoption_year"])
    ).astype(float)
    panel["mature_post_ai"] = (
        panel["ever_ai"].eq(1)
        & panel["adoption_year"].notna()
        & panel["year"].ge(panel["adoption_year"] + 2)
    ).astype(float)
    panel["post_public"] = panel["post_ai"] * panel["public"]
    panel["mature_post_public"] = panel["mature_post_ai"] * panel["public"]
    panel["log_employees"] = np.log1p(panel["epq1011"].where(panel["epq1011"].between(1, 1_000_000)))
    panel["hr_change"] = 6 - valid(panel["dq1029"], [1, 2, 3, 4, 5])
    panel["training_plan"] = valid(panel["eq1004"], [1, 2]).eq(1).where(valid(panel["eq1004"], [1, 2]).notna()).astype(float)
    panel["suggestion_system"] = valid(panel["dq2016"], [1, 2]).eq(1).where(valid(panel["dq2016"], [1, 2]).notna()).astype(float)

    outcome_specs = {
        "product_innovation": "aq3014",
        "process_innovation": "aq3015",
        "organization_innovation": "aq3016",
        "marketing_innovation": "aq3017",
    }
    for outcome, column in outcome_specs.items():
        observed = valid(panel[column], [1, 2])
        panel[outcome] = observed.eq(1).where(observed.notna()).astype(float)

    base_predictors = ["post_ai", "post_public", "log_employees", "hr_change", "training_plan", "suggestion_system"]
    mature_predictors = ["mature_post_ai", "mature_post_public", "log_employees", "hr_change", "training_plan", "suggestion_system"]
    models = {
        outcome: fit_two_way_fe(panel, outcome, base_predictors, treatment="post_ai")
        for outcome in outcome_specs
    }
    sensitivity = {
        outcome: fit_two_way_fe(panel, outcome, mature_predictors, treatment="mature_post_ai")
        for outcome in outcome_specs
    }
    adoption_distribution = (
        cohort.loc[cohort["ever_ai"].eq(1), "adoption_year"]
        .value_counts()
        .sort_index()
    )
    early_adopters = cohort[cohort["ever_ai"].eq(1) & cohort["adoption_year"].le(2021)]
    return {
        "meta": {
            "years": "2015–2023 (5개 차수)",
            "cohort_firms": int(cohort["id"].nunique()),
            "firm_years": int(len(panel)),
            "ai_adopters": int(cohort["ever_ai"].sum()),
            "early_adopters": int(len(early_adopters)),
            "early_public_adopters": int(early_adopters["public"].sum()),
            "method": "2023년 AI 최초 도입연도 회고정보로 노출시점을 복원한 기업·연도 고정효과 선형확률모형, 기업 군집표준오차",
            "caution": "2023년 잔존 사업체만 거슬러 올라간 회고적 패널입니다. AQ3014–AQ3017은 각 차수의 ‘작년 한해’ 혁신을 묻는 1년 성과이며, 2년 간격 조사와 성과 측정기간은 다릅니다. WPS 2023은 2024년에 조사한 2023년 연간 혁신성과입니다. 2023년 도입 125개가 집중되어 있어 인과 DID가 아닌 탐색적 종단 연관으로 해석합니다.",
        },
        "adoption_distribution": [
            {"year": int(year), "firms": int(count)}
            for year, count in adoption_distribution.items()
        ],
        "models": models,
        "sensitivity": {
            "label": "도입 2년 경과 민감도(성과 측정창 아님)",
            "rationale": "AI 도입 후 경과기간에 따라 노출 정의를 달리한 탐색적 민감도입니다. 혁신 문항이 2년 누적성과를 측정하기 때문이 아니며, 도입 초기 관측을 0으로 둔 기존 계산을 유지했습니다.",
            "models": sensitivity,
        },
    }


def analyze_wps(path: Path) -> dict:
    columns = WPS_BASE_COLUMNS + WPS_AI_COLUMNS + WPS_ICT_COLUMNS
    full_frame = pd.read_stata(
        path,
        columns=columns,
        convert_categoricals=False,
        preserve_dtypes=False,
    )
    panel_analysis = analyze_wps_panel(full_frame)
    frame = full_frame[full_frame["year"].eq(2023)].copy()
    frame["public"] = frame["sep"].eq(5).astype(int)
    frame["weight"] = frame["c_wgt23"]
    frame["ai_adopt"] = valid(frame["ai001"], [1, 2]).eq(1).astype(float)
    frame["org_innovation"] = valid(frame["aq3016"], [1, 2]).eq(1).astype(float)
    frame["log_employees"] = np.log1p(frame["epq1011"].where(frame["epq1011"].between(1, 1_000_000)))
    frame["z_log_employees"] = (
        frame["log_employees"] - frame["log_employees"].mean()
    ) / frame["log_employees"].std(ddof=0)
    frame["manufacturing"] = frame["ind"].eq("C").astype(int)
    frame["finance"] = frame["sep"].eq(3).astype(int)
    frame["union"] = frame["mq1001"].eq(1).astype(int)
    frame["hr_change"] = 6 - valid(frame["dq1029"], [1, 2, 3, 4, 5])
    frame["z_hr_change"] = (frame["hr_change"] - frame["hr_change"].mean()) / frame["hr_change"].std(ddof=0)
    frame["training_plan"] = valid(frame["eq1004"], [1, 2]).eq(1).astype(float)
    frame["suggestion_system"] = valid(frame["dq2016"], [1, 2]).eq(1).astype(float)
    frame["ai_public_interaction"] = frame["ai_adopt"] * frame["public"]

    weighted_base = int(frame["weight"].notna().sum())
    public_mask = frame["public"].eq(1)
    private_mask = ~public_mask
    adopters = frame["ai_adopt"].eq(1)

    comparison = [
        binary_metric(frame, "ai001", 1, label="현재 AI 활용", metric_id="ai_adoption", note="2023년 말 기준 직접 활용 여부 · 금융·보험업은 기업, 그 외는 사업장 기준"),
        binary_metric(frame, "ai079", 1, label="5년 내 AI 도입 계획", metric_id="ai_plan", note="현재 AI 미활용 사업체만 응답", eligible=frame["ai001"].eq(2)),
        binary_metric(frame, "aq3014", 1, label="제품·서비스 혁신", metric_id="product_innovation", note="2023년 한 해 신제품·서비스 또는 크게 개선된 제품·서비스 출시 · 2024년 조사"),
        binary_metric(frame, "aq3015", 1, label="공정·프로세스 혁신", metric_id="process_innovation", note="2023년 한 해 공정·프로세스 혁신 실행 · 2024년 조사"),
        binary_metric(frame, "aq3016", 1, label="조직 혁신", metric_id="organization_innovation", note="2023년 한 해 조직 혁신 실행 · 2024년 조사"),
        binary_metric(frame, "aq3017", 1, label="마케팅 혁신", metric_id="marketing_innovation", note="2023년 한 해 마케팅 혁신 실행 · 2024년 조사"),
    ]

    management = [
        scale_metric(frame, "dq1028", label="HR의 경영 의사결정 영향", metric_id="hr_influence", note="5점 환산: 높을수록 영향이 큼", reverse=True),
        scale_metric(frame, "dq1029", label="HR의 변화 파트너 역할", metric_id="hr_change", note="5점 환산: 높을수록 변화 주도자·사업 파트너 인식이 강함", reverse=True),
        binary_metric(frame, "dq2016", 1, label="업무개선 제안제도", metric_id="suggestion_system", note="제안제도 운영 사업체 비율"),
        binary_metric(frame, "eq1002", 3, label="숙련·역량 정기점검", metric_id="skills_audit", note="경영계획의 일부로 정기 점검하는 사업체 비율"),
        binary_metric(frame, "eq1004", 1, label="교육훈련 사전계획", metric_id="training_plan", note="법정교육 외 교육훈련 계획 수립 비율"),
        binary_metric(frame, "eq1005", 1, label="교육훈련 예산 편성", metric_id="training_budget", note="법정교육 외 교육훈련 예산 사전 편성 비율"),
        binary_metric(frame, "eq1007", 1, label="법정교육 외 훈련 실시", metric_id="training_execution", note="법정교육을 넘어선 교육훈련 실시 비율"),
        binary_metric(frame, "eq1008", 1, label="근로자대표와 훈련 협의", metric_id="training_consultation", note="교육훈련 실시·지원 시 노조 또는 근로자대표와 협의한 비율"),
    ]

    ai_outcomes = [
        binary_metric(frame, "ai046", 1, label="근로자 생산성 증가", metric_id="productivity_up", note="AI 활용 171개 사업체의 체감효과", eligible=adopters),
        binary_metric(frame, "ai047", 1, label="근로자 만족도 증가", metric_id="satisfaction_up", note="AI 활용 171개 사업체의 체감효과", eligible=adopters),
        binary_metric(frame, "ai048", 1, label="건강·안전 긍정", metric_id="safety_up", note="AI 활용 171개 사업체의 체감효과", eligible=adopters),
        binary_metric(frame, "ai049", 1, label="성과측정 능력 증가", metric_id="measurement_up", note="AI 활용 171개 사업체의 체감효과", eligible=adopters),
        binary_metric(frame, "ai045", 2, label="전체 고용 감소", metric_id="employment_down", note="AI 활용 후 고용규모가 감소했다는 응답", eligible=adopters),
    ]
    ai_perceptions = [
        ai_perception_distribution(frame, column, metric_id=metric_id, label=label)
        for column, metric_id, label in [
            ("ai045", "employment", "전체 고용 변화 인식"),
            ("ai046", "productivity", "근로자 생산성 변화 인식"),
            ("ai047", "satisfaction", "근로자 만족도 변화 인식"),
            ("ai048", "safety", "건강·안전 영향 인식"),
            ("ai049", "measurement", "성과측정 능력 변화 인식"),
        ]
    ]

    consultation_any = frame[[f"ai{i:03d}" for i in range(51, 57)]].eq(1).any(axis=1).where(adopters)
    governance = [
        binary_metric(frame, "ai050", 1, label="직원·업무 데이터 수집", metric_id="worker_data", note="AI 활용과 관련한 직원 또는 업무 데이터 수집", eligible=adopters),
        group_metric(frame, consultation_any.astype(float), label="신기술 도입 노사협의", metric_id="consultation", kind="rate", note="일자리·임금·근로조건·숙련·데이터·취약집단 중 하나 이상 논의"),
        binary_metric(frame, "ai057", 1, label="AI 단체협약 체결", metric_id="collective_agreement", note="신기술 협의 결과", eligible=adopters),
        binary_metric(frame, "ai058", 1, label="AI 전략 변경·채택", metric_id="strategy_governance", note="신기술 협의 결과", eligible=adopters),
        binary_metric(frame, "ai059", 1, label="AI 가이드라인 변경·채택", metric_id="guideline_governance", note="신기술 협의 결과", eligible=adopters),
        binary_metric(frame, "ai060", 1, label="기술 요구 변화", metric_id="skill_change", note="AI가 사업장의 기술 요구를 변화시켰다는 응답", eligible=adopters),
        binary_metric(frame, "ai061", 1, label="내부 재교육·숙련향상", metric_id="reskilling", note="AI로 기술 요구가 변한 사업체의 대응", eligible=frame["ai060"].eq(1)),
        binary_metric(frame, "ai065", 1, label="전문 AI 기술 중요성 증가", metric_id="ai_skill", note="AI 도입 후 인력요건 변화", eligible=adopters),
        binary_metric(frame, "ai066", 1, label="창의·소통 역량 중요성 증가", metric_id="human_skill", note="AI 도입 후 인간적 능력의 중요성 변화", eligible=adopters),
    ]

    drivers = [
        binary_metric(frame, "ai033", 1, label="생산성 향상", metric_id="productivity", note="AI 도입 결정요인", eligible=adopters),
        binary_metric(frame, "ai034", 1, label="인건비 절감", metric_id="labor_cost", note="AI 도입 결정요인", eligible=adopters),
        binary_metric(frame, "ai035", 1, label="산업재해 감소", metric_id="accident", note="AI 도입 결정요인", eligible=adopters),
        binary_metric(frame, "ai036", 1, label="숙련인력 부족 해결", metric_id="skill_shortage", note="AI 도입 결정요인", eligible=adopters),
    ]
    barriers = [
        binary_metric(frame, "ai068", 1, label="과도한 비용", metric_id="cost", note="AI 활용 사업체가 응답한 도입 저해요인", eligible=adopters),
        binary_metric(frame, "ai069", 1, label="도입·활용 기술 부족", metric_id="technology", note="AI 활용 사업체가 응답한 도입 저해요인", eligible=adopters),
        binary_metric(frame, "ai070", 1, label="정부 규제", metric_id="regulation", note="AI 활용 사업체가 응답한 도입 저해요인", eligible=adopters),
        binary_metric(frame, "ai071", 1, label="기술에 대한 확신 부족", metric_id="confidence", note="AI 활용 사업체가 응답한 도입 저해요인", eligible=adopters),
    ]

    employment_distribution = []
    for value, label in [(1, "증가"), (2, "감소"), (3, "영향 없음"), (99, "모름")]:
        employment_distribution.append(
            binary_metric(frame, "ai045", value, label=label, metric_id=f"employment_{value}", note="AI 활용 사업체의 응답", eligible=adopters)
        )

    automation_private = frame[private_mask].copy()
    automation = {
        "note": "ICT·스마트공장 문항은 2023년 공공부문 응답이 1개뿐이어서 민간 제조·생산 사업체만 제시",
        "factory_n": int(automation_private["ict001"].notna().sum()),
        "information_integration": rounded(valid(automation_private["ict021"], [1, 2, 3, 4, 5]).mean()),
        "smart_factory_level": rounded(valid(automation_private["ict022"], [1, 2, 3, 4, 5]).mean()),
        "productivity_effect": rounded(valid(automation_private["ict035"], [1, 2, 3, 4, 5]).mean()),
        "erp_rate": rounded(automation_private["ict020r1"].where(automation_private["ict020r1"].isin([0, 1])).mean()),
        "mes_pop_rate": rounded(automation_private["ict020r2"].where(automation_private["ict020r2"].isin([0, 1])).mean()),
    }

    adoption_model = fit_weighted_logit(
        frame,
        "ai_adopt",
        ["public", "z_log_employees", "manufacturing", "finance", "union", "z_hr_change", "training_plan", "suggestion_system"],
    )
    innovation_model = fit_weighted_logit(
        frame,
        "org_innovation",
        ["ai_adopt", "public", "ai_public_interaction", "z_log_employees", "manufacturing", "finance", "union", "z_hr_change", "training_plan", "suggestion_system"],
    )

    return {
        "meta": {
            "source": "사업체패널조사(WPS) 통합자료 v1.91",
            "wave": 10,
            "year": 2023,
            "fieldwork": "2024년 6–11월",
            "innovation_measurement_window": "AQ3014–AQ3017: 작년 한해(2023년)의 혁신 여부 · 1년 성과",
            "total_n": int(len(frame)),
            "public_n": int(public_mask.sum()),
            "private_n": int(private_mask.sum()),
            "weighted_n": weighted_base,
            "public_ai_n": int((public_mask & adopters).sum()),
            "private_ai_n": int((private_mask & adopters).sum()),
            "group_rule": "sep=5 공공부문, sep=1~4 민간사업체",
            "weight": "10차 횡단면 사업체 가중치(c_wgt23), 유효표본 2,148개",
        },
        "comparison": comparison,
        "management": management,
        "ai_outcomes": ai_outcomes,
        "ai_perceptions": ai_perceptions,
        "governance": governance,
        "drivers": drivers,
        "barriers": barriers,
        "employment_distribution": employment_distribution,
        "automation_private": automation,
        "models": {
            "adoption": adoption_model,
            "organization_innovation": innovation_model,
            "method": "가중 이항 GLM, HC3 강건표준오차; 규모·제조업·금융업·노조·HR 변화역할·훈련계획·제안제도 통제",
            "caution": "횡단면 연관성 모형이며 인과효과가 아니다. 공공 AI 활용 사업체는 21개로 상호작용 추정의 불확실성이 크다.",
        },
        "panel": panel_analysis,
    }


HCCP_WAVES = [
    {
        "wave": 1, "year": 2005,
        "head": "HCCP_Head_1st.dta", "work": "HCCP_Work_1st.dta",
        "id_head": "C1_ID1", "id_work": "W1_id1", "type": "C1_TYPE", "scale": "C1_SCALE", "industry": "C1_IND1",
        "hris": "C1B02_04", "elearning": "C1D02_01_07", "hr_change": "W106_06", "culture": None,
    },
    {
        "wave": 2, "year": 2007,
        "head": "HCCP_Head_2nd.dta", "work": "HCCP_Work_2nd.dta",
        "id_head": "C2_ID1", "id_work": "W2_id1", "type": "C2_TYPE", "scale": "C2_SCALE", "industry": "C2_IND1",
        "hris": "C2B02_04", "elearning": "C2D02_01_11", "hr_change": "W206_04", "culture": ["W230_01", "W230_02", "W230_04"], "reverse_change": True,
    },
    {
        "wave": 3, "year": 2009,
        "head": "HCCP_Head_3th.dta", "work": "HCCP_Work_3rd.dta",
        "id_head": "C3_ID1", "id_work": "W3_id1", "type": "C3_TYPE", "scale": "C3_SCALE", "industry": "C3_IND1",
        "hris": "C3E01_06", "elearning": "C3C01_06_07", "hr_change": "W306_04", "culture": ["W328_01", "W328_02", "W328_04"], "reverse_change": True,
    },
    {
        "wave": 4, "year": 2011,
        "head": "HCCP_Head_4th.dta", "work": "HCCP_Work_4th.dta",
        "id_head": "C4_ID1", "id_work": "W4_id1", "type": "C4_TYPE", "scale": "C4_SCALE", "industry": "C4_IND1",
        "hris": "C4D01_06", "elearning": "C4C01_06_07", "hr_change": "W406_04", "culture": ["W428_01", "W428_02", "W428_03"], "reverse_change": False,
    },
    {
        "wave": 5, "year": 2013,
        "head": "HCCP_Head_5th.dta", "work": "HCCP_Work_5th.dta",
        "id_head": "C5_ID1", "id_work": "W5_id1", "type": "C5_TYPE", "scale": "C5_SCALE", "industry": "C5_IND1",
        "hris": "C5D01_06", "elearning": "C5C01_06_07", "hr_change": "W506_04", "culture": ["W530_01", "W530_02", "W530_03"], "reverse_change": False,
    },
    {
        "wave": 6, "year": 2015,
        "head": "HCCP_Head_6th.dta", "work": "HCCP_Work_6th.dta",
        "id_head": "C6_ID1", "id_work": "W6_id1", "type": "C6_TYPE", "scale": "C6_SCALE", "industry": "C6_IND1",
        "hris": "C6D01_06", "elearning": "C6C01_07_09", "hr_change": "W606_04", "culture": ["W627_01", "W627_02", "W627_03"], "reverse_change": False,
    },
    {
        "wave": 7, "year": 2017,
        "head": "HCCP_Head_7th.dta", "work": "HCCP_Work_7th.dta",
        "id_head": "C7_ID1", "id_work": "W7_id1", "type": "C7_TYPE", "scale": "C7_SCALE", "industry": "C7_IND1",
        "hris": "C7D01_06", "elearning": "C7C01_07_09", "hr_change": "W706_04", "culture": ["W727_01", "W727_02", "W727_03"], "reverse_change": False,
    },
]


def plain_mean(series: pd.Series) -> float | None:
    return rounded(series.dropna().mean()) if series.notna().any() else None


def read_stata_columns(path: Path, requested: list[str]) -> pd.DataFrame:
    """Read requested Stata columns while tolerating legacy case inconsistencies."""
    with pd.read_stata(path, convert_categoricals=False, iterator=True) as reader:
        available = list(reader.variable_labels().keys())
    lookup = {column.lower(): column for column in available}
    actual = []
    missing = []
    for column in requested:
        match = lookup.get(column.lower())
        if match is None:
            missing.append(column)
        else:
            actual.append(match)
    if missing:
        raise ValueError(f"Missing columns in {path.name}: {missing}")
    frame = pd.read_stata(path, columns=actual, convert_categoricals=False, preserve_dtypes=False)
    return frame.rename(columns={match: requested[index] for index, match in enumerate(actual)})


def analyze_hccp(directory: Path) -> dict:
    trend = []
    panel_frames = []
    latest_head = None
    latest_work = None
    latest_spec = None

    for spec in HCCP_WAVES:
        head_columns = [spec["id_head"], spec["type"], spec["scale"], spec["industry"], spec["hris"], spec["elearning"]]
        work_columns = [spec["id_work"], spec["hr_change"]]
        if spec["culture"]:
            work_columns.extend(spec["culture"])
        head = read_stata_columns(directory / spec["head"], head_columns)
        work = read_stata_columns(directory / spec["work"], work_columns)

        firm = pd.DataFrame({
            "firm_id": head[spec["id_head"]],
            "type": head[spec["type"]],
            "scale": head[spec["scale"]],
            "industry": head[spec["industry"]],
            "hris": valid(head[spec["hris"]], [1, 2]).eq(1).where(valid(head[spec["hris"]], [1, 2]).notna()).astype(float),
            "elearning": valid(head[spec["elearning"]], [1, 2]).eq(1).where(valid(head[spec["elearning"]], [1, 2]).notna()).astype(float),
        })
        worker = pd.DataFrame({
            "firm_id": work[spec["id_work"]],
            "hr_change": valid(work[spec["hr_change"]], [1, 2, 3, 4, 5]),
        })
        if spec["culture"]:
            culture_items = [valid(work[column], [1, 2, 3, 4, 5]) for column in spec["culture"]]
            if spec.get("reverse_change"):
                culture_items[0] = 6 - culture_items[0]
            worker["innovation_culture"] = pd.concat(culture_items, axis=1).mean(axis=1, skipna=False)
        firm_worker = worker.groupby("firm_id", as_index=False).mean(numeric_only=True)
        merged = firm.merge(firm_worker, on="firm_id", how="left")
        merged["wave"] = spec["wave"]
        merged["year"] = spec["year"]
        merged["scale_value"] = pd.to_numeric(merged["scale"], errors="coerce")
        if "innovation_culture" in merged:
            panel_frames.append(
                merged[[
                    "firm_id", "wave", "year", "scale_value", "hris",
                    "elearning", "hr_change", "innovation_culture",
                ]].copy()
            )
        trend.append({
            "wave": spec["wave"],
            "year": spec["year"],
            "firms": int(len(firm)),
            "workers": int(len(work)),
            "hris_rate": plain_mean(firm["hris"]),
            "elearning_rate": plain_mean(firm["elearning"]),
            "hr_change": plain_mean(merged["hr_change"]),
            "innovation_culture": plain_mean(merged["innovation_culture"]) if "innovation_culture" in merged else None,
        })
        if spec["wave"] == 7:
            latest_head = head
            latest_work = work
            latest_spec = spec

    assert latest_head is not None and latest_work is not None and latest_spec is not None
    head_extra = read_stata_columns(
        directory / latest_spec["head"],
        ["C7_ID1", "C7_TYPE", "C7_SCALE", "C7_IND1", "C7A01_07", "C7B01_08_04", "C7C01_07_09", "C7D01_06"],
    )
    worker_extra = read_stata_columns(
        directory / latest_spec["work"],
        [
            "W7_id1", "W706_04", "W723_01", "W723_03", "W725_01",
            "W725_02", "W725_03", "W725_04", "W726_01", "W726_02",
            "W726_03", "W726_04", "W726_05", "W726_06", "W727_01",
            "W727_02", "W727_03",
        ],
    )
    head_frame = pd.DataFrame({
        "firm_id": head_extra["C7_ID1"],
        "type": head_extra["C7_TYPE"],
        "scale": head_extra["C7_SCALE"],
        "industry": head_extra["C7_IND1"],
        "new_product": valid(head_extra["C7A01_07"], [1, 2]).eq(1).where(valid(head_extra["C7A01_07"], [1, 2]).notna()).astype(float),
        "talent_database": valid(head_extra["C7B01_08_04"], [0, 1]).where(valid(head_extra["C7B01_08_04"], [0, 1]).notna()),
        "elearning": valid(head_extra["C7C01_07_09"], [1, 2]).eq(1).where(valid(head_extra["C7C01_07_09"], [1, 2]).notna()).astype(float),
        "hris": valid(head_extra["C7D01_06"], [1, 2]).eq(1).where(valid(head_extra["C7D01_06"], [1, 2]).notna()).astype(float),
    })
    worker_scales = pd.DataFrame({"firm_id": worker_extra["W7_id1"]})
    worker_scales["hr_change"] = valid(worker_extra["W706_04"], [1, 2, 3, 4, 5])
    worker_scales["participation"] = valid(worker_extra["W723_01"], [1, 2, 3, 4, 5])
    worker_scales["autonomy"] = valid(worker_extra["W723_03"], [1, 2, 3, 4, 5])
    worker_scales["talent_management"] = pd.concat(
        [valid(worker_extra[column], [1, 2, 3, 4, 5]) for column in ["W725_01", "W725_02", "W725_03", "W725_04"]], axis=1
    ).mean(axis=1, skipna=False)
    worker_scales["communication_trust"] = pd.concat(
        [valid(worker_extra[column], [1, 2, 3, 4, 5]) for column in ["W726_01", "W726_02", "W726_03", "W726_04", "W726_05", "W726_06"]], axis=1
    ).mean(axis=1, skipna=False)
    worker_scales["innovation_culture"] = pd.concat(
        [valid(worker_extra[column], [1, 2, 3, 4, 5]) for column in ["W727_01", "W727_02", "W727_03"]], axis=1
    ).mean(axis=1, skipna=False)
    firm_worker = worker_scales.groupby("firm_id", as_index=False).mean(numeric_only=True)
    latest = head_frame.merge(firm_worker, on="firm_id", how="left")

    type_labels = {1: "상장", 2: "코스닥", 3: "외감·일반"}
    types = []
    for type_code, label in type_labels.items():
        group = latest[latest["type"].eq(type_code)]
        types.append({
            "id": str(type_code),
            "label": label,
            "firms": int(len(group)),
            "workers": int(worker_scales[worker_scales["firm_id"].isin(group["firm_id"])].shape[0]),
            "new_product_rate": plain_mean(group["new_product"]),
            "hris_rate": plain_mean(group["hris"]),
            "elearning_rate": plain_mean(group["elearning"]),
            "talent_database_rate": plain_mean(group["talent_database"]),
            "hr_change": plain_mean(group["hr_change"]),
            "participation": plain_mean(group["participation"]),
            "autonomy": plain_mean(group["autonomy"]),
            "talent_management": plain_mean(group["talent_management"]),
            "communication_trust": plain_mean(group["communication_trust"]),
            "innovation_culture": plain_mean(group["innovation_culture"]),
        })

    model_frame = latest[["innovation_culture", "hris", "elearning", "hr_change", "participation", "autonomy", "scale", "industry", "type"]].dropna().copy()
    continuous = ["hr_change", "participation", "autonomy"]
    for column in continuous:
        model_frame[f"z_{column}"] = (model_frame[column] - model_frame[column].mean()) / model_frame[column].std(ddof=0)
    categorical = pd.get_dummies(model_frame[["scale", "industry", "type"]].astype("category"), drop_first=True, dtype=float)
    predictors = pd.concat(
        [model_frame[["hris", "elearning", "z_hr_change", "z_participation", "z_autonomy"]].astype(float), categorical],
        axis=1,
    )
    result = sm.OLS(model_frame["innovation_culture"].astype(float), sm.add_constant(predictors, has_constant="add")).fit(cov_type="HC3")
    model_terms = {}
    for name in ["hris", "elearning", "z_hr_change", "z_participation", "z_autonomy"]:
        model_terms[name] = {
            "beta": rounded(result.params[name]),
            "p": rounded(result.pvalues[name]),
            "significant": bool(result.pvalues[name] < 0.05),
        }

    longitudinal = pd.concat(panel_frames, ignore_index=True)
    longitudinal = longitudinal[longitudinal["wave"].between(4, 7)].copy()
    longitudinal["z_hr_change"] = (
        longitudinal["hr_change"] - longitudinal["hr_change"].mean()
    ) / longitudinal["hr_change"].std(ddof=0)
    longitudinal["z_scale"] = (
        longitudinal["scale_value"] - longitudinal["scale_value"].mean()
    ) / longitudinal["scale_value"].std(ddof=0)
    longitudinal["digital_bundle"] = longitudinal[["hris", "elearning"]].mean(axis=1, skipna=False)
    longitudinal["digital_hr_change"] = longitudinal["digital_bundle"] * longitudinal["z_hr_change"]
    panel_base = fit_two_way_fe(
        longitudinal,
        "innovation_culture",
        ["hris", "elearning", "z_hr_change", "z_scale"],
    )
    panel_complementarity = fit_two_way_fe(
        longitudinal,
        "innovation_culture",
        ["hris", "elearning", "z_hr_change", "digital_hr_change", "z_scale"],
    )

    return {
        "meta": {
            "source": "한국직업능력연구원 인적자본기업패널(HCCP) 1~7차",
            "years": "2005~2017",
            "latest_year": 2017,
            "latest_firms": int(len(head_frame)),
            "latest_workers": int(len(worker_extra)),
            "scope": "민간기업 패널; 공공/민간 식별변수는 없으며 기업형태는 상장·코스닥·외감/일반",
        },
        "trend": trend,
        "types": types,
        "model": {
            "n": int(result.nobs),
            "r_squared": rounded(result.rsquared),
            "adjusted_r_squared": rounded(result.rsquared_adj),
            "coefficients": model_terms,
            "method": "기업별 근로자 평균 OLS, HC3 강건표준오차; 기업규모·업종·기업형태 통제",
            "caution": "HCCP 디지털 변수는 AI가 아니라 인사정보시스템과 e-learning 기반을 측정한다.",
        },
        "panel": {
            "meta": {
                "years": "2011–2017 (4~7차)",
                "firm_years": int(len(longitudinal)),
                "firms": int(longitudinal["firm_id"].nunique()),
                "balanced_four_wave_firms": int(longitudinal.groupby("firm_id")["year"].nunique().eq(4).sum()),
                "method": "기업·연도 고정효과 모형, 기업 군집표준오차; 동일 기업 내부의 디지털 HR·HR 변화역할 변화와 혁신문화 변화 비교",
                "caution": "HCCPⅠ은 공기업을 조사대상에서 제외한 민간기업 패널이며 AI 직접변수는 없다. 디지털 HR 보완성의 장기 벤치마크로만 사용한다.",
            },
            "base": panel_base,
            "complementarity": panel_complementarity,
        },
    }


def analysis_framework() -> dict:
    """Literature-grounded framework used to organize the dashboard."""
    return {
        "title": "AI 도입–보완적 조직관리–혁신성과 분석틀",
        "logic": [
            {
                "step": 1,
                "id": "context",
                "label": "조직 맥락",
                "variables": "공공/민간, 규모, 업종, 노조, 지역",
                "basis": "TOE와 AI readiness 연구는 기술·조직·환경 조건이 함께 도입역량을 만든다고 본다.",
            },
            {
                "step": 2,
                "id": "adoption",
                "label": "AI·디지털 도입",
                "variables": "WPS AI 활용·도입연도 / HCCP HRIS·e-learning",
                "basis": "AI는 단일 도구 보유보다 데이터·인적·조직 자원이 결합된 조직역량으로 다뤄야 한다.",
            },
            {
                "step": 3,
                "id": "complement",
                "label": "보완적 조직관리",
                "variables": "HR 변화역할, 훈련계획·예산, 제안제도, 참여·자율성",
                "basis": "훈련·참여·권한위임 등 HR 관행은 개별 제도보다 상호보완적 묶음으로 혁신과 연결된다.",
            },
            {
                "step": 4,
                "id": "governance",
                "label": "책임 있는 실행",
                "variables": "근로자 데이터, 노사협의, 가이드라인, 재교육",
                "basis": "AI의 자동화와 증강은 함께 관리되어야 하며 직원 참여·책임성과 공정성 통제가 필요하다.",
            },
            {
                "step": 5,
                "id": "outcome",
                "label": "혁신 결과·영향 인식",
                "variables": "회귀 결과변수: 제품·공정·조직·마케팅 혁신, HCCP 혁신문화 / 기술통계 전용: AI의 생산성·만족·안전·고용·성과측정 영향 인식",
                "basis": "AI 역량과 조직활동·혁신의 관계를 회귀로 검토한다. AI 영향 체감 문항은 주관적 인식이며, 실제 생산성 증가의 측정치로 해석하거나 회귀변수로 사용하지 않는다.",
            },
        ],
        "questions": [
            {
                "id": "rq1",
                "label": "RQ1",
                "question": "공공기관과 민간기업은 AI 도입 및 보완적 조직관리에서 어떻게 다른가?",
                "test": "WPS 2023 가중 평균·비율 비교와 AI 도입 가중 로짓",
            },
            {
                "id": "rq2",
                "label": "RQ2",
                "question": "AI 도입은 조직혁신과 연결되며 그 관계가 공공·민간에서 다른가?",
                "test": "WPS 조직혁신 가중 로짓의 AI×공공 상호작용 + 회고적 기업·연도 고정효과",
            },
            {
                "id": "rq3",
                "label": "RQ3",
                "question": "훈련·참여·HR 변화역할은 AI/디지털 기반과 혁신의 보완조건인가?",
                "test": "WPS 다중회귀의 조직관리 계수 + HCCP 디지털 HR×HR 변화역할 패널모형",
            },
            {
                "id": "rq4",
                "label": "RQ4",
                "question": "공공·민간 AI 활용 사업체는 생산성·고용·만족·안전·성과측정에 대한 영향을 어떻게 인식하는가?",
                "test": "AI045~AI049의 증가/감소(안전: 긍정/부정)·영향 없음·모름을 모두 유지한 막대그래프와 응답수·가중 비율. 기술통계에만 사용하며 회귀변수에서 제외한다.",
            },
        ],
        "model_matrix": [
            {
                "id": "wps_descriptive",
                "dataset": "WPS 2023",
                "design": "가중 공공–민간 비교",
                "purpose": "도입·관리·성과의 대표적 현황",
                "claim_level": "기술통계",
            },
            {
                "id": "wps_cross",
                "dataset": "WPS 2023",
                "design": "가중 GLM 다중회귀(HC3)",
                "purpose": "규모·업종·노조·HR 조건 통제 후 관련요인",
                "claim_level": "조건부 연관",
            },
            {
                "id": "wps_panel",
                "dataset": "WPS 2015–2023",
                "design": "기업·연도 고정효과 + 기업 군집표준오차",
                "purpose": "AI 도입시점 전후 동일 사업체의 혁신 변화",
                "claim_level": "탐색적 종단 연관",
            },
            {
                "id": "hccp_panel",
                "dataset": "HCCP 2011–2017",
                "design": "기업·연도 고정효과 + 기업 군집표준오차",
                "purpose": "디지털 HR·HR 변화역할과 혁신문화의 장기 보완성",
                "claim_level": "민간 장기 벤치마크",
            },
        ],
        "references": [
            {
                "id": "kli2025",
                "citation": "이경희·김정우·김기민·김향아·고대영 (2025)",
                "title": "AI 도입의 결정요인 및 성과 분석: 사업체패널조사 자료를 이용하여",
                "finding": "WPS AI 도입연도와 TOE, CRE 패널 프로빗, 다시점 DID를 결합한 국내 직접 선행연구다.",
                "use": "WPS 종단설계와 통제변수 선정의 직접 준거",
                "url": "https://dl.kli.re.kr/library/10110/contents/7738034",
            },
            {
                "id": "johnk2021",
                "citation": "Jöhnk, Weißert & Wyrtki (2021)",
                "title": "Ready or Not, AI Comes—An Interview Study of Organizational AI Readiness Factors",
                "finding": "25개 전문가 인터뷰를 통한 질적 연구로 전략 정렬·자원·지식·문화·데이터의 다섯 준비 범주를 제시했다. 회귀분석이나 성과 종속변수의 효과 검증 연구는 아니다.",
                "use": "AI 준비역량의 개념적 근거 · 종속변수 측정의 직접 근거와 구분",
                "url": "https://doi.org/10.1007/s12599-020-00676-7",
            },
            {
                "id": "mikalef2021",
                "citation": "Mikalef & Gupta (2021)",
                "title": "Artificial intelligence capability: Conceptualization, measurement calibration, and empirical study",
                "finding": "AI 역량과 자기보고식 조직 창의성·경쟁사 대비 기업성과의 관계를 분석했다. 객관적 생산성이나 AI 도입 여부 하나의 효과를 직접 측정한 연구는 아니다.",
                "use": "창의성과 상대적 조직성과의 개념·측정 근거 · WPS 이분형 혁신과 동일시하지 않음",
                "url": "https://doi.org/10.1016/j.im.2021.103434",
            },
            {
                "id": "mikalef2023",
                "citation": "Mikalef et al. (2023)",
                "title": "Examining how AI capabilities can foster organizational performance in public organizations",
                "finding": "유럽 3개국 168개 지방정부의 횡단면 PLS-SEM 연구다. 자기보고 11문항 조직성과를 사용하고 AI 역량과 핵심 조직활동을 통한 간접 관계를 분석했다.",
                "use": "공공조직의 다차원 성과와 매개가설 근거 · 인과효과나 공공·민간 차이의 직접 검증은 아님",
                "url": "https://doi.org/10.1016/j.giq.2022.101797",
            },
            {
                "id": "laursen2003",
                "citation": "Laursen & Foss (2003)",
                "title": "New human resource management practices, complementarities and the impact on innovation performance",
                "finding": "덴마크 민간기업 1,900개 설문에서 1993–1995년 출시 제품·서비스의 신규성 0~3단계를 종속변수로 순서형 프로빗을 추정했다. 9개 HR 관행과 주성분으로 구성한 HR 시스템을 설명변수로 사용했다.",
                "use": "HR 시스템과 제품·서비스 신규성의 관계 · 혁신문화나 공정혁신의 직접 측정 근거는 아님",
                "url": "https://doi.org/10.1093/cje/27.2.243",
            },
            {
                "id": "shipton2006",
                "citation": "Shipton et al. (2006)",
                "title": "HRM as a predictor of innovation",
                "finding": "영국 제조기업 22개 종단연구에서 훈련·팀워크·평가·탐색학습과 제품·기술시스템 혁신의 관계를 분석했다. 현재 확인 범위는 초록이며 정확한 문항·척도·시차는 미확인이다.",
                "use": "훈련·참여·학습 가설의 근거 · 세부 측정은 원문 확인 전 확정하지 않음",
                "url": "https://doi.org/10.1111/j.1748-8583.2006.00002.x",
            },
            {
                "id": "diaz2017",
                "citation": "Diaz-Fernandez, Bornay-Barrachina & Lopez-Cabrales (2017)",
                "title": "HRM practices and innovation performance: a panel-data approach",
                "finding": "스페인 제조업 1,363기업·6,887기업연도(2001–2008)의 동적 패널 GMM 연구다. 혁신성과는 특허 수이며, 별도 기업성과는 부가가치·노동생산성·시간당생산성이다.",
                "use": "HR 관행→혁신→성과의 매개·보상 조절가설 · 현재 HCCP 고정효과 OLS와는 추정법·종속변수가 다름",
                "url": "https://doi.org/10.1108/IJM-02-2015-0028",
            },
            {
                "id": "tambe2019",
                "citation": "Tambe, Cappelli & Yakubovich (2019)",
                "title": "Artificial Intelligence in Human Resources Management: Challenges and a Path Forward",
                "finding": "HR AI의 소표본, 책무성·공정성, 직원 반응 문제와 인과추론·실험·직원기여 원칙을 제시했다.",
                "use": "거버넌스와 과잉 인과해석 방지",
                "url": "https://doi.org/10.1177/0008125619867910",
            },
            {
                "id": "moon2022",
                "citation": "문동철·한지영·박지원 (2022)",
                "title": "교육훈련과 조직성과 간의 영향관계 문헌분석: HCCP 활용 논문을 중심으로",
                "finding": "HCCP 활용 논문 29편을 검토한 문헌분석이다. 교육훈련·조직문화·교육전이·성과의 연결을 정리했으며, 효과크기를 통합한 메타분석이나 새로운 회귀분석은 아니다.",
                "use": "HCCP 성과변수와 연구 설계의 탐색 근거 · 개별 실증논문의 측정절을 별도로 확인",
                "url": "https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002875144",
            },
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wps", type=Path, required=True)
    parser.add_argument("--hccp", type=Path, required=True, help="Directory containing HCCP STATA files")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    payload = {
        "framework": analysis_framework(),
        "wps": analyze_wps(args.wps),
        "hccp": analyze_hccp(args.hccp),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "wps_n": payload["wps"]["meta"]["total_n"],
        "hccp_firms": payload["hccp"]["meta"]["latest_firms"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
