// Navegação organizada por tarefa, sem alterar rotas nem permissões.
const ANALYSIS_ROUTES = new Set([
  '/comparativo', '/radar', '/diagnostico-vendas',
  '/pareto-perdas', '/historico-produtos', '/analise-ia',
])
const MANAGEMENT_ROUTES = new Set([
  '/planos-acao', '/saude-dados', '/configuracoes',
])

export function groupVisibleNavigation(items = []) {
  const sections = { reports: [], intelligence: [], management: [] }
  for (const item of items) {
    if (ANALYSIS_ROUTES.has(item.to)) sections.intelligence.push(item)
    else if (MANAGEMENT_ROUTES.has(item.to)) sections.management.push(item)
    else sections.reports.push(item) // rotas futuras continuam visíveis
  }
  return sections
}

export function groupForPath(pathname = '') {
  const matches = (route) => pathname === route || pathname.startsWith(route + '/')
  if ([...ANALYSIS_ROUTES].some(matches)) return 'intelligence'
  if ([...MANAGEMENT_ROUTES].some(matches)) return 'management'
  return 'reports'
}
