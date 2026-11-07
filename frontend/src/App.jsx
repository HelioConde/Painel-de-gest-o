import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'

const DailyPage = lazy(() => import('./pages/DailyPage'))
const MonthlyPage = lazy(() => import('./pages/MonthlyPage'))
const EventsPage = lazy(() => import('./pages/EventsPage'))
const LossesPage = lazy(() => import('./pages/LossesPage'))
const StoreIntelligencePage = lazy(() => import('./pages/StoreIntelligencePage'))
const DataHealthPage = lazy(() => import('./pages/DataHealthPage'))
const ActionPlansPage = lazy(() => import('./pages/ActionPlansPage'))
const CartazesPage = lazy(() => import('./pages/CartazesPage'))
const CartazesLayoutAdminPage = lazy(() => import('./pages/CartazesLayoutAdminPage'))
const AiAnalysisPage = lazy(() => import('./pages/AiAnalysisPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const TabloidPage = lazy(() => import('./pages/TabloidPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const PosterVisualQaPage = lazy(() => import('./pages/PosterVisualQaPage'))
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

const visualQaEnabled = import.meta.env.VITE_VISUAL_QA === '1'

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="page" role="status">Carregando módulo...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {visualQaEnabled ? <Route path="/visual-qa/cartazes" element={<PosterVisualQaPage />} /> : null}
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<RoleHome />} />
          <Route path="/diaria" element={<ProtectedRoute permission="vendaDiaria"><DailyPage /></ProtectedRoute>} />
          <Route path="/mensal" element={<ProtectedRoute permission="vendaMensal"><MonthlyPage /></ProtectedRoute>} />
          <Route path="/fechamento-mensal" element={<ProtectedRoute permission="fechamentoMensal"><MonthlyPage monthlyClose /></ProtectedRoute>} />
          <Route path="/eventos" element={<ProtectedRoute permission="eventos"><EventsPage /></ProtectedRoute>} />
          <Route path="/perdas" element={<ProtectedRoute permission="perdas"><LossesPage /></ProtectedRoute>} />
          <Route path="/comparativo" element={<ProtectedRoute permission="comparativoLojas"><StoreIntelligencePage /></ProtectedRoute>} />
          <Route path="/analise-ia" element={<ProtectedRoute permission="aiAccess"><AiAnalysisPage /></ProtectedRoute>} />
          <Route path="/cartazes" element={<ProtectedRoute permission="cartazes"><CartazesPage /></ProtectedRoute>} />
          <Route path="/cartazes/admin-layout" element={<ProtectedRoute permission="cartazesAdmin"><CartazesLayoutAdminPage /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute permission="configuracoes"><SettingsPage /></ProtectedRoute>} />
          <Route path="/planos-acao" element={<ProtectedRoute permission="planosAcao"><ActionPlansPage /></ProtectedRoute>} />
          <Route path="/saude-dados" element={<ProtectedRoute permission="saudeDados"><DataHealthPage /></ProtectedRoute>} />
          <Route path="/tabloide" element={<ProtectedRoute permission="tabloide"><TabloidPage /></ProtectedRoute>} />
          <Route path="*" element={<RoleHome />} />
        </Route>
      </Routes>
      </Suspense>
    </AuthProvider>
  )
}
