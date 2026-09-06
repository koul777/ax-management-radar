import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const textOnly = (html) => html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "");
let renderSequence = 0;

async function render({ view = "ax", section = "overview", year, privateSize } = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("ux-qa", `${process.pid}-${renderSequence++}`);
  const { default: worker } = await import(workerUrl.href);
  const url = new URL("http://localhost/");
  if (view) url.searchParams.set("view", view);
  if (section) url.searchParams.set("section", section);
  if (year != null) url.searchParams.set("year", String(year));
  if (privateSize != null) url.searchParams.set("private_size", privateSize);
  return worker.fetch(new Request(url, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    waitUntil() {}, passThroughOnException() {},
  });
}

test("all 40 published WPS year × employment-band deep links retain the selected sample", async () => {
  const explorer = JSON.parse(await readFile(new URL("../app/data/wps-explorer.json", import.meta.url), "utf8"));
  const years = [...new Set(explorer.slices.map((slice) => slice.year))].sort((a, b) => a - b);
  assert.equal(years.length, 10);
  assert.deepEqual(explorer.size_groups.map((group) => group.id), ["all", "under300", "300_999", "1000_plus"]);

  for (const slice of explorer.slices) {
    const response = await render({ section: "catalog", year: slice.year, privateSize: slice.private_size_id });
    assert.equal(response.status, 200, `${slice.year}/${slice.private_size_id}`);
    const html = await response.text();
    const text = textOnly(html);
    const group = explorer.size_groups.find((item) => item.id === slice.private_size_id);
    const privateLabel = group.id === "all" ? group.label : `민간 ${group.label}`;
    assert.match(html, new RegExp(`<option value="${slice.private_size_id}" selected`));
    assert.match(text, new RegExp(`WPS ${slice.year}년 응답표본`));
    assert.match(text, new RegExp(privateLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, new RegExp(`공공 ${slice.public_n.toLocaleString("ko-KR")} · 민간 ${slice.private_n.toLocaleString("ko-KR")}`));
  }
});

test("unsupported WPS query values fail closed to latest year and all private employers", async () => {
  const response = await render({ section: "catalog", year: "not-a-year", privateSize: "not-a-size" });
  const html = await response.text();
  const text = textOnly(html);
  assert.equal(response.status, 200);
  assert.match(html, /<option value="2023" selected/);
  assert.match(html, /<option value="all" selected/);
  assert.match(text, /요청한 연도 또는 규모 구간을 사용할 수 없어/);
  assert.match(text, /WPS 2023년 응답표본/);
});

test("model and evidence routes keep their fixed periods rather than accepting descriptive filters", async () => {
  for (const section of ["adoption", "models", "framework"]) {
    const response = await render({ section, year: 2005, privateSize: "under300" });
    const html = await response.text();
    const text = textOnly(html);
    assert.equal(response.status, 200, section);
    assert.doesNotMatch(html, /id="wps-year"|id="wps-private-size"/);
    assert.match(text, /현황의 연도·민간 규모 선택을 회귀에 적용하지 않습니다|분석틀·선행연구의 측정기간은 근거별로 다릅니다/);
    assert.match(text, /모형을 새로 추정하거나 필터링한 결과가 아닙니다/);
  }
});

test("supplemental year selection, HCCP exclusion, keyboard semantics, and narrow-screen safeguards remain explicit", async () => {
  const [public2020, public2023, hccp, ax] = await Promise.all([
    render({ view: "public-data", year: 2020 }), render({ view: "public-data", year: 2023 }), render({ view: "hccp" }), render({ section: "overview", year: 2023, privateSize: "1000_plus" }),
  ]);
  const [public2020Html, public2023Html, hccpHtml, axHtml, css, shell, wps] = await Promise.all([
    public2020.text(), public2023.text(), hccp.text(), ax.text(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ai-workplace-dashboard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(public2020Html, /id="supplemental-year"/);
  assert.match(public2020Html, /<option value="2020" selected/);
  assert.match(public2023Html, /<option value="2023" selected/);
  assert.match(textOnly(hccpHtml), /현재 구성에서 제외했습니다/);
  assert.doesNotMatch(textOnly(hccpHtml), /HCCP.*회귀|HCCP.*결과/);
  assert.match(shell, /role="tablist" aria-label="자료영역 선택"/);
  assert.match(wps, /role="tablist" aria-label="WPS 분석 보기"/);
  assert.match(wps, /aria-selected=\{view === tab\.id\}/);
  assert.match(shell, /onBlur=\{menuTabs\.onTabBlur\}/);
  assert.match(wps, /onBlur=\{wpsTabs\.onTabBlur\}/);
  assert.match(css, /button:focus-visible, summary:focus-visible/);
  assert.match(css, /@media \(max-width: 640px\) \{ \.wps-explorer-controls/);
  assert.match(css, /\.ax-table-scroll \{ overflow-x: auto;/);
  assert.match(textOnly(axHtml), /20\/76/);
  assert.match(textOnly(axHtml), /공공 전체 · 고정 비교 기준/);
});
