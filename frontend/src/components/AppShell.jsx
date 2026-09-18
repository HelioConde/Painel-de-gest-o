import { BarChart3, CalendarDays, ChevronLeft, FileText, Menu, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import primorLogoWide from '../assets/primor-logo-wide.png'
import primorLogoSquare from '../assets/primor-logo-square.png'

const NAV = [
  { to: '/eventos', label: 'Eventos', initial: 'E', tone: 'events', icon: CalendarDays },
  { to: '/diaria', label: 'Venda Diária', initial: 'D', tone: 'daily', icon: TrendingUp },
  { to: '/mensal', label: 'Venda Mensal', initial: 'M', tone: 'monthly', icon: BarChart3 },
  { to: '/perdas', label: 'Perdas', initial: 'P', tone: 'losses', icon: TrendingDown },
  { to: '/cartazes', label: 'Cartazes', initial: 'C', tone: 'posters', icon: FileText },
]

export default function AppShell({ children }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-is-collapsed' : ''}`}>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="brand">
          <div className="brand-expanded">
            <img className="brand-logo-wide" src={primorLogoWide} alt="Primor supermercado" />
            <div className="brand-copy">
              <strong>Painel de Gestão</strong>
              <span>Desempenho comercial</span>
            </div>
          </div>

          <div className="brand-collapsed" aria-hidden={!collapsed}>
            <img src={primorLogoSquare} alt="Primor supermercado" />
          </div>

          <button
            className="sidebar-toggle desktop-only"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>

          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Fechar menu" type="button">
            <X size={20} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Navegação principal">
          {NAV.map(({ to, label, initial, tone, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-item nav-${tone} ${isActive ? 'active' : ''}`}
              title={collapsed ? label : undefined}
            >
              <span className={`nav-initial nav-initial-${tone}`} aria-hidden="true">{initial}</span>
              <Icon className="nav-icon" size={18} />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <span className="sidebar-status-text">Desenvolvido por Hélio Conde</span>
        </div>
      </aside>

      {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Fechar menu" />}

      <main className="main-area">
        <div className="mobile-topbar">
          <button className="icon-button" onClick={() => setOpen(true)} aria-label="Abrir menu" type="button">
            <Menu size={20} />
          </button>
          <img className="mobile-topbar-logo" src={primorLogoWide} alt="Primor supermercado" />
          <span>Painel de Gestão</span>
        </div>
        {children}
      </main>
    </div>
  )
}
