import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { defaultRouteForRole } from './permissions'

export default function ProtectedRoute({ children, permission }) {
  const { session, role, loading, hasPermission } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="auth-loading-screen">Validando acesso...</div>
  }

  if (!session || !role) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to={defaultRouteForRole(role)} replace />
  }

  return children || <Outlet />
}
