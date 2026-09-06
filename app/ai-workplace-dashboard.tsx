"use client";

import { useMemo, useState } from "react";
import wpsExplorer from "./data/wps-explorer.json";
import wpsAnalysis from "./data/wps-ax-analysis.json";
import AxModelCard, { type AnalysisModel, formatEffect, formatP } from "./ax-model-card";
import { AxCausalResearch, AxManagementActions } from "./ax-management-research";
import YearSelector from "./year-selector";

export type AnalysisView = "overview" | "models" | "governance" | "framework" | "perceptions" | "catalog" | "adoption";
type View = AnalysisView;
type Group = "public" | "private";
type Response = { code: number; label: string; n: number | null; share: number | null; weighted_share: number | null };
type Distribution = {
  source_n: number; eligible_n: number; valid_n: number; informative_n: number; unknown_n: number;
  missing_n: number; excluded_n: number; nonresponse_n: number; invalid_n: number;
  weighted_n: number; weighted_excluded_n: number; weighted_effective_n: number | null;
  responses: Response[]; small_sample?: boolean; suppressed?: boolean;
};
type KeyItem = {
  id: string; label: string; column: string; category: string; category_label: string;
  concept: string; role: string; period: string; note: string; scale_type: string;
  measurement: string; eligibility: string; eligibility_rule: string; usage: string;
  source: { file: string; section: string; columns: string[] };
  categories: Array<{ code: number; label: string; raw_code: number | string | null }>;
  public: Distribution; private: Distribution;
};
type SizeGroup = { id: string; label: string; definition: string };
type Slice = {
  year: number; private_size_id: string; public_n: number; private_n: number;
  public_ai_n: number | null; private_ai_n: number | null; private_size_missing_n?: number;
  weight_column: string; weight_note: string; weighted_available: boolean;
  key_items: KeyItem[]; unavailable_items: Array<{ column: string; label: string; reason: string }>;
};
type ExplorerPayload = {
  years: number[]; year_notes: Array<{ year: number; status: string; reason: string }>;
  size_groups: SizeGroup[]; slices: Slice[]; source: { label: string }; cautions: string[];
};
type WpsModel = AnalysisModel & { year?: number; predictor_year?: number };

const explorer = wpsExplorer as ExplorerPayload;
const models: WpsModel[] = wpsAnalysis.models;
const readinessModels: WpsModel[] = wpsAnalysis.readiness_models;
const meta = wpsAnalysis.meta;
const foundationQuestions: Record<string, { question: string; limit: string }> = {
  ai001: { question: "우리 기관의 AI 활용은 실제 업무에 들어와 있는가?", limit: "도입 여부의 차이입니다. AX 성숙도·성과의 차이를 뜻하지 않습니다." },
  dq1029: { question: "인사부서는 업무 전환을 함께 설계할 변화 파트너인가?", limit: "일반적인 HR 변화역할 평가입니다. 직접 AX 역량 척도가 아닙니다." },
  dq2016: { question: "직원의 업무개선 제안을 전환 설계에 연결할 통로가 있는가?", limit: "제안제도 운영 여부입니다. AI 제안 활용이나 참여의 질은 관측하지 않았습니다." },
  eq1004: { question: "업무 변화에 필요한 학습을 사전에 계획하고 있는가?", limit: "일반 훈련계획 유무입니다. AI 맞춤 훈련·실제 훈련투자액과 다릅니다." },
};

function latestYear(years: number[]) { return String(Math.max(...years)); }
export function selectWpsExplorerSlice(payload: ExplorerPayload, year: string, privateSize: string) {
  const selectedYear = payload.years.includes(Number(year)) ? Number(year) : Number(latestYear(payload.years));
  const selectedSize = payload.size_groups.some((group) => group.id === privateSize) ? privateSize : "all";
  return payload.slices.find((slice) => slice.year === selectedYear && slice.private_size_id === selectedSize) ?? null;
}
function percent(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? "—" : (value * 100).toFixed(digits) + "%";
}
function privateName(group?: SizeGroup) { return !group || group.id === "all" ? "민간 전체" : "민간 " + group.label; }
function isSuppressed(distribution: Distribution) { return Boolean(distribution.suppressed); }
function canShowDistribution(distribution: Distribution, weighted: boolean) {
  const denominator = weighted ? distribution.weighted_n : distribution.valid_n;
  return !isSuppressed(distribution) && denominator > 0 && distribution.responses.every((response) => (weighted ? response.weighted_share : response.share) !== null);
}
function SectionHeading({ kicker, title, note }: { kicker: string; title: string; note: string }) {
  return <div className="ai-panel-heading"><div><span>{kicker}</span><div><h2>{title}</h2><p>{note}</p></div></div></div>;
}
function DescriptiveContext({ slice, sizeGroup }: { slice: Slice; sizeGroup?: SizeGroup }) {
  return <div className="wps-descriptive-context"><strong>비교 기준: {slice.year}년 공공 전체 ↔ {privateName(sizeGroup)}</strong><span>공공은 규모를 맞춘 표본이 아닌 공공 전체입니다. 이 차이를 규모가 조정된 공공·민간 차이로 해석하지 않습니다.</span><small>단위: 조사 사업체(금융·보험업의 기업 단위 예외 주의) · 각 연도 응답표본 · 동일 사업체만 추적한 변화가 아님</small></div>;
}
function SizeComparison({ year, selectedSize, onSize }: { year: number; selectedSize: string; onSize: (size: string) => void }) {
  const reference = explorer.slices.find((slice) => slice.year === year && slice.private_size_id === "all");
  if (!reference) return null;
  const statistic = (slice: Slice, group: Group) => {
    const stats = slice.key_items.find((item) => item.column === "ai001")?.[group];
    if (!stats) return "미조사";
    if (!canShowDistribution(stats, false)) return "응답 부족";
    const yes = stats.responses.find((response) => response.code === 1);
    return percent(yes?.share) + " (" + yes?.n + "/" + stats.valid_n + ")";
  };
  return <section className="ai-panel wps-size-comparison"><SectionHeading kicker="CHOOSE A COMPARISON" title="민간 규모를 나누어 비교하기" note="선택한 연도의 원표본 현황입니다. 규모 구간을 누르면 아래 문항 전체가 그 민간 집단으로 바뀝니다." /><div className="ax-table-scroll"><table><thead><tr><th scope="col">비교 집단</th><th scope="col">사업체 수</th><th scope="col">AI 현재 활용 · 비가중</th></tr></thead><tbody><tr><th scope="row">공공 전체 · 고정 비교 기준</th><td>{reference.public_n.toLocaleString("ko-KR")}</td><td>{statistic(reference, "public")}</td></tr>{explorer.size_groups.map((group) => { const slice = explorer.slices.find((item) => item.year === year && item.private_size_id === group.id); return slice ? <tr key={group.id}><th scope="row"><button type="button" aria-pressed={selectedSize === group.id} onClick={() => onSize(group.id)}>{privateName(group)}</button></th><td>{slice.private_n.toLocaleString("ko-KR")}</td><td>{statistic(slice, "private")}</td></tr> : null; })}</tbody></table></div><p className="ai-perception-note">괄호는 ‘AI 활용 응답수 / AI 문항 유효응답수’입니다. 부문 차이와 규모 구성의 차이를 함께 살펴보기 위한 표입니다. 공공과 민간의 업종·규모를 같게 맞춘 비교나 인과효과는 아닙니다.</p></section>;
}
function WeightToggle({ weighted, onChange, slice }: { weighted: boolean; onChange: (next: boolean) => void; slice: Slice }) {
  return <div className="ai-perception-controls" role="group" aria-label="응답 비율 산출기준"><button type="button" aria-pressed={!weighted} onClick={() => onChange(false)}>원표본 비율</button><button type="button" aria-pressed={weighted} disabled={!slice.weighted_available} onClick={() => onChange(true)}>횡단면 가중 비율</button><span>{weighted ? slice.weight_note : "실제 유효응답 건수 기준 · 모집단 추정치 아님"}{!slice.weighted_available ? " · 이 조건의 유효 가중치 없음" : ""}</span></div>;
}
function DistributionCard({ item, privateLabel, weighted }: { item: KeyItem; privateLabel: string; weighted: boolean }) {
  const groupName = (group: Group) => group === "public" ? "공공 전체" : privateLabel;
  const colorClass = (response: Response, index: number) => response.code === 99 ? "segment-3" : item.scale_type === "ordinal" ? "ax-ordinal-" + index : "ax-category-" + index;
  return <article className="ai-perception-item ax-distribution-card">
    <header><h3>{item.label}</h3><small>{item.column}</small></header><p className="ax-item-note">{item.note}</p>
    <div className="ai-distribution-grid">{(["public", "private"] as Group[]).map((group) => {
      const stats = item[group];
      const visible = canShowDistribution(stats, weighted);
      return <article key={group}><strong className={"ax-group-label " + group}>{groupName(group)}</strong>
        <p className="ai-perception-sample">질문 대상 {stats.eligible_n}곳 · 유효응답 {stats.valid_n}곳 · 결측 {stats.missing_n}곳<br />모름·불명 제외 응답 {stats.informative_n}곳{weighted ? " · 가중치 유효 " + stats.weighted_n + "곳" : ""}</p>
        {stats.valid_n === 0 ? <p className="ai-perception-note">유효응답이 없어 비율을 산출하지 않습니다.</p> : isSuppressed(stats) ? <p className="wps-suppressed">유효응답 5건 미만: 해석의 불안정성을 고려해 응답별 건수·비율을 표시하지 않습니다.</p> : <>
          {stats.valid_n < 30 ? <p className="wps-small-sample">소표본 주의 · 유효응답 30건 미만입니다. 비율 차이를 일반화하지 마세요.</p> : null}
          {visible ? <><div className="ai-stacked-bar" role="img" aria-label={groupName(group) + " " + item.label + ": " + stats.responses.map((response) => response.label + " " + percent(weighted ? response.weighted_share : response.share)).join(", ")}>{stats.responses.map((response, index) => <i aria-hidden="true" className={colorClass(response, index)} key={response.code} style={{ width: percent(weighted ? response.weighted_share : response.share, 5) }} />)}</div><div className="ai-stacked-labels">{stats.responses.map((response, index) => <span key={response.code}><i aria-hidden="true" className={colorClass(response, index)} />{response.label} <b>{percent(weighted ? response.weighted_share : response.share)}</b><small>{response.n === null ? "—" : response.n + "곳"}</small></span>)}</div></> : <p className="ai-perception-note">이 산출기준에 맞는 유효응답이 없습니다.</p>}
        </>}
      </article>;
    })}</div>
  </article>;
}
function DistributionGap({ item, weighted, privateLabel }: { item: KeyItem; weighted: boolean; privateLabel: string }) {
  if (item.scale_type !== "ordinal" && item.scale_type !== "binary") return null;
  const value = (group: Group) => {
    const stats = item[group];
    if (!canShowDistribution(stats, weighted)) return null;
    if (item.scale_type === "ordinal") return stats.responses.reduce((sum, response) => sum + response.code * ((weighted ? response.weighted_share : response.share) ?? 0), 0);
    return stats.responses.find((response) => response.code === 1)?.[weighted ? "weighted_share" : "share"] ?? null;
  };
  const publicValue = value("public"), privateValue = value("private");
  if (publicValue === null || privateValue === null) return <p className="wps-gap-unavailable">응답 부족 또는 소표본 표시 기준으로 공공–민간 격차를 산출·표시하지 않습니다.</p>;
  const ordinal = item.scale_type === "ordinal", gap = publicValue - privateValue;
  const label = item.categories.find((category) => category.code === 1)?.label ?? "예";
  return <div className="ax-distribution-gap"><span>{ordinal ? "평균(1–5점)" : "‘" + label + "’ 비율"} · {weighted ? "가중" : "원표본"}</span><strong>공공 전체 {ordinal ? publicValue.toFixed(2) : percent(publicValue)} · {privateLabel} {ordinal ? privateValue.toFixed(2) : percent(privateValue)}</strong><small>공공−민간 {ordinal ? (gap >= 0 ? "+" : "") + gap.toFixed(2) + "점" : formatEffect(gap, "probability") + "%p"} · 기술통계, 유의성 검정 아님</small></div>;
}
function ItemMetadata({ item, privateLabel }: { item: KeyItem; privateLabel: string }) {
  return <details className="ax-item-metadata"><summary>정확한 측정·질문 대상·결측과 출처</summary><dl>
    <div><dt>개념·분석 역할</dt><dd>{item.concept} · {item.role}</dd></div><div><dt>척도·코딩</dt><dd>{item.measurement}</dd></div>
    <div><dt>기준기간</dt><dd>{item.period}</dd></div><div><dt>질문 대상</dt><dd>{item.eligibility}<br /><code>{item.eligibility_rule}</code></dd></div>
    <div><dt>원자료·설문 근거</dt><dd>{item.source.file} · {item.source.section}<br />{item.source.columns.join(" · ")}</dd></div>
  </dl><div className="ax-item-missing">{(["public", "private"] as Group[]).map((group) => <p key={group}><strong>{group === "public" ? "공공 전체" : privateLabel}</strong> 원표본 {item[group].source_n} · 질문 비대상 {item[group].excluded_n} · 모름/불명 {item[group].unknown_n} · 무응답 {item[group].nonresponse_n} · 허용범위 밖 {item[group].invalid_n} · 가중치 제외 {item[group].weighted_excluded_n}곳<br />가중 유효표본크기(Kish) {item[group].weighted_effective_n === null ? "—" : item[group].weighted_effective_n.toFixed(1)} · 실제 응답 수와 다른 정밀도 지표</p>)}</div></details>;
}
function ItemBlock({ item, weighted, privateLabel }: { item: KeyItem; weighted: boolean; privateLabel: string }) {
  return <><div className="ax-item-role"><span>{item.category_label}</span><small>{item.period}</small></div>
    {item.category === "attributed_perceptions" ? <p className="ai-model-caution">AI 영향 귀인형 인식 · 종속·설명·매개·조절변수로 사용하지 않습니다. 실제 생산성·직무만족·성과 변화가 아닙니다.</p> : null}
    <DistributionCard item={item} weighted={weighted} privateLabel={privateLabel} /><DistributionGap item={item} weighted={weighted} privateLabel={privateLabel} /><ItemMetadata item={item} privateLabel={privateLabel} /></>;
}
function DescriptiveView({ slice, sizeGroup, kind, onView }: { slice: Slice; sizeGroup?: SizeGroup; kind: "overview" | "catalog" | "governance" | "perceptions"; onView: (view: View) => void }) {
  const [weighted, setWeighted] = useState(false);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const privateLabel = privateName(sizeGroup);
  const candidates = slice.key_items.filter((item) => kind === "governance" ? item.category === "ax_operations" : kind === "perceptions" ? item.category === "attributed_perceptions" : true);
  const categories = Array.from(new Map(candidates.map((item) => [item.category, item.category_label])).entries());
  const selected = candidates.filter((item) => (category === "all" || item.category === category) && (item.label + " " + item.column + " " + item.concept).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const foundations = ["ai001", "dq1029", "dq2016", "eq1004"].map((column) => slice.key_items.find((item) => item.column === column)).filter((item): item is KeyItem => Boolean(item));
  const operations = slice.key_items.filter((item) => ["discussion_any", "ai059", "ai061"].includes(item.column));
  const unavailable = slice.unavailable_items;
  return <>
    <section className="ai-panel ai-perception-panel ax-key-catalog">
      <SectionHeading kicker="PUBLIC AX NETWORK" title={kind === "overview" ? "공공과 민간의 차이, 도입과 조직관리 기반부터" : kind === "catalog" ? "핵심 문항 " + slice.key_items.length + "개 · 선택 연도 전체 비교" : kind === "governance" ? "공공과 민간은 AX를 어떻게 관리하는가" : "AI 영향에 대한 응답 분포"} note="연도·민간 규모를 선택하면 해당 조건의 문항·표본·응답 현황이 함께 바뀝니다." />
      <DescriptiveContext slice={slice} sizeGroup={sizeGroup} /><WeightToggle weighted={weighted} onChange={setWeighted} slice={slice} />
      <p className="ai-perception-note">모름·불명은 문항 정의에 따라 막대와 분모에 포함합니다. 질문 비대상·결측을 ‘아니요’로 바꾸지 않습니다. 빈도가 높다는 것과 좋은 관리라는 판단도 다릅니다.</p>
      {kind === "catalog" ? <><div className="ax-filter-row" role="group" aria-label="핵심 문항 범주 선택"><button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>전체 {candidates.length}</button>{categories.map(([id, label]) => <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)}>{label}</button>)}</div><label className="ax-catalog-search">문항·변수코드 검색<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="예: 훈련, 협의, dq1029" /></label><p className="ai-perception-note" role="status">{selected.length} / {slice.key_items.length}개 문항 표시</p></> : null}
      {kind === "overview" ? <div className="ax-foundation-grid">{foundations.map((item) => <article key={item.id} className="ax-foundation-card"><div className="ax-public-question"><span>공공 AX 실무 질문</span><h3>{foundationQuestions[item.column].question}</h3></div><ItemBlock item={item} weighted={weighted} privateLabel={privateLabel} /><p className="ax-measurement-guard">{foundationQuestions[item.column].limit}</p></article>)}</div> : <div className="ai-perception-list">{selected.map((item) => <section key={item.id} className={"ax-key-item " + (item.category === "attributed_perceptions" ? "perception-only" : "")}><ItemBlock item={item} weighted={weighted} privateLabel={privateLabel} /></section>)}</div>}
      {kind !== "overview" && selected.length === 0 ? <p className="ax-empty-state">{candidates.length ? "검색어·범주에 맞는 문항이 없습니다. 필터를 바꿔 주세요." : "이 연도에는 해당 문항의 공개 집계가 없습니다. 미조사와 문항 검증 전 상태는 아래 근거를 확인하세요. 0을 뜻하지 않습니다."}</p> : null}
      {unavailable.length ? <details className="wps-unavailable-items"><summary>선택 연도에 제공하지 않는 문항과 이유 ({unavailable.length})</summary><ul>{unavailable.map((item) => <li key={item.column}><strong>{item.label}</strong> ({item.column}): {item.reason}</li>)}</ul></details> : null}
      {kind === "overview" ? <button className="ax-text-button" type="button" onClick={() => onView("catalog")}>선택 연도 핵심 {slice.key_items.length}개 문항 전체 비교 →</button> : null}
    </section>
    {kind === "overview" ? <>
      {operations.length ? <section className="ai-panel ai-perception-panel"><SectionHeading kicker="OPERATING AX" title="도입한 뒤에는 어떻게 운영하고 있는가" note="AI 활용 사업체의 협의·가이드라인·재교육 현황입니다. 문항별 실제 질문 대상이 다릅니다." /><div className="ax-operations-question"><strong>공공 AX 실무 질문</strong><p>직원과 무엇을 논의하고, 그 논의가 운영 규칙과 재교육으로 연결되고 있는가?</p><span>협의의 효과·참여의 질·규칙의 적절성을 입증하는 결과는 아닙니다.</span></div><div className="ai-perception-list">{operations.map((item) => <section className="ax-key-item" key={item.id}><ItemBlock item={item} weighted={weighted} privateLabel={privateLabel} /></section>)}</div></section> : <section className="ax-reading-callout"><strong>직접 AI 운영 문항은 2023년에만 있습니다.</strong><p>이전 연도의 일반 관리 여건은 볼 수 있지만, 과거 AI 활용·협의·재교육 여부를 0으로 채워 비교하지 않습니다.</p></section>}
      <AxManagementActions /><div className="ax-deeper-links"><button type="button" onClick={() => onView("adoption")}><strong>관리조건과 AI 활용의 관계</strong><span>2021 관리 → 2023 AI · 고정된 시차 회귀와 한계 →</span></button><button type="button" onClick={() => onView("framework")}><strong>문헌 근거와 인과관계 검토</strong><span>선행연구의 변수·통제·추가로 필요한 관측 →</span></button></div>
    </> : null}
  </>;
}
function FixedPeriodNotice({ view }: { view: View }) {
  return <section className="wps-fixed-period"><strong>{view === "framework" ? "분석틀·선행연구의 측정기간은 근거별로 다릅니다." : "현황의 연도·민간 규모 선택을 회귀에 적용하지 않습니다."}</strong><span>{view === "models" ? "혁신 보조 분석은 2023년입니다." : view === "adoption" ? "주 분석은 2021 관리 → 2023 AI이며, 2023 동시점 보조모형은 아래에서 별도로 구분합니다." : "문헌의 연도와 우리 자료의 측정기간을 구분해 표시합니다."} 모형을 새로 추정하거나 필터링한 결과가 아닙니다.</span></section>;
}
function ModelExplorer({ modelList, purpose }: { modelList: WpsModel[]; purpose: "adoption" | "innovation" }) {
  const [selected, setSelected] = useState(modelList[0]?.id ?? "");
  const model = modelList.find((item) => item.id === selected) ?? modelList[0];
  const probabilityContrasts = model?.contrasts.some((term) => term.scale === "standardized_probability_change");
  const period = purpose === "adoption" ? String(model?.predictor_year ?? 2021) + " 관리 → " + String(model?.year ?? 2023) + " AI 활용" : "2023년 AI 활용·혁신";
  return <>
    <section className="ai-panel ax-model-picker"><SectionHeading kicker="MULTIPLE REGRESSION" title={purpose === "adoption" ? "조직관리 조건과 이후 AI 활용의 관계" : "AI–혁신 관계의 공공·민간 차이: 보조 분석"} note="표시된 통제변수와 불확실성을 함께 읽습니다. 인과효과가 아닙니다." />
      <label htmlFor={"model-select-" + purpose}>분석모형 선택 · 검토 모형 {modelList.length}개</label><select id={"model-select-" + purpose} value={model?.id ?? ""} onChange={(event) => setSelected(event.target.value)}>{modelList.map((item) => <option key={item.id} value={item.id}>{item.title} · n={item.n.toLocaleString("ko-KR")}{item.status === "withheld" ? " · 수치 보류" : ""}</option>)}</select>
      <p className="wps-model-period">선택 모형 측정기간: {period}</p>
      <p>{model?.status === "withheld" ? "이 보조 로짓은 준완전분리로 계수와 확률 대비를 게시하지 않습니다. 결과가 비어 있는 것은 효과가 0이라는 뜻이 아닙니다." : probabilityContrasts ? "표준화 확률 대비만 %p로 제시합니다. 로짓 원계수는 확률 차이가 아닙니다." : model?.unit === "probability" ? "계수는 확률 차이(%p)이며 오즈비가 아닙니다." : "계수는 결과의 원척도 점수 차이입니다."} 신뢰구간이 0을 포함하는 결과는 인과효과나 집단의 동등성을 입증하지 않습니다.</p>
    </section>
    {purpose === "adoption" ? <section className="ax-reading-callout"><strong>측정에 시차를 둔 모형도 신규 AI 도입의 인과효과는 아닙니다.</strong><p>{model?.predictor_year === 2023 ? "선택한 동시점 모형은 2023년 관리조건과 AI 활용을 함께 측정했습니다. 역인과·동시결정 가능성이 있습니다." : "2023 관측보다 앞선 2021 관리특성; AI 최초 도입 전임은 미보장입니다. 직접 측정한 2021 AI 기저상태가 없어 신규 도입과 지속 활용을 분리하지 못합니다."}</p></section> : <section className="ax-reading-callout"><strong>패널자료와 AX 패널측정은 다릅니다.</strong><p>직접 AI·AX 관리문항은 2023년에만 관측됩니다. 이 혁신 보조 분석은 2023 횡단면 다중회귀이며, 혁신은 2023년 한 해의 결과, AI는 2023년 말 활용 상태여서 선후관계가 확정되지 않습니다.</p></section>}
    {model ? <AxModelCard model={model} /> : <p className="ai-model-caution">표시할 모형이 없습니다.</p>}
  </>;
}
function InnovationSupplement() {
  const main = models.find((model) => model.id === "process_baseline_ols");
  const difference = main?.contrasts.find((term) => term.id === "public_private_difference");
  const privateWeighted = models.find((model) => model.id === "process_baseline_wls")?.contrasts.find((term) => term.id === "ai_private");
  return <><section className="ax-reading-callout"><strong>혁신은 보조 결과이며 AX 성공의 대체 지표가 아닙니다.</strong><p>공정혁신에서 AI 연관의 공공−민간 차이는 {formatEffect(difference?.beta ?? null, "probability")}%p, 95% 구간 [{formatEffect(difference?.ci_low ?? null, "probability", false)}, {formatEffect(difference?.ci_high ?? null, "probability", false)}], p {formatP(difference?.p ?? null)}입니다. 넓은 구간은 동등성의 증거가 아닙니다. 가중 민감도에서는 민간의 AI–혁신 연관도 {formatEffect(privateWeighted?.beta ?? null, "probability")}%p (p {formatP(privateWeighted?.p ?? null)})로 달라집니다.</p></section><ModelExplorer modelList={models} purpose="innovation" /><section className="ai-panel ax-references"><SectionHeading kicker="EVIDENCE" title="선행연구와 실제 모형의 연결" note="설명변수·종속변수·설계의 차이를 남기고, 같은 연구를 재현한 것으로 주장하지 않습니다." /><div className="ai-literature-grid">{wpsAnalysis.references.map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer"><strong>{reference.title}</strong><p>{reference.note}</p><small>원문·공식 연구정보 ↗</small></a>)}</div></section></>;
}

export default function AiWorkplaceDashboard({ initialView = "overview", onViewChange, initialYear, initialPrivateSize }: { initialView?: View; onViewChange?: (view: View) => void; initialYear?: string; initialPrivateSize?: string }) {
  const initialYearValid = !initialYear || explorer.years.includes(Number(initialYear));
  const initialSizeValid = !initialPrivateSize || explorer.size_groups.some((group) => group.id === initialPrivateSize);
  const [view, setView] = useState<View>(initialView);
  const [year, setYear] = useState(initialYearValid && initialYear ? initialYear : latestYear(explorer.years));
  const [privateSize, setPrivateSize] = useState(initialSizeValid && initialPrivateSize ? initialPrivateSize : "all");
  const [invalidNotice, setInvalidNotice] = useState(!initialYearValid || !initialSizeValid);
  const slice = useMemo(() => selectWpsExplorerSlice(explorer, year, privateSize), [year, privateSize]);
  const sizeGroup = explorer.size_groups.find((group) => group.id === privateSize);
  const descriptive = view === "overview" || view === "catalog" || view === "governance" || view === "perceptions";
  function updateExplorer(nextYear: string, nextSize: string) {
    setYear(nextYear); setPrivateSize(nextSize); setInvalidNotice(false);
    const url = new URL(window.location.href); url.searchParams.set("year", nextYear); url.searchParams.set("private_size", nextSize); window.history.replaceState(null, "", url);
  }
  function selectView(nextView: View) {
    setView(nextView); onViewChange?.(nextView);
    const url = new URL(window.location.href); url.searchParams.set("view", "ax"); url.searchParams.set("section", nextView); window.history.replaceState(null, "", url); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const tabs: Array<{ id: View; label: string; note: string }> = [
    { id: "overview", label: "공공 AX 조직관리", note: "연도·규모별 현황과 실무 질문" },
    { id: "catalog", label: "핵심 문항 전체 비교", note: "모든 문항·범주·분모" },
    { id: "governance", label: "AX 운영", note: "협의·규칙·인력 대응" },
    { id: "perceptions", label: "AI 영향 인식", note: "막대그래프 전용" },
    { id: "adoption", label: "관리 → AI 활용", note: "시차 회귀·부문별 차이" },
    { id: "models", label: "혁신 보조 결과", note: "2023 단면 회귀" },
    { id: "framework", label: "분석틀·선행연구", note: "통제변수와 인과관계 검토" },
  ];
  return <div className="ai-dashboard ax-dashboard wps-study">
    <header className="ai-dashboard-header"><div><p>PUBLIC AX NETWORK · WPS EVIDENCE</p><h1>AX를 위한 조직관리, 공공과 민간은 무엇이 다른가</h1><span>도입·운영의 차이를 함께 보고, 조직에서 점검할 질문을 찾습니다.</span></div>{descriptive && slice ? <aside><span>{slice.year} 원표본 · {privateName(sizeGroup)}</span><strong>{(slice.public_n + slice.private_n).toLocaleString("ko-KR")}개 사업체</strong><small>공공 {slice.public_n.toLocaleString("ko-KR")} · 민간 {slice.private_n.toLocaleString("ko-KR")}</small><small>{slice.public_ai_n === null ? "직접 AI 문항 미조사" : "AI 활용: 공공 " + slice.public_ai_n + " · 민간 " + slice.private_ai_n}</small></aside> : null}</header>
    <section className="ai-scope-banner"><strong>비교 범위</strong><span>{descriptive ? "WPS " + year + "년 응답표본 · sep=5 공공, sep=1~4 민간" : "각 모형·문헌에 표시된 측정기간과 표본"}</span><small>민간 규모는 기업의 법정 중소·중견·대기업 분류가 아니라 해당 사업체의 전체 근로자 수 기준입니다.</small></section>
    {descriptive ? <section className="wps-explorer-controls" aria-label="WPS 연도·민간 규모 선택"><YearSelector id="wps-year" years={explorer.years} value={year} onChange={(nextYear) => updateExplorer(nextYear, privateSize)} note="확인된 해당 연도의 문항만 표시합니다." /><label>민간 근로자 수 구간<select id="wps-private-size" value={privateSize} onChange={(event) => updateExplorer(year, event.target.value)}>{explorer.size_groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label><p>{sizeGroup?.definition}</p>{invalidNotice ? <span role="status">요청한 연도 또는 규모 구간을 사용할 수 없어, 지원되지 않는 선택만 최신 연도 또는 민간 전체로 바꿨습니다.</span> : null}</section> : <FixedPeriodNotice view={view} />}
    {descriptive ? <p className="wps-year-note">기업 구분 변수도 확인했습니다. 2015~2023년의 SB는 ‘중소기업 / 중소기업 아님’ 두 범주이며, 중견기업과 대기업을 나누는 변수는 아닙니다. 이 화면의 세 규모 구간은 근로자 수로 구분합니다.</p> : null}
    <div className="ai-view-tabs" role="tablist" aria-label="WPS 분석 보기">{tabs.map((tab, index) => <button key={tab.id} type="button" id={"wps-tab-" + tab.id} aria-controls="wps-view" aria-selected={view === tab.id} className={view === tab.id ? "active" : ""} role="tab" onClick={() => selectView(tab.id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{tab.label}</strong><small>{tab.note}</small></button>)}</div>
    {view === "overview" ? <SizeComparison year={Number(year)} selectedSize={privateSize} onSize={(size) => updateExplorer(year, size)} /> : null}
    <div id="wps-view" role="tabpanel" aria-labelledby={"wps-tab-" + view}>
      {descriptive && slice ? <DescriptiveView key={year + "-" + privateSize + "-" + view} slice={slice} sizeGroup={sizeGroup} kind={view} onView={selectView} /> : null}
      {view === "adoption" ? <ModelExplorer modelList={readinessModels} purpose="adoption" /> : view === "models" ? <InnovationSupplement /> : view === "framework" ? <AxCausalResearch /> : null}
      {descriptive && !slice ? <p className="ax-empty-state">선택한 조건의 집계가 없습니다.</p> : null}
    </div>
    {descriptive ? <p className="wps-year-note">{explorer.year_notes.find((note) => note.year === Number(year))?.reason}</p> : null}
    <details className="ai-method-details ax-method-details"><summary>자료·측정·표본의 한계 전체 보기</summary><div>{descriptive ? explorer.cautions.map((caution) => <p key={caution}>{caution}</p>) : meta.cautions.map((caution) => <p key={caution}>{caution}</p>)}<p>출처: {explorer.source.label}</p></div></details>
    <footer className="ai-dashboard-footer"><strong>ORGANIZATION & INNOVATION RESEARCH</strong><span>사업체패널 W10 v10 · 통합 코드북·설문지 v1.91 · 분석일 {meta.generated_at.slice(0, 10)}</span></footer>
  </div>;
}
