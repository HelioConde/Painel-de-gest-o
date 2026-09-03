import { useState, type PropsWithChildren } from 'react'
import { Sidebar } from '../navigation/Sidebar'

export function AppShell({ children }: PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="app-shell">
      <button
        className="menu-toggle"
        type="button"
        aria-label="Abrir menu de navegação"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        Menu
      </button>
      {isOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setIsOpen(false)} />}
      <Sidebar isOpen={isOpen} onNavigate={() => setIsOpen(false)} />
      <main className="main-content">{children}</main>
    </div>
  )
}
