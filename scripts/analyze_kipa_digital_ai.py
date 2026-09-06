"""Publish aggregate-only descriptive KIPA digital-transformation and GenAI results.

The supplied SAV files are read locally.  No respondent rows or open-ended
responses are exported; this program emits only approved, non-weighted broad
institution aggregates.  It intentionally contains no statistical models.
"""
from __future__ import annotations

import copy
import json
import math
import sys
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / ".tmp" / "statdb_20260906_audit"
OUTPUT = ROOT / "app" / "data" / "supplemental-kipa-digital.json"
LOCAL_OUTPUT = AUDIT / "local_aggregate_results.json"
sys.path.insert(0, str(ROOT / ".tmp" / "spss_reader"))


def number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(result) else result


def code(value: Any) -> str:
    value = float(value)
    return str(int(value)) if value.is_integer() else str(value)


def labels(meta: Any, variable: str) -> dict[str, str]:
    return {code(key): str(label) for key, label in meta.variable_value_labels.get(variable, {}).items()}


def source_label(meta: Any, variable: str) -> str:
    label = meta.column_names_to_labels.get(variable)
    if not label:
        raise ValueError(f"Dictionary label missing for {variable}")
    return str(label)


def masks(frame: Any, group_variable: str, groups: list[tuple[str, str, int | None]]) -> list[tuple[str, str, list[bool]]]:
    values = frame[group_variable]
    result = []
    for group_id, group_label, group_code in groups:
        mask = [True] * len(frame) if group_code is None else [number(value) == group_code for value in values]
        result.append((group_id, group_label, mask))
    return result


def suppress_distribution(items: list[dict[str, Any]], valid_n: int) -> tuple[list[dict[str, Any]], bool]:
    """Suppress a whole group only when its valid denominator is under five.

    This retains response counts within otherwise publishable groups so their
    distributions reconcile exactly to the documented denominator.
    """
    if valid_n < 5:
        return ([{**item, "n": None, "share": None} for item in items], True)
    return (items, False)


def single_groups(
    frame: Any,
    group_masks: list[tuple[str, str, list[bool]]],
    variable: str,
    value_labels: dict[str, str],
    eligible: Callable[[int], bool] | None = None,
) -> list[dict[str, Any]]:
    eligibility = eligible or (lambda _: True)
    result = []
    values = frame[variable]
    for group_id, group_label, group_mask in group_masks:
        group_indices = [index for index, include in enumerate(group_mask) if include]
        eligible_indices = [index for index in group_indices if eligibility(index)]
        structural_n = len(group_indices) - len(eligible_indices)
        counts = {key: 0 for key in value_labels}
        missing_n = unknown_n = 0
        for index in eligible_indices:
            observed = number(values.iloc[index])
            if observed is None:
                missing_n += 1
                continue
            response_code = code(observed)
            if response_code not in value_labels:
                missing_n += 1
                continue
            counts[response_code] += 1
            if "모르" in value_labels.get(response_code, ""):
                unknown_n += 1
        valid_n = sum(counts.values())
        responses = [
            {
                "code": response_code,
                "label": value_labels.get(response_code, f"응답 {response_code}"),
                "n": count_value,
                "share": count_value / valid_n if valid_n else None,
            }
            for response_code, count_value in counts.items()
        ]
        responses, suppressed = suppress_distribution(responses, valid_n)
        result.append({
            "id": group_id,
            "label": group_label,
            "eligible_n": len(eligible_indices),
            "valid_n": valid_n,
            "missing_n": missing_n,
            "structural_missing_n": structural_n,
            "unknown_n": unknown_n,
            "suppressed": suppressed,
            "small_sample": valid_n < 30,
            "responses": responses,
        })
    return result


def multiple_response_groups(
    frame: Any,
    group_masks: list[tuple[str, str, list[bool]]],
    variables: list[str],
    value_labels: dict[str, str],
    eligible: Callable[[int], bool] | None = None,
) -> list[dict[str, Any]]:
    """Aggregate rank-slot SAV encoding of a questionnaire multi-response item.

    A person can select more than one labelled category. Shares use respondents
    with at least one valid selection as their denominator and do not sum to
    100 percent.
    """
    eligibility = eligible or (lambda _: True)
    result = []
    for group_id, group_label, group_mask in group_masks:
        group_indices = [index for index, include in enumerate(group_mask) if include]
        eligible_indices = [index for index in group_indices if eligibility(index)]
        counts = {key: 0 for key in value_labels}
        valid_n = missing_n = 0
        for index in eligible_indices:
            selections = {
                selection for variable in variables
                if (observed := number(frame[variable].iloc[index])) is not None
                if (selection := code(observed)) in value_labels
            }
            if selections:
                valid_n += 1
                for selection in selections:
                    counts[selection] = counts.get(selection, 0) + 1
            else:
                missing_n += 1
        eligible_n = len(eligible_indices)
        responses = [
            {
                "code": response_code,
                "label": value_labels.get(response_code, f"응답 {response_code}"),
                "n": count_value,
                "share": count_value / valid_n if valid_n else None,
            }
            for response_code, count_value in counts.items()
        ]
        responses, suppressed = suppress_distribution(responses, valid_n)
        result.append({
            "id": group_id,
            "label": group_label,
            "eligible_n": eligible_n,
            "valid_n": valid_n,
            "missing_n": missing_n,
            "structural_missing_n": len(group_indices) - eligible_n,
            "unknown_n": 0,
            "response_denominator": "valid_n",
            "suppressed": suppressed,
            "small_sample": valid_n < 30,
            "responses": responses,
        })
    return result


def question(
    dataset_id: str,
    year: int,
    unit: str,
    frame: Any,
    meta: Any,
    group_masks: list[tuple[str, str, list[bool]]],
    variable: str,
    dimension: str,
    direction: str,
    note: str,
    eligible: Callable[[int], bool] | None = None,
) -> dict[str, Any]:
    return {
        "id": f"{dataset_id}_{variable.lower()}",
        "label": source_label(meta, variable),
        "dimension": dimension,
        "period": year,
        "universe": unit,
        "scale": "원 문항의 응답범주별 비가중 분포(합성지수·모형 없음).",
        "direction": direction,
        "source_code": variable,
        "source_note": note,
        "groups": single_groups(frame, group_masks, variable, labels(meta, variable), eligible),
    }


def multiple_question(
    dataset_id: str,
    year: int,
    unit: str,
    frame: Any,
    meta: Any,
    group_masks: list[tuple[str, str, list[bool]]],
    variables: list[str],
    dimension: str,
    note: str,
    eligible: Callable[[int], bool] | None = None,
) -> dict[str, Any]:
    return {
        "id": f"{dataset_id}_{variables[0].split('_')[0].lower()}_multiple",
        "label": source_label(meta, variables[0]),
        "dimension": dimension,
        "period": year,
        "universe": unit,
        "scale": "복수응답 문항: 한 응답자가 여러 범주를 선택할 수 있다. 범주별 비율의 분모는 한 개 이상 유효 선택한 응답자(valid_n)이며 합계는 100%가 아니다.",
        "direction": "선택 비율은 해당 지원·활용·장벽을 보고한 비율이며, 효과 또는 인과관계를 뜻하지 않는다.",
        "source_code": "–".join((variables[0], variables[-1])),
        "source_note": note,
        "multiple_response": True,
        "groups": multiple_response_groups(frame, group_masks, variables, labels(meta, variables[0]), eligible),
    }


def sample_groups(group_masks: list[tuple[str, str, list[bool]]]) -> list[dict[str, Any]]:
    return [{"id": group_id, "label": group_label, "n": sum(mask)} for group_id, group_label, mask in group_masks]


def build_2020() -> dict[str, Any]:
    import pyreadstat

    sav = next(AUDIT.glob("*.sav"))
    frame, meta = pyreadstat.read_sav(str(sav), apply_value_formats=False)
    dataset_id, year = "kipa_digital_transformation_2020", 2020
    unit = "중앙행정기관·지방광역자치단체·공공기관 직원 응답자"
    group_masks = masks(frame, "DQ1", [
        ("all_respondents", "전체 응답자", None),
        ("central_government", "중앙행정기관", 1),
        ("metropolitan_local_government", "지방광역자치단체", 2),
        ("public_institution", "공공기관", 3),
    ])
    choices = [
        ("Q3A7", "AI·디지털 준비도", "코드 1–5는 준비·전문성에 관한 단계형 서술이지만 코드 6은 ‘업무에 적용되지 않음’이다. 전체 범주를 선형 척도나 성과로 해석하지 않는다.", "기술별 조직 준비도 문항."),
        ("Q4A7", "AI·디지털 실제 활용", "코드 1은 대부분 업무 활용이고 코드 4는 전혀 사용하지 않음이며 코드 5는 ‘모르겠다’다. 숫자가 큰 범주가 더 넓은 활용을 뜻하지 않는다.", "기술별 현재 업무 활용 범위 문항."),
        ("Q5A1", "리더십", "상위 동의는 기관장의 디지털 전환 이해·비전/목표에 대한 더 높은 응답자 인식을 뜻한다.", "기관장 비전·목표 문항."),
        ("Q5A2", "리더십·지원", "상위 동의는 기관장의 교육·자원 지원에 대한 더 높은 응답자 인식을 뜻한다.", "기관장 교육·자원 지원 문항."),
        ("Q8A1", "자율성", "상위 동의는 현장 위임에 대한 더 높은 응답자 인식을 뜻한다.", "의사결정 위임 문항."),
        ("Q8A3", "협업", "상위 동의는 부서 간 장벽이 없다는 인식을 뜻한다.", "부서 간 장벽 문항."),
        ("Q10A1", "역량·자원", "상위 동의는 기술·경험의 충분성에 대한 더 높은 응답자 인식을 뜻한다.", "기술·경험 충분성 문항."),
        ("Q10A2", "역량·교육", "상위 동의는 기술 습득 자원·기회 제공에 대한 더 높은 응답자 인식을 뜻한다.", "학습 자원·기회 문항."),
        ("Q10A3", "전문인력", "상위 동의는 디지털 전문인력 확보에 대한 더 높은 응답자 인식을 뜻한다.", "전문인력 확보 문항."),
        ("Q10A4", "인재계획", "상위 동의는 디지털 인재 유치 계획·의지에 대한 더 높은 응답자 인식을 뜻한다.", "디지털 인재 계획 문항."),
        ("Q13A2", "조직문화·협업", "상위 동의는 개방·협력 문화에 대한 더 높은 응답자 인식을 뜻한다.", "개방·협력 문화 문항."),
        ("Q13A3", "자율성", "상위 동의는 구성원의 자율성·주인의식에 대한 더 높은 응답자 인식을 뜻한다.", "자율성·주인의식 문항."),
        ("Q13A4", "학습문화", "상위 동의는 경험학습·반영에 대한 더 높은 응답자 인식을 뜻한다.", "경험학습 문항."),
        ("Q13A5", "의사소통", "상위 동의는 내부·외부 의사소통의 효과성에 대한 더 높은 응답자 인식을 뜻한다.", "내부·외부 의사소통 문항."),
        ("Q13A6", "데이터 활용", "상위 동의는 의사결정을 위한 데이터·분석 활용에 대한 더 높은 응답자 인식을 뜻한다.", "데이터·분석 활용 문항."),
        ("Q17A2", "지각된 업무효율", "상위 동의는 디지털 전환의 인력·시간 절감에 대한 지각을 뜻할 뿐, 측정된 생산성 효과가 아니다.", "지각된 인력·시간 절감 문항."),
        ("Q17A3", "지각된 제도개선", "상위 동의는 디지털 전환의 제도적 개선 기여에 대한 지각을 뜻할 뿐, 인과효과가 아니다.", "지각된 제도적 개선 문항."),
        ("Q17A4", "지각된 성과·품질", "상위 동의는 디지털 전환의 성과·품질 향상에 대한 지각을 뜻할 뿐, 측정된 성과가 아니다.", "지각된 성과·품질 문항."),
    ]
    questions = [question(dataset_id, year, unit, frame, meta, group_masks, *choice) for choice in choices]
    return {
        "id": dataset_id,
        "title": "공공부문 디지털 트랜스포메이션 전략에 관한 연구 데이터",
        "source_label": "한국행정연구원, 2020 공공부문 디지털 트랜스포메이션 전략 연구",
        "years": [year], "year": year, "unit": unit, "scope_type": "public_internal",
        "scope": "중앙행정기관·지방광역자치단체·공공기관 직원 대상 조사이며 민간 비교집단이 없다.",
        "status": "descriptive", "publication_status": "approved",
        "sample": {"raw_n": len(frame), "analysis_n": len(frame), "excluded_n": 0, "groups": sample_groups(group_masks)},
        "weight_note": "설계가중치를 적용하지 않은 응답자 분포다.",
        "cautions": [
            "사용자가 사용 허가와 이 집계 공개 진행을 2026-09-06에 확인하여 공개한 결과다.",
            "횡단면 자기보고 분포이며 인과효과·기관 성과·민간과의 차이를 식별하지 않는다.",
            "응답자 행·자유응답·원자료 경로는 공개하지 않으며, 유효응답 n<5인 전체 집단 분포는 n과 비율을 숨긴다.",
        ],
        "questions": questions, "models": [],
        "findings": [],
        "action_questions": [
            "기관 유형별로 교육·전문인력·의사소통 중 어떤 지원 인식이 낮게 나타나는지, 표본구성과 응답분포를 함께 검토할 수 있는가?",
            "지각된 시간절감·성과 문항을 측정된 생산성이나 디지털 전환의 인과효과로 과장하지 않고, 후속 측정지표를 설계할 수 있는가?",
        ],
        "evidence": [{"label": "한국행정연구원 2020 조사자료 메타데이터", "url": "https://sky.kipa.re.kr/library/10220/contents/7139586", "note": "조사 N=305, 2020-07-28~08-28, 할당추출. 제공된 설문지 부록의 문항 3–17 및 응답자 일반사항으로 문항·응답범주를 로컬 확인."}],
    }


def build_2023() -> dict[str, Any]:
    import pyreadstat

    sav = next((AUDIT / "statDB_20260906191344").glob("*.SAV"))
    frame, meta = pyreadstat.read_sav(str(sav), apply_value_formats=False)
    dataset_id, year = "kipa_government_genai_chatbot_2023", 2023
    unit = "중앙부처/청·광역지자체·기초지자체 소속 공무원 응답자"
    group_masks = masks(frame, "SQ4", [
        ("all_respondents", "전체 응답자", None),
        ("central_government", "중앙행정기관", 1),
        ("metropolitan_local_government", "광역지방자치단체", 2),
        ("basic_local_government", "기초지방자치단체", 3),
    ])
    work_user = lambda index: number(frame["Q3"].iloc[index]) == 1
    choices = [
        ("Q3", "AI 실제 업무 활용", "‘예’는 생성형 AI 챗봇을 업무와 관련해 활용한 경험을 뜻하며 활용효과를 뜻하지 않는다.", "전체 공무원에게 제시된 업무 활용 경험 문항.", None),
        ("Q5", "AI 실제 업무 활용 빈도", "상위 범주는 더 잦은 업무 활용을 뜻한다.", "Q3에서 업무 활용 경험이 있다고 답한 사람에게만 제시된 문항.", work_user),
        ("Q7_1", "지각된 업무 유용성", "상위 동의는 업무부담 경감 가능성에 대한 이용자 지각을 뜻하며 실제 효과가 아니다.", "업무 활용 경험자 대상 장점 문항.", work_user),
        ("Q7_2", "지각된 업무 유용성", "상위 동의는 업무 처리속도 향상 가능성에 대한 이용자 지각을 뜻하며 실제 효과가 아니다.", "업무 활용 경험자 대상 장점 문항.", work_user),
        ("Q7_3", "지각된 아이디어 지원", "상위 동의는 새 아이디어 도출 가능성에 대한 이용자 지각을 뜻하며, 실현된 혁신 성과가 아니다.", "업무 활용 경험자 대상 장점 문항.", work_user),
        ("Q7_4", "지각된 업무 유용성", "상위 동의는 업무 품질 향상 가능성에 대한 이용자 지각을 뜻하며 실제 성과가 아니다.", "업무 활용 경험자 대상 장점 문항.", work_user),
        ("Q16_1", "조직의 AI 활용 강조", "상위 동의는 조직이 생성형 AI 챗봇 활용을 강조한다는 응답자 인식을 뜻한다.", "전체 응답자 대상 조직 인식 문항.", None),
        ("Q16_2", "조직 지원", "상위 동의는 조직의 생성형 AI 챗봇 활용 지원에 대한 응답자 인식을 뜻한다.", "전체 응답자 대상 조직 인식 문항.", None),
        ("Q16_3", "조직문화", "상위 동의는 조직 구성원의 긍정적 태도에 대한 응답자 인식을 뜻한다.", "전체 응답자 대상 조직 인식 문항.", None),
        ("Q16_4", "조직문화", "상위 동의는 조직 구성원의 적극적 활용 태도에 대한 응답자 인식을 뜻한다.", "전체 응답자 대상 조직 인식 문항.", None),
        ("Q16_5", "개인 AI 활용 노력", "상위 동의는 응답자 자신의 업무 활용 노력에 대한 자기보고를 뜻한다.", "전체 응답자 대상 개인 행동 문항.", None),
        ("Q16_6", "개인 아이디어 행동", "상위 동의는 AI 활용 중 문제해결 아이디어를 개발한다는 자기보고를 뜻하며, 실현된 혁신 성과가 아니다.", "전체 응답자 대상 개인 행동 문항.", None),
        ("Q16_7", "개인 AI 관심", "상위 동의는 업무 활용 관심에 대한 자기보고를 뜻한다.", "전체 응답자 대상 개인 행동 문항.", None),
        ("Q17_1", "도입 중요성 인식", "상위 동의는 정부부문 도입·활용의 중요성에 대한 인식을 뜻한다.", "전체 응답자 대상 도입 인식 문항.", None),
        ("Q17_2", "도입 시급성 인식", "상위 동의는 정부부문 도입·활용의 시급성에 대한 인식을 뜻한다.", "전체 응답자 대상 도입 인식 문항.", None),
        ("Q20_1", "미래 기대", "상위 동의는 미래 업무 보조수단 활용에 대한 기대를 뜻하며 현재 효과가 아니다.", "전체 응답자 대상 미래 전망 문항.", None),
        ("Q20_2", "미래 기대", "상위 동의는 미래 정책·사업 기획도구 활용에 대한 기대를 뜻하며 현재 효과가 아니다.", "전체 응답자 대상 미래 전망 문항.", None),
    ]
    questions = [question(dataset_id, year, unit, frame, meta, group_masks, variable, dimension, direction, note, eligible) for variable, dimension, direction, note, eligible in choices]
    questions.extend([
        multiple_question(dataset_id, year, unit, frame, meta, group_masks, [f"Q4_{index}" for index in range(1, 10)], "AI 실제 업무 활용 유형", "Q3 업무 활용 경험자에게만 제시된 복수응답 업무유형 문항.", work_user),
        multiple_question(dataset_id, year, unit, frame, meta, group_masks, [f"Q6_{index}" for index in range(1, 7)], "활용 계기", "Q3 업무 활용 경험자에게만 제시된 복수응답 활용 계기 문항.", work_user),
        multiple_question(dataset_id, year, unit, frame, meta, group_masks, [f"Q8_{index}" for index in range(1, 9)], "활용 장벽", "Q3 업무 활용 경험자에게만 제시된 복수응답 어려움·문제점 문항.", work_user),
        multiple_question(dataset_id, year, unit, frame, meta, group_masks, [f"Q19_{index}" for index in range(1, 8)], "필요 지원·자원", "전체 응답자 대상 복수응답 필요 지원·자원 문항.", None),
    ])
    return {
        "id": dataset_id,
        "title": "정부부문 생성형 AI 챗봇 활용실태 및 개선방안 데이터",
        "source_label": "한국행정연구원, 2023 정부부문 생성형 AI 챗봇 활용실태 및 개선방안",
        "years": [year], "year": year, "unit": unit, "scope_type": "public_internal",
        "scope": "20대 이상 직장인 중 중앙부처/청·광역지자체·기초지자체 소속 공무원으로 선별된 응답자 조사이며 민간 비교집단이 없다.",
        "status": "descriptive", "publication_status": "approved",
        "sample": {"raw_n": len(frame), "analysis_n": len(frame), "excluded_n": 0, "groups": sample_groups(group_masks)},
        "weight_note": "설계가중치를 적용하지 않은 응답자 분포다.",
        "cautions": [
            "사용자가 사용 허가와 이 집계 공개 진행을 2026-09-06에 확인하여 공개한 결과다.",
            "Q4–Q9는 업무 활용 경험자에게만 제시되어 비이용자는 structural_missing_n으로 분리했다.",
            "횡단면 자기보고·기대·지각 문항은 인과효과, 실현된 혁신 성과 또는 민간과의 차이를 식별하지 않는다.",
            "응답자 행·자유응답·원자료 경로는 공개하지 않으며, 유효응답 n<5인 전체 집단 분포는 n과 비율을 숨긴다.",
        ],
        "questions": questions, "models": [],
        "findings": [],
        "action_questions": [
            "업무 활용 경험자에서 보고된 장벽·필요지원이 실제 업무환경과 어떻게 연결되는지, 후속 질적 확인과 함께 검토할 수 있는가?",
            "조직의 강조·지원 인식과 개인의 활용 노력은 각각 자기보고라는 점을 유지하면서, 교육·가이드라인·보안 지원의 우선순위를 논의할 수 있는가?",
        ],
        "evidence": [{"label": "한국행정연구원 2023 조사자료 메타데이터", "url": "https://sky.kipa.re.kr/%24/10220/contents/7139614", "note": "조사 N=1,608, 2023-04-21~27, 온라인 자발적응답. 제공된 설문지의 선별문항 SQ1–SQ4, 문항 1–23 및 Q3 분기를 로컬 확인."}],
    }


def add_findings(dataset: dict[str, Any]) -> None:
    """Attach two transparent descriptive highlights selected before testing."""
    lookup = {item["source_code"]: item for item in dataset["questions"]}
    if dataset["year"] == 2020:
        selected = [
            ("Q5A2", "디지털 전환에 필요한 교육·자원 지원", {"3", "4"}),
            ("Q10A3", "디지털 역량 전문인력 확보", {"3", "4"}),
        ]
    else:
        selected = [
            ("Q3", "생성형 AI 챗봇의 업무 활용 경험", {"1"}),
            ("Q16_2", "조직의 생성형 AI 챗봇 활용 지원", {"4", "5"}),
        ]
    findings = []
    for source_code, topic, target_codes in selected:
        group = lookup[source_code]["groups"][0]
        responses = group["responses"]
        # Findings do not imply causality; retain the exact distribution basis.
        if source_code == "Q3":
            target = next(response for response in responses if response["code"] == "1")
            phrase = "‘예’"
            category_text = "‘예’(코드 1)"
        else:
            target_n = sum(response["n"] or 0 for response in responses if response["code"] in target_codes)
            target = {"n": target_n, "share": target_n / group["valid_n"] if group["valid_n"] else None}
            phrase = "동의 범주"
            category_text = "코드 3·4 동의" if dataset["year"] == 2020 else "코드 4·5 동의"
        percent = f"{target['share'] * 100:.1f}%" if target["share"] is not None else "비공개"
        findings.append({
            "type": "descriptive",
            "title": f"{topic}: {phrase}",
            "body": f"전체 유효응답 {group['valid_n']}명 중 {target['n']}명({percent})이 {category_text}로 응답한 기술통계이며 인과효과를 뜻하지 않는다.",
            "topic": topic,
            "group": "전체 응답자",
            "numerator_n": target["n"],
            "denominator_n": group["valid_n"],
            "share": target["share"],
            "statement": f"전체 유효응답 {group['valid_n']}명 중 {phrase} 비율을 제시한 기술통계이며 인과효과를 뜻하지 않는다.",
        })
    dataset["findings"] = findings


def main() -> None:
    datasets = [build_2020(), build_2023()]
    for dataset in datasets:
        add_findings(dataset)
    bundle = {"datasets": datasets}
    LOCAL_OUTPUT.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    OUTPUT.write_text(json.dumps(copy.deepcopy(bundle), ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "datasets": [{"id": item["id"], "n": item["sample"]["raw_n"], "questions": len(item["questions"])} for item in datasets]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
