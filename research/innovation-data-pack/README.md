# 공공기관 혁신 대시보드 — Codex 데이터 패키지

2026-09-08 조사 · 대상 저장소: [koul777/public-private-innovation-dashboard](https://github.com/koul777/public-private-innovation-dashboard)

**새 데이터 출처 36종과 실제 확보한 데이터를 담았다.** 코덱스는 [CODEX_HANDOFF.md](CODEX_HANDOFF.md)를 먼저 읽고, 포함된 JSON과 타입을 바로 사용할 수 있다.

| 내용 | 수량 | 파일 |
|---|---:|---|
| 신규 출처 / 기존 조사 확장 | 36 / 2 | `data/source-catalog.json` |
| 데이터기반행정·공공데이터 제공·고객만족도 기관별 기록 | 1,554 | `data/agency-evaluations.json` |
| 지방공기업 기관·연도별 기록 | 2,150 | `data/local-enterprise-evaluations.json` |
| 숫자 통계 / 미조사 기록 | 275 / 3 | `data/observations.json` |
| 통계 지표 정의 | 81 | `data/metrics.json` |
| 실제 설문 변수 매핑 | 32 | `data/variable-map.json` |

기관·연도별 기록 3,704행에는 `대상아님`, `기타`, `평가제외`가 포함된다. 유효 평가등급은 2,878행이다. 개인 응답자 미시자료를 확보한 패키지는 아니다.

## 바로 사용하기

1. 저장소 루트에 이 폴더를 `research/innovation-data-pack/`으로 둔다.
2. `CODEX_HANDOFF.md`를 코덱스에 읽힌다.
3. `python3 research/innovation-data-pack/scripts/validate_data.py`로 입력 데이터를 확인한다.
4. `node research/innovation-data-pack/examples/query.mjs`로 조회 예제를 실행한다. 앱 연결에는 `examples/query.ts`와 `types.ts`를 참고한다.

추가 npm 패키지는 필요하지 않다. 검증 스크립트는 Python 표준 라이브러리만 사용한다. TypeScript 예제는 저장소에서 확인한 `resolveJsonModule: true` 설정에 맞췄다.

## 들어 있는 새 데이터

- **기관별 성과·행정:** 2025 데이터기반행정 684개, 공공데이터 제공평가 684개, 고객만족도 186개, 지방공기업 5개년 기록.
- **AI 실제 활용·조직 지원:** ALIO 2026.6말 AI 공시, SPRi 2022 공공부문 AI 조사 및 2014~2023 AI 포함 조달계약, KEIS 2025 조직대응·장애요인.
- **일하는 방식:** WPS 개선제도 2015~2023, 여성관리자패널 문화개선 2020~2024.
- **혁신 비교:** KIS2025 서비스업 혁신, APS2025·영국 CSPS2025·OECD2024 직원조사.
- **다음 수집 후보:** 공무원 생성형AI 조사, 노동패널, 근로환경조사, 인적자본기업패널 등. 접근 상태·원문 주소·이용조건은 출처 목록과 `metadata/collection-backlog.json`에 있다.

## 수치 읽는 규칙

`percent` 값 `43.1`은 **43.1%**다. `index_0_100`의 `68`은 **68점**이다. `null`은 0이 아니다. 관측·평가·발표연도는 구분되어 있다. 기관명은 원문 그대로이며 공통 기관코드는 아직 매핑하지 않았다.

모든 자료의 단위·분모·원문 위치·출처 또는 출처 ID를 제공한다. 원문 PDF·SAV·XLSX의 전체 재배포본은 포함하지 않았으며, 공개 수치의 전사·구조화 결과와 원문 경로를 담았다. 출처별 이용조건은 `source-catalog.json`을 따른다.

## 검증

기관 수·등급 합계, ALIO 유형별 합계, SPRi 계약 합계, 식별자 중복, 단위, 결측, 출처 참조를 확인한다. `metadata/validation-result.json`은 이 패키지에 대한 실행 결과다. Node 조회 예제도 실행했다. TypeScript 정적 타입검사는 현 환경에 컴파일러가 없어 실행하지 못했으며, 웹사이트 통합 빌드는 패키지 적용 후 수행한다.
