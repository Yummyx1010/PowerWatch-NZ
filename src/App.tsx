import { DataProvider, usePowerWatchData } from "./components/DataProvider";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { StatePanel } from "./components/ui";
import { useHashRoute } from "./lib/router";
import { AnomaliesPage } from "./pages/AnomaliesPage";
import { HistoryPage } from "./pages/HistoryPage";
import { MethodPage } from "./pages/MethodPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RegionsPage } from "./pages/RegionsPage";

function Shell() {
  const { route, navigate } = useHashRoute();
  const { data, loading, freshness, reload } = usePowerWatchData();
  const statusLabel = `${data.manifest?.coverage.lastFinalDate ?? "no snapshot"} · ${data.manifest?.sourceCount ?? 0} sources`;

  const page = {
    overview: <OverviewPage navigate={navigate} />,
    regions: <RegionsPage />,
    anomalies: <AnomaliesPage />,
    history: <HistoryPage />,
    method: <MethodPage />,
  }[route];

  return (
    <div id="top" className="app-shell">
      <SiteHeader route={route} navigate={navigate} freshness={freshness} statusLabel={statusLabel} />
      <main className="page-stage" key={route}>
        {loading && freshness === "loading" ? (
          <div className="shell loading-stage" aria-label="Loading application data">
            <div className="skeleton skeleton--wide" />
            <div className="skeleton skeleton--title" />
            <div className="skeleton skeleton--text" />
            <div className="skeleton skeleton--text skeleton--short" />
            <StatePanel tone="loading" title="Waking the market" message="Reading verified snapshots from the static data layer…" />
          </div>
        ) : freshness === "error" ? (
          <div className="shell">
            <StatePanel
              tone="error"
              title="Application data could not be loaded"
              message={data.errors.join(" · ") || "Static JSON payloads are unavailable."}
              action={<button className="button button--primary" type="button" onClick={reload}>Try again</button>}
            />
          </div>
        ) : (
          page
        )}
      </main>
      <SiteFooter data={data} navigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}
