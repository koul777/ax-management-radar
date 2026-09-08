// Executable Node.js example with no third-party dependencies.
// Run: node examples/query.mjs
import { readFileSync } from "node:fs";

const readJson = (relativePath) => JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
const observations = readJson("../data/observations.json");
const metrics = readJson("../data/metrics.json");
const evaluations = readJson("../data/agency-evaluations.json");

const suggestion = metrics.find((metric) => metric.source_id === "D09" && metric.metric_label === "업무 개선 제안제도");
if (!suggestion) throw new Error("Missing WPS suggestion metric");
const series = observations
  .filter((row) => row.metric_id === suggestion.metric_id && row.group_label === "전체 사업체")
  .sort((a, b) => a.year - b.year)
  .map((row) => ({ year: row.year, value: row.value, unit: row.unit }));

const grades = {};
for (const row of evaluations) {
  if (row.source_id !== "D01" || row.evaluation_year !== 2025 || row.record_status !== "graded") continue;
  grades[row.grade] = (grades[row.grade] ?? 0) + 1;
}

console.log(JSON.stringify({
  metric: suggestion.metric_label,
  source_id: suggestion.source_id,
  population: "공공·민간 합계 사업체 통계",
  series,
  data_administration_2025_grade_counts: grades,
}, null, 2));
