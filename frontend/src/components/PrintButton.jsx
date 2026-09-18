import { Printer } from 'lucide-react'

const PRINT_STYLE_ID = 'dynamic-print-page'

function applyPrintPage(orientation) {
  const normalized = orientation === 'landscape' ? 'landscape' : 'portrait'
  let style = document.getElementById(PRINT_STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = PRINT_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `@page { size: A4 ${normalized}; margin: 8mm; }`
  document.documentElement.dataset.printOrientation = normalized
}

function clearPrintPage() {
  document.getElementById(PRINT_STYLE_ID)?.remove()
  delete document.documentElement.dataset.printOrientation
}

export default function PrintButton({ className = '', orientation = 'portrait' }) {
  const handlePrint = () => {
    applyPrintPage(orientation)
    const cleanup = () => {
      clearPrintPage()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
    window.setTimeout(cleanup, 1000)
  }

  return (
    <button
      type="button"
      className={`print-button ${className}`.trim()}
      onClick={handlePrint}
      aria-label="Imprimir relatório atual"
      title="Imprimir relatório"
    >
      <Printer size={15} />
      <span>Imprimir</span>
    </button>
  )
}
