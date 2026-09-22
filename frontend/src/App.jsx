import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import DailyPage from './pages/DailyPage'
import MonthlyPage from './pages/MonthlyPage'
import EventsPage from './pages/EventsPage'
import LossesPage from './pages/LossesPage'
import CartazesPage from './pages/CartazesPage'
import CartazesLayoutAdminPage from './pages/CartazesLayoutAdminPage'
import AiAnalysisPage from './pages/AiAnalysisPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/diaria" replace />} />
        <Route path="/diaria" element={<DailyPage />} />
        <Route path="/mensal" element={<MonthlyPage />} />
        <Route path="/eventos" element={<EventsPage />} />
        <Route path="/perdas" element={<LossesPage />} />
        <Route path="/analise-ia" element={<AiAnalysisPage />} />
        <Route path="/cartazes" element={<CartazesPage />} />
        <Route path="/cartazes/admin-layout" element={<CartazesLayoutAdminPage />} />
        <Route path="*" element={<Navigate to="/diaria" replace />} />
      </Routes>
    </AppShell>
  )
}
