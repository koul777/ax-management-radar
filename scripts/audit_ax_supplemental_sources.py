"""Inspect only dictionaries and supplied usage notices; never export microdata.

Private source files are deliberately resolved at runtime. This script can be
shared without disclosing an analyst's local archive location.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT_ENV = "AX_SUPPLEMENTAL_AUDIT_SOURCE_ROOT"
SOURCE_SPECS = [
    ("kipa_data_2019", ("KIPA - 데이터기반행정 강화 방안 연구 공공데이터", "한국행정연구원_데이터기반행정_2019.sav"), "활용시 문구 (15).pdf"),
    ("kipa_jobs_2015", ("KIPA - 인사행정 관련 DATA", "직위분류제 확대와 연계한 공무원 인사관리의 개선방안", "한국행정연구원_직위분류제 확대와 연계한 공무원 인사관리의 개선방안_데이터_2015.sav"), "활용시 문구.pdf"),
    ("kipa_cloud_2022", ("KIPA - 클라우드 전환 시대 데이터기반행정 추진 전략", "한국행정연구원_클라우드 전환 시대 데이터기반행정 추진 전략 데이터 분석 활용 강화 방안을 중심으로_데이터_2022 (1).sav"), "활용시 문구 (1).pdf"),
]
QUESTION_PATTERN = re.compile(r"소속|근무처|기관 유형|전문|직무|보수|전환|교육|학습|역량|능력|클라우드|자율|혁신|공유|협업|소통|직급|기관의 역량|데이터|지원|성과")


def source_specs(source_root: Path) -> list[tuple[str, Path, str]]:
    """Resolve explicitly supplied private input files from a portable root."""
    return [(source_id, source_root.joinpath(*parts), notice) for source_id, parts, notice in SOURCE_SPECS]


def audit(source_root: Path) -> None:
    sys.path.insert(0, str(ROOT / ".tmp" / "spss_reader"))
    import fitz
    import pyreadstat

    for source_id, source, notice_name in source_specs(source_root):
        _, meta = pyreadstat.read_sav(str(source), metadataonly=True)
        report = {
            "id": source_id,
            "file": source.name,
            "n": meta.number_rows,
            "columns": meta.number_columns,
            "encoding": meta.file_encoding,
            "questions": [
                {
                    "id": name,
                    "label": meta.column_names_to_labels[name],
                    "responses": meta.variable_value_labels.get(name, {}),
                    "missing": meta.missing_ranges.get(name, []),
                }
                for name in meta.column_names
            ],
        }
        (ROOT / ".tmp" / f"{source_id}_dictionary.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps({"id": source_id, "n": meta.number_rows, "columns": meta.number_columns}, ensure_ascii=False))
        for question in report["questions"]:
            if re.search(r"Q1_[A-F]_\d|Q5_\d_\d|_Etc$", question["id"]):
                continue
            if QUESTION_PATTERN.search(question["label"] or ""):
                print(question["id"], question["label"])
        for name in meta.column_names[:5]:
            print("GROUP/SCALE", name, meta.variable_value_labels.get(name, {}))
        notice = source.with_name(notice_name)
        if notice.exists():
            with fitz.open(notice) as document:
                print(json.dumps({"notice": notice_name, "pages": len(document), "text": "\n".join(page.get_text() for page in document)}, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-root",
        type=Path,
        default=os.environ.get(SOURCE_ROOT_ENV),
        help=f"Private source directory (or set {SOURCE_ROOT_ENV}); source files are not included in this repository.",
    )
    args = parser.parse_args()
    if args.source_root is None:
        parser.error(f"--source-root or {SOURCE_ROOT_ENV} is required for the metadata audit")
    source_root = args.source_root.expanduser()
    if not source_root.is_dir():
        parser.error("--source-root must be an existing private source directory")
    missing = [source_id for source_id, source, _ in source_specs(source_root) if not source.is_file()]
    if missing:
        parser.error(f"Required private KIPA source is unavailable: {', '.join(missing)}")
    audit(source_root)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
