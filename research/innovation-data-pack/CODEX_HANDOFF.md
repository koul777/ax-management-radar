# Codex 작업 지시서: 공공기관 혁신 데이터 추가

## 목표와 시작점

[koul777/public-private-innovation-dashboard](https://github.com/koul777/public-private-innovation-dashboard)에 추가할 데이터를 준비한 패키지다. **포함된 검증 데이터부터 읽어 기존 대시보드에 추가하고, 아직 확보하지 못한 원자료는 수집 목록으로 처리한다.** 이 문서는 조사 결과와 적용 순서를 전달하며, UI 구현이나 저장소 변경을 이미 수행했다는 뜻은 아니다.

먼저 현재 체크아웃의 `AGENTS.md`, `package.json`, 데이터 구조를 읽는다. 조사 당시 `main`은 vinext·React·TypeScript를 사용했고, JSON import가 가능했다. 기존 핵심 파일은 다음과 같다.

| 기존 파일 | 이미 포함된 조사 | 중복 판단 |
|---|---|---|
| `app/data/innovation-analysis.json` | KIPA2024 공사조직, 2,020명 | 신규 자료로 다시 세지 않는다. |
| `app/data/central-local-analysis.json` | KIPA2025 공직생활, 6,084명 | 신규 자료로 다시 세지 않는다. |

기존 공사조직 조사의 공공집단은 중앙·광역 **공무원**이다. 새 ALIO의 **공공기관**과 같은 모집단이라고 가정하지 않는다. 기존 결과는 집계 데이터이며 개인 원자료가 저장소에 있다는 전제로 새 회귀분석을 만들지 않는다.

## 1. 패키지 확인

패키지를 저장소 루트의 `research/innovation-data-pack/`에 두었다면 다음을 실행한다.

```bash
python3 research/innovation-data-pack/scripts/validate_data.py
```

성공 조건은 JSON 오류·ID 중복·출처 누락이 없고, 아래 합계가 맞는 것이다.

| 파일 | 행수 | 의미 |
|---|---:|---|
| `source-catalog.json` | 38 | 신규36 + 기존 자료 확장2 |
| `agency-evaluations.json` | 1,554 | 684 + 684 + 186 기관별 평가 기록 |
| `local-enterprise-evaluations.json` | 2,150 | 공시 화면430행 × 평가연도5개 |
| `observations.json` | 278 | 숫자275 + 미조사3 |
| `metrics.json` | 81 | 공개 통계의 지표 정의 |
| `variable-map.json` | 32 | 실제 확인한 설문 코드 매핑 |

등급 데이터의 3,704행 전체가 유효등급은 아니다. 지방공기업에는 `대상아님`821행·`기타`2행, 고객만족도에는 `평가제외`3행이 있다. `record_status === "graded"`인 합계는 2,878행이다.

## 2. 먼저 연결할 데이터

| 순서 | source_id | 사용 파일 | 바로 추가할 정보 |
|---|---|---|---|
| 1 | D01, D02, D03 | `agency-evaluations.json` | 기관별 데이터 행정·데이터 개방·고객만족 등급 |
| 2 | D04 | `local-enterprise-evaluations.json` | 지방공기업 평가연도2021~2025 추이 |
| 3 | D05 | `observations.json` | 2026.6말 AI 전담인력·조직·예산·활용사례 |
| 4 | D06, D07, D10 | `observations.json` | 공공 AI 도입·조직조건, 실제 계약, AI 교육·지원·장애 |
| 5 | D09, D14 | `observations.json` | 개선제안제도·소집단활동·회의/보고/조직문화 개선 추이 |
| 6 | D15, D32, D33, D35 | `observations.json` | 기업혁신·해외 직원조사 참고 지표 |

`source-catalog.json`의 `included_data_files`가 빈 배열이면 이 패키지에 수록된 통계값은 없다. `verification_status`와 `access_status`를 보고 실제 파일 확보인지, 파일목록 또는 메타데이터 확인인지를 구별한다. 출처36종을 모두 수치가 확보된36개 데이터셋으로 표시하면 안 된다.

## 3. 데이터 규약

타입은 `types.ts`, 앱용 조회·표시 예제는 `examples/query.ts`를 사용한다. `node research/innovation-data-pack/examples/query.mjs`는 추가 설치 없이 바로 실행할 수 있다.

### 통계

관측치의 식별 조합은 `source_id + metric_id + reference_period + group_label`이다. `observation_id`는 해당 조합의 고정 해시다. 시계열은 같은 출처·지표·집단 안에서만 만든다.

| 필드 | 처리 |
|---|---|
| `value` | 숫자 또는 null. 문자열로 변환해 저장하지 않는다. |
| `unit: percent` | 0~100 단위. 43.1은43.1%. `Intl`의 percent 형식에 바로 넣지 않는다. |
| `unit: index_0_100` | 0~100점 지수. 긍정응답률과 구별한다. |
| `unit: KRW_100million` | 억원. 원 단위가 필요하면100,000,000을 곱한다. |
| `value_status: not_asked` | 2020 KWMP의 미조사3건. null을0으로 채우지 않는다. |
| `reference_period` | 표시용 기준기간. 2022~2024 실적 같은 다년 기간을 보존한다. |
| `year` | 단일 연도만 숫자. 날짜·다년기간은 null이다. |
| `denominator_label` | 분모와 가중치 설명. 표본수가 아니면 임의 n값을 만들지 않는다. |
| `source_location` | 원문 표·쪽·문단의 위치. |

지표 ID는 이 패키지 버전 내에서 고정된다. 신규 지표를 추가할 때 기존 ID를 재배정하지 않는다. `metrics.json`에서 지표명을 찾아 ID를 선택하면 된다.

### 기관별 기록

- `grade`는 원문 범주다. 가~마 또는 매우우수~매우미흡을 임의의 숫자 점수로 바꾸지 않는다.
- D04의 `evaluation_year`와 `performance_year`는1년 차이다. 다른 조사에 이 규칙을 자동 적용하지 않는다.
- `institution_name`은 공시 당시 이름이다. 기관 통폐합·명칭변경을 자동 추정하지 않는다.
- `canonical_institution_id`는 현재 모두 null이다. `data/institution-crosswalk.json`은 검토된 기관키를 추가할 자리다.
- **고성군상수도 동명2행**은 `source_row_number`로 구분한다. 기관명만을 키로 삼으면 잘못 합쳐진다.

## 4. 표시할 출처와 해석 범위

각 데이터 영역에 출처명·기준기간·단위·분모 또는 집계방식을 보여준다. 상세보기에는 `known_limits`와 원문 링크를 연결한다. 다음은 구현에 영향을 주는 차이들이다.

| 자료 | 구현 시 유지할 의미 |
|---|---|
| [D05 ALIO](https://alio.go.kr/statistics/aiUtilStatus.do) | 기관유형 집계. 기관별 AI 값이 아니며 사례는2026.6말 누적. |
| [D06 SPRi 조사](https://spri.kr/posts/view/23653?code=data_all&study_type=research) | 조사2022, 게시2023. 전체400·도입/예정295·도입220 등 문항 분모가 다르다. |
| [D07 SPRi 조달](https://spri.kr/download/23669) | AI를 포함한 계약 건수. 직원 AI 사용률·순수 AI 투자액이 아니다. 자체조달 누락·OCR/TTS 포함. |
| [D09 WPS](https://www.kli.re.kr/board.es?act=view&bid=0032&list_no=148136&mid=a60104000000) | 수록값은 공공·민간 사업체 합계. 공공부문 재집계는 원자료의 부문코드 확인 후 가능. |
| [D10 KEIS](https://www.keis.or.kr/keis/ko/proj/113/pblc/detail.do?categoryIdx=131&pubIdx=11274) | 이미 AI를 쓰는305명 대상. 공공기관 도입률이나 전국 기업 보급률로 표시하지 않는다. |
| [D14 KWMP](https://www.kwdi.re.kr/inc/download.do?ut=A&upIdx=133658&no=1) | 수록값은2020~2024. 2025 보고서 발간연도와 관측연도를 구별한다. |
| [D15 KIS](https://www.nkis.re.kr/subject_view1.do?otpId=ACPT_000000000047942&otpSeq=0) | 2025 서비스업 조사는2022~2024 기업혁신 실적. 개인 혁신행동과 다르다. |
| [D32 APS](https://www.apsc.gov.au/sites/default/files/2025-09/2025%20APS%20Overall%20results.pdf) | 긍정응답률과 혁신환경지수68점을 구별한다. |
| [D33 영국](https://www.gov.uk/government/publications/civil-service-people-survey-2025-results/civil-service-people-survey-2025-results-highlights) | 전체 벤치마크는 기관별 응답비율의 중앙값. DSIT·HMRC·DWP 값은 해당 기관 응답비율. |
| [D35 OECD](https://www.oecd.org/en/publications/workforce-insights-from-central-governments_2f9080b1-en/full-report/learning-development-and-innovation_71c2715b.html) | 국가 동일가중 평균. 학습지수는EU7, 혁신지수는EU8. 한국 미포함. |

D07 보고서 안의401/402·85.7/85.9 불일치는 수록 주석에 남겼다. 현재 수록값은 표3-4·3-9를 사용한다. 출처 안의 다른 요약값으로 덮어쓰지 않는다. NIA의32.9%, KISDI의13.7→31.6%, APS의제안86%는 원표·분모 또는 문항 검증이 충분하지 않아 수록하지 않았다.

## 5. 후속 원자료 수집

`metadata/collection-backlog.json`에 출처별 다음 작업과 접근상태가 있다. 우선순위는 아래와 같다.

1. **D08 KIPA 생성형 AI 공무원 조사:** SAV/XLSX·설문 파일목록 확인. 1,608명. 사용·장애·조직조건을 새로 집계할 수 있다.
2. **D11 노동패널:** `p270401`에서3=정부 외 공공기관,5=정부기관. 소통·공정성·성장 만족도는1긍정~5부정이므로 방향을 확인한다.
3. **D12 근로환경조사:** 공개2023 CSV·설명서에서 부문·자율성·참여의 최신 변수코드부터 확인한다.
4. **D13 인적자본기업패널:** `W23Q25A/B/C` 등 민간 혁신문화. 공기업은 모집단에서 제외되므로 민간 참고집단으로 쓴다.
5. **D16 NIA 기업정보화통계:** AI 표272~300쪽을 확보해 분모를 확인한다.

신청형·로그인형·서비스키형 자료는 실제 접근 조건을 따른다. 파일 제공목록이 존재한다는 사실만으로 다운로드나 API 호출에 성공했다고 기록하지 않는다. 응답자별 원자료를 새로 확보하면 이용조건을 확인해 집계 결과의 공개 범위를 정한다.

## 6. 통합 후 확인

현재 저장소에서 확인한 명령은 `npm run build`, `npm run lint`, `npm test`다. 실제 체크아웃의 스크립트를 읽고 해당 변경에 필요한 검증을 실행한다. 패키지 데이터 검증과 Node 조회 예제는 실행했다. TypeScript 정적 타입검사는 현 환경에 컴파일러가 없어 미실행이며, 저장소 통합 빌드·배포도 실행하지 않았다.

완료 판단:

- 데이터 파일이 검증 스크립트를 통과한다.
- 기존 두 설문의 결과와 신규 출처·기간·대상을 구별할 수 있다.
- 모든 표시 수치에 올바른 단위·출처·기준기간이 연결된다.
- 미조사 null과 비대상 등급이 평균·순위 계산에서 잘못 사용되지 않는다.
- 실제 확보된 수치와 후속 수집 후보가 상태대로 표시된다.

## 바로 전달할 프롬프트

> `research/innovation-data-pack/CODEX_HANDOFF.md`를 읽고 현재 저장소에 신규 데이터를 추가해줘. 먼저 패키지 검증을 실행하고, 포함된 기관별 평가와 통계 JSON부터 연결해줘. 출처·기간·단위·집계수준을 유지하고, 아직 미확보인 원자료는 collection-backlog의 접근상태대로 처리해줘. 기존 코드와 AGENTS.md를 확인한 뒤 구현 및 필요한 검증까지 진행해줘.
