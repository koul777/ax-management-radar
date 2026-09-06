# AX 조직관리 레이더 — 자동 홍보영상 제작 명세

## 모드와 제품

2026-09-06 사용자의 “홍보 영상은 자동으로 만들어” 요청으로 video-shotcraft의 **자율 자유 제작**을 선택했다. 중간 창작 승인 없이 연속 제작한다. 완성본은 실제 렌더·독립 심사 후에만 완료로 표기한다.

- 브랜드: **AX 조직관리 레이더 / AX Management Radar**
- 부제: 공공·민간 비교로 찾는 AX 조직관리 인사이트
- 대상: 공공 AX 네트워크, 조직·인사·혁신 담당자, 정책 연구자
- 핵심 질문: “AX를 위해 조직관리를 어떻게 해야 할까?”
- 실제 서비스: http://localhost:3000 (촬영), https://public-private-innovation-dashboard.vercel.app (공개)
- 목적: 데이터에 근거한 조직관리 질문을 찾아 실제 대시보드를 탐색하도록 안내한다. 새로운 분석 결과를 만들지 않는다.

## 요구 → 실행 결정

| 요구 | 화면/실행 | 검증 |
|---|---|---|
| 공공·민간 비교 | 실제 WPS 비교 카드 | 응답 분모·연도 함께 노출 |
| 민간 규모 분류 | 300명 미만·300~999명·1,000명 이상 | 법적 중소/중견/대기업 분류라고 부르지 않음 |
| 연도 선택 | 실제 연도 `<select>` 2021·2023을 양쪽에 3배 확대 | 같은 민간 규모(300–999명)에서 WPS 2005–2023 탐색, AI 직접문항은 2023만 |
| 공공 내부 조직관리 | KIPA 2023 실제 카드와 업무 활용·조직 지원·필요한 지원·자원 질문 | 공공 내부 자료임을 명시, 민간과 같은 조사인 것처럼 합치지 않음 |
| 선행연구·통제 | 이순권(2016) 실제 제목·초록·서지·증거 등급과 2021→2023 WPS 모형을 정면 병치 | 회귀·시차·통제만으로 인과효과 입증이라고 하지 않음 |
| 자동 완성 | 1080p/30fps 한국어 자막, 실제 UI, BGM/무BGM 두 버전 | 같은 타임라인, 무BGM에도 SFX 유지 |
| 공개 안전성 | 이미 공개 승인된 집계 UI만 캡처 | 원자료, 식별자, 자유응답, 개인 경로, 인증정보 금지 |

## 디자인 방향과 styleframe

후보: (A) 연구 편집실 — 밝은 집계 화면과 절제된 네이비 타이포; (B) 어두운 기술 쇼케이스; (C) 빠른 숫자 중심 광고. **A를 선택**한다. 실제 서비스의 밀도와 신뢰감을 유지하기에 적합하다. B의 과한 네온과 C의 인과성과 성과를 암시하는 과장은 채택하지 않는다.

제품 토큰: 본문 #172331, 보조 #687482, 바탕 #eef1f4, 표면 #ffffff, 구분선 #dfe5ea, 네이비 #182b3e, 공공 #108c7d, 민간 #e67d58, 중앙 #367cae, 지방 #d8a12a. Pretendard Variable / Pretendard / Noto Sans KR / Malgun Gothic / sans-serif. 서비스 폰트를 그대로 사용하고 따뜻한 세리프나 금색 효과는 도입하지 않는다. 표면의 낮은 그림자, 12–20px 모서리, 정돈된 왼쪽 정렬과 넉넉한 96px 안전 영역을 사용한다.

영상 자막 최소 56px, 보조/출처 최소 32px(최종 합성 기준). 제목 88–112px. 화면 전체 축소 시 작은 UI 본문을 읽으라고 요구하지 않으며 필요한 문항은 실제 cutout으로 확대한다. 통계 도표의 읽기 구간은 정면, 정지. Hero의 비스듬한 카메라는 데이터 가독성을 위해 회전폭을 줄이는 의도적 적응이며, 부상 뒤 local frame 74–140의 약 66f 부유, 18f 재안착, 두 번의 외곽 빛과 최종 정지를 유지한다.

먼저 순수 HTML/CSS로 1920×1080의 브랜드/기능 자막/출처 styleframe 3장을 만들고 이미지로 확인한다. 이를 통과한 다음 아래 분량을 조정·확정하고 실제 UI 캡처와 Remotion에 들어간다.

## 기능 → 샷 매핑과 분량 초안

Gallery 인덱스에서 아래 카드와 동일 style-key를 검증했다. 전환은 `shot-transitions`의 `shot-transitions-5` 초점 교환을 실제 장면에 연결하고, title card는 밝은 paper 편집실 팔레트에 맞게 적응한다. 각 정확 demo TSX를 읽어 운동 원형을 유지한다.

| 순서 | 목표 분량 | 카드/정확 demo | 실제 화면/문구 | 연결·정지 |
|---|---:|---|---|---|
| 1 브랜드 | 4초 | brand-ink-open / demos/typography/brand-ink-open/BrandInkOpen.tsx | AX 조직관리 레이더; AX Management Radar | 완전한 이름 ≥30f 정지, 마지막 7f 상향 퇴장 |
| 2 핵심 질문 | 6초 | spotlight-hero-card / demos/opening/spotlight-hero-card/SpotlightHeroCard.tsx | WPS 실제 핵심 조직관리 비교 카드; “AX를 위해 조직관리를 어떻게 해야 할까?” | 하나의 카드만 부상·재안착, 3초 이상 완결된 동작, 마지막 ≥15f 정지 |
| 3 호흡 | 약 1.8초 | paper-title-card / demos/typography/paper-title-card/PaperTitleCard.tsx | “같은 AX, 다른 조직” | 서비스 네이비/흰색, 강조 하나 |
| 4 연도 탐색 | 6초 | type-and-filter / demos/interaction/type-and-filter/TypeAndFilter.tsx | 실제 연도 `<select>` 2021과 2023을 양쪽에 확대, 같은 민간 규모를 고정 | 실제 선택 상태의 병치로 적응하며 없는 검색 기능을 만들지 않음. AI 직접문항 2023 한정 노출 |
| 5 민간 규모 | 6초 | row-embed / demos/ui-entrance/row-embed/RowEmbed.tsx | 실제 빈 표 슬롯에 3개 민간 행이 local frame 34/48/62에 착지; 상단에 비율·분자/분모 요약 | 공공 전체는 규모 보정 집단이 아님을 32px 설명 |
| 6 공공 내부 | 7초 | doc-park-left-pill-deal / demos/ui-entrance/doc-park-left-pill-deal/DocParkLeftPillDeal.tsx | KIPA 2023과 147px 높이의 업무 활용·조직 지원·필요한 지원·자원 카드가 y=291/455/619에 정착 | 출처 화면은 왼쪽에 남음. 세 라벨은 관리 질문이며 추정된 인과요인으로 표시하지 않음 |
| 7 분석 근거 | 6초 | research-card-stack-scroll / demos/ui-entrance/research-card-stack-scroll/ResearchCardStackScroll.tsx | 이순권(2016) WPS 2011 실제 연구 제목·초록·서지·증거 등급과 2021→2023 WPS 주 분석 모형을 정면 병치 | 작은 카드 더미 대신 의도적인 읽기 적응. 임의 논문·저자·효과를 만들지 않으며, 회귀모형은 인과 증명이 아님을 고지 |
| 8 호흡 | 약 1.8초 | paper-title-card | “숫자를 읽고, / 조직의 질문을 바꾸다” | 밝은 paper title 전환, 다음 CTA와 문구 중복 금지 |
| 9 마무리 | 7초 | outro-group-photo-launch / demos/outro/outro-group-photo-launch/OutroGroupPhotoLaunch.tsx | 6개 실제 UI 조각이 이름 주위로 집결; “우리 조직의 AX, 근거에서 시작하세요” + 배포 URL | crane 8°→0, 브랜드 등장 후 모든 UI 후경. 완전한 CTA ≥30f 정지 |
| 10 출처 | 8초 | 정적 출처 카드(자체 편집) | 아래 KIPA 필수 활용 문구 + 한국노동연구원(WPS)·한국행정연구원(KIPA)·제작자 재분석, 자세한 출처 README | 32px 이상, 충분한 읽기 시간. 통계 설명과 출처 고지를 광고 카피로 생략하지 않음 |

분량은 54초 내외. 최종 음악·가독성에 맞춰 정수 프레임으로 잠근 실제 분량을 `STORYBOARD.md`에 기록한다. 위 표는 최종 프레임을 허위 주장하지 않는 제작 초안이다.

## 캡처·렌더 계약

`assets/scripts/capture-template.mjs`를 복제·적응한다. 1920×1080, DPR2, fonts.ready+600ms. 각 경로 full-page PNG, per-element cutout, bbox와 pageH를 담은 layout.json을 함께 생성한다. Hero 확대 cutout은 DPR4. 실제 공개 승인된 집계 데이터는 제품 목적상 그대로 보존하며 가상 데이터로 바꿔 실제 분석인 것처럼 연출하지 않는다. 정지 이미지 위 cursor와 전환은 기능 설명용 편집이며 실제 서비스에 없는 작동을 만들지 않는다.

모든 실제 페이지 평면은 복사한 PageCam을 사용한다. 소스는 격리된 promo/ax-management-radar/ 안에만 둔다. 루트 앱 의존성을 바꾸지 않는다. 외부 라이브러리를 skill의 전역 경로에서 직접 import하지 않는다. npm lockfile 포함. 프로덕션 비밀파일 읽기 금지.

SHOTS 단일 타임라인, 샷 props/defaults/schema, src/workbench.ts 필수. 동일 타임라인에서 BGM=true/false 출력. Date.now/Math.random 금지. 각 샷의 동작/정지 프레임 최소 2장을 렌더해 검사하고 최종 편집 후 각 샷 입장/절정/정지 키프레임을 다시 추출한다.

## 오디오와 출처

확인된 원본 URL을 갖는 음악/SFX만 사용. BGM은 시각 리듬이 잠긴 뒤 고르고 강한 비트를 택하면 music-beat-sync.md에 따라 실제 BPM/위상/순간음을 검증하고 cuts를 재정렬한다. 모호한 bgm-tech-house, pop 등의 출처 미확인 파일은 제외한다. 저작권 있는 음원 파일의 원본 재배포가 허용되는지 확인하지 않은 채 공개 Git에 넣지 말고 다운로드 manifest로 재현한다. 사용된 코드에는 Apache 2.0 원문·저작자·수정 고지, 음원은 파일별 원본 링크/실제 이용범위 기록.

KIPA 필수 활용 고지:

> 본 홍보영상의 한국행정연구원 자료 분석은 한국행정연구원에서 생산된 자료를 활용하였으며, 한국행정연구원 연구자료관리규칙에 의거 사용허가를 받았음.

README/대시보드에는 이용조건 전문과 완성 연구결과물 제출 의무가 별도로 있다. 영상 제작·공개가 KIPA에 결과물 제출까지 완료했다는 의미는 아니다.

## 검수와 인계

최종 렌더물·키프레임·이 문서·styleframe·확정분경·Gallery 카드/정확 demo·참고샘플·오디오 검증표를 새 독립 심사 에이전트에게 넘긴다. 통계/인과 주장 심사는 Astra Ultra. 제작자가 자기 승인으로 완료 처리하지 않는다. 렌더 끝난 후 workbench parity 검사를 통과하고 사용자에게 localhost:5198 편집 화면을 연다. 공개 Git/Vercel 작업은 팀장만 한다.
