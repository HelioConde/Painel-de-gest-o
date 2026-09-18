import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import DataStatusBanner from '../components/DataStatusBanner'
import PrintButton from '../components/PrintButton'
import SnapshotView from '../components/SnapshotView'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import useAsyncData from '../hooks/useAsyncData'
import { getLatestEvents } from '../services/sales'
import { EVENT_META, hasEventStoreData } from '../utils/snapshot'
import { selectDefaultEvent } from '../utils/eventSelection'
import { periodLabel } from '../utils/formatters'
import primorLogoWide from '../assets/primor-logo-wide.png'

const ORDER = ['segunda_pizza', 'terca_carne', 'quarta_quinta_verde', 'sexta_pao', 'fim_semana']

export default function EventsPage() {
  const { data, loading, refreshing, error, refresh } = useAsyncData(getLatestEvents, [])
  const [selectedSlug, setSelectedSlug] = useState(null)

  const eventMap = useMemo(() => {
    const map = new Map()
    ;(Array.isArray(data) ? data : []).forEach((row) => {
      const slug = row.event_slug || row.slug
      if (slug) map.set(slug, row)
    })
    return map
  }, [data])

  const tabs = useMemo(() => ORDER.map((slug) => {
    const rawRow = eventMap.get(slug)
    const validRow = rawRow && hasEventStoreData(rawRow) ? rawRow : null
    return {
      slug,
      row: validRow,
      hadIncompleteSnapshot: Boolean(rawRow && !validRow),
      meta: EVENT_META[slug] || {},
    }
  })
    // Snapshot existente, mas sem detalhamento por loja, é tratado como incompleto
    // e não entra na navegação. Eventos ainda não sincronizados continuam visíveis
    // como referência (ex.: Terça da Carne) com o selo "Sem dados".
    .filter((item) => !item.hadIncompleteSnapshot || item.slug === 'terca_carne'), [eventMap])

  useEffect(() => {
    const selectable = tabs.filter((item) => item.row)
    if (!selectable.length) return
    if (!selectable.some((item) => item.slug === selectedSlug)) {
      setSelectedSlug(selectDefaultEvent(tabs))
    }
  }, [tabs, selectedSlug])

  const selectedTab = tabs.find((item) => item.slug === selectedSlug) || tabs.find((item) => item.row) || tabs[0]
  const selected = selectedTab?.row || null
  const meta = selectedTab?.meta || {}

  return (
    <div className="page page-tight page-events page-view-enter">
      <div className="page-actions-row event-actions-row">
        <div className="event-tabs-shell">
          <div className="event-tabs" role="tablist" aria-label="Eventos comerciais">
            {tabs.map(({ slug, row, hadIncompleteSnapshot, meta: eventMeta }) => {
              const unavailable = !row
              return (
                <button
                  key={slug}
                  role="tab"
                  aria-selected={slug === selectedSlug}
                  aria-disabled={unavailable}
                  disabled={unavailable}
                  className={`event-tab ${eventMeta.className || ''} ${slug === selectedSlug ? 'selected' : ''} ${unavailable ? 'tab-muted' : ''}`}
                  onClick={() => row && setSelectedSlug(slug)}
                  type="button"
                  title={hadIncompleteSnapshot ? 'Snapshot incompleto: sem detalhamento por loja' : unavailable ? 'Evento ainda não sincronizado' : undefined}
                >
                  <span className="event-tab-dot" />
                  <span className="event-tab-label">{row?.event_name || row?.name || eventMeta.label || slug}</span>
                  {unavailable ? <small className="event-tab-status">Sem dados</small> : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="event-action-buttons">
          <PrintButton className="print-inline" orientation="landscape" />
          <button className="refresh-button refresh-inline" onClick={refresh} type="button" disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Atualizando' : 'Atualizar'}
          </button>
        </div>
      </div>

      <header className={`page-header dashboard-hero page-header-compact event-hero event-hero-standard ${meta.className || ''}`.trim()}>
        <div className="dashboard-hero-glow" aria-hidden="true" />
        <div className="print-report-brand"><img src={primorLogoWide} alt="Primor supermercado" /></div>
        <div className="page-header-copy dashboard-hero-copy">
          <span className="dashboard-title-accent" aria-hidden="true"><i /><i /><i /></span>
          <h1>{selected?.event_name || selected?.name || meta.label || 'Eventos'}</h1>
          <div className="header-meta header-meta-stacked dashboard-periods event-hero-meta">
            {selected ? (
              <>
                <span className="period-pill dashboard-current-period">{periodLabel(selected.current_start, selected.current_end)}</span>
                <small className="dashboard-compare-label">Comparativo: {periodLabel(selected.previous_start, selected.previous_end)}</small>
              </>
            ) : (
              <small className="dashboard-compare-label">Selecione um evento com dados disponíveis.</small>
            )}
          </div>
        </div>
      </header>

      {loading && !data && <LoadingState />}
      {!loading && error && !data && <ErrorState error={error} onRetry={refresh} />}
      {data && <DataStatusBanner error={error} />}
      {!loading && !selected && <EmptyState message="Ainda não existem eventos com detalhamento por loja sincronizados." />}
      {selected && <div key={selectedSlug} className="event-content-enter"><SnapshotView snapshot={selected} eventMeta={meta} reportTitle={selected?.event_name || selected?.name || meta.label || 'Eventos'} /></div>}
    </div>
  )
}
