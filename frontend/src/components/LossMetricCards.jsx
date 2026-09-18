import { ArrowDownRight, ArrowUpRight, BadgePercent } from 'lucide-react'
import { money, percent } from '../utils/formatters'
import { lossCardTone } from '../utils/losses'

export default function LossMetricCards({ totals }) {
  const difference = Number(totals?.loss_difference || 0)
  const variation = totals?.loss_variation_percent
  const lossSales = totals?.current_loss_sales_percent
  const previousLossSales = totals?.previous_loss_sales_percent
  const Direction = difference <= 0 ? ArrowDownRight : ArrowUpRight

  return (
    <div className="metric-grid loss-metric-grid">
      <article className="metric-card loss-current-card">
        <span>Perda atual</span>
        <strong>{money(totals?.current_total_value)}</strong>
        <small>Valor monetário perdido no período</small>
      </article>
      <article className="metric-card">
        <span>Ano anterior</span>
        <strong>{money(totals?.previous_total_value)}</strong>
        <small>Período equivalente</small>
      </article>
      <article className={`metric-card ${lossCardTone(difference)}`}>
        <span>Diferença da perda</span>
        <strong>{money(difference)}</strong>
        <small><Direction size={13} /> {percent(variation)} contra o ano anterior</small>
      </article>
      <article className="metric-card loss-ratio-card">
        <span>Perda / Venda</span>
        <strong>{percent(lossSales)}</strong>
        <small><BadgePercent size={13} /> Ano anterior: {percent(previousLossSales)}</small>
      </article>
    </div>
  )
}
