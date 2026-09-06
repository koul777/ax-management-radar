"""Generate KIPA aggregate-only supplemental results.

The script deliberately keeps microdata local.  It writes complete aggregate
distributions only to ``.tmp/supplemental_public`` by default and writes an
empty public-data shell to ``app/data/supplemental-public.json`` until an
authorized operator explicitly passes ``--publish-authorized``.
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import os
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".tmp" / "spss_reader"))


SOURCE_ROOT_ENV = "AX_SUPPLEMENTAL_PUBLIC_SOURCE_ROOT"
LOCAL_OUTPUT = ROOT / ".tmp" / "supplemental_public" / "local_aggregate_results.json"
PUBLIC_OUTPUT = ROOT / "app" / "data" / "supplemental-public.json"

LIKERT_CODES = {1, 2, 3, 4, 5}


def source_path(*parts: str) -> Path:
    """Store source-relative paths only; raw files are never part of this repository."""
    return Path(*parts)


DATASETS: list[dict[str, Any]] = [
    {
        "id": "kipa_jobs_2015",
        "title": "직위분류제 확대와 연계한 공무원 인사관리 개선방안 조사",
        "source_label": "한국행정연구원 KIPA 2015",
        "path": source_path(
            "KIPA - 인사행정 관련 DATA",
            "직위분류제 확대와 연계한 공무원 인사관리의 개선방안",
            "한국행정연구원_직위분류제 확대와 연계한 공무원 인사관리의 개선방안_데이터_2015.sav",
        ),
        "years": [2015],
        "unit": "조사 응답자(공무원)",
        "scope_type": "public_internal",
        "scope": "중앙정부 공무원 응답자 조사이며 민간부문 비교집단은 포함하지 않는다.",
        "group_variable": None,
        "groups": [("all_respondents", "전체 응답자", None)],
        "questions": [
            *[(f"Q2_{i}", "직무만족", "직무만족 문항", "높은 동의는 더 높은 자기보고 직무만족을 뜻한다.") for i in range(1, 6)],
            *[(f"Q3_{i}", "조직몰입", "조직몰입 문항", "높은 동의는 더 높은 자기보고 조직몰입을 뜻한다.") for i in range(1, 6)],
        ],
        "action_questions": [
            "직무만족·조직몰입 문항 중 무응답이 큰 문항은 무엇이며, 문서화된 공무원 역할에 따라 양상이 다른가?",
            "개입 효과 주장에 사용하기 전에 원 척도 구성과 조사 표집 과정을 검증할 수 있는가?",
        ],
        "evidence": [
            {"label": "KOSSDA 자료 메타데이터", "url": "https://kossda.snu.ac.kr/handle/20.500.12236/25650", "note": "조사 메타데이터와 원 설문지 근거."},
            {"label": "보완 선행연구 방법 검토", "url": "https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002213550", "note": "게재연구 초록 근거이며 모형을 재현한 것은 아님."},
        ],
    },
    {
        "id": "kipa_data_2019",
        "title": "데이터기반행정을 위한 공공데이터 정책 활용 실태조사",
        "source_label": "한국행정연구원 KIPA 2019",
        "path": source_path(
            "KIPA - 데이터기반행정 강화 방안 연구 공공데이터",
            "한국행정연구원_데이터기반행정_2019.sav",
        ),
        "years": [2019],
        "unit": "조사 응답자(공공부문 데이터 정책 담당자·연구자)",
        "scope_type": "public_internal",
        "scope": "국가기관·지방자치단체·국책연구기관의 공공부문 응답자만 포함하며 공공/민간 비교가 아니다.",
        "group_variable": "SQ1",
        "groups": [
            ("all_respondents", "전체 응답자", None),
            ("central_government", "국가기관", 1),
            ("local_government", "지방자치단체", 2),
            ("national_policy_research", "국책연구기관", 3),
        ],
        "questions": [
            *[(f"Q9_{i}", "지원조건 중요도", "데이터기반행정 지원조건의 인식된 중요도", "높은 평점은 응답자가 해당 지원조건을 더 중요하다고 평가했음을 뜻한다.") for i in (2, 3, 4, 7, 8, 9, 10)],
            *[(f"Q10_{i}", "지원조건 충분도", "데이터기반행정 지원조건의 인식된 충분도", "높은 평점은 응답자가 해당 지원조건이 더 충분하다고 평가했음을 뜻한다.") for i in (2, 3, 4, 7, 8, 9, 10)],
        ],
        "action_questions": [
            "예산·전문인력·교육·조직 간 협력·리더 역량·구성원 역량·데이터 중시 문화에서 중요도와 충분도는 어디에서 차이 나는가?",
            "국가기관·지방자치단체·국책연구기관의 다른 표본 구성을 명시했을 때, 보고된 병목은 다른가?",
        ],
        "evidence": [
            {"label": "KIPA 조사 메타데이터", "url": "https://sky.kipa.re.kr/%26/10220/contents/7139582", "note": "공식 조사 메타데이터·파일 안내."},
            {"label": "보완 선행연구 방법 검토", "url": "https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002673186", "note": "게재연구 초록 근거이며 논문의 정확한 모형을 재현한 것은 아님."},
        ],
    },
    {
        "id": "kipa_cloud_2022",
        "title": "클라우드 전환 시대 데이터기반행정 추진 전략 조사",
        "source_label": "한국행정연구원 KIPA 2022",
        "path": source_path(
            "KIPA - 클라우드 전환 시대 데이터기반행정 추진 전략",
            "한국행정연구원_클라우드 전환 시대 데이터기반행정 추진 전략 데이터 분석 활용 강화 방안을 중심으로_데이터_2022 (1).sav",
        ),
        "years": [2022],
        "unit": "조사 응답자(공공부문 데이터기반행정 역할 담당자)",
        "scope_type": "public_internal",
        "scope": "중앙정부·지방정부 및 기관 비공개 응답자를 포함하며, 민간부문 비교나 기관 패널은 아니다.",
        "group_variable": "기관구분",
        "groups": [
            ("all_respondents", "전체 응답자", None),
            ("central_government", "중앙정부", 1),
            ("local_government", "지방정부", 2),
            ("institution_not_disclosed", "기관 비공개", 3),
        ],
        "questions": [
            ("Q12_1", "조직 지원", "기관장의 데이터기반행정 장려", "높은 동의는 더 강한 자기보고 리더십 장려를 뜻한다."),
            ("Q12_4", "조직 지원", "데이터 분석·활용 결과 기반 의사결정 장려", "높은 동의는 더 강한 자기보고 장려를 뜻한다."),
            ("Q12_7", "역량 지원", "데이터 과학 교육·훈련 실시", "높은 동의는 더 강한 자기보고 역량 지원을 뜻한다."),
            ("Q12_8", "조직 지원", "데이터기반행정 업무 가이드라인·매뉴얼의 유용성", "높은 동의는 더 유용한 자기보고 지침을 뜻한다."),
            ("Q12_17", "소통·협업", "기관 내 부서 간 데이터 공유 및 협조", "높은 동의는 더 원활한 자기보고 부서 간 협조를 뜻한다."),
            ("Q12_18", "소통·협업", "타 기관·부서 데이터 제공 요구에 대한 협조적 대응", "높은 동의는 더 협조적인 자기보고 대응을 뜻한다."),
            ("Q12_21", "성과 지원", "성과관리에 데이터기반행정 반영", "높은 동의는 더 강한 자기보고 성과관리 지원을 뜻한다."),
            ("Q12_22", "성과 지원", "인센티브 인정 근거에 데이터 관련 실적 반영", "높은 동의는 더 강한 자기보고 인센티브 인정을 뜻한다."),
            ("Q15_7", "데이터 활용 역량", "업무·의사결정에서 다양한 데이터 활용", "높은 동의는 더 많은 자기보고 데이터 활용을 뜻한다."),
            ("Q15_8", "데이터 활용 역량", "데이터 분석 방법 및 소프트웨어 활용 가능", "높은 동의는 더 높은 자기보고 분석 역량을 뜻한다."),
            ("Q15_3", "혁신 행동", "새롭고 독창적인 업무수행 방식 창안·적용 노력", "높은 동의는 더 많은 자기보고 혁신 업무행동을 뜻한다."),
            ("Q15_4", "혁신 행동", "업무 문제해결을 위한 새로운 아이디어 개발", "높은 동의는 더 많은 자기보고 문제해결 아이디어 개발을 뜻한다."),
            ("Q15_21", "자율성", "업무 내용에 영향을 미치는 결정 참여", "높은 동의는 더 많은 자기보고 의사결정 참여를 뜻한다."),
            ("Q15_22", "자율성", "업무수행 방식·절차 선택권", "높은 동의는 더 많은 자기보고 절차 재량을 뜻한다."),
            ("Q15_25", "소통·협업", "부서 간 협업의 전반적 원활성", "높은 동의는 더 원활한 자기보고 협업을 뜻한다."),
            ("Q15_26", "소통·협업", "상하 간 수직적 의사소통의 원활성", "높은 동의는 더 원활한 자기보고 수직적 의사소통을 뜻한다."),
            ("Q15_27", "소통·협업", "직원 간 수평적 의사소통의 원활성", "높은 동의는 더 원활한 자기보고 수평적 의사소통을 뜻한다."),
            ("Q15_28", "혁신 분위기", "환경·정부정책 변화에 혁신적으로 대응하려는 조직", "높은 동의는 더 혁신지향적인 자기보고 조직 분위기를 뜻하며, 실현된 혁신과 같지 않다."),
        ],
        "action_questions": [
            "지원·역량·자율성·소통·혁신행동 문항 중 중앙/지방의 기술적 차이가 가장 큰 것은 무엇이며, 분모와 결측은 함께 제시되었는가?",
            "Q15_3과 Q15_4는 조직 혁신 성과가 아니라 서로 구분되는 자기보고 혁신행동 측정치인가?",
            "향후 회귀 전에 상관된 지원 요인을 분리하고 역할·직급·재직기간·표집·횡단면 한계를 문서화할 수 있는가?",
        ],
        "evidence": [
            {"label": "KIPA 연구자료 아카이브", "url": "https://sky.kipa.re.kr/", "note": "공식 KIPA 아카이브이며 SPSS 사전과 활용 문구는 로컬에서 점검함."},
        ],
    },
]


def json_code(value: Any) -> str:
    """Use stable human-readable codes for numeric SPSS categories."""
    number = float(value)
    return str(int(number)) if number.is_integer() else str(number)


def label_map(meta: Any, code: str) -> dict[str, str]:
    return {json_code(key): str(value) for key, value in meta.variable_value_labels.get(code, {}).items()}


def is_missing_label(label: str) -> bool:
    normalized = label.replace(" ", "")
    return any(token in normalized for token in ("무응답", "응답거부", "결측", "해당없음"))


def is_unknown_label(label: str) -> bool:
    normalized = label.replace(" ", "")
    return any(token in normalized for token in ("모름", "잘모르", "모르겠"))


def numeric(value: Any) -> float | None:
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(result) else result


def question_groups(frame: Any, dataset: dict[str, Any], code: str, labels: dict[str, str]) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    group_column = dataset["group_variable"]
    for group_id, group_label, group_code in dataset["groups"]:
        if group_code is None:
            mask = [True] * len(frame)
        else:
            mask = [numeric(value) == group_code for value in frame[group_column]]
        values = [value for value, include in zip(frame[code], mask) if include]
        counts = {str(valid): 0 for valid in sorted(LIKERT_CODES)}
        missing_n = unknown_n = 0
        for value in values:
            number = numeric(value)
            if number is None:
                missing_n += 1
                continue
            response_code = json_code(number)
            response_label = labels.get(response_code, "")
            if number in LIKERT_CODES:
                counts[response_code] += 1
            elif is_missing_label(response_label):
                missing_n += 1
            elif is_unknown_label(response_label):
                # A labelled do-not-know option is a valid displayed response,
                # so it remains in valid_n and is also reported as unknown_n.
                counts[response_code] = counts.get(response_code, 0) + 1
                unknown_n += 1
            else:
                # Preserve any other observed, non-missing labelled category as
                # a response rather than silently dropping it from the denominator.
                counts[response_code] = counts.get(response_code, 0) + 1
                unknown_n += 1
        valid_n = sum(counts.values())
        responses = [
            {
                "code": response_code,
                "label": labels.get(response_code, f"응답 {response_code}"),
                "n": count,
                "share": round(count / valid_n, 8) if valid_n else None,
            }
            for response_code, count in counts.items()
        ]
        groups.append({
            "id": group_id,
            "label": group_label,
            "eligible_n": len(values),
            "valid_n": valid_n,
            "missing_n": missing_n,
            "unknown_n": unknown_n,
            "responses": responses,
        })
    return groups


def full_dataset(spec: dict[str, Any]) -> dict[str, Any]:
    # Imported only for a real local-SAV run. Keeping this lazy lets the
    # aggregate-contract tests execute without reading the private package.
    import pyreadstat

    frame, meta = pyreadstat.read_sav(str(spec["path"]), apply_value_formats=False)
    raw_n = len(frame)
    questions = []
    for code, dimension, short_label, direction in spec["questions"]:
        source_label = str(meta.column_names_to_labels.get(code, ""))
        if not source_label:
            raise ValueError(f"{spec['id']}: missing dictionary label for {code}")
        labels = label_map(meta, code)
        questions.append({
            "id": f"{spec['id']}_{code.lower()}",
            "label": source_label,
            "dimension": dimension,
            "period": spec["years"][0],
            "universe": spec["unit"],
            "scale": "원 1~5 서열형 응답 범주; 합성지수 없이 문항별 분포만 제시.",
            "direction": direction,
            "source_code": code,
            "source_note": short_label + ". 문서화된 1~5 응답 범주 밖의 값은 SPSS 값 라벨에 따라 결측 또는 모름으로 분류한다.",
            "groups": question_groups(frame, spec, code, labels),
        })
    sample_groups = []
    group_column = spec["group_variable"]
    for group_id, group_label, group_code in spec["groups"]:
        if group_code is None:
            n = raw_n
        else:
            n = sum(numeric(value) == group_code for value in frame[group_column])
        sample_groups.append({"id": group_id, "label": group_label, "n": int(n)})
    return {
        "id": spec["id"],
        "title": spec["title"],
        "source_label": spec["source_label"],
        "years": spec["years"],
        "unit": spec["unit"],
        "scope_type": spec["scope_type"],
        "status": "descriptive",
        "publication_status": "pending_usage_confirmation",
        "scope": spec["scope"],
        "sample": {"raw_n": raw_n, "analysis_n": raw_n, "excluded_n": 0, "groups": sample_groups},
        "weight_note": "비가중 응답자 분포이며 설계가중치를 적용하지 않았다.",
        "cautions": [
            "로컬 집계 분석은 완료했으나, KIPA 연구자료 규정에 따른 이 활용 및 공개의 허가 확인 전까지 공개 배포를 보류한다.",
            "횡단면 자기보고 분포는 제공 표본만 기술하며 인과효과를 식별하지 않는다.",
            "이는 공공 내부 기술 분석이며 공공/민간 비교가 아니다.",
            "응답자 행, 자유응답, 비공개 원자료 경로는 내보내지 않는다.",
        ],
        "questions": questions,
        "action_questions": spec["action_questions"],
        "evidence": spec["evidence"],
        "models": [],
        "findings": [],
    }


def public_shell(full: dict[str, Any]) -> dict[str, Any]:
    """Keep only non-numeric metadata while permission to release is unresolved."""
    return {
        key: value
        for key, value in full.items()
        if key not in {"sample", "questions", "models", "findings"}
    } | {"sample": None, "groups": [], "questions": [], "models": [], "findings": []}


def authorized_release(full: dict[str, Any]) -> dict[str, Any]:
    """Mark a copied aggregate bundle as publishable after documented approval."""
    released = copy.deepcopy(full)
    for dataset in released["datasets"]:
        dataset["publication_status"] = "approved"
        dataset["cautions"][0] = (
            "사용자가 사용 허가와 이 집계 공개 진행을 2026-09-06에 확인하여 공개한 결과다. 별도의 추가 공개 허가가 필요하다는 확인되지 않은 전제를 두지 않는다."
        )
    return released


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-root",
        type=Path,
        default=os.environ.get(SOURCE_ROOT_ENV),
        help=f"Private source directory (or set {SOURCE_ROOT_ENV}); source files are not included in this repository.",
    )
    parser.add_argument(
        "--publish-authorized",
        action="store_true",
        help="KIPA의 이 집계 공개 허가가 문서로 확인된 뒤에만 집계를 공개 JSON에 기록한다.",
    )
    args = parser.parse_args()
    if args.source_root is None:
        parser.error(f"--source-root or {SOURCE_ROOT_ENV} is required to reproduce the aggregate export")
    source_root = args.source_root.expanduser()
    if not source_root.is_dir():
        parser.error("--source-root must be an existing private source directory")
    for spec in DATASETS:
        spec["path"] = source_root / spec["path"]
        if not spec["path"].exists():
            raise FileNotFoundError(f"Required KIPA source is unavailable: {spec['id']}")
    full = {"datasets": [full_dataset(spec) for spec in DATASETS]}
    LOCAL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    LOCAL_OUTPUT.write_text(json.dumps(full, ensure_ascii=False, indent=2), encoding="utf-8")
    public = authorized_release(full) if args.publish_authorized else {"datasets": [public_shell(item) for item in full["datasets"]]}
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUTPUT.write_text(json.dumps(public, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"local_output": str(LOCAL_OUTPUT), "public_mode": "authorized" if args.publish_authorized else "pending_usage_confirmation", "datasets": [{"id": item["id"], "raw_n": item["sample"]["raw_n"], "questions": len(item["questions"])} for item in full["datasets"]]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
