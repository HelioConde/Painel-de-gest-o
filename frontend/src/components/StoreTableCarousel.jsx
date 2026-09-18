import { Building2, ChevronLeft, ChevronRight, Layers3, Store } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import HierarchyExplorer from './HierarchyExplorer'
import PrintReportHeader from './PrintReportHeader'
import { getScope, getStoreOptions } from '../utils/snapshot'

const STORE_ORDER = ['307', '212', '600', '120', '033', '018']
const STORE_SEQUENCE = Object.fromEntries(
  STORE_ORDER.map((code, index) => [code, String(index + 1).padStart(2, '0')]),
)

function orderOptions(options) {
  const network = options.find((option) => option.value === 'network')
  const stores = options
    .filter((option) => option.value !== 'network')
    .sort((a, b) => {
      const ai = STORE_ORDER.indexOf(String(a.value).padStart(3, '0'))
      const bi = STORE_ORDER.indexOf(String(b.value).padStart(3, '0'))
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
    })

  return network ? [...stores, network] : stores
}

function storeCode(option) {
  return option.value === 'network' ? 'TODAS' : String(option.value).padStart(3, '0')
}

function sequence(option) {
  if (option.value === 'network') return '07'
  return STORE_SEQUENCE[String(option.value).padStart(3, '0')] || '—'
}

function displayName(option) {
  if (option.value === 'network') return 'Todas as lojas'
  const fromLabel = option.label?.split('·')?.[1]?.trim()
  return fromLabel || `SUPERMERCADO PRIMOR ${sequence(option)} ${storeCode(option)}`
}

function compactName(option) {
  if (option.value === 'network') return 'Todas as lojas'
  return `Loja ${sequence(option)} • ${storeCode(option)}`
}

function storeTone(option) {
  return option.value === 'network' ? 'network' : String(option.value).padStart(3, '0')
}

export default function StoreTableCarousel({ snapshot, reportTitle = 'Relatório' }) {
  const options = useMemo(() => orderOptions(getStoreOptions(snapshot)), [snapshot])
  const [index, setIndex] = useState(0)
  const touchStart = useRef(null)

  useEffect(() => {
    setIndex(0)
  }, [snapshot?.snapshot_key])

  const active = options[index] || options[0]

  const move = (direction) => {
    if (!options.length) return
    setIndex((current) => Math.max(0, Math.min(options.length - 1, current + direction)))
  }

  const handleTouchStart = (event) => {
    touchStart.current = event.touches?.[0]?.clientX ?? null
  }

  const handleTouchEnd = (event) => {
    if (touchStart.current === null) return
    const end = event.changedTouches?.[0]?.clientX
    if (end === undefined) return
    const delta = end - touchStart.current
    touchStart.current = null
    if (Math.abs(delta) < 42) return
    move(delta < 0 ? 1 : -1)
  }

  if (!active) return null

  return (
    <section className="table-carousel" aria-label="Comparativo de vendas por loja">
      <PrintReportHeader
        title={reportTitle}
        snapshot={snapshot}
        storeLabel={active.value === 'network' ? 'Todas as lojas' : `Loja ${sequence(active)} - ${storeCode(active)}`}
        storeDetail={active.value === 'network' ? null : displayName(active)}
      />
      <div className="table-carousel-controlbar">
        <button
          type="button"
          className="table-carousel-arrow"
          onClick={() => move(-1)}
          disabled={index === 0}
          aria-label="Loja anterior"
        >
          <ChevronLeft size={19} />
        </button>

        <div className={`table-carousel-store store-tone-${storeTone(active)}`}>
          <div className="table-carousel-store-icon">
            {active.value === 'network' ? <Building2 size={18} /> : <Store size={18} />}
          </div>
          <div className="table-carousel-store-copy">
            <div className="table-carousel-store-kicker">
              <span>{active.value === 'network' ? 'REDE' : `LOJA ${sequence(active)}`}</span>
              <span className="table-carousel-position">{index + 1} / {options.length}</span>
            </div>
            <strong>
              <span className="desktop-store-name">{displayName(active)}</span>
              <span className="mobile-store-name">{compactName(active)}</span>
            </strong>
            <small>{active.value === 'network' ? 'Consolidado das 6 lojas' : `Código ${storeCode(active)}`}</small>
          </div>
          <div className="table-carousel-code">{storeCode(active)}</div>
        </div>

        <button
          type="button"
          className="table-carousel-arrow"
          onClick={() => move(1)}
          disabled={index === options.length - 1}
          aria-label="Próxima loja"
        >
          <ChevronRight size={19} />
        </button>
      </div>

      <div
        className="table-carousel-viewport"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="table-carousel-track"
          style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
        >
          {options.map((option, optionIndex) => {
            const scope = getScope(snapshot, option.value)
            return (
              <div
                className={`table-carousel-slide ${optionIndex === index ? 'active' : ''}`}
                key={option.value}
                aria-hidden={optionIndex !== index}
                inert={optionIndex !== index}
              >
                <HierarchyExplorer snapshot={snapshot} scope={scope} carouselMode />
              </div>
            )
          })}
        </div>
      </div>

      <div className="table-carousel-footer">
        <div className="table-carousel-dots" aria-label="Lojas">
          {options.map((option, optionIndex) => {
            const code = storeTone(option)
            return (
              <button
                type="button"
                key={option.value}
                className={`table-carousel-dot store-${code} ${optionIndex === index ? 'active' : ''}`}
                onClick={() => setIndex(optionIndex)}
                aria-label={`Abrir ${displayName(option)}`}
                aria-current={optionIndex === index ? 'true' : undefined}
              >
                <span>{option.value === 'network' ? 'Todas' : storeCode(option)}</span>
              </button>
            )
          })}
        </div>
        <div className="table-carousel-hint"><Layers3 size={13} /> Deslize ou use as setas para trocar de loja</div>
      </div>
    </section>
  )
}
