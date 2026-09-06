# KIPA supplemental descriptive analysis

상태: 2026-09-06 사용자 확인에 따라 집계 결과 공개를 승인함.

## 공개 근거와 범위

사용자는 2026-09-06에 “사용 허가를 받았음 오픈하면 되는거지”라고 확인했다. 이 문서는 그 사용자 확인에 근거하여 세 KIPA 자료의 익명 집계 결과를 공개한다. 이 확인은 새 외부 인증서나 KIPA의 별도 공문을 받았다는 주장이 아니다. 또한 별도의 추가 공개 허가가 필요하다는 확인되지 않은 전제를 두지 않는다.

승인된 실행은 `.tmp/supplemental_public/local_aggregate_results.json`과 `app/data/supplemental-public.json`에 동일한 익명 집계 구조를 생성하며, 공개 JSON의 `publication_status`는 `"approved"`이다. 응답자 행, 자유응답, 원 SAV 파일, 비공개 원자료 경로는 두 산출물 모두에 포함하지 않는다. 기본 실행은 계속 보수적으로 공개 보류 셸을 생성하므로, 향후 허가 상태가 불확실할 때 사용할 수 있다.

## Source and scope audit

| Dataset | Scope | Groups used |
|---|---|---|
| KIPA 2015 personnel-management survey | Central-government civil-service respondents; no private comparator | all respondents only |
| KIPA 2019 data-based-administration survey | National agencies, local governments, and national policy research institutes; no private comparator | `SQ1`: 1 national agency, 2 local government, 3 national policy research institute |
| KIPA 2022 cloud/data-based-administration survey | Central government, local government, or institution not disclosed; no private comparator | `기관구분`: 1 central government, 2 local government, 3 institution not disclosed |

All distributions are unweighted. They are respondent-level cross-sectional descriptions, not population estimates, panel effects, public/private comparisons, or causal effects.

공개 집단의 최소 표본은 2022년 기관 비공개 집단의 28명이다. 개인 식별자나 응답 행은 공개하지 않으며, 이 세 집단 분포에서 별도의 극소집단 비공개 처리는 적용하지 않았다.

Dictionary evidence retained locally (and excluded from public assets) is `.tmp/supplemental_public/kipa_jobs_2015_dictionary.json`, `.tmp/supplemental_public/kipa_data_2019_dictionary.json`, and `.tmp/supplemental_public/kipa_cloud_2022_dictionary.json`. The matching one-page use-notice text and visual render are retained in that same directory solely for the release audit.

## Prospectively selected questionnaire items

Items were selected from the original SPSS labels before examining results. Every item retains the source code, original value labels, group denominator, valid count, missing count, unknown count, and response distribution in the local aggregate file. All selected rating items use the documented 1-to-5 ordinal response categories; 1 is complete disagreement/lowest rating and 5 is complete agreement/highest rating. Values labelled nonresponse are missing; values labelled do-not-know or otherwise outside the documented scale are unknown.

| Dataset | Items | Construct represented |
|---|---|---|
| 2015 | `Q2_1`–`Q2_5` | Individual job-satisfaction items |
| 2015 | `Q3_1`–`Q3_5` | Individual organizational-commitment items |
| 2019 | `Q9_2`, `Q9_3`, `Q9_4`, `Q9_7`, `Q9_8`, `Q9_9`, `Q9_10` | Perceived importance of budget, specialist staffing, training, inter-organizational cooperation, leader capability, staff capability, and data-oriented culture |
| 2019 | `Q10_2`, `Q10_3`, `Q10_4`, `Q10_7`, `Q10_8`, `Q10_9`, `Q10_10` | Perceived sufficiency of the same seven conditions |
| 2022 | `Q12_1`, `Q12_4`, `Q12_7`, `Q12_8`, `Q12_17`, `Q12_18`, `Q12_21`, `Q12_22` | Leadership/decision support, training/manual support, data-sharing cooperation, and performance/incentive support |
| 2022 | `Q15_7`, `Q15_8` | Self-reported data use and analysis/software capability |
| 2022 | `Q15_3`, `Q15_4` | Self-reported novel-work-method effort and new-idea development; not realized organizational innovation |
| 2022 | `Q15_21`, `Q15_22` | Decision participation and discretion over work methods/procedures |
| 2022 | `Q15_25`, `Q15_26`, `Q15_27` | Interdepartmental, vertical, and horizontal communication/collaboration |
| 2022 | `Q15_28` | Innovation-oriented organizational climate; not realized innovation |

No index was constructed. In particular, innovation climate is not relabelled as realized innovation.

## 2022 model proposal: not fitted

The following was submitted for review but has not been estimated. The two possible outcomes are separate: `Q15_3` (tries to devise/apply new and original work methods) and `Q15_4` (develops new ideas to solve work problems). The candidate explanatory items are the eight `Q12` support items listed above. The prospective association direction is positive for each support item, but the same-wave self-report design does not establish temporal order or causal effect.

Candidate descriptive covariates are `기관구분` (1 central, 2 local, 3 not disclosed), `SQ1` role (1 data-based-administration officer, 2 intelligent-informatization officer, 3 public-data-provision officer, 4 innovation-administration officer, 5 other/general), `SQ4` grade (2nd through 9th grade), and `SQ5` public-service tenure (<=5 years, 6-<10, 10-<20, 20-<25, >=25). An independent review is required before any model because the eight supports may be correlated (this has not yet been assessed), role and grade may be redundant, the two outcomes represent related but distinct concepts, and multiple testing would need an explicit plan.

## Reproducibility and checks

현재 승인된 공개 산출물은 `python scripts/analyze_supplemental_public.py --publish-authorized`로 생성했다. `python scripts/analyze_supplemental_public.py`는 계속 공개 보류 모드로 동작한다.

`python -m unittest tests.test_supplemental_public -v` checks the pending public-release gate, every group denominator, valid-category sums, missing/unknown reconciliation, response shares, source codes, ordinal direction text, and non-causal/public-private safeguards.
