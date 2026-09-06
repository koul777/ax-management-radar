"use client";

type Props = {
  id: string;
  years: number[];
  value: string;
  onChange: (value: string) => void;
  allowAll?: boolean;
  disabled?: boolean;
  note?: string;
  label?: string;
};

export default function YearSelector({ id, years, value, onChange, allowAll = false, disabled = false, note, label = "연도" }: Props) {
  const options = [...new Set(years)].sort((a, b) => b - a);
  return <label className="year-selector" htmlFor={id}>{label}<select id={id} value={value} disabled={disabled} aria-describedby={note ? `${id}-note` : undefined} onChange={(event) => onChange(event.target.value)}>{allowAll ? <option value="all">모든 연도 · 연도별로 구분</option> : null}{options.map((year) => <option key={year} value={String(year)}>{year}년</option>)}</select>{note ? <small id={`${id}-note`}>{note}</small> : null}</label>;
}

export function SingleYearNotice({ year, note, requestedYear }: { year: number; note: string; requestedYear?: string }) {
  return <div className="supplemental-filters single-year-notice" role="group" aria-label="분석 연도"><YearSelector id={`analysis-year-${year}`} years={[year]} value={String(year)} onChange={() => {}} disabled note={note} />{requestedYear && requestedYear !== "all" && requestedYear !== String(year) ? <p role="status">요청한 {requestedYear}년 결과는 아직 분석되지 않았습니다. 현재 검증된 {year}년 결과를 표시합니다.</p> : null}</div>;
}
