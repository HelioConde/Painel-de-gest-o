import { useMemo, useState } from "react";
import { metricValue, percent } from "../utils/formatters";
import {
  getEventMetricFields,
  getEventStoreRows,
  getEventNetworkSummary,
} from "../utils/snapshot";
import PrintReportHeader from "./PrintReportHeader";
import {
  ChartCard,
  KpiCard,
  StatusBadge,
} from "./dashboard/DashboardPrimitives";
import {
  ArrowDownUp,
  BarChart3,
  CircleDollarSign,
  Store,
  TrendingUp,
} from "lucide-react";

function numberOrZero(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function valueClass(value) {
  const number = Number(value);
  if (number > 0) return "positive-text";
  if (number < 0) return "negative-text";
  return "";
}

function performanceClass(value) {
  const number = Number(value);
  if (number > 0) return "performance-positive";
  if (number < 0) return "performance-negative";
  return "performance-neutral";
}

function StoreValues({ item, fields, metric, unit }) {
  const current = item?.[fields.current];
  const previous = item?.[fields.previous];
  const difference = item?.[fields.difference];
  const variation = item?.[fields.variation];

  return (
    <>
      <td data-label="Atual" className="event-store-current">
        {metricValue(numberOrZero(current), metric, unit)}
      </td>
      <td data-label="Ano anterior">
        {metricValue(numberOrZero(previous), metric, unit)}
      </td>
      <td data-label="Diferença" className={valueClass(difference)}>
        {metricValue(numberOrZero(difference), metric, unit)}
      </td>
      <td data-label="Variação" className={valueClass(variation)}>
        {percent(variation)}
      </td>
    </>
  );
}

function EventBars({ rows, fields, metric, unit }) {
  const maximum = Math.max(
    1,
    ...rows.flatMap((row) => [
      numberOrZero(row.item?.[fields.current]),
      numberOrZero(row.item?.[fields.previous]),
    ]),
  );

  return (
    <div
      className="event-vertical-chart"
      aria-label="Comparativo de vendas por loja"
    >
      <div className="event-chart-legend">
        <span>
          <i className="current" />
          Atual
        </span>
        <span>
          <i className="previous" />
          Anterior
        </span>
      </div>
      <div className="event-bars">
        {rows.map((row) => {
          const current = numberOrZero(row.item?.[fields.current]);
          const previous = numberOrZero(row.item?.[fields.previous]);
          const difference = numberOrZero(row.item?.[fields.difference]);
          const variation = numberOrZero(row.item?.[fields.variation]);
          const tooltip = [
            `Loja ${row.storeCode}`,
            `Atual: ${metricValue(current, metric, unit)}`,
            `Anterior: ${metricValue(previous, metric, unit)}`,
            `Diferença: ${metricValue(difference, metric, unit)}`,
            `Variação: ${percent(variation)}`,
          ].join("\n");

          return (
            <article
              key={row.storeCode}
              title={tooltip}
              aria-label={tooltip.replaceAll("\n", ". ")}
            >
              <div className="event-bar-columns">
                <i
                  className="current"
                  style={{
                    height: `${Math.max(3, (current / maximum) * 100)}%`,
                  }}
                />
                <i
                  className="previous"
                  style={{
                    height: `${Math.max(3, (previous / maximum) * 100)}%`,
                  }}
                />
              </div>
              <strong>{row.storeCode}</strong>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SortButton({ active, direction, onClick, children }) {
  return (
    <button
      type="button"
      className={`event-table-sort ${active ? "active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
      <ArrowDownUp size={11} aria-hidden="true" />
      {active ? <span className="sr-only">Ordem {direction === "asc" ? "crescente" : "decrescente"}</span> : null}
    </button>
  );
}

export default function EventStoreComparison({
  snapshot,
  eventMeta,
  reportTitle = "Eventos",
}) {
  const rows = getEventStoreRows(snapshot);
  const total = getEventNetworkSummary(snapshot);
  const fields = getEventMetricFields(snapshot);
  const metric = fields.metric || snapshot?.metric || "monetary";
  const unit = fields.unit ?? snapshot?.unit;
  const currentYear =
    String(snapshot?.current_start || "").slice(0, 4) || "Atual";
  const previousYear =
    String(snapshot?.previous_start || "").slice(0, 4) || "Anterior";
  const current = numberOrZero(total?.[fields.current]);
  const previous = numberOrZero(total?.[fields.previous]);
  const difference = numberOrZero(total?.[fields.difference]);
  const variation = numberOrZero(total?.[fields.variation]);

  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ key: "sequence", direction: "asc" });

  const best = [...rows].sort(
    (left, right) =>
      numberOrZero(right.item?.[fields.variation]) -
      numberOrZero(left.item?.[fields.variation]),
  )[0];
  const worst = [...rows].sort(
    (left, right) =>
      numberOrZero(left.item?.[fields.variation]) -
      numberOrZero(right.item?.[fields.variation]),
  )[0];
  const worstImpact = [...rows].sort(
    (left, right) =>
      numberOrZero(left.item?.[fields.difference]) -
      numberOrZero(right.item?.[fields.difference]),
  )[0];

  const positiveRows = rows.filter(
    (row) => numberOrZero(row.item?.[fields.variation]) > 0,
  );
  const negativeRows = rows.filter(
    (row) => numberOrZero(row.item?.[fields.variation]) < 0,
  );

  const positiveImpact = positiveRows.reduce(
    (sum, row) => sum + Math.max(0, numberOrZero(row.item?.[fields.difference])),
    0,
  );
  const negativeImpact = negativeRows.reduce(
    (sum, row) => sum + Math.min(0, numberOrZero(row.item?.[fields.difference])),
    0,
  );

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      const rowVariation = numberOrZero(row.item?.[fields.variation]);
      if (filter === "positive") return rowVariation > 0;
      if (filter === "negative") return rowVariation < 0;
      return true;
    });

    const sorted = [...filtered].sort((left, right) => {
      let leftValue;
      let rightValue;

      if (sort.key === "store") {
        leftValue = String(left.storeName || left.storeCode || "");
        rightValue = String(right.storeName || right.storeCode || "");
        return sort.direction === "asc"
          ? leftValue.localeCompare(rightValue, "pt-BR")
          : rightValue.localeCompare(leftValue, "pt-BR");
      }

      if (sort.key === "sequence") {
        leftValue = numberOrZero(left.sequence);
        rightValue = numberOrZero(right.sequence);
      } else {
        const fieldMap = {
          current: fields.current,
          previous: fields.previous,
          difference: fields.difference,
          variation: fields.variation,
        };
        leftValue = numberOrZero(left.item?.[fieldMap[sort.key]]);
        rightValue = numberOrZero(right.item?.[fieldMap[sort.key]]);
      }

      return sort.direction === "asc"
        ? leftValue - rightValue
        : rightValue - leftValue;
    });

    return sorted;
  }, [rows, fields, filter, sort]);

  const changeSort = (key) => {
    setSort((currentSort) => ({
      key,
      direction:
        currentSort.key === key && currentSort.direction === "desc"
          ? "asc"
          : "desc",
    }));
  };

  const worstVariation = numberOrZero(worst?.item?.[fields.variation]);
  const worstInsightLabel = worstVariation < 0 ? "Maior queda" : "Menor crescimento";
  const resultDirection = variation > 0 ? "acima" : variation < 0 ? "abaixo" : "igual";
  const resultVerb = variation > 0 ? "crescimento" : variation < 0 ? "queda" : "estabilidade";

  return (
    <section className={`event-store-panel ${eventMeta?.className || ""}`}>
      <PrintReportHeader
        title={reportTitle}
        snapshot={snapshot}
        storeLabel="Todas as lojas"
      />

      <section className="kpi-grid event-kpi-grid">
        <KpiCard
          label="Venda do evento"
          value={metricValue(current, metric, unit)}
          detail={null}
          trend={variation}
          icon={CircleDollarSign}
          tone="green"
        />
        <KpiCard
          label="Edição anterior"
          value={metricValue(previous, metric, unit)}
          detail={null}
          icon={Store}
          tone="slate"
        />
        <KpiCard
          label="Diferença"
          value={metricValue(difference, metric, unit)}
          detail={null}
          trend={variation}
          icon={TrendingUp}
          tone="blue"
        />
        <KpiCard
          label="Resultado vs. anterior"
          value={percent(variation)}
          detail={null}
          trend={variation}
          icon={BarChart3}
          tone="purple"
        />
      </section>

      <section className="event-quick-summary" aria-label="Resumo rápido do evento">
        <div>
          <small>Leitura rápida</small>
          <strong>
            {rows.length
              ? `${negativeRows.length} de ${rows.length} lojas em queda`
              : "Sem lojas para comparar"}
          </strong>
        </div>
        <p>
          O evento ficou <b>{percent(Math.abs(variation))}</b> {resultDirection} da edição anterior,
          com {resultVerb} de <b>{metricValue(Math.abs(difference), metric, unit)}</b>.
          {best ? (
            <> A loja <b>{best.storeCode}</b> foi o principal destaque com <b>{percent(best.item?.[fields.variation])}</b>.</>
          ) : null}
        </p>
      </section>

      <section className="performance-section">
        <section className="event-performance-card">
          <header className="event-performance-heading">
            <Store size={20} />
            <div>
              <h2>Desempenho por loja</h2>
              <p>Compare a edição atual com a anterior e filtre rapidamente os destaques.</p>
            </div>
            <div className="event-performance-controls no-print" aria-label="Filtrar lojas por desempenho">
              <button
                type="button"
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                Todas <span>{rows.length}</span>
              </button>
              <button
                type="button"
                className={filter === "positive" ? "active positive" : "positive"}
                onClick={() => setFilter("positive")}
              >
                Crescimento <span>{positiveRows.length}</span>
              </button>
              <button
                type="button"
                className={filter === "negative" ? "active negative" : "negative"}
                onClick={() => setFilter("negative")}
              >
                Queda <span>{negativeRows.length}</span>
              </button>
            </div>
          </header>

          <div className="event-store-table-wrap">
            <table className="event-store-table">
              <thead>
                <tr>
                  <th>
                    <SortButton
                      active={sort.key === "store" || sort.key === "sequence"}
                      direction={sort.direction}
                      onClick={() => changeSort("store")}
                    >
                      Loja
                    </SortButton>
                  </th>
                  <th>
                    <SortButton active={sort.key === "current"} direction={sort.direction} onClick={() => changeSort("current")}>
                      {currentYear}
                    </SortButton>
                  </th>
                  <th>
                    <SortButton active={sort.key === "previous"} direction={sort.direction} onClick={() => changeSort("previous")}>
                      {previousYear}
                    </SortButton>
                  </th>
                  <th>
                    <SortButton active={sort.key === "difference"} direction={sort.direction} onClick={() => changeSort("difference")}>
                      <span className="report-full-label">Diferença</span>
                      <span className="report-short-label">Dif.</span>
                    </SortButton>
                  </th>
                  <th>
                    <SortButton active={sort.key === "variation"} direction={sort.direction} onClick={() => changeSort("variation")}>
                      <span className="report-full-label">Variação</span>
                      <span className="report-short-label">Var.</span>
                    </SortButton>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.storeCode}
                    className={`event-store-row store-${row.storeCode} ${performanceClass(row.item?.[fields.variation])}`}
                  >
                    <td className="event-store-name" data-label="Loja">
                      <span className="event-store-sequence">
                        {row.sequence}
                      </span>
                      <span
                        className="event-store-copy"
                        data-mobile={row.storeName.replace(/^SUPERMERCADO\s+/i, "")}
                      >
                        <strong>{row.storeName}</strong>
                      </span>
                    </td>
                    <StoreValues
                      item={row.item}
                      fields={fields}
                      metric={metric}
                      unit={unit}
                    />
                  </tr>
                ))}
                {!visibleRows.length ? (
                  <tr className="event-store-empty">
                    <td colSpan={5}>Nenhuma loja neste filtro.</td>
                  </tr>
                ) : null}
              </tbody>
              {total && filter === "all" && (
                <tfoot>
                  <tr>
                    <td className="event-store-total-label">Todas as lojas</td>
                    <StoreValues
                      item={total}
                      fields={fields}
                      metric={metric}
                      unit={unit}
                    />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <ChartCard eyebrow="POR LOJA" title="Comparativo de vendas" className="event-chart-card">
          <EventBars rows={rows} fields={fields} metric={metric} unit={unit} />
          <div className="event-chart-insights">
            <article className="insight-positive">
              <small>Maior crescimento</small>
              <strong>{best ? `Loja ${best.storeCode}` : "—"}</strong>
              {best ? <StatusBadge value={best.item?.[fields.variation]} /> : null}
              {best ? (
                <span>{metricValue(numberOrZero(best.item?.[fields.difference]), metric, unit)}</span>
              ) : null}
            </article>
            <article className="insight-negative">
              <small>{worstInsightLabel}</small>
              <strong>{worst ? `Loja ${worst.storeCode}` : "—"}</strong>
              {worst ? <StatusBadge value={worst.item?.[fields.variation]} /> : null}
              {worst ? (
                <span>{metricValue(numberOrZero(worst.item?.[fields.difference]), metric, unit)}</span>
              ) : null}
            </article>
            <article className="insight-info">
              <small>Resultado geral</small>
              <strong>{percent(variation)}</strong>
              <span>{metricValue(difference, metric, unit)}</span>
            </article>
          </div>
        </ChartCard>
      </section>

      <section className="event-manager-insights" aria-label="Diagnóstico gerencial do evento">
        <header>
          <small>DIAGNÓSTICO DO EVENTO</small>
          <h2>O que merece atenção</h2>
        </header>
        <div className="event-manager-insight-grid">
          <article className="positive">
            <small>Lojas em crescimento</small>
            <strong>{positiveRows.length} de {rows.length}</strong>
            <span>Impacto positivo de {metricValue(positiveImpact, metric, unit)}</span>
          </article>
          <article className="negative">
            <small>Lojas em queda</small>
            <strong>{negativeRows.length} de {rows.length}</strong>
            <span>Impacto negativo de {metricValue(Math.abs(negativeImpact), metric, unit)}</span>
          </article>
          <article>
            <small>Maior impacto negativo</small>
            <strong>{worstImpact ? `Loja ${worstImpact.storeCode}` : "—"}</strong>
            <span>
              {worstImpact
                ? metricValue(numberOrZero(worstImpact.item?.[fields.difference]), metric, unit)
                : "Sem dados"}
            </span>
          </article>
          <article>
            <small>Principal destaque</small>
            <strong>{best ? `Loja ${best.storeCode}` : "—"}</strong>
            <span>
              {best
                ? `${percent(best.item?.[fields.variation])} · ${metricValue(numberOrZero(best.item?.[fields.difference]), metric, unit)}`
                : "Sem dados"}
            </span>
          </article>
        </div>
      </section>
    </section>
  );
}
