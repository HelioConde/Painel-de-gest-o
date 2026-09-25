import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import DailyPage from './pages/DailyPage'
import MonthlyPage from './pages/MonthlyPage'
import EventsPage from './pages/EventsPage'
import LossesPage from './pages/LossesPage'
import CartazesPage from './pages/CartazesPage'
import CartazesLayoutAdminPage from './pages/CartazesLayoutAdminPage'
import AiAnalysisPage from './pages/AiAnalysisPage'
import LoginPage from './pages/LoginPage'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import ProtectedRoute from './auth/ProtectedRoute'
import { defaultRouteForRole } from './auth/permissions'

function ProtectedShell() {
  return (
    <ProtectedRoute>
      <AppShell><Outlet /></AppShell>
    </ProtectedRoute>
  )
}

function RoleHome() {
  const { role } = useAuth()
  return <Navigate to={defaultRouteForRole(role)} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<RoleHome />} />
          <Route path="/diaria" element={<ProtectedRoute permission="vendaDiaria"><DailyPage /></ProtectedRoute>} />
          <Route path="/mensal" element={<ProtectedRoute permission="vendaMensal"><MonthlyPage /></ProtectedRoute>} />
          <Route path="/eventos" element={<ProtectedRoute permission="eventos"><EventsPage /></ProtectedRoute>} />
          <Route path="/perdas" element={<ProtectedRoute permission="perdas"><LossesPage /></ProtectedRoute>} />
          <Route path="/analise-ia" element={<ProtectedRoute permission="aiAccess"><AiAnalysisPage /></ProtectedRoute>} />
          <Route path="/cartazes" element={<ProtectedRoute permission="cartazes"><CartazesPage /></ProtectedRoute>} />
          <Route path="/cartazes/admin-layout" element={<ProtectedRoute permission="cartazes"><CartazesLayoutAdminPage /></ProtectedRoute>} />
          <Route path="*" element={<RoleHome />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
