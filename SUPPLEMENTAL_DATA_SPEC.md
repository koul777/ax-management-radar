# 추가 자료 분석·화면 계약 (2026-09-06)

사용자 요청: HCCP를 공개 대시보드에서 제외하고 다른 제공자료를 실제 화면에 추가한다. 원자료·과거 분석 코드는 삭제하지 않는다. 공공/민간 직접 비교와 공공 내부·개인·시민서비스 보조 분석을 분리한다.

## 공개 JSON

각 담당자는 `{ "datasets": [ ... ] }` 번들을 생성한다. 모든 결과는 재현 가능한 코드로 계산한 집계이며 원자료 행, 자유응답, 식별자, 절대 경로를 포함하지 않는다. 초기 분석은 비가중 응답표본 분포이다. 적합한 조사설계를 검증하기 전 대표성·인과효과를 주장하지 않는다.

각 dataset 필수 필드:

- `id`, `title`, `source_label`, `years` (숫자 배열), `unit`, `scope_type` (`public_internal`, `public_private_workers`, `individual_ai`, `citizen_services`), `status` (`descriptive`, `descriptive_and_regression`, `audit_only`, `unavailable`)
- `scope` (자료가 답하는 질문과 답하지 못하는 범위)
- `sample`: `{raw_n, analysis_n, excluded_n, groups:[{id,label,n}]}`. 모든 N은 정수. 비분석 상태는 N=null 가능.
- `weight_note`, `cautions` (문자열 배열), `questions` (아래 계약), `action_questions` (실무 점검 질문 배열)
- `evidence`: `[{label,url,note}]`. 공개 출처/본문·초록 확인 수준을 note에 명시. 실제 변수 선정 근거와 이번 자체 분석을 구분한다.
- `models`: 기존 `AnalysisModel`과 호환되는 배열, 기본 `[]`. 사전 변수 선정 근거·측정·통제를 팀장에게 공유한 뒤 적합. 다중회귀도 인과효과 아님.
- 선택: `transitions`: `[{label,period,unit,n,rows:[{from,to,n}],note}]` (동일인 연결이 검증된 경우에만; 응답별 행 금지).
- 선택: `findings`: `[{title,body}]` (실제 계산값과 한계를 연결; 효과·원인 주장 금지).

각 question:

- `id`, `label`, `dimension`, `period`, `universe`, `scale`, `source_code`, `source_note`
- `groups`: `[{id,label,eligible_n,valid_n,missing_n,unknown_n,responses:[{code,label,n,share}]}]`
- 비율은 valid_n 중 응답코드 n/valid_n (0~1). 합계는 1이며 valid_n=0이면 share=null. 결측·모름·비대상 구분, 모름이 유효 보기이면 분모에 포함하고 unknown_n도 명시한다.
- 단순평균 합성척도를 임의로 만들지 않는다. 문항 분포를 먼저 보이며 순서척도 방향을 명시한다. 구성 타당성이 검증된 경우에만 별도 합성·회귀.

## 공개 제외

KIPA 사용 조건이 미확인인 데이터에는 `publication_status: pending_usage_confirmation`을 붙이고 공개 JSON 자체에서 `sample:null`, `questions:[]`, `models:[]`, `findings:[]`로 수치를 제외한다. 화면에서만 숨기지 않는다. 원자료 재집계는 `.tmp`에 보존한다. `transitions`는 검증된 동일인 응답 변화만 기술통계로 표시한다. 연도별 행수의 합은 고유 인원수가 아닌 사람-시점 수로 명시한다.

HCCP 원자료·산출물은 작업공간에서 보존한다. 공개 컴포넌트에서 import하지 않고 배포 업로드에서도 제외한다. 기존 `?view=hccp`는 WPS로 조용히 대체하지 않고 ‘현재 구성에서 제외’ 안내와 새 자료 링크로 처리한다. HCCP 문헌 카드는 활성 문헌표에서 제외하되 내부 감사 기록은 남긴다.

## 검증

원본 불변, 명시된 ZIP 엔트리만 안전한 `.tmp` 경로에 추출, 중복 파일 형식을 합치지 않음, 실제 응답/취업/임금근로자/문항분기 필터, ID 유일성, N/비율 합계, 문항별 결측·모름, 공공 분류를 테스트한다. 원자료를 공개 도구나 서비스에 업로드하지 않는다.
