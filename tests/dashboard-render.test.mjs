import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function plainText(html) { return html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, ""); }

async function render(view = null, section = null, filters = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const url = new URL("http://localhost/");
  if (view) url.searchParams.set("view", view);
  if (section) url.searchParams.set("section", section);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, String(value));
  return worker.fetch(
    new Request(url, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("WPS year and employment-size deep links render the selected sample and only measured charts", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/wps-explorer.json", import.meta.url), "utf8"));
  assert.deepEqual(data.size_groups.map((group) => group.id), ["all", "under300", "300_999", "1000_plus"]);
  assert.equal(data.slices.length, 40);
  const selected = data.slices.find((slice) => slice.year === 2021 && slice.private_size_id === "under300");
  const response = await render("ax", "catalog", { year: 2021, private_size: "under300" });
  assert.equal(response.status, 200);
  const html = await response.text();
  const text = plainText(html);
  assert.match(text, /WPS 2021년 응답표본/);
  assert.ok(text.includes("공공 " + selected.public_n.toLocaleString("ko-KR") + " · 민간 " + selected.private_n.toLocaleString("ko-KR")));
  assert.equal((html.match(/class="ax-key-item /g) ?? []).length, selected.key_items.length);
  assert.equal(selected.key_items.length, 5);
  assert.match(text, /직접 AI 문항 미조사/);
  assert.doesNotMatch(text, /기준연도2023 한 해/);
  assert.match(html, /id="wps-year"/);
  assert.match(html, /id="wps-private-size"/);
  assert.match(text, /법정 중소·중견·대기업 분류가 아니라/);
});

test("WPS small-sample warnings do not hide public AI users with valid N between 5 and 29", async () => {
  const response = await render("ax", "perceptions", { year: 2023, private_size: "all" });
  const html = await response.text();
  const text = plainText(html);
  assert.equal((html.match(/class="ai-stacked-bar"/g) ?? []).length, 10);
  assert.match(text, /유효응답 21곳/);
  assert.match(text, /소표본 주의/);
  assert.match(text, /종속·설명·매개·조절변수로 사용하지 않습니다/);
  const oldYear = plainText(await (await render("ax", "perceptions", { year: 2019 })).text());
  assert.match(oldYear, /미조사/);
  assert.doesNotMatch(oldYear, /AI 영향 귀인형 인식 · 종속/);
});

test("WPS overview compares all approved size bands with item-specific AI denominators", async () => {
  const html = await (await render("ax", "overview", { year: 2023, private_size: "under300" })).text();
  const text = plainText(html);
  assert.match(text, /민간 규모를 나누어 비교하기/);
  assert.match(text, /공공 전체 · 고정 비교 기준/);
  assert.match(text, /SB는 ‘중소기업 \/ 중소기업 아님’ 두 범주/);
  for (const value of ["21.9% (21/96)", "4.5% (83/1837)", "13.1% (47/360)", "26.3% (20/76)"]) assert.ok(text.includes(value), value);
  assert.match(text, /공공과 민간의 업종·규모를 같게 맞춘 비교나 인과효과는 아닙니다/);
  const past = plainText(await (await render("ax", "overview", { year: 2021, private_size: "1000_plus" })).text());
  assert.match(past, /미조사/);
  assert.doesNotMatch(past, /21.9% \(21\/96\)/);
});

test("WPS regression pages retain fixed periods and do not inherit descriptive filters", async () => {
  const html = await (await render("ax", "adoption", { year: 2005, private_size: "under300" })).text();
  const text = plainText(html);
  assert.doesNotMatch(html, /id="wps-year"|id="wps-private-size"/);
  assert.match(text, /선택 모형 측정기간: 2021 관리 → 2023 AI 활용/);
  assert.match(text, /2,137/);
  assert.match(text, /현황의 연도·민간 규모 선택을 회귀에 적용하지 않습니다/);
  const source = await readFile(new URL("../app/ai-workplace-dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /model\?\.predictor_year === 2023/);
  assert.match(source, /<DescriptiveView key=\{year \+ "-" \+ privateSize \+ "-" \+ view\}/);
  assert.doesNotMatch(source, /distribution\.suppressed \|\| distribution\.small_sample/);
});

test("personal AI year selection filters datasets, question charts, yearly samples and transitions", async () => {
  const html2022 = await (await render("personal-ai", null, { year: 2022 })).text();
  const text2022 = plainText(html2022);
  assert.equal((html2022.match(/class="ai-panel supplemental-dataset"/g) ?? []).length, 1);
  assert.equal((html2022.match(/class="supplemental-question"/g) ?? []).length, 4);
  assert.equal((html2022.match(/class="supplemental-transition"/g) ?? []).length, 0);
  assert.match(text2022, /원응답 수5,378/);
  assert.doesNotMatch(text2022, /원응답 수14,379/);
  const html2024 = await (await render("personal-ai", null, { year: 2024 })).text();
  const text2024 = plainText(html2024);
  assert.equal((html2024.match(/class="supplemental-question"/g) ?? []).length, 10);
  assert.match(text2024, /분석 대상4,420/);
  assert.match(text2024, /분석 대상8,691/);
  assert.equal((html2024.match(/class="supplemental-transition"/g) ?? []).length, 0);
});

test("KIPA selected year opens its survey without presenting separate surveys as a trend", async () => {
  const html = await (await render("public-data", null, { year: 2019 })).text();
  const text = plainText(html);
  assert.equal((html.match(/class="ai-panel supplemental-dataset"/g) ?? []).length, 1);
  assert.equal((html.match(/class="supplemental-question"/g) ?? []).length, 14);
  assert.match(text, /분석 대상330/);
  assert.match(text, /같은 조직의 변화를 추적한 추세는 아닙니다/);
  assert.match(text, /이용조건 준수 서약서 전문/);
});

test("new KIPA digital-transformation and GenAI surveys retain separate samples and year routes", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/supplemental-kipa-digital.json", import.meta.url), "utf8"));
  assert.equal(data.datasets.length, 2);
  for (const [year, n] of [[2020, 305], [2023, 1608]]) {
    const dataset = data.datasets.find((item) => item.years.includes(year));
    assert.ok(dataset);
    assert.equal(dataset.publication_status, "approved");
    assert.equal(dataset.sample.analysis_n, n);
    assert.ok(dataset.questions.length >= 15);
    assert.deepEqual(dataset.models, []);
    const response = await render("public-data", null, { year });
    assert.equal(response.status, 200);
    const html = await response.text();
    const text = plainText(html);
    assert.equal((html.match(/class="ai-panel supplemental-dataset"/g) ?? []).length, 1);
    assert.equal((html.match(/class="supplemental-question"/g) ?? []).length, dataset.questions.length);
    assert.ok(text.includes("분석 대상" + n.toLocaleString("ko-KR")));
    assert.match(text, /한국행정연구원 연구자료관리규칙에 의거 사용허가를 받았음/);
    assert.doesNotMatch(text, /자료 이용 조건 확인 후 공개/);
  }
  const ai = data.datasets.find((item) => item.years.includes(2023));
  assert.ok(ai.questions.some((question) => question.groups.some((group) => group.structural_missing_n > 0)), "AI user-only questions must retain their excluded non-user counts");
});

test("single-wave screens explain incomplete year coverage instead of inventing older statistics", async () => {
  const [klips, citizen, publicPrivate] = await Promise.all([
    render("klips", null, { year: 2017 }), render("citizen", null, { year: 2022 }), render("public-private", null, { year: 2021 }),
  ]);
  const [klipsText, citizenText, comparisonText] = await Promise.all([klips.text(), citizen.text(), publicPrivate.text()]);
  assert.match(plainText(klipsText), /추가|검증과 집계 전/);
  assert.match(plainText(citizenText), /이전 연도는 미조사가 아니라 추가 검증·집계 전/);
  assert.match(plainText(comparisonText), /현재 검증된 2024년 결과를 표시/);
  assert.match(klipsText, /id="supplemental-year"[^>]*disabled/);
});

test("supplemental menus reset filters on route change and display Korean dimensions", async () => {
  const shell = await readFile(new URL("../app/dashboard-shell.tsx", import.meta.url), "utf8");
  const supplemental = await readFile(new URL("../app/supplemental-data-dashboard.tsx", import.meta.url), "utf8");
  assert.equal((shell.match(/<SupplementalDataDashboard key=\{activeMenu\}/g) ?? []).length, 4);
  assert.match(supplemental, /use_intention: "사용 의도"/);
  assert.match(supplemental, /dimensionLabel\(question.dimension\)/);
});

test("renders the dashboard shell with public-private leadership and no moderation copy", async () => {
  const response = await render("public-private");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /AX 조직관리 레이더 \/ AX Management Radar/);
  assert.match(html, /공공·민간 비교로 찾는 AX 조직관리 인사이트/);
  assert.match(html, /공공·민간 혁신행동 영향 대시보드/);
  assert.match(html, /공공·민간 리더십 4유형 비교/);
  assert.match(html, /조직공정성과 혁신행동의 통제 후 관계/);
  assert.match(html, /32문항 EFA 5요인 · 회귀 리더십은 15문항 통합지수/);
  assert.match(html, /통합 리더십\(15문항\) \+ 통제항 18개/);
  assert.match(html, /공공 2\.67 · 민간 3\.26/);
  assert.match(html, /-0\.074/);
  assert.match(html, /-0\.059/);
  assert.match(html, /리더십 평균 격차는 크지만, 리더 교육 하나만으로 혁신이 늘어난다고 보기는 어렵습니다/);
  assert.match(html, /현재 수준의 차이와 관리요인의 효과 차이는 다릅니다/);
  assert.match(html, /이 화면에는 직접 상호작용 검정이 없으며/);
  assert.match(html, /통제 후 관계/);
  assert.match(html, /46<\/strong><span>개 문항<\/span>/);
  assert.doesNotMatch(html, /증폭|조절효과|요인 × 소속 상호작용/);
});

test("dashboard source files reflect the latest factor choices", async () => {
  const [publicPrivateSource, centralLocalSource] = await Promise.all([
    readFile(new URL("../app/public-private-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/central-local-dashboard.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(publicPrivateSource, /factorSourceNote:\s*"32문항 EFA 5요인 · 회귀 리더십은 15문항 통합지수"/);
  assert.match(publicPrivateSource, /leadershipProfile:/);
  assert.match(publicPrivateSource, /공공·민간 리더십 4유형 비교/);
  assert.match(publicPrivateSource, /integrated_leadership/);
  assert.doesNotMatch(publicPrivateSource, /const inclusiveFactor/);

  assert.match(centralLocalSource, /transactional_leadership/);
  assert.match(centralLocalSource, /factorSourceNote:\s*"원고 5개 구성개념 \+ 거래적 리더십 2문항 추가 · 총 6개 회귀요인"/);
  assert.match(centralLocalSource, /overallRegression:/);
  assert.match(centralLocalSource, /data\.overall_model\.coefficients/);
  assert.doesNotMatch(centralLocalSource, /증폭|조절효과/);
});

test("public-private analysis payload uses four leadership bars and one integrated leadership regression", async () => {
  const raw = await readFile(new URL("../app/data/innovation-analysis.json", import.meta.url), "utf8");
  const data = JSON.parse(raw);

  assert.equal(data.meta.controls.length, 9);
  assert.equal(data.meta.control_terms, 18);
  assert.equal(data.factors.length, 5);
  assert.deepEqual(
    data.factors.filter((factor) => factor.public.significant && factor.private.significant).map((factor) => factor.id),
    ["proactivity", "autonomy", "public_service_motivation"],
  );
  assert.equal(data.groups.public.control_coefficients.z_organizational_justice.beta, -0.074);
  assert.equal(data.groups.private.control_coefficients.z_organizational_justice.beta, -0.059);
  assert.equal(data.efa.item_count, 32);
  assert.equal(data.efa.retained_factor_count, 5);
  assert.equal(data.control_efa_joint.retained_factor_count, 2);
  assert.equal(data.leadership_efa.retained_factor_count, 1);
  assert.equal(data.leadership_profiles.profiles.length, 4);
  assert.deepEqual(data.leadership_profiles.profiles.map((profile) => profile.id), ["ethical", "servant", "charismatic", "inclusive"]);
  assert.deepEqual(
    data.leadership_profiles.profiles.map((profile) => [profile.id, profile.public.mean, profile.private.mean]),
    [["ethical", 3.15, 3.24], ["servant", 2.74, 3], ["charismatic", 2.89, 3.18], ["inclusive", 3.11, 3.24]],
  );
  assert.deepEqual(data.leadership_profiles.profiles.filter((profile) => profile.in_main_regression), []);
  const integratedLeadership = data.factors.find((factor) => factor.id === "integrated_leadership");
  assert.equal(integratedLeadership.variables.length, 15);
  assert.equal(integratedLeadership.public.beta, 0.102);
  assert.equal(integratedLeadership.public.p, 0.0505);
  assert.equal(integratedLeadership.private.beta, 0.005);
  assert.equal(integratedLeadership.private.p, 0.9146);
  assert.equal(
    data.factors.filter((factor) => factor.id !== "integrated_leadership").reduce((sum, factor) => sum + factor.item_means.length, 0)
      + data.leadership_profiles.profiles.reduce((sum, profile) => sum + profile.item_means.length, 0)
      + data.outcome_items.length
      + data.control_scales.scales.reduce((sum, scale) => sum + scale.item_means.length, 0),
    46,
  );
});

test("central-local analysis payload includes transactional leadership and pooled regression", async () => {
  const raw = await readFile(new URL("../app/data/central-local-analysis.json", import.meta.url), "utf8");
  const data = JSON.parse(raw);
  const culture = data.organization_culture;

  assert.equal(data.meta.controls.length, 10);
  assert.equal(data.meta.control_terms, 16);
  assert.equal(data.factors.length, 6);
  assert.deepEqual(data.factors.map((factor) => factor.id), [
    "goal_clarity",
    "transformational_leadership",
    "transactional_leadership",
    "training",
    "participation_communication",
    "public_service_motivation",
  ]);
  assert.equal(Object.keys(data.groups.central.control_coefficients).length, 15);
  assert.equal(Object.keys(data.groups.local.control_coefficients).length, 16);
  assert.equal(data.overall_model.n, 6084);
  assert.equal(data.overall_model.control_terms, 17);
  assert.equal(data.overall_model.r_squared, 0.398);
  assert.deepEqual(
    Object.entries(data.overall_model.coefficients).filter(([, result]) => result.significant).map(([id]) => id),
    ["training", "participation_communication", "public_service_motivation"],
  );
  assert.equal(data.overall_model.coefficients.public_service_motivation.beta, 0.225);
  assert.equal(data.overall_model.coefficients.training.beta, 0.055);
  assert.equal(data.overall_model.coefficients.participation_communication.beta, 0.044);
  assert.equal(data.leadership_efa.retained_factor_count, 1);
  assert.equal(culture.framework, "Quinn 경쟁가치모형(CVF)");
  assert.equal(culture.dimensions.length, 4);
  assert.deepEqual(culture.dimensions.map((item) => item.id).sort(), ["development", "group", "hierarchy", "rational"]);
  assert.equal(
    data.factors.reduce((sum, factor) => sum + factor.item_means.length, 0)
      + data.outcome_items.length
      + data.control_scales.scales.reduce((sum, scale) => sum + scale.item_means.length, 0)
      + culture.cvf_item_count,
    48,
  );
});

test("central-local view limits subgroup coefficient comparisons to non-causal interpretation", async () => {
  const response = await render("central-local");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /현재 수준의 차이와 관리요인의 효과 차이는 다릅니다/);
  assert.match(html, /이 화면에는 직접 상호작용 검정이 없으며/);
  assert.match(html, /조직관리와 혁신행동의 통제 후 관계/);
  assert.match(html, /인과/);
});

test("AX dashboard retains WPS estimates while excluding HCCP from active analysis", async () => {
  const [source, wpsRaw, modelSource] = await Promise.all([
    readFile(new URL("../app/ai-workplace-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/wps-ax-analysis.json", import.meta.url), "utf8"),
    readFile(new URL("../app/ax-model-card.tsx", import.meta.url), "utf8"),
  ]);
  const wps = JSON.parse(wpsRaw);

  assert.match(source, /분석틀·선행연구/);
  assert.doesNotMatch(source, /hccpAnalysis|HCCP/);
  assert.match(source, /2023 관측보다 앞선 2021 관리특성; AI 최초 도입 전임은 미보장/);
  assert.match(source, /가중 민감도에서는 민간의 AI–혁신 연관도/);
  assert.match(modelSource, /공공·민간의 차이를 직접 검정/);
  assert.match(modelSource, /95% 신뢰구간/);
  assert.doesNotMatch(source, /새 종속변수는 아직 확정하지 않았습니다|민간 장기 벤치마크|OR 2\.04|90일 로드맵/);
  assert.doesNotMatch(source, /wps\.models|wps\.panel|hccp\.panel|wps\.governance/);
  assert.equal(wps.models.length, 10);
  assert.equal(wps.readiness_models.filter((model) => model.id !== "readiness_lag21_joint_logit_probability_sensitivity").length, 6);
  const logitSensitivity = wps.readiness_models.find((model) => model.id === "readiness_lag21_joint_logit_probability_sensitivity");
  assert.ok(logitSensitivity);
  assert.equal(logitSensitivity.status, "withheld");
  assert.equal(logitSensitivity.coefficients.length, 0);
  assert.equal(logitSensitivity.contrasts.length, 0);
  assert.ok(logitSensitivity.coefficients.every((term) => term.scale === "log_odds_audit_only"));
  assert.ok(logitSensitivity.contrasts.every((term) => term.scale === "standardized_probability_change"));
  assert.equal(wps.key_items.length, 30);
  assert.equal(wps.governance.length, 19);
  assert.deepEqual(wps.meta.groups.public, { n: 96, adopters: 21, valid_weight_n: 95 });
  for (const model of [...wps.models, ...wps.readiness_models]) {
    assert.ok(model.n > 0);
    assert.doesNotMatch(model.coefficients.map((term) => term.id).join(" "), /ai04[5-9]|perception/i);
    for (const term of [...model.coefficients, ...model.contrasts]) {
      assert.ok(Number.isFinite(term.beta));
      assert.ok(term.ci_low <= term.beta && term.beta <= term.ci_high);
    }
  }
});

test("default page leads with four prespecified public-private management profiles and operating questions", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /AX를 위한 조직관리, 공공과 민간은 무엇이 다른가/);
  const text = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "");
  assert.match(text, /2,369개 사업체/);
  assert.match(text, /공공 96 · 민간 2,273/);
  assert.equal((html.match(/class="ax-foundation-card"/g) ?? []).length, 4);
  assert.match(html, /공공 AX 실무 질문/);
  assert.match(html, /일반 훈련계획 유무/);
  assert.match(html, /평균\(1–5점\)/);
  assert.match(html, /매우 그렇다/);
  assert.match(html, /원표본 비율/);
  assert.match(html, /횡단면 가중 비율/);
  assert.match(html, /문헌기반 점검 제안 · 효과 입증 아님/);
  assert.doesNotMatch(html, /다중회귀 핵심 계수|공정혁신 관계 · 공공−민간/);
  assert.match(text, /질문 대상 10곳/);
  assert.match(html, /기술 요구/);
  assert.match(html, /협의 결과/);
  assert.doesNotMatch(html, /새 종속변수는 아직 확정하지 않았습니다|OR 2\.04|HCCP는 민간 장기 벤치마크/);
});

test("research workspace renders vetted studies, data filters, and no private data paths", async () => {
  const [response, source, dataRaw, modelCard] = await Promise.all([
    render("research"),
    readFile(new URL("../app/research-evidence-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/research-evidence.json", import.meta.url), "utf8"),
    readFile(new URL("../app/ax-model-card.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal(response.status, 200);
  const html = await response.text();
  const renderedText = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ");
  const evidence = JSON.parse(dataRaw);
  assert.match(html, /근거·자료/);
  assert.ok(/핵심\s+연구\s+10편/.test(renderedText), "research workspace should render the 10 active-study count");
  assert.match(html, /관측분포/);
  assert.match(html, /통제 후 연관/);
  assert.match(html, /인과검증 필요/);
  assert.ok(/2023 관측보다 앞선 2021 관리특성/.test(html), "research proposal should retain the observed-time ordering limit");
  assert.ok(/AI 최초 도입 전임은 미보장/.test(html), "research proposal should retain the first-adoption limit");
  assert.doesNotMatch(html, /HCCPⅠ|HCCPⅡ|값 13/);
  assert.match(source, /setDataset/);
  assert.match(source, /setTier/);
  assert.match(source, /dataset === "all"/);
  assert.match(source, /tier === "all"/);
  assert.equal(evidence.studies.length, 10);
  assert.deepEqual([...new Set(evidence.studies.map((study) => study.tier))].sort(), ["abstract_index", "metadata", "primary_text", "text_index"]);
  assert.equal(evidence.studies.find((study) => study.id === "w2").tier, "text_index");
  assert.equal(evidence.studies.find((study) => study.id === "p3").tier, "metadata");
  assert.ok(evidence.datasets.some((dataset) => dataset.name === "NIA 전자정부서비스 2024" && dataset.status === "raw_reviewed"));
  assert.doesNotMatch(`${source}\n${dataRaw}`, /(?:\.tmp[\\/]|C:\\workspace|respondent|microdata)/i);
  assert.match(modelCard, /log_odds_audit_only/);
  assert.match(modelCard, /probabilityContrastsOnly/);
  assert.match(modelCard, /로짓 원계수\(log odds\)는 감사용으로 숨기고/);
  assert.match(modelCard, /일부 범주 결과의 편중·분리 진단으로 로짓 확률 대비를 보류/);
  assert.match(source, /본문 검색 색인/);
  assert.match(source, /공개 근거 링크/);
});

test("HCCP deep link explains its exclusion without silently substituting WPS", async () => {
  const response = await render("hccp");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /인적자본패널은 현재 구성에서 제외했습니다/);
  assert.match(html, /기존 원자료와 감사 기록은 보존/);
  assert.match(html, /다른 자료로 이동/);
  assert.doesNotMatch(html, /인적자본패널: 조직관리와 혁신|시장 출시|HCCPⅠ/);
});

test("authorized KIPA aggregates are visible with attribution and the supplied usage terms", async () => {
  const [response, source, raw] = await Promise.all([
    render("public-data"),
    readFile(new URL("../app/supplemental-data-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/supplemental-public.json", import.meta.url), "utf8"),
  ]);
  const html = await response.text();
  const data = JSON.parse(raw);

  assert.equal(response.status, 200);
  assert.equal(data.datasets.length, 3);
  assert.ok(data.datasets.every((dataset) => dataset.publication_status === "approved"));
  assert.match(html, /공공조직의 인사·데이터 활용 여건/);
  assert.doesNotMatch(html, /자료 이용 조건 확인 후 공개/);
  assert.ok((html.match(/class="supplemental-question"/g) ?? []).length >= 42);
  assert.match(html, /응답 현황/);
  assert.doesNotMatch(html, /기술 분포/);
  assert.match(html, /한국행정연구원 연구자료관리규칙에 의거 사용허가를 받았음/);
  assert.match(html, /완성된 연구 결과물을 한국행정연구원에 제출하여야 한다/);
  assert.match(html, /제공받은 자료는 타인에게 양도 또는 대여하지 않을 것/);
  assert.match(source, /usagePending/);
  assert.match(source, /publication_status === "pending_usage_confirmation"/);
  assert.match(source, /사용허가 확인을 기다리는 자료/);
});

test("supplemental personal-AI route renders question detail from its JSON bundle", async () => {
  const [response, source, raw] = await Promise.all([
    render("personal-ai"),
    readFile(new URL("../app/supplemental-data-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/supplemental-personal.json", import.meta.url), "utf8"),
  ]);
  const html = await response.text();
  const data = JSON.parse(raw);
  const questionCount = data.datasets.reduce((total, dataset) => total + dataset.questions.length, 0);

  assert.equal(response.status, 200);
  assert.match(html, /개인 AI 이용과 디지털 경험/);
  assert.equal((html.match(/class="supplemental-question"/g) ?? []).length, questionCount);
  assert.match(source, /setDataset/);
  assert.match(source, /setYear/);
  assert.match(source, /setDimension/);
  assert.match(source, /dataset\.questions\.filter/);
  assert.match(source, /questions\.map/);
  assert.match(source, /defaultOpen=\{index < 3\}/);
  assert.match(source, /TransitionCard/);
  assert.equal((html.match(/class="supplemental-transition"/g) ?? []).length, data.datasets.reduce((total, dataset) => total + (dataset.transitions?.length ?? 0), 0));
  assert.match(html, /이전 응답/);
  assert.match(html, /이후:/);
  assert.doesNotMatch(`${source}\n${raw}`, /(?:\.tmp[\\/]|C:\\workspace|workforce-ai-analysis|hccp-innovation-analysis)/i);
});

test("KLIPS and citizen routes keep their supplied units, questions, and routes separate", async () => {
  const [klipsResponse, citizenResponse, source, shellSource, pageSource, raw] = await Promise.all([
    render("klips"),
    render("citizen"),
    readFile(new URL("../app/supplemental-data-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/supplemental-workforce.json", import.meta.url), "utf8"),
  ]);
  const [klipsHtml, citizenHtml] = await Promise.all([klipsResponse.text(), citizenResponse.text()]);
  const data = JSON.parse(raw);
  const klips = data.datasets.find((dataset) => dataset.id === "klips_2018");
  const citizen = data.datasets.find((dataset) => dataset.id === "nia_2024");

  assert.equal(klipsResponse.status, 200);
  assert.equal(citizenResponse.status, 200);
  assert.equal(klips.scope_type, "public_private_workers");
  assert.equal(citizen.scope_type, "citizen_services");
  assert.match(klipsHtml, /근로자 직장 경험 · 공공기관·정부기관·민간/);
  assert.match(citizenHtml, /시민 전자정부서비스 · AI 이용 경험/);
  assert.match(klipsHtml, new RegExp(klips.title));
  assert.match(citizenHtml, new RegExp(citizen.title));
  assert.equal((klipsHtml.match(/class="supplemental-question"/g) ?? []).length, klips.questions.length);
  assert.equal((citizenHtml.match(/class="supplemental-question"/g) ?? []).length, citizen.questions.length);
  assert.match(shellSource, /workforceScope\("public_private_workers"\)/);
  assert.match(shellSource, /workforceScope\("citizen_services"\)/);
  assert.match(pageSource, /view === "klips"/);
  assert.match(pageSource, /view === "citizen"/);
  assert.match(source, /setDatasetId\(nextId\)/);
  assert.match(source, /function chooseYear\(value: string\)/);
  assert.match(source, /setDimension\("all"\)/);
  assert.match(source, /chooseYear\(nextYears\.length/);
  assert.doesNotMatch(`${source}\n${shellSource}\n${raw}`, /(?:\.tmp[\\/]|C:\\workspace|workforce-ai-analysis|hccp-innovation-analysis)/i);
});

test("all 30 core item charts are server rendered with valid categories and explicit denominators", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/wps-ax-analysis.json", import.meta.url), "utf8"));
  const response = await render("ax", "catalog");
  assert.equal(response.status, 200);
  const html = await response.text();
  const plain = plainText(html);
  assert.equal((html.match(/class="ax-key-item /g) ?? []).length, 30);
  assert.match(plain, /핵심 문항 30개 · 선택 연도 전체 비교/);
  assert.match(plain, /질문 대상 10곳/);
  assert.match(plain, /질문 대상 60곳/);
  assert.match(html, /질문 비대상/);
  assert.match(html, /허용범위 밖/);
  assert.match(html, /AI 영향 귀인형 인식/);
  assert.match(html, /인사부서/);
  for (const item of data.key_items) {
    assert.ok(html.includes(item.column), `${item.column} missing from catalogue`);
    assert.equal(item.public.responses.length, item.categories.length);
    assert.equal(item.private.responses.length, item.categories.length);
  }
});

test("management-to-AI model deep link exposes lag, Holm correction and limits on causal identification", async () => {
  const response = await render("ax", "adoption");
  assert.equal(response.status, 200);
  const html = await response.text();
  const plain = html.replace(/<[^>]+>/g, "");
  assert.match(plain, /2021 조직관리 → 2023 AI 현재 활용/);
  assert.match(plain, /공공 86관측/);
  assert.match(plain, /민간 2,051관측/);
  assert.match(html, /Holm 보정 p/);
  assert.match(html, /\.123/);
  assert.match(html, /신규 AI 도입의 인과효과/);
  assert.match(html, /직접 측정한 2021 AI 기저상태가 없어/);
  assert.match(html, /95% 신뢰구간/);
});

test("causal framework deep link renders study designs, full variable roles and adjustment rationale", async () => {
  const response = await render("ax", "framework");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /인과관계 검토: 통제와 패널만으로 충분한가/);
  assert.match(html, /선행연구에 근거한 통제변수와 실제 확보 여부/);
  assert.match(html, /자동으로 통제하지 않는 변수/);
  assert.match(html, /매개·조절·기제/);
  assert.match(html, /Weiner/);
  assert.match(html, /Jöhnk/);
  assert.match(html, /Hernán/);
  assert.match(html, /가설적 분석틀/);
});

test("AI-to-innovation estimates are retained in the explicitly supplementary section", async () => {
  const response = await render("ax", "models");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /혁신은 보조 결과이며 AX 성공의 대체 지표가 아닙니다/);
  assert.match(html, /-25\.7/);
  assert.match(html, /22\.5/);
  assert.match(html, /동등성의 증거가 아닙니다/);
  assert.match(html, /가중 민감도에서는 민간의 AI–혁신 연관도/);
});

test("AI impact perceptions retain every response category and remain descriptive only", async () => {
  const [source, raw] = await Promise.all([
    readFile(new URL("../app/ai-workplace-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/wps-attribution-perceptions.json", import.meta.url), "utf8"),
  ]);
  const data = JSON.parse(raw);
  const perceptions = data.wps.perceptions;
  const expectedCodes = [1, 2, 3, 99];

  assert.match(source, /item\.category === "attributed_perceptions"/);
  assert.doesNotMatch(source, /workforce-ai-analysis/);
  assert.doesNotMatch(source, /responses\.slice\(0,\s*3\)/);
  assert.match(source, /종속·설명·매개·조절변수로 사용하지 않습니다/);
  assert.match(source, /모름·불명은 문항 정의에 따라 막대와 분모에 포함합니다/);
  assert.match(source, /weighted \? response\.weighted_share : response\.share/);
  assert.deepEqual(perceptions.map((item) => item.column), ["ai045", "ai046", "ai047", "ai048", "ai049"]);
  const explorer = JSON.parse(await readFile(new URL("../app/data/wps-explorer.json", import.meta.url), "utf8"));
  const current = explorer.slices.find((slice) => slice.year === 2023 && slice.private_size_id === "all");
  for (const original of perceptions) {
    const currentItem = current.key_items.find((item) => item.column === original.column);
    assert.equal(currentItem.usage, "descriptive_only_no_regression");
    for (const sector of ["public", "private"]) {
      assert.deepEqual(currentItem[sector].responses.map((response) => Object.fromEntries(Object.keys(original[sector].responses[0]).map((field) => [field, response[field]]))), original[sector].responses);
    }
  }

  for (const item of perceptions) {
    assert.equal(item.usage, "descriptive_only");
    assert.deepEqual(item.categories.map((category) => category.code), expectedCodes);
    for (const group of ["public", "private"]) {
      const stats = item[group];
      assert.deepEqual(stats.responses.map((response) => response.code), expectedCodes);
      assert.equal(stats.responses.reduce((sum, response) => sum + response.n, 0), stats.valid_n);
      assert.equal(stats.responses.reduce((sum, response) => sum + response.weighted_n, 0), stats.weighted_n);
      assert.equal(stats.responses.filter((response) => response.code !== 99).reduce((sum, response) => sum + response.n, 0), stats.informative_n);
      assert.ok(stats.valid_n <= stats.raw_n);
      assert.ok(stats.weighted_n <= stats.valid_n);
      for (const response of stats.responses) {
        assert.ok(Number.isInteger(response.n) && response.n >= 0);
        assert.ok(response.share >= 0 && response.share <= 1);
        assert.ok(response.weighted_share >= 0 && response.weighted_share <= 1);
        assert.ok(Math.abs(response.share - response.n / stats.valid_n) < 1e-10);
      }
      assert.ok(Math.abs(stats.responses.reduce((sum, response) => sum + response.share, 0) - 1) < 1e-10);
      assert.ok(Math.abs(stats.responses.reduce((sum, response) => sum + response.weighted_share, 0) - 1) < 1e-10);
    }
  }

  const productivity = perceptions.find((item) => item.column === "ai046");
  assert.deepEqual(productivity.public.responses.map((response) => response.n), [4, 6, 1, 10]);
  assert.equal(productivity.public.raw_n, 21);
  assert.equal(productivity.public.informative_n, 11);
  assert.equal(productivity.private.raw_n, 150);
  assert.equal(productivity.private.informative_n, 82);

});

test("WPS innovation uses an annual outcome window rather than the two-year wave interval", async () => {
  const source = await readFile(new URL("../app/ai-workplace-dashboard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /지난\s*2년 조직혁신/);
  assert.match(source, /2023년 한 해의 결과/);
  assert.match(source, /직접 AI·AX 관리문항은 2023년에만 관측됩니다/);
  assert.doesNotMatch(source, /workforce-ai-analysis/);
});
