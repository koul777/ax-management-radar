export type Unit =
  | "percent"
  | "institutions"
  | "persons"
  | "KRW_100million"
  | "cases"
  | "index_0_100";

export type ValueStatus = "observed" | "not_asked";
export type AggregationLevel =
  | "institution_type"
  | "institution_group"
  | "procurement_or_institution_group"
  | "workplace_group"
  | "respondent_group"
  | "company_group"
  | "institution_benchmark_or_respondent_group"
  | "country_group";

export interface Observation {
  observation_id: string;
  source_id: string;
  metric_id: string;
  metric_label: string;
  reference_period: string;
  year: number | null;
  group_label: string;
  value: number | null;
  unit: Unit;
  value_status: ValueStatus;
  aggregation_level: AggregationLevel;
  denominator_label: string;
  source_location: string;
  source_url: string;
  notes: string;
  retrieved_on: string;
}

export interface Metric {
  metric_id: string;
  source_id: string;
  metric_label: string;
  unit: Unit;
  aggregation_level: AggregationLevel;
}

export interface SourceCatalogEntry {
  source_id: string;
  novelty: "new" | "existing_extension";
  priority: "P0" | "P1" | "P2" | "확장";
  title: string;
  provider: string;
  reference_period: string;
  population: string;
  available_variables: string;
  available_formats: string;
  verification_status: string;
  access_status: string;
  license_note: string;
  known_limits: string;
  landing_url: string;
  resource_url: string | null;
  included_data_files: string[];
  retrieved_on: string;
}

export type FiveLevelGrade = "매우우수" | "우수" | "보통" | "미흡" | "매우미흡";
export interface AgencyEvaluation {
  record_id: string;
  source_id: string;
  evaluation_name: string;
  institution_name: string;
  institution_category: string;
  source_subtype: string | null;
  canonical_institution_id: string | null;
  evaluation_year: number;
  grade: FiveLevelGrade | "평가제외";
  record_status: "graded" | "excluded";
  source_page: number;
  publication_date: string;
  source_url: string;
  retrieved_on: string;
}

export interface LocalEnterpriseEvaluation {
  record_id: string;
  source_id: "D04";
  source_row_number: number;
  institution_name: string;
  canonical_institution_id: string | null;
  evaluation_year: number;
  performance_year: number;
  grade: "가" | "나" | "다" | "라" | "마" | "대상아님" | "기타";
  record_status: "graded" | "not_applicable" | "other";
  name_collision: boolean;
  notes: string;
  source_url: string;
  retrieved_on: string;
}

export interface VariableMapEntry {
  source_id: string;
  variable_code: string;
  meaning: string;
  scale: string;
  verified_scope: string;
  notes: string;
  source_url: string;
}

export interface InstitutionCrosswalkEntry {
  source_id: string;
  institution_name: string;
  source_row_number: number | null;
  canonical_institution_id: string;
  valid_from: string | null;
  valid_to: string | null;
  evidence_url: string;
  reviewed_on: string;
}
