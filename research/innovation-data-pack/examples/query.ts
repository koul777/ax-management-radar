import rawObservations from "../data/observations.json";
import rawMetrics from "../data/metrics.json";
import rawSources from "../data/source-catalog.json";
import rawAgencyEvaluations from "../data/agency-evaluations.json";
import type { AgencyEvaluation, Metric, Observation, SourceCatalogEntry } from "../types";

// JSON files are validated by scripts/validate_data.py.
export const observations = rawObservations as Observation[];
export const metrics = rawMetrics as Metric[];
export const sources = rawSources as SourceCatalogEntry[];
export const agencyEvaluations = rawAgencyEvaluations as AgencyEvaluation[];

export function findMetrics(term: string): Metric[] {
  return metrics.filter((metric) => metric.metric_label.includes(term));
}

export function getSeries(sourceId: string, metricId: string, groupLabel: string): Observation[] {
  return observations
    .filter((row) => row.source_id === sourceId && row.metric_id === metricId && row.group_label === groupLabel)
    .sort((a, b) => a.reference_period.localeCompare(b.reference_period));
  // Preserve null values so a chart can show unasked years as gaps.
}

export function getSource(sourceId: string): SourceCatalogEntry | undefined {
  return sources.find((source) => source.source_id === sourceId);
}

export function gradeDistribution(sourceId: string, year: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of agencyEvaluations) {
    if (row.source_id !== sourceId || row.evaluation_year !== year || row.record_status !== "graded") continue;
    counts[row.grade] = (counts[row.grade] ?? 0) + 1;
  }
  return counts;
}

export function formatValue(row: Observation): string {
  if (row.value === null) return row.value_status === "not_asked" ? "미조사" : "—";
  const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(row.value);
  const suffix = {
    percent: "%", institutions: "개 기관", persons: "명", KRW_100million: "억원", cases: "건", index_0_100: "점",
  }[row.unit];
  return `${number}${suffix}`;
}

// Ready-to-use examples. D09_M01 is defined in metrics.json.
export const suggestionSchemeSeries = getSeries("D09", "D09_M01", "전체 사업체");
export const dataAdministrationGrades = gradeDistribution("D01", 2025);
