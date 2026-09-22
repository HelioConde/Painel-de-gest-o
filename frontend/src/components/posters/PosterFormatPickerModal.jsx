import { Check, X } from 'lucide-react'
import { useEffect } from 'react'
import { getDefaultTemplateForFormat } from '../../config/posterTemplates'

export default function PosterFormatPickerModal({ open, currentFormatId, formats, onClose, onSelect }) {
  useEffect(() => {
    if (!open || !currentFormatId) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [currentFormatId, onClose, open])

  if (!open) return null

  return (
    <div className="poster-modal-backdrop poster-format-picker-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="poster-modal poster-format-picker" role="dialog" aria-modal="true" aria-labelledby="poster-format-picker-title">
        <header>
          <div>
            <span className="poster-modal-kicker">Novo cartaz</span>
            <h2 id="poster-format-picker-title">Qual formato deseja criar?</h2>
            <p>Troque o formato sem perder seus produtos ou personalizações.</p>
          </div>
          <button type="button" className="poster-icon-button" onClick={onClose} aria-label="Fechar seleção de formato"><X size={18} /></button>
        </header>
        <div className="poster-format-picker-grid">
          {formats.map((format) => {
            const template = getDefaultTemplateForFormat(format.id)
            const selected = format.id === currentFormatId
            return (
              <button type="button" key={format.id} className={`poster-format-picker-card ${selected ? 'selected' : ''}`} onClick={() => onSelect(format.id)} aria-label={`Selecionar ${format.label}: ${format.description}`}>
                <span className={`poster-format-picker-thumbnail scope-${template.backgroundScope}`}>
                  <img src={template.backgroundImage} alt={`Fundo ${format.label}`} />
                </span>
                <span className="poster-format-picker-copy"><strong>{format.label}</strong><small>{format.description}</small><em>{format.pickerBadge}</em></span>
                {selected ? <span className="poster-format-picker-selected"><Check size={14} /> Atual</span> : null}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
