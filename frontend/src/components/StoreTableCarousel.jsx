import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Store,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import CompactReportHeader from "./CompactReportHeader";
import HierarchyExplorer from "./HierarchyExplorer";
import PrintReportHeader from "./PrintReportHeader";
import { SalesCharts, SalesKpiGrid } from "./SalesInsights";
import { getScope, getStoreOptions } from "../utils/snapshot";

const STORE_ORDER = ["307", "212", "600", "120", "033", "018"];
const STORE_SEQUENCE = Object.fromEntries(
  STORE_ORDER.map((code, index) => [code, String(index + 1).padStart(2, "0")]),
);

function orderOptions(options) {
  const network = options.find((option) => option.value === "network");
  const stores = options
    .filter((option) => option.value !== "network")
    .sort((a, b) => {
      const ai = STORE_ORDER.indexOf(String(a.value).padStart(3, "0"));
      const bi = STORE_ORDER.indexOf(String(b.value).padStart(3, "0"));
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });

  return network ? [...stores, network] : stores;
}

function storeCode(option) {
  return option.value === "network"
    ? "TODAS"
    : String(option.value).padStart(3, "0");
}

function sequence(option) {
  if (option.value === "network") return "07";
  return STORE_SEQUENCE[String(option.value).padStart(3, "0")] || "—";
}

function displayName(option) {
  if (option.value === "network") return "Todas as lojas";
  const fromLabel = option.label?.split("·")?.[1]?.trim();
  return (
    fromLabel || `SUPERMERCADO PRIMOR ${sequence(option)} ${storeCode(option)}`
  );
}

function shortDisplayName(option) {
  if (option.value === "network") return "Todas as lojas";
  const raw = displayName(option);
  return raw.replace(/\s+\d{3}\s*$/, "");
}

function storeTone(option) {
  return option.value === "network"
    ? "network"
    : String(option.value).padStart(3, "0");
}

export default function StoreTableCarousel({
  snapshot,
  reportTitle = "Relatório",
  onRefresh,
  refreshing = false,
}) {
  const options = useMemo(
    () => orderOptions(getStoreOptions(snapshot)),
    [snapshot],
  );
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);

  useEffect(() => {
    setIndex(0);
  }, [snapshot?.snapshot_key]);

  const active = options[index] || options[0];
  const activeScope = active ? getScope(snapshot, active.value) : null;

  const move = (direction) => {
    if (!options.length) return;
    setIndex((current) =>
      Math.max(0, Math.min(options.length - 1, current + direction)),
    );
  };

  const handleTouchStart = (event) => {
    touchStart.current = event.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    if (touchStart.current === null) return;
    const end = event.changedTouches?.[0]?.clientX;
    if (end === undefined) return;
    const delta = end - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 42) return;
    move(delta < 0 ? 1 : -1);
  };

  if (!active) return null;

  const monthly =
    snapshot?.snapshot_type === "MONTHLY" ||
    snapshot?.snapshot_type === "MONTHLY_CLOSE";

  return (
    <section
      className="table-carousel sales-report-shell"
      aria-label="Comparativo de vendas por loja"
    >
      <PrintReportHeader
        title={reportTitle}
        snapshot={snapshot}
        storeLabel={
          active.value === "network"
            ? "Todas as lojas"
            : `Loja ${sequence(active)} - ${storeCode(active)}`
        }
        storeDetail={active.value === "network" ? null : displayName(active)}
      />

      <CompactReportHeader
        title={reportTitle}
        snapshot={snapshot}
        onRefresh={onRefresh}
        refreshing={refreshing}
      >
        <div
          className="compact-store-switcher"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            className="compact-store-arrow"
            onClick={() => move(-1)}
            disabled={index === 0}
            aria-label="Loja anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <div className={`compact-store-current store-tone-${storeTone(active)}`}>
            <span className="compact-store-icon">
              {active.value === "network" ? <Building2 size={17} /> : <Store size={17} />}
            </span>
            <div className="compact-store-copy">
              <small>
                {active.value === "network" ? "REDE" : `LOJA ${sequence(active)}`}
                <em>{index + 1}/{options.length}</em>
              </small>
              <strong>{shortDisplayName(active)}</strong>
            </div>
            <span className="compact-store-code">{storeCode(active)}</span>
          </div>

          <button
            type="button"
            className="compact-store-arrow"
            onClick={() => move(1)}
            disabled={index === options.length - 1}
            aria-label="Próxima loja"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </CompactReportHeader>

      <SalesKpiGrid scope={activeScope} />

      <div className="table-carousel-viewport sales-compact-table">
        <div
          className="table-carousel-track"
          style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
        >
          {options.map((option, optionIndex) => {
            const scope = getScope(snapshot, option.value);
            return (
              <div
                className={`table-carousel-slide ${optionIndex === index ? "active" : ""}`}
                key={option.value}
                aria-hidden={optionIndex !== index}
                inert={optionIndex !== index}
              >
                <HierarchyExplorer
                  snapshot={snapshot}
                  scope={scope}
                  carouselMode
                />
              </div>
            );
          })}
        </div>
      </div>

      <SalesCharts snapshot={snapshot} scope={activeScope} monthly={monthly} />
    </section>
  );
}
