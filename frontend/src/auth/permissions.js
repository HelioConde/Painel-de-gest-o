export const PERMISSIONS = {
  gerencia: {
    eventos: true,
    vendaDiaria: true,
    vendaMensal: true,
    perdas: false,
    aiSales: true,
    aiLosses: false,
    cartazes: true,
  },
  prevencao: {
    eventos: false,
    vendaDiaria: false,
    vendaMensal: false,
    perdas: true,
    aiSales: false,
    aiLosses: true,
    cartazes: false,
  },
  admin: {
    eventos: true,
    vendaDiaria: true,
    vendaMensal: true,
    perdas: true,
    aiSales: true,
    aiLosses: true,
    cartazes: true,
  },
}

const ROUTE_PERMISSIONS = [
  { path: '/cartazes/admin-layout', permission: 'cartazes' },
  { path: '/cartazes', permission: 'cartazes' },
  { path: '/analise-ia', permission: 'aiAccess' },
  { path: '/perdas', permission: 'perdas' },
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
  return '/eventos'
}

export function routePermission(pathname) {
  return ROUTE_PERMISSIONS.find(({ path }) => pathname === path || pathname.startsWith(`${path}/`))?.permission
}

export function canAccessRoute(role, pathname) {
  const permission = routePermission(pathname)
  return permission ? hasPermission(role, permission) : false
}
