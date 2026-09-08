"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import payload from "./data/public-institution-innovation.json";

type Source = { id: string; title: string; provider: string; referencePeriod: string; population: string; verificationStatus: string; accessStatus: string; licenseNote: string; limits: string; url: string; resourceUrl: string | null };
type AgencyRecord = { sourceId: string; name: string; category: string; subtype: string | null; evaluationYear: number; grade: string; status: string; sourcePage: number };
type LocalRecord = { sourceRowNumber: number; name: string; evaluationYear: number; performanceYear: number; grade: string; status: "graded" | "not_applicable" | "other"; nameCollision: boolean; notes: string };
type Count = { label: string; count: number };
type Observation = { id: string; sourceId: string; metricId: string; metric: string; referencePeriod: string; year: number | null; group: string; value: number | null; unit: string; valueStatus: "observed" | "not_asked"; aggregationLevel: string; denominator: string; sourceLocation: string; notes: string };
type Backlog = { sourceId: string; priority: string; nextAction: string; accessStatus: string; url: string; limits: string };
type PublicPayload = {
  scope: string; sources: Record<string, Source>;
  agency: { distributions: Array<{ sourceId: string; evaluationYear: number; graded: Count[]; excluded: Count[]; categoryCounts: Count[] }>; records: AgencyRecord[] };
  localEnterprise: { distributions: Array<{ evaluationYear: number; performanceYear: number; graded: Count[]; notApplicable: Count[]; other: Count[]; displayRows: number }>; records: LocalRecord[] };
  observations: Observation[]; collectionBacklog: Backlog[];
};
const data = payload as PublicPayload;

const agencySourceIds = ["D01", "D02", "D03"];
const aiSourceIds = ["D05", "D06", "D07", "D10"];
const benchmarkSourceIds = ["D09", "D14", "D15", "D32", "D33", "D35"];
const gradeClass: Record<string, string> = { "매우우수": "excellent", "우수": "good", "보통": "middle", "미흡": "low", "매우미흡": "poor", "가": "excellent", "나": "good", "다": "middle", "라": "low", "마": "poor" };

function formatValue(row: Observation) {
  if (row.value === null) return row.valueStatus === "not_asked" ? "미조사" : "—";
  const value = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(row.value);
  const unit = { percent: "%", institutions: "개 기관", persons: "명", KRW_100million: "억원", cases: "건", index_0_100: "점" }[row.unit] ?? row.unit;
  return `${value}${unit}`;
}

function SourceLink({ sourceId }: { sourceId: string }) {
  const source = data.sources[sourceId];
  return source ? <a className="public-source-link" href={source.url} target="_blank" rel="noreferrer">{sourceId} · 원문</a> : null;
}

function Distribution({ rows, label }: { rows: Count[]; label: string }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (rows.length === 0) return <p className="public-no-distribution" aria-label={`${label}: 없음, 0건`}>없음 · 0건</p>;
  return <div className="public-distribution" aria-label={label}>{rows.map((row) => <div key={row.label} className="public-distribution-row"><span>{row.label}</span><i aria-hidden="true"><b className={gradeClass[row.label] ?? "neutral"} style={{ width: `${total ? (row.count / total) * 100 : 0}%` }} /></i><strong>{row.count.toLocaleString("ko-KR")}</strong></div>)}</div>;
}

function SourceContext({ sourceId }: { sourceId: string }) {
  const source = data.sources[sourceId];
  return <dl className="public-source-context"><div><dt>출처·기간</dt><dd><a href={source.url} target="_blank" rel="noreferrer">{source.provider} · {source.referencePeriod}</a></dd></div><div><dt>대상·집계</dt><dd>{source.population}</dd></div><div><dt>확인 상태</dt><dd>{source.verificationStatus} · {source.accessStatus}</dd></div><div><dt>이용조건</dt><dd>{source.licenseNote}</dd></div><div><dt>한계</dt><dd>{source.limits}</dd></div></dl>;
}

export default function PublicInstitutionDashboard() {
  const [agencySourceId, setAgencySourceId] = useState("D01");
  const [agencyQuery, setAgencyQuery] = useState("");
  const [localYear, setLocalYear] = useState(2025);
  const [localQuery, setLocalQuery] = useState("");
  const [aiSourceId, setAiSourceId] = useState("D05");
  const agencyDistribution = data.agency.distributions.find((item) => item.sourceId === agencySourceId)!;
  const localDistribution = data.localEnterprise.distributions.find((item) => item.evaluationYear === localYear)!;
  const agencyMatches = useMemo(() => data.agency.records.filter((item) => item.sourceId === agencySourceId && item.name.includes(agencyQuery.trim())).slice(0, 100), [agencySourceId, agencyQuery]);
  const localMatches = useMemo(() => data.localEnterprise.records.filter((item) => item.evaluationYear === localYear && item.name.includes(localQuery.trim())).slice(0, 100), [localYear, localQuery]);
  const aiRows = useMemo(() => data.observations.filter((item) => item.sourceId === aiSourceId), [aiSourceId]);
  const benchmarks = useMemo(() => data.observations.filter((item) => benchmarkSourceIds.includes(item.sourceId)), []);

  return <section className="public-institution-dashboard" aria-labelledby="public-institution-title">
    <header className="public-dashboard-header public-dashboard-header-compact"><div><p>PUBLIC INSTITUTIONS · VERIFIED AGGREGATES</p><h1 id="public-institution-title">공공기관 AX 조직관리</h1><p>기관 공시와 공개 집계로 기준선·운영여건·점검 질문을 확인합니다.</p></div><div className="public-header-badges"><strong>14</strong><span>값이 검증된 출처</span><small>이용조건은 출처별 확인</small></div></header>
    <aside className="public-scope-note"><strong>해석 경계</strong><span>기관 공시 기록과 공개 집계만 수록합니다. 기관순위·통합점수·인과효과를 만들지 않으며, 기관평가 등급은 원문 범주 그대로 봅니다.</span></aside>
    <p className="public-takeaway"><strong>한 줄 결론</strong> 공공 AX는 ‘도입 여부’ 하나가 아니라 전담 책임·운영 사례·사용자 지원을 기관 내부 기준선으로 나눠 점검하는 출발점입니다.</p>

    <section className="public-top-summary" aria-labelledby="public-summary-title"><header><p>WHAT TO KNOW</p><h2 id="public-summary-title">먼저 확인할 세 가지</h2><span>출처별 사실과 적용 범위를 분리한 관리 점검 단서입니다.</span></header><div>
      <article><span>01 · D05 · 활용 현황</span><h3><b>250개 기관 · 1,062건</b></h3><p><strong>사실</strong> 2026-06-30 전체 공시 집계의 AI 활용사례 보유기관과 누적 사례입니다.</p><p><strong>기간·대상</strong> 전체 대상기관 분모가 없어 도입률·기관 성과로 해석하지 않습니다.</p><p className="public-card-action"><strong>관리 점검</strong> 우리 기관의 활용사례·책임부서·확인 기준을 같은 형식으로 기록합니다.</p><SourceLink sourceId="D05" /></article>
      <article><span>02 · D06 · 운영 인력</span><h3><b>겸직 65.5% · 전담 15.9%</b></h3><p><strong>사실</strong> 2022년 AI 도입기관 220개 중 겸직 담당인력 운영 비율과 같은 분모의 전담 운영 보조값입니다.</p><p><strong>기간·대상</strong> 직원 비율·현재 현황·인과효과를 뜻하지 않습니다.</p><p className="public-card-action"><strong>관리 점검</strong> 전담·겸직 역할, 의사결정권, 업무시간을 내부 운영표에 분리해 확인합니다.</p><SourceLink sourceId="D06" /></article>
      <article><span>03 · D10 · 사용자 지원</span><h3><b>조직 대응 없음 32.1%</b></h3><p><strong>사실</strong> 2025년 AI 사용자 305명 중 조직 차원의 대응이 없다고 답한 비율입니다.</p><p><strong>기간·대상</strong> <b>AI 사용자 참고조사 · 공공기관 전용 결과 아님</b></p><p className="public-card-action"><strong>관리 점검</strong> 실제 사용자에게 필요한 교육·지원·장애 대응 창구를 내부적으로 확인합니다.</p><SourceLink sourceId="D10" /></article>
    </div></section>

    <section className="public-priority-flow" aria-labelledby="priority-flow-title"><header><p>WHAT TO DO</p><h2 id="priority-flow-title">공공 AX 조직관리 우선순위</h2><span>효과 검증 목록이 아니라, 내부 기준값을 세우고 다음 점검을 정하는 3단계 흐름입니다.</span></header><ol><li><span>01</span><div><h3>기관 기준선을 분리해 기록</h3><p>해당 기관의 원문 등급·평가연도·실적연도를 먼저 확인하고, 서로 다른 평가를 합산하지 않습니다.</p></div></li><li><span>02</span><div><h3>AI 운영 기반과 도입 경로를 따로 점검</h3><p>전담조직·인력·예산·사례(D05), 도입 여건(D06), 계약 건수(D07)를 내부 운영기록과 나란히 확인합니다.</p></div></li><li><span>03</span><div><h3>사용자 지원과 일하는 방식은 작은 점검으로 확인</h3><p>AI 사용자 지원·장애(D10)와 제안·회의·문화 맥락(D09·D14 등)을 참고하되, 자체 기준값과 시범 결과를 별도 기록합니다.</p></div></li></ol></section>

    <details className="public-detail"><summary><span><b>상세 자료</b>기관별 평가·지방공기업 조회</span><small>D01–D04 · 기관명 검색과 연도 선택</small></summary><div className="public-detail-content">
    <section className="public-section" aria-labelledby="agency-title">
      <div className="public-section-heading"><div><p>01 · D01–D03</p><h2 id="agency-title">기관별 평가 등급과 기관 찾기</h2><span>데이터기반행정·공공데이터 제공·고객만족도는 서로 별도 평가입니다.</span></div><SourceLink sourceId={agencySourceId} /></div>
      <div className="public-controls" role="group" aria-label="기관별 평가 조회 조건"><label>평가<select value={agencySourceId} onChange={(event) => { setAgencySourceId(event.target.value); setAgencyQuery(""); }}>{agencySourceIds.map((id) => <option key={id} value={id}>{id} · {data.sources[id].title}</option>)}</select></label><label>기관명 찾기<input value={agencyQuery} onChange={(event) => setAgencyQuery(event.target.value)} placeholder="기관명 일부 입력" /></label></div>
      <SourceContext sourceId={agencySourceId} />
      <div className="public-split-grid"><article><h3>유효 등급 분포 · {agencyDistribution.evaluationYear}</h3><Distribution label="유효 등급 분포" rows={agencyDistribution.graded} />{agencyDistribution.excluded.length ? <p className="public-caution">평가제외 {agencyDistribution.excluded.map((item) => item.count).reduce((a, b) => a + b, 0)}개는 등급 분포에서 제외했습니다.</p> : null}</article><article><h3>원문 기관유형 행수</h3><Distribution label="기관 유형별 행수" rows={agencyDistribution.categoryCounts} /></article></div>
      <div className="public-table-wrap"><table className="public-table"><caption>원문 기관명으로 찾은 결과 · 최대 100행</caption><thead><tr><th scope="col">기관명</th><th scope="col">원문 유형</th><th scope="col">등급</th><th scope="col">원문 쪽</th></tr></thead><tbody>{agencyMatches.map((row) => <tr key={`${row.sourceId}-${row.name}`}><th scope="row">{row.name}</th><td>{row.category}{row.subtype ? ` · ${row.subtype}` : ""}</td><td><span className={`public-grade ${gradeClass[row.grade] ?? "neutral"}`}>{row.grade}</span></td><td>{row.sourcePage}</td></tr>)}</tbody></table>{agencyMatches.length === 0 ? <p className="public-empty">일치하는 기관이 없습니다.</p> : null}</div>
    </section>

    <section className="public-section" aria-labelledby="local-title">
      <div className="public-section-heading"><div><p>02 · D04</p><h2 id="local-title">지방공기업 경영평가 · 2021–2025</h2><span>평가연도 {localDistribution.evaluationYear} · 실적연도 {localDistribution.performanceYear}. `대상아님`과 `기타`는 유효 등급에서 별도 보존합니다.</span></div><SourceLink sourceId="D04" /></div>
      <div className="public-controls" role="group" aria-label="지방공기업 평가 조회 조건"><label>평가연도<select value={localYear} onChange={(event) => setLocalYear(Number(event.target.value))}>{data.localEnterprise.distributions.map((item) => <option key={item.evaluationYear} value={item.evaluationYear}>{item.evaluationYear} 평가 · {item.performanceYear} 실적</option>)}</select></label><label>기관명 찾기<input value={localQuery} onChange={(event) => setLocalQuery(event.target.value)} placeholder="기관명 일부 입력" /></label></div>
      <SourceContext sourceId="D04" />
      <div className="public-triple-grid"><article><h3>유효 등급</h3><Distribution label="지방공기업 유효 등급" rows={localDistribution.graded} /></article><article><h3>대상아님</h3><Distribution label="지방공기업 대상아님" rows={localDistribution.notApplicable} /></article><article><h3>기타</h3><Distribution label="지방공기업 기타" rows={localDistribution.other} /></article></div>
      <p className="public-caution">공시 화면 {localDistribution.displayRows}행을 보존했습니다. 동명 기관은 기관명만으로 합치지 않으며, 아래의 원본 행번호로 식별합니다.</p>
      <div className="public-table-wrap"><table className="public-table"><caption>원문 행번호 안전 조회 결과 · 최대 100행</caption><thead><tr><th scope="col">원본 행번호</th><th scope="col">기관명</th><th scope="col">등급</th><th scope="col">상태</th><th scope="col">주의</th></tr></thead><tbody>{localMatches.map((row) => <tr key={`${row.evaluationYear}-${row.sourceRowNumber}`}><td>{row.sourceRowNumber}</td><th scope="row">{row.name}</th><td><span className={`public-grade ${gradeClass[row.grade] ?? "neutral"}`}>{row.grade}</span></td><td>{row.status === "graded" ? "유효 등급" : row.status === "not_applicable" ? "대상아님" : "기타"}</td><td>{row.nameCollision ? `동명 기관 · ${row.notes}` : row.notes || "—"}</td></tr>)}</tbody></table>{localMatches.length === 0 ? <p className="public-empty">일치하는 기관이 없습니다.</p> : null}</div>
    </section>
    </div></details>

    <details className="public-detail"><summary><span><b>상세 자료</b>공공 AI 입력·도입·조달·지원 관측</span><small>D05–D07 · D10 · 기간·분모·주석</small></summary><div className="public-detail-content"><section className="public-section" aria-labelledby="ai-title">
      <div className="public-section-heading"><div><p>03 · D05–D07 · D10</p><h2 id="ai-title">공공 AI 입력·도입·조달·지원 관측</h2><span>각 수치는 출처별 모집단과 문항 분모에만 해당합니다. D07은 AI를 포함한 계약 건수·비율이며 계약금액 또는 직원 AI 사용률이 아닙니다.</span></div><SourceLink sourceId={aiSourceId} /></div>
      <div className="public-controls" role="group" aria-label="공공 AI 관측 출처 선택"><label>출처<select value={aiSourceId} onChange={(event) => setAiSourceId(event.target.value)}>{aiSourceIds.map((id) => <option key={id} value={id}>{id} · {data.sources[id].title}</option>)}</select></label></div>
      <SourceContext sourceId={aiSourceId} />
      <div className="public-table-wrap"><table className="public-table public-observation-table"><caption>수치마다 기준기간·집계 수준·분모를 함께 표시</caption><thead><tr><th scope="col">지표</th><th scope="col">집단</th><th scope="col">값</th><th scope="col">기준기간</th><th scope="col">분모·집계 수준</th><th scope="col">원문 위치·주석</th></tr></thead><tbody>{aiRows.map((row) => <tr key={row.id}><th scope="row">{row.metric}</th><td>{row.group}</td><td>{formatValue(row)}</td><td>{row.referencePeriod}</td><td>{row.denominator}<small>{row.aggregationLevel}</small></td><td>{row.sourceLocation}{row.notes ? <small>{row.notes}</small> : null}</td></tr>)}</tbody></table></div>
    </section></div></details>

    <details className="public-detail"><summary><span><b>상세 자료</b>혁신·일터 맥락과 출처 상태</span><small>D09 · D14 · D15 · D32 · D33 · D35</small></summary><div className="public-detail-content"><section className="public-section" aria-labelledby="benchmark-title">
      <div className="public-section-heading"><div><p>04 · D09 · D14 · D15 · D32 · D33 · D35</p><h2 id="benchmark-title">혁신·일터 맥락 벤치마크</h2><span>사업체·여성관리자 사업체·서비스업 기업·해외 공무원 응답은 관찰 단위와 모집단이 달라, 합산·순위·직접 성과비교를 하지 않습니다.</span></div></div>
      <div className="public-benchmark-grid">{benchmarkSourceIds.map((sourceId) => <article key={sourceId}><h3>{sourceId} · {data.sources[sourceId].title}</h3><p>{data.sources[sourceId].population}</p><SourceLink sourceId={sourceId} /><p className="public-benchmark-limit">{data.sources[sourceId].limits}</p></article>)}</div>
      <div className="public-table-wrap"><table className="public-table public-observation-table"><caption>출처 내부 수치 · 교차출처 비교 또는 통합 없음</caption><thead><tr><th scope="col">출처</th><th scope="col">지표·집단</th><th scope="col">값</th><th scope="col">기준기간</th><th scope="col">분모·집계 수준</th></tr></thead><tbody>{benchmarks.map((row) => <tr key={row.id}><td>{row.sourceId}</td><th scope="row">{row.metric}<small>{row.group}</small></th><td>{formatValue(row)}</td><td>{row.referencePeriod}</td><td>{row.denominator}<small>{row.aggregationLevel}</small></td></tr>)}</tbody></table></div>
    </section>

    <section className="public-section" aria-labelledby="evidence-title">
      <div className="public-section-heading"><div><p>05 · EVIDENCE STATUS</p><h2 id="evidence-title">검증된 출처와 수집 대기 목록</h2><span>수치가 실제로 수록된 출처와, 파일·원자료를 아직 확보하지 않은 후보를 구분합니다.</span></div></div>
      <div className="public-evidence-grid"><article><h3>현재 수록·검증된 14개 출처</h3><ul>{Object.values(data.sources).map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.id} · {source.title}</a><span>{source.verificationStatus}</span></li>)}</ul></article><article><h3>별도 응답자 수준 근거 화면</h3><p>아래 화면은 이미 있는 KIPA·KLIPS 응답자 집계로, 이 페이지의 기관 공시·공개 통계와 결합하지 않습니다.</p><div className="public-internal-links"><Link href="/?view=public-data">KIPA 공공조직·인사 데이터 화면</Link><Link href="/?view=klips">KLIPS 근로자 직장경험 화면</Link></div></article></div>
      <details className="public-backlog"><summary>수집 대기 · 원자료 또는 원표 미확보 {data.collectionBacklog.length}건</summary><div className="public-table-wrap"><table className="public-table"><thead><tr><th scope="col">출처</th><th scope="col">접근 상태</th><th scope="col">다음 수집 작업</th><th scope="col">해석 한계</th></tr></thead><tbody>{data.collectionBacklog.map((item) => <tr key={item.sourceId}><th scope="row"><a href={item.url} target="_blank" rel="noreferrer">{item.sourceId} · {item.priority}</a></th><td>{item.accessStatus}</td><td>{item.nextAction}</td><td>{item.limits}</td></tr>)}</tbody></table></div></details>
    </section></div></details>
  </section>;
}
