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
import { BarChart3, CircleDollarSign, Store, TrendingUp } from "lucide-react";

function numberOrZero(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function valueClass(value) {
  const number = Number(value);
  if (number > 0) return "positive-text";
  if (number < 0) return "negative-text";
  return "";
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
          return (
            <article key={row.storeCode}>
              <div className="event-bar-columns">
                <i
                  className="current"
                  title={`Atual: ${metricValue(current, metric, unit)}`}
                  style={{
                    height: `${Math.max(3, (current / maximum) * 100)}%`,
                  }}
                />
                <i
                  className="previous"
                  title={`Anterior: ${metricValue(previous, metric, unit)}`}
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
  const worstVariation = numberOrZero(worst?.item?.[fields.variation]);
  const worstInsightLabel = worstVariation < 0 ? "Maior queda" : "Menor crescimento";

  return (
    <section className={`event-store-panel ${eventMeta?.className || ""}`}>
      <PrintReportHeader
        title={reportTitle}
        snapshot={snapshot}
        storeLabel="Todas as lojas"
      />
      <section className="kpi-grid event-kpi-grid">
        <KpiCard
          label="Venda total atual"
          value={metricValue(current, metric, unit)}
          detail={null}
          trend={variation}
          icon={CircleDollarSign}
          tone="green"
        />
        <KpiCard
          label="Venda total anterior"
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
          label="Variação"
          value={percent(variation)}
          detail={null}
          trend={variation}
          icon={BarChart3}
          tone="purple"
        />
      </section>
      <section className="performance-section">
        <section className="event-performance-card">
          <header className="event-performance-heading">
            <Store size={20} />
            <div>
              <h2>Desempenho por loja</h2>
              <p>Confira o comparativo de vendas do evento por loja.</p>
            </div>
          </header>
          <div className="event-store-table-wrap">
            <table className="event-store-table">
              <thead>
                <tr>
                  <th>Loja</th>
                  <th>{currentYear}</th>
                  <th>{previousYear}</th>
                  <th>
                    <span className="report-full-label">Diferença</span>
                    <span className="report-short-label">Dif.</span>
                  </th>
                  <th>
                    <span className="report-full-label">Variação</span>
                    <span className="report-short-label">Var.</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.storeCode}
                    className={`event-store-row store-${row.storeCode}`}
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
              </tbody>
              {total && (
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
              <small>Melhor</small>
              <strong>{best ? best.storeCode : "—"}</strong>
              {best ? <StatusBadge value={best.item?.[fields.variation]} /> : null}
            </article>
            <article className="insight-negative">
              <small>{worstInsightLabel}</small>
              <strong>{worst ? worst.storeCode : "—"}</strong>
              {worst ? <StatusBadge value={worst.item?.[fields.variation]} /> : null}
            </article>
            <article className="insight-info">
              <small>Geral</small>
              <strong>{percent(variation)}</strong>
            </article>
          </div>
        </ChartCard>
      </section>
    </section>
  );
}
