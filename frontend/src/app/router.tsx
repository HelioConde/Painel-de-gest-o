import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { DashboardPage } from '../pages/Dashboard'
import { EventsPage } from '../pages/Events'
import { DailySalesPage } from '../pages/DailySales'
import { MonthlySalesPage } from '../pages/MonthlySales'
import { MonthlyClosePage } from '../pages/MonthlyClose'
import { LossesPage } from '../pages/Losses'

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/eventos" element={<EventsPage />} />
        <Route path="/venda-diaria" element={<DailySalesPage />} />
        <Route path="/venda-mensal" element={<MonthlySalesPage />} />
        <Route path="/fechamento-mensal" element={<MonthlyClosePage />} />
        <Route path="/perdas" element={<LossesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
