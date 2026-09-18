import { Layers3 } from 'lucide-react'
import { buildSectorSummary, targetTone } from '../utils/lossDashboard'
import { isoDate, money } from '../utils/formatters'
import { LOSS_STORE_SEQUENCE } from '../utils/losses'
import PrintReportHeader from './PrintReportHeader'

function yearOf(value) {
  return String(value || '').slice(0, 4) || 'Atual'
}

function pct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function moneyMaybe(value) {
  return value === null || value === undefined ? '—' : money(value)
}

function targetLabel(value) {
  return `${Number(value || 0).toLocaleString('pt-BR')}%`
}

export default function LossSectorSummary({ row }) {
  const { sectors } = buildSectorSummary(row)
  const currentYear = yearOf(row.current_start)
  const previousYear = yearOf(row.previous_start)
  const storeCode = String(row.store_code).padStart(3, '0')
  const storeSequence = LOSS_STORE_SEQUENCE[storeCode] || storeCode

  return (
    <section className="loss-summary-panel compact-loss-panel">
      <PrintReportHeader
        title="Perdas"
        snapshot={row}
        storeLabel={`Loja ${storeSequence} - ${storeCode}`}
        storeDetail={row.store_name}
      />
      <div className="section-heading loss-summary-heading compact-section-heading">
        <div>
          <div className="section-kicker"><Layers3 size={14} /> Vendas e perdas por setor</div>
          <h2>{row.store_name}</h2>
          <p>
            {isoDate(row.current_start)} a {isoDate(row.current_end)} · Comparativo {isoDate(row.previous_start)} a {isoDate(row.previous_end)}
          </p>
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
              <th>Venda</th><th>Perda</th><th>% perda</th><th>Meta</th>
              <th>Venda</th><th>Perda</th><th>% perda</th><th>Meta</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((sector) => (
              <tr key={sector.name}>
                <td className="loss-summary-sector">{sector.name}</td>
                <td>{moneyMaybe(sector.current.sales)}</td>
                <td>{money(sector.current.loss)}</td>
                <td className={`loss-percent-cell ${targetTone(sector.current.percent, sector.target)}`}>{pct(sector.current.percent)}</td>
                <td className="loss-target-cell">{targetLabel(sector.target)}</td>
                <td>{moneyMaybe(sector.previous.sales)}</td>
                <td>{money(sector.previous.loss)}</td>
                <td className={`loss-percent-cell ${targetTone(sector.previous.percent, sector.target)}`}>{pct(sector.previous.percent)}</td>
                <td className="loss-target-cell">{targetLabel(sector.target)}</td>
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
    </section>
  )
}
