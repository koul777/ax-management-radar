"use client";

import { useState } from "react";
import AiWorkplaceDashboard, { type AnalysisView } from "./ai-workplace-dashboard";
import CentralLocalDashboard from "./central-local-dashboard";
import PublicPrivateDashboard from "./public-private-dashboard";
import ResearchEvidencePanel from "./research-evidence-panel";
import SupplementalDataDashboard, { type SupplementalBundle } from "./supplemental-data-dashboard";
import publicBundle from "./data/supplemental-public.json";
import kipaDigitalBundle from "./data/supplemental-kipa-digital.json";
import personalBundle from "./data/supplemental-personal.json";
import workforceBundle from "./data/supplemental-workforce.json";
import { useManualTabFocus } from "./tab-navigation";

export type DashboardMenu = "ax" | "hccp" | "public-private" | "central-local" | "public-data" | "klips" | "personal-ai" | "citizen" | "research";

const workforceData = workforceBundle as unknown as SupplementalBundle;
function workforceScope(scope: "public_private_workers" | "citizen_services"): SupplementalBundle {
  return { datasets: workforceData.datasets.filter((dataset) => dataset.scope_type === scope) };
}

const menuGroups: Array<{ title: string; items: Array<{ id: DashboardMenu; title: string; subtitle: string }> }> = [
  { title: "조직 비교", items: [{ id: "ax", title: "사업체패널 · AX 조직관리", subtitle: "공공 ↔ 민간 · 현황과 실무 질문" }, { id: "public-private", title: "공공 ↔ 민간 · 혁신행동", subtitle: "KIPA 2024 · 2,020명" }] },
  { title: "공공 내부", items: [{ id: "central-local", title: "중앙 ↔ 지방 · 혁신행동", subtitle: "공직생활실태조사 2025 · 6,084명" }, { id: "public-data", title: "공공 인사·데이터·AI 활용", subtitle: "KIPA 2015 · 2019 · 2020 · 2022 · 2023" }] },
  { title: "개인·시민", items: [{ id: "klips", title: "근로자 직장 경험", subtitle: "KLIPS 2018 · 개인 단위" }, { id: "personal-ai", title: "개인 AI 이용", subtitle: "KISDI 2022–2024 · KMP 2023–2024" }, { id: "citizen", title: "시민 전자정부서비스", subtitle: "AI 이용 경험 · 시민 단위" }, { id: "research", title: "근거 · 자료", subtitle: "연구설계 · 확인범위 · 전이한계" }] },
];
const menuTabIds = menuGroups.flatMap((group) => group.items.map((item) => item.id));

function HccpUnavailable({ onMove }: { onMove: (menu: DashboardMenu) => void }) {
  return <section className="ax-dashboard hccp-unavailable" aria-labelledby="hccp-unavailable-title"><header className="ai-dashboard-header"><div><span>ARCHIVED FROM ACTIVE DASHBOARD</span><h1 id="hccp-unavailable-title">인적자본패널은 현재 구성에서 제외했습니다</h1><p>기존 원자료와 감사 기록은 보존하지만, 이 대시보드에서는 다른 조사와의 관측 단위·질문 차이 때문에 활성 결과로 제시하지 않습니다.</p></div></header><section className="ai-panel"><h2>다른 자료로 이동</h2><p>사업체의 AX 조직관리, 공공 내부 조직 경험, 개인 AI 이용·시민 서비스 자료는 각자의 분모와 측정범위를 분리해 제공합니다.</p><div className="ax-deeper-links"><button type="button" onClick={() => onMove("ax")}><strong>사업체 AX 조직관리</strong><span>공공·민간 사업체의 관리조건과 AI 활용 →</span></button><button type="button" onClick={() => onMove("research")}><strong>근거·자료</strong><span>활성 문헌과 자료별 확인 범위 →</span></button></div></section></section>;
}

export default function DashboardShell({ initialMenu, initialSection = "overview", initialYear, initialPrivateSize }: { initialMenu: DashboardMenu; initialSection?: AnalysisView; initialYear?: string; initialPrivateSize?: string }) {
  const [activeMenu, setActiveMenu] = useState<DashboardMenu>(initialMenu);
  const [activeSection, setActiveSection] = useState<AnalysisView>(initialSection);
  const [queryYear, setQueryYear] = useState(initialYear);
  const [querySize, setQuerySize] = useState(initialPrivateSize);
  const menuTabs = useManualTabFocus(menuTabIds, activeMenu);

  function selectMenu(menu: DashboardMenu) {
    if (menu === activeMenu) return;
    setActiveMenu(menu);
    setActiveSection("overview");
    setQueryYear(undefined);
    setQuerySize(undefined);
    const url = new URL(window.location.href);
    url.searchParams.set("view", menu);
    url.searchParams.delete("section");
    url.searchParams.delete("year");
    url.searchParams.delete("private_size");
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="app-main">
      <header className="comparison-menu-shell ax-app-shell">
        <div className="app-brand"><span>AMR</span><div><strong>AX 조직관리 레이더 / AX Management Radar</strong><small>공공·민간 비교로 찾는 AX 조직관리 인사이트</small></div></div>
        <div className="comparison-menu ax-main-menu" role="tablist" aria-label="자료영역 선택" aria-orientation="horizontal">
          {menuGroups.map((group) => <section key={group.title} className="ax-menu-group" aria-label={group.title}><strong>{group.title}</strong><div>{group.items.map((menu) => <button id={`menu-${menu.id}`} aria-controls="dashboard-content" aria-selected={activeMenu === menu.id} className={activeMenu === menu.id ? "active" : ""} data-tab-id={menu.id} key={menu.id} onClick={() => selectMenu(menu.id)} onFocus={() => menuTabs.onTabFocus(menu.id)} onBlur={menuTabs.onTabBlur} onKeyDown={menuTabs.onTabKeyDown} ref={menuTabs.registerTab(menu.id)} role="tab" tabIndex={menuTabs.focusedTabId === menu.id ? 0 : -1} type="button"><span>{menu.title}</span><small>{menu.subtitle}</small></button>)}</div></section>)}
        </div>
        <div className="global-method"><span>원자료 분석</span><span>독립된 조사</span></div>
      </header>
      <p className="global-reading-note">조사별 분석단위·시점·척도가 다릅니다 · 회귀는 조건부 연관이며 인과효과가 아닙니다 · 신뢰구간과 표본을 함께 읽으세요</p>
      <div id="dashboard-content" role="tabpanel" aria-labelledby={activeMenu === "hccp" ? undefined : `menu-${activeMenu}`} aria-label={activeMenu === "hccp" ? "인적자본패널 제외 안내" : undefined}>
        {activeMenu === "hccp" ? <HccpUnavailable onMove={selectMenu} /> : activeMenu === "research" ? <ResearchEvidencePanel /> : activeMenu === "public-data" ? <SupplementalDataDashboard key={activeMenu} initialYear={queryYear} bundles={[publicBundle as unknown as SupplementalBundle, kipaDigitalBundle as unknown as SupplementalBundle]} title="공공조직의 인사·데이터 활용 여건" description="교육·협업·리더십·자율성 등 관리 여건과 정부부문 생성형 AI의 업무 활용·장벽·지원 수요를 살펴봅니다. 민간 응답자는 포함하지 않으며, 연도별로 서로 다른 주제의 조사입니다." /> : activeMenu === "klips" ? <SupplementalDataDashboard key={activeMenu} initialYear={queryYear} bundles={[workforceScope("public_private_workers")]} title="근로자 직장 경험 · 공공기관·정부기관·민간" description="근로자 개인의 응답으로 세 기관유형 집단의 직장 경험을 비교합니다. 직접적인 AI 측정이나 관리개입의 효과를 보여주는 자료는 아닙니다." /> : activeMenu === "personal-ai" ? <SupplementalDataDashboard key={activeMenu} initialYear={queryYear} bundles={[personalBundle as unknown as SupplementalBundle]} title="개인 AI 이용과 디지털 경험" description="개인의 AI 경험과 디지털 서비스 인식입니다. 직업·연령 범주는 고용주 공공·민간 부문이 아니며, 조직 AX 성과를 뜻하지 않습니다." /> : activeMenu === "citizen" ? <SupplementalDataDashboard key={activeMenu} initialYear={queryYear} bundles={[workforceScope("citizen_services")]} title="시민 전자정부서비스 · AI 이용 경험" description="시민 단위의 전자정부서비스와 AI 이용 경험입니다. 연령집단은 고용주 부문이 아니며, 사업체·조직 성과 비교로 해석하지 않습니다." /> : activeMenu === "public-private" ? <PublicPrivateDashboard initialYear={queryYear} /> : activeMenu === "central-local" ? <CentralLocalDashboard initialYear={queryYear} /> : <AiWorkplaceDashboard key={activeMenu} initialView={activeSection} initialYear={queryYear} initialPrivateSize={querySize} onViewChange={setActiveSection} />}
      </div>
    </main>
  );
}
