"use client";

import { useMemo, useState } from "react";
import AxModelCard, { type AnalysisModel } from "./ax-model-card";
import YearSelector from "./year-selector";
import KipaUsageNotice from "./kipa-usage-notice";

type Response = { code: string | number; label: string; n: number | null; share: number | null };
type Group = { id: string; label: string; n?: number | null; eligible_n?: number; valid_n?: number; missing_n?: number; structural_missing_n?: number; unknown_n?: number; suppressed?: boolean; small_sample?: boolean; responses?: Response[] };
type Question = { id: string; label: string; dimension: string; period: string | number; universe: string; scale: string; source_code: string; source_note: string; multiple_response?: boolean; groups: Group[] };
type Transition = { label: string; period: string; unit: string; n: number; rows: Array<{ from: string; to: string; n: number }>; note: string };
type Sample = { raw_n: number | null; analysis_n: number | null; excluded_n: number | null; groups: Group[] };
type Dataset = {
  id: string; title: string; source_label: string; years: number[]; unit: string;
  scope_type: "public_internal" | "public_private_workers" | "individual_ai" | "citizen_services";
  status: "descriptive" | "descriptive_and_regression" | "audit_only" | "unavailable";
  publication_status?: "pending_usage_confirmation" | "approved";
  scope: string; sample: Sample | null; samples_by_year?: Record<string, Sample>; year_coverage_note?: string;
  weight_note: string; cautions: string[]; questions: Question[]; action_questions: string[];
  evidence: Array<{ label: string; url: string; note: string }>; models: AnalysisModel[];
  findings?: Array<{ title: string; body: string }>;
  transitions?: Transition[];
};
export type SupplementalBundle = { datasets: Dataset[] };

const scopeLabel = { public_internal: "공공조직 응답자", public_private_workers: "공공·민간 근로자", individual_ai: "개인 AI 이용", citizen_services: "시민 서비스" };
const statusLabel = { descriptive: "응답 현황", descriptive_and_regression: "응답 현황·통제 후 관계", audit_only: "자료 확인", unavailable: "분석 보류" };
const dimensionNames: Record<string, string> = {
  use_intention: "사용 의도", service_use: "서비스 이용", privacy_rating: "개인정보 관리 평가",
  ai_experience: "AI 이용 경험", user_perception: "이용자의 도움 인식", awareness: "AI 인지",
  ai_use: "최근 AI 이용", purpose: "이용 목적", paid_use: "유료 이용", service: "이용 서비스",
  group_support_perception: "소속 조직·집단의 지원 인식",
};
function dimensionLabel(value: string) { return dimensionNames[value] ?? value; }

function NumberOrDash({ value }: { value: number | null | undefined }) { return <>{typeof value === "number" ? value.toLocaleString("ko-KR") : "—"}</>; }

function QuestionCard({ question, defaultOpen }: { question: Question; defaultOpen: boolean }) {
  return <details className="supplemental-question" open={defaultOpen}><summary><div><span>{dimensionLabel(question.dimension)}</span><h3>{question.label}</h3><p>{question.period} · {question.universe}</p></div></summary><dl className="supplemental-question-meta"><div><dt>척도</dt><dd>{question.scale}</dd></div><div><dt>원문 문항·변수</dt><dd>{question.source_code} · {question.source_note}</dd></div></dl><div className="supplemental-group-grid">{question.groups.map((group) => <article key={group.id}><h4>{group.label}</h4><p>대상 <NumberOrDash value={group.eligible_n} /> · 유효 <NumberOrDash value={group.valid_n} /> · 결측 <NumberOrDash value={group.missing_n} />{typeof group.structural_missing_n === "number" ? <> · 구조적 결측 <NumberOrDash value={group.structural_missing_n} /></> : null} · 유효 중 모름 <NumberOrDash value={group.unknown_n} /></p>{group.valid_n === 0 ? <p>유효응답이 없어 비율을 산출하지 않습니다.</p> : group.suppressed ? <p>유효응답 5건 미만으로 응답별 건수와 비율 표시를 보류합니다.</p> : <>{typeof group.valid_n === "number" && group.valid_n < 30 ? <p className="wps-small-sample">소표본 주의 · 유효응답 30건 미만입니다.</p> : null}{group.responses?.map((response) => <div className="supplemental-response" key={`${group.id}-${response.code}`}><span>{response.label}</span><i aria-hidden="true"><b style={{ width: `${Math.max(0, Math.min(100, (response.share ?? 0) * 100))}%` }} /></i><strong>{response.share === null ? "—" : `${(response.share * 100).toFixed(1)}%`}</strong><small>n=<NumberOrDash value={response.n} /></small></div>)}</>}</article>)}</div></details>;
}

function TransitionCard({ transition }: { transition: Transition }) {
  const fromLabels = Array.from(new Set(transition.rows.map((row) => row.from)));
  const toLabels = Array.from(new Set(transition.rows.map((row) => row.to)));
  return <section className="supplemental-transition"><h3>{transition.label}</h3><p>{transition.period.replace(/→/g, "–")} · {transition.unit} · 연결 응답 <NumberOrDash value={transition.n} /></p><table><thead><tr><th scope="col">이전 응답</th>{toLabels.map((label) => <th key={label} scope="col">이후: {label}</th>)}</tr></thead><tbody>{fromLabels.map((from) => <tr key={from}><th scope="row">{from}</th>{toLabels.map((to) => <td key={to}>{(transition.rows.find((row) => row.from === from && row.to === to)?.n ?? 0).toLocaleString("ko-KR")}</td>)}</tr>)}</tbody></table><small>{transition.note}</small></section>;
}

export default function SupplementalDataDashboard({ bundles, title, description, initialYear }: { bundles: SupplementalBundle[]; title: string; description: string; initialYear?: string }) {
  const datasets = useMemo(() => bundles.flatMap((bundle) => bundle.datasets), [bundles]);
  const [datasetId, setDatasetId] = useState("all");
  const [dimension, setDimension] = useState("all");
  const allYears = Array.from(new Set(datasets.flatMap((dataset) => dataset.years)));
  const initialYearValid = !initialYear || initialYear === "all" || allYears.some((year) => String(year) === initialYear);
  const [year, setYear] = useState(initialYearValid && initialYear ? initialYear : allYears.length === 1 ? String(allYears[0]) : "all");
  const selected = datasets.filter((dataset) => datasetId === "all" || dataset.id === datasetId);
  const years = Array.from(new Set(selected.flatMap((dataset) => dataset.years))).sort((left, right) => left - right);
  const inYear = selected.filter((dataset) => year === "all" || dataset.years.some((value) => String(value) === year));
  const questionsInYear = inYear.flatMap((dataset) => dataset.questions.filter((question) => year === "all" || String(question.period) === year));
  const dimensions = Array.from(new Set(questionsInYear.map((question) => question.dimension)));
  function chooseYear(value: string) {
    setYear(value);
    setDimension("all");
    const url = new URL(window.location.href);
    if (value === "all") url.searchParams.delete("year"); else url.searchParams.set("year", value);
    window.history.replaceState(null, "", url);
  }
  return <section className="ax-dashboard supplemental-dashboard" aria-labelledby="supplemental-title">
    <header className="ai-dashboard-header"><div><span>SUPPLEMENTAL DATA · SEPARATE UNITS</span><h1 id="supplemental-title">{title}</h1><p>{description}</p></div><small>응답 현황 · 원인이나 효과를 확정하지 않음</small></header>
    <div className="supplemental-filters" role="group" aria-label="추가 자료 필터">
      <YearSelector id="supplemental-year" years={years} value={year} onChange={chooseYear} allowAll={years.length > 1} disabled={years.length === 1} note={years.length === 1 ? "현재 집계한 연도는 1개입니다. 다른 연도의 확보·검증 상태는 아래 자료 설명에 표시합니다." : "선택한 연도의 자료·문항·표본을 표시합니다. 조사마다 문항과 응답자가 다를 수 있습니다."} />
      <label>자료<select value={datasetId} onChange={(event) => { const nextId = event.target.value; setDatasetId(nextId); const nextYears = [...new Set(datasets.filter((dataset) => nextId === "all" || dataset.id === nextId).flatMap((dataset) => dataset.years))]; chooseYear(nextYears.length === 1 ? String(nextYears[0]) : "all"); }}><option value="all">모든 자료</option>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.title}</option>)}</select></label>
      <label>문항 차원<select value={dimension} onChange={(event) => setDimension(event.target.value)}><option value="all">모든 차원</option>{dimensions.map((item) => <option key={item} value={item}>{dimensionLabel(item)}</option>)}</select></label>
    </div>
    {!initialYearValid ? <p className="ai-model-caution" role="status">요청한 {initialYear}년은 아직 공개 가능한 집계가 없습니다. 검증된 연도의 자료를 표시합니다.</p> : null}
    <p className="ai-perception-note" role="status">{year === "all" ? "모든 연도 · 연도별 결과를 따로 표시" : `${year}년`} · 자료 {inYear.length}개 · 문항 {questionsInYear.filter((question) => dimension === "all" || question.dimension === dimension).length}개</p>
    <section className="ai-panel supplemental-reading"><strong>자료마다 답할 수 있는 질문이 다릅니다.</strong><p>공공조직의 관리 여건, 근로자의 직장 경험, 개인의 AI 이용, 시민의 서비스 경험을 각각 봅니다. 서로 다른 조사의 응답자를 합치거나, 민간 응답자가 없는 자료를 공공·민간 비교로 바꾸지 않습니다.</p>{datasets.every((dataset) => dataset.scope_type === "public_internal") ? <p>여기의 연도별 자료는 서로 다른 주제의 조사입니다. 연도 선택은 해당 조사를 여는 기능이며, 같은 조직의 변화를 추적한 추세는 아닙니다.</p> : null}</section>
    {inYear.map((dataset) => {
      const questions = dataset.questions.filter((question) => (year === "all" || String(question.period) === year) && (dimension === "all" || question.dimension === dimension));
      const usagePending = dataset.publication_status === "pending_usage_confirmation";
      const sample = year === "all" || dataset.years.length === 1 ? dataset.sample : dataset.samples_by_year?.[year];
      const allPeriodSummary = year === "all" || dataset.years.length === 1;
      return <section className="ai-panel supplemental-dataset" key={`${dataset.id}-${year}`}>
        <header><div><span className={`supplemental-status ${dataset.status}`}>{statusLabel[dataset.status]}</span>{" "}<span className="supplemental-scope">{scopeLabel[dataset.scope_type]}</span><h2>{dataset.title}</h2><p>{dataset.source_label} · 표시 연도 {year === "all" ? dataset.years.join(" · ") : year} · {dataset.unit}</p></div>{!usagePending && sample ? <dl><div><dt>{year === "all" && dataset.years.length > 1 ? "연도별 원응답 합계" : "원응답 수"}</dt><dd><NumberOrDash value={sample.raw_n} /></dd></div><div><dt>{year === "all" && dataset.years.length > 1 ? "연도별 분석 응답 합계" : "분석 대상"}</dt><dd><NumberOrDash value={sample.analysis_n} /></dd></div><div><dt>제외</dt><dd><NumberOrDash value={sample.excluded_n} /></dd></div></dl> : null}</header>
        <p className="supplemental-scope-copy">{dataset.scope}</p>
        {dataset.year_coverage_note ? <p className="ai-perception-note">연도 범위: {dataset.year_coverage_note}</p> : null}
        {usagePending ? <p className="ai-model-caution">사용허가 확인을 기다리는 자료입니다. 확인 후 응답 현황을 공개합니다.</p> : <>
          <div className="supplemental-sample-groups">{sample?.groups.map((group) => <span key={group.id}>{group.label} <b><NumberOrDash value={group.n} /></b></span>)}</div>
          {year === "all" && dataset.years.length > 1 ? <p className="ai-perception-note">위 합계는 연도별 응답 수의 합이며 서로 다른 사람의 총수가 아닙니다. 각 그래프는 해당 연도의 분모를 따로 사용합니다.</p> : null}
          <p className="ai-perception-note">{dataset.weight_note}</p>
          {allPeriodSummary && dataset.findings?.length ? <div className="supplemental-findings">{dataset.findings.map((finding) => <article key={finding.title}><h3>{finding.title}</h3><p>{finding.body}</p></article>)}</div> : null}
          {allPeriodSummary ? dataset.transitions?.map((transition) => <TransitionCard key={`${dataset.id}-${transition.label}`} transition={transition} />) : dataset.transitions?.length ? <p className="ai-perception-note">여러 해를 연결한 응답 변화 표는 ‘모든 연도’에서 볼 수 있습니다. 지금은 {year}년 응답만 표시합니다.</p> : null}
          {dataset.action_questions.length ? <div className="supplemental-actions"><strong>실무 점검 질문</strong><ul>{dataset.action_questions.map((question) => <li key={question}>{question}</li>)}</ul></div> : null}
          {questions.length ? <div className="supplemental-question-list">{questions.map((question, index) => <QuestionCard key={question.id} question={question} defaultOpen={index < 3} />)}</div> : <p className="ax-empty-state">선택한 연도·문항 차원에 맞는 공개 문항이 없습니다. 연도 또는 문항 차원을 바꿔 주세요.</p>}
          {dataset.models.map((model) => <AxModelCard key={model.id} model={model} />)}
        </>}
        <details className="supplemental-cautions"><summary>해석할 때 주의할 점</summary><ul>{dataset.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul></details>
        <div className="supplemental-evidence">{dataset.evidence.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer"><strong>{item.label}</strong><span>{item.note}</span></a>)}</div>
      </section>;
    })}
    {inYear.length === 0 ? <p className="ax-empty-state">선택한 연도의 공개 자료가 없습니다.</p> : null}
    {datasets.some((dataset) => dataset.scope_type === "public_internal" && dataset.publication_status === "approved") ? <KipaUsageNotice /> : null}
  </section>;
}
