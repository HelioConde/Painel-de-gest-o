import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataStatusBanner from "../components/DataStatusBanner";
import SnapshotView from "../components/SnapshotView";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import useAsyncData from "../hooks/useAsyncData";
import { getLatestEvents } from "../services/sales";
import { EVENT_META, hasEventStoreData } from "../utils/snapshot";
import { selectDefaultEvent } from "../utils/eventSelection";
import { periodLabel } from "../utils/formatters";
import primorLogoWide from "../assets/primor-logo-wide.png";
import bannerPizza from "../../Fundo/eventos/segunda-pizza.png";
import bannerCarne from "../../Fundo/eventos/terca-carne.png";
import bannerVerde from "../../Fundo/eventos/quarta-quinta-verde.png";
import bannerPao from "../../Fundo/eventos/sexta-pao.png";
import bannerWeekend from "../../Fundo/eventos/fim-semana.png";

const EVENT_BANNERS = {
  segunda_pizza: bannerPizza,
  terca_carne: bannerCarne,
  quarta_quinta_verde: bannerVerde,
  sexta_pao: bannerPao,
  fim_semana: bannerWeekend,
};

const ORDER = [
  "segunda_pizza",
  "terca_carne",
  "quarta_quinta_verde",
  "sexta_pao",
  "fim_semana",
];

export default function EventsPage() {
  const { data, loading, refreshing, error, refresh } = useAsyncData(
    getLatestEvents,
    [],
  );
  const [selectedSlug, setSelectedSlug] = useState(null);

  const eventMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(data) ? data : []).forEach((row) => {
      const slug = row.event_slug || row.slug;
      if (slug) map.set(slug, row);
    });
    return map;
  }, [data]);

  const tabs = useMemo(
    () =>
      ORDER.map((slug) => {
        const rawRow = eventMap.get(slug);
        const validRow = rawRow && hasEventStoreData(rawRow) ? rawRow : null;
        return {
          slug,
          row: validRow,
          hadIncompleteSnapshot: Boolean(rawRow && !validRow),
          meta: EVENT_META[slug] || {},
        };
      }).filter((item) => !item.hadIncompleteSnapshot || item.slug === "terca_carne"),
    [eventMap],
  );

  const selectableTabs = useMemo(() => tabs.filter((item) => item.row), [tabs]);

  useEffect(() => {
    if (!selectableTabs.length) return;
    if (!selectableTabs.some((item) => item.slug === selectedSlug)) {
      setSelectedSlug(selectDefaultEvent(tabs));
    }
  }, [tabs, selectableTabs, selectedSlug]);

  const selectedTab =
    tabs.find((item) => item.slug === selectedSlug) || selectableTabs[0] || tabs[0];
  const selected = selectedTab?.row || null;
  const meta = selectedTab?.meta || {};
  const selectedIndex = Math.max(
    0,
    selectableTabs.findIndex((item) => item.slug === selectedTab?.slug),
  );

  const moveEvent = (step) => {
    if (!selectableTabs.length) return;
    const next = (selectedIndex + step + selectableTabs.length) % selectableTabs.length;
    setSelectedSlug(selectableTabs[next].slug);
  };

  return (
    <div className="page page-tight page-events page-view-enter">
      <header
        className={`page-header dashboard-hero page-header-compact event-hero event-hero-standard ${meta.className || ""}`.trim()}
        style={{ "--event-banner-image": `url(${EVENT_BANNERS[selectedTab?.slug] || bannerVerde})` }}
      >
        <div className="print-report-brand">
          <img src={primorLogoWide} alt="Primor supermercado" />
        </div>

        <div className="page-header-copy dashboard-hero-copy">
          <h1>{selected?.event_name || selected?.name || meta.label || "Eventos"}</h1>
          <div className="header-meta dashboard-periods event-hero-meta">
            {selected ? (
              <>
                <span className="period-pill dashboard-current-period">
                  <CalendarDays size={14} />
                  {periodLabel(selected.current_start, selected.current_end)}
                </span>
                <small className="dashboard-compare-label">
                  Comp. {periodLabel(selected.previous_start, selected.previous_end)}
                </small>
              </>
            ) : (
              <small className="dashboard-compare-label">Sem dados disponíveis.</small>
            )}
          </div>
        </div>

        <div className="event-hero-nav no-print" aria-label="Navegação entre eventos">
          <button
            type="button"
            className="event-hero-nav-button previous"
            onClick={() => moveEvent(-1)}
            disabled={selectableTabs.length < 2}
            aria-label="Evento anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="event-hero-nav-count">
            {selectableTabs.length ? `${selectedIndex + 1}/${selectableTabs.length}` : ""}
          </span>
          <button
            type="button"
            className="event-hero-nav-button next"
            onClick={() => moveEvent(1)}
            disabled={selectableTabs.length < 2}
            aria-label="Próximo evento"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {loading && !data && <LoadingState />}
      {!loading && error && !data && <ErrorState error={error} onRetry={refresh} />}
      {data && <DataStatusBanner error={error} />}
      {!loading && !selected && (
        <EmptyState message="Ainda não existem eventos com detalhamento por loja sincronizados." />
      )}
      {selected && (
        <div key={selectedSlug} className="event-content-enter">
          <SnapshotView
            snapshot={selected}
            eventMeta={meta}
            reportTitle={selected?.event_name || selected?.name || meta.label || "Eventos"}
          />
        </div>
      )}
    </div>
  );
}
