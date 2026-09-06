import DashboardShell, { type DashboardMenu } from "./dashboard-shell";
import type { AnalysisView } from "./ai-workplace-dashboard";

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string | string[]; section?: string | string[]; year?: string | string[]; private_size?: string | string[] }> }) {
  const params = await searchParams;
  const view = typeof params?.view === "string" ? params.view : "ax";
  const initialMenu: DashboardMenu = view === "hccp" || view === "public-private" || view === "central-local" || view === "public-data" || view === "klips" || view === "personal-ai" || view === "citizen" || view === "research" ? view : "ax";
  const section = typeof params?.section === "string" ? params.section : "overview";
  const initialSection: AnalysisView = section === "catalog" || section === "adoption" || section === "framework" || section === "models" || section === "governance" || section === "perceptions" ? section : "overview";
  const initialYear = typeof params.year === "string" ? params.year : undefined;
  const initialPrivateSize = typeof params.private_size === "string" ? params.private_size : undefined;
  return <DashboardShell initialMenu={initialMenu} initialSection={initialSection} initialYear={initialYear} initialPrivateSize={initialPrivateSize} />;
}
