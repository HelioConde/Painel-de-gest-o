import { FileSpreadsheet, FileUp, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

const ACTIONS = [
  { id: 'file', icon: FileUp, title: 'Adicionar arquivo', description: 'TXT, CSV ou Excel' },
  { id: 'excel', icon: FileSpreadsheet, title: 'Importar Excel', description: 'Planilhas .xls e .xlsx' },
  { id: 'example', icon: Sparkles, title: 'Usar exemplo', description: 'Preencher uma lista pronta' },
  { id: 'clear', icon: Trash2, title: 'Limpar lista', description: 'Remover texto e placas', destructive: true },
]

export default function PosterInputActionsMenu({ open, onOpenChange, onAction }) {
  const menuId = useId()
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) onOpenChange(false)
    }
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onOpenChange(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onOpenChange, open])

  const handleMenuKeyDown = (event) => {
    const items = [...menuRef.current?.querySelectorAll('[role="menuitem"]') || []]
    const currentIndex = items.indexOf(document.activeElement)
    if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    event.preventDefault()
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
        : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[nextIndex].focus()
  }

  const runAction = (action) => {
    onOpenChange(false)
    onAction(action)
  }

  return (
    <div className="poster-input-actions" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="poster-icon-button"
        aria-label="Mais ações para a lista de produtos"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title="Mais ações"
        onClick={() => onOpenChange(!open)}
      >
        <span aria-hidden="true">+</span>
      </button>
      {open ? (
        <div id={menuId} ref={menuRef} className="poster-input-actions-menu" role="menu" aria-label="Ações da lista de produtos" onKeyDown={handleMenuKeyDown}>
          {ACTIONS.map(({ id, icon: Icon, title, description, destructive }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className={destructive ? 'poster-input-action destructive' : 'poster-input-action'}
              aria-label={`${title}: ${description}`}
              onClick={() => runAction(id)}
            >
              <span className="poster-input-action-icon"><Icon size={17} /></span>
              <span><strong>{title}</strong><small>{description}</small></span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
