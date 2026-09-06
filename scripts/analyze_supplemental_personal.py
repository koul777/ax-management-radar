"""Create disclosure-safe descriptive summaries of supplied KISDI and KMP SAV files.

This script deliberately produces counts and within-group response shares only.  It
does not export person-level data, fit models, infer employer sector, or treat the
two KMP AI measures as a longitudinal measure.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any, Callable

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / ".tmp" / "supplemental_personal"
KISDI_AUDIT = ROOT / ".tmp" / "kisdi_ax_audit"
KMP_AUDIT = ROOT / ".tmp" / "media_panel_audit"
OUTPUT = ROOT / "app" / "data" / "supplemental-personal.json"
REPORT = ROOT / "SUPPLEMENTAL_PERSONAL_ANALYSIS.md"
SOURCE_ROOT_ENV = "AX_SUPPLEMENTAL_PERSONAL_SOURCE_ROOT"
KISDI_ARCHIVE_RELATIVE = Path("KISDI - 지능정보사회 이용자 패널조사") / "2022년 지능정보사회 이용자 패널조사.zip"
KMP_ANALYTIC_AGE_MAX = 120  # Conservative plausibility cap; codebook only documents 9999 as unknown.

# The labels below are concise translations of the questionnaire/codebook labels.
# They are retained here rather than emitted from SAV metadata so the public JSON
# does not expose respondent text or depend on a terminal's Korean code page.
KISDI_QUESTIONS = [
    (2022, "Q1_1", "인공지능 알고리즘 사용 의도", "use_intention", "all", {1: "전혀 없다", 2: "별로 없다", 3: "약간 있다", 4: "매우 있다", 9: "잘 모르겠다"}, {9}),
    (2022, "Q2_12", "인공지능 프로그램 기반 업무 보조 서비스 사용 의도", "use_intention", "all", {1: "전혀 없다", 2: "별로 없다", 3: "약간 있다", 4: "매우 있다", 9: "잘 모르겠다"}, {9}),
    (2022, "Q5_19", "인공지능 프로그램 기반 업무 보조 서비스 이용 빈도(최근 1년)", "service_use", "all", {1: "거의 매일", 2: "일주일에 한두 번", 3: "1개월에 한두 번", 4: "6개월에 한두 번", 9: "전혀 사용하지 않는다"}, set()),
    (2022, "Q21_5", "정부 또는 공공기관의 개인정보 관리 평가", "privacy_rating", "all", {1: "전혀 관리를 못한다", 2: "관리를 못하는 편이다", 3: "보통이다", 4: "관리를 잘하는 편이다", 5: "매우 관리를 잘한다"}, set()),
    (2023, "q1_9", "지능형 서비스의 업무 영역 이용 빈도", "service_use", "all", {1: "거의 매일", 2: "일주일에 한두 번", 3: "1개월에 한두 번", 4: "6개월에 한두 번", 5: "최근 1년간 이용한 적 없음", 9: "전혀 이용한 적 없음"}, set()),
    (2023, "q23", "생성형 AI 이용 경험", "ai_experience", "all", {1: "이용한 경험이 있다", 2: "이용한 경험이 없다"}, set()),
    (2023, "q29_2", "생성형 AI가 일상적 업무를 지원하는 데 도움이 된다는 인식(이용자만)", "user_perception", "genai_user", {1: "전혀 그렇지 않다", 2: "그렇지 않다", 3: "보통이다", 4: "그렇다", 5: "매우 그렇다"}, set()),
    (2023, "q20_5", "정부 또는 공공기관의 개인정보 관리 평가", "privacy_rating", "all", {1: "전혀 관리를 못한다", 2: "관리를 못하는 편이다", 3: "보통이다", 4: "관리를 잘하는 편이다", 5: "매우 관리를 잘한다"}, set()),
    (2024, "Q1_9", "지능형 서비스의 업무 영역 이용 빈도", "service_use", "all", {1: "거의 매일", 2: "일주일에 한두 번", 3: "1개월에 한두 번", 4: "6개월에 한두 번", 5: "최근 1년간 이용한 적 없음", 9: "전혀 이용한 적 없음"}, set()),
    (2024, "Q24", "생성형 AI 이용 경험", "ai_experience", "all", {1: "이용한 경험이 있다", 2: "이용한 경험이 없다"}, set()),
    (2024, "Q28_4", "생성형 AI가 아이디어 발전에 도움이 된다는 인식(이용자만)", "user_perception", "genai_user", {1: "전혀 그렇지 않다", 2: "그렇지 않다", 3: "보통이다", 4: "그렇다", 5: "매우 그렇다"}, set()),
    (2024, "q20_5", "정부 또는 공공기관의 개인정보 관리 평가", "privacy_rating", "all", {1: "전혀 관리를 못한다", 2: "관리를 못하는 편이다", 3: "보통이다", 4: "관리를 잘하는 편이다", 5: "매우 관리를 잘한다", 9: "잘 모르겠다"}, {9}),
]

KMP_QUESTIONS = [
    (2023, "p23k06001", "챗GPT 등 인공지능 챗봇 인지 정도", "awareness", "all", {1: "전혀 모른다", 2: "잘 알지는 못하지만, 들어본 적은 있다", 3: "아는 편이다", 4: "잘 알고 있다"}, set()),
    (2023, "p23k06002", "최근 3개월 인공지능 챗봇(챗GPT 등) 이용 여부", "ai_use", "all", {1: "있다", 2: "없다"}, set()),
    (2023, "p23k06003", "최근 3개월 인공지능 챗봇 이용의 주된 목적(이용자만)", "purpose", "ai_user", {1: "업무를 위해", 2: "과제 등 학업을 위해", 3: "일상적인 정보검색을 위해", 4: "기타"}, set()),
    (2023, "p23k06005", "인공지능 챗봇 유료 서비스 이용 경험(이용자만)", "paid_use", "ai_user", {1: "있다", 2: "없다"}, set()),
    (2024, "p24d31001", "생성형 인공지능 서비스 인지 정도", "awareness", "all", {1: "전혀 모른다", 2: "잘 알지는 못하지만, 들어본 적은 있다", 3: "아는 편이다", 4: "잘 알고 있다"}, set()),
    (2024, "p24d31002", "최근 3개월 생성형 인공지능 서비스 이용 여부", "ai_use", "all", {1: "있다", 2: "없다"}, set()),
    (2024, "p24d31003", "최근 3개월 가장 많이 이용한 생성형 인공지능 서비스(이용자만)", "service", "ai_user", {1: "챗지피티(ChatGPT)", 2: "코파일럿(Copilot)", 3: "제미나이(Gemini)", 4: "에이닷(A.)", 5: "클로바엑스(ClovaX)", 6: "달리(DALL-E)", 7: "미드저니(Midjourney)", 8: "노벨 에이아이(NovelAI)", 9: "기타"}, set()),
    (2024, "p24d31005", "최근 3개월 생성형 인공지능 서비스 이용의 주된 목적(이용자만)", "purpose", "ai_user", {1: "업무를 위해", 2: "과제 등 학업을 위해", 3: "취미 활동을 위해", 4: "일상적인 정보검색을 위해", 5: "일상적 대화를 나누기 위해", 6: "기타"}, set()),
    (2024, "p24d31007", "최근 3개월 생성형 인공지능 유료 서비스 이용 여부(이용자만)", "paid_use", "ai_user", {1: "예", 2: "아니오"}, set()),
    (2024, "p24m01022", "내가 속한 조직·집단은 새로운 디지털 미디어 제품·서비스 사용을 지원한다", "group_support_perception", "all", {1: "전혀 그렇지 않다", 2: "그렇지 않다", 3: "보통이다", 4: "그렇다", 5: "매우 그렇다"}, set()),
]


def _read_sav(path: Path) -> pd.DataFrame:
    reader_path = ROOT / ".tmp" / "spss_reader"
    if str(reader_path) not in sys.path:
        sys.path.insert(0, str(reader_path))
    import pyreadstat  # installed privately for supplied SPSS files

    frame, _ = pyreadstat.read_sav(str(path), apply_value_formats=False)
    return frame


def _number(value: Any) -> str:
    return str(int(value)) if float(value).is_integer() else str(value)


def _response_rows(values: pd.Series, labels: dict[int, str], unknown_codes: set[int]) -> tuple[list[dict[str, Any]], int, int, int]:
    """Return disclosure-safe response counts, with invalid codes visible as unknown."""
    numeric = pd.to_numeric(values, errors="coerce")
    present = numeric.notna()
    known = numeric.isin(labels)
    invalid = present & ~known
    unknown = numeric.isin(unknown_codes) | invalid
    valid = present
    rows = [
        {"code": _number(code), "label": label, "n": int((numeric == code).sum()), "share": None}
        for code, label in labels.items()
    ]
    unknown_n = int(unknown.sum())
    if int(invalid.sum()):
        rows.append({"code": "unlabelled", "label": "값 라벨 미확인", "n": int(invalid.sum()), "share": None})
    valid_n = int(valid.sum())
    for row in rows:
        row["share"] = row["n"] / valid_n if valid_n else None
    return rows, valid_n, int((~present).sum()), unknown_n


def make_question(
    frame: pd.DataFrame,
    *, question_id: str, label: str, dimension: str, period: int,
    universe_label: str, eligible: pd.Series, groups: list[tuple[str, str, pd.Series]], base_universe: pd.Series,
    code: str, labels: dict[int, str], unknown_codes: set[int], source_note: str,
) -> dict[str, Any]:
    output_groups = []
    for group_id, group_label, group_mask in groups:
        selected = frame.loc[eligible & group_mask, code]
        responses, valid_n, missing_n, unknown_n = _response_rows(selected, labels, unknown_codes)
        # Routing/ineligibility is distinct from a blank answer in an eligible
        # respondent.  In particular, KMP purpose/service/payment nonusers are
        # structural missing and must never be represented as a zero response.
        structural_missing_n = int(group_mask.sum() - (eligible & group_mask).sum())
        output_groups.append({
            "id": group_id, "label": group_label, "eligible_n": int((eligible & group_mask).sum()),
            "valid_n": valid_n, "missing_n": missing_n, "structural_missing_n": structural_missing_n,
            "unknown_n": unknown_n, "responses": responses,
        })
    return {
        "id": question_id, "label": label, "dimension": dimension, "period": period,
        "universe": universe_label, "scale": "범주형 분포(비율 분모는 구조적 결측을 제외한 유효 응답)", 
        "source_code": code, "source_note": source_note, "universe_base_n": int(base_universe.sum()),
        "outside_universe_n": int((base_universe & ~eligible).sum()), "groups": output_groups,
    }


def _all_group(frame: pd.DataFrame) -> list[tuple[str, str, pd.Series]]:
    return [("all", "전체 분석대상 응답자", pd.Series(True, index=frame.index))]


def kisdi_groups(frame: pd.DataFrame) -> list[tuple[str, str, pd.Series]]:
    groups = _all_group(frame)
    age_labels = {1: "10대", 2: "20대", 3: "30대", 4: "40대", 5: "50대", 6: "60대", 7: "70대"}
    age = pd.to_numeric(frame["Age_group"], errors="coerce")
    groups += [(f"age_{code}", label, age == code) for code, label in age_labels.items()]
    groups.append(("age_unknown", "연령대 미상 또는 라벨 미확인", ~age.isin(age_labels)))
    work = pd.to_numeric(frame["DQ1"], errors="coerce")
    groups += [
        ("employment_occupation_1_10", "직업분류 1~10 응답자(임금근로자 여부 미확인)", work.isin(range(1, 11))),
        ("employment_self_employed", "자영업자(직업분류 21)", work == 21),
        ("employment_not_employed", "학생·주부·취업준비·무직·기타", work.isin([11, 12, 13, 14, 15])),
        ("employment_unknown", "취업상태 미상 또는 라벨 미확인", ~work.isin(list(range(1, 11)) + [11, 12, 13, 14, 15, 21])),
    ]
    return groups


def kmp_groups(frame: pd.DataFrame, year: int) -> list[tuple[str, str, pd.Series]]:
    groups = _all_group(frame)
    prefix = f"p{year % 100:02d}"
    age = pd.to_numeric(frame[f"{prefix}age"], errors="coerce")
    age1 = pd.to_numeric(frame[f"{prefix}age1"], errors="coerce")
    age_labels = {2: "10~19세", 3: "20~29세", 4: "30~39세", 5: "40~49세", 6: "50~59세", 7: "60~69세", 8: "70세 이상"}
    groups += [("age_0_6", "0~6세(이번 분석의 연령 제한으로 제외)", age1 < 7), ("age_7_9", "7~9세", age1.between(7, 9))]
    groups += [(f"age_{code}", label, age == code) for code, label in age_labels.items()]
    groups.append(("age_unknown", "연령 미상 또는 라벨 미확인", ~(age1.between(0, 9) | age.isin(age_labels))))
    job1 = pd.to_numeric(frame[f"{prefix}job1"], errors="coerce")
    job2 = pd.to_numeric(frame[f"{prefix}job2"], errors="coerce")
    groups += [
        ("employment_wage", "취업자: 임금근로자", (job1 == 1) & (job2 == 1)),
        ("employment_self_employed", "취업자: 고용주·자영업자", (job1 == 1) & job2.isin([2, 3])),
        ("employment_unpaid_family", "취업자: 무급가족종사자", (job1 == 1) & (job2 == 4)),
        ("employment_not_employed", "미취업", job1 == 2),
        ("employment_unknown", "취업상태 미상 또는 라벨 미확인", ~((job1 == 2) | ((job1 == 1) & job2.isin([1, 2, 3, 4])))),
    ]
    return groups


def validate_unique_ids(frame: pd.DataFrame, column: str, source: str) -> None:
    if frame[column].isna().any() or frame[column].duplicated().any():
        raise ValueError(f"{source}: {column} must be non-missing and unique before a transition is reported")


def kisdi_transition(before: pd.DataFrame, after: pd.DataFrame) -> dict[str, Any]:
    validate_unique_ids(before, "ID", "KISDI 2023")
    validate_unique_ids(after.rename(columns={"id": "ID"}), "ID", "KISDI 2024")
    after = after.rename(columns={"id": "ID"})
    linked = before[["ID", "q23"]].merge(after[["ID", "Q24"]], on="ID", how="inner", validate="one_to_one")
    linked = linked[linked.q23.isin([1, 2]) & linked.Q24.isin([1, 2])]
    labels = {1: "이용 경험 있음", 2: "이용 경험 없음"}
    rows = []
    for old in (1, 2):
        for new in (1, 2):
            rows.append({"from": labels[old], "to": labels[new], "n": int(((linked.q23 == old) & (linked.Q24 == new)).sum())})
    return {
        "label": "KISDI 생성형 AI 이용 경험 응답 전이", "period": "2023년→2024년", "unit": "동일인 연결 응답자", "n": int(len(linked)), "rows": rows,
        "note": "이용 경험 응답의 기술적 전이일 뿐이다. 최초 채택 시점, 조직 도입, 인과효과를 뜻하지 않는다.",
    }


def _scan_sav_blobs(archive: Path) -> list[tuple[str, bytes]]:
    """Find SAV files in a supplied ZIP, including nested ZIP members, without extracting rows."""
    result: list[tuple[str, bytes]] = []
    def visit(name: str, blob: bytes) -> None:
        if name.lower().endswith(".sav"):
            result.append((name, blob))
        elif name.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(blob)) as nested:
                for member in nested.infolist():
                    if not member.is_dir():
                        visit(f"{name}!{member.filename}", nested.read(member))
    with zipfile.ZipFile(archive) as outer:
        for member in outer.infolist():
            if not member.is_dir():
                visit(member.filename, outer.read(member))
    return result


def verify_kisdi_source(archive: Path) -> dict[str, Any]:
    known = json.loads((KISDI_AUDIT / "archives.json").read_text(encoding="utf-8"))
    expected = {entry["sha256"]: {"year": entry["year"], "variant": entry["variant"], "bytes": entry["bytes"]} for entry in known}
    found: list[dict[str, Any]] = []
    if archive.exists():
        for name, blob in _scan_sav_blobs(archive):
            digest = hashlib.sha256(blob).hexdigest()
            if digest in expected:
                item = dict(expected[digest])
                item.update({"sha256": digest, "byte_match": len(blob) == item["bytes"], "hash_match": True})
                found.append(item)
    expected_pairs = {(item["year"], item["variant"]) for item in expected.values()}
    found_pairs = {(item["year"], item["variant"]) for item in found}
    return {
        "source_archive_present": archive.exists(), "matched_selected_sav": sorted(found, key=lambda x: (x["year"], x["variant"])),
        "expected_pairs": sorted([{"year": y, "variant": v} for y, v in expected_pairs], key=lambda x: (x["year"], x["variant"])),
        "all_expected_sav_matched": expected_pairs == found_pairs,
        "note": "Hash/byte comparison uses only SAV file bytes. The analysis reads one audited wgt_a SAV per year; wgt_a and wgt_b are not combined.",
    }


def kisdi_archive(source_root: Path) -> Path:
    """Resolve the private KISDI archive from an explicit portable source root."""
    return source_root / KISDI_ARCHIVE_RELATIVE


def build_kisdi() -> dict[str, Any]:
    frames = {year: _read_sav(KISDI_AUDIT / f"kisdi_{year}_wgt_a.sav") for year in (2022, 2023, 2024)}
    questions = []
    for year, code, label, dimension, universe, labels, unknown_codes in KISDI_QUESTIONS:
        frame = frames[year]
        ai_code = "q23" if year == 2023 else "Q24"
        eligible = pd.Series(True, index=frame.index) if universe == "all" else pd.to_numeric(frame[ai_code], errors="coerce").eq(1)
        universe_label = "전체 응답자" if universe == "all" else "생성형 AI 이용 경험을 보고한 응답자"
        item_note = "사용 경험·기술 수준이 아닌 향후 사용 의도 문항" if dimension == "use_intention" else ""
        questions.append(make_question(frame, question_id=f"kisdi_{year}_{code.lower()}", label=label, dimension=dimension, period=year, universe_label=universe_label, eligible=eligible, base_universe=pd.Series(True, index=frame.index), groups=kisdi_groups(frame), code=code, labels=labels, unknown_codes=unknown_codes, source_note=f"KISDI {year} 설문지·코드북 문항 {code}; {item_note}; 비가중 응답자 수."))
    raw_n = sum(len(frame) for frame in frames.values())
    experience_2023 = int(pd.to_numeric(frames[2023]["q23"], errors="coerce").eq(1).sum())
    experience_2024 = int(pd.to_numeric(frames[2024]["Q24"], errors="coerce").eq(1).sum())
    transition = kisdi_transition(frames[2023], frames[2024])
    return {
        "id": "kisdi_intelligent_user_panel", "title": "KISDI 지능정보사회 이용자 패널조사", "source_label": "KISDI 제공 2022~2024 이용자 패널 SAV", "years": [2022, 2023, 2024], "unit": "개인 응답자", "scope_type": "individual_ai", "status": "descriptive",
        "scope": "개인의 디지털 서비스·생성형 AI 이용 경험 및 인식 문항이다. 연령·취업 범주는 응답자 특성이며 공공/민간 고용주 부문이 아니다.",
        "sample": {"raw_n": raw_n, "analysis_n": raw_n, "excluded_n": 0, "groups": [{"id": f"wave_{year}", "label": f"{year} 제공 응답자 웨이브", "n": len(frame)} for year, frame in frames.items()]},
        "samples_by_year": {str(year): {"raw_n": len(frame), "analysis_n": len(frame), "excluded_n": 0, "groups": [{"id": f"wave_{year}", "label": f"{year}년 응답자", "n": len(frame)}]} for year, frame in frames.items()},
        "year_coverage_note": "2022·2023·2024년의 검증된 문항을 선택할 수 있습니다. 2022년 사용 의도와 이후 생성형 AI 이용 경험은 서로 다른 문항입니다.",
        "weight_note": "비가중 집단별 분포. 연도별 wgt_a SAV 한 파일만 사용하며 a/b 제공 변형을 합치지 않는다. raw_n은 개인 고유 수가 아닌 개인-웨이브 수다.",
        "cautions": ["2022년에는 직접적인 생성형 AI 이용경험 문항이 없으므로 생성형 AI=0 웨이브가 아닌 별도 디지털서비스 기준선이다.", "이용자 인식 문항은 기술·생산성 성과나 인과변수가 아닌 기술 인식의 기술통계다.", "고용주의 공공/민간 부문 필드는 확인되지 않았다. 직업·취업 범주를 고용주 부문으로 해석해서는 안 된다."],
        "questions": questions, "action_questions": ["분모를 함께 제시할 때 연령·개인 취업 범주별 AI 서비스 이용은 어떻게 다른가?", "생성형 AI 이용자만 놓고 어떤 이용 이유·인식이 많이 보고되는가?"],
        "evidence": [{"label": "KISDI 제공 설문지 및 이용자 가이드북(2022~2024)", "url": "https://stat.kisdi.re.kr/", "note": "문항명과 응답 우주는 제공된 설문지·가이드북 추출본으로 확인했다. 원자료 경로는 공개하지 않는다."}],
        "models": [], "transitions": [transition],
        "findings": [
            {"title": "웨이브별 생성형 AI 이용 경험", "body": f"2023년에는 {len(frames[2023]):,}명 중 {experience_2023:,}명(비가중 {experience_2023 / len(frames[2023]):.1%}), 2024년에는 {len(frames[2024]):,}명 중 {experience_2024:,}명(비가중 {experience_2024 / len(frames[2024]):.1%})이 생성형 AI 이용 경험을 보고했다. 이는 조직 도입 추정치가 아닌 별도 웨이브의 개인 응답 분포다."},
            {"title": "검증된 연결", "body": f"2023~2024 동일인 ID 연결에는 이용 경험 문항이 모두 유효한 {transition['n']:,}쌍이 있다. 최초 채택이나 인과적 변화를 식별하지 않는 기술적 응답 전이로만 제시한다."},
        ],
    }


def build_kmp() -> dict[str, Any]:
    frames = {year: _read_sav(KMP_AUDIT / f"personal_{year}.sav") for year in (2023, 2024)}
    questions = []
    for year, code, label, dimension, universe, labels, unknown_codes in KMP_QUESTIONS:
        frame = frames[year]
        prefix = f"p{year % 100:02d}"
        survey = pd.to_numeric(frame[f"{prefix}ans"], errors="coerce").eq(1)
        age1 = pd.to_numeric(frame[f"{prefix}age1"], errors="coerce")
        age_eligible = age1.between(7, KMP_ANALYTIC_AGE_MAX)
        base = survey & age_eligible
        ai_code = f"{prefix}k06002" if year == 2023 else f"{prefix}d31002"
        eligible = base if universe == "all" else base & pd.to_numeric(frame[ai_code], errors="coerce").eq(1)
        universe_label = f"{year} 개인용 설문 완료자 중 만 7세 이상(이번 분석의 연령 제한; p{year % 100:02d}ans=1, age1≥7)" if universe == "all" else f"이번 분석의 만 7세 이상 제한을 적용한 최근 3개월 AI 이용자"
        if code == "p24m01022":
            definition = "새로운 디지털 미디어 제품·서비스 사용에 대한 개인의 조직·집단 지원 인식(생성형 AI 정의와 무관)"
        else:
            definition = "챗GPT 등을 포함한 인공지능 챗봇" if year == 2023 else "텍스트·오디오·이미지 생성형 AI(대화형 AI·AI 검색엔진 포함)"
        if dimension == "awareness":
            skip = "인지 문항 뒤 이용 여부 문항도 전체 응답(인지 여부로 건너뛰지 않음)"
        elif dimension == "ai_use":
            skip = "전체 응답; 비이용자(②)는 다음 문항으로 이동"
        elif universe == "all":
            skip = "전체 응답 문항"
        else:
            skip = "이용 여부=① 응답자만 후속 문항; 비이용자는 구조적 결측"
        payment_note = " 2024 설문지 인쇄본은 ‘⑥ 아니오’로 보이나 SAV 코드북은 2=아니오이므로 코드는 2를 유지하며 재부호화하지 않았다." if code == "p24d31007" else ""
        questions.append(make_question(frame, question_id=f"kmp_{year}_{code.lower()}", label=label, dimension=dimension, period=year, universe_label=universe_label, eligible=eligible, base_universe=survey, groups=kmp_groups(frame, year), code=code, labels=labels, unknown_codes=unknown_codes, source_note=f"KMP {year} 설문지 문항 {code}; {definition}; p{year % 100:02d}ans=1 및 이번 분석의 만 7세 이상 제한 적용; age1=9999(모름/무응답)는 연령 미상으로 제외하고 분석상 120세 상한을 적용(코드북의 별도 유효연령 상한은 미확인); {skip}; structural_missing_n은 설문 건너뜀과 이번 분석의 연령 제외를 합산한 값; 비가중 응답자 수.{payment_note}"))
    raw_n = sum(len(frame) for frame in frames.values())
    age23 = pd.to_numeric(frames[2023]["p23age1"], errors="coerce")
    age24 = pd.to_numeric(frames[2024]["p24age1"], errors="coerce")
    valid23 = pd.to_numeric(frames[2023]["p23ans"], errors="coerce").eq(1) & age23.between(7, KMP_ANALYTIC_AGE_MAX)
    valid24 = pd.to_numeric(frames[2024]["p24ans"], errors="coerce").eq(1) & age24.between(7, KMP_ANALYTIC_AGE_MAX)
    chatbot_users = int((valid23 & pd.to_numeric(frames[2023]["p23k06002"], errors="coerce").eq(1)).sum())
    chatbot_base = int(valid23.sum())
    genai_users = int((valid24 & pd.to_numeric(frames[2024]["p24d31002"], errors="coerce").eq(1)).sum())
    genai_base = int(valid24.sum())
    unknown_age23 = int((pd.to_numeric(frames[2023]["p23ans"], errors="coerce").eq(1) & age23.eq(9999)).sum())
    unknown_age24 = int((pd.to_numeric(frames[2024]["p24ans"], errors="coerce").eq(1) & age24.eq(9999)).sum())
    PRIVATE.mkdir(parents=True, exist_ok=True)
    (PRIVATE / "kmp_age_source_audit.json").write_text(json.dumps({
        "2023": {"raw_n": len(frames[2023]), "analysis_n": chatbot_base, "unknown_age_9999_n": unknown_age23},
        "2024": {"raw_n": len(frames[2024]), "analysis_n": genai_base, "unknown_age_9999_n": unknown_age24},
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "id": "kmp_korea_media_panel", "title": "KISDI 한국미디어패널조사(KMP)", "source_label": "KISDI 제공 2023~2024 개인용 KMP SAV", "years": [2023, 2024], "unit": "개인 응답자", "scope_type": "individual_ai", "status": "descriptive",
        "scope": "개인의 최근 3개월 AI 이용 및 관련 인식 문항이다. 취업 범주는 개인의 취업상태일 뿐 고용주 부문이나 조직 AI 정책이 아니다.",
        "sample": {"raw_n": raw_n, "analysis_n": chatbot_base + genai_base, "excluded_n": raw_n - chatbot_base - genai_base, "groups": [{"id": "wave_2023", "label": "2023 개인용 KMP 파일(이번 분석의 연령 제한 적용)", "n": chatbot_base}, {"id": "wave_2024", "label": "2024 개인용 KMP 파일(이번 분석의 연령 제한 적용)", "n": genai_base}]},
        "samples_by_year": {str(year): {"raw_n": len(frames[year]), "analysis_n": count, "excluded_n": len(frames[year]) - count, "groups": [{"id": f"wave_{year}", "label": f"{year}년 개인용 설문 완료·분석 연령 충족", "n": count}]} for year, count in [(2023, chatbot_base), (2024, genai_base)]},
        "year_coverage_note": "현재 AI 관련 문항을 검증한 2023·2024년만 선택합니다. 제공본의 다른 연도는 추가 문항 검증 전이며, 2023 챗봇과 2024 생성형 AI를 같은 추세로 연결하지 않습니다.",
        "weight_note": "비가중 집단별 분포. 문항별로 pXXans=1과 만 7세 이상을 먼저 적용한다. raw_n은 개인 고유 수가 아닌 개인-웨이브 수다. 2023 챗봇과 2024 생성형 AI 정의가 달라 연도 간 AI 전이는 계산하지 않는다.",
        "cautions": ["2023년은 챗GPT 등을 포함한 AI 챗봇, 2024년은 더 넓은 생성형 AI 서비스를 측정한다. 동일 추세나 전이 결과가 아니다.", "목적·서비스·유료 이용 후속 문항은 이용자에게만 제시된다. 비이용자는 0이 아니라 구조적 결측이다.", "p24m01022는 새로운 디지털 미디어 제품·서비스 사용에 대한 개인의 조직/집단 지원 인식이며 AI/HR 정책이나 조직 성과 지표가 아니다.", f"age1=9999(모름/무응답)는 연령 미상으로 분석에서 제외했다(2023년 {unknown_age23}명, 2024년 {unknown_age24}명). 120세 상한은 코드북 범위를 확인하지 못한 분석상 안전장치다.", "고용주의 공공/민간 부문을 사용하거나 추정하지 않았다."],
        "questions": questions, "action_questions": ["최근 3개월 개인 AI 이용은 연령·개인 취업상태별로 어떻게 다른가?", "이용자만 놓고 주된 목적·서비스·유료 이용은 어떻게 분포하는가?"],
        "evidence": [{"label": "KISDI 한국미디어패널 설문지·원시자료 안내", "url": "https://stat.kisdi.re.kr/kor/contents/ContentsList.html?sub_div=S&subject=SURV", "note": "제공된 2023 설문지 물리 19쪽 및 2024 설문지 물리 10쪽에서 문항과 이용자 전용 후속 흐름을 확인했다. 두 문항 모두 개인용 설문 전체 응답 문항이나, 본 분석은 제공된 연구 기준에 맞춰 만 7세 이상으로 제한한다."}],
        "models": [], "findings": [
            {"title": "최근 3개월 AI 이용(정의 분리)", "body": f"만 7세 이상 2023년 개인용 설문 완료자 {chatbot_base:,}명 중 {chatbot_users:,}명(비가중 {chatbot_users / chatbot_base:.1%})은 AI 챗봇 이용을, 2024년 {genai_base:,}명 중 {genai_users:,}명(비가중 {genai_users / genai_base:.1%})은 더 넓은 생성형 AI 서비스 이용을 보고했다. 설문 정의가 달라 동일 추세가 아니다."},
            {"title": "측정 정의 분리", "body": "모든 KMP 분포에는 해당 연도 개인용 설문 완료 플래그와 만 7세 이상 기준을 적용했다. 2023년 챗봇과 2024년 생성형 AI 모듈은 범위가 달라 분리 제시한다."},
        ],
    }


def write_report(source_check: dict[str, Any], data: dict[str, Any]) -> None:
    KISDI = data["datasets"][0]
    KMP = data["datasets"][1]
    lines = [
        "# Supplemental personal AI analysis", "",
        "## Completed descriptive analysis", "",
        "- KISDI: 2022 N=5,378; 2023 N=4,581; 2024 N=4,420. One `wgt_a` SAV per wave was used without weights.",
        "- KMP personal files: 2023 N=9,757; 2024 N=8,693. Every KMP item first enforces `pXXans=1`; all results are unweighted.",
        "- KMP 정정: 설문지의 AI 문항은 전체 응답 문항이며 만 7세 이상 건너뜀 지시는 확인되지 않았다. 이번 분석에서는 제공된 연구의 연령 기준을 보수적으로 반영해 age1>=7을 분석 제한으로 적용했다(2023 N=9,751; 2024 N=8,691). 이는 설문상 미질문과 다르다.",
        f"- {KMP['cautions'][3]}",
        "- KMP 2024 유료 서비스 문항은 설문지 인쇄본의 ‘⑥ 아니오’ 표기와 달리 SAV 코드북의 2=아니오를 사용했다. 인쇄 표기 오류로 보고 재부호화하지 않았다.",
        "- 외부 연구에서 인용된 2023 N=9,411은 제공된 개인 SAV와 age1>=7 조건만으로 재현되지 않는다(340명 차이). 근거 없는 추가 제외로 맞추지 않았다.",
        "- KISDI 2023-to-2024 linkage has N=3,895 unique common IDs. The published transition is a descriptive ever-use response table only.",
        "- KMP 2023 chatbot and 2024 broader generative-AI modules are separate, so no AI trend or transition is reported.", "",
        "## Descriptive findings", "",
        f"- {KISDI['findings'][0]['body']}",
        f"- Across the 3,895 linked KISDI respondents: {KISDI['transitions'][0]['rows'][0]['n']:,} reported experience in both waves, {KISDI['transitions'][0]['rows'][1]['n']:,} changed from experience to no experience, {KISDI['transitions'][0]['rows'][2]['n']:,} changed from no experience to experience, and {KISDI['transitions'][0]['rows'][3]['n']:,} reported no experience in both. This is a response-transition description, not first adoption.",
        f"- {KMP['findings'][0]['body']}", "",
        "## Supplied-archive verification", "",
        f"- Outer supplied KISDI archive available at analysis time: `{source_check['source_archive_present']}`.",
        f"- All six expected year/weight-variant SAV hash-and-byte comparisons matched: `{source_check['all_expected_sav_matched']}`.",
        "- The computation uses only the independently audited `wgt_a` file for each KISDI year; a/b variants were not pooled or double-counted.", "",
        "## Interpretation limits", "",
        "- Age and employment groupings are individual respondent categories, not public/private employers or organizations.",
        "- Perceived task help, idea help, privacy, and group support are descriptive survey responses. They are not causal outcomes, productivity measures, or AI/HR policy measures.",
        "- No regressions, causal claims, organization-level inference, or respondent rows are included.", "",
        "## Output contract checks", "",
        f"- Public datasets emitted: {KISDI['id']}, {KMP['id']}.",
        "- Every question exposes eligible, valid, structural-missing, and unknown counts; response shares use the documented valid denominator.",
        "- No archive paths, original rows, free-text answers, or credentials are present in the public JSON.",
    ]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument(
        "--source-root",
        type=Path,
        default=os.environ.get(SOURCE_ROOT_ENV),
        help=f"Private source directory (or set {SOURCE_ROOT_ENV}); source files are not included in this repository.",
    )
    args = parser.parse_args()
    if args.source_root is None:
        parser.error(f"--source-root or {SOURCE_ROOT_ENV} is required to reproduce the aggregate export")
    source_root = args.source_root.expanduser()
    if not source_root.is_dir():
        parser.error("--source-root must be an existing private source directory")
    archive = kisdi_archive(source_root)
    if not archive.is_file():
        parser.error("Required private KISDI archive is unavailable under --source-root")
    PRIVATE.mkdir(parents=True, exist_ok=True)
    source_check = verify_kisdi_source(archive)
    (PRIVATE / "kisdi_source_verification.json").write_text(json.dumps(source_check, ensure_ascii=False, indent=2), encoding="utf-8")
    payload = {"datasets": [build_kisdi(), build_kmp()]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(source_check, payload)
    print(json.dumps({"output": str(args.output), "datasets": [d["id"] for d in payload["datasets"]], "kisdi_hash_match": source_check["all_expected_sav_matched"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
