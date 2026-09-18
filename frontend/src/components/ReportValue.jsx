import { metricValue } from '../utils/formatters'

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export default function ReportValue({ value, metric, unit }) {
  const full = metricValue(value, metric, unit)
  const numeric = Number(value)
  const short = metric === 'quantity' || !Number.isFinite(numeric)
    ? full
    : (Math.abs(numeric) >= 100000 ? compact : integer).format(numeric)
  return <><span className="report-full-value">{full}</span><span className="report-short-value" title={full} aria-label={full}>{short}</span></>
}
