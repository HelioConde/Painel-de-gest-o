import { AppRouter } from './app/router'
import { AppProviders } from './app/providers'

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}
