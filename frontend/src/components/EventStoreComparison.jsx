import { metricValue, percent } from '../utils/formatters'
import { getEventMetricFields, getEventStoreRows, getEventNetworkSummary } from '../utils/snapshot'
import PrintReportHeader from './PrintReportHeader'

function numberOrZero(value) {
  return value === null || value === undefined ? 0 : Number(value)
}

function valueClass(value) {
  const number = Number(value)
  if (number > 0) return 'positive-text'
  if (number < 0) return 'negative-text'
  return ''
}

function compactLabel(row) {
  return `${row.sequence} • ${row.storeCode}`
}

function StoreValues({ item, fields, metric, unit }) {
  const current = item?.[fields.current]
  const previous = item?.[fields.previous]
  const difference = item?.[fields.difference]
  const variation = item?.[fields.variation]

  return (
    <>
      <td data-label="Atual" className="event-store-current">{metricValue(numberOrZero(current), metric, unit)}</td>
      <td data-label="Ano anterior">{metricValue(numberOrZero(previous), metric, unit)}</td>
      <td data-label="Diferença" className={valueClass(difference)}>{metricValue(numberOrZero(difference), metric, unit)}</td>
      <td data-label="Variação" className={valueClass(variation)}>{percent(variation)}</td>
    </>
  )
}

export default function EventStoreComparison({ snapshot, eventMeta, reportTitle = 'Eventos' }) {
  const rows = getEventStoreRows(snapshot)
  const total = getEventNetworkSummary(snapshot)
  const fields = getEventMetricFields(snapshot)
  const metric = fields.metric || snapshot?.metric || 'monetary'
  const unit = fields.unit ?? snapshot?.unit
  const currentYear = String(snapshot?.current_start || '').slice(0, 4) || 'Atual'
  const previousYear = String(snapshot?.previous_start || '').slice(0, 4) || 'Anterior'

  return (
    <section className={`event-store-panel ${eventMeta?.className || ''}`}>
      <PrintReportHeader title={reportTitle} snapshot={snapshot} storeLabel="Todas as lojas" />
      <div className="event-store-table-wrap">
        <table className="event-store-table">
          <thead>
            <tr>
              <th>Loja</th>
              <th>{currentYear}</th>
              <th>{previousYear}</th>
              <th><span className="report-full-label">Diferença</span><span className="report-short-label">Dif.</span></th>
              <th><span className="report-full-label">Variação</span><span className="report-short-label">Var.</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.storeCode} className={`event-store-row store-${row.storeCode}`}>
                <td className="event-store-name" data-label="Loja">
                  <span className="event-store-sequence">{row.sequence}</span>
                  <span className="event-store-copy">
                    <strong className="event-store-name-desktop">{row.storeName}</strong>
                    <strong className="event-store-name-mobile">{compactLabel(row)}</strong>
                    <small>Código {row.storeCode}</small>
                  </span>
                </td>
                <StoreValues item={row.item} fields={fields} metric={metric} unit={unit} />
              </tr>
            ))}
          </tbody>
          {total && (
            <tfoot>
              <tr>
                <td className="event-store-total-label">Todas as lojas</td>
                <StoreValues item={total} fields={fields} metric={metric} unit={unit} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
