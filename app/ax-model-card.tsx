export type ModelTerm = {
  id: string;
  label: string;
  beta: number | null;
  se: number | null;
  ci_low: number | null;
  ci_high: number | null;
  p: number | null;
  p_holm?: number | null;
  increment?: string;
  scale?: "log_odds_audit_only" | "standardized_probability_change" | string;
  contrast_type?: "average_marginal_derivative" | "discrete_change_0_to_1" | string;
};

export type AnalysisModel = {
  id: string;
  title: string;
  outcome: string;
  method: string;
  unit: string;
  n: number;
  firms?: number;
  years?: number[];
  predictor_year?: number;
  groups?: Record<string, { n: number; events?: number; adopters?: number }>;
  controls: string[];
  coefficients: ModelTerm[];
  contrasts: ModelTerm[];
  warnings: string[];
  status: string;
  priority?: "primary" | "secondary" | string;
  same_complete_case_as?: string;
  standardization?: { target?: string; target_n?: number; trimming?: string; caveat?: string };
  withheld_reason?: string;
};

export function formatP(value: number | null) {
  return value === null || !Number.isFinite(value) ? "산출 불가" : value < 0.001 ? "<.001" : value.toFixed(3).replace(/^0/, "");
}

export function formatEffect(value: number | null, unit: string, signed = true) {
  if (value === null || !Number.isFinite(value)) return "—";
  const scaled = unit === "probability" ? value * 100 : value;
  return `${signed && scaled > 0 ? "+" : ""}${scaled.toFixed(unit === "probability" ? 1 : 3)}`;
}

function IntervalTable({ terms, unit, title }: { terms: ModelTerm[]; unit: string; title: string }) {
  const hasHolm = terms.some((term) => typeof term.p_holm === "number");
  const scale = Math.max(unit === "probability" ? 0.05 : 0.1, ...terms.flatMap((term) => [Math.abs(term.ci_low ?? 0), Math.abs(term.ci_high ?? 0)])) * 1.08;
  const position = (value: number) => ((value + scale) / (scale * 2)) * 100;

  return (
    <div className="ax-table-scroll">
      <table className="ax-coefficient-table">
        <caption>{title} · 단위 {unit === "probability" ? "%p (퍼센트포인트)" : "원척도 점수"}</caption>
        <thead><tr><th scope="col">변수·비교</th><th scope="col" className="ax-ci-column">95% 신뢰구간 <span>← 음의 관계 · 0 · 양의 관계 →</span></th><th scope="col">계수</th><th scope="col">95% 구간</th><th scope="col">p</th>{hasHolm ? <th scope="col">Holm 보정 p</th> : null}</tr></thead>
        <tbody>{terms.map((term) => {
          const valid = term.beta !== null && term.ci_low !== null && term.ci_high !== null && [term.beta, term.ci_low, term.ci_high].every(Number.isFinite);
          return <tr key={term.id}>
            <th scope="row">{term.label}{term.increment ? <small className="ax-coefficient-increment">{term.increment}</small> : null}</th>
            <td className="ax-ci-column"><div className="ax-ci-track" aria-hidden="true"><i className="ax-ci-zero" />{valid ? <><i className="ax-ci-line" style={{ left: `${position(term.ci_low!)}%`, width: `${position(term.ci_high!) - position(term.ci_low!)}%` }} /><b className="ax-ci-dot" style={{ left: `${position(term.beta!)}%` }} /></> : null}</div></td>
            <td className="ax-coefficient-value">{formatEffect(term.beta, unit)}</td>
            <td>[{formatEffect(term.ci_low, unit, false)}, {formatEffect(term.ci_high, unit, false)}]</td>
            <td>{formatP(term.p)}</td>
            {hasHolm ? <td>{typeof term.p_holm === "number" ? formatP(term.p_holm) : "—"}</td> : null}
          </tr>;
        })}</tbody>
      </table>
      {hasHolm ? <p className="ai-perception-note">주 모형에서 사전 지정한 공공−민간 차이 검정에는 Holm 다중검정 보정 p값을 함께 표시합니다. 95% 신뢰구간은 개별 검정 기준이며 동시 신뢰구간이 아닙니다.</p> : null}
    </div>
  );
}

export default function AxModelCard({ model }: { model: AnalysisModel }) {
  const isLogitSensitivity = model.id === "readiness_lag21_joint_logit_probability_sensitivity";
  const probabilityContrastsOnly = model.coefficients.some((term) => term.scale === "log_odds_audit_only") && model.contrasts.some((term) => term.scale === "standardized_probability_change");
  const focalTerms = model.coefficients.filter((term) => !/^(const$|industry_|log_employees$|union_)/.test(term.id));
  const controlTerms = model.coefficients.filter((term) => !focalTerms.includes(term));
  return (
    <article className="ai-panel ax-model-card" id={`model-${model.id}`}>
      <header className="ax-model-heading">
        <div><span>{model.status === "estimated" ? "ESTIMATED · 원자료 회귀" : "추정 제한"}</span><h3>{model.title}</h3><p>종속변수 · {model.outcome}</p></div>
        <div className="ax-model-n"><strong>{model.n.toLocaleString("ko-KR")}</strong><span>분석 관측{model.firms ? ` · ${model.firms.toLocaleString("ko-KR")}개 기업` : ""}</span></div>
      </header>
      <p className="ax-model-method">{model.method}{model.years?.length ? ` · ${model.years.join(" · ")}년` : ""}{model.predictor_year ? ` · 관리조건 측정 ${model.predictor_year}년` : ""}</p>
      {model.groups ? <div className="ax-model-groups">{Object.entries(model.groups).map(([group, sample]) => <span key={group}>{group === "public" ? "공공" : group === "private" ? "민간" : group} {sample.n.toLocaleString("ko-KR")}관측{sample.events !== undefined ? ` · 결과 해당 ${sample.events.toLocaleString("ko-KR")}건` : ""}{sample.adopters !== undefined ? ` · AI ${sample.adopters.toLocaleString("ko-KR")}곳` : ""}</span>)}</div> : null}
      {model.status === "estimated" ? <>
        {model.contrasts.length > 0 ? <section className="ax-direct-contrast"><h4>{probabilityContrastsOnly ? "공통분포 표준화 확률 차이" : "공공·민간의 차이를 직접 검정"}</h4><p>{probabilityContrastsOnly ? "로짓 원계수(log odds)는 감사용으로 숨기고, 같은 완전사례 공변량 분포에서 계산한 확률 차이만 %p로 제시합니다. 한쪽만 유의하다는 이유로 부문 차이를 선언하지 않습니다." : "각 부문의 연관과 그 차이를 같은 모형에서 계산합니다. 한쪽만 유의하다는 이유로 부문 차이를 선언하지 않습니다."}</p><IntervalTable terms={model.contrasts} unit={probabilityContrastsOnly ? "probability" : model.unit} title={probabilityContrastsOnly ? "표준화 확률 변화와 공공−민간 차이" : "부문별 연관과 공공−민간 차이"} /></section> : null}
        {!probabilityContrastsOnly && focalTerms.length > 0 ? <IntervalTable terms={focalTerms} unit={model.unit} title="다중회귀 핵심 계수" /> : null}
      </> : <p className="ai-model-caution">{isLogitSensitivity && model.status === "withheld" ? `${model.withheld_reason ?? "일부 범주 결과의 편중·분리 진단으로 로짓 확률 대비를 보류했습니다."} 빈 계수는 효과 없음이나 0으로 해석하지 않습니다.` : "유효 표본·응답 변이 등의 조건을 충족하지 않아 계수를 제시하지 않습니다. 0 또는 효과 없음으로 해석하지 않습니다."}</p>}
      <details className="ax-model-details"><summary>통제변수와 해석상 주의</summary><p><strong>통제:</strong> {model.controls.length ? model.controls.join(" · ") : "모형 설명 참조"}</p>{probabilityContrastsOnly ? <p className="ai-perception-note">로짓 원계수는 확률 차이와 단위가 달라 이 화면에 표시하지 않습니다. {model.same_complete_case_as ? `완전사례 표본은 ${model.same_complete_case_as}와 같습니다. ` : ""}{model.standardization?.target ? `표준화 대상: ${model.standardization.target}. ` : ""}{model.standardization?.trimming ? `절단: ${model.standardization.trimming}. ` : ""}{model.standardization?.caveat ?? ""}</p> : controlTerms.length > 0 ? <IntervalTable terms={controlTerms} unit={model.unit} title="통제·절편 계수" /> : null}<ul>{model.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>
    </article>
  );
}
