import { Layers3 } from "lucide-react";
import { useMemo, useState } from "react";
import { buildSectorSummary, targetTone } from "../utils/lossDashboard";
import { money } from "../utils/formatters";
import { LOSS_STORE_SEQUENCE } from "../utils/losses";
import PrintReportHeader from "./PrintReportHeader";
import {
  ChartCard,
  SectorIcon,
  SimpleBarChart,
} from "./dashboard/DashboardPrimitives";

function yearOf(value) {
  return String(value || "").slice(0, 4) || "Atual";
}

function pct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return "—";
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function moneyMaybe(value) {
  return value === null || value === undefined ? "—" : money(value);
}

function targetLabel(value) {
  return `${Number(value || 0).toLocaleString("pt-BR")}%`;
}

export default function LossSectorSummary({ row, showPrintHeader = true }) {
  const { sectors } = buildSectorSummary(row);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("loss");
  const currentYear = yearOf(row.current_start);
  const previousYear = yearOf(row.previous_start);
  const storeCode = String(row.store_code).padStart(3, "0");
  const storeSequence = LOSS_STORE_SEQUENCE[storeCode] || storeCode;
  const visibleSectors = useMemo(() => {
    const filtered = sectors.filter((sector) => {
      const loss = Number(sector.current.loss || 0);
      const currentPercent = sector.current.percent === null ? null : Number(sector.current.percent);
      const target = sector.target === null ? null : Number(sector.target);

      if (filter === "above") return currentPercent !== null && target !== null && currentPercent > target;
      if (filter === "within") return currentPercent !== null && target !== null && currentPercent <= target && loss > 0;
      if (filter === "zero") return loss === 0;
      return true;
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === "percent") {
        return Number(right.current.percent || 0) - Number(left.current.percent || 0);
      }
      if (sortBy === "deviation") {
        const leftDeviation = Number(left.current.percent || 0) - Number(left.target || 0);
        const rightDeviation = Number(right.current.percent || 0) - Number(right.target || 0);
        return rightDeviation - leftDeviation;
      }
      return Number(right.current.loss || 0) - Number(left.current.loss || 0);
    });
  }, [sectors, filter, sortBy]);

  const lossBars = [...sectors]
    .map((sector) => ({
      name: sector.name,
      iconName: sector.name,
      value: Number(sector.current.loss || 0),
      percent: Number(sector.current.percent || 0),
      target: Number(sector.target || 0),
    }))
    .sort((left, right) => right.value - left.value);
  const targetBars = [...lossBars].sort(
    (left, right) => right.percent - left.percent,
  );
  const targetVisible = targetBars.slice(0, 8);
  const targetMaximum = Math.max(
    1,
    ...targetVisible.flatMap((item) => [item.percent, item.target]),
  );

  return (
    <section className="loss-summary-panel compact-loss-panel">
      {showPrintHeader ? (
        <PrintReportHeader
          title="Perdas"
          snapshot={row}
          storeLabel={`Loja ${storeSequence} - ${storeCode}`}
          storeDetail={row.store_name}
        />
      ) : null}
      <div className="section-heading loss-summary-heading compact-section-heading">
        <div>
          <div className="section-kicker">
            <Layers3 size={14} /> Comparativo por setor
          </div>
          <h2>Perdas por setor</h2>
        </div>
      </div>

      <div className="loss-summary-controls no-print">
        <div className="loss-summary-filters" aria-label="Filtrar setores por situação">
          <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos <span>{sectors.length}</span></button>
          <button type="button" className={filter === "above" ? "active danger" : "danger"} onClick={() => setFilter("above")}>Acima da meta</button>
          <button type="button" className={filter === "within" ? "active success" : "success"} onClick={() => setFilter("within")}>Dentro da meta</button>
          <button type="button" className={filter === "zero" ? "active" : ""} onClick={() => setFilter("zero")}>Sem perda</button>
        </div>
        <div className="loss-summary-sort" aria-label="Ordenar setores">
          <span>Ordenar por</span>
          <button type="button" className={sortBy === "loss" ? "active" : ""} onClick={() => setSortBy("loss")}>Perda R$</button>
          <button type="button" className={sortBy === "percent" ? "active" : ""} onClick={() => setSortBy("percent")}>% Perda</button>
          <button type="button" className={sortBy === "deviation" ? "active" : ""} onClick={() => setSortBy("deviation")}>Desvio meta</button>
        </div>
      </div>

      <div className="loss-summary-table-wrap compact-loss-table-wrap">
        <table className="loss-summary-table compact-loss-table">
          <thead>
            <tr className="loss-summary-years">
              <th rowSpan="2">Setor</th>
              <th colSpan="4">{currentYear}</th>
              <th colSpan="4">{previousYear}</th>
            </tr>
            <tr>
              <th>Venda</th>
              <th>Perda</th>
              <th>% perda</th>
              <th>Meta</th>
              <th>Venda</th>
              <th>Perda</th>
              <th>% perda</th>
              <th>Meta</th>
            </tr>
          </thead>
          <tbody>
            {visibleSectors.map((sector) => (
              <tr key={sector.name}>
                <td className="loss-summary-sector">
                  <SectorIcon name={sector.name} />
                  {sector.name}
                </td>
                <td>{moneyMaybe(sector.current.sales)}</td>
                <td>{money(sector.current.loss)}</td>
                <td
                  className={`loss-percent-cell ${targetTone(sector.current.percent, sector.target)}`}
                >
                  {pct(sector.current.percent)}
                </td>
                <td className="loss-target-cell">
                  {targetLabel(sector.target)}
                </td>
                <td>{moneyMaybe(sector.previous.sales)}</td>
                <td>{money(sector.previous.loss)}</td>
                <td
                  className={`loss-percent-cell ${targetTone(sector.previous.percent, sector.target)}`}
                >
                  {pct(sector.previous.percent)}
                </td>
                <td className="loss-target-cell">
                  {targetLabel(sector.target)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>TOTAL</td>
              <td>{money(row.current_sales_value)}</td>
              <td>{money(row.current_total_value)}</td>
              <td>{pct(row.current_loss_sales_percent)}</td>
              <td>—</td>
              <td>{money(row.previous_sales_value)}</td>
              <td>{money(row.previous_total_value)}</td>
              <td>{pct(row.previous_loss_sales_percent)}</td>
              <td>—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="loss-mobile-sector-list" aria-label="Perdas por setor">
        {visibleSectors.map((sector) => {
          const currentPercent = sector.current.percent === null ? null : Number(sector.current.percent);
          const target = sector.target === null ? null : Number(sector.target);
          const difference = Number(sector.current.loss || 0) - Number(sector.previous.loss || 0);
          return (
            <article className={`loss-mobile-sector-card ${targetTone(currentPercent, target)}`} key={sector.name}>
              <header>
                <div><SectorIcon name={sector.name} /><strong>{sector.name}</strong></div>
                <span>{money(sector.current.loss)}</span>
              </header>
              <div className="loss-mobile-sector-grid">
                <div><small>Atual</small><strong>{pct(currentPercent)}</strong><span>{moneyMaybe(sector.current.sales)} em vendas</span></div>
                <div><small>Meta</small><strong>{targetLabel(target)}</strong><span>{currentPercent !== null && target !== null ? `${(currentPercent - target).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.` : "—"}</span></div>
                <div><small>Anterior</small><strong>{pct(sector.previous.percent)}</strong><span>{money(sector.previous.loss)}</span></div>
                <div><small>Dif. perda</small><strong className={difference > 0 ? "negative-text" : difference < 0 ? "positive-text" : ""}>{money(difference)}</strong><span>vs. período anterior</span></div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="dashboard-chart-grid loss-chart-grid">
        <ChartCard eyebrow="IMPACTO FINANCEIRO" title="Perda por setor">
          <SimpleBarChart items={lossBars} valueKey="value" />
        </ChartCard>
        <ChartCard eyebrow="CONTROLE DE META" title="% perda atual vs meta">
          <div className="simple-bar-chart loss-target-chart-standard">
            {targetVisible.map((item) => (
              <div className="simple-bar-row loss-target-row" key={item.name}>
                <div className="simple-bar-label">
                  <SectorIcon name={item.name} />
                  <span>{item.name}</span>
                </div>
                <div className="simple-bar-tracks">
                  <i
                    className={`bar-current loss-target-current ${targetTone(item.percent, item.target)}`}
                    style={{
                      width: `${Math.max(3, (Math.abs(item.percent) / targetMaximum) * 100)}%`,
                    }}
                  />
                  <i
                    className="bar-previous loss-target-meta"
                    style={{
                      width: `${Math.max(3, (Math.abs(item.target) / targetMaximum) * 100)}%`,
                    }}
                  />
                </div>
                <strong className="loss-target-value">
                  {pct(item.percent)} <small>meta {targetLabel(item.target)}</small>
                </strong>
              </div>
            ))}
          </div>
        </ChartCard>
      </section>
    </section>
  );
}
