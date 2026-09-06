# Supplemental personal AI analysis

## Completed descriptive analysis

- KISDI: 2022 N=5,378; 2023 N=4,581; 2024 N=4,420. One `wgt_a` SAV per wave was used without weights.
- KMP personal files: 2023 N=9,757; 2024 N=8,693. Every KMP item first enforces `pXXans=1`; all results are unweighted.
- KMP 정정: 설문지의 AI 문항은 전체 응답 문항이며 만 7세 이상 건너뜀 지시는 확인되지 않았다. 이번 분석에서는 제공된 연구의 연령 기준을 보수적으로 반영해 age1>=7을 분석 제한으로 적용했다(2023 N=9,751; 2024 N=8,691). 이는 설문상 미질문과 다르다.
- age1=9999(모름/무응답)는 연령 미상으로 분석에서 제외했다(2023년 0명, 2024년 0명). 120세 상한은 코드북 범위를 확인하지 못한 분석상 안전장치다.
- KMP 2024 유료 서비스 문항은 설문지 인쇄본의 ‘⑥ 아니오’ 표기와 달리 SAV 코드북의 2=아니오를 사용했다. 인쇄 표기 오류로 보고 재부호화하지 않았다.
- 외부 연구에서 인용된 2023 N=9,411은 제공된 개인 SAV와 age1>=7 조건만으로 재현되지 않는다(340명 차이). 근거 없는 추가 제외로 맞추지 않았다.
- KISDI 2023-to-2024 linkage has N=3,895 unique common IDs. The published transition is a descriptive ever-use response table only.
- KMP 2023 chatbot and 2024 broader generative-AI modules are separate, so no AI trend or transition is reported.

## Descriptive findings

- 2023년에는 4,581명 중 543명(비가중 11.9%), 2024년에는 4,420명 중 1,096명(비가중 24.8%)이 생성형 AI 이용 경험을 보고했다. 이는 조직 도입 추정치가 아닌 별도 웨이브의 개인 응답 분포다.
- Across the 3,895 linked KISDI respondents: 468 reported experience in both waves, 0 changed from experience to no experience, 546 changed from no experience to experience, and 2,881 reported no experience in both. This is a response-transition description, not first adoption.
- 만 7세 이상 2023년 개인용 설문 완료자 9,751명 중 1,172명(비가중 12.0%)은 AI 챗봇 이용을, 2024년 8,691명 중 966명(비가중 11.1%)은 더 넓은 생성형 AI 서비스 이용을 보고했다. 설문 정의가 달라 동일 추세가 아니다.

## Supplied-archive verification

- Outer supplied KISDI archive available at analysis time: `True`.
- All six expected year/weight-variant SAV hash-and-byte comparisons matched: `True`.
- The computation uses only the independently audited `wgt_a` file for each KISDI year; a/b variants were not pooled or double-counted.

## Interpretation limits

- Age and employment groupings are individual respondent categories, not public/private employers or organizations.
- Perceived task help, idea help, privacy, and group support are descriptive survey responses. They are not causal outcomes, productivity measures, or AI/HR policy measures.
- No regressions, causal claims, organization-level inference, or respondent rows are included.

## Output contract checks

- Public datasets emitted: kisdi_intelligent_user_panel, kmp_korea_media_panel.
- Every question exposes eligible, valid, structural-missing, and unknown counts; response shares use the documented valid denominator.
- No archive paths, original rows, free-text answers, or credentials are present in the public JSON.
