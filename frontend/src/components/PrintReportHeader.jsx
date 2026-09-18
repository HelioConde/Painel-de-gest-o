import primorLogoWide from '../assets/primor-logo-wide.png'
import { periodLabel } from '../utils/formatters'

function periodText(snapshot) {
  if (!snapshot) return null
  return periodLabel(snapshot.current_start, snapshot.current_end)
}

function comparisonText(snapshot) {
  if (!snapshot?.previous_start && !snapshot?.previous_end) return null
  return `Comparativo: ${periodLabel(snapshot.previous_start, snapshot.previous_end)}`
}

export default function PrintReportHeader({ title, snapshot, storeLabel, storeDetail, period, comparison }) {
  const periodLine = period || periodText(snapshot)
  const comparisonLine = comparison || comparisonText(snapshot)

  return (
    <header className="print-report-header" aria-hidden="true">
      <div className="print-report-logo">
        <img src={primorLogoWide} alt="Primor supermercado" />
      </div>
      <div className="print-report-copy">
        <div className="print-report-title">{title}</div>
        {storeLabel ? <div className="print-report-store">{storeLabel}</div> : null}
        {storeDetail ? <div className="print-report-store-detail">{storeDetail}</div> : null}
        {periodLine ? <div className="print-report-period">{periodLine}</div> : null}
        {comparisonLine ? <div className="print-report-comparison">{comparisonLine}</div> : null}
      </div>
    </header>
  )
}
