import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { metricValue, percent } from '../utils/formatters'
import { getEventMetricFields, getEventMetricItem } from '../utils/snapshot'

function trendClass(value) {
  const number = Number(value || 0)
  if (number > 0) return 'positive'
  if (number < 0) return 'negative'
  return 'neutral'
}

function TrendIcon({ value, size = 16 }) {
  const number = Number(value || 0)
  if (number > 0) return <ArrowUpRight size={size} />
  if (number < 0) return <ArrowDownRight size={size} />
  return <Minus size={size} />
}

export default function MetricCards({ snapshot, scope }) {
  const metric = snapshot?.metric || 'monetary'
  const unit = snapshot?.unit
  const isEvent = snapshot?.snapshot_type === 'EVENT'
  const eventFields = getEventMetricFields(snapshot)

  // Alguns eventos têm semântica pós-filtro no backend (ex.: Sexta do Pão = PADARIA
  // e Segunda da Pizza = quantidade da PIZZARIA). Para os cards, usamos o mesmo
  // escopo do snapshot, e não o total bruto da rede/loja.
  const summaryItem = isEvent ? getEventMetricItem(snapshot, scope) : scope

  const fields = isEvent
    ? eventFields
    : { current: 'current_value', previous: 'previous_value', difference: 'difference_value', variation: 'variation_percent' }

  const current = summaryItem?.[fields.current]
  const previous = summaryItem?.[fields.previous]
  const difference = summaryItem?.[fields.difference]
  const variation = summaryItem?.[fields.variation]

  return (
    <section className="metric-grid">
      <article className="metric-card metric-primary">
        <span>Venda atual</span>
        <strong>{metricValue(current, metric, unit)}</strong>
        <small>Período selecionado</small>
      </article>
      <article className="metric-card">
        <span>Ano anterior</span>
        <strong>{metricValue(previous, metric, unit)}</strong>
        <small>Período equivalente</small>
      </article>
      <article className={`metric-card ${trendClass(difference)}`}>
        <span>Diferença</span>
        <strong>{metricValue(difference, metric, unit)}</strong>
        <small><TrendIcon value={difference} /> Resultado absoluto</small>
      </article>
      <article className={`metric-card ${trendClass(variation)}`}>
        <span>Variação</span>
        <strong>{percent(variation)}</strong>
        <small><TrendIcon value={variation} /> Contra ano anterior</small>
      </article>
    </section>
  )
}
