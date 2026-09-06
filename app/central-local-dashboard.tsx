import ComparisonDashboard, {
  ComparisonDashboardConfig,
  ComparisonFactor,
  CultureDimension,
} from "./comparison-dashboard";
import data from "./data/central-local-analysis.json";

const insights: Record<string, string> = {
  goal_clarity: "모든 통제변수를 반영한 뒤 중앙과 지방 모두 p<.05에 이르지 않았습니다. 목표를 명확히 하는 것만으로 혁신행동이 높아진다고 단정할 수 없습니다.",
  transformational_leadership: "중앙과 지방 모두 p<.05에 이르지 않았습니다. 이번 자료에서는 리더십만으로 혁신행동이 높아진다고 단정할 수 없습니다.",
  transactional_leadership: "성과에 따른 인정·보상 내용을 담은 두 문항을 거래적 리더십으로 함께 넣었습니다. 중앙 β=.028(p=.439), 지방 β=−.006(p=.830)로 독립적인 관계가 확인되지 않았습니다.",
  training: "지방 모형에서는 p<.05였고 중앙에서는 p=.058이었습니다. 이 차이만으로 중앙·지방 효과가 다르다고 말할 수 없으므로, 현장 적용형 교육은 효과가 검증된 처방이 아니라 우선 확인할 가설로 다룹니다.",
  participation_communication: "지방 모형에서는 p<.05였고 중앙에서는 p<.05가 아니었습니다. 집단별 유의·비유의만으로 효과 차이를 선언하지 않으며, 의견을 받고 답하는 구조는 지방에서 먼저 검증할 가설입니다.",
  public_service_motivation: "중앙·지방 모형에서 모두 가장 큰 양의 조정계수가 관찰됐습니다. 공공가치를 시민이 체감하는 업무 개선 과제와 연결하는 일은 공통으로 우선 확인할 가설이며, 인과적 처방은 아닙니다.",
};

const literature: Record<string, ComparisonFactor["literature"]> = {
  goal_clarity: {
    basis: "박사학위 원고 pp.31–32",
    why: "목표가 분명해야 구성원이 변화의 우선순위와 판단 기준을 알고 실행할 수 있으므로, 목표의 명확성이 혁신행동과 연결되는지 확인했습니다.",
    finding: "Locke와 Latham은 목표가 노력 수준과 행동을 이끈다고 보았습니다. 원고가 검토한 연구들은 대체로 명확성이 혁신행동에 긍정적으로 연결된다고 보지만, 김국진·강지선은 관리자와 실무자의 결과가 달랐다고 보고했습니다.",
    references: [
      { label: "Locke (1968)" },
      { label: "Locke·Latham (1990, 2006)" },
      { label: "김국진·강지선 (2019)", href: "https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002549723" },
    ],
  },
  transformational_leadership: {
    basis: "박사학위 원고 pp.32–33",
    why: "리더가 변화의 필요성과 미래상을 설명하고 격려·지적 자극·지원을 제공하면 구성원이 새로운 방식을 시도하기 쉬워지는지 보기 위해 넣었습니다.",
    finding: "Burnside는 리더의 격려와 지원을 창의적 행동과 연결했고, Scott·Bruce는 지원·신뢰·자율성이 아이디어 창출과 혁신행동에 연결된다고 보았습니다. Amabile 등도 리더의 격려를 창의성의 조건으로 다뤘습니다.",
    references: [
      { label: "Burnside (1990)" },
      { label: "Scott·Bruce (1994)", href: "https://doi.org/10.5465/256701" },
      { label: "Amabile et al. (1996)", href: "https://doi.org/10.5465/256995" },
    ],
  },
  transactional_leadership: {
    basis: "2025 조사 q20_1~q20_2 내용기반 추가분석",
    why: "기대하는 성과를 분명히 하고 성과에 따라 인정·보상하는 리더십이 혁신행동과 별도로 연결되는지 변혁적 리더십과 동시에 확인했습니다.",
    finding: "거래적 리더십은 명확한 기대와 조건부 보상을 통해 구성원의 행동을 조정한다는 관점입니다. 다만 2025 공식 보고서는 q20_1~q20_7을 하나의 ‘기관의 리더십 인식’ 문항군으로 제시하며, q20_1~q20_2에 거래적이라는 공식 척도명을 붙이지 않았습니다.",
    references: [
      { label: "Bass (1985)" },
      { label: "Bass·Avolio (1994)" },
      { label: "2025년 공직생활실태조사 q20" },
    ],
    caution: "문항 내용에 따른 분석용 분류입니다. q20_1~q20_6 공동 EFA는 1요인으로 수렴해 변혁적·거래적 리더십의 통계적 구분타당성이 확인된 것은 아닙니다.",
  },
  training: {
    basis: "박사학위 원고 pp.33–34",
    why: "환경이 바뀔 때 필요한 지식과 기술, 적응 역량이 있어야 새로운 업무방식을 실제로 사용할 수 있으므로 교육훈련을 변화관리 요인으로 넣었습니다.",
    finding: "원고는 다수 연구가 교육훈련과 혁신행동의 긍정적 관계를 보고했다고 정리합니다. 이승주 등은 5급 이하에서는 유의했지만 1~4급에서는 유의하지 않아 직급에 따른 차이 가능성도 제시했습니다.",
    references: [
      { label: "이승주 외 (2019)" },
      { label: "남길석 (2016)" },
      { label: "김종석 (2017)" },
      { label: "김문준 (2020)" },
    ],
  },
  participation_communication: {
    basis: "박사학위 원고 pp.34–35",
    why: "현장 아이디어가 공식 의사결정에 들어가고 조직 안팎의 정보가 빠르게 공유되어야 혁신을 실행할 수 있으므로 참여와 소통을 함께 살폈습니다.",
    finding: "Kivimaki 등은 참여·소통으로 만든 아이디어가 조직 변화의 토대가 된다고 보았고, Rogers는 외부 소통이 혁신 정보 획득과 행동에 영향을 준다고 설명했습니다. Lin과 Damanpour도 원활한 소통과 혁신행동의 관계를 보고했습니다.",
    references: [
      { label: "Kivimaki et al. (2000)" },
      { label: "Rogers (1995)" },
      { label: "Lin (2007)" },
      { label: "Damanpour (1991)" },
    ],
  },
  public_service_motivation: {
    basis: "박사학위 원고 pp.35–36",
    why: "공익을 위해 기꺼이 움직이려는 동기가 비용과 불확실성이 따르는 조직변화를 지지하고 혁신행동으로 이어지는지 확인하기 위해 넣었습니다.",
    finding: "Liu·Zhang, Wright 등은 공공봉사동기와 변화 지지·혁신의 긍정적 관계를 보고했고, Hatmaker 등은 관리자의 동기가 구성원 혁신을 북돋을 수 있다고 보았습니다. 반면 Miao 등은 직접효과가 유의하지 않았다고 보고했습니다.",
    references: [
      { label: "Liu·Zhang (2019)" },
      { label: "Wright et al. (2013)" },
      { label: "Hatmaker et al. (2014)" },
      { label: "Miao et al. (2018)" },
    ],
    caution: "선행연구 결과가 완전히 같지 않기 때문에, 이번 중앙·지방 자료와 완전통제모형에서 다시 확인했습니다.",
  },
};

const cultureCue: Record<string, string> = {
  group: "관계·협력",
  development: "혁신·성장",
  hierarchy: "질서·절차",
  rational: "성과·목표",
};

const cultureEffectIds = ["rational", "development", "hierarchy", "mixed"] as const;
const centralCultureEffects = data.organization_culture.regression_controls.groups.central.coefficients;
const localCultureEffects = data.organization_culture.regression_controls.groups.local.coefficients;

const config: ComparisonDashboardConfig = {
  variant: "central-local",
  analysisYear: 2025,
  eyebrow: "공직생활실태조사 2025 · 중앙정부와 지방자치단체",
  title: "중앙·지방 혁신행동과 관리여건 연관성 대시보드",
  question: "같은 관리여건이 중앙정부와 지방자치단체의 혁신행동과 어떻게 연관되어 관찰되는가?",
  headline: "전체 6,084명 통합모형에서는 공공봉사동기·교육훈련·참여 및 소통의 양의 조정 후 연관이 관찰됐습니다. 집단별로는 공공봉사동기만 중앙과 지방 모두에서 p<.05였지만, 직접 계수차 검정이 없어 부문 효과 차이를 선언하지 않습니다.",
  plainSummary: [
    {
      label: "조정 후 관찰된 연관",
      title: "통합모형에서 공공봉사동기의 양의 계수가 가장 컸습니다.",
      body: "통합모형에서 공공봉사동기(β=.225), 교육훈련(β=.055), 참여·소통(β=.044)의 양의 조정계수가 p<.05였습니다. 집단별로 나누면 공공봉사동기만 중앙과 지방 모두에서 p<.05였지만, 직접 계수차 검정은 하지 않았습니다.",
    },
    {
      label: "현재 수준 차이",
      title: "혁신행동 평균은 중앙 3.31점, 지방 3.17점이었습니다.",
      body: "중앙은 업무수행역량 3.43점, 업무태도 3.28점으로 지방보다 각각 0.14점, 0.12점 높았습니다. 인력·예산·정보 지원을 묶은 업무환경은 3.13점과 3.10점으로 비슷했습니다.",
    },
    {
      label: "차이를 이해하는 핵심",
      title: "지방은 공공가치 동기와 실행기반의 현재 수준이 더 낮았습니다.",
      body: "지방은 공공봉사동기 0.17점, 업무수행역량 0.14점, 업무태도 0.12점이 중앙보다 낮았습니다. 교육훈련과 참여·소통은 지방 내부에서 p<.05인 조정 후 연관이었으며, 효과가 확인된 경로가 아니라 우선 시험할 가설입니다.",
    },
  ],
  source: "2025년 공직생활실태조사",
  sampleLabel: `N=${data.meta.total_n.toLocaleString("ko-KR")}`,
  groupA: {
    label: "중앙정부",
    short: "중앙",
    mean: data.groups.central.innovation_mean,
    n: data.groups.central.n,
    r2: data.groups.central.r_squared,
    maxFactorVif: data.groups.central.max_factor_vif,
  },
  groupB: {
    label: "지방자치단체",
    short: "지방",
    mean: data.groups.local.innovation_mean,
    n: data.groups.local.n,
    r2: data.groups.local.r_squared,
    maxFactorVif: data.groups.local.max_factor_vif,
  },
  outcomeGapP: data.outcome_gap.mean_p,
  factors: data.factors.map((factor) => ({
    id: factor.id,
    label: factor.label,
    short: factor.short,
    alpha: factor.reliability_alpha,
    variables: factor.variables,
    a: factor.central,
    b: factor.local,
    meanDifferenceP: factor.mean_gap_p,
    insight: insights[factor.id],
    literature: literature[factor.id],
    items: factor.item_means.map((item) => ({
      id: item.id,
      label: item.label,
      a: item.central,
      b: item.local,
    })),
  })),
  controls: data.meta.controls,
  controlTerms: data.meta.control_terms,
  controlTermsLabel: "중앙 15개 · 지방 16개 통제항 실제 투입",
  modelFormula: "혁신행동 = 목표 명확성 + 변혁적 리더십 + 거래적 리더십 + 교육훈련 + 참여·소통 + 공공봉사동기 + 전체 통제항",
  controlSummary: "논문 표15의 10개 통제개념과 범주 구성을 2025 조사에 대응해 모두 반영하고, 지방모형에는 광역·기초 구분을 추가했습니다. 동일 회귀모형의 재현은 아닙니다.",
  controlResearchNote: "원고의 선행연구 검토에서 혁신행동과 업무성과에 영향을 줄 수 있다고 본 개인·직무·기관·문화 조건을 모두 넣었습니다. 그래서 핵심 변화관리 요인의 결과가 구성원 특성이나 근무여건 차이로 설명되는 부분을 먼저 걷어냈습니다.",
  controlValidation: `통제척도 ${data.control_efa.item_count}문항은 별도 EFA에서 ${data.control_efa.retained_factor_count}요인으로 나뉘고 ${data.control_efa.matching_items}/${data.control_efa.item_count}문항이 예상 요인과 일치했습니다. 다만 업무수행역량 α=.58, 최저 주적재량 ${data.control_efa.minimum_primary_loading.toFixed(3)}이므로 원고와의 측정동등성이 확인된 것은 아닙니다.`,
  factorSourceNote: "원고 5개 구성개념 + 거래적 리더십 2문항 추가 · 총 6개 회귀요인",
  factorValidation: {
    kmo: data.efa.kmo,
    retained: data.efa.retained_factor_count,
    itemCount: data.efa.item_count,
    variance: data.efa.variance_explained,
    minimumLoading: data.efa.minimum_primary_loading,
  },
  outcomeAlpha: data.outcome_reliability_alpha,
  outcomeItems: data.outcome_items.map((item) => ({
    id: item.id,
    label: item.label,
    a: item.central.mean,
    b: item.local.mean,
  })),
  itemGroups: [
    ...data.factors.map((factor) => ({
      id: `driver-${factor.id}`,
      label: factor.label,
      role: "driver" as const,
      items: factor.item_means.map((item) => ({
        id: item.id,
        label: item.label,
        a: item.central,
        b: item.local,
      })),
    })),
    {
      id: "outcome-innovation",
      label: "혁신행동",
      role: "outcome" as const,
      items: data.outcome_items.map((item) => ({
        id: item.id,
        label: item.label,
        a: item.central.mean,
        b: item.local.mean,
      })),
    },
    ...data.control_scales.scales.map((scale) => ({
      id: `control-${scale.id}`,
      label: scale.label,
      role: "control" as const,
      items: scale.item_means.map((item) => ({
        id: item.id,
        label: item.label,
        a: item.central,
        b: item.local,
      })),
    })),
    ...data.organization_culture.dimensions.map((dimension) => ({
      id: `culture-${dimension.id}`,
      label: dimension.label,
      role: "culture" as const,
      items: dimension.item_means.map((item) => ({
        id: item.id,
        label: item.label,
        a: item.central,
        b: item.local,
      })),
    })),
  ],
  itemComparisonNote: "Q21은 총 12문항이며, 이 전수표에는 원고가 Quinn CVF 네 유형 산출에 사용한 q21_1~q21_8만 포함했습니다. q21_9~q21_12는 CVF·회귀에 넣지 않았습니다.",
  changeManagement: {
    title: "중앙·지방 변화관리 실행판",
    description: "공통 방향과 기관유형별 가설을 나눠, 90일 동안 작은 시범·측정·중단 기준으로 확인하는 계획으로 제시합니다. 관찰연관을 효과가 검증된 처방으로 바꾸지 않습니다.",
    audiences: [
      {
        id: "common",
        label: "공통 방향",
        diagnosis: {
          title: "공공가치와 실제 개선의 연결을 우선 확인할 필요가 있습니다.",
          body: "중앙과 지방 모형에서 공공봉사동기의 양의 조정계수가 가장 컸습니다. 이는 인과적 동력이 아니라 관찰연관입니다. 지방의 공공봉사동기·업무수행역량·업무태도 현재 수준이 중앙보다 낮다는 기술통계도 함께 봅니다.",
          signals: [
            { label: "공공봉사동기 조정계수", value: "중앙 β=.232 · 지방 β=.224", note: "두 집단 모두 p<.001 · 가장 큰 양의 계수 · 직접 계수차 검정 없음" },
            { label: "혁신행동 현재값", value: "중앙 3.31 · 지방 3.17", note: "평균 차이 p<.001" },
            { label: "실행기반 현재값", value: "역량 3.43 · 3.29", note: "업무태도 중앙 3.28 · 지방 3.16" },
          ],
        },
        priority: {
          eyebrow: "두 집단 공통으로 우선 확인할 가설",
          title: "모든 혁신과제를 시민이 체감할 결과와 연결하세요.",
          evidence: "공공봉사동기는 중앙 β=.232, 지방 β=.224로 통제 후 두 집단에서 p<.001이었습니다. 직접 계수차 검정이 없어 중앙·지방의 연관 크기가 다르다고 말할 수 없습니다.",
          firstMove: "진행 중인 개선과제 한 건에 ‘대상 시민·바뀔 경험·확인지표’를 한 문장으로 쓰고, 현장 의견을 반영한 작은 시험으로 전환합니다.",
          factorId: "public_service_motivation",
          nextMoves: [
            "활동 건수보다 처리시간·오류·재방문·반복민원 같은 체감결과를 봅니다.",
            "목표만 다시 쓰기보다 담당자의 시험 권한과 회신기한을 함께 정합니다.",
            "한 집단에서만 p<.05인 결과는 기관유형 고유효과나 부문 차이로 단정하지 않습니다.",
          ],
        },
        metrics: [
          { kind: "condition", label: "공공봉사동기", value: "중앙 3.26 · 지방 3.09", note: "q30_1~q30_5를 같은 문항으로 추적" },
          { kind: "operation", label: "시민 체감성과가 명시된 개선과제 비율", value: "신규 수집", note: "현장 의견 반영·시범운영 전환율도 함께 기록" },
          { kind: "outcome", label: "혁신행동", value: "중앙 3.31 · 지방 3.17", note: "q33_1~q33_2의 분기별 변화 확인" },
        ],
        roadmap: [
          { period: "0~30일", title: "검증할 시민 문제를 하나 고릅니다", body: "민원·이용자 경험·현장자료에서 반복되는 불편을 정하고 현재 기준값과 실패·중단 기준을 함께 저장합니다." },
          { period: "31~60일", title: "안전한 작은 시범을 엽니다", body: "기간·예산상한·책임자·비교 기준·중단조건을 명시해 한 부서에서 먼저 실행합니다." },
          { period: "61~90일", title: "시범의 측정값으로 다음 결정을 합니다", body: "과정·인식·결과지표를 함께 검토해 유지·수정·중단·확산 중 하나를 결정합니다. 측정값은 다음 시범·중단 판단의 근거로만 사용합니다." },
        ],
      },
      {
        id: "central",
        label: "중앙정부",
        diagnosis: {
          title: "강한 성과·절차 문화 안에 안전한 실험 통로가 필요합니다.",
          body: "중앙은 공공봉사동기가 강한 반면 발전문화와 자유로운 개선 건의는 상대적으로 낮았습니다. 절차를 없애기보다 절차 안에서 빠르게 시험할 수 있게 만드는 접근이 현실적입니다.",
          signals: [
            { label: "공공봉사동기", value: "β=.232 · p<.001", note: "중앙 모형에서 가장 큰 양의 조정계수" },
            { label: "문화 프로필", value: "합리 3.51 · 위계 3.51", note: "발전문화 3.08보다 높음 · 현황 설명" },
            { label: "개선 건의", value: "q21_7 3.01", note: "의사결정 이의제기 q22_4 2.95" },
          ],
        },
        priority: {
          eyebrow: "조정 후 연관 + 문화에 맞춘 검증 설계",
          title: "공공가치를 정책실험으로 바꾸고 공식 이의제기 통로를 두세요.",
          evidence: "공공봉사동기는 중앙 모형에서 p<.001이었고 참여·소통은 p=.665였습니다(β=−.017). 이 유의성 차이만으로 요인의 효과 차이를 말할 수 없으므로, 제안 통로는 책임자와 회신기한이 있는 시범으로 측정·검증합니다.",
          firstMove: "정책과제 한 건에 국민 문제와 성과지표를 적고, 규정 안에서 가능한 시험 범위·결정자·10영업일 회신기한을 지정합니다.",
          factorId: "public_service_motivation",
          nextMoves: [
            "교육 수료 후 30일 안에 실제 업무 시범을 운영하고 업무 적용 결과를 기록합니다.",
            "채택하지 않은 제안에도 사유와 다음 검토조건을 회신합니다.",
            "절차 준수와 함께 시험 승인 속도·완주율을 관리합니다.",
          ],
        },
        metrics: [
          { kind: "condition", label: "공공봉사동기·자유로운 개선 건의", value: "3.26 · 3.01", note: "q30 평균과 q21_7을 분리해 확인" },
          { kind: "operation", label: "제안 회신기한 준수율·실험 승인 소요일", value: "신규 수집", note: "교육 후 30일 실험 착수율도 기록" },
          { kind: "outcome", label: "혁신행동", value: "3.31 → 추세", note: "제안의 시범운영률·실제 채택률과 함께 확인" },
        ],
        roadmap: [
          { period: "0~30일", title: "국민성과와 시험경계를 정합니다", body: "과제 목적, 허용 범위, 중단조건, 의사결정자를 한 장에 명시합니다." },
          { period: "31~60일", title: "절차 안에서 빠르게 시험합니다", body: "교육 또는 현장제안을 한 건 이상 시범 적용하고 장애물 제거 책임자가 매주 점검합니다." },
          { period: "61~90일", title: "근거를 남기고 제도화합니다", body: "국민성과와 처리기간을 비교하고 채택하지 않은 시도까지 판단 근거를 축적합니다." },
        ],
      },
      {
        id: "local",
        label: "지방자치단체",
        diagnosis: {
          title: "주민 문제를 교육과 참여의 실행과제로 묶을 필요가 있습니다.",
          body: "지방 모형에서는 공공봉사동기·교육훈련·참여 및 소통의 양의 조정 후 연관이 p<.05였습니다. 이를 주민 현안형 학습과 반드시 답하는 제안 절차라는 검증 가설로 시범 운영할 수 있습니다.",
          signals: [
            { label: "공공봉사동기", value: "β=.224 · p<.001", note: "지방 모형에서 가장 큰 양의 계수 · 현재값 3.09" },
            { label: "교육훈련", value: "β=.055 · p=.009", note: "교육기회 2.99 · 현장적용 가설을 우선 확인" },
            { label: "참여·소통", value: "β=.054 · p=.021", note: "자유로운 개선 건의 2.90 · 회신 구조를 시범 검증" },
          ],
        },
        priority: {
          eyebrow: "지방 응답표본의 연관성을 참고한 점검 과제",
          title: "주민 현안형 교육과 ‘반드시 답하는’ 제안체계를 결합하세요.",
          evidence: "지방에서는 교육훈련과 참여·소통이 유의했습니다. 낮은 개선 건의(q21_7 2.90)와 교육기회(q14_2 2.99)를 실행과정 지표로 관리할 수 있습니다.",
          firstMove: "반복 민원 한 건을 교육과제로 배정하고 현장 담당자가 30~60일 안에 시험하도록 한 뒤, 모든 제안에 검토결과와 사유를 회신합니다.",
          factorId: "training",
          nextMoves: [
            "강의 수료율보다 교육 후 현장적용 착수율과 완료율을 봅니다.",
            "월간 문제해결회의에 현장 담당자와 정책·예산 부서를 함께 참여시킵니다.",
            "목표·기간·예산상한·중단조건이 분명한 작은 실험부터 시작합니다.",
          ],
        },
        metrics: [
          { kind: "condition", label: "교육기회·자유로운 개선 건의", value: "2.99 · 2.90", note: "q14_2와 q21_7을 별도 추적" },
          { kind: "operation", label: "교육 후 현장적용률·제안 회신률", value: "신규 수집", note: "광역–기초 공동학습·시범운영 전환율도 기록" },
          { kind: "outcome", label: "혁신행동", value: "3.17 → 추세", note: "q33_2 새 아이디어 개발 3.20도 함께 확인" },
        ],
        roadmap: [
          { period: "0~30일", title: "주민 현안을 교육과제로 바꿉니다", body: "현장 담당자와 주민의 반복 불편을 정하고 필요한 역량·권한·협업부서를 확인합니다." },
          { period: "31~60일", title: "학습 즉시 현장에 적용합니다", body: "교육팀이 실제 개선안을 시험하고 제안 처리상태와 장애요인을 공개합니다." },
          { period: "61~90일", title: "주민 체감과 확산성을 검토합니다", body: "불편 감소와 업무변화를 확인해 다른 읍면동·부서로 옮길지 결정합니다." },
        ],
      },
    ],
    decisionRule: "모형에서 큰 양의 조정계수와 집단별 현재 수준을 시범의 우선순위 가설로 사용하고, 집단별 p값만으로 부문 차이나 효과를 선언하지 않음",
    caution: "기관유형별 제안은 효과 차이의 증명이 아닙니다. 직접 계수차 검정이 없고 횡단면 자기보고 자료이므로, 부서 단위 시범운영에서 기준값·비교 기준·중단 기준을 두고 동일 문항의 도입 전후 측정으로 다시 확인하십시오.",
  },
  differenceStory: {
    title: "중앙과 지방의 혁신 차이는 어디서 보이나?",
    description: "혁신행동 평균 격차와 집단별 조정 후 연관·실행기반을 나눠 읽습니다.",
    shortValue: "0.14점",
    shortLabel: "중앙이 높은 혁신행동",
    kpi: { label: "가장 큰 핵심조건 격차", title: "공공봉사동기", value: "+0.17", note: "중앙이 높음 · 3.26 대 3.09" },
    steps: [
      {
        eyebrow: "먼저 결과를 확인",
        title: "혁신행동은 중앙이 더 높습니다.",
        body: "중앙 3.31점, 지방 3.17점으로 0.14점 차이가 났습니다. 이 차이는 통계적으로 뚜렷하지만, 어느 한 변수만으로 원인이 확정되지는 않습니다.",
        signals: [
          { label: "혁신행동", value: "중앙 3.31 · 지방 3.17", note: "평균 차이 p<.001" },
        ],
      },
      {
        eyebrow: "공통으로 관찰된 연관 확인",
        title: "두 집단에서 공공봉사동기의 양의 계수가 가장 컸습니다.",
        body: "국민과 사회에 도움이 되는 일을 중요하게 여기는 정도와 혁신행동의 양의 조정 후 연관이 중앙·지방에서 모두 p<.001이었습니다. 직접 계수차 검정이 없어 공통 원인이나 효과 차이로 해석하지 않습니다.",
        signals: [
          { label: "공공봉사동기 조정계수", value: "β .232 · .224", note: "중앙 · 지방 모두 p<.001 · 직접 계수차 검정 없음" },
          { label: "현재 수준", value: "중앙 3.26 · 지방 3.09", note: "지방이 0.17점 낮음" },
        ],
      },
      {
        eyebrow: "지방의 보완 경로",
        title: "동기·역량·업무태도를 높이고 교육과 참여를 실행으로 잇습니다.",
        body: "지방은 업무수행역량과 업무태도도 중앙보다 낮았습니다. 동시에 지방 내부에서는 교육훈련과 참여·소통이 혁신행동과 연결돼 현장 적용형 교육과 제안 회신체계를 먼저 시험할 근거가 됩니다.",
        signals: [
          { label: "업무수행역량", value: "지방 −0.14점", note: "중앙 3.43 · 지방 3.29" },
          { label: "업무태도", value: "지방 −0.12점", note: "중앙 3.28 · 지방 3.16" },
          { label: "지방 내부 시범 가설", value: "교육·참여 p<.05", note: "교육 p=.009 · 참여·소통 p=.021 · 부문 차이 미검정" },
        ],
      },
    ],
    conclusion: "중앙–지방 격차는 지방 구성원의 혁신 의지 부족으로 단순화하기보다, 공공가치 동기와 실행역량을 주민 현안형 교육·참여 구조로 연결하는 문제로 봐야 합니다.",
    caution: "현재 수준 차이와 집단별 회귀 결과를 함께 본 설명 단서입니다. 특정 요인이 0.14점 격차를 만들었다는 인과분해는 아닙니다.",
  },
  overallRegression: {
    title: "중앙·지자체 6,084명 통합 회귀",
    description: "두 집단을 모두 합친 뒤 기관유형과 원고의 개인·조직 조건을 통제한 조정 후 연관",
    n: data.overall_model.n,
    r2: data.overall_model.r_squared,
    adjustedR2: data.overall_model.adjusted_r_squared,
    maxFactorVif: data.overall_model.max_factor_vif,
    controlTerms: data.overall_model.control_terms,
    institutionReference: data.overall_model.institution_reference,
    factors: data.factors.map((factor) => ({
      id: factor.id,
      ...data.overall_model.coefficients[factor.id as keyof typeof data.overall_model.coefficients],
    })),
    interpretation: "다른 조건이 같을 때 공공봉사동기, 교육훈련, 참여·소통이 혁신행동과 통계적으로 연결됐습니다. 그중 공공봉사동기의 관계가 가장 컸습니다.",
    caution: "통합 결과는 이 조사 전체 응답표본에서 관찰된 조건부 연관입니다. 중앙과 지방의 시범 가설은 바로 아래 집단별 결과와 적용 범위를 함께 보고 정해야 합니다.",
  },
  operationalNote: " 혁신행동은 원고 표15와 같은 내용의 q33_1·q33_2 산술평균입니다. 원고의 5개 구성개념에 q20_1~q20_2 거래적 리더십을 추가해 6개 산술평균을 회귀에 동시에 넣었습니다. 변혁적 리더십은 q20_3~q20_6, 거래적 리더십은 성과기대·인정 및 보상 내용의 q20_1~q20_2입니다. 25문항 전체 EFA는 5요인, 리더십 6문항 별도 EFA는 1요인을 유지했습니다. 조직문화는 Q21 총 12문항 중 원고가 CVF에 배정한 q21_1~q21_8을 유형별 2문항 평균으로 만들고, 회귀에는 개인별 최고점 문화유형을 사용했습니다.",
  warnings: [
    "2018 원고의 PROCESS OLS를 그대로 복제한 결과가 아니라, 2025 자료에 TWT 가중치와 HC3 강건표준오차를 적용한 재분석입니다.",
    "공식 2025 보고서는 q20_1~q20_7을 넓은 ‘기관의 리더십 인식’ 문항군으로 제시합니다. 거래적 리더십은 q20_1~q20_2의 성과기대·인정 및 보상 내용을 토대로 붙인 분석용 이름입니다.",
    `변혁적·거래적 리더십 6문항 별도 EFA는 KMO ${data.leadership_efa.kmo.toFixed(3)}, 1요인(설명 ${(data.leadership_efa.variance_explained * 100).toFixed(1)}%)으로 수렴했습니다. 두 척도를 함께 넣은 회귀는 이론·문항내용에 따른 비교이며 통계적 분리가 확인됐다는 뜻은 아닙니다.`,
    "지방은 광역 1,620명과 기초 2,440명을 합친 집단이며 지방 내부 차이는 회귀에서 추가 통제했습니다.",
    "1~3급은 전체 6명뿐이므로 해당 통제계수는 현업 인사이트로 해석하지 않습니다.",
    "2025 중앙·지방 모형에는 공공·민간 자료와 동일한 조직공정성 척도가 없어 별도 공정성 계수를 만들지 않았습니다. 참여·소통을 조직공정성으로 바꾸어 부르지 않습니다.",
    "한 집단에서만 p<.05인 결과는 우선 시험할 단서이며, 그 기관유형만의 고유한 원인으로 확정하지 않습니다.",
    "우세문화 분류에서 공동 최고점을 혼재문화로 두어 두 집단 모두 혼재형이 절반 이상입니다. 문화 프로필 평균을 우선 해석하십시오.",
  ],
  footer: "한국행정연구원 공직생활실태조사 2025 · 김창일 박사학위 원고 표15 대응 재분석",
  culture: {
    dimensions: data.organization_culture.dimensions.map((dimension) => ({
      id: dimension.id as CultureDimension["id"],
      label: dimension.label,
      alias: dimension.english,
      cue: cultureCue[dimension.id],
      position: dimension.quadrant as CultureDimension["position"],
      variables: dimension.variables,
      a: dimension.central.mean,
      b: dimension.local.mean,
      items: dimension.item_means.map((item) => ({
        id: item.id,
        label: item.label,
        a: item.central,
        b: item.local,
      })),
    })),
    effects: cultureEffectIds.map((id) => ({
      id,
      label: centralCultureEffects[id].label.replace("조직문화: ", ""),
      a: centralCultureEffects[id],
      b: localCultureEffects[id],
    })),
    distribution: data.organization_culture.dominant_type.distribution.central.map((item) => ({
      id: item.id,
      label: item.label,
      a: item.share,
      b: data.organization_culture.dominant_type.distribution.local.find((candidate) => candidate.id === item.id)?.share ?? 0,
    })),
    referenceLabel: data.organization_culture.regression_controls.groups.central.reference.label,
    sourceNote: "Q21 총 12문항 중 원고가 CVF에 배정한 q21_1~q21_8만 사용했으며, q21_9~q21_12는 네 유형 산출에서 제외했습니다.",
    literature: {
      basis: "박사학위 원고 pp.44–45",
      why: "조직문화는 구성원에게 어떤 행동이 자연스럽고 보상받는지를 알려주는 공통의 환경이므로, 핵심요인의 조정 후 연관과 섞이지 않도록 통제하면서 두 조직의 문화 프로필도 따로 비교했습니다.",
      finding: "Quinn·Kimberly는 내부↔외부 지향과 유연성↔안정·통제의 두 축으로 네 문화유형을 구분했습니다. 원고는 Sarros, Jaskyte 등 조직문화와 혁신행동을 연결한 다수 연구를 근거로 이 변수를 포함했습니다.",
      references: [
        { label: "Quinn·Kimberly (1984)" },
        { label: "Quinn·McGrath (1985)" },
        { label: "Sarros et al. (2008)" },
        { label: "Jaskyte (2004)" },
      ],
      caution: "Q21 전체는 12문항입니다. 화면의 사분면 막대는 원고가 CVF에 사용한 8문항을 유형별 2문항으로 산술평균한 값이며, 회귀의 개인별 최고점 문화유형 더미와는 같은 숫자가 아닙니다.",
    },
  },
};

export default function CentralLocalDashboard({ initialYear }: { initialYear?: string }) {
  return <ComparisonDashboard config={config} requestedYear={initialYear} />;
}
