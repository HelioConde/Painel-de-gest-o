import { Minus, Plus, Printer, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function PosterPrintDialog({ open, format, productCount, pageCount, printConfig, onClose, onPrint }) {
  const [copies, setCopies] = useState(printConfig.copies)

  useEffect(() => {
    if (open) setCopies(printConfig.copies)
  }, [open, printConfig.copies])

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  if (!open) return null

  const totalSheets = pageCount * copies

  return (
    <div className="poster-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="poster-modal" role="dialog" aria-modal="true" aria-labelledby="poster-print-title">
        <header>
          <div>
            <span className="poster-modal-kicker">Revisão final</span>
            <h2 id="poster-print-title">Confirmar impressão</h2>
          </div>
          <button type="button" className="poster-icon-button" onClick={onClose} aria-label="Fechar confirmação">
            <X size={18} />
          </button>
        </header>

        <dl className="poster-print-summary">
          <div><dt>Modelo</dt><dd>{format.label}</dd></div>
          <div><dt>Papel</dt><dd>{format.paper} · {format.orientation === 'portrait' ? 'Retrato' : 'Paisagem'}</dd></div>
          <div><dt>Cartazes</dt><dd>{productCount}</dd></div>
          <div><dt>Folhas</dt><dd>{pageCount} por cópia · {totalSheets} no total</dd></div>
          <div><dt>Frente e verso</dt><dd>Não</dd></div>
          <div><dt>2ª placa invertida</dt><dd>{format.supportsInvertSecond && printConfig.invertSecondPoster ? 'Sim' : 'Não'}</dd></div>
        </dl>

        <div className="poster-copy-control">
          <span>Cópias</span>
          <div className="poster-stepper" aria-label="Quantidade de cópias">
            <button type="button" onClick={() => setCopies((value) => Math.max(1, value - 1))} disabled={copies <= 1} aria-label="Diminuir cópias"><Minus size={16} /></button>
            <strong>{copies}</strong>
            <button type="button" onClick={() => setCopies((value) => Math.min(20, value + 1))} disabled={copies >= 20} aria-label="Aumentar cópias"><Plus size={16} /></button>
          </div>
        </div>

        <footer>
          <button type="button" className="poster-button poster-button-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="poster-button poster-button-primary" onClick={() => onPrint({ ...printConfig, copies })} disabled={!productCount}>
            <Printer size={17} /> Imprimir
          </button>
        </footer>
      </section>
    </div>
  )
}
