import { periodLabel } from '../utils/formatters'

export default function CompactReportHeader({
  title,
  snapshot,
  children,
  className = '',
}) {
  return (
    <header className={`compact-report-header ${className}`.trim()}>
      <div className="compact-report-main">
        <div className="compact-report-copy">
          <span className="compact-report-accent" aria-hidden="true"><i /><i /><i /></span>
          <div className="compact-report-title-row">
            <h1>{title}</h1>
            {snapshot ? (
              <div className="compact-report-periods">
                <strong>{periodLabel(snapshot.current_start, snapshot.current_end)}</strong>
                <span>Comp. {periodLabel(snapshot.previous_start, snapshot.previous_end)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {children ? <div className="compact-report-toolbar">{children}</div> : null}
    </header>
  )
}
