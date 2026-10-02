export const PERMISSIONS = {
  gerencia: {
    eventos: true,
    vendaDiaria: true,
    vendaMensal: true,
    fechamentoMensal: true,
    perdas: false,
    aiSales: true,
    aiLosses: false,
    cartazes: true,
    cartazesAdmin: true,
    tabloide: true,
    configuracoes: false,
  },
  prevencao: {
    eventos: false,
    vendaDiaria: false,
    vendaMensal: false,
    fechamentoMensal: false,
    perdas: true,
    aiSales: false,
    aiLosses: true,
    cartazes: false,
    cartazesAdmin: false,
    tabloide: false,
    configuracoes: false,
  },
  admin: {
    eventos: true,
    vendaDiaria: true,
    vendaMensal: true,
    fechamentoMensal: true,
    perdas: true,
    aiSales: true,
    aiLosses: true,
    cartazes: true,
    cartazesAdmin: true,
    tabloide: true,
    configuracoes: true,
  },
  atendimento: {
    eventos: false,
    vendaDiaria: false,
    vendaMensal: false,
    fechamentoMensal: false,
    perdas: false,
    aiSales: false,
    aiLosses: false,
    cartazes: true,
    cartazesAdmin: false,
    tabloide: false,
    configuracoes: false,
  },
}

const ROUTE_PERMISSIONS = [
  { path: '/cartazes/admin-layout', permission: 'cartazesAdmin' },
  { path: '/configuracoes', permission: 'configuracoes' },
  { path: '/tabloide', permission: 'tabloide' },
  { path: '/cartazes', permission: 'cartazes' },
  { path: '/analise-ia', permission: 'aiAccess' },
  { path: '/perdas', permission: 'perdas' },
  { path: '/fechamento-mensal', permission: 'fechamentoMensal' },
  { path: '/mensal', permission: 'vendaMensal' },
  { path: '/diaria', permission: 'vendaDiaria' },
  { path: '/eventos', permission: 'eventos' },
]

export function hasPermission(role, permission) {
  const access = PERMISSIONS[role]
  if (!access) return false
  if (permission === 'aiAccess') return Boolean(access.aiSales || access.aiLosses)
  return Boolean(access[permission])
}

export function canUseAnalysis(role, analysisType) {
  return hasPermission(role, analysisType === 'sales' ? 'aiSales' : 'aiLosses')
}

export function defaultRouteForRole(role) {
  if (role === 'prevencao') return '/perdas'
  if (role === 'atendimento') return '/cartazes'
  return '/eventos'
}

export function routePermission(pathname) {
  return ROUTE_PERMISSIONS.find(({ path }) => pathname === path || pathname.startsWith(`${path}/`))?.permission
}

export function canAccessRoute(role, pathname) {
  const permission = routePermission(pathname)
  return permission ? hasPermission(role, permission) : false
}
