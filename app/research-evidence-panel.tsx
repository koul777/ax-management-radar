"use client";

import { useMemo, useState } from "react";
import evidence from "./data/research-evidence.json";

type Tier = "all" | "primary_text" | "text_index" | "abstract_index" | "metadata";

const tierLabel = { primary_text: "본문 확인", text_index: "본문 검색 색인", abstract_index: "초록·서지 확인", metadata: "공식자료·목차 확인" };
const statusLabel = { raw_reviewed: "원자료 검토", metadata_only: "메타데이터만", not_fully_audited: "완전 감사 전" };

function activeDataView(datasetName: string) {
  if (datasetName === "WPS") return "?view=ax";
  if (/^KIPA (2015|2019|2020|2022|2023)$/.test(datasetName)) return `?view=public-data&year=${datasetName.slice(-4)}`;
  if (datasetName.startsWith("KLIPS")) return "?view=klips";
  if (datasetName.startsWith("KISDI") || datasetName === "KMP") return "?view=personal-ai";
  if (datasetName.startsWith("NIA")) return "?view=citizen";
  return null;
}

export default function ResearchEvidencePanel() {
  const [dataset, setDataset] = useState("all");
  const [tier, setTier] = useState<Tier>("all");
  const datasets = useMemo(() => Array.from(new Set(evidence.studies.map((study) => study.dataset))), []);
  const filtered = evidence.studies.filter((study) => (dataset === "all" || study.dataset === dataset) && (tier === "all" || study.tier === tier));

  return <section className="ax-dashboard research-evidence" aria-labelledby="research-title">
    <header className="ai-dashboard-header"><div><span>EVIDENCE &amp; DATA SCOPE</span><h1 id="research-title">근거·자료</h1><p>실제 제공 자료를 사용한 연구와 이번 분석 제안을 분리합니다. 논문·보고서의 표현은 확인한 설계 범위를 넘는 인과효과로 읽지 않습니다.</p></div><small>검토 기준 {evidence.updated}</small></header>
    <section className="ai-panel research-reading-key"><h2>이 화면을 읽는 순서</h2><div><article><strong>관측분포</strong><p>누가 어떤 응답을 했는지와 분모를 보여줍니다.</p></article><article><strong>통제 후 연관</strong><p>모형 안에서의 조건부 관계입니다. 한 p값이 같은 효과를 증명하지 않습니다.</p></article><article><strong>인과검증 필요</strong><p>시작점·기저상태·교란·공통 비교범위·추론설계를 별도로 확인해야 합니다.</p></article></div></section>
    <section className="ai-panel research-proposal"><span>OUR PROPOSAL · 발표 연구와 별도</span><h2>현재 대시보드의 해석 위계</h2><p>주 분석은 2023 관측보다 앞선 2021 관리특성과 2023 AI 현재 활용의 <b>조건부 연관</b>입니다. AI 최초 도입 전임은 미보장입니다. AI 사용자 내부의 협의·재교육·전략/가이드라인 응답은 각각의 관측분포로 보며, 일반 관리–혁신 및 AI–혁신은 보조 분석입니다.</p></section>
    <section className="ai-panel"><div className="ai-panel-heading"><div><span>ACTUAL STUDIES USING PROVIDED DATA</span><div><h2>핵심 연구 {evidence.studies.length}편</h2><p>연구마다 X·Y·기제·통제·방법과 확인 수준을 함께 기록했습니다. 펼쳐서 전이 한계와 공개 근거 링크를 확인하세요.</p></div></div></div>
      <div className="research-filters" role="group" aria-label="근거 연구 필터"><label>자료<select value={dataset} onChange={(event) => setDataset(event.target.value)}><option value="all">전체 자료</option>{datasets.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label>근거 수준<select value={tier} onChange={(event) => setTier(event.target.value as Tier)}><option value="all">전체 수준</option><option value="primary_text">본문 확인</option><option value="text_index">본문 검색 색인</option><option value="abstract_index">초록·서지 확인</option><option value="metadata">공식자료·목차 확인</option></select></label><p role="status">{filtered.length} / {evidence.studies.length}편 표시</p></div>
      <div className="research-study-list">{filtered.map((study) => <details key={study.id} className="research-study"><summary><span className={`research-tier ${study.tier}`}>{tierLabel[study.tier as keyof typeof tierLabel]}</span><div><strong>{study.dataset}</strong><h3>{study.title}</h3><p>{study.citation} · {study.unit}</p></div></summary><dl><div><dt>설명변수 X</dt><dd>{study.x}</dd></div><div><dt>결과 Y</dt><dd>{study.y}</dd></div><div><dt>매개·조절·기제</dt><dd>{study.mechanism}</dd></div><div><dt>통제</dt><dd>{study.controls}</dd></div><div><dt>방법</dt><dd>{study.method}</dd></div><div><dt>전이 한계</dt><dd>{study.transferLimit}</dd></div></dl><a href={study.sourceUrl} target="_blank" rel="noreferrer">공개 근거 링크 ↗</a></details>)}</div>
      {filtered.length === 0 ? <p className="ax-empty-state">선택한 조건에 맞는 연구가 없습니다.</p> : null}
    </section>
    <section className="ai-panel"><div className="ai-panel-heading"><div><span>DATA CAPABILITY, NOT RESULTS</span><div><h2>자료별 현재 확인 범위</h2><p>검토 상태는 분석 결과의 개수나 완료를 뜻하지 않습니다. 원시 개인·사업체 응답은 이 화면에 포함하지 않습니다.</p></div></div></div><div className="research-dataset-grid">{evidence.datasets.map((item) => { const view = activeDataView(item.name); return <article key={item.name}><span className={`research-status ${item.status}`}>{statusLabel[item.status as keyof typeof statusLabel]}</span><h3>{item.name}</h3><p>{item.scope}</p><small>{item.note}</small>{view ? <a className="research-data-link" href={view}>자료 화면 열기 →</a> : null}</article>; })}</div></section>
  </section>;
}
