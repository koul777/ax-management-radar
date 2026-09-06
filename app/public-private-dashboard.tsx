import ComparisonDashboard, { ComparisonDashboardConfig, ComparisonFactor } from "./comparison-dashboard";
import data from "./data/innovation-analysis.json";

const insights: Record<string, string> = {
  proactivity: "공공과 민간 모두에서 가장 큰 영향요인은 변화주도성입니다. 아이디어를 내는 것보다 실제로 밀고 가는 실행성이 혁신행동과 가장 강하게 연결됩니다.",
  autonomy: "두 집단 모두에서 유의했고, 공공의 평균이 더 낮습니다. 공공은 혁신 구호보다 권한선과 실험 허용범위를 먼저 손보는 편이 자료에 더 맞습니다.",
  goal_clarity: "모든 통제변수를 넣으면 두 집단 모두 p<.05에 이르지 않았습니다. 목표를 명확히 말하는 것만으로 혁신행동이 높아진다고 단정하기 어렵습니다.",
  public_service_motivation: "공공과 민간 모두에서 유의합니다. 구성원이 자신의 일이 사회와 고객에게 주는 의미를 체감할수록 혁신행동이 높았습니다.",
  integrated_leadership: "윤리적·서번트·카리스마·포용적 리더십 15문항을 모두 평균한 통합지수입니다. 공공 β=.102(p=.051), 민간 β=.005(p=.915)로 두 집단 모두 p<.05에 이르지 않았습니다.",
};

const literature: Record<string, ComparisonFactor["literature"]> = {
  proactivity: {
    basis: "2024 조사·EFA 구성개념",
    why: "혁신은 제안 개수보다 스스로 문제를 찾고 끝까지 실행하는 성향과 더 가깝기 때문에, 변화주도성을 핵심 설명변수로 봅니다.",
    finding: "Parker, Williams, Turner와 후속 메타분석은 주도적 행동이 아이디어 실행과 문제해결 행동으로 이어진다고 정리합니다.",
    references: [
      { label: "Parker·Williams·Turner (2006)", href: "https://doi.org/10.1037/0021-9010.91.3.636" },
      { label: "Hammond et al. (2011)", href: "https://doi.org/10.1037/a0018556" },
    ],
    caution: "2024 설문 Y2 문항과 EFA 결과를 기준으로 구성했습니다.",
  },
  autonomy: {
    basis: "2024 조사·EFA + 혁신행동 연구",
    why: "새 방식을 실제로 시도하려면 현장 구성원이 일정 범위 안에서 판단하고 결정할 수 있어야 하므로 자율성을 별도 확인합니다.",
    finding: "국내 공공조직 연구와 Scott·Bruce, Amabile 계열 연구는 자율적 업무환경이 창의성과 혁신행동의 핵심 조건이라고 봅니다.",
    references: [
      { label: "김화연·오현규 (2018)", href: "https://doi.org/10.16881/jss.2018.07.29.3.243" },
      { label: "Scott·Bruce (1994)", href: "https://doi.org/10.5465/256701" },
      { label: "Amabile et al. (1996)", href: "https://doi.org/10.5465/256995" },
    ],
    caution: "2024 설문 Y4 문항군을 별도 요인으로 분석했습니다.",
  },
  goal_clarity: {
    basis: "선행연구 이론변수",
    why: "구성원이 무엇을 우선하고 어떤 기준으로 판단해야 하는지 알아야 실행 혼선을 줄일 수 있어 목표 명확성을 포함합니다.",
    finding: "목표설정 이론은 목표의 명확성이 행동 방향을 잡아준다고 보지만, 공공조직에서는 다른 조건을 함께 넣으면 효과가 약해질 수 있다는 보고도 있습니다.",
    references: [
      { label: "Perrow (1961)" },
      { label: "Locke·Latham (1990, 2006)" },
      { label: "김국진·강지선 (2019)", href: "https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002549723" },
    ],
    caution: "참고 원고의 종속변수는 직무몰입이므로, 여기서는 변수 채택 근거만 가져오고 결과 해석은 2024 혁신행동 자료에 맞춰 다시 했습니다.",
  },
  public_service_motivation: {
    basis: "선행연구 이론변수",
    why: "보상보다 사회적 기여를 중시하는 동기가 변화와 개선 행동을 떠받치는지 확인하기 위해 넣었습니다.",
    finding: "공공봉사동기는 공공과 민간 모두에서 혁신 관련 행동과 연결된다는 연구가 있지만, 크기와 경로는 자료마다 달라 이번 자료에서 다시 검증했습니다.",
    references: [
      { label: "Coursey et al. (2008)" },
      { label: "김태호·노종호 (2010)" },
      { label: "Wright et al. (2013)" },
      { label: "Miao et al. (2018)" },
    ],
    caution: "선행연구 결과가 완전히 같지 않아 2024 자료의 완전 통제모형으로 다시 확인했습니다.",
  },
  integrated_leadership: {
    basis: "2024 공식 리더십 4유형 15문항 + 공동 EFA",
    why: "상사의 윤리성·구성원 지원·비전 제시·의견 수렴이 함께 형성하는 전반적 리더십 환경이 혁신행동과 연결되는지 하나의 지수로 확인했습니다.",
    finding: "Scott·Bruce와 Amabile 등은 리더의 지원·신뢰·격려를 혁신과 창의성의 조직환경으로 다뤘습니다. 15문항 공동 EFA가 1요인을 유지해 전체 문항 산술평균을 통합 리더십 지수로 사용했습니다.",
    references: [
      { label: "한국행정연구원 공·사조직 비교조사 2024" },
      { label: "Scott·Bruce (1994)", href: "https://doi.org/10.5465/256701" },
      { label: "Amabile et al. (1996)", href: "https://doi.org/10.5465/256995" },
    ],
    caution: "통합지수는 2024 자료의 15문항을 묶은 분석용 변수입니다. 네 공식 유형은 평균 막대에서 따로 보여주지만, 회귀계수는 특정 유형 하나가 아니라 리더십 전반의 관계입니다.",
  },
};

const organizationalJusticeScale = data.control_scales.scales.find((scale) => scale.id === "organizational_justice")!;
const publicJusticeEffect = data.groups.public.control_coefficients.z_organizational_justice;
const privateJusticeEffect = data.groups.private.control_coefficients.z_organizational_justice;

const formatJusticeP = (value: number) => (value < 0.001 ? "p<.001" : `p=${value.toFixed(3).replace(/^0/, "")}`);

const config: ComparisonDashboardConfig = {
  variant: "public-private",
  analysisYear: 2024,
  eyebrow: "KIPA 2024 · 공공조직과 민간조직",
  title: "공공·민간 혁신행동 영향 대시보드",
  question: "어떤 요인이 혁신행동과 실제로 연결되고, 두 집단은 어디에서 다른가?",
  headline: "공통 핵심은 변화주도성입니다. 공공의 리더십 4유형 평균은 모두 민간보다 낮지만, 15문항 통합 리더십의 독립적 관계는 두 집단 모두 확인되지 않았습니다.",
  scopeBanner: "해석 범위: 이 메뉴는 원고와 종속변수가 다른 2024 공공·민간 자료입니다. 원고의 통제개념은 최대한 맞췄지만, 논문 결과를 그대로 복제한 화면은 아닙니다.",
  plainSummary: [
    {
      label: "확실히 보이는 점",
      title: "두 집단 모두 변화주도성과 공공봉사동기가 중요했습니다.",
      body: "스스로 문제를 찾고 끝까지 밀고 가는 성향, 그리고 자신의 일이 사회에 도움이 된다고 느끼는 정도가 혁신행동과 연결되었습니다. 통합 리더십은 공공 β=.102(p=.051), 민간 β=.005(p=.915)로 p<.05 기준에서는 유효하지 않았습니다.",
    },
    {
      label: "현재 수준 차이",
      title: "혁신행동 평균은 비슷하지만 공공의 실행 여건은 더 불리합니다.",
      body: "공공은 민간보다 업무 자율성이 0.40점, 조직공정성이 0.59점, 직무만족이 0.37점 낮았습니다. 반대로 업무량은 0.34점 높았습니다. 평균 차이는 관리 우선순위를 찾는 현황 신호입니다.",
    },
    {
      label: "관리 해석",
      title: "리더십 체감은 네 유형 모두 민간이 높지만, 곧바로 혁신의 원인이라고 볼 수는 없습니다.",
      body: "공공은 윤리적 −0.09점, 서번트 −0.25점, 카리스마 −0.29점, 포용적 리더십 −0.13점으로 모두 낮았습니다. 이는 관리환경의 개선 신호이고, 회귀에서 통합 리더십이 비유의였으므로 변화주도성·자율성 같은 확인된 동력과 함께 관리해야 합니다.",
    },
  ],
  source: "한국의 공·사조직 구성원 인식 비교 조사",
  sampleLabel: `N=${data.meta.total_n.toLocaleString("ko-KR")}`,
  groupA: {
    label: "공공조직",
    short: "공공",
    mean: data.groups.public.innovation_mean,
    n: data.groups.public.n,
    r2: data.groups.public.r_squared,
    maxFactorVif: data.groups.public.max_factor_vif,
  },
  groupB: {
    label: "민간조직",
    short: "민간",
    mean: data.groups.private.innovation_mean,
    n: data.groups.private.n,
    r2: data.groups.private.r_squared,
    maxFactorVif: data.groups.private.max_factor_vif,
  },
  outcomeGapP: data.outcome_gap.mean_p,
  factors: data.factors.map((factor) => ({
    id: factor.id,
    label: factor.label,
    short: factor.short,
    alpha: factor.reliability_alpha,
    variables: factor.variables,
    a: factor.public,
    b: factor.private,
    meanDifferenceP: factor.mean_gap_p,
    insight: insights[factor.id],
    literature: literature[factor.id],
    items: factor.item_means.map((item) => ({
      id: item.id,
      label: item.label,
      a: item.public,
      b: item.private,
    })),
  })),
  controls: data.meta.controls,
  controlTerms: data.meta.control_terms,
  modelFormula: "혁신행동 = 변화주도성 + 업무 자율성 + 목표 명확성 + 공공봉사동기 + 통합 리더십(15문항) + 통제항 18개",
  controlSummary: data.meta.control_note,
  controlResearchNote: "원고가 제시한 개인·사회경제·조직 요인 통제개념은 2024 자료에서 대응 가능한 범주와 문항으로 모두 넣었습니다. 영향요인의 회귀계수가 연령, 근속, 학력, 업무환경 차이 때문만은 아니라는 점을 보기 위한 장치입니다.",
  controlValidation: `업무량·직무만족·조직공정성은 각각 통제척도로 투입했습니다. 다만 11문항 공동 EFA는 원고처럼 3요인이 아니라 Kaiser 기준 ${data.control_efa_joint.retained_factor_count}요인이며 세 번째 고유값은 ${data.control_efa_joint.eigenvalues[2].toFixed(3)}입니다.`,
  factorSourceNote: "32문항 EFA 5요인 · 회귀 리더십은 15문항 통합지수",
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
    a: item.public.mean,
    b: item.private.mean,
  })),
  itemGroups: [
    ...data.factors
      .filter((factor) => factor.id !== "integrated_leadership")
      .map((factor) => ({
        id: `driver-${factor.id}`,
        label: factor.label,
        role: "driver" as const,
        items: factor.item_means.map((item) => ({
          id: item.id,
          label: item.label,
          a: item.public,
          b: item.private,
        })),
      })),
    ...data.leadership_profiles.profiles.map((profile) => ({
      id: `leader-${profile.id}`,
      label: `${profile.label} 평균`,
      role: "driver" as const,
      items: profile.item_means.map((item) => ({
        id: item.id,
        label: item.label,
        a: item.public,
        b: item.private,
      })),
    })),
    {
      id: "outcome-innovation",
      label: "혁신행동",
      role: "outcome" as const,
      items: data.outcome_items.map((item) => ({
        id: item.id,
        label: item.label,
        a: item.public.mean,
        b: item.private.mean,
      })),
    },
    ...data.control_scales.scales.map((scale) => ({
      id: `control-${scale.id}`,
      label: scale.label,
      role: "control" as const,
      items: scale.item_means.map((item) => ({
        id: item.id,
        label: item.label,
        a: item.public,
        b: item.private,
      })),
    })),
  ],
  itemComparisonNote: "성별·학력 등 범주형 통제변수는 이 도식 평균 비교에서 제외했지만, 회귀에는 모두 넣었습니다. 2024 공공·민간 자료에는 Quinn 경쟁가치모형 조직문화 문항이 없어 임의로 추가하지 않았습니다.",
  leadershipProfile: {
    title: "공공·민간 리더십 4유형 비교",
    description: "공식 보고서 분류대로 네 유형의 공공·민간 산술평균을 비교합니다. 주회귀에는 15문항 통합 리더십만 투입했습니다.",
    method: data.leadership_profiles.method,
    fieldInsight: {
      title: "리더십 평균 격차는 크지만, 리더 교육 하나만으로 혁신이 늘어난다고 보기는 어렵습니다.",
      body: "공공은 네 유형 모두 민간보다 낮고 특히 카리스마·서번트 리더십의 격차가 큽니다. 그러나 통합 리더십은 명시된 통제 후 유의하지 않았습니다. 리더십을 변화주도성·자율성과 함께 점검할 수 있지만, 어느 관리 개입이 혁신을 높이는지는 이 단면 분석만으로 확정할 수 없습니다.",
      actions: [
        "관리자 교육을 비전 설명에서 끝내지 말고 현장 제안의 승인·실험 권한으로 연결합니다.",
        "서번트·포용 행동은 팀별 경력지원, 애로 청취, 제안 회신기한처럼 관찰 가능한 운영지표로 바꿉니다.",
        "리더십 점수 상승만 보지 말고 제안→실험 전환율과 혁신행동 문항을 같은 주기로 추적합니다.",
      ],
    },
    efa: {
      kmo: data.leadership_efa.kmo,
      retained: data.leadership_efa.retained_factor_count,
      itemCount: data.leadership_efa.item_count,
      variance: data.leadership_efa.variance_explained,
      minimumLoading: data.leadership_efa.minimum_primary_loading,
    },
    profiles: data.leadership_profiles.profiles.map((profile) => ({
      id: profile.id,
      label: profile.label,
      short: profile.short,
      alpha: profile.reliability_alpha,
      inRegression: false,
      a: { mean: profile.public.mean },
      b: { mean: profile.private.mean },
      meanDifferenceP: profile.mean_gap_p,
      items: profile.item_means.map((item) => ({
        id: item.id,
        label: item.label,
        a: item.public,
        b: item.private,
      })),
    })),
    caution: "네 유형 모두 민간 평균이 더 높습니다. 공동 EFA는 하나의 리더십 요인으로 수렴했으므로 네 막대는 유형별 현재 수준, 메인 표의 통합 리더십 β는 15문항 전체의 통제 후 관계로 구분해 읽어야 합니다.",
  },
  changeManagement: {
    title: "공공 관리자 변화관리 실행안",
    description: "민간과의 격차를 현황 진단으로 쓰고, 공공 자료에서 확인된 유효요인을 90일 실행으로 바꿉니다.",
    audiences: [
      {
        id: "public-manager",
        label: "공공조직 관리자",
        diagnosis: {
          title: "혁신 수준보다 실행 조건 개선이 더 시급합니다.",
          body: "공공 구성원의 혁신행동 평균은 민간과 비슷했습니다. 문제는 아이디어를 실제 실험으로 옮길 자율성과 공정성 체감, 만족이 낮고 업무부담은 높다는 점입니다.",
          signals: [
            { label: "혁신행동", value: "공공 3.57 · 민간 3.54", note: "평균 차이 p=.384 · 뚜렷한 차이 없음" },
            { label: "업무 자율성", value: "공공 3.14 · 민간 3.55", note: "공공 −0.40 · 유의한 영향요인이면서 개선 여지" },
            { label: "조직공정성", value: "공공 2.67 · 민간 3.26", note: "공공 −0.59 · 직접 처방보다 현황 위험신호" },
          ],
        },
        priority: {
          eyebrow: "통계 확인 + 개선 여지 + 현업 조정 가능",
          title: "현장 개선과제부터 자율적 실행 범위를 먼저 명시하세요.",
          evidence: "공공에서 업무 자율성 β=.145(p=.001), 변화주도성 β=.427(p<.001)으로 혁신행동과 유의하게 연결됐습니다.",
          firstMove: "반복 업무 1건을 골라 승인 없이 바꿀 수 있는 방법, 범위, 기간을 팀 단위로 명시하고 30일간 실험합니다.",
          factorId: "autonomy",
          nextMoves: [
            "제안 건수보다 제안이 실제 실행으로 전환된 비율을 관리합니다.",
            "혁신과제를 누가 했는가보다 어떤 불편을 줄였는가와 연결합니다.",
            "새 과제를 늘리기보다 기존 업무 안에 실험 시간을 붙입니다.",
          ],
        },
        metrics: [
          { kind: "condition", label: "업무 자율성 3문항", value: "3.14 추세", note: "특히 Y4_3 의사결정 자율성 3.06" },
          { kind: "operation", label: "승인 없이 완료 가능한 실험 비율", value: "신규 수집", note: "제안-결재-실행 전환 주기와 함께 기록" },
          { kind: "outcome", label: "혁신행동과 업무방식 변화 실행", value: "3.57 · 3.49", note: "Y15_7~Y15_9를 분기별 동일 문항으로 추적" },
        ],
        roadmap: [
          { period: "0~30일", title: "병목과 권한선을 정리합니다", body: "반복되는 업무를 고르고 현행 결정·협의·승인 단계별 권한을 구분합니다." },
          { period: "31~60일", title: "작게 실험하고 막힘을 제거합니다", body: "저위험 과제 1~2건을 실행하고 관리자는 주 1회 승인·규정·업무량 장애물을 걷어냅니다." },
          { period: "61~90일", title: "유지·중단·확산을 결정합니다", body: "기존 방식과 처리시간·민원경험을 비교해 효과가 보인 방식만 표준업무로 만듭니다." },
        ],
      },
    ],
    decisionRule: "유효한 연결 + 낮은 현재 수준 + 관리자가 바꿀 수 있는 조건 = 먼저 실행할 변화관리 과제",
    caution: "집단 평균 격차를 개인 평가로 번역하는 것은 위험합니다. 부서 단위 개입 뒤 같은 문항으로 다시 확인해야 합니다.",
  },
  differenceStory: {
    title: "민간과 비교할 때 공공의 차이는 어디서 보이나",
    description: "결과 수준, 혁신과 연결된 요인, 현재 관리여건을 세 단계로 읽습니다.",
    shortValue: "0.03점",
    shortLabel: "혁신행동 평균 차이(비유의)",
    kpi: { label: "가장 큰 관리여건 격차", title: "조직공정성", value: "−0.59", note: "공공이 낮음 · 5문항 평균" },
    steps: [
      {
        eyebrow: "먼저 결과를 확인",
        title: "혁신행동 평균의 뚜렷한 차이는 확인되지 않았습니다.",
        body: "공공이 0.03점 높지만 p=.384로 통계적으로 뚜렷하지 않습니다. 이는 두 집단의 동등성을 입증한 결과가 아니며, 공공이 본질적으로 덜 혁신적이라는 결론도 지지하지 않습니다.",
        signals: [
          { label: "혁신행동", value: "공공 3.57 · 민간 3.54", note: "평균 차이 p=.384 · 뚜렷한 차이 없음" },
        ],
      },
      {
        eyebrow: "무엇이 혁신과 연결되나",
        title: "두 집단의 공통 동력은 비슷합니다.",
        body: "변화주도성, 업무 자율성, 공공봉사동기는 모든 통제변수를 넣은 뒤에도 공공과 민간 모두에서 혁신행동과 연결됐습니다.",
        signals: [
          { label: "변화주도성", value: "β .427 · .451", note: "공공과 민간 모두 p<.001" },
          { label: "공공봉사동기", value: "두 집단 모두 유의", note: "각 집단 p<.05" },
        ],
      },
      {
        eyebrow: "어디를 먼저 관리할까",
        title: "공공은 실행 여건에서 더 큰 격차가 납니다.",
        body: "공공은 자율성과 평가 공정성 체감이 낮고 업무부담은 높았습니다. 혁신 의지를 더 요구하기보다 권한선·평가 설명·실험시간을 정비하는 편이 자료에 더 맞습니다.",
        signals: [
          { label: "업무 자율성", value: "공공 −0.40점", note: "3.14 대 3.55" },
          { label: "조직공정성", value: "공공 −0.59점", note: "2.67 대 3.26 · 가장 큰 관리여건 격차" },
          { label: "업무량", value: "공공 +0.34점", note: "높을수록 부담이 큼" },
        ],
      },
    ],
    conclusion: "공공과 민간의 혁신행동 자체 차이보다, 공공에서 아이디어를 실행으로 바꾸는 관리 여건 격차가 더 선명하게 보입니다.",
    caution: "평균 격차는 원인을 확정하지 않습니다. 부서 단위 개입 전후를 같은 문항으로 다시 비교해야 합니다.",
    featuredRelationship: {
      label: "관리여건 상세 · 공정성 별도 확인",
      title: "조직공정성과 혁신행동의 통제 후 관계",
      definition: "성과평가 공정성 5문항 평균과 혁신행동의 관계를 다른 요인과 통제변수를 모두 넣은 뒤 확인",
      alpha: organizationalJusticeScale.reliability_alpha,
      a: {
        mean: organizationalJusticeScale.public.mean,
        beta: publicJusticeEffect.beta,
        p: publicJusticeEffect.p,
        significant: publicJusticeEffect.p < 0.05,
      },
      b: {
        mean: organizationalJusticeScale.private.mean,
        beta: privateJusticeEffect.beta,
        p: privateJusticeEffect.p,
        significant: privateJusticeEffect.p < 0.05,
      },
      interpretation: `공공 β=${publicJusticeEffect.beta.toFixed(3)}(${formatJusticeP(publicJusticeEffect.p)}), 민간 β=${privateJusticeEffect.beta.toFixed(3)}(${formatJusticeP(privateJusticeEffect.p)})로 두 집단 모두 독립적인 관계가 확인되지 않았습니다. 음의 부호를 ‘공정성이 혁신을 낮춘다’고 읽으면 안 됩니다.`,
      management: "공정성은 검증된 혁신 처방이라기보다 조직 신뢰의 기본조건으로 관리하고, Y6_1~Y6_5와 혁신행동을 같은 주기로 별도 추적하십시오.",
    },
  },
  operationalNote: "혁신행동은 Y15_7~Y15_9의 산술평균입니다. 주회귀의 32개 영향요인 문항은 EFA에서 변화주도성·자율성·목표명확성·공공봉사동기·통합 리더십의 5요인을 유지했습니다. 통합 리더십은 Y11~Y14 전체 15문항 산술평균입니다. 별도 막대그래프는 공식 보고서 분류에 따라 윤리적 5문항·서번트 3문항·카리스마 4문항·포용적 3문항을 각각 평균했습니다.",
  warnings: [
    "논문의 9개 통제개념은 모두 고려했지만 혼인상태·학력 범주를 통합했고 조직공정성 문항을 대체했으므로, 원고의 동일 통제코딩을 재현한 모형은 아닙니다.",
    `32문항 EFA는 5요인을 유지했고 32문항 모두 예상 요인에 배정됐지만, 1문항의 주적재량이 .60보다 낮아 최저값은 ${data.efa.minimum_primary_loading.toFixed(3)}입니다.`,
    `핵심요인 VIF는 공공 ${data.groups.public.max_factor_vif.toFixed(2)}, 민간 ${data.groups.private.max_factor_vif.toFixed(2)}로 낮지만 희소 범주형 더미까지 포함한 전체모형 최대 VIF는 각각 ${data.groups.public.max_full_model_vif.toFixed(2)}, ${data.groups.private.max_full_model_vif.toFixed(2)}입니다. 개별 소득 더미계수는 해석하지 않습니다.`,
    "2024 공공·민간 자료에는 Quinn 경쟁가치모형과 같은 조직문화 척도가 없어 조직문화를 임의로 매칭하지 않았습니다.",
    "참고 원고의 종속변수는 직무몰입이므로 2024 혁신행동 결과와 동일한 결과라고 볼 수 없습니다.",
    "혼인상태는 2024 자료에서 배우자 유무만 구분되며, 조직공정성은 원고 3문항이 아니라 2024판 성과평가 공정성 5문항입니다.",
    "리더십 4유형 평균 비교와 통합 리더십 회귀계수는 같은 뜻이 아닙니다. 유형별 막대는 현재 수준, 통합 β는 15문항 전반의 통제 후 관계입니다.",
  ],
  footer: "2024 공·사조직 구성원 인식 비교 조사 · 김창일 원고 참고",
};

export default function PublicPrivateDashboard({ initialYear }: { initialYear?: string }) {
  return <ComparisonDashboard config={config} requestedYear={initialYear} />;
}
