import { ArrowLeft, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataStatusBanner from "../components/DataStatusBanner";
import LossGroupedByStore from "../components/LossGroupedByStore";
import LossSectorSummary from "../components/LossSectorSummary";
import LossStoreCarousel from "../components/LossStoreCarousel";
import LossTop10BySector from "../components/LossTop10BySector";
import LossMetricCards from "../components/LossMetricCards";
import CompactReportHeader from "../components/CompactReportHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import useAsyncData from "../hooks/useAsyncData";
import { getLatestLossRun } from "../services/losses";
import { LOSS_STORE_ORDER } from "../utils/losses";
import { groupLossProductsByStore } from "../utils/lossProducts";
import { buildSectorSummary } from "../utils/lossDashboard";

function sortRows(rows = []) {
  return [...rows].sort((a, b) => {
    const ai = LOSS_STORE_ORDER.indexOf(String(a?.store_code).padStart(3, "0"));
    const bi = LOSS_STORE_ORDER.indexOf(String(b?.store_code).padStart(3, "0"));
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
}

export default function LossesPage() {
  const { data, loading, refreshing, error, refresh } = useAsyncData(
    getLatestLossRun,
    [],
  );
  const [selectedStore, setSelectedStore] = useState("307");
  const [view, setView] = useState("perdas");
  const [selectedSector, setSelectedSector] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSearchQuery(searchInput.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const rows = useMemo(() => sortRows(data?.rows || []), [data]);
  const selectedRow = useMemo(() => {
    if (!rows.length) return null;
    return (
      rows.find(
        (row) => String(row.store_code).padStart(3, "0") === selectedStore,
      ) || rows[0]
    );
  }, [rows, selectedStore]);

  const lossSectorSummary = useMemo(
    () => (selectedRow ? buildSectorSummary(selectedRow) : { sectors: [] }),
    [selectedRow],
  );
  const sectorsAboveTarget = useMemo(
    () =>
      (lossSectorSummary.sectors || []).filter(
        (sector) =>
          sector.target !== null &&
          sector.current.percent !== null &&
          Number(sector.current.percent) > Number(sector.target),
      ).length,
    [lossSectorSummary],
  );
  const sectorResult = useMemo(
    () =>
      selectedSector
        ? groupLossProductsByStore(rows, {
            sector: selectedSector,
            limitPerStore: 10,
          })
        : { groups: [], productCount: 0, storeCount: 0 },
    [rows, selectedSector],
  );
  const searchResult = useMemo(
    () =>
      searchQuery
        ? groupLossProductsByStore(rows, { query: searchQuery })
        : { groups: [], productCount: 0, storeCount: 0 },
    [rows, searchQuery],
  );

  const pageTitle =
    view === "top"
      ? "Top Perdas"
      : view === "search"
        ? "Pesquisa de Perdas"
        : "Perdas";
  const selectView = (nextView) => {
    setView(nextView);
    setSelectedSector(null);
  };

  return (
    <div className="page losses-page page-tight page-view-enter">
      {loading && !data && <LoadingState />}
      {!loading && error && !data && (
        <ErrorState error={error} onRetry={refresh} />
      )}
      {!loading && !error && !data && (
        <EmptyState message="Ainda não existe um período de perdas sincronizado." />
      )}

      {data && selectedRow && (
        <>
          <DataStatusBanner error={error} />

          <CompactReportHeader
            title={pageTitle}
            snapshot={selectedRow}
            onRefresh={refresh}
            refreshing={refreshing}
            printOrientation="landscape"
            className="loss-compact-header"
          >
            <div className="loss-header-toolbar">
              <div
                className="split-view-tabs loss-header-tabs"
                role="tablist"
                aria-label="Visões de perdas"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "perdas"}
                  className={`split-view-tab ${view === "perdas" ? "active" : ""}`}
                  onClick={() => selectView("perdas")}
                >
                  Perdas
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "top"}
                  className={`split-view-tab ${view === "top" ? "active" : ""}`}
                  onClick={() => selectView("top")}
                >
                  Top Perdas
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "search"}
                  className={`split-view-tab ${view === "search" ? "active" : ""}`}
                  onClick={() => selectView("search")}
                >
                  Pesquisa
                </button>
              </div>

              {view !== "search" && !selectedSector ? (
                <LossStoreCarousel
                  rows={rows}
                  selectedStore={String(selectedRow.store_code).padStart(3, "0")}
                  onSelect={setSelectedStore}
                  showFooter={false}
                />
              ) : (
                <div className="loss-search-scope">Pesquisa em todas as lojas</div>
              )}
            </div>
          </CompactReportHeader>

          <div
            key={`${view}-${selectedStore}-${selectedSector || ""}`}
            className="view-switch-enter"
          >
            {view === "perdas" ? (
              <>
                <LossMetricCards
                  totals={{
                    current_total_value: selectedRow.current_total_value,
                    previous_total_value: selectedRow.previous_total_value,
                    loss_difference: selectedRow.loss_difference,
                    loss_variation_percent: selectedRow.loss_variation_percent,
                    current_loss_sales_percent:
                      selectedRow.current_loss_sales_percent,
                    previous_loss_sales_percent:
                      selectedRow.previous_loss_sales_percent,
                  }}
                  sectorsAboveTarget={sectorsAboveTarget}
                  sectorCount={lossSectorSummary.sectors.length}
                />
                <LossSectorSummary row={selectedRow} />
              </>
            ) : null}
            {view === "top" && !selectedSector ? (
              <LossTop10BySector
                row={selectedRow}
                onSelectSector={setSelectedSector}
              />
            ) : null}
            {view === "top" && selectedSector ? (
              <>
                <div className="loss-subview-toolbar no-print">
                  <div>
                    <span>Top Perdas</span>
                    <strong>/ {selectedSector}</strong>
                  </div>
                  <button type="button" onClick={() => setSelectedSector(null)}>
                    <ArrowLeft size={15} /> Voltar para setores
                  </button>
                </div>
                <LossGroupedByStore
                  groups={sectorResult.groups}
                  snapshot={data}
                  title={`TOP PERDAS - ${selectedSector}`}
                  emptyMessage={`Nenhuma perda encontrada em ${selectedSector}.`}
                />
              </>
            ) : null}
            {view === "search" ? (
              <>
                <div className="loss-global-search no-print">
                  <label className="loss-search">
                    <Search size={16} />
                    <input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Buscar produto ou código"
                      aria-label="Buscar produto ou código"
                    />
                    {searchInput ? (
                      <button
                        type="button"
                        onClick={() => setSearchInput("")}
                        aria-label="Limpar pesquisa"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </label>
                  <button
                    type="button"
                    className="loss-clear-search"
                    onClick={() => setSearchInput("")}
                    disabled={!searchInput}
                  >
                    Limpar pesquisa
                  </button>
                  {searchQuery ? (
                    <span>
                      {searchResult.productCount} produtos encontrados em{" "}
                      {searchResult.storeCount} lojas
                    </span>
                  ) : null}
                </div>
                <LossGroupedByStore
                  groups={searchResult.groups}
                  snapshot={data}
                  title="PESQUISA DE PERDAS"
                  printDetail={
                    searchQuery
                      ? `Termo: ${searchQuery.toLocaleUpperCase("pt-BR")}`
                      : null
                  }
                  emptyMessage={
                    searchQuery
                      ? "Nenhum produto encontrado."
                      : "Digite um produto ou código para pesquisar."
                  }
                />
              </>
            ) : null}
          </div>

        </>
      )}
    </div>
  );
}
