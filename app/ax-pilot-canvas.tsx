"use client";

import { useState, type ChangeEvent } from "react";

type PilotFields = {
  task: string;
  problem: string;
  baseline: string;
  procedure: string;
  owner: string;
  approver: string;
  comparison: string;
  aiUse: string;
  outcomes: string;
  stopRule: string;
  days0to30: string;
  days31to60: string;
  days61to90: string;
};

const initialFields: PilotFields = { task: "", problem: "", baseline: "", procedure: "", owner: "", approver: "", comparison: "", aiUse: "", outcomes: "", stopRule: "", days0to30: "", days31to60: "", days61to90: "" };

function valueOrUnset(value: string) { return value.trim() || "미정"; }

type FieldProps = {
  id: keyof PilotFields; label: string; hint: string; placeholder: string; multiline?: boolean;
  fields: PilotFields; onChange: (id: keyof PilotFields, value: string) => void;
};

function PilotField({ id, label, hint, placeholder, multiline = false, fields, onChange }: FieldProps) {
  const sharedProps = {
    id: `ax-pilot-${id}`, value: fields[id], placeholder,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(id, event.target.value),
    "aria-describedby": `ax-pilot-${id}-hint`,
  };
  return <div className="ax-pilot-field">
    <label htmlFor={`ax-pilot-${id}`}>{label}</label>
    {multiline ? <textarea rows={3} {...sharedProps} /> : <input type="text" {...sharedProps} />}
    <small id={`ax-pilot-${id}-hint`}>{hint}</small>
  </div>;
}

export function AxPilotCanvas() {
  const [fields, setFields] = useState<PilotFields>(initialFields);
  const change = (id: keyof PilotFields, value: string) => setFields((current) => ({ ...current, [id]: value }));
  const reset = () => setFields(initialFields);
  return <section className="ai-panel ax-pilot-canvas" aria-labelledby="ax-pilot-title">
    <div className="ai-panel-heading"><div><span>90-DAY PILOT CARD</span><div><h2 id="ax-pilot-title">AI 업무 한 건의 90일 시범운영·평가 카드</h2><p>AI를 도입할 업무 한 건을 작게 정하고, 관리 절차·비교조건·측정·중단 기준을 같은 화면에서 의사결정 기록으로 남깁니다.</p></div></div></div>
    <div className="ax-pilot-notice" role="note"><strong>브라우저 안에서만 작성</strong><span>입력 내용은 저장·서버 전송·외부 업로드되지 않으며, 새로고침하면 초기화됩니다. 개인·민감정보나 식별 가능한 사례는 입력하지 마세요.</span></div>
    <div className="ax-pilot-layout">
      <div className="ax-pilot-form">
        <fieldset><legend>1. 대상 업무와 관리조치</legend><div className="ax-pilot-field-grid">
          <PilotField id="task" label="대상 업무" hint="AI를 적용할 업무 단위를 한 건으로 좁힙니다." placeholder="예: 민원 답변 초안 검토" fields={fields} onChange={change} />
          <PilotField id="baseline" label="현재 문제와 기준기간" hint="도입 전 수치를 기록할 기간을 함께 적습니다." placeholder="예: 4월 한 달, 평균 3.2일 소요·재작업 18건" fields={fields} onChange={change} />
        </div><PilotField id="problem" label="해결하려는 문제" hint="막연한 효율화 대신 현재 병목·오류·접근성 문제를 적습니다." placeholder="예: 담당자별 검토 순서가 달라 답변 지연과 누락이 반복됨" multiline fields={fields} onChange={change} />
        <PilotField id="procedure" label="변경할 관리 절차" hint="‘교육 실시’가 아니라 실제로 바꿀 순서·검토·승인 절차를 씁니다." placeholder="예: 초안 생성 → 담당자 사실확인 → 팀장 표본검토 → 발송 전 오류 태그 기록" multiline fields={fields} onChange={change} /></fieldset>
        <fieldset><legend>2. 책임·비교·측정</legend><div className="ax-pilot-field-grid">
          <PilotField id="owner" label="책임자" hint="시범운영을 매일 확인할 역할을 지정합니다." placeholder="예: 민원혁신팀 운영책임자" fields={fields} onChange={change} />
          <PilotField id="approver" label="승인권한" hint="확대·중단·절차 변경을 승인할 권한을 적습니다." placeholder="예: 과장 — 30일·60일 점검 승인" fields={fields} onChange={change} />
        </div><PilotField id="comparison" label="비교조건 또는 비교부서" hint="동일 업무의 기존 절차·유사 부서·동일 기간 기준을 명시합니다." placeholder="예: AI 미사용 A팀의 같은 민원유형, 같은 4주" fields={fields} onChange={change} /><div className="ax-pilot-field-grid">
          <PilotField id="aiUse" label="AI 실제 사용 지표" hint="접속 여부가 아니라 업무에 실제 쓴 정도를 측정합니다." placeholder="예: 대상 80건 중 초안 생성 후 검토 완료 비율" fields={fields} onChange={change} />
          <PilotField id="outcomes" label="객관적 결과 지표" hint="처리시간, 오류·재작업, 이용자 불편·접근성 등을 수치로 둡니다." placeholder="예: 중앙 처리시간·오류 태그·민원 불편 건수" fields={fields} onChange={change} />
        </div></fieldset>
        <fieldset><legend>3. 위험과 90일 점검</legend><PilotField id="stopRule" label="위험·중단 또는 수정 기준" hint="어떤 신호에서 즉시 중단·수정·재승인할지 사전에 정합니다." placeholder="예: 사실오류 2건 또는 접근성 불편 3건 발생 시 즉시 중단 후 재검토" multiline fields={fields} onChange={change} /><div className="ax-pilot-check-grid">
          <PilotField id="days0to30" label="0~30일 점검" hint="기준선 확인과 절차 적합성 점검" placeholder="예: 표본 20건 검토, 오류 태그 기준 합의" multiline fields={fields} onChange={change} />
          <PilotField id="days31to60" label="31~60일 점검" hint="사용·결과 지표와 위험 신호 점검" placeholder="예: 비교부서와 처리시간·재작업 차이 확인" multiline fields={fields} onChange={change} />
          <PilotField id="days61to90" label="61~90일 점검" hint="확대·수정·중단 결정을 위한 종합 점검" placeholder="예: 결과·위험·현장 의견을 묶어 승인권자 판단" multiline fields={fields} onChange={change} />
        </div></fieldset>
      </div>
      <aside className="ax-pilot-summary" aria-live="polite" aria-label="최소 평가 계약 요약"><div><span>MINIMUM EVALUATION CONTRACT</span><h3>최소 평가 계약</h3><p>입력한 내용을 한 장의 판단 기준으로 요약합니다.</p></div><ol>
        <li><strong>문제</strong><span>{valueOrUnset(fields.problem)}</span></li><li><strong>조치</strong><span>{valueOrUnset(fields.procedure)}</span></li><li><strong>비교</strong><span>{valueOrUnset(fields.comparison)}</span></li><li><strong>측정</strong><span>{valueOrUnset(fields.aiUse)} / {valueOrUnset(fields.outcomes)}</span></li><li><strong>중단</strong><span>{valueOrUnset(fields.stopRule)}</span></li>
      </ol><dl><div><dt>대상 업무</dt><dd>{valueOrUnset(fields.task)}</dd></div><div><dt>기준기간</dt><dd>{valueOrUnset(fields.baseline)}</dd></div><div><dt>책임·승인</dt><dd>{valueOrUnset(fields.owner)} / {valueOrUnset(fields.approver)}</dd></div></dl><div className="ax-pilot-roadmap" aria-label="90일 점검 계획 요약"><div><b>0~30일</b><span>{valueOrUnset(fields.days0to30)}</span></div><div><b>31~60일</b><span>{valueOrUnset(fields.days31to60)}</span></div><div><b>61~90일</b><span>{valueOrUnset(fields.days61to90)}</span></div></div><button type="button" className="ax-pilot-reset" onClick={reset} aria-label="90일 시범운영 평가 카드 입력 초기화">입력 초기화</button></aside>
    </div>
    <p className="ax-pilot-caution">사전·사후 기록과 비교조건은 판단을 개선하지만, 단순 전후 비교만으로 인과효과가 입증되는 것은 아닙니다. 이 카드는 시범 운영의 의사결정 기록이며, 확대·중단 판단에 필요한 근거를 빠뜨리지 않기 위한 도구입니다.</p>
  </section>;
}
