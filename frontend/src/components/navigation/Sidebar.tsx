import { NavLink } from 'react-router-dom'

const links = [
  ['/', 'Dashboard'],
  ['/eventos', 'Eventos'],
  ['/venda-diaria', 'Venda Diária'],
  ['/venda-mensal', 'Venda Mensal'],
  ['/fechamento-mensal', 'Fechamento Mensal'],
  ['/perdas', 'Perdas'],
] as const

type SidebarProps = { isOpen: boolean; onNavigate: () => void }

export function Sidebar({ isOpen, onNavigate }: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      <div className="brand">PAINEL DE GESTÃO</div>
      <nav aria-label="Navegação principal">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate}>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
