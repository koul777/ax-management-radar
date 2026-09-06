"""Aggregate-only WPS year × private-workplace-size explorer.

Reuses the established WPS core KeyItem catalog and distribution function.  It
never modifies the existing WPS AX artifact or models and emits no workplace rows.
"""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".tmp" / "wps_data" / "WPS_W10_v10.dta"
OUTPUT = ROOT / "app" / "data" / "wps-explorer.json"
REPORT = ROOT / "WPS_YEAR_SIZE_REVIEW.md"
AUDIT = ROOT / ".tmp" / "wps_explorer_audit"
sys.path.insert(0, str(ROOT / "scripts"))
import analyze_wps_ax as core  # read-only reuse of established KeyItem schema

YEARS = list(range(2005, 2024, 2))
WEIGHTS = {year: f"c_wgt{year % 100:02d}" for year in YEARS}
SIZE_GROUPS = [
    {"id": "all", "label": "민간 전체", "definition": "SEP=1~4인 모든 민간 사업장"},
    {"id": "under300", "label": "300명 미만", "definition": "전년도 전체 근로자수(EPQ1011) 1~299명"},
    {"id": "300_999", "label": "300~999명", "definition": "전년도 전체 근로자수(EPQ1011) 300~999명"},
    {"id": "1000_plus", "label": "1,000명 이상", "definition": "전년도 전체 근로자수(EPQ1011) 1,000명 이상"},
]


def valid_workers(values: pd.Series) -> pd.Series:
    """The codebook defines EPQ1011 as prior-year all-worker count."""
    workers = pd.to_numeric(values, errors="coerce")
    return workers.where(np.isfinite(workers) & workers.gt(0) & workers.eq(np.floor(workers)))


def size_mask(workers: pd.Series, group_id: str) -> pd.Series:
    if group_id == "all":
        return pd.Series(True, index=workers.index)
    if group_id == "under300":
        return workers.between(1, 299)
    if group_id == "300_999":
        return workers.between(300, 999)
    if group_id == "1000_plus":
        return workers.ge(1000)
    raise ValueError(f"Unknown size group {group_id}")


def suppress_distribution(distribution: dict) -> dict:
    """Suppress response cells where a distribution has fewer than five valid cases."""
    result = copy.deepcopy(distribution)
    suppressed = int(result.get("valid_n", 0)) < 5
    result["small_sample"] = suppressed
    result["suppressed"] = suppressed
    if suppressed:
        for response in result.get("responses", []):
            for key in ("n", "share", "weighted_n", "weighted_share"):
                if key in response:
                    response[key] = None
    return result


def source_year_note(year: int) -> dict:
    if year <= 2013:
        return {"year": year, "status": "available_common", "reason": "DQ1029·DQ2016은 통합 코드북에서 해당 웨이브에 수록 확인. 그 외 핵심 항목은 미측정 또는 연도별 동등성 미확인."}
    if year <= 2021:
        return {"year": year, "status": "available_general", "reason": "DQ1029·DQ2016 및 EQ1004·AQ3014·AQ3015 수록 확인. 2023 AI 모듈은 이전 연도에 생성하지 않음."}
    return {"year": year, "status": "available_full_2023", "reason": "기존 WPS 핵심 30개 항목의 2023 정의를 재사용 가능. AI001은 2023년 말 기준 항목."}


def apply_year_weight(frame: pd.DataFrame, year: int) -> tuple[pd.DataFrame, str, bool, str]:
    column = WEIGHTS[year]
    working = frame.copy()
    if column not in working:
        working["c_wgt23"] = np.nan
        return working, column, False, "연도별 횡단면 가중치 열을 확인하지 못해 가중 결과를 제공하지 않음."
    weights = pd.to_numeric(working[column], errors="coerce")
    working["c_wgt23"] = weights
    available = bool((np.isfinite(weights) & weights.gt(0)).any())
    note = f"통합 코드북의 {column}({(year - 2003) // 2}차 횡단면 사업체 가중치)를 적용." if available else f"{column}에 양의 가중치가 없어 가중 결과를 제공하지 않음."
    return working, column, available, note


def ai_count(frame: pd.DataFrame) -> int | None:
    values = pd.to_numeric(frame["ai001"], errors="coerce")
    if not values.isin([1, 2]).any():
        return None
    return int(values.eq(1).sum())


def core_items(public: pd.DataFrame, private: pd.DataFrame) -> tuple[list[dict], list[dict]]:
    """Keep exact existing KeyItem metadata, replacing only group distributions."""
    combined = pd.concat([public, private], ignore_index=True)
    items = core.key_items(combined)
    available, unavailable = [], []
    for item in items:
        item["public"] = suppress_distribution(item["public"])
        item["private"] = suppress_distribution(item["private"])
        if item["public"]["valid_n"] or item["private"]["valid_n"]:
            available.append(item)
        else:
            unavailable.append({"column": item["column"], "label": item["label"], "reason": "해당 연도에 유효 응답 코드가 없거나 2023 전용 모듈이다."})
    return available, unavailable


def unavailable_reason(column: str, year: int) -> str:
    if year < 2015 and column in {"eq1004", "aq3014", "aq3015"}:
        return "미조사: 통합 코드북상 이 항목은 2015년부터 수록된다."
    if year < 2023 and (column.startswith("ai") or column == "discussion_any"):
        return "미조사: 이 AI 모듈은 2023년 기준 항목이며 이전 연도에 0으로 대체하지 않는다."
    return "검증 전: 이 연도에 유효 응답 코드를 확인하지 못했다. 동일 변수명만으로 측정 동등성을 가정하지 않는다."


def historic_metadata(item: dict, year: int) -> dict:
    """Remove 2023-only interpretations from an item reused in an earlier wave."""
    result = copy.deepcopy(item)
    result["period"] = f"WPS 기준연도 {year} 수록 문항의 응답(‘작년’은 설문 기준 시점의 전년을 뜻하며, 선택한 WPS 기준연도에서 기계적으로 1년을 뺀 값으로 재정의하지 않음)"
    result["eligibility"] = f"WPS 기준연도 {year}의 해당 문항 응답 사업장"
    result["role"] = "연도별 기술통계용 문항. 동일 변수명은 문항의 측정 동등성·인과 해석을 보장하지 않는다."
    result["note"] = "통합 코드북에서 해당 기준연도 수록을 확인한 기술통계 항목이다. 연도 간 직접 비교 전에는 문구·코드·우주를 별도로 검증해야 한다."
    result["source"] = {
        "file": "WPS 통합 코드북 v1.91 및 WPS_W10_v10.dta",
        "section": "통합 코드북에서 해당 기준연도 수록 확인(세부 문항 문구·코드의 연도별 동등성은 별도 검증 필요)",
        "columns": result["source"]["columns"],
    }
    return result


def make_slice(frame: pd.DataFrame, year: int, group_id: str) -> dict:
    year_frame = frame.loc[frame.year.eq(year) & frame.sep.isin([1, 2, 3, 4, 5])].copy()
    if year_frame.id.duplicated().any():
        raise ValueError(f"Duplicate organization ID within WPS {year}")
    year_frame, weight_column, weighted_available, weight_note = apply_year_weight(year_frame, year)
    workers = valid_workers(year_frame.epq1011)
    public = year_frame.loc[year_frame.sep.eq(5)].copy()
    private_all = year_frame.loc[year_frame.sep.isin([1, 2, 3, 4])].copy()
    private = private_all.loc[size_mask(valid_workers(private_all.epq1011), group_id)].copy()
    items, unavailable = core_items(public, private)
    if year != 2023:
        items = [historic_metadata(item, year) for item in items]
    for item in unavailable:
        item["reason"] = unavailable_reason(item["column"], year)
    return {
        "year": year, "private_size_id": group_id,
        "private_n": int(len(private)), "public_n": int(len(public)),
        "private_ai_n": ai_count(private), "public_ai_n": ai_count(public),
        "private_size_missing_n": int(valid_workers(private_all.epq1011).isna().sum()),
        "employee_definition": "EPQ1011: [작년] [전체] 전체 근로자수(통합 코드북 EPQ. 근로자 현황).",
        "weight_column": weight_column, "weighted_available": weighted_available, "weight_note": weight_note,
        "key_items": items, "unavailable_items": unavailable,
    }


def build(frame: pd.DataFrame) -> dict:
    slices = [make_slice(frame, year, group["id"]) for year in YEARS for group in SIZE_GROUPS]
    return {
        "source": {
            "label": "사업체패널조사(WPS) 통합 웨이브 2005~2023", "unit": "사업장", "analysis": "연도×민간 사업장 규모의 비가중/검증 가능한 가중 기술통계",
            "document_basis": ["WPS 통합 코드북 v1.91: SEP, EPQ1011, SB, AQ2006, 연도별 c_wgtXX 및 항목 수록 여부", "WPS 통합 설문지 v1.91 물리 347·420쪽: 전체 근로자수 문구 확인", "WPS 통합 이용자 가이드 v1.91 물리 81쪽: 사업장 구분(SEP) 확인"],
        },
        "years": YEARS, "year_notes": [source_year_note(year) for year in YEARS], "size_groups": SIZE_GROUPS,
        "slices": slices,
        "cautions": [
            "규모 구간은 관측된 전년도 전체 근로자수에 따른 탐색용 고정 구간이며 법정 중소·중견·대기업 분류가 아니다.",
            "공공 기준선은 해당 연도 공공 전체이며 민간 규모 구간과 규모를 맞춘 비교가 아니다.",
            "코드북의 SB는 2015~2023년 ‘중소기업/중소기업 아님’ 2분류일 뿐 중견기업·대기업을 분리하지 않는다. AQ2006은 상호출자제한기업집단 소속 여부다. 따라서 이 탐색기는 법정 3분류를 만들지 않는다.",
            "2023년 이전에는 AI001을 0으로 채우지 않는다. AI 미측정/동등성 미확인은 unavailable_items로 분리한다.",
            "valid_n<5이면 공개 JSON에서 응답별 n·비율·가중 결과를 null로 억제한다. 분모 정보만 남긴다.",
        ],
    }


def write_report(payload: dict) -> None:
    example = [slice_ for slice_ in payload["slices"] if slice_["year"] == 2023 and slice_["private_size_id"] != "all"]
    lines = [
        "# WPS 연도·민간 사업장 규모 탐색 검토", "",
        "- EPQ1011은 코드북상 ‘[작년] [전체] 전체 근로자수’이며, 이 값을 사용했다.",
        "- 코드 방향 감사: DQ1029는 1=매우 그렇다~5=전혀 그렇지 않다이며, 기존 핵심 항목의 6-원코드 역방향 표시를 유지했다. DQ2016은 모든 수록 웨이브에서 1=예·2=아니요다. EQ1004, AQ3014, AQ3015는 2015~2023 수록 및 1=예·2=아니요를 코드북 행으로 대조했다.",
        "- 문항·코드 대조 근거는 WPS 통합 코드북 v1.91의 DQ·EQ·AQ 해당 행과 통합 설문지의 추출본으로 보존했다. 이전 연도 공개값은 이 대조된 항목만 포함한다.",
        "- 감사 출처: WPS 통합 코드북 v1.91 ‘0. 기본사항’의 SB(중소기업 구분) 및 ‘AQ. 사업장 특성’의 AQ2006(상호출자제한기업집단 소속 여부). SB는 2015~2023년 ‘중소기업/중소기업 아님’ 직접 2분류이고 중견·대기업을 따로 구분하지 않는다. AQ2006은 상호출자제한기업집단 소속 여부다. 따라서 법정 중소·중견·대기업 3분류는 만들지 않았다.",
        "- 2023 민간 사업장 중 SB=중소기업 1,357개, 중소기업 아님 916개; AQ2006=상호출자제한기업집단 소속 151개, 미소속 2,122개다. 두 변수는 서로 다른 분류 기준이다.",
        "- 사전 승인된 고정 탐색 구간: 300명 미만, 300~999명, 1,000명 이상. 결과에 맞춘 절단점이 아니며 법정 기업규모 분류가 아니다.",
        "- 공공 기준선은 규모 보정되지 않은 공공 전체다.",
        "- 2023 민간 구간별 표본수: " + ", ".join(f"{s['private_size_id']}={s['private_n']}" for s in example) + ".",
        "- valid_n<5 응답분포는 공개 JSON에서 셀 수와 비율을 null로 억제했다.",
        "- 회귀·인과추정·응답자 행은 생성하지 않았다.",
    ]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    AUDIT.mkdir(parents=True, exist_ok=True)
    columns = list(dict.fromkeys([*core.READ_COLUMNS, *WEIGHTS.values()]))
    frame = pd.read_stata(SOURCE, columns=columns, convert_categoricals=False)
    payload = build(frame)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(payload)
    (AUDIT / "summary.json").write_text(json.dumps({"slices": len(payload["slices"]), "years": YEARS}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(args.output), "slices": len(payload["slices"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
