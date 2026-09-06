import framework from "./data/ax-management-framework.json";

function words(value: unknown): string {
  if (Array.isArray(value)) return value.map(words).filter(Boolean).join(" · ");
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function SourceLinks({ ids }: { ids: string[] }) {
  return <div className="ax-source-links">{ids.map((id) => {
    const source = framework.sources.find((item) => item.id === id);
    return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{words(source.authors)} ({source.year}) ↗</a> : null;
  })}</div>;
}

export function AxManagementStages() {
  return <section className="ai-panel ax-management-stages">
    <div className="ai-panel-heading"><div><span>MANAGEMENT FOR AX</span><div><h2>{framework.meta.question}</h2><p>{framework.meta.interpretation}</p></div></div></div>
    <div className="ax-stage-grid">{framework.stages.map((stage, index) => <article key={stage.id}>
      <span className="ax-stage-number">{String(index + 1).padStart(2, "0")}</span><h3>{stage.title}</h3><p className="ax-stage-question">{stage.question}</p>
      <dl><div><dt>관측한 것</dt><dd>{words(stage.observed)}</dd></div><div><dt>관측하지 못한 것</dt><dd>{words(stage.unobserved)}</dd></div><div><dt>분석 역할</dt><dd>{words(stage.role)}</dd></div></dl><SourceLinks ids={stage.references} />
    </article>)}</div>
    <p className="ai-model-caution">준비 → 도입 → 운영 → 성과 보조는 문헌을 정리한 가설적 분석틀입니다. 이 자료에서 단계별 인과관계나 순차적 매개경로가 입증되었다는 뜻이 아닙니다. 관리방식의 빈도가 높다는 것과 바람직한 관리라는 판단도 구분합니다.</p>
  </section>;
}

export function AxManagementActions() {
  return <section className="ai-panel ax-management-actions">
    <div className="ai-panel-heading"><div><span>RESEARCH TO MANAGEMENT</span><div><h2>무엇을 관리해야 하는가: 근거와 확인할 조건</h2><p>문헌의 실무 제안과 우리 자료로 관측한 근거를 구분합니다. 공공·민간에서 같은 처방의 효과가 확인된 것은 아닙니다.</p></div></div></div>
    <div className="ax-action-grid">{framework.management_dimensions.map((dimension) => <article key={dimension.id}>
      <span>문헌 기반 관리 차원</span><h3>{dimension.title}</h3><p>{words(dimension.why)}</p>
      <dl><div><dt>자료에서 비교</dt><dd>{dimension.observed_codes.length ? dimension.observed_codes.join(" · ") : "직접 대응 문항 없음"}</dd></div><div><dt>추가 확인 필요</dt><dd>{words(dimension.not_measured)}</dd></div></dl>
      <div className="ax-action-proposal"><strong>문헌기반 점검 제안 · 효과 입증 아님</strong><p>{words(dimension.action)}</p></div><SourceLinks ids={dimension.references} />
    </article>)}</div>
  </section>;
}

export function AxCausalResearch() {
  const design = framework.causal_design;
  return <>
    <AxManagementStages />
    <section className="ai-panel ax-causal-design">
      <div className="ai-panel-heading"><div><span>CAUSAL IDENTIFICATION</span><div><h2>인과관계 검토: 통제와 패널만으로 충분한가</h2><p>{design.question}</p></div></div></div>
      <div className="ax-estimand"><strong>검증하려는 인과 질문</strong><p>{words(design.estimand)}</p></div>
      <div className="ax-evidence-levels">{design.evidence_levels.map((level) => <article key={level.id}><span>{words(level.status)}</span><h3>{level.title}</h3><p>{words(level.meaning)}</p></article>)}</div>
      <div className="ax-table-scroll"><table className="ax-adjustment-table"><caption>선행연구에 근거한 통제변수와 실제 확보 여부</caption><thead><tr><th scope="col">변수</th><th scope="col">측정 시점</th><th scope="col">인과모형의 역할</th><th scope="col">통제·제외 근거</th><th scope="col">현재 상태</th></tr></thead><tbody>{design.adjustment.map((item) => <tr key={item.variable}><th scope="row">{item.variable}</th><td>{words(item.timing)}</td><td>{words(item.role)}</td><td>{words(item.rationale)}</td><td>{words(item.status)}</td></tr>)}</tbody></table></div>
      <div className="ax-causal-limits"><article><h3>자동으로 통제하지 않는 변수</h3><ul>{design.excluded_controls.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h3>인과해석에 필요한 가정</h3><ul>{design.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></article><article><h3>인과를 검증하려면 다음에 필요한 설계</h3><ul>{design.next_design.map((item) => <li key={item}>{item}</li>)}</ul></article></div>
      <p className="ai-model-caution">통제변수를 많이 넣거나 이전 차수의 변수를 사용했다는 이유만으로 인과효과가 되지는 않습니다. 실제 포함한 변수·누락된 교란·매개 및 사후변수를 모형별로 확인해야 합니다.</p>
    </section>
    <AxManagementActions />
    <section className="ai-panel ax-research-sources"><div className="ai-panel-heading"><div><span>FULL MODEL AUDIT</span><div><h2>선행연구의 전체 변수와 전이 가능한 근거</h2><p>설명·종속·기제·통제·설계를 함께 검토하고, 관측되지 않은 구성개념을 새 변수처럼 만들지 않습니다.</p></div></div></div><div className="ax-source-grid">{framework.sources.map((source) => <article key={source.id} id={`research-${source.id}`}><header><span>{words(source.authors)} · {source.year}</span><h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></h3><p>{words(source.design)}</p></header><dl><div><dt>설명변수 X</dt><dd>{words(source.x)}</dd></div><div><dt>종속변수 Y</dt><dd>{words(source.y)}</dd></div><div><dt>매개·조절·기제</dt><dd>{words(source.mechanism)}</dd></div><div><dt>통제변수</dt><dd>{words(source.controls)}</dd></div><div><dt>확인된 내용</dt><dd>{words(source.finding)}</dd></div><div><dt>이번 연구에 적용</dt><dd>{words(source.application)}</dd></div><div><dt>적용 한계</dt><dd>{words(source.limit)}</dd></div></dl></article>)}</div></section>
  </>;
}
