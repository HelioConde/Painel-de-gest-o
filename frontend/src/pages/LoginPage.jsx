import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import primorLogoWide from '../assets/primor-logo-wide.png'
import { useAuth } from '../auth/AuthProvider'
import { defaultRouteForRole } from '../auth/permissions'

export default function LoginPage() {
  const { session, role, loading, signIn, authMessage } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session && role) {
    const requestedPath = location.state?.from?.pathname
    return <Navigate to={requestedPath || defaultRouteForRole(role)} replace />
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const profile = await signIn(username, password)
      navigate(location.state?.from?.pathname || defaultRouteForRole(profile.role), { replace: true })
    } catch (signInError) {
      setError(signInError?.message || 'Usuário ou senha inválidos.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <img src={primorLogoWide} className="login-logo" alt="Primor supermercado" />
        <div className="login-heading">
          <h1 id="login-title">Painel de Gestão</h1>
          <p>Acesse sua área de trabalho</p>
        </div>
        <form onSubmit={submit}>
          <label>
            <span>USUÁRIO</span>
            <div className="login-input">
              <UserRound size={17} aria-hidden="true" />
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
            </div>
          </label>
          <label>
            <span>SENHA</span>
            <div className="login-input">
              <LockKeyhole size={17} aria-hidden="true" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
              <button type="button" className="login-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {error || authMessage ? <p className="login-error" role="alert">{error || authMessage}</p> : null}
          <button className="login-submit" type="submit" disabled={submitting || loading}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
