#!/usr/bin/env python3
"""Build the aggregate-only payload for the public-institution dashboard.

The input package contains institutional publication rows and public aggregate
statistics.  This script deliberately excludes all questionnaire/microdata
content and removes repeated source provenance from individual display rows.
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "research" / "innovation-data-pack"
OUT = ROOT / "app" / "data" / "public-institution-innovation.json"
INCLUDED_SOURCE_IDS = {"D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10", "D14", "D15", "D32", "D33", "D35"}


def read(relative: str):
    return json.loads((PACK / relative).read_text(encoding="utf-8"))


def compact_source(row: dict) -> dict:
    return {
        "id": row["source_id"], "title": row["title"], "provider": row["provider"],
        "referencePeriod": row["reference_period"], "population": row["population"],
        "verificationStatus": row["verification_status"], "accessStatus": row["access_status"],
        "licenseNote": row["license_note"], "limits": row["known_limits"], "url": row["landing_url"], "resourceUrl": row["resource_url"],
        "dataAvailability": row.get("data_availability", "Tier C · 공개 정보 확인"),
        "publicationScope": row.get("publication_scope", "공개된 집계·기관 공시 기록만 표시"),
        "locallyHeldSummary": row.get("locally_held_summary", "로컬 보유 상태를 별도 확인하지 않음"),
    }


def distribution(rows: list[dict], grade_key: str = "grade") -> list[dict]:
    return [{"label": label, "count": count} for label, count in Counter(row[grade_key] for row in rows).items()]


def main() -> None:
    source_catalog = read("data/source-catalog.json")
    agency = read("data/agency-evaluations.json")
    local = read("data/local-enterprise-evaluations.json")
    observations = read("data/observations.json")
    backlog = read("metadata/collection-backlog.json")

    sources = {row["source_id"]: compact_source(row) for row in source_catalog if row["source_id"] in INCLUDED_SOURCE_IDS}
    agency_rows = [row for row in agency if row["source_id"] in {"D01", "D02", "D03"}]
    agency_by_source = defaultdict(list)
    for row in agency_rows:
        agency_by_source[row["source_id"]].append(row)
    agency_distributions = []
    for source_id, rows in agency_by_source.items():
        agency_distributions.append({
            "sourceId": source_id, "evaluationYear": rows[0]["evaluation_year"],
            "graded": distribution([row for row in rows if row["record_status"] == "graded"]),
            "excluded": distribution([row for row in rows if row["record_status"] == "excluded"]),
            "categoryCounts": [{"label": label, "count": count} for label, count in Counter(row["institution_category"] for row in rows).items()],
        })

    local_distributions = []
    for year in sorted({row["evaluation_year"] for row in local}):
        rows = [row for row in local if row["evaluation_year"] == year]
        local_distributions.append({
            "evaluationYear": year, "performanceYear": rows[0]["performance_year"],
            "graded": distribution([row for row in rows if row["record_status"] == "graded"]),
            "notApplicable": distribution([row for row in rows if row["record_status"] == "not_applicable"]),
            "other": distribution([row for row in rows if row["record_status"] == "other"]),
            "displayRows": len(rows),
        })

    payload = {
        "schemaVersion": 2,
        "generatedFrom": "research/innovation-data-pack (2026-09-08)",
        "scope": "Institutional publication records and public aggregate statistics only. Microdata, private local paths, and unit-record rows are excluded.",
        "sources": sources,
        "agency": {
            "distributions": agency_distributions,
            "records": [{
                "sourceId": row["source_id"], "name": row["institution_name"], "category": row["institution_category"],
                "subtype": row["source_subtype"], "evaluationYear": row["evaluation_year"], "grade": row["grade"],
                "status": row["record_status"], "sourcePage": row["source_page"],
            } for row in agency_rows],
        },
        "localEnterprise": {
            "distributions": local_distributions,
            "records": [{
                "sourceRowNumber": row["source_row_number"], "name": row["institution_name"],
                "evaluationYear": row["evaluation_year"], "performanceYear": row["performance_year"],
                "grade": row["grade"], "status": row["record_status"], "nameCollision": row["name_collision"],
                "notes": row["notes"],
            } for row in local],
        },
        "observations": [{
            "id": row["observation_id"], "sourceId": row["source_id"], "metricId": row["metric_id"],
            "metric": row["metric_label"], "referencePeriod": row["reference_period"], "year": row["year"],
            "group": row["group_label"], "value": row["value"], "unit": row["unit"], "valueStatus": row["value_status"],
            "aggregationLevel": row["aggregation_level"], "denominator": row["denominator_label"],
            "sourceLocation": row["source_location"], "notes": row["notes"],
        } for row in observations if row["source_id"] in INCLUDED_SOURCE_IDS],
        "collectionBacklog": [{
            "sourceId": row["source_id"], "priority": row["priority"], "nextAction": row["next_action"],
            "accessStatus": row["access_status"], "url": row["landing_url"], "limits": row["known_limits"],
        } for row in backlog],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")
    print(f"Sources: {len(sources)}; agency records: {len(agency_rows)}; local records: {len(local)}; observations: {len(payload['observations'])}; backlog: {len(backlog)}")


if __name__ == "__main__":
    main()
