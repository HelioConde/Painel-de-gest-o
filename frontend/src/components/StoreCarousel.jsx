import { ChevronLeft, ChevronRight, Store } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { getStoreOptions } from '../utils/snapshot'

const STORE_ORDER = ['307', '212', '600', '120', '033', '018']
const STORE_SEQUENCE = Object.fromEntries(STORE_ORDER.map((code, index) => [code, String(index + 1).padStart(2, '0')]))

function reorderOptions(options) {
  const network = options.find((item) => item.value === 'network')
  const stores = options
    .filter((item) => item.value !== 'network')
    .sort((a, b) => {
      const ai = STORE_ORDER.indexOf(String(a.value).padStart(3, '0'))
      const bi = STORE_ORDER.indexOf(String(b.value).padStart(3, '0'))
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  return network ? [...stores, network] : stores
}

function codeOf(option) {
  return option.value === 'network' ? 'Todas' : String(option.value).padStart(3, '0')
}

function sequenceOf(option) {
  if (option.value === 'network') return '07'
  return STORE_SEQUENCE[String(option.value).padStart(3, '0')] || '—'
}

function description(option) {
  if (option.value === 'network') return 'Todas as lojas'
  const full = option.label?.split('·')?.[1]?.trim()
  return full || `SUPERMERCADO PRIMOR ${sequenceOf(option)} ${codeOf(option)}`
}

export default function StoreCarousel({ snapshot, value, onChange }) {
  const options = useMemo(() => reorderOptions(getStoreOptions(snapshot)), [snapshot])
  const trackRef = useRef(null)
  const itemRefs = useRef(new Map())
  const currentIndex = Math.max(0, options.findIndex((item) => item.value === value))

  useEffect(() => {
    const track = trackRef.current
    const active = itemRefs.current.get(value)
    if (!track || !active) return

    const target = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2
    track.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [value, options.length])

  const goTo = (step) => {
    if (!options.length) return
    const nextIndex = Math.min(options.length - 1, Math.max(0, currentIndex + step))
    onChange(options[nextIndex].value)
  }

  return (
    <div className="store-carousel-card store-carousel-v15">
      <div className="store-carousel-label"><Store size={13} /> Loja</div>
      <div className="store-carousel-shell store-carousel-shell-v15">
        <button
          type="button"
          className="carousel-arrow carousel-arrow-v15"
          onClick={() => goTo(-1)}
          disabled={currentIndex <= 0}
          aria-label="Loja anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="store-carousel-viewport">
          <div className="store-carousel-track store-carousel-track-v15" ref={trackRef} role="tablist" aria-label="Selecionar loja">
            {options.map((option) => {
              const active = option.value === value
              return (
                <button
                  key={option.value}
                  ref={(node) => {
                    if (node) itemRefs.current.set(option.value, node)
                    else itemRefs.current.delete(option.value)
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`store-carousel-pill store-carousel-pill-v15 ${active ? 'active' : ''}`}
                  onClick={() => onChange(option.value)}
                >
                  <div className="store-pill-topline">
                    <span className="store-pill-sequence">{sequenceOf(option)}</span>
                    <span className="store-pill-code">{codeOf(option)}</span>
                  </div>
                  <strong>{description(option)}</strong>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          className="carousel-arrow carousel-arrow-v15"
          onClick={() => goTo(1)}
          disabled={currentIndex >= options.length - 1}
          aria-label="Próxima loja"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
