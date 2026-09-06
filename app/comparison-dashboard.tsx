"use client";

import { CSSProperties, useMemo, useState } from "react";
import { SingleYearNotice } from "./year-selector";

type GroupResult = {
  mean: number;
  beta: number;
  p: number;
  significant: boolean;
};

type LiteratureEvidence = {
  basis: string;
  why: string;
  finding: string;
  references: Array<{ label: string; href?: string }>;
  caution?: string;
};

export type ComparisonFactor = {
  id: string;
  label: string;
  short: string;
  alpha: number;
  variables: string[];
  a: GroupResult;
  b: GroupResult;
  meanDifferenceP: number;
  insight: string;
  literature: LiteratureEvidence;
  items: Array<{ id: string; label: string; a: number; b: number }>;
};

export type CultureDimension = {
  id: "group" | "development" | "hierarchy" | "rational";
  label: string;
  alias: string;
  cue: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  variables: string[];
  a: number;
  b: number;
  items: Array<{ id: string; label: string; a: number; b: number }>;
};

export type CultureEffect = {
  id: string;
  label: string;
  a: { beta: number; p: number; significant: boolean };
  b: { beta: number; p: number; significant: boolean };
};

export type CultureConfig = {
  dimensions: CultureDimension[];
  effects: CultureEffect[];
  distribution: Array<{ id: string; label: string; a: number; b: number }>;
  referenceLabel: string;
  sourceNote: string;
  literature: LiteratureEvidence;
};

export type DescriptiveItemGroup = {
  id: string;
  label: string;
  role: "driver" | "outcome" | "control" | "culture";
  items: Array<{ id: string; label: string; a: number; b: number }>;
};

export type ChangeManagementAudience = {
  id: string;
  label: string;
  diagnosis: {
    title: string;
    body: string;
    signals: Array<{ label: string; value: string; note: string }>;
  };
  priority: {
    eyebrow: string;
    title: string;
    evidence: string;
    firstMove: string;
    factorId?: string;
    nextMoves: string[];
  };
  metrics: Array<{
    kind: "condition" | "operation" | "outcome";
    label: string;
    value: string;
    note: string;
  }>;
  roadmap: Array<{ period: string; title: string; body: string }>;
};

export type ChangeManagementConfig = {
  title: string;
  description: string;
  audiences: ChangeManagementAudience[];
  decisionRule: string;
  caution: string;
};

export type DifferenceStoryConfig = {
  title: string;
  description: string;
  shortValue: string;
  shortLabel: string;
  kpi: { label: string; title: string; value: string; note: string };
  steps: Array<{
    eyebrow: string;
    title: string;
    body: string;
    signals: Array<{ label: string; value: string; note: string }>;
  }>;
  conclusion: string;
  caution: string;
  featuredRelationship?: {
    label: string;
    title: string;
    definition: string;
    alpha: number;
    a: GroupResult;
    b: GroupResult;
    interpretation: string;
    management: string;
  };
};

export type OverallRegressionConfig = {
  title: string;
  description: string;
  n: number;
  r2: number;
  adjustedR2: number;
  maxFactorVif: number;
  controlTerms: number;
  institutionReference: string;
  factors: Array<{
    id: string;
    label: string;
    beta: number;
    p: number;
    significant: boolean;
  }>;
  interpretation: string;
  caution: string;
};

export type LeadershipProfileConfig = {
  title: string;
  description: string;
  method: string;
  fieldInsight: {
    title: string;
    body: string;
    actions: string[];
  };
  efa: {
    kmo: number;
    retained: number;
    itemCount: number;
    variance: number;
    minimumLoading: number;
  };
  profiles: Array<{
    id: string;
    label: string;
    short: string;
    alpha: number;
    inRegression: boolean;
    a: { mean: number };
    b: { mean: number };
    meanDifferenceP: number;
    regression?: {
      a: Pick<GroupResult, "beta" | "p" | "significant">;
      b: Pick<GroupResult, "beta" | "p" | "significant">;
    };
    items: Array<{ id: string; label: string; a: number; b: number }>;
  }>;
  caution: string;
};

export type ComparisonDashboardConfig = {
  variant: "public-private" | "central-local";
  analysisYear: number;
  eyebrow: string;
  title: string;
  question: string;
  headline: string;
  scopeBanner?: string;
  plainSummary: Array<{ label: string; title: string; body: string }>;
  source: string;
  sampleLabel: string;
  groupA: { label: string; short: string; mean: number; n: number; r2: number; maxFactorVif: number };
  groupB: { label: string; short: string; mean: number; n: number; r2: number; maxFactorVif: number };
  outcomeGapP: number;
  factors: ComparisonFactor[];
  controls: string[];
  controlTerms: number;
  controlTermsLabel?: string;
  modelFormula: string;
  controlSummary: string;
  controlResearchNote: string;
  controlValidation: string;
  factorSourceNote: string;
  factorValidation: {
    kmo: number;
    retained: number;
    itemCount: number;
    variance: number;
    minimumLoading: number;
  };
  outcomeAlpha: number;
  outcomeItems: Array<{ id: string; label: string; a: number; b: number }>;
  itemGroups: DescriptiveItemGroup[];
  itemComparisonNote: string;
  changeManagement: ChangeManagementConfig;
  differenceStory: DifferenceStoryConfig;
  overallRegression?: OverallRegressionConfig;
  leadershipProfile?: LeadershipProfileConfig;
  operationalNote: string;
  warnings: string[];
  footer: string;
  culture?: CultureConfig;
};

const metricKindLabels: Record<ChangeManagementAudience["metrics"][number]["kind"], string> = {
  condition: "선행조건",
  operation: "실행과정",
  outcome: "결과",
};

const coefficientMin = -0.1;
const coefficientMax = 0.5;
const coefficientSpan = coefficientMax - coefficientMin;
const zeroPosition = ((0 - coefficientMin) / coefficientSpan) * 100;

const cultureMin = -0.15;
const cultureMax = 0.3;
const cultureSpan = cultureMax - cultureMin;
const cultureZero = ((0 - cultureMin) / cultureSpan) * 100;

const relationshipMin = -0.15;
const relationshipMax = 0.15;
const relationshipZero = 50;

function formatP(value: number) {
  if (value < 0.001) return "p<.001";
  return `p=${value.toFixed(3).replace(/^0/, "")}`;
}

function signed(value: number, digits = 3) {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

function barGeometry(value: number, min: number, max: number, zero: number): CSSProperties {
  const clipped = Math.min(max, Math.max(min, value));
  const position = ((clipped - min) / (max - min)) * 100;
  return {
    left: `${Math.min(position, zero)}%`,
    width: `${Math.max(0.8, Math.abs(position - zero))}%`,
  };
}

function scoreRing(mean: number): CSSProperties {
  return { "--score-angle": `${(mean / 5) * 360}deg` } as CSSProperties;
}

function itemLabel(label: string) {
  const bracket = label.match(/\[([^\]]+)\]\s*$/);
  if (bracket) return bracket[1];
  return label.replace(/^\d+\]\s*\d+\)\s*/, "");
}

function statusLabel(factor: ComparisonFactor, a: string, b: string) {
  if (factor.a.significant && factor.b.significant) return "두 집단 각각 p<.05";
  if (factor.a.significant) return `${a} 내부 p<.05`;
  if (factor.b.significant) return `${b} 내부 p<.05`;
  return "두 집단 각각 p≥.05";
}

function statusClass(factor: ComparisonFactor) {
  if (factor.a.significant && factor.b.significant) return "both";
  if (factor.a.significant || factor.b.significant) return "one";
  return "none";
}

function cultureStatusLabel(effect: CultureEffect, a: string, b: string) {
  if (effect.a.significant && effect.b.significant) return "두 집단에서 관계 확인";
  if (effect.a.significant) return `${a}에서 관계 확인`;
  if (effect.b.significant) return `${b}에서 관계 확인`;
  return "뚜렷한 관계 확인 안 됨";
}

function cultureStatusClass(effect: CultureEffect) {
  return effect.a.significant || effect.b.significant ? "yes" : "no";
}

function NameList({ items }: { items: ComparisonFactor[] }) {
  if (!items.length) return <span className="empty-value">없음</span>;
  return <div className="name-list">{items.map((factor) => <span key={factor.id}>{factor.label}</span>)}</div>;
}

function PairLegend({ a, b }: { a: string; b: string }) {
  return (
    <div className="mini-legend" aria-label="집단 색상 범례">
      <span><i className="legend-a" />{a}</span>
      <span><i className="legend-b" />{b}</span>
    </div>
  );
}

const itemRoleLabels: Record<DescriptiveItemGroup["role"], string> = {
  driver: "핵심 영향요인",
  outcome: "혁신행동",
  control: "연속형 통제척도",
  culture: "조직문화 CVF",
};

function gapLabel(gap: number, a: string, b: string) {
  if (Math.abs(gap) < 0.005) return "두 집단 동일";
  return `${gap > 0 ? a : b} +${Math.abs(gap).toFixed(2)}`;
}

function ItemAtlasSection({ config }: { config: ComparisonDashboardConfig }) {
  const [role, setRole] = useState<"all" | DescriptiveItemGroup["role"]>("all");
  const [gapFirst, setGapFirst] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(config.itemGroups[0]?.id ?? "");
  const [showAllDetails, setShowAllDetails] = useState(false);
  const roles = (["driver", "outcome", "control", "culture"] as const).filter((candidate) =>
    config.itemGroups.some((group) => group.role === candidate),
  );
  const visibleGroups = config.itemGroups
    .filter((group) => role === "all" || group.role === role)
    .map((group) => {
      const items = gapFirst
        ? [...group.items].sort((left, right) => Math.abs(right.a - right.b) - Math.abs(left.a - left.b))
        : group.items;
      const meanA = group.items.reduce((sum, item) => sum + item.a, 0) / group.items.length;
      const meanB = group.items.reduce((sum, item) => sum + item.b, 0) / group.items.length;
      return { ...group, items, meanA, meanB, meanGap: meanA - meanB };
    })
    .sort((left, right) => {
      if (!gapFirst) return 0;
      return Math.abs(right.meanGap) - Math.abs(left.meanGap);
    });
  const selectedGroup = visibleGroups.find((group) => group.id === selectedGroupId) ?? visibleGroups[0];
  const detailGroups = showAllDetails ? visibleGroups : selectedGroup ? [selectedGroup] : [];
  const visibleItems = detailGroups.flatMap((group) =>
    group.items.map((item) => ({ ...item, groupLabel: group.label })),
  );
  const highestForA = [...visibleItems]
    .filter((item) => item.a - item.b > 0.005)
    .sort((left, right) => (right.a - right.b) - (left.a - left.b))[0];
  const highestForB = [...visibleItems]
    .filter((item) => item.a - item.b < -0.005)
    .sort((left, right) => (left.a - left.b) - (right.a - right.b))[0];
  const lowestOverall = [...visibleItems].sort((left, right) => ((left.a + left.b) / 2) - ((right.a + right.b) / 2))[0];
  const totalItems = config.itemGroups.reduce((sum, group) => sum + group.items.length, 0);
  const detailItemCount = detailGroups.reduce((sum, group) => sum + group.items.length, 0);

  function chooseRole(nextRole: "all" | DescriptiveItemGroup["role"]) {
    setRole(nextRole);
    setShowAllDetails(false);
  }

  return (
    <section className="dashboard-panel item-atlas-panel" aria-labelledby={`item-atlas-${config.variant}`}>
      <div className="panel-heading item-atlas-heading">
        <div><span className="panel-number">{config.culture ? "08" : "06"}</span><div><h2 id={`item-atlas-${config.variant}`}>개념별 산술평균 → 세부 문항 비교</h2><p>먼저 개념 전체 평균을 비교하고, 선택한 개념의 원문 문항을 아래에서 확인</p></div></div>
        <div className="item-count-total"><strong>{totalItems}</strong><span>개 문항</span></div>
      </div>

      <div className="item-atlas-method">
        <strong>읽는 순서</strong>
        <span>1단계 개념 막대 = 구성문항의 집단별 평균 합계 ÷ 문항 수</span>
        <i />
        <span>2단계 세부 막대 = 각 원문 문항의 집단별 단순 산술평균</span>
        <i />
        <span>차이 = {config.groupA.short}−{config.groupB.short}</span>
      </div>

      <div className="item-atlas-toolbar">
        <div className="item-role-filter" role="group" aria-label="문항 범위 선택">
          <button aria-pressed={role === "all"} className={role === "all" ? "active" : ""} onClick={() => chooseRole("all")} type="button">전체 <b>{totalItems}</b></button>
          {roles.map((candidate) => {
            const count = config.itemGroups.filter((group) => group.role === candidate).reduce((sum, group) => sum + group.items.length, 0);
            return <button aria-pressed={role === candidate} className={role === candidate ? "active" : ""} key={candidate} onClick={() => chooseRole(candidate)} type="button">{itemRoleLabels[candidate]} <b>{count}</b></button>;
          })}
        </div>
        <button aria-pressed={gapFirst} className={`gap-sort-button ${gapFirst ? "active" : ""}`} onClick={() => setGapFirst((current) => !current)} type="button">{gapFirst ? "개념 격차 큰 순" : "원 설문 순"}</button>
      </div>

      <div className="concept-overview-heading">
        <div><span>1단계</span><div><strong>개념별 전체 산술평균</strong><small>막대 하나가 해당 개념의 모든 구성문항을 합산해 문항 수로 나눈 값입니다.</small></div></div>
        <PairLegend a={config.groupA.short} b={config.groupB.short} />
      </div>
      <div className="concept-mean-grid">
        {visibleGroups.map((group) => (
          <button
            aria-pressed={selectedGroup?.id === group.id && !showAllDetails}
            className={selectedGroup?.id === group.id && !showAllDetails ? "selected" : ""}
            key={group.id}
            onClick={() => { setSelectedGroupId(group.id); setShowAllDetails(false); }}
            type="button"
          >
            <div className="concept-mean-label"><span>{itemRoleLabels[group.role]}</span><strong>{group.label}</strong><small>{group.items.length}문항 산술평균</small></div>
            <div className="concept-paired-bars" aria-label={`${group.label}: ${config.groupA.label} ${group.meanA.toFixed(2)}점, ${config.groupB.label} ${group.meanB.toFixed(2)}점`}>
              <div><span>{config.groupA.short}</span><i><b className="group-a" style={{ width: `${(group.meanA / 5) * 100}%` }} /></i><strong>{group.meanA.toFixed(2)}</strong></div>
              <div><span>{config.groupB.short}</span><i><b className="group-b" style={{ width: `${(group.meanB / 5) * 100}%` }} /></i><strong>{group.meanB.toFixed(2)}</strong></div>
            </div>
            <div className="concept-gap"><span>평균차</span><strong>{signed(group.meanGap, 2)}</strong><small>{gapLabel(group.meanGap, config.groupA.short, config.groupB.short)}</small></div>
          </button>
        ))}
      </div>

      <div className="item-atlas-insights" aria-label="선택 개념 세부 문항의 주요 평균 차이">
        <article className="group-a-insight"><span>{config.groupA.short}이 상대적으로 높은 문항</span><strong>{highestForA ? itemLabel(highestForA.label) : "해당 없음"}</strong><small>{highestForA ? `${highestForA.groupLabel} · ${gapLabel(highestForA.a - highestForA.b, config.groupA.short, config.groupB.short)}` : "선택 범위에서 확인되지 않음"}</small></article>
        <article className="group-b-insight"><span>{config.groupB.short}이 상대적으로 높은 문항</span><strong>{highestForB ? itemLabel(highestForB.label) : "해당 없음"}</strong><small>{highestForB ? `${highestForB.groupLabel} · ${gapLabel(highestForB.a - highestForB.b, config.groupA.short, config.groupB.short)}` : "선택 범위에서 확인되지 않음"}</small></article>
        <article className="low-score-insight"><span>두 집단 평균이 가장 낮은 문항</span><strong>{lowestOverall ? itemLabel(lowestOverall.label) : "-"}</strong><small>{lowestOverall ? `${lowestOverall.groupLabel} · 평균 ${((lowestOverall.a + lowestOverall.b) / 2).toFixed(2)}` : "-"}</small></article>
      </div>

      <div className="concept-detail-heading">
        <div><span>2단계</span><div><strong>{showAllDetails ? `${visibleGroups.length}개 개념의 세부 문항` : `${selectedGroup?.label ?? "선택 개념"} 세부 문항`}</strong><small>위 개념 막대를 선택하면 해당 구성문항만 바로 비교할 수 있습니다.</small></div></div>
        <button aria-pressed={showAllDetails} onClick={() => setShowAllDetails((current) => !current)} type="button">{showAllDetails ? "선택 개념만 보기" : "전체 세부 문항 펼치기"}</button>
      </div>
      <div className={`item-atlas-grid ${showAllDetails ? "" : "single-detail"}`}>
        {detailGroups.map((group) => {
          return (
            <article className={`item-group role-${group.role}`} key={group.id}>
              <div className="item-group-heading">
                <div><span>{itemRoleLabels[group.role]}</span><strong>{group.label}</strong></div>
                <div><b>{group.items.length}문항 평균</b><em>{config.groupA.short} {group.meanA.toFixed(2)} · {config.groupB.short} {group.meanB.toFixed(2)}</em></div>
              </div>
              <div className="item-group-scale" aria-hidden="true"><span>1점</span><i /><span>3점</span><i /><span>5점</span></div>
              <div className="item-atlas-list">
                {group.items.map((item) => {
                  const gap = item.a - item.b;
                  return (
                    <div className="atlas-item-row" key={item.id}>
                      <div className="atlas-item-copy"><p><span>{item.id}</span>{itemLabel(item.label)}</p><em className={gap > 0.005 ? "group-a-gap" : gap < -0.005 ? "group-b-gap" : "same-gap"}>{gapLabel(gap, config.groupA.short, config.groupB.short)}</em></div>
                      <div className="atlas-paired-bars" aria-label={`${itemLabel(item.label)}: ${config.groupA.label} ${item.a.toFixed(2)}점, ${config.groupB.label} ${item.b.toFixed(2)}점`}>
                        <div><span>{config.groupA.short}</span><i><b className="group-a" style={{ width: `${(item.a / 5) * 100}%` }} /></i><strong>{item.a.toFixed(2)}</strong></div>
                        <div><span>{config.groupB.short}</span><i><b className="group-b" style={{ width: `${(item.b / 5) * 100}%` }} /></i><strong>{item.b.toFixed(2)}</strong></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
      <p className="chart-footnote">현재 {detailItemCount}개 세부 문항을 표시합니다. 개념·문항 평균 차이는 현황 비교이며 원인이나 효과가 아닙니다. {config.itemComparisonNote}</p>
    </section>
  );
}

function ChangeManagementSection({
  config,
  onFactorSelect,
}: {
  config: ComparisonDashboardConfig;
  onFactorSelect: (factorId: string) => void;
}) {
  const plans = config.changeManagement.audiences;
  const [audienceId, setAudienceId] = useState(plans[0]?.id ?? "");
  const plan = plans.find((candidate) => candidate.id === audienceId) ?? plans[0];

  if (!plan) return null;

  function openEvidence() {
    if (!plan.priority.factorId) return;
    onFactorSelect(plan.priority.factorId);
    window.requestAnimationFrame(() => {
      document.getElementById(`effect-${config.variant}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <section className="dashboard-panel change-management-panel" aria-labelledby={`change-management-${config.variant}`}>
      <div className="change-management-heading">
        <div>
          <span>CHANGE MANAGEMENT</span>
          <div>
            <h2 id={`change-management-${config.variant}`}>{config.changeManagement.title}</h2>
            <p>{config.changeManagement.description}</p>
          </div>
        </div>
        <strong>효과 보장이 아닌 우선 검증안</strong>
      </div>

      {plans.length > 1 ? (
        <div className="management-audience-tabs" role="tablist" aria-label="변화관리 대상 선택">
          {plans.map((candidate) => (
            <button
              aria-selected={plan.id === candidate.id}
              className={plan.id === candidate.id ? "active" : ""}
              key={candidate.id}
              onClick={() => setAudienceId(candidate.id)}
              role="tab"
              type="button"
            >
              {candidate.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="management-answer-grid">
        <article className="management-diagnosis">
          <span className="management-question">01 · 어디가 병목인가</span>
          <h3>{plan.diagnosis.title}</h3>
          <p>{plan.diagnosis.body}</p>
          <div className="management-signals">
            {plan.diagnosis.signals.map((signal) => (
              <div key={`${plan.id}-${signal.label}`}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
                <small>{signal.note}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="management-priority">
          <span className="management-question">02 · 무엇을 먼저 할까</span>
          <small className="management-evidence-level">{plan.priority.eyebrow}</small>
          <h3>{plan.priority.title}</h3>
          <p className="management-evidence">{plan.priority.evidence}</p>
          <div className="management-first-move"><span>첫 30일 행동</span><strong>{plan.priority.firstMove}</strong></div>
          <ul>{plan.priority.nextMoves.map((move) => <li key={move}>{move}</li>)}</ul>
          {plan.priority.factorId ? <button className="evidence-jump" onClick={openEvidence} type="button">회귀·문항 근거 보기</button> : null}
        </article>

        <article className="management-measurement">
          <span className="management-question">03 · 무엇을 확인할까</span>
          <h3>과정·인식·결과를 함께 봅니다.</h3>
          <p>목표점수를 임의로 만들지 않고 현재값을 기준선으로 저장한 뒤 변화 방향을 추적합니다.</p>
          <div className="management-metrics">
            {plan.metrics.map((metric) => (
              <div className={`metric-${metric.kind}`} key={`${plan.id}-${metric.kind}-${metric.label}`}>
                <span>{metricKindLabels[metric.kind]}</span>
                <div><strong>{metric.label}</strong><b>{metric.value}</b></div>
                <small>{metric.note}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="management-roadmap" aria-label={`${plan.label} 90일 변화관리 순서`}>
        <strong>90일 실행 순서</strong>
        {plan.roadmap.map((step, index) => (
          <article key={`${plan.id}-${step.period}`}>
            <span>{String(index + 1).padStart(2, "0")} · {step.period}</span>
            <strong>{step.title}</strong>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
      <div className="management-guardrail"><strong>판단식</strong><span>{config.changeManagement.decisionRule}</span><i /><small>{config.changeManagement.caution}</small></div>
    </section>
  );
}

function DifferenceStorySection({ config }: { config: ComparisonDashboardConfig }) {
  const story = config.differenceStory;
  const relationship = story.featuredRelationship;

  return (
    <section className="dashboard-panel difference-story-panel" aria-labelledby={`difference-story-${config.variant}`}>
      <div className="difference-story-heading">
        <div className="panel-heading">
          <div><span className="panel-number">03</span><div><h2 id={`difference-story-${config.variant}`}>{story.title}</h2><p>{story.description}</p></div></div>
        </div>
        <strong>원인 확정이 아닌 통계적 단서</strong>
      </div>

      <div className="difference-story-flow">
        {story.steps.map((step, index) => (
          <article key={step.eyebrow}>
            <div className="difference-step-title"><span>{String(index + 1).padStart(2, "0")}</span><small>{step.eyebrow}</small></div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <div className="difference-step-signals">
              {step.signals.map((signal) => (
                <div key={`${step.eyebrow}-${signal.label}`}><span>{signal.label}</span><strong>{signal.value}</strong><small>{signal.note}</small></div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="difference-story-conclusion"><span>한 줄 결론</span><strong>{story.conclusion}</strong><small>{story.caution}</small></div>

      {relationship ? (
        <section className="relationship-spotlight" aria-labelledby={`relationship-${config.variant}`}>
          <div className="relationship-heading">
            <div><span>{relationship.label}</span><div><h3 id={`relationship-${config.variant}`}>{relationship.title}</h3><p>{relationship.definition}</p></div></div>
            <strong>α {relationship.alpha.toFixed(2)}</strong>
          </div>
          <div className="relationship-grid">
            {([['a', config.groupA, relationship.a], ['b', config.groupB, relationship.b]] as const).map(([key, group, result]) => (
              <article key={key}>
                <div className="relationship-group"><span>{group.label}</span><strong>{result.mean.toFixed(2)}점</strong></div>
                <div className="relationship-mean-bar" aria-label={`${group.label} 조직공정성 평균 ${result.mean.toFixed(2)}점`}><b className={`group-${key}`} style={{ width: `${(result.mean / 5) * 100}%` }} /></div>
                <div className="relationship-effect-copy"><span>혁신행동과 통제 후 관계</span><strong>β {signed(result.beta)} · {formatP(result.p)}</strong></div>
                <div className="relationship-effect-track" aria-hidden="true"><i style={{ left: `${relationshipZero}%` }} /><b className={`group-${key} ${result.significant ? "significant" : "muted"}`} style={barGeometry(result.beta, relationshipMin, relationshipMax, relationshipZero)} /></div>
                <small className={result.significant ? "confirmed" : "not-confirmed"}>{result.significant ? "통계적으로 관계 확인" : "통계적으로 관계 확인 안 됨"}</small>
              </article>
            ))}
          </div>
          <div className="relationship-reading"><p><strong>어떻게 읽나</strong>{relationship.interpretation}</p><p><strong>관리 시사점</strong>{relationship.management}</p></div>
        </section>
      ) : null}
    </section>
  );
}

function OverallRegressionSection({ config }: { config: ComparisonDashboardConfig }) {
  const model = config.overallRegression;
  if (!model) return null;

  const ranked = [...model.factors].sort((left, right) => {
    if (left.significant !== right.significant) return Number(right.significant) - Number(left.significant);
    return Math.abs(right.beta) - Math.abs(left.beta);
  });
  const significant = ranked.filter((factor) => factor.significant);
  const strongest = ranked[0];

  return (
    <section className="dashboard-panel overall-regression-panel" aria-labelledby={`overall-regression-${config.variant}`}>
      <div className="panel-heading overall-regression-heading">
        <div><span className="panel-number">ALL</span><div><h2 id={`overall-regression-${config.variant}`}>{model.title}</h2><p>{model.description}</p></div></div>
        <span className="method-pill">전체표본 · 유효 기준 p&lt;.05</span>
      </div>

      <div className="overall-model-kpis" aria-label="통합 회귀모형 핵심 지표">
        <div><span>분석 인원</span><strong>{model.n.toLocaleString("ko-KR")}명</strong><small>중앙·광역·기초 전체</small></div>
        <div><span>설명력 R²</span><strong>{model.r2.toFixed(3)}</strong><small>수정 R² {model.adjustedR2.toFixed(3)}</small></div>
        <div><span>유효 핵심요인</span><strong>{significant.length}개</strong><small>전체 {model.factors.length}개 중 p&lt;.05</small></div>
        <div><span>통제항</span><strong>{model.controlTerms}개</strong><small>기관유형 포함</small></div>
      </div>

      <div className="overall-model-grid">
        <div className="overall-coefficient-list" aria-label="전체표본 표준화 회귀계수">
          {ranked.map((factor, index) => (
            <div className="overall-coefficient-row" key={factor.id}>
              <div><span>{String(index + 1).padStart(2, "0")}</span><strong>{factor.label}</strong><small className={factor.significant ? "confirmed" : "not-confirmed"}>{factor.significant ? "유효" : "확인 안 됨"}</small></div>
              <i className="coefficient-track"><em className="zero-line" style={{ left: `${zeroPosition}%` }} /><b className={`coefficient-fill ${factor.significant ? "overall-significant" : "muted"}`} style={barGeometry(factor.beta, coefficientMin, coefficientMax, zeroPosition)} /></i>
              <strong>{signed(factor.beta)}</strong>
              <small>{formatP(factor.p)}</small>
            </div>
          ))}
        </div>

        <aside className="overall-reading-card">
          <span>전체를 합쳐 보면</span>
          <h3>{strongest.label}이 가장 큰 공통 동력입니다.</h3>
          <p>{model.interpretation}</p>
          <div><span>통계적으로 확인된 요인</span>{significant.map((factor) => <strong key={factor.id}>{factor.label} <b>β={factor.beta.toFixed(3)}</b></strong>)}</div>
          <small>{model.caution}</small>
        </aside>
      </div>

      <p className="chart-footnote">기관유형은 {model.institutionReference}를 기준으로 광역·기초자치단체 더미를 각각 통제했습니다. 아래 중앙·지방 비교모형은 같은 요인이 각 집단 안에서 어떻게 나타나는지 보여줍니다.</p>
    </section>
  );
}

function LeadershipProfileSection({ config }: { config: ComparisonDashboardConfig }) {
  const leadership = config.leadershipProfile;
  if (!leadership) return null;

  return (
    <section className="dashboard-panel leadership-profile-panel" aria-labelledby={`leadership-profile-${config.variant}`}>
      <div className="panel-heading leadership-profile-heading">
        <div><span className="panel-number">L</span><div><h2 id={`leadership-profile-${config.variant}`}>{leadership.title}</h2><p>{leadership.description}</p></div></div>
        <span className="method-pill">4유형 산술평균 · 회귀는 15문항 통합지수</span>
      </div>

      <div className="leadership-efa-strip">
        <strong>EFA 판단</strong>
        <span>KMO {leadership.efa.kmo.toFixed(3)}</span>
        <span>{leadership.efa.itemCount}문항 → {leadership.efa.retained}요인</span>
        <span>설명 {(leadership.efa.variance * 100).toFixed(1)}%</span>
        <span>최저 적재량 {leadership.efa.minimumLoading.toFixed(3)}</span>
        <p>네 명칭은 설문 보고서의 이론적 분류이고, 이번 EFA에서는 하나의 공통 리더십 요인으로 수렴했습니다.</p>
      </div>

      <div className="leadership-profile-grid">
        {leadership.profiles.map((profile) => (
          <article key={profile.id}>
            <div className="leadership-card-heading">
              <div><span>{profile.items.length}문항</span><h3>{profile.label}</h3></div>
              <div><strong>α {profile.alpha.toFixed(2)}</strong><small className={profile.inRegression ? "regression-in" : "mean-only"}>{profile.inRegression ? "회귀 투입" : "평균 비교"}</small></div>
            </div>
            <p>{profile.short}</p>

            <div className="leadership-means">
              <strong>현재 수준 · 가중 산술평균</strong>
              {([['a', config.groupA.short, profile.a], ['b', config.groupB.short, profile.b]] as const).map(([key, label, result]) => (
                <div key={key}><span>{label}</span><i><b className={`group-${key}`} style={{ width: `${(result.mean / 5) * 100}%` }} /></i><strong>{result.mean.toFixed(2)}</strong></div>
              ))}
              <small className="leadership-gap">평균차 {config.groupA.short}−{config.groupB.short} <b>{signed(profile.a.mean - profile.b.mean, 2)}</b> · {formatP(profile.meanDifferenceP)}</small>
            </div>

            {profile.regression ? (
              <div className="leadership-effects">
                <strong>혁신행동과 관계 · 완전통제모형</strong>
                {([['a', config.groupA.short, profile.regression.a], ['b', config.groupB.short, profile.regression.b]] as const).map(([key, label, result]) => (
                  <div key={key}>
                    <span>{label}</span>
                    <i className="leadership-effect-track"><em style={{ left: `${relationshipZero}%` }} /><b className={`group-${key} ${result.significant ? "significant" : "muted"}`} style={barGeometry(result.beta, relationshipMin, relationshipMax, relationshipZero)} /></i>
                    <strong>{signed(result.beta)}</strong>
                    <small>{formatP(result.p)}</small>
                  </div>
                ))}
                <small className={`leadership-result ${profile.regression.a.significant || profile.regression.b.significant ? "confirmed" : "not-confirmed"}`}>{profile.regression.a.significant || profile.regression.b.significant ? "한 집단 이상에서 통계적 관계 확인" : "두 집단 모두 통계적 관계 확인 안 됨"}</small>
              </div>
            ) : (
              <div className="leadership-descriptive-only"><strong>유형별 평균 비교</strong><span>개별 유형이 아닌 15문항 통합지수를 메인 회귀에 넣었습니다.</span></div>
            )}

            <details className="leadership-item-details">
              <summary>세부 문항 {profile.items.length}개 보기</summary>
              <div>
                {profile.items.map((item) => (
                  <article className="leadership-item-row" key={item.id}>
                    <p><span>{item.id}</span>{itemLabel(item.label)}</p>
                    {([['a', config.groupA.short, item.a], ['b', config.groupB.short, item.b]] as const).map(([key, label, mean]) => (
                      <div key={key}><span>{label}</span><i><b className={`group-${key}`} style={{ width: `${(mean / 5) * 100}%` }} /></i><strong>{mean.toFixed(2)}</strong></div>
                    ))}
                  </article>
                ))}
              </div>
            </details>
          </article>
        ))}
      </div>
      <aside className="leadership-field-insight" aria-label="리더십 결과의 공공 현업 해석">
        <div><span>현업에서는 이렇게 읽으세요</span><strong>{leadership.fieldInsight.title}</strong><p>{leadership.fieldInsight.body}</p></div>
        <ul>{leadership.fieldInsight.actions.map((action) => <li key={action}>{action}</li>)}</ul>
      </aside>
      <div className="leadership-method-note"><strong>어떻게 분석했나</strong><span>{leadership.method}</span><small>{leadership.caution}</small></div>
    </section>
  );
}

function CultureSection({ culture, config }: { culture: CultureConfig; config: ComparisonDashboardConfig }) {
  const [selectedCultureId, setSelectedCultureId] = useState<CultureDimension["id"]>("development");
  const selectedCulture = culture.dimensions.find((dimension) => dimension.id === selectedCultureId) ?? culture.dimensions[0];

  return (
    <section className="culture-grid" aria-labelledby="culture-heading">
      <article className="dashboard-panel cvf-panel">
        <div className="panel-heading">
          <div><span className="panel-number">06</span><div><h2 id="culture-heading">조직문화 차이 · Quinn 경쟁가치모형</h2><p>Q21 총 12문항 중 CVF용 8문항 · 유형별 2문항 산술평균</p></div></div>
          <PairLegend a={config.groupA.short} b={config.groupB.short} />
        </div>

        <div className="cvf-map">
          <span className="cvf-axis axis-top">유연성·재량</span>
          <span className="cvf-axis axis-bottom">안정·통제</span>
          <span className="cvf-axis axis-left">내부지향·통합</span>
          <span className="cvf-axis axis-right">외부지향·차별</span>
          <div className="cvf-quadrants">
            {culture.dimensions.map((dimension) => (
              <button className={`culture-quadrant ${dimension.position} ${selectedCulture.id === dimension.id ? "selected" : ""}`} key={dimension.id} onClick={() => setSelectedCultureId(dimension.id)} type="button">
                <div className="culture-title"><span>{dimension.alias}</span><div><strong>{dimension.label}</strong><small>{dimension.cue}</small></div></div>
                <div className="culture-score-row group-a-row"><span>{config.groupA.short}</span><i><b style={{ width: `${(dimension.a / 5) * 100}%` }} /></i><strong>{dimension.a.toFixed(2)}</strong></div>
                <div className="culture-score-row group-b-row"><span>{config.groupB.short}</span><i><b style={{ width: `${(dimension.b / 5) * 100}%` }} /></i><strong>{dimension.b.toFixed(2)}</strong></div>
                <div className="culture-gap"><span>평균차 {config.groupA.short}−{config.groupB.short}</span><strong>{signed(dimension.a - dimension.b, 2)}</strong></div>
                <small className="culture-variables">{dimension.variables.join(" · ")}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="culture-item-detail">
          <div><strong>{selectedCulture.label} 원문 항목</strong><span>사분면을 선택하면 바뀝니다 · 비가중 산술평균</span></div>
          <div className="culture-item-grid">
            {selectedCulture.items.map((item) => (
              <article key={item.id}>
                <p><span>{item.id}</span>{itemLabel(item.label)}</p>
                <div className="culture-score-row group-a-row"><span>{config.groupA.short}</span><i><b style={{ width: `${(item.a / 5) * 100}%` }} /></i><strong>{item.a.toFixed(2)}</strong></div>
                <div className="culture-score-row group-b-row"><span>{config.groupB.short}</span><i><b style={{ width: `${(item.b / 5) * 100}%` }} /></i><strong>{item.b.toFixed(2)}</strong></div>
              </article>
            ))}
          </div>
        </div>

        <p className="chart-footnote">사분면 위치는 문화의 좋고 나쁨이 아니라 초점의 차이를 뜻합니다. {culture.sourceNote}</p>
        <aside className="literature-card culture-literature-card" aria-label="조직문화 변수 선정 근거와 선행연구">
          <div className="literature-card-heading">
            <div><span>문화모형 근거</span><strong>왜 조직문화를 함께 보나</strong></div>
            <em>{culture.literature.basis}</em>
          </div>
          <p className="literature-why">{culture.literature.why}</p>
          <div className="literature-finding"><span>선행연구 요약</span><p>{culture.literature.finding}</p></div>
          <div className="literature-references" aria-label="조직문화 대표 선행연구">
            {culture.literature.references.map((reference) => reference.href ? (
              <a href={reference.href} key={reference.label} rel="noreferrer" target="_blank">{reference.label}</a>
            ) : <span key={reference.label}>{reference.label}</span>)}
          </div>
          {culture.literature.caution ? <small className="literature-caution">{culture.literature.caution}</small> : null}
        </aside>
      </article>

      <aside className="dashboard-panel culture-effect-panel">
        <div className="panel-heading compact">
          <div><span className="panel-number">07</span><div><h2>조직문화와 혁신행동</h2><p>완전 통제모형의 문화유형 계수</p></div></div>
        </div>
        <div className="reference-chip">기준범주 · {culture.referenceLabel}</div>
        <p className="culture-effect-explainer">같은 모형에서 기준문화보다 혁신행동이 얼마나 높거나 낮은지를 봅니다. 문화 평균 비교와는 다른 지표입니다.</p>
        <div className="culture-effect-list">
          {culture.effects.map((effect) => (
            <div className="culture-effect-row" key={effect.id}>
              <div className="culture-effect-title"><strong>{effect.label}</strong><span className={cultureStatusClass(effect)}>{cultureStatusLabel(effect, config.groupA.short, config.groupB.short)}</span></div>
              {([['a', config.groupA.short, effect.a], ['b', config.groupB.short, effect.b]] as const).map(([key, label, result]) => (
                <div key={key}>
                  <span>{label}</span>
                  <i className="culture-effect-track"><b className={`group-${key} ${result.significant ? "significant" : "muted"}`} style={barGeometry(result.beta, cultureMin, cultureMax, cultureZero)} /><em style={{ left: `${cultureZero}%` }} /></i>
                  <strong>{signed(result.beta)}</strong>
                  <small>{formatP(result.p)}</small>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="chart-footnote">색 막대는 해당 집단에서 p&lt;.05인 관계, 회색은 p≥.05입니다. 계수는 기준문화 대비 차이를 나타내며 인과효과가 아닙니다.</p>

        <div className="culture-distribution">
          <div><strong>우세문화 분포</strong><span>가중 비율</span></div>
          {([['a', config.groupA.short], ['b', config.groupB.short]] as const).map(([key, label]) => (
            <div className="distribution-row" key={key}>
              <span>{label}</span>
              <div className="distribution-bar">
                {culture.distribution.map((item) => <i className={`culture-${item.id}`} key={item.id} style={{ width: `${item[key] * 100}%` }} title={`${item.label} ${(item[key] * 100).toFixed(1)}%`} />)}
              </div>
            </div>
          ))}
          <div className="distribution-legend">
            {culture.distribution.map((item) => <span key={item.id}><i className={`culture-${item.id}`} />{item.label} <strong>{(item.a * 100).toFixed(0)}/{(item.b * 100).toFixed(0)}%</strong></span>)}
          </div>
        </div>
      </aside>
    </section>
  );
}

export default function ComparisonDashboard({ config, requestedYear }: { config: ComparisonDashboardConfig; requestedYear?: string }) {
  const ranked = useMemo(
    () => [...config.factors].sort((left, right) => {
      const leftSignal = Number(left.a.significant || left.b.significant);
      const rightSignal = Number(right.a.significant || right.b.significant);
      if (leftSignal !== rightSignal) return rightSignal - leftSignal;
      return Math.max(Math.abs(right.a.beta), Math.abs(right.b.beta)) - Math.max(Math.abs(left.a.beta), Math.abs(left.b.beta));
    }),
    [config.factors],
  );
  const [selectedId, setSelectedId] = useState(ranked[0]?.id ?? "");

  if (!ranked.length) {
    return <div className="empty-dashboard">표시할 분석 요인이 없습니다.</div>;
  }

  const selected = config.factors.find((factor) => factor.id === selectedId) ?? ranked[0];
  const shared = config.factors.filter((factor) => factor.a.significant && factor.b.significant);
  const aOnly = config.factors.filter((factor) => factor.a.significant && !factor.b.significant);
  const bOnly = config.factors.filter((factor) => !factor.a.significant && factor.b.significant);
  const outcomeGap = config.groupA.mean - config.groupB.mean;
  const significantCount = new Set([...shared, ...aOnly, ...bOnly].map((factor) => factor.id)).size;

  return (
    <div className={`compact-dashboard ${config.variant}`}>
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">{config.eyebrow}</p>
          <h1>{config.title}</h1>
          <p>{config.question}</p>
        </div>
        <div className="header-meta">
          <span>{config.source}</span>
          <strong>{config.sampleLabel}</strong>
          <small>완전 통제모형 · 통제개념 {config.controls.length}개</small>
        </div>
      </header>

      <SingleYearNotice year={config.analysisYear} requestedYear={requestedYear} note={`현재 이 자료의 문항 비교와 회귀는 ${config.analysisYear}년 결과만 분석했습니다. 다른 연도 결과로 바꾸려면 해당 자료의 문항 대응과 재분석이 필요합니다.`} />

      {config.scopeBanner ? <section className="scope-banner" aria-label="분석 범위 안내">{config.scopeBanner}</section> : null}
      <section className="scope-banner" aria-label="집단별 회귀 해석 범위">
        <strong>현재 수준의 차이와 관리요인의 효과 차이는 다릅니다.</strong>{" "}
        아래 β는 집단별 통제 후 연관성입니다. 한쪽만 p&lt;.05이거나 계수가 더 크다는 사실은 집단 간 효과 차이의 검정이 아닙니다.
        이 화면에는 직접 상호작용 검정이 없으며, 제안하는 관리 조치는 시범운영으로 검증할 가설입니다. AI 도입의 인과효과를 추정한 자료도 아닙니다.
      </section>

      <section className="executive-readout">
        <span>핵심 해석</span>
        <strong>{config.headline}</strong>
        <div><b>{significantCount}개</b> 집단 내 유의 요인 <i /> <b>{config.differenceStory.shortValue}</b> {config.differenceStory.shortLabel}</div>
      </section>

      <ChangeManagementSection config={config} onFactorSelect={setSelectedId} />

      <section className="kpi-grid" aria-label="혁신행동 핵심 지표">
        {[config.groupA, config.groupB].map((group, index) => (
          <article className={`kpi-card score-kpi group-${index === 0 ? "a" : "b"}`} key={group.label}>
            <div><span>혁신행동 평균</span><h2>{group.label}</h2><small>5점 기준 · 가중 산술평균 · n={group.n.toLocaleString("ko-KR")}</small></div>
            <div className="score-ring" style={scoreRing(group.mean)}><strong>{group.mean.toFixed(2)}</strong></div>
          </article>
        ))}
        <article className="kpi-card gap-kpi"><span>혁신행동 평균 차이</span><h2>{config.groupA.short} − {config.groupB.short}</h2><strong>{signed(outcomeGap, 2)}</strong><small>{formatP(config.outcomeGapP)}</small></article>
        <article className="kpi-card difference-kpi"><span>{config.differenceStory.kpi.label}</span><h2>{config.differenceStory.kpi.title}</h2><strong>{config.differenceStory.kpi.value}</strong><small>{config.differenceStory.kpi.note}</small></article>
      </section>

      <section className="dashboard-panel plain-language-panel" aria-labelledby={`plain-${config.variant}`}>
        <div className="plain-language-heading">
          <div><span>먼저 읽기</span><div><h2 id={`plain-${config.variant}`}>통계를 몰라도 이해되는 30초 해설</h2><p>관측된 통제변수를 반영한 연관성을 정리했습니다. 측정하지 못한 조건의 차이는 남아 있습니다.</p></div></div>
          <strong>명시된 통제변수 반영</strong>
        </div>
        <div className="plain-summary-grid">
          {config.plainSummary.map((item, index) => (
            <article key={item.label}>
              <span>{String(index + 1).padStart(2, "0")} · {item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
        <div className="number-guide" aria-label="통계 숫자 읽는 법">
          <strong>숫자 읽는 법</strong>
          <span><b>평균</b> 지금 어느 정도로 느끼는지</span>
          <span><b>β</b> 다른 조건이 같을 때 연결의 크기</span>
          <span><b>p&lt;.05</b> 자료에서 확인된 신호</span>
          <span><b>평균차</b> 두 집단의 현재 수준이 얼마나 다른지</span>
        </div>
      </section>

      <OverallRegressionSection config={config} />

      <section className="dashboard-main-grid" id={`effect-${config.variant}`}>
        <article className="dashboard-panel effect-panel">
          <div className="panel-heading">
            <div><span className="panel-number">01</span><div><h2>조직관리와 혁신행동의 통제 후 관계</h2><p>{config.factorSourceNote} · 명시된 통제 후 표준화 β</p></div></div>
            <span className="method-pill">집단 내 기준 p&lt;.05</span>
          </div>
          <div className="coefficient-axis" aria-hidden="true"><span>−.10</span><span>0</span><span>.10</span><span>.20</span><span>.30</span><span>.40</span><span>.50</span></div>
          <div className="coefficient-table">
            {ranked.map((factor, index) => (
              <button className={`coefficient-row ${selected.id === factor.id ? "selected" : ""}`} key={factor.id} onClick={() => setSelectedId(factor.id)} type="button">
                <div className="factor-cell"><span className="rank-number">{String(index + 1).padStart(2, "0")}</span><div><strong>{factor.label}</strong><small className={`status-chip ${statusClass(factor)}`}>{statusLabel(factor, config.groupA.short, config.groupB.short)}</small></div></div>
                <div className="paired-coefficients">
                  {([['a', config.groupA.short, factor.a], ['b', config.groupB.short, factor.b]] as const).map(([key, label, result]) => (
                    <div className="coefficient-line" key={key}><span>{label}</span><div className="coefficient-track"><i className="zero-line" style={{ left: `${zeroPosition}%` }} /><b className={`coefficient-fill group-${key} ${result.significant ? "significant" : "muted"}`} style={barGeometry(result.beta, coefficientMin, coefficientMax, zeroPosition)} /></div><strong className={result.significant ? "significant-number" : ""}>{result.beta.toFixed(3)}</strong><small>{formatP(result.p)}</small></div>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <p className="chart-footnote">색 막대는 해당 집단에서 p&lt;.05인 관계, 회색은 p≥.05입니다. 두 집단의 계수를 나란히 보되, 한쪽에서만 유의하다는 사실만으로 기관유형 차이가 확정되는 것은 아닙니다.</p>
        </article>

        <aside className="dashboard-panel valid-panel">
          <div className="panel-heading compact"><div><span className="panel-number">02</span><div><h2>유효 요인 요약</h2><p>통제 후에도 남은 연결</p></div></div></div>
          <div className="valid-summary-number"><strong>{significantCount}</strong><span>개 요인</span></div>
          <div className="valid-block shared"><span>두 집단 공통</span><NameList items={shared} /></div>
          <div className="valid-block group-a-block"><span>{config.groupA.label}에서 유효</span><NameList items={aOnly} /></div>
          <div className="valid-block group-b-block"><span>{config.groupB.label}에서 유효</span><NameList items={bOnly} /></div>
          <div className="difference-callout"><span>비교해서 읽는 법</span><strong>{shared.length ? `양쪽에서 유의한 관계 ${shared.length}개` : "양쪽 모두 유의한 관계 없음"}</strong><p>유의하지 않다는 결과는 관계가 없다는 증명이 아닙니다. 계수 순위는 관리 개입의 효과 순위가 아니며, 집단별 제안은 현장 검증을 위한 가설입니다.</p></div>
        </aside>
      </section>

      <LeadershipProfileSection config={config} />

      <DifferenceStorySection config={config} />

      <section className="secondary-grid">
        <article className="dashboard-panel level-panel">
          <div className="panel-heading"><div><span className="panel-number">04</span><div><h2>변수별 현재 수준 차이</h2><p>같은 변수·같은 1~5점 축의 가중 산술평균</p></div></div><PairLegend a={config.groupA.short} b={config.groupB.short} /></div>
          <div className="level-table">
            {config.factors.map((factor) => (
              <button className={selected.id === factor.id ? "selected" : ""} key={factor.id} onClick={() => setSelectedId(factor.id)} type="button">
                <strong>{factor.label}</strong>
                <div className="paired-level-bars"><div><span>{config.groupA.short}</span><i><b className="group-a" style={{ width: `${(factor.a.mean / 5) * 100}%` }} /></i><em>{factor.a.mean.toFixed(2)}</em></div><div><span>{config.groupB.short}</span><i><b className="group-b" style={{ width: `${(factor.b.mean / 5) * 100}%` }} /></i><em>{factor.b.mean.toFixed(2)}</em></div></div>
                <div className="level-gap"><span>평균차</span><strong>{signed(factor.a.mean - factor.b.mean, 2)}</strong><small>{formatP(factor.meanDifferenceP)}</small></div>
              </button>
            ))}
          </div>
        </article>

        <article className="dashboard-panel selected-panel">
          <div className="panel-heading compact"><div><span className="panel-number">05</span><div><h2>{selected.label}</h2><p>선택 변수 상세</p></div></div><span className="alpha-pill">α {selected.alpha.toFixed(2)}</span></div>
          <p className="factor-definition">{selected.short}</p>
          <div className="selected-numbers"><div><span>{config.groupA.short} β</span><strong>{selected.a.beta.toFixed(3)}</strong><small>{formatP(selected.a.p)}</small></div><div><span>{config.groupB.short} β</span><strong>{selected.b.beta.toFixed(3)}</strong><small>{formatP(selected.b.p)}</small></div><div><span>현재 평균차</span><strong>{signed(selected.a.mean - selected.b.mean, 2)}</strong><small>{formatP(selected.meanDifferenceP)}</small></div></div>
          <div className="plain-insight"><span>현업 해석</span><p>{selected.insight}</p></div>
          <aside className="literature-card" aria-label={`${selected.label} 변수 선정 근거와 선행연구`}>
            <div className="literature-card-heading">
              <div><span>선정 근거</span><strong>왜 이 변수를 넣었나</strong></div>
              <em>{selected.literature.basis}</em>
            </div>
            <p className="literature-why">{selected.literature.why}</p>
            <div className="literature-finding"><span>선행연구 요약</span><p>{selected.literature.finding}</p></div>
            <div className="literature-references" aria-label="대표 선행연구">
              {selected.literature.references.map((reference) => reference.href ? (
                <a href={reference.href} key={reference.label} rel="noreferrer" target="_blank">{reference.label}</a>
              ) : <span key={reference.label}>{reference.label}</span>)}
            </div>
            {selected.literature.caution ? <small className="literature-caution">{selected.literature.caution}</small> : null}
          </aside>
          <div className="item-list-head"><strong>원문 항목별 산술평균</strong><span>가중치 미적용</span></div>
          <div className="item-list">
            {selected.items.map((item) => (
              <div className="item-row" key={item.id}><p><span>{item.id}</span>{itemLabel(item.label)}</p><div><span>{config.groupA.short}</span><i><b className="group-a" style={{ width: `${(item.a / 5) * 100}%` }} /></i><strong>{item.a.toFixed(2)}</strong></div><div><span>{config.groupB.short}</span><i><b className="group-b" style={{ width: `${(item.b / 5) * 100}%` }} /></i><strong>{item.b.toFixed(2)}</strong></div></div>
            ))}
          </div>
        </article>
      </section>

      {config.culture ? <CultureSection culture={config.culture} config={config} /> : null}

      <ItemAtlasSection config={config} />

      <section className="bottom-grid">
        <article className="dashboard-panel outcome-panel">
          <div className="panel-heading compact"><div><span className="panel-number">{config.culture ? "09" : "07"}</span><div><h2>혁신행동 문항</h2><p>문항별 단순 산술평균</p></div></div><span className="alpha-pill">α {config.outcomeAlpha.toFixed(2)}</span></div>
          <div className="outcome-items">
            {config.outcomeItems.map((item) => <div key={item.id}><p><span>{item.id}</span>{item.label}</p><div><span>{config.groupA.short}</span><i><b className="group-a" style={{ width: `${(item.a / 5) * 100}%` }} /></i><strong>{item.a.toFixed(2)}</strong></div><div><span>{config.groupB.short}</span><i><b className="group-b" style={{ width: `${(item.b / 5) * 100}%` }} /></i><strong>{item.b.toFixed(2)}</strong></div></div>)}
          </div>
        </article>

        <article className="dashboard-panel controls-panel">
          <div className="panel-heading compact"><div><span className="panel-number">{config.culture ? "10" : "08"}</span><div><h2>회귀모형 통제변수</h2><p>{config.controlTermsLabel ?? `${config.controlTerms}개 더미·연속항을 실제 투입`}</p></div></div><span className="method-pill">FULL CONTROL</span></div>
          <div className="model-formula"><strong>실제 회귀식</strong><code>{config.modelFormula}</code></div>
          <div className="control-chips">{config.controls.map((control) => <span key={control}>{control}</span>)}</div>
          <p className="control-summary">{config.controlSummary}</p>
          <div className="control-research-note"><strong>왜 통제했나</strong><span>{config.controlResearchNote}</span></div>
          <div className="validation-metrics"><div><span>영향요인 EFA</span><strong>{config.factorValidation.retained}요인</strong><small>{config.factorValidation.itemCount}문항</small></div><div><span>KMO</span><strong>{config.factorValidation.kmo.toFixed(3)}</strong><small>설명 {(config.factorValidation.variance * 100).toFixed(1)}%</small></div><div><span>최저 주적재량</span><strong>{config.factorValidation.minimumLoading.toFixed(3)}</strong><small>요인 구성 점검</small></div><div><span>{config.groupA.short} R²</span><strong>{config.groupA.r2.toFixed(3)}</strong><small>핵심 VIF {config.groupA.maxFactorVif.toFixed(2)}</small></div><div><span>{config.groupB.short} R²</span><strong>{config.groupB.r2.toFixed(3)}</strong><small>핵심 VIF {config.groupB.maxFactorVif.toFixed(2)}</small></div></div>
          <p className="control-validation">{config.controlValidation}</p>
        </article>
      </section>

      <details className="method-details"><summary>조작적 정의·분석방법·주의사항 자세히 보기</summary><div><p><strong>조작적 정의</strong>{config.operationalNote}</p><p><strong>분석 순서</strong> 탐색적 요인분석 → 자료별 조작적 정의에 따른 문항 산술평균 → 전체 표본 기준 표준화 → {config.overallRegression ? "전체표본 및 " : ""}집단별 가중 WLS 회귀(HC3)와 모든 통제변수 반영.</p><p><strong>해석 기준</strong> 유효 요인은 p&lt;.05입니다. β와 문화유형 계수는 인과효과가 아니라 다른 변수를 통제한 뒤의 연관성입니다.</p>{config.warnings.map((warning) => <p className="warning-line" key={warning}><strong>주의</strong>{warning}</p>)}</div></details>

      <footer className="dashboard-footer"><strong>INNOVATION IMPACT DASHBOARD</strong><span>{config.footer}</span></footer>
    </div>
  );
}
