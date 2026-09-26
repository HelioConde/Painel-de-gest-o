import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './styles/report-layout.css'
import './styles/report-print.css'
import './styles/posters.css'

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev'

function startVersionWatcher() {
  if (import.meta.env.DEV || !APP_VERSION || APP_VERSION === 'dev') return

  let checking = false

  async function checkVersion() {
    if (checking) return
    checking = true
    try {
      const base = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${base}version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!response.ok) return
      const payload = await response.json()
      const latest = String(payload?.version || '')
      if (!latest || latest === APP_VERSION) return

      const url = new URL(window.location.href)
      url.searchParams.set('v', latest.slice(0, 12))
      window.location.replace(url.toString())
    } catch {
      // Sem conexão ou deploy em andamento: tenta novamente depois.
    } finally {
      checking = false
    }
  }

  window.addEventListener('focus', checkVersion)
  window.addEventListener('pageshow', checkVersion)
  window.addEventListener('online', checkVersion)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkVersion()
  })

  window.setInterval(checkVersion, 15_000)
  window.setTimeout(checkVersion, 1_000)
}

startVersionWatcher()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
