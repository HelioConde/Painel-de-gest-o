import { Building2, ChevronLeft, ChevronRight, Store } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { LOSS_STORE_ORDER, LOSS_STORE_SEQUENCE } from '../utils/losses'

function sortRows(rows = []) {
  return [...rows].sort((a, b) => {
    const ai = LOSS_STORE_ORDER.indexOf(String(a?.store_code).padStart(3, '0'))
    const bi = LOSS_STORE_ORDER.indexOf(String(b?.store_code).padStart(3, '0'))
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
  })
}

function codeOf(row) {
  return String(row?.store_code).padStart(3, '0')
}

function sequenceOf(row) {
  return LOSS_STORE_SEQUENCE[codeOf(row)] || '—'
}

function compactName(row) {
  return `Loja ${sequenceOf(row)} • ${codeOf(row)}`
}

export function LossStoreFooter({ rows, selectedStore, onSelect }) {
  const orderedRows = useMemo(() => sortRows(rows), [rows])
  const activeIndex = Math.max(0, orderedRows.findIndex((row) => codeOf(row) === selectedStore))

  if (!orderedRows.length) return null

  return (
    <div className="table-carousel-footer loss-carousel-footer loss-carousel-footer-bottom">
      <div className="table-carousel-dots" aria-label="Lojas de perdas">
        {orderedRows.map((row, rowIndex) => {
          const code = codeOf(row)
          return (
            <button
              type="button"
              key={code}
              className={`table-carousel-dot store-${code} ${rowIndex === activeIndex ? 'active' : ''}`}
              onClick={() => onSelect(code)}
              aria-label={`Abrir loja ${code}`}
              aria-current={rowIndex === activeIndex ? 'true' : undefined}
            >
              <span>{code}</span>
            </button>
          )}
        )}
      </div>
      <div className="table-carousel-hint"><Building2 size={13} /> Use as setas para trocar de loja</div>
    </div>
  )
}

export default function LossStoreCarousel({ rows, selectedStore, onSelect, showFooter = false }) {
  const orderedRows = useMemo(() => sortRows(rows), [rows])
  const activeIndex = Math.max(0, orderedRows.findIndex((row) => codeOf(row) === selectedStore))
  const touchStart = useRef(null)

  useEffect(() => {
    if (!orderedRows.length) return
    if (!orderedRows.some((row) => codeOf(row) === selectedStore)) {
      onSelect(codeOf(orderedRows[0]))
    }
  }, [orderedRows, onSelect, selectedStore])

  const move = (step) => {
    if (!orderedRows.length) return
    const nextIndex = Math.min(orderedRows.length - 1, Math.max(0, activeIndex + step))
    onSelect(codeOf(orderedRows[nextIndex]))
  }

  const handleTouchStart = (event) => {
    touchStart.current = event.touches?.[0]?.clientX ?? null
  }

  const handleTouchEnd = (event) => {
    if (touchStart.current === null) return
    const end = event.changedTouches?.[0]?.clientX
    const delta = end - touchStart.current
    touchStart.current = null
    if (Math.abs(delta) < 42) return
    move(delta < 0 ? 1 : -1)
  }

  const active = orderedRows[activeIndex]
  if (!active) return null

  return (
    <section className="table-carousel loss-table-carousel" aria-label="Navegação por loja de perdas">
      <div className="table-carousel-controlbar loss-controlbar" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <button
          type="button"
          className="table-carousel-arrow"
          onClick={() => move(-1)}
          disabled={activeIndex === 0}
          aria-label="Loja anterior"
        >
          <ChevronLeft size={19} />
        </button>

        <div className={`table-carousel-store loss-carousel-store store-tone-${codeOf(active)}`}>
          <div className="table-carousel-store-icon">
            <Store size={18} />
          </div>
          <div className="table-carousel-store-copy">
            <div className="table-carousel-store-kicker">
              <span>LOJA {sequenceOf(active)}</span>
              <span className="table-carousel-position">{activeIndex + 1} / {orderedRows.length}</span>
            </div>
            <strong>
              <span className="desktop-store-name">{active.store_name}</span>
              <span className="mobile-store-name">{compactName(active)}</span>
            </strong>
            <small>Código {codeOf(active)}</small>
          </div>
          <div className="table-carousel-code">{codeOf(active)}</div>
        </div>

        <button
          type="button"
          className="table-carousel-arrow"
          onClick={() => move(1)}
          disabled={activeIndex === orderedRows.length - 1}
          aria-label="Próxima loja"
        >
          <ChevronRight size={19} />
        </button>
      </div>

      {showFooter ? <LossStoreFooter rows={orderedRows} selectedStore={selectedStore} onSelect={onSelect} /> : null}
    </section>
  )
}
