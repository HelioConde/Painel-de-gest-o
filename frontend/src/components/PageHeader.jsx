import { periodLabel } from '../utils/formatters'

export default function PageHeader({ title, snapshot, subtitle = null, actions = null }) {
  return (
    <header className="page-header dashboard-hero page-header-compact">
      <div className="page-header-copy dashboard-hero-copy">
        <span className="dashboard-title-accent" aria-hidden="true"><i /><i /><i /></span>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {snapshot ? (
          <div className="header-meta dashboard-periods">
            <span className="period-pill dashboard-current-period">
              {periodLabel(snapshot.current_start, snapshot.current_end)}
            </span>
            <small className="dashboard-compare-label">
              Comparativo: {periodLabel(snapshot.previous_start, snapshot.previous_end)}
            </small>
          </div>
        ) : null}
      </div>
      {actions ? <div className="page-header-actions no-print">{actions}</div> : null}
    </header>
  )
}
