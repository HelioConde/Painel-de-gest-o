import { BarChart3, Bot, CalendarDays, ChevronLeft, FileText, LogOut, Menu, TrendingDown, TrendingUp, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import primorLogoWide from '../assets/primor-logo-wide.png'
import primorLogoSquare from '../assets/primor-logo-square.png'
import { useAuth } from '../auth/AuthProvider'

const NAV = [
  { to: '/eventos', label: 'Eventos', initial: 'E', tone: 'events', icon: CalendarDays, permission: 'eventos' },
  { to: '/diaria', label: 'Venda Diária', initial: 'D', tone: 'daily', icon: TrendingUp, permission: 'vendaDiaria' },
  { to: '/mensal', label: 'Venda Mensal', initial: 'M', tone: 'monthly', icon: BarChart3, permission: 'vendaMensal' },
  { to: '/perdas', label: 'Perdas', initial: 'P', tone: 'losses', icon: TrendingDown, permission: 'perdas' },
  { to: '/analise-ia', label: 'Análise com IA', initial: 'IA', tone: 'ai', icon: Bot, isNew: true, permission: 'aiAccess' },
  { to: '/cartazes', label: 'Cartazes', initial: 'C', tone: 'posters', icon: FileText, isNew: true, permission: 'cartazes' },
]


export default function AppShell({ children }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const { profile, hasPermission, signOut } = useAuth()
  const visibleNavigation = NAV.filter((item) => hasPermission(item.permission))

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

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
          {visibleNavigation.map(({ to, label, initial, tone, icon: Icon, isNew = false }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-item nav-${tone} ${isActive ? 'active' : ''}`}
              title={collapsed ? (isNew ? `${label}: nova funcionalidade` : label) : undefined}
              aria-label={isNew ? `${label}, nova funcionalidade` : label}
            >
              <span className={`nav-initial nav-initial-${tone}`} aria-hidden="true">{initial}</span>
              <Icon className="nav-icon" size={18} />
              <span className="nav-label">{label}</span>
              {isNew ? <span className="nav-new-badge" title="Nova ferramenta para criação e impressão de cartazes" aria-hidden="true">Novo</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user-panel">
          <UserRound size={16} aria-hidden="true" />
          <span>{profile?.display_name || 'Usuário'}</span>
          <button type="button" onClick={handleSignOut} aria-label="Sair do painel" title="Sair"><LogOut size={15} /></button>
        </div>
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
