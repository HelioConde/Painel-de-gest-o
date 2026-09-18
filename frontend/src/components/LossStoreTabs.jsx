import { Building2 } from 'lucide-react'
import { LOSS_STORE_SEQUENCE } from '../utils/losses'

export default function LossStoreTabs({ rows, selectedStore, onSelect }) {
  return (
    <div className="loss-store-tabs-card">
      <div className="loss-store-tabs-label"><Building2 size={14} /> Loja</div>
      <div className="loss-store-tabs" role="tablist" aria-label="Selecionar loja">
        {rows.map((row) => {
          const code = String(row.store_code).padStart(3, '0')
          const sequence = LOSS_STORE_SEQUENCE[code] || code
          const active = code === selectedStore
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className={`loss-store-tab ${active ? 'active' : ''}`}
              key={code}
              onClick={() => onSelect(code)}
            >
              <span>{sequence}</span>
              <strong>{code}</strong>
            </button>
          )
        })}
      </div>
    </div>
  )
}
