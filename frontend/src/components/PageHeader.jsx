import { RefreshCw } from 'lucide-react'
import { periodLabel } from '../utils/formatters'
import PrintButton from './PrintButton'
import primorLogoWide from '../assets/primor-logo-wide.png'

export default function PageHeader({
  title,
  subtitle,
  snapshot,
  onRefresh,
  refreshing = false,
  accentClass = '',
  showEyebrow = false,
  compact = true,
  printOrientation = 'portrait',
}) {
  return (
    <header className={`page-header dashboard-hero ${compact ? 'page-header-compact' : ''} ${accentClass}`.trim()}>
      <div className="dashboard-hero-glow" aria-hidden="true" />
      <div className="print-report-brand"><img src={primorLogoWide} alt="Primor supermercado" /></div>
      <div className="page-header-copy dashboard-hero-copy">
        {showEyebrow && <div className="eyebrow">Desempenho comercial</div>}
        <span className="dashboard-title-accent" aria-hidden="true"><i /><i /><i /></span>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {snapshot && (
          <div className="header-meta header-meta-stacked dashboard-periods">
            <span className="period-pill dashboard-current-period">{periodLabel(snapshot.current_start, snapshot.current_end)}</span>
            <span className="dashboard-compare-label">Comparativo: {periodLabel(snapshot.previous_start, snapshot.previous_end)}</span>
          </div>
        )}
      </div>

      <div className="page-header-actions">
        <PrintButton orientation={printOrientation} />
        <button
          className="refresh-button dashboard-refresh"
          onClick={onRefresh}
          type="button"
          aria-label={refreshing ? 'Atualizando dados' : 'Atualizar dados'}
          disabled={refreshing}
        >
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          <span>{refreshing ? 'Atualizando' : 'Atualizar'}</span>
        </button>
      </div>
    </header>
  )
}
