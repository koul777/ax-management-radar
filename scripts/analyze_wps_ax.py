"""Reproducible, aggregate-only WPS 2023 AX / innovation analysis.

Specification fixed before estimation: process innovation is primary, product /
service innovation secondary. OLS linear-probability models use HC3 covariance,
AI x public plus size, categorical broad industry and three-state union status.
The conditional model adds HR role, suggestion system and training plan. Neither
AI-attributed outcome perceptions ai045--049 nor AX response items enter these
innovation regressions. WLS is a sensitivity check, not survey-design inference.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from scipy.stats import norm
from scipy.optimize import linprog
import statsmodels.api as sm
from statsmodels.stats.multitest import multipletests

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".tmp/wps_data/WPS_W10_v10.dta"
OUTPUT = ROOT / "app/data/wps-ax-analysis.json"
COLUMNS = ["id", "year", "sep", "ind", "epq1011", "mq1001", "c_wgt23",
           "ai001", "aq3015", "aq3014", "dq1029", "dq2016", "eq1004"] + [
               f"ai{number:03d}" for number in range(50, 68)]
# These additional columns are chart-only. They never enter a model design.
PERCEPTION_COLUMNS = [f"ai{number:03d}" for number in range(45, 50)]
READ_COLUMNS = [*COLUMNS, *PERCEPTION_COLUMNS, "ai002"]
INDUSTRIES = {
    "C": "제조업", "D": "전기·가스 공급업", "E": "수도·폐기물 처리업",
    "F": "건설업", "G": "도·소매업", "H": "운수·창고업",
    "I": "숙박·음식점업", "J": "정보통신업", "K": "금융·보험업",
    "L": "부동산업", "M": "전문·과학·기술 서비스업", "N": "사업지원·임대 서비스업",
    "O": "공공행정 등", "P": "교육 서비스업", "Q": "보건·사회복지 서비스업",
    "R": "예술·스포츠·여가 서비스업", "S": "협회·수리·개인 서비스업",
}
LABELS = {
    "const": "상수", "ai": "민간의 AI 활용–혁신 연관", "public": "AI 미활용 집단의 공공–민간 차이",
    "ai_public": "AI 연관의 공공–민간 차이", "log_employees": "종업원 수 자연로그",
    "union_active": "노동조합 있음(기준: 없음)", "union_dormant": "휴면노조(기준: 없음)",
    "hr_change": "HR 변화 주도·사업 파트너 역할(1~5)", "suggestion": "근로자 제안제도 운영",
    "training_plan": "비법정 교육훈련 사전 계획",
}
GOVERNANCE = [
    ("ai050", "직원·업무 데이터 수집", "data", "AI 활용과 관련한 데이터 수집 여부. 수집 자체를 좋은 거버넌스로 점수화하지 않음."),
    ("ai051", "협의: 잠재적 일자리 상실", "consultation", "신기술 사용 관련 노조·노사협의회와의 협의에서 논의된 사항."),
    ("ai052", "협의: 임금 영향", "consultation", "신기술 사용 관련 노조·노사협의회와의 협의에서 논의된 사항."),
    ("ai053", "협의: 근로조건 영향", "consultation", "신기술 사용 관련 노조·노사협의회와의 협의에서 논의된 사항."),
    ("ai054", "협의: 숙련·교육 필요", "consultation", "신기술 사용 관련 노조·노사협의회와의 협의에서 논의된 사항."),
    ("ai055", "협의: 데이터 수집·활용", "consultation", "신기술 사용 관련 노조·노사협의회와의 협의에서 논의된 사항."),
    ("ai056", "협의: 특정 근로자 집단 영향", "consultation", "신기술 사용 관련 노조·노사협의회와의 협의에서 논의된 사항."),
    ("ai057", "협의 결과: AI 단체협약 체결", "rules", "양 부문 모두 예 응답 0건. 변이가 없어 회귀를 추정하지 않음."),
    ("ai058", "협의 결과: AI 전략 변경·채택", "rules", "협의 결과에 관한 응답이며 일반적인 AI 전략 보유율이 아님. 공공 예 1건."),
    ("ai059", "협의 결과: 활용 가이드라인 변경·채택", "rules", "협의 결과에 관한 응답이며 일반적인 가이드라인 보유율이 아님. 공공 예 1건."),
    ("ai060", "AI로 인한 기술 요구 변화", "skills", "기술 요구의 변화 인식으로, 실제 역량 향상 척도가 아님. 다음 대응 문항의 분기 변수."),
    ("ai061", "기술 요구 변화 대응: 재교육·숙련 향상", "response", "ai060=1인 도입자만 적격. 비대상 결측을 아니요로 채우지 않음."),
    ("ai062", "기술 요구 변화 대응: 신규 채용", "response", "ai060=1인 도입자만 적격. 비대상 결측을 아니요로 채우지 않음."),
    ("ai063", "기술 요구 변화 대응: 외부서비스 구매", "response", "ai060=1인 도입자만 적격. 비대상 결측을 아니요로 채우지 않음."),
    ("ai064", "기술 요구 변화 대응: 해고·인원 정리", "response", "ai060=1인 도입자만 적격. 비대상 결측을 아니요로 채우지 않음."),
    ("ai065", "AI 전문기술 중요성 증가 인식", "perceived_requirements", "요구 역량의 중요성 변화 인식. 실제 보유 역량이나 AI 영향 회귀변수가 아님."),
    ("ai066", "창의성·소통 능력 중요성 증가 인식", "perceived_requirements", "요구 역량의 중요성 변화 인식. 실제 보유 역량이나 AI 영향 회귀변수가 아님."),
    ("ai067", "고학력 직원 확보 중요성 증가 인식", "perceived_requirements", "요구 역량의 중요성 변화 인식. 실제 보유 역량이나 AI 영향 회귀변수가 아님."),
]
CONSULTATION_STEM = "{귀사/귀 사업장}의 신기술 사용과 관련된 노조(노사협의회)와의 협의에서 다음의 내용들이 논의되었는지 응답해 주십시오."
CONSULTATION_ITEMS = {
    "ai051": "잠재적 일자리 상실", "ai052": "임금에 미치는 영향", "ai053": "근로 조건에 미치는 영향",
    "ai054": "숙련과 교육에 대한 필요", "ai055": "데이터 수집 및 활용", "ai056": "특정 근로자 집단에 미치는 영향",
}
AI_RESPONDENT = "인사담당자. AI001에서 2023년 말 AI를 활용한다고 응답한 사업체(AI001=1)."
CONSULTATION_RESPONDENT = AI_RESPONDENT + " 노조·노사협의회 보유 여부로 추가 분기하지 않음."
RESPONSE_RESPONDENT = AI_RESPONDENT + " AI060에서 기술 요구가 변화했다고 응답한 사업체(AI060=1)."
AI_PERIOD = "조사차수 2023 · 문항 자체의 회상기간 명시 없음"
YES_NO_UNKNOWN = "① 예 · ② 아니요 · 99 모름 (설문 화면에서 3초 후 표시)"
AGREE_UNKNOWN = "① 그렇다 · ② 그렇지 않다 · 99 잘 모르겠다 (설문 화면에서 3초 후 표시)"
RULES_STEM = "{귀사/귀 사업장}의 신기술 사용과 관련된 노조(노사협의회)와의 협의 결과 다음의 사항이 이루어졌는지 응답해 주십시오."
RULES_ITEMS = {
    "ai057": "인공지능 활용에 관한 단체협약 체결", "ai058": "인공지능 전략의 변경 혹은 채택",
    "ai059": "인공지능 활용 가이드라인의 변경 혹은 채택",
}
RESPONSE_STEM = "{귀사는/귀 사업장은} 기술 요구의 변경 문제를 다음 중 어떤 방식으로 해결하셨습니까?"
RESPONSE_ITEMS = {
    "ai061": "내부 직원을 재교육하거나 숙련도를 높여 해결", "ai062": "새 직원을 채용하여 해결",
    "ai063": "외부 회사로부터 서비스를 구매하여 해결", "ai064": "해고나 인원 정리를 통해 해결",
}
STANDALONE_AI_QUESTIONS = {
    "ai050": "{귀사는/귀 사업장은} 인공지능 활용과 관련하여 직원 또는 직원의 업무에 대한 데이터를 수집합니까?",
    "ai060": "인공지능이 {귀사/귀 사업장}의 기술 요구를 변화시켰다고 생각하십니까?",
    "ai065": "{귀사/귀 사업장}에는 인공지능 도입과 활용으로 인해 이를 유지하거나 개발하는데 필요한 보다 전문화된 인공지능 기술을 보유하는 것이 더 중요하게 되었습니까?",
    "ai066": "{귀사/귀 사업장}에서 인공지능의 도입이 창의성이나 의사소통 같은 보다 인간적인 능력을 좀 더 중요하게 만들었나요?",
    "ai067": "{귀사/귀 사업장}에는 인공지능 도입과 활용으로 인해 고학력 직원의 확보가 더 중요해졌습니까?",
}


def ai_question_detail(column: str) -> dict | None:
    source = f"WPS 통합 코드북 v1.91 AI050~AI067 항목; WPS 통합설문지 v1.91 물리 507~509쪽, {column.upper()}"
    if column in CONSULTATION_ITEMS:
        return {"exactQuestion": CONSULTATION_STEM, "itemPhrase": CONSULTATION_ITEMS[column],
                "respondent": CONSULTATION_RESPONDENT, "referencePeriod": AI_PERIOD,
                "responseOptions": YES_NO_UNKNOWN, "variableCode": column, "sourceLocation": source}
    if column in RULES_ITEMS:
        return {"exactQuestion": RULES_STEM, "itemPhrase": RULES_ITEMS[column],
                "respondent": CONSULTATION_RESPONDENT, "referencePeriod": AI_PERIOD,
                "responseOptions": AGREE_UNKNOWN, "variableCode": column, "sourceLocation": source}
    if column in RESPONSE_ITEMS:
        return {"exactQuestion": RESPONSE_STEM, "itemPhrase": RESPONSE_ITEMS[column],
                "respondent": RESPONSE_RESPONDENT, "referencePeriod": AI_PERIOD,
                "responseOptions": AGREE_UNKNOWN, "variableCode": column, "sourceLocation": source}
    if column in STANDALONE_AI_QUESTIONS:
        return {"exactQuestion": STANDALONE_AI_QUESTIONS[column], "respondent": AI_RESPONDENT,
                "referencePeriod": AI_PERIOD, "responseOptions": YES_NO_UNKNOWN,
                "variableCode": column, "sourceLocation": source}
    if column == "discussion_any":
        return {"exactQuestion": "파생지표 · 단독 설문문항 없음",
                "itemPhrase": "AI051~AI056 중 하나 이상이 ‘예’이면 논의 확인, 6개 모두 ‘아니요’이면 모든 항목 아니요, 그 외는 불명",
                "respondent": CONSULTATION_RESPONDENT, "referencePeriod": AI_PERIOD,
                "responseOptions": "AI051~AI056 각 항목의 " + YES_NO_UNKNOWN + "을 사용",
                "variableCode": "discussion_any ← AI051~AI056",
                "sourceLocation": "WPS 통합 코드북 v1.91 AI051~AI056 항목; WPS 통합설문지 v1.91 물리 507쪽(인쇄 489쪽), AI051~AI056; 대시보드 파생 규칙"}
    return None


def binary(series: pd.Series) -> pd.Series:
    """Only verified 1=yes, 2=no; do not turn 99/missing into zero."""
    return series.map({1: 1.0, 2: 0.0}).astype(float)


def positive_weights(series: pd.Series) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce").astype(float)
    return values.where(np.isfinite(values) & values.gt(0))


def discussion_composite(frame: pd.DataFrame) -> pd.Series:
    """Any known yes; all six known no; otherwise unknown (including missing)."""
    items = frame[[f"ai{number:03d}" for number in range(51, 57)]]
    result = pd.Series(99.0, index=frame.index)
    result.loc[items.eq(2).all(axis=1)] = 2
    result.loc[items.eq(1).any(axis=1)] = 1
    return result


def distribution(frame: pd.DataFrame, column: str,
                 labels: tuple[str, str, str] = ("예", "아니요", "모름")) -> dict:
    values = frame[column]
    recognized = values.isin([1, 2, 99])
    weights = positive_weights(frame["c_wgt23"])
    weighted = weights.where(recognized)
    weight_sum = float(weighted.sum())
    valid_n = int(recognized.sum())
    effective_n = weight_sum ** 2 / float(weighted.pow(2).sum()) if weight_sum > 0 else None
    return {
        "eligible_n": int(len(frame)), "valid_n": valid_n,
        "informative_n": int(values.isin([1, 2]).sum()),
        "missing_n": int((~recognized).sum()), "weighted_n": int(weighted.notna().sum()),
        "weighted_effective_n": effective_n, "weight_sum": weight_sum,
        "responses": [{
            "code": code, "label": label, "n": int(values.eq(code).sum()),
            "share": float(values.eq(code).sum() / valid_n) if valid_n else None,
            "weighted_n": int((values.eq(code) & weighted.notna()).sum()),
            "weighted_share": float(weighted.where(values.eq(code)).sum() / weight_sum) if weight_sum > 0 else None,
        } for code, label in zip([1, 2, 99], labels)],
    }


def governance_items(frame: pd.DataFrame) -> list[dict]:
    adopters = frame.loc[frame.ai001.eq(1)].copy()
    adopters["discussion_any"] = discussion_composite(adopters)
    specifications = [("discussion_any", "6개 주제 중 하나 이상 논의 확인", "consultation",
                       "하나라도 예=논의 확인, 6개 모두 아니요=모든 항목 아니요, 나머지=불명. 검증된 합성척도가 아님."), *GOVERNANCE]
    output = []
    for column, label, dimension, note in specifications:
        eligible = adopters.loc[adopters.ai060.eq(1)] if column in {"ai061", "ai062", "ai063", "ai064"} else adopters
        categories = ("논의 확인", "모든 항목 아니요", "불명") if column == "discussion_any" else ("예", "아니요", "모름")
        item = {"id": column, "column": column, "label": label, "dimension": dimension, "note": note,
                "usage": "descriptive_only", "eligibility": "ai001=1 및 ai060=1" if column in {"ai061", "ai062", "ai063", "ai064"} else "ai001=1"}
        for group, mask in [("public", eligible.sep.eq(5)), ("private", eligible.sep.isin([1, 2, 3, 4]))]:
            item[group] = distribution(eligible.loc[mask], column, categories)
        output.append(item)
    return output


def categorical_distribution(frame: pd.DataFrame, column: str, categories: list[dict],
                             source_n: int) -> dict:
    """Complete response distribution with mutually explicit selection stages.

    missing_n = nonresponse_n + invalid_n; excluded_n is structural ineligibility.
    unknown_n is inside valid_n only when 99 is an actual allowed category.
    """
    values = frame[column]
    codes = [category["code"] for category in categories]
    recognized = values.isin(codes)
    weights = positive_weights(frame.c_wgt23).where(recognized)
    weight_sum = float(weights.sum())
    valid_n = int(recognized.sum())
    unknown_n = int((values.eq(99) & recognized).sum())
    return {
        "source_n": int(source_n), "eligible_n": int(len(frame)),
        "excluded_n": int(source_n - len(frame)), "valid_n": valid_n,
        "informative_n": valid_n - unknown_n, "unknown_n": unknown_n,
        "missing_n": int((~recognized).sum()), "nonresponse_n": int(values.isna().sum()),
        "invalid_n": int((values.notna() & ~recognized).sum()),
        "weighted_n": int(weights.notna().sum()),
        "weighted_excluded_n": int(valid_n - weights.notna().sum()),
        "weighted_effective_n": weight_sum ** 2 / float(weights.pow(2).sum()) if weight_sum > 0 else None,
        "weight_sum": weight_sum,
        "responses": [{**category, "n": int(values.eq(category["code"]).sum()),
                       "share": float(values.eq(category["code"]).sum() / valid_n) if valid_n else None,
                       "weighted_n": int((values.eq(category["code"]) & weights.notna()).sum()),
                       "weighted_share": float(weights.where(values.eq(category["code"])).sum() / weight_sum) if weight_sum > 0 else None}
                      for category in categories],
    }


def key_items(frame: pd.DataFrame) -> list[dict]:
    """The 30 prespecified core items; not an exhaustive WPS questionnaire list."""
    frame = frame.copy()
    frame["discussion_any"] = discussion_composite(frame)
    # Keep original invalid/nonresponse values distinct for auditing; valid codes
    # are reversed, while 99 remains an invalid response, not a fabricated option.
    frame["hr_change_chart"] = frame.dq1029.map({1: 5, 2: 4, 3: 3, 4: 2, 5: 1})
    frame.loc[frame.dq1029.notna() & ~frame.dq1029.isin([1, 2, 3, 4, 5]), "hr_change_chart"] = 99
    yes_no = [{"code": 1, "label": "예", "raw_code": 1}, {"code": 2, "label": "아니요", "raw_code": 2}]
    yes_no_unknown = [*yes_no, {"code": 99, "label": "모름", "raw_code": 99}]
    agree_unknown = [{"code": 1, "label": "그렇다", "raw_code": 1}, {"code": 2, "label": "그렇지 않다", "raw_code": 2},
                     {"code": 99, "label": "잘 모르겠다", "raw_code": 99}]
    category_labels = {"management_foundation": "일반 조직관리 기반", "ai_adoption": "AI 현재 활용",
                       "ax_operations": "AX 운영·대응", "innovation_outcomes": "혁신 결과",
                       "attributed_perceptions": "AI 영향 인식 · 기술통계 전용"}
    specifications = [
        {"id": "dq1029", "column": "dq1029", "analysis_column": "hr_change_chart", "label": "HR 변화 주도·사업 파트너 역할",
         "category": "management_foundation", "concept": "인사부서의 변화 주도·사업 파트너 역할 인식",
         "role": "관리→AI 활용 모형의 설명변수; 주 모형은 2021 동일 문항 사용; AI 역량 척도가 아님",
         "period": "기준연도2023 한 해 동안의 인사부서 역할 평가",
         "section": "DQ1029; 통합설문지 물리적173쪽", "eligibility_rule": "all", "scale_type": "ordinal", "usage": "management_predictor_candidate",
         "measurement": "원문1매우그렇다~5전혀그렇지않다를6−응답으로환산;높을수록변화파트너역할",
         "categories": [{"code": code, "label": label, "raw_code": 6-code} for code, label in
                        [(1, "전혀 그렇지 않다"), (2, "그렇지 않다"), (3, "보통이다"), (4, "그렇다"), (5, "매우 그렇다")]],
         "note": "타 부서원들이 인사부서를 어떻게 보는지에 관한 응답. AI 전용 부서·AI 리더십의 직접 측정이 아님."},
        {"id": "dq2016", "column": "dq2016", "label": "업무개선 제안제도 운영", "category": "management_foundation",
         "concept": "근로자 참여를 위한 일반 제안제도", "role": "관리→AI 활용 모형의 설명변수; 주 모형은 2021 동일 문항 사용",
         "period": "기준연도2023 한 해 동안의 제안제도 운영 여부", "section": "DQ2016; 통합설문지 물리적184쪽", "eligibility_rule": "all",
         "scale_type": "binary", "usage": "management_predictor_candidate", "measurement": "1예/2아니요;모름선택지없음",
         "categories": yes_no, "note": "AI 관련 협의의 실시·품질이나 실제 제안 채택 성과와 구분."},
        {"id": "eq1004", "column": "eq1004", "label": "비법정 교육훈련 사전 계획", "category": "management_foundation",
         "concept": "교육훈련 계획화", "role": "관리→AI 활용 모형의 설명변수; 주 모형은 2021 동일 문항 사용",
         "period": "2023년 교육훈련에 대한 사전 계획 여부(법정교육훈련계획 제외)", "section": "EQ1004; 통합설문지 물리적228쪽", "eligibility_rule": "all",
         "scale_type": "binary", "usage": "management_predictor_candidate", "measurement": "1예/2아니요;모름선택지없음",
         "categories": yes_no, "note": "실제 훈련비·훈련시간·AI 재교육과 동일한 변수가 아님. 사전 계획이라는 문구만으로 AI보다 선행했다고 단정하지 않음."},
        {"id": "ai001", "column": "ai001", "label": "2023년 말 AI 활용", "category": "ai_adoption",
         "concept": "현재 AI 활용 여부", "role": "조직관리→AI 활용 주 분석의 결과변수; AI→혁신 보조모형에서는 설명변수",
         "period": "2023년 말 기준", "section": "AI001; 통합설문지 물리적501쪽", "eligibility_rule": "all",
         "scale_type": "binary", "usage": "adoption_outcome_candidate_and_innovation_predictor", "measurement": "1예/2아니요;모름선택지없음",
         "categories": yes_no, "note": "AI 성숙도·AX 전환 성공률·신규 도입률이 아님. 금융·보험업은 기업 기준, 그 외 사업장 기준."},
    ]
    for column, label, dimension, note in [("discussion_any", "6개 주제 중 하나 이상 논의 확인", "consultation",
                                            "하나라도 예=논의 확인,6개모두아니요=모든항목아니요,그외모름·결측포함불명.검증된합성척도아님."), *GOVERNANCE]:
        is_response = column in {"ai061", "ai062", "ai063", "ai064"}
        is_composite = column == "discussion_any"
        is_perceived = column in {"ai060", "ai065", "ai066", "ai067"}
        categories = [{"code": 1, "label": "논의 확인", "raw_code": 1}, {"code": 2, "label": "모든 항목 아니요", "raw_code": 2},
                      {"code": 99, "label": "불명", "raw_code": 99}] if is_composite else yes_no_unknown
        question_detail = ai_question_detail(column)
        specifications.append({"id": column, "column": column, "label": label, "category": "ax_operations",
            "concept": {"data": "직원·업무 데이터 수집", "consultation": "근로자 대표와의 협의", "rules": "협의 결과의 규칙·전략 반영",
                        "skills": "기술 요구 변화 인식", "response": "숙련 변화에 대한 인력운영 대응", "perceived_requirements": "필요 역량의 중요성 변화 인식"}[dimension],
            "role": "요구 변화에 대한 인식·질문 분기" if is_perceived else "AI 활용 조직의 관리방식 비교(현재 기술통계)",
            "period": "2023 AI 활용 사업체의 관련 경험·대응; 명시되지 않은 회상기간을 임의로 1년으로 정하지 않음",
            "section": "AI051~056 파생" if is_composite else column.upper() + "; 통합설문지 물리적507~509쪽",
            "eligibility_rule": "ai001=1 and ai060=1" if is_response else "ai001=1", "scale_type": "nominal" if is_composite else "binary",
            "usage": "descriptive_only", "measurement": "논의 확인/모든항목아니요/불명" if is_composite else "1그렇다/2그렇지않다/99잘모르겠다" if column in {"ai057", "ai058", "ai059", "ai061", "ai062", "ai063", "ai064"} else "1예/2아니요/99모름",
            "categories": agree_unknown if column in {"ai057", "ai058", "ai059", "ai061", "ai062", "ai063", "ai064"} else categories, "note": note,
            **({"questionDetail": question_detail} if question_detail else {})})
    for column, label in [("aq3015", "공정·프로세스 혁신 실행"), ("aq3014", "제품·서비스 혁신 출시")]:
        specifications.append({"id": column, "column": column, "label": label, "category": "innovation_outcomes",
            "concept": "혁신 실행" if column == "aq3015" else "혁신 제품·서비스 출시", "role": "AI→혁신 보조분석의 결과변수",
            "period": "기준연도2023 한 해(조사 간격2년과 구분)", "section": column.upper() + "; 통합설문지 물리적58~60쪽",
            "eligibility_rule": "all", "scale_type": "binary", "usage": "secondary_innovation_outcome",
            "measurement": "1예/2아니요;모름선택지없음", "categories": yes_no,
            "note": "AI가 원인이라고 귀인하는 문항이 아니라 별도 혁신 실행 여부. 같은 해 AI와의 선후관계는 미확정."})
    for column, label in [("ai045", "AI의 전체 고용 영향 인식"), ("ai046", "AI의 근로자 생산성 영향 인식"),
                          ("ai047", "AI의 근로자 만족도 영향 인식"), ("ai048", "AI의 건강·안전 영향 인식"),
                          ("ai049", "AI의 성과측정 능력 영향 인식")]:
        labels = ["긍정", "부정", "영향 없음", "모름"] if column == "ai048" else ["증가", "감소", "영향 없음", "모름"]
        specifications.append({"id": column, "column": column, "label": label, "category": "attributed_perceptions",
            "concept": "AI에 원인을 귀인한 영향 평가", "role": "기술통계 전용: 모든 회귀의 설명·종속·매개·조절변수에서 제외",
            "period": "2023 AI 활용 사업체의 영향 인식; 실제 생산량·만족수준의 측정기간이 아님",
            "section": column.upper() + "; 통합설문지 물리적505~507쪽", "eligibility_rule": "ai001=1",
            "scale_type": "nominal", "usage": "descriptive_only_no_regression",
            "measurement": "1긍정/2부정/3영향없음/99모름" if column == "ai048" else "1증가/2감소/3영향없음/99모름",
            "categories": [{"code": code, "label": answer, "raw_code": code} for code, answer in zip([1, 2, 3, 99], labels)],
            "note": "숫자코드는 순서척도가 아니므로 평균을 내지 않음. 객관적 AI 효과나 일반 직무만족으로 재명명하지 않음."})
    output = []
    for specification in specifications:
        item = dict(specification)
        rule = item["eligibility_rule"]
        eligible = frame if rule == "all" else frame.loc[frame.ai001.eq(1)]
        if rule == "ai001=1 and ai060=1":
            eligible = eligible.loc[eligible.ai060.eq(1)]
        item["category_label"] = category_labels[item["category"]]
        item["eligibility"] = {"all": "2023 공공·민간 전체 응답 사업체", "ai001=1": "2023년 말 AI 활용 사업체",
                               "ai001=1 and ai060=1": "AI 활용 사업체 중 AI가 기술 요구를 바꾸었다고 응답한 사업체"}[rule]
        item["source"] = {"file": "WPS통합설문지·코드북 v1.91 / WPS_W10_v10.dta", "section": item.pop("section"),
                          "columns": [f"ai{number:03d}" for number in range(51, 57)] if item["id"] == "discussion_any" else [item["column"]]}
        for group, sector in [("public", 5), ("private", None)]:
            source_mask = frame.sep.eq(5) if sector else frame.sep.isin([1, 2, 3, 4])
            mask = eligible.sep.eq(5) if sector else eligible.sep.isin([1, 2, 3, 4])
            item[group] = categorical_distribution(eligible.loc[mask], item.get("analysis_column", item["column"]), item["categories"], int(source_mask.sum()))
        output.append(item)
    if len(output) != 30 or len({item["id"] for item in output}) != 30:
        raise ValueError("Core WPS catalog must have 30 unique items")
    return output


def prepare(frame: pd.DataFrame, year: int = 2023) -> pd.DataFrame:
    frame = frame.loc[frame.year.eq(year) & frame.sep.isin([1, 2, 3, 4, 5])].copy()
    if frame["id"].duplicated().any():
        raise ValueError(f"Duplicate WPS {year} organization IDs")
    frame["public"] = frame.sep.map({1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 1.0})
    frame["ai"] = binary(frame.ai001)
    frame["ai_public"] = frame.ai * frame.public
    employees = pd.to_numeric(frame.epq1011, errors="coerce").astype(float)
    frame["log_employees"] = np.log(employees.where(np.isfinite(employees) & employees.gt(0)))
    union = frame.mq1001.where(frame.mq1001.isin([1, 2, 3]))
    frame["union_active"] = union.map({1: 1.0, 2: 0.0, 3: 0.0})
    frame["union_dormant"] = union.map({1: 0.0, 2: 0.0, 3: 1.0})
    frame["industry"] = frame.ind.where(frame.ind.isin(INDUSTRIES))
    frame["hr_change"] = 6 - frame.dq1029.where(frame.dq1029.isin([1, 2, 3, 4, 5])).astype(float)
    frame["suggestion"] = binary(frame.dq2016)
    frame["training_plan"] = binary(frame.eq1004)
    frame["weight"] = positive_weights(frame.c_wgt23)
    for outcome in ["aq3015", "aq3014"]:
        frame[outcome + "_binary"] = binary(frame[outcome])
    return frame


def linear_contrast(params: pd.Series, covariance: pd.DataFrame,
                    terms: dict[str, float], contrast_id: str, label: str) -> dict:
    """Full c' V c includes the covariance of AI and its interaction."""
    c = pd.Series(0.0, index=params.index)
    for term, multiplier in terms.items():
        c.loc[term] = multiplier
    beta = float(c @ params)
    variance = float(c @ covariance @ c)
    if not np.isfinite(variance) or variance < -1e-10:
        raise ValueError(f"Invalid contrast variance: {variance}")
    se = float(np.sqrt(max(variance, 0)))
    p = float(2 * norm.sf(abs(beta / se))) if se > 0 else (1.0 if beta == 0 else 0.0)
    z = float(norm.ppf(0.975))
    return {"id": contrast_id, "label": label, "beta": beta, "se": se,
            "ci_low": beta - z * se, "ci_high": beta + z * se, "p": p}


def group_counts(frame: pd.DataFrame, outcome: str) -> dict:
    result = {}
    for group, sector in [("public", 1), ("private", 0)]:
        subset = frame.loc[frame.public.eq(sector)]
        result[group] = {"n": int(len(subset)), "events": int(subset[outcome].sum()),
                         "adopters": int(subset.ai.eq(1).sum()),
                         "by_ai": [{"ai": ai, "n": int(subset.ai.eq(ai).sum()),
                                    "events": int(subset.loc[subset.ai.eq(ai), outcome].sum())} for ai in [0, 1]]}
    return result


def fit_innovation(frame: pd.DataFrame, outcome: str, *, conditional: bool = False,
                   weighted: bool = False, exclude_finance: bool = False) -> dict:
    y_column = outcome + "_binary"
    name = "공정·프로세스 혁신" if outcome == "aq3015" else "제품·서비스 혁신"
    model_id = ("process" if outcome == "aq3015" else "product") + ("_conditional" if conditional else "_baseline")
    model_id += "_wls" if weighted else "_ols"
    if exclude_finance:
        model_id += "_nonfinance"
    numeric = ["ai", "public", "ai_public", "log_employees", "union_active", "union_dormant"]
    if conditional:
        numeric += ["hr_change", "suggestion", "training_plan"]
    required = [y_column, *numeric, "industry"] + (["weight"] if weighted else [])
    pool = frame.loc[~frame.ind.eq("K")] if exclude_finance else frame
    complete = pool.loc[pool[required].notna().all(axis=1)].copy()
    controls = ["종업원 수 자연로그", "산업 대분류 범주(기준: 제조업)", "노조 있음·휴면노조(기준: 없음)"]
    if conditional:
        controls += ["HR 역할 1~5(6−dq1029)", "제안제도(dq2016)", "비법정 훈련계획(eq1004)"]
    result = {
        "id": model_id, "title": f"{name} · {'HR 조건부' if conditional else '기본'}" + (" · 가중 민감도" if weighted else "") + (" · 금융 제외" if exclude_finance else ""),
        "outcome": name, "outcome_column": outcome,
        "priority": "primary" if outcome == "aq3015" and not conditional and not weighted and not exclude_finance else "secondary" if outcome == "aq3014" and not conditional and not weighted and not exclude_finance else "sensitivity",
        "method": "다중 선형확률회귀 WLS · HC3" if weighted else "다중 선형확률회귀 OLS · HC3",
        "unit": "probability", "year": 2023, "n": int(len(complete)), "firms": int(complete.id.nunique()),
        "groups": group_counts(complete, y_column), "controls": controls,
        "formula": f"{outcome}(0/1) ~ AI + 공공 + AI×공공 + ln(종업원) + C(산업) + C(노조)" + (" + HR역할 + 제안제도 + 훈련계획" if conditional else ""),
        "weighted": weighted, "coefficients": [], "contrasts": [], "status": "not_estimable",
        "attrition": {"raw_n": int(len(frame)), "scope_n": int(len(pool)), "final_n": int(len(complete)),
                      "scope_excluded_n": int(len(frame) - len(pool)), "incomplete_n": int(len(pool) - len(complete)),
                      "invalid_by_required_variable": {column: int(pool[column].isna().sum()) for column in required}},
        "warnings": ["동일 기준연도 단면의 조건부 연관이며 인과효과·AX 성숙도 효과가 아님.",
                     f"최종 공공 AI 도입 {int((complete.public.eq(1) & complete.ai.eq(1)).sum())}곳: 부문 차이의 신뢰구간과 공통 업종·규모 범위를 함께 확인.",
                     "공공·민간 각각의 유의성 유무가 아니라 AI×공공 선형대조를 직접 검정.",
                     "보고된 95% 구간·p값은 다중검정 미조정. 주 결과를 공정혁신으로 사전 지정."],
    }
    if conditional:
        result["warnings"].append("당해 HR 관리조건을 추가한 조건부 모형. 시점이 확정된 사전 통제가 아니며 총효과·매개효과로 해석하지 않음.")
    if weighted:
        result["warnings"].append("유한한 양의 c_wgt23만 사용. HC3는 층화·집락을 반영한 복합표본 분산이 아닌 가중 민감도이며 미가중 주 분석과 모집단·표본이 다름.")
    if not exclude_finance:
        result["warnings"].append("AI 문항의 금융·보험업은 기업 기준, 그 외 사업장 기준. 금융 제외 민감도 별도 보고.")
    if len(complete) == 0 or complete[y_column].nunique() < 2:
        result["warnings"].append("종속변수 변이가 없거나 완전 사례가 없어 추정하지 않음.")
        return result
    industry = pd.get_dummies(complete.industry.astype(str), prefix="industry", drop_first=True, dtype=float)
    x = sm.add_constant(pd.concat([complete[numeric].astype(float), industry], axis=1), has_constant="add")
    matrix = x.to_numpy()
    rank = int(np.linalg.matrix_rank(matrix))
    if rank != x.shape[1] or len(complete) <= x.shape[1]:
        result["warnings"].append("설계행렬이 완전 열계수가 아니거나 잔차 자유도가 없어 추정하지 않음.")
        result["diagnostics"] = {"rank": rank, "parameters": int(x.shape[1])}
        return result
    estimator = sm.WLS(complete[y_column], x, weights=complete.weight) if weighted else sm.OLS(complete[y_column], x)
    fit = estimator.fit(cov_type="HC3", use_t=False)
    covariance = fit.cov_params()
    if not np.isfinite(covariance.to_numpy()).all():
        result["warnings"].append("HC3 공분산에 비유한 값이 있어 수치 결과를 게시하지 않음.")
        return result
    minimum_eigenvalue = float(np.linalg.eigvalsh(covariance).min())
    if minimum_eigenvalue < -1e-8:
        raise ValueError("HC3 covariance is not positive semidefinite")
    result["coefficients"] = [linear_contrast(fit.params, covariance, {column: 1.0}, column,
                                LABELS.get(column, "업종: " + INDUSTRIES.get(column.removeprefix("industry_"), column))) for column in x.columns]
    result["contrasts"] = [
        linear_contrast(fit.params, covariance, {"ai": 1}, "ai_private", "민간: AI 활용–혁신 연관"),
        linear_contrast(fit.params, covariance, {"ai": 1, "ai_public": 1}, "ai_public", "공공: AI 활용–혁신 연관"),
        linear_contrast(fit.params, covariance, {"ai_public": 1}, "public_private_difference", "공공−민간: AI 연관 차이"),
    ]
    fitted = np.asarray(fit.fittedvalues)
    weighted_matrix = matrix * np.sqrt(complete.weight.to_numpy())[:, None] if weighted else matrix
    leverage = np.sum(weighted_matrix * np.linalg.pinv(weighted_matrix).T, axis=1)
    result["diagnostics"] = {
        "rank": rank, "parameters": int(x.shape[1]), "residual_df": int(fit.df_resid),
        "condition_number": float(np.linalg.cond(weighted_matrix)), "covariance": "HC3; asymptotic normal CI",
        "covariance_min_eigenvalue": minimum_eigenvalue,
        "covariance_symmetric": bool(np.allclose(covariance, covariance.T)),
        "r_squared": float(fit.rsquared), "max_leverage": float(leverage.max()),
        "predictions_outside_0_1_n": int(((fitted < 0) | (fitted > 1)).sum()),
        "weight_sum": float(complete.weight.sum()) if weighted else None,
        "kish_effective_n": float(complete.weight.sum() ** 2 / complete.weight.pow(2).sum()) if weighted else None,
    }
    if result["diagnostics"]["predictions_outside_0_1_n"]:
        result["warnings"].append(f"선형확률모형의 예측치 {result['diagnostics']['predictions_outside_0_1_n']}개가 0~1 밖임. 개인별 확률 예측이 아닌 평균 연관 계수로 해석.")
    result["status"] = "estimated"
    return result


MANAGEMENT_TERMS = ["hr_change", "suggestion", "training_plan"]


def readiness_cohort(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Link prior measured management to current adoption, not incident adoption."""
    earlier = prepare(raw, 2021)
    current = prepare(raw, 2023)
    future = current[["id", "public", "ai", "weight", "ind", "ai002"]].rename(columns={
        "public": "public_2023", "ai": "adoption2023", "weight": "weight_2023",
        "ind": "industry_2023", "ai002": "intro_year2023"})
    linked = earlier.merge(future, on="id", how="inner", validate="one_to_one")
    stable = linked.loc[linked.public.eq(linked.public_2023)].copy()
    stable["ai"] = stable.adoption2023
    stable["weight"] = stable.weight_2023
    groups = {}
    for name, sector in [("public", 1), ("private", 0)]:
        raw_group = current.loc[current.public.eq(sector)]
        linked_group = linked.loc[linked.public_2023.eq(sector)]
        stable_group = stable.loc[stable.public.eq(sector)]
        groups[name] = {
            "raw2023_n": int(len(raw_group)), "all2021_n": int(earlier.public.eq(sector).sum()),
            "linked2021_n": int(len(linked_group)), "missing2021_n": int(len(raw_group) - len(linked_group)),
            "sector_changed_n": int((~linked_group.public.eq(linked_group.public_2023)).sum()),
            "stable_linked_n": int(len(stable_group)), "adopters2023_n": int(stable_group.ai.eq(1).sum()),
            "first_adoption_no_later_than2021_n": int((stable_group.ai.eq(1) & stable_group.intro_year2023.le(2021)).sum()),
        }
    support = []
    for term in MANAGEMENT_TERMS:
        for name, sector in [("public", 1), ("private", 0)]:
            for value, subset in stable.loc[stable.public.eq(sector)].groupby(term):
                support.append({"variable": term, "group": name, "value": float(value),
                                "n": int(len(subset)), "adopters": int(subset.ai.eq(1).sum())})
    return stable, {"groups": groups, "management_support": support,
                   "predictor_year": 2021, "outcome_year": 2023,
                   "definition": "2021과2023에연결되고부문구분이안정된사업체의2023현재AI활용",
                   "measurement": "DQ1029·DQ2016·EQ1004는각기준연도한해의평가/운영/훈련계획.2021과2023통합설문대응동일.",
                   "limitations": ["2021직접AI현재상태를관측하지않아신규도입·지속도입·중단을식별하지못함.",
                                   "2021관리가2023활용관측보다앞서지만기존도입자의최초AI도입보다앞선것은아님.",
                                   "연결탈락은무작위라고입증되지않음.시차·통제변수만으로인과성이확보되지않음."]}


def fit_readiness(pool: pd.DataFrame, *, model_id: str, title: str, predictor_year: int,
                  primary: bool = False, weighted: bool = False, baseline_innovation: bool = False,
                  source_groups: dict | None = None, scope_note: str = "") -> dict:
    """Approved management x sector LPM; no perceived-impact covariates."""
    frame = pool.copy()
    for term in MANAGEMENT_TERMS:
        frame[term + "_public"] = frame[term] * frame.public
    numeric = [*MANAGEMENT_TERMS, "public", *[term + "_public" for term in MANAGEMENT_TERMS],
               "log_employees", "union_active", "union_dormant"]
    if baseline_innovation:
        numeric += ["aq3015_binary", "aq3014_binary"]
    required = ["ai", *numeric, "industry"] + (["weight"] if weighted else [])
    complete = frame.loc[frame[required].notna().all(axis=1)].copy()
    groups = {name: {"n": int(complete.public.eq(sector).sum()),
                     "events": int((complete.public.eq(sector) & complete.ai.eq(1)).sum()),
                     "adopters": int((complete.public.eq(sector) & complete.ai.eq(1)).sum())}
              for name, sector in [("public", 1), ("private", 0)]}
    industry_levels = sorted(complete.industry.unique().tolist())
    reference_industry = industry_levels[0] if industry_levels else None
    controls = [f"{predictor_year}년 종업원 수 자연로그", f"{predictor_year}년 산업 대분류 더미(기준: {INDUSTRIES.get(reference_industry, '없음')})",
                f"{predictor_year}년 노조 있음·휴면노조(기준: 없음)"]
    if baseline_innovation:
        controls += ["2021년 공정혁신 여부", "2021년 제품·서비스혁신 여부"]
    raw_n = sum(group["n"] for group in source_groups.values()) if source_groups else len(frame)
    result = {
        "id": model_id, "title": title, "outcome": "2023년 말 AI 현재 활용", "outcome_column": "ai001",
        "method": "다중 선형확률회귀 WLS · HC3" if weighted else "다중 선형확률회귀 OLS · HC3",
        "unit": "probability", "year": 2023, "predictor_year": predictor_year,
        "priority": "primary" if primary else "sensitivity", "status": "not_estimable",
        "n": int(len(complete)), "firms": int(complete.id.nunique()), "groups": groups,
        "controls": controls, "weighted": weighted,
        "formula": f"AI활용2023 ~ HR역할{predictor_year} + 제안제도{predictor_year} + 훈련계획{predictor_year} + 공공{predictor_year} + 각관리변수×공공 + ln규모{predictor_year} + C(업종{predictor_year}) + C(노조{predictor_year})" + (" + 공정혁신2021 + 제품혁신2021" if baseline_innovation else ""),
        "coefficients": [], "contrasts": [], "scope_note": scope_note,
        "attrition": {"raw_n": int(raw_n), "scope_n": int(len(frame)), "final_n": int(len(complete)),
                      "scope_excluded_n": int(raw_n - len(frame)), "incomplete_n": int(len(frame) - len(complete)),
                      "invalid_by_required_variable": {column: int(frame[column].isna().sum()) for column in required},
                      "groups": {name: {"raw_n": int(source_groups[name]["n"]) if source_groups else int(frame.public.eq(sector).sum()),
                                        "scope_n": int(frame.public.eq(sector).sum()), "final_n": groups[name]["n"],
                                        "final_events": groups[name]["events"]} for name, sector in [("public", 1), ("private", 0)]}},
        "warnings": ["현재 AI 활용과 일반 관리조건의 조건부 연관. AX 성공·성숙도·신규 도입·인과효과를 추정한 것이 아님.",
                     "세 관리문항은 제한적인 개별 관측이며 검증된 AI 준비도 합성척도가 아님.",
                     "각 변수의 민간·공공 기울기와 직접 차이를 전체 공분산으로 검정; 집단별 유의성만 비교하지 않음.",
                     f"최종 공공 {groups['public']['n']}곳 중 AI 활용 {groups['public']['events']}곳. 작은 사건 수와 비교가능성 제약을 함께 고려."]}
    if predictor_year == 2021:
        result["warnings"].append("2021 관리 측정은 2023 활용 관측보다 앞서지만 모든 사업체의 최초 AI 도입보다 앞서지 않음. 2021 직접 AI 기저상태가 없어 신규 도입·DID로 해석 불가.")
    else:
        result["warnings"].append("2023 동시점 민감도: 역인과·동시결정 가능성. 공공 훈련계획 없음 13곳의 AI 활용이 모두 0이어서 일반 로짓의 준완전분리 위험이 있음.")
    if baseline_innovation:
        result["warnings"].append("2021 혁신도 관리조건 이후의 변수일 수 있어 깨끗한 사전 교란변수라고 확정하지 않음. 기저혁신 추가 모형은 민감도이며 자동으로 더 인과적이지 않음.")
    if weighted:
        result["warnings"].append("2023 횡단면 c_wgt23의 유한 양수만 적용; 연결 패널 가중치가 아님. HC3는 복합표본 설계분산이 아니므로 모집단 인과효과로 해석하지 않음.")
    if scope_note:
        result["warnings"].append(scope_note)
    if primary:
        result["warnings"].append("주 모형의 공공−민간 차이 3개에 Holm 보정 p를 병기. 95% 신뢰구간은 점별·미보정이며 동시구간이 아님.")
    else:
        result["warnings"].append("민감도 모형의 p와 95% 구간은 다중검정 미보정. 유의한 모형만 선택해 결론 내리지 않음.")
    if len(complete) == 0 or complete.ai.nunique() < 2:
        result["warnings"].append("완전 사례 또는 종속변수 변이가 없어 추정하지 않음.")
        return result
    industry = pd.get_dummies(complete.industry.astype(str), prefix="industry", drop_first=True, dtype=float)
    x = sm.add_constant(pd.concat([complete[numeric].astype(float), industry], axis=1), has_constant="add")
    matrix = x.to_numpy()
    rank = int(np.linalg.matrix_rank(matrix))
    if rank != x.shape[1] or len(complete) <= x.shape[1]:
        result["diagnostics"] = {"rank": rank, "parameters": int(x.shape[1])}
        result["warnings"].append("설계행렬이 완전 열계수가 아니거나 잔차 자유도가 없어 추정하지 않음.")
        return result
    estimator = sm.WLS(complete.ai, x, weights=complete.weight) if weighted else sm.OLS(complete.ai, x)
    fit = estimator.fit(cov_type="HC3", use_t=False)
    covariance = fit.cov_params()
    if not np.isfinite(covariance.to_numpy()).all():
        result["warnings"].append("HC3 공분산이 비유한 값이어서 수치 결과를 게시하지 않음.")
        return result
    eigenvalue = float(np.linalg.eigvalsh(covariance).min())
    if eigenvalue < -1e-8:
        raise ValueError("Readiness covariance is not positive semidefinite")
    labels = {**LABELS, "public": "공공(관리변수 0점에서의 절편 차이; HR역할0점은 척도 밖)",
              "aq3015_binary": "2021년 공정혁신", "aq3014_binary": "2021년 제품·서비스혁신"}
    for term in MANAGEMENT_TERMS:
        labels[term] = LABELS[term] + " · 민간 기울기"
        labels[term + "_public"] = LABELS[term] + " · 공공−민간 기울기 차이"
    result["coefficients"] = [linear_contrast(fit.params, covariance, {column: 1}, column,
        labels.get(column, "업종: " + INDUSTRIES.get(column.removeprefix("industry_"), column))) for column in x.columns]
    for term in MANAGEMENT_TERMS:
        for suffix, terms, comparison in [
            ("private", {term: 1}, "민간"),
            ("public", {term: 1, term + "_public": 1}, "공공"),
            ("public_private_difference", {term + "_public": 1}, "공공−민간 차이")]:
            contrast = linear_contrast(fit.params, covariance, terms, term + "_" + suffix, LABELS[term] + " · " + comparison)
            contrast.update({"variable": term, "comparison": suffix, "increment": "1점 증가" if term == "hr_change" else "없음→있음"})
            result["contrasts"].append(contrast)
    differences = [row for row in result["contrasts"] if row["comparison"] == "public_private_difference"]
    if primary:
        adjusted = multipletests([row["p"] for row in differences], method="holm")[1]
        for row, corrected in zip(differences, adjusted):
            row["p_holm"] = float(corrected)
        result["multiplicity"] = {"method": "Holm", "family": [row["id"] for row in differences],
                                  "family_size": 3, "intervals": "pointwise unadjusted 95%"}
    fitted = np.asarray(fit.fittedvalues)
    weighted_matrix = matrix * np.sqrt(complete.weight.to_numpy())[:, None] if weighted else matrix
    leverage = np.sum(weighted_matrix * np.linalg.pinv(weighted_matrix).T, axis=1)
    result["diagnostics"] = {"rank": rank, "parameters": int(x.shape[1]), "residual_df": int(fit.df_resid),
        "condition_number": float(np.linalg.cond(weighted_matrix)), "covariance": "HC3; asymptotic normal CI",
        "covariance_min_eigenvalue": eigenvalue, "covariance_symmetric": bool(np.allclose(covariance, covariance.T)),
        "r_squared": float(fit.rsquared), "max_leverage": float(leverage.max()),
        "predictions_outside_0_1_n": int(((fitted < 0) | (fitted > 1)).sum()),
        "predictions_min": float(fitted.min()), "predictions_max": float(fitted.max()),
        "reference_industry": reference_industry,
        "weight_sum": float(complete.weight.sum()) if weighted else None,
        "kish_effective_n": float(complete.weight.sum() ** 2 / complete.weight.pow(2).sum()) if weighted else None}
    if result["diagnostics"]["predictions_outside_0_1_n"]:
        result["warnings"].append(f"선형확률모형 예측치 {result['diagnostics']['predictions_outside_0_1_n']}개가 0~1 밖. 개인별 확률 예측 도구가 아님.")
    if result["diagnostics"]["max_leverage"] >= 0.5:
        result["warnings"].append(f"최대 레버리지 {result['diagnostics']['max_leverage']:.3f}로 일부 관측치 영향력이 큼. 특히 가중 민감도의 불확실성을 함께 해석.")
    result["status"] = "estimated"
    return result


def logistic_probability_and_gradient(design: pd.DataFrame, params: pd.Series) -> tuple[float, np.ndarray, np.ndarray]:
    """Mean fitted probability and its gradient with respect to logit coefficients."""
    matrix = design.loc[:, params.index].to_numpy(dtype=float)
    eta = matrix @ params.to_numpy(dtype=float)
    probability = 1.0 / (1.0 + np.exp(-eta))
    slope = probability * (1.0 - probability)
    gradient = (slope[:, None] * matrix).mean(axis=0)
    return float(probability.mean()), gradient, probability


def logistic_derivative_and_gradient(design: pd.DataFrame, params: pd.Series,
                                     slope_terms: dict[str, float]) -> tuple[float, np.ndarray, np.ndarray]:
    """Average one-unit logit-index derivative on the probability scale and its gradient."""
    matrix = design.loc[:, params.index].to_numpy(dtype=float)
    coefficient = np.array([slope_terms.get(column, 0.0) for column in params.index], dtype=float)
    eta = matrix @ params.to_numpy(dtype=float)
    probability = 1.0 / (1.0 + np.exp(-eta))
    first = probability * (1.0 - probability)
    second = first * (1.0 - 2.0 * probability)
    slope = float(coefficient @ params.to_numpy(dtype=float))
    estimate = float(slope * first.mean())
    gradient = coefficient * first.mean() + slope * (second[:, None] * matrix).mean(axis=0)
    return estimate, gradient, probability


def delta_method_contrast(estimate: float, gradient: np.ndarray, covariance: pd.DataFrame,
                          contrast_id: str, label: str) -> dict:
    """Normal delta-method uncertainty for a nonlinear standardized contrast."""
    variance = float(gradient @ covariance.to_numpy(dtype=float) @ gradient)
    if not np.isfinite(variance) or variance < -1e-10:
        raise ValueError(f"Invalid delta-method contrast variance: {variance}")
    se = float(np.sqrt(max(variance, 0.0)))
    p = float(2 * norm.sf(abs(estimate / se))) if se > 0 else (1.0 if estimate == 0 else 0.0)
    z = float(norm.ppf(0.975))
    return {"id": contrast_id, "label": label, "beta": float(estimate), "se": se,
            "ci_low": float(estimate - z * se), "ci_high": float(estimate + z * se), "p": p,
            "scale": "standardized_probability_change", "ci_method": "delta_method_normal_95_pointwise"}


def logistic_separation_diagnostics(design: pd.DataFrame, outcome: pd.Series) -> dict:
    """Detect complete/quasi-complete logistic separation with bounded linear programs.

    The L1-normalized coefficient representation prevents the all-zero vector from
    masquerading as a separating direction. A positive maximum minimum-margin is
    complete separation; a nonnegative direction with positive total margin is
    quasi-complete separation.
    """
    matrix = design.to_numpy(dtype=float)
    y = outcome.to_numpy(dtype=float)
    signed = 2.0 * y - 1.0
    expanded = np.column_stack([matrix, -matrix])
    constraints = -signed[:, None] * expanded
    parameter_count = expanded.shape[1]
    l1_constraint = np.ones((1, parameter_count))
    tolerance = 1e-9
    complete = linprog(np.r_[np.zeros(parameter_count), -1.0],
                       A_ub=np.vstack([np.column_stack([constraints, np.ones(len(y))]),
                                       np.hstack([l1_constraint, np.zeros((1, 1))])]),
                       b_ub=np.r_[np.zeros(len(y)), 1.0],
                       bounds=[(0, None)] * (parameter_count + 1), method="highs")
    if not complete.success:
        return {"detected": None, "type": "failed", "complete_margin": None, "quasi_total_margin": None,
                "solver_success": False, "method": "L1-normalized linear-program separation check"}
    complete_margin = float(complete.x[-1]) if complete.success else None
    if complete_margin is not None and complete_margin > tolerance:
        return {"detected": True, "type": "complete", "complete_margin": complete_margin,
                "quasi_total_margin": None, "solver_success": True, "method": "L1-normalized linear-program separation check"}
    quasi = linprog(-np.sum(signed[:, None] * expanded, axis=0),
                    A_ub=np.vstack([constraints, l1_constraint]), b_ub=np.r_[np.zeros(len(y)), 1.0],
                    bounds=[(0, None)] * parameter_count, method="highs")
    if not quasi.success:
        return {"detected": None, "type": "failed", "complete_margin": complete_margin, "quasi_total_margin": None,
                "solver_success": False, "method": "L1-normalized linear-program separation check"}
    total_margin = float(-quasi.fun)
    return {"detected": bool(total_margin is not None and total_margin > tolerance),
            "type": "quasi_complete" if total_margin is not None and total_margin > tolerance else "none",
            "complete_margin": complete_margin, "quasi_total_margin": total_margin,
            "solver_success": True, "method": "L1-normalized linear-program separation check"}


def readiness_logit_design(frame: pd.DataFrame, columns: pd.Index, *, public: int,
                           term: str | None = None, value: float | None = None) -> pd.DataFrame:
    """Counterfactual sector/X design, retaining the supplied pooled covariate rows."""
    counterfactual = frame.copy()
    counterfactual["public"] = float(public)
    if term is not None and value is not None:
        counterfactual[term] = float(value)
    for management_term in MANAGEMENT_TERMS:
        counterfactual[management_term + "_public"] = counterfactual[management_term] * counterfactual.public
    numeric = [*MANAGEMENT_TERMS, "public", *[management_term + "_public" for management_term in MANAGEMENT_TERMS],
               "log_employees", "union_active", "union_dormant"]
    industry_columns = [column for column in columns if column.startswith("industry_")]
    industry = pd.get_dummies(counterfactual.industry.astype(str), prefix="industry", dtype=float).reindex(
        columns=industry_columns, fill_value=0.0)
    design = sm.add_constant(pd.concat([counterfactual[numeric].astype(float), industry], axis=1), has_constant="add")
    return design.reindex(columns=columns, fill_value=0.0)


def fit_readiness_logit_probability_sensitivity(pool: pd.DataFrame, *, source_groups: dict | None = None) -> dict:
    """Secondary logit check: pooled-covariate standardized probability contrasts, not causal effects."""
    model_id = "readiness_lag21_joint_logit_probability_sensitivity"
    frame = pool.copy()
    for term in MANAGEMENT_TERMS:
        frame[term + "_public"] = frame[term] * frame.public
    numeric = [*MANAGEMENT_TERMS, "public", *[term + "_public" for term in MANAGEMENT_TERMS],
               "log_employees", "union_active", "union_dormant"]
    required = ["ai", *numeric, "industry"]
    complete = frame.loc[frame[required].notna().all(axis=1)].copy()
    groups = {name: {"n": int(complete.public.eq(sector).sum()),
                     "events": int((complete.public.eq(sector) & complete.ai.eq(1)).sum()),
                     "adopters": int((complete.public.eq(sector) & complete.ai.eq(1)).sum())}
              for name, sector in [("public", 1), ("private", 0)]}
    raw_n = sum(group["n"] for group in source_groups.values()) if source_groups else len(frame)
    result = {
        "id": model_id,
        "title": "보조 민감도 · 2021→2023 로짓 확률 대비",
        "outcome": "2023년 말 AI 현재 활용", "outcome_column": "ai001", "year": 2023,
        "predictor_year": 2021, "priority": "secondary", "status": "withheld",
        "method": "이항 로짓 GLM · HC0 샌드위치 공분산; 델타방법 95% 점별 구간",
        "unit": "pooled complete-case standardized probability change",
        "n": int(len(complete)), "firms": int(complete.id.nunique()), "groups": groups,
        "controls": ["2021년 종업원 수 자연로그", "2021년 산업 대분류 더미", "2021년 노조 있음·휴면노조"],
        "formula": "logit Pr(AI활용2023=1) ~ HR역할2021 + 제안제도2021 + 훈련계획2021 + 공공2021 + 각관리변수×공공 + ln규모2021 + C(업종2021) + C(노조2021)",
        "same_complete_case_as": "readiness_lag21_joint_ols",
        "attrition": {"raw_n": int(raw_n), "scope_n": int(len(frame)), "final_n": int(len(complete)),
                      "scope_excluded_n": int(raw_n - len(frame)), "incomplete_n": int(len(frame) - len(complete)),
                      "invalid_by_required_variable": {column: int(frame[column].isna().sum()) for column in required}},
        "standardization": {"target": "동일 완전사례 연결 코호트의 공공·민간 합동 공변량 분포 (N=final_n)",
                              "target_n": int(len(complete)), "trimming": "없음",
                              "caveat": "두 부문에 같은 공변량 행을 대입한 모형기반 표준화이다. 업종의 양 부문 존재와 전체 공변량 조합의 공통지지를 보장하지 않아 외삽 가능성이 남는다."},
        "coefficients": [], "contrasts": [], "standardized_probabilities": [],
        "warnings": ["보조 함수형태 민감도이며 주 LPM을 대체하지 않음. 관측된 2021 관리조건과 2023 현재 AI 활용의 조건부 연관일 뿐 인과효과·신규도입 효과가 아님.",
                     "원시 로짓 상호작용계수를 확률 차이로 해석하지 않음. 같은 합동 공변량 분포에서 부문별 확률 대비와 그 차이를 보고.",
                     "HR 역할은 1점당 선형 로그오즈 기울기라는 모형 가정 아래 평균 한계미분으로, 제안·훈련은 0→1 이산 확률변화로 표시.",
                     "공공 사건 수가 작고 공통지지가 완전하게 확인되지 않아 표준화가 비교가능성·미측정 교란을 해결하지 않음."]}
    if len(complete) == 0 or complete.ai.nunique() < 2:
        result["withheld_reason"] = "완전 사례 또는 결과 변이가 없어 이항 로짓을 추정하지 않음."
        return result
    if any(group["events"] == 0 or group["events"] == group["n"] for group in groups.values()):
        result["withheld_reason"] = "한 부문에서 결과가 붕괴되어 부문별 표준화 대비를 추정하지 않음."
        return result
    if any(min(group["events"], group["n"] - group["events"]) < 2 for group in groups.values()):
        result["withheld_reason"] = "한 부문의 사건 또는 비사건이 2개 미만으로 너무 희소하여 부문별 로짓 대비를 추정하지 않음."
        return result
    industry = pd.get_dummies(complete.industry.astype(str), prefix="industry", drop_first=True, dtype=float)
    x = sm.add_constant(pd.concat([complete[numeric].astype(float), industry], axis=1), has_constant="add")
    industry_event_counts = [{"industry": str(industry_code), "n": int(len(subset)), "events": int(subset.ai.sum()),
                              "non_events": int(len(subset) - subset.ai.sum())}
                             for industry_code, subset in complete.groupby("industry", observed=True)]
    matrix = x.to_numpy(dtype=float)
    rank = int(np.linalg.matrix_rank(matrix))
    if rank != x.shape[1] or len(complete) <= x.shape[1]:
        result["withheld_reason"] = "설계행렬이 완전 열계수가 아니거나 잔차 자유도가 없어 로짓 결과를 게시하지 않음."
        result["diagnostics"] = {"rank": rank, "parameters": int(x.shape[1])}
        return result
    separation = logistic_separation_diagnostics(x, complete.ai)
    if separation["detected"] is not False:
        if separation["detected"] is None:
            reason = "L1-정규화 선형계획 분리 검사를 완료하지 못해 로짓 식별을 확인할 수 없으므로 수치 결과를 게시하지 않음."
        else:
            reason = ("업종 더미와 공변량을 포함한 L1-정규화 선형계획 분리 점검에서 "
                      + ("완전분리" if separation["type"] == "complete" else "준완전분리")
                      + "가 확인되어 유한 로짓 MLE와 확률 대비를 게시하지 않음.")
        result["withheld_reason"] = reason
        result["diagnostics"] = {"rank": rank, "parameters": int(x.shape[1]), "separation": separation,
                                 "industry_event_counts": industry_event_counts,
                                 "converged": None, "covariance": None}
        return result
    try:
        fit = sm.GLM(complete.ai, x, family=sm.families.Binomial()).fit(cov_type="HC0", use_t=False, maxiter=100)
    except (np.linalg.LinAlgError, ValueError, sm.tools.sm_exceptions.PerfectSeparationError) as error:
        result["withheld_reason"] = f"로짓 수렴/분리 점검 실패: {type(error).__name__}."
        return result
    covariance = fit.cov_params()
    fitted = np.asarray(fit.fittedvalues, dtype=float)
    finite = np.isfinite(fit.params.to_numpy()).all() and np.isfinite(covariance.to_numpy()).all() and np.isfinite(fitted).all()
    max_abs_parameter = float(np.abs(fit.params.to_numpy()).max()) if finite else None
    # Perfect separation is caught by statsmodels; this stricter numerical screen flags only machine-boundary fits.
    near_boundary = int(((fitted <= 1e-15) | (fitted >= 1 - 1e-15)).sum()) if finite else None
    if not fit.converged or not finite or max_abs_parameter is None or max_abs_parameter > 30 or near_boundary is None or near_boundary:
        result["withheld_reason"] = "로짓 수렴·유한계수·준분리 점검을 통과하지 않아 수치 대비를 게시하지 않음."
        result["diagnostics"] = {"converged": bool(fit.converged), "finite": bool(finite),
                                 "max_abs_parameter": max_abs_parameter, "near_boundary_predictions_n": near_boundary}
        return result
    eigenvalue = float(np.linalg.eigvalsh(covariance).min())
    if eigenvalue < -1e-8:
        result["withheld_reason"] = "HC0 공분산의 양의 준정부호 점검을 통과하지 않아 수치 대비를 게시하지 않음."
        return result
    labels = {**LABELS, "public": "공공 절편(관리변수 0점 기준)"}
    # The raw log-odds coefficients are retained for auditability only; probability-scale contrasts below are the comparison output.
    result["coefficients"] = [linear_contrast(fit.params, covariance, {column: 1.0}, column,
        labels.get(column, "업종: " + INDUSTRIES.get(column.removeprefix("industry_"), column))) | {"scale": "log_odds_audit_only"}
        for column in x.columns]
    all_probability_vectors = []
    for term in MANAGEMENT_TERMS:
        sector_results = {}
        for group, sector in [("private", 0), ("public", 1)]:
            if term == "hr_change":
                design = readiness_logit_design(complete, x.columns, public=sector)
                estimate, gradient, probabilities = logistic_derivative_and_gradient(
                    design, fit.params, {term: 1.0, term + "_public": float(sector)})
                reference_probability, _, _ = logistic_probability_and_gradient(design, fit.params)
                contrast = delta_method_contrast(estimate, gradient, covariance, term + "_" + group,
                    LABELS[term] + " · " + ("민간" if sector == 0 else "공공"))
                contrast.update({"variable": term, "comparison": group, "increment": "1점 증가", "contrast_type": "average_marginal_derivative",
                                 "reference_standardized_probability": reference_probability})
            else:
                zero = readiness_logit_design(complete, x.columns, public=sector, term=term, value=0.0)
                one = readiness_logit_design(complete, x.columns, public=sector, term=term, value=1.0)
                zero_probability, zero_gradient, zero_values = logistic_probability_and_gradient(zero, fit.params)
                one_probability, one_gradient, one_values = logistic_probability_and_gradient(one, fit.params)
                contrast = delta_method_contrast(one_probability - zero_probability, one_gradient - zero_gradient, covariance,
                    term + "_" + group, LABELS[term] + " · " + ("민간" if sector == 0 else "공공"))
                contrast.update({"variable": term, "comparison": group, "increment": "없음→있음", "contrast_type": "discrete_change_0_to_1",
                                 "standardized_probability_at_0": zero_probability, "standardized_probability_at_1": one_probability})
                probabilities = np.concatenate([zero_values, one_values])
            all_probability_vectors.append(probabilities)
            sector_results[group] = contrast
            result["contrasts"].append(contrast)
    # Recompute each sector difference with the full covariance-aware gradients kept alongside the estimates.
    for term in MANAGEMENT_TERMS:
        private = next(row for row in result["contrasts"] if row["id"] == term + "_private")
        public = next(row for row in result["contrasts"] if row["id"] == term + "_public")
        # Gradients are recovered by repeating the deterministic standardization rather than storing respondent-level data in JSON.
        if term == "hr_change":
            private_gradient = logistic_derivative_and_gradient(readiness_logit_design(complete, x.columns, public=0), fit.params, {term: 1.0})[1]
            public_gradient = logistic_derivative_and_gradient(readiness_logit_design(complete, x.columns, public=1), fit.params, {term: 1.0, term + "_public": 1.0})[1]
        else:
            private_gradient = logistic_probability_and_gradient(readiness_logit_design(complete, x.columns, public=0, term=term, value=1.0), fit.params)[1] - logistic_probability_and_gradient(readiness_logit_design(complete, x.columns, public=0, term=term, value=0.0), fit.params)[1]
            public_gradient = logistic_probability_and_gradient(readiness_logit_design(complete, x.columns, public=1, term=term, value=1.0), fit.params)[1] - logistic_probability_and_gradient(readiness_logit_design(complete, x.columns, public=1, term=term, value=0.0), fit.params)[1]
        difference = delta_method_contrast(public["beta"] - private["beta"], public_gradient - private_gradient, covariance,
            term + "_public_private_difference", LABELS[term] + " · 공공−민간 차이")
        difference.update({"variable": term, "comparison": "public_private_difference", "increment": private["increment"],
                           "contrast_type": private["contrast_type"]})
        result["contrasts"] = [row for row in result["contrasts"] if row["id"] != difference["id"]] + [difference]
    differences = [row for row in result["contrasts"] if row["comparison"] == "public_private_difference"]
    adjusted = multipletests([row["p"] for row in differences], method="holm")[1]
    for row, corrected in zip(differences, adjusted):
        row["p_holm"] = float(corrected)
    result["multiplicity"] = {"method": "Holm", "family": [row["id"] for row in differences], "family_size": 3,
                              "intervals": "pointwise unadjusted 95%; p_holm only for the three preselected public−private contrasts"}
    pooled_by_sector = []
    for group, sector in [("private", 0), ("public", 1)]:
        mean_probability, _, probabilities = logistic_probability_and_gradient(readiness_logit_design(complete, x.columns, public=sector), fit.params)
        pooled_by_sector.append({"sector": group, "probability": mean_probability, "target": "pooled_complete_case_covariate_distribution"})
        all_probability_vectors.append(probabilities)
    result["standardized_probabilities"] = pooled_by_sector
    probability_values = np.concatenate(all_probability_vectors)
    result["diagnostics"] = {"rank": rank, "parameters": int(x.shape[1]), "residual_df": int(fit.df_resid),
        "converged": bool(fit.converged), "covariance": "HC0 sandwich from statsmodels GLM; asymptotic normal delta-method CI",
        "separation": separation,
        "industry_event_counts": industry_event_counts,
        "covariance_min_eigenvalue": eigenvalue, "covariance_symmetric": bool(np.allclose(covariance, covariance.T)),
        "max_abs_parameter": max_abs_parameter, "near_boundary_predictions_n": near_boundary,
        "standardized_probability_min": float(probability_values.min()), "standardized_probability_max": float(probability_values.max()),
        "probability_bounds_verified": bool(np.all((probability_values >= 0.0) & (probability_values <= 1.0)))}
    if near_boundary:
        result["warnings"].append("일부 로짓 적합확률이 수치 경계에 있어 준분리 가능성을 완전히 배제할 수 없음. 이 결과는 보조 민감도로만 해석.")
    result["status"] = "estimated"
    return result


def readiness_analysis(raw: pd.DataFrame, current: pd.DataFrame, source_groups: dict) -> tuple[list, dict]:
    lag, audit = readiness_cohort(raw)
    industry_counts = lag.groupby(["industry", "public"], observed=True).size().unstack(fill_value=0)
    common = [industry for industry, row in industry_counts.iterrows() if row.get(0, 0) >= 5 and row.get(1, 0) >= 5]
    audit["common_industry_rule"] = "2021 산업 대분류별 연결표본 공공·민간 각각 5곳 이상(분석 전 고정 기준)"
    audit["industry_support"] = [{"industry": industry, "label": INDUSTRIES[industry], "public_n": int(row.get(1, 0)),
                                  "private_n": int(row.get(0, 0)), "included_common_support": industry in common}
                                 for industry, row in industry_counts.iterrows()]
    shared = {"predictor_year": 2021, "source_groups": source_groups}
    models = [
        fit_readiness(lag, model_id="readiness_lag21_joint_ols", title="주 분석 · 2021 조직관리 → 2023 AI 현재 활용", primary=True, **shared),
        fit_readiness_logit_probability_sensitivity(lag, source_groups=source_groups),
        fit_readiness(lag, model_id="readiness_lag21_joint_baseline_innovation_ols", title="민감도 · 2021 혁신 기저 통제 추가", baseline_innovation=True, **shared),
        fit_readiness(lag, model_id="readiness_lag21_joint_wls", title="민감도 · 2023 횡단면 가중치 적용", weighted=True, **shared),
        fit_readiness(lag.loc[~lag.industry.eq("K") & ~lag.industry_2023.eq("K")], model_id="readiness_lag21_joint_nonfinance_ols",
                      title="민감도 · 2021·2023 금융·보험업 제외", scope_note="2021 또는 2023 금융·보험업이면 제외. 응답 단위 차이에 대한 민감도이며 선택편향 해소를 보장하지 않음.", **shared),
        fit_readiness(lag.loc[lag.industry.isin(common)], model_id="readiness_lag21_joint_common_industry_ols",
                      title="민감도 · 부문별 5곳 이상 공통 업종", scope_note="2021 연결표본에서 업종별 공공·민간 각각 5곳 이상인 업종만 포함. 규모·AI 활용 등 모든 조건의 완전한 공통지지가 보장되는 것은 아님.", **shared),
        fit_readiness(current, model_id="readiness_concurrent23_joint_ols", title="보조 · 2023 동시점 조직관리와 AI 활용",
                      predictor_year=2023, source_groups=source_groups),
    ]
    return models, audit


def build_payload(raw: pd.DataFrame) -> dict:
    frame = prepare(raw)
    groups = {name: {"n": int(frame.public.eq(value).sum()),
                     "adopters": int((frame.public.eq(value) & frame.ai.eq(1)).sum()),
                     "valid_weight_n": int((frame.public.eq(value) & frame.weight.notna()).sum())}
              for name, value in [("public", 1), ("private", 0)]}
    models = [fit_innovation(frame, outcome, conditional=conditional, weighted=weighted)
              for weighted in [False, True] for outcome in ["aq3015", "aq3014"] for conditional in [False, True]]
    models += [fit_innovation(frame, outcome, exclude_finance=True) for outcome in ["aq3015", "aq3014"]]
    readiness_models, readiness_audit = readiness_analysis(raw, frame, groups)
    counts = frame.groupby(["industry", "public"], observed=True).size().unstack(fill_value=0)
    overlap = [{"industry": industry, "label": INDUSTRIES[industry], "public_n": int(row.get(1, 0)),
                "private_n": int(row.get(0, 0)), "both_sectors_observed": bool(row.get(0, 0) > 0 and row.get(1, 0) > 0)}
               for industry, row in counts.iterrows()]
    return {
        "meta": {
            "title": "사업체패널 · AX 조직관리의 공공·민간 비교",
            "subtitle": "2021 조직관리–2023 AI 활용의 부문 차이 · 30개 핵심문항 전체 분포 · 혁신 보조분석",
            "scope": "WPS2023 원표본. sep=5 공공, sep=1~4 민간. 직접 AX 문항은 단면이며 두 패널을 합치지 않음.",
            "generated_at": datetime.now(timezone.utc).isoformat(), "year": 2023, "groups": groups,
            "cautions": ["AX 전체 역량·성숙도가 아니라 AI 활용과 조직관리 개별 대응을 관측.",
                         "2021 관리조건과 2023 AI 현재 활용을 연결했지만 최초 도입 이전 상태·모든 교란을 식별하지 못해 인과효과로 단정하지 않음.",
                         "일반 HR·AI 활용·혁신은 전체 응답자, 직접 AX 관리는 AI 도입자, 재교육·채용 등은 기술 요구 변화 응답자만 대상.",
                         "모름(99)을 아니요로 치환하지 않음. 비율은 모름 포함 유효응답 기준.",
                         "혁신은 2023년 한 해, AI는 2023년 말 활용 여부. 같은 해 선후관계와 인과효과를 식별하지 못함.",
                         "공공 AI 도입자 21곳. 직접 관리방식–혁신 상호작용·매개모형은 희소 표본 때문에 추정하지 않음.",
                         "AI 영향 인식 ai045~049는 이 분석의 모든 회귀와 합성지수에서 제외.",
                         "공공과 민간의 목표·업종 분포가 다르며 동일 척도와 공통지지가 완전히 확보되었다고 주장하지 않음."],
        },
        "governance": governance_items(frame), "key_items": key_items(frame), "models": models, "industry_overlap": overlap,
        "readiness_models": readiness_models, "readiness_audit": readiness_audit,
        "management_regression_status": {
            "status": "not_estimable", "column": "ai057", "reason": "AI 단체협약 예 응답이 공공·민간 모두 0건. 회귀 미실행.",
            "other_items": "전략·가이드라인 공공 예 각각 1건. 관리별 차이는 모름 포함 분포로 보고하며 불안정한 다변량 회귀를 강행하지 않음.",
        },
        "source": {"name": "WPS_W10_v10.dta", "documentation": "WPS통합코드북·설문지 v1.91",
                   "columns_read": READ_COLUMNS, "model_candidate_columns": COLUMNS,
                   "chart_only_columns": PERCEPTION_COLUMNS, "individual_records_published": False,
                   "transformations": ["1/2 이진 문항만 1/0으로 변환; 그 외 결측", "공공 sep=5; 민간 sep=1~4",
                                       "log(epq1011), 유한 양수만", "노조 1있음/2없음/3휴면을 독립 범주로 보존",
                                       "ind 산업 대분류 더미, 제조업 기준", "dq1029 6−응답; eq1004와dq2016 1/2만변환",
                                       "완전사례 회귀; 대체·윈저화·자의적 표본기간 변경 없음"]},
        "references": [
            {"id": "johnk2021", "title": "Jöhnk·Weißert·Wyrtki(2021), Organizational AI readiness", "url": "https://link.springer.com/article/10.1007/s12599-020-00676-7", "note": "전략 정렬·자원·지식·문화·데이터라는 준비 영역의 정성적 근거. WPS의 HR 역할·제안·훈련 3개를 검증된 AI 준비도 척도로 취급하지 않음."},
            {"id": "weiner2009", "title": "Weiner(2009), A theory of organizational readiness for change", "url": "https://link.springer.com/article/10.1186/1748-5908-4-67", "note": "관리조건·변화준비·실행을 구분할 이론 근거. 변화에 대한 공동의 의지·능력 인식은 본 자료에서 직접 측정하지 못해 매개효과를 검정한 것으로 주장하지 않음."},
            {"id": "oecd2023", "title": "Lane·Williams·Broecke(2023), OECD AI 사업주·근로자 조사", "url": "https://www.oecd.org/en/publications/the-impact-of-ai-on-the-workplace-main-findings-from-the-oecd-ai-surveys-of-employers-and-workers_ea0a0fe1-en.html", "note": "훈련·협의를 AX 관리 조건으로 살펴보는 근거. 공공·민간 차이의 방향이나 인과효과를 입증한 근거는 아님."},
            {"id": "kimlee2022", "title": "김동배·이인재(2022), 근로자 제안제도와 기술혁신", "url": "https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002852592", "note": "WPS 민간 표본의 제안제도와 제품·공정혁신. 이번에는 혁신 문항을 유지하고 공공 비교로 확장."},
            {"id": "kli2025", "title": "이경희 외(2025), AI 도입의 결정요인 및 성과 분석", "url": "https://dl.kli.re.kr/library/10110/contents/7738034", "note": "WPS AI 도입과 별도 경제·고용 성과를 연결. 본 분석은 조직관리·혁신에 초점인 단면 연관 분석."},
            {"id": "gelman2006", "title": "Gelman·Stern(2006), 유의성 유무와 집단 차이의 구별", "url": "https://sites.stat.columbia.edu/gelman/surveys.course/GelmanStern2006.pdf", "note": "공공·민간 각각의 p값을 비교하지 않고 상호작용 및 공분산을 반영한 선형대조를 검정."},
        ],
    }


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    raw = pd.read_stata(args.source, columns=READ_COLUMNS, convert_categoricals=False)
    payload = build_payload(raw)
    encoded = json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(encoded + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "groups": payload["meta"]["groups"],
                      "key_items_n": len(payload["key_items"]),
                      "readiness_models": [{"id": m["id"], "n": m["n"], "status": m["status"],
                                           "contrasts": m["contrasts"]} for m in payload["readiness_models"]],
                      "models": [{"id": m["id"], "n": m["n"], "status": m["status"],
                                  "contrasts": m["contrasts"]} for m in payload["models"]]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
