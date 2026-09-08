import assert from "node:assert/strict";

const base = process.argv[2];
assert.ok(base && /^https?:\/\//.test(base), "Supply the local or deployed base URL");
const localDevelopment = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname);
const checks = [
  ["/", /AX 조직관리 레이더/, /AX Management Radar/, /AX를 위한 조직관리, 공공과 민간은 무엇이 다른가/, /AI 활용/],
  ["/?view=hccp", /인적자본패널/, /제외/],
  ["/?view=public-private", /공공·민간 혁신행동 연관성 비교/, /KIPA/],
  ["/?view=central-local", /중앙정부/, /지방자치단체/],
  ["/?view=research", /근거·자료/, /핵심 연구/, /김동배·이인재/, /오주현/],
  ["/?view=ax&section=catalog", /핵심 문항/, /dq1029/, /ai049/],
  ["/?view=ax&section=adoption", /조직관리 조건과 이후 AI 활용의 관계/, /2021/, /2023/, /보조 민감도/],
  ["/?view=ax&section=framework", /인과관계 검토/, /통제변수/, /측정/],
  ["/?view=ax&section=models", /AI–혁신 관계/, /보조 분석/],
  ["/?view=public-data", /공공조직의 인사·데이터 활용 여건/, /클라우드/, /생성형/, /이용조건 준수 서약서 전문/],
  ["/?view=public-institutions", /공공기관 혁신·AI 관측/, /기관별 평가 등급과 기관 찾기/, /지방공기업 경영평가/, /공공 AI 입력·도입·조달·지원 관측/, /검증된 출처와 수집 대기 목록/, /이용조건은 출처별로 확인/],
  ["/?view=ax&year=2023&private_size=under300", /민간 규모를 나누어 비교하기/, /1,837/, /300인 미만|300명 미만/, /83\/1837/],
  ["/?view=ax&section=catalog&year=2021&private_size=300_999", /2021년 응답표본/, /dq1029/, /직접 AI 문항 미조사/],
  ["/?view=public-data&year=2020", /디지털 전환/, /305/, /한국행정연구원 연구자료관리규칙에 의거 사용허가를 받았음/],
  ["/?view=public-data&year=2023", /생성형/, /1,608/, /구조적 결측/],
  ["/?view=personal-ai&year=2022", /5,378/, /사용 의도/],
  ["/?view=klips", /한국노동패널 2018/, /정부 외 공공기관/, /p214321/],
  ["/?view=personal-ai", /지능정보사회/, /한국미디어패널/, /2024/, /비가중/],
  ["/?view=citizen", /전자정부서비스 2024/, /AI 전자정부서비스/, /Q24/, /비가중/],
];
let rootHtml = "";
for (const [route, ...patterns] of checks) {
  const url = new URL(route, base);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { accept: "text/html" } });
  assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
  assert.equal(new URL(response.url).origin, url.origin, `${route}: redirected outside the dashboard to ${new URL(response.url).origin}; check deployment protection`);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  const html = await response.text();
  const plain = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "");
  for (const pattern of patterns) assert.ok(pattern.test(plain), `${route}: required study content missing (${pattern})`);
  assert.ok(!/Internal Server Error|__vite_error_overlay__/.test(html), `${route}: server error in response`);
  assert.ok(!/C7A01_07|C7A02_02|HCCPⅠ은 민간 조직관리/.test(html), `${route}: old HCCP analysis leaked`);
  if (!localDevelopment) assert.ok(!/(?:["'\s])[a-z]:[\\/](?:Users|workspace)|\.tmp[\\/]/i.test(html), `${route}: local private path exposed`);
  if (route.includes("public-private") || route.includes("central-local")) {
    assert.ok(html.includes("아래 관리요인의 검증된 집단 간 직접 대비는 표시하지 않으며"), `${route}: subgroup inference warning missing`);
  }
  if (route.includes("view=public-data")) assert.doesNotMatch(plain, /자료 이용 조건 확인 후 공개|기술 분포/);
  if (route === "/") rootHtml = html;
  console.log(`${route}: HTTP 200, study-specific server render verified`);
}
for (const key of ["og:image", "twitter:image"]) {
  const tag = [...rootHtml.matchAll(/<meta\b[^>]*>/g)].map((match) => match[0]).find((value) => value.includes(`"${key}"`));
  assert.ok(tag, `Missing ${key} metadata`);
  const source = tag.match(/content="([^"]+)"/)?.[1];
  assert.ok(source && /^https?:\/\//.test(source), `${key}: expected absolute image URL`);
  const imageUrl = new URL(source.replaceAll("&amp;", "&"));
  assert.equal(imageUrl.origin, new URL(base).origin, `${key}: image does not use incoming request host`);
  const response = await fetch(imageUrl, { method: "HEAD", signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${key}: image request failed`);
  assert.match(response.headers.get("content-type") ?? "", /^image\//);
}
const urls = [...rootHtml.matchAll(/(?:src|href)="([^"<>]+\.(?:js|css)(?:\?[^"<>]*)?)"/g)]
  .map((match) => new URL(match[1].replaceAll("&amp;", "&"), base))
  .filter((url) => url.origin === new URL(base).origin);
const assets = [...new Set(urls.map(String))];
assert.ok(assets.length > 0, "No emitted JavaScript or stylesheet assets found");
for (const url of assets.slice(0, 8)) {
  const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `Asset failed: ${new URL(url).pathname}`);
  assert.doesNotMatch(response.headers.get("content-type") ?? "", /text\/html/, "Asset returned HTML instead of JS/CSS");
}
console.log(`${Math.min(assets.length, 8)} JS/CSS assets and absolute OG/X image metadata verified. No browser interaction test was performed.`);
