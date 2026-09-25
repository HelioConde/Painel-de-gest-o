import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { hasPermission as checkPermission } from './permissions'

const AuthContext = createContext(null)

const LOGIN_EMAILS = {
  gerencia: 'gerencia@primor.local',
  prevencao: 'prevencao@primor.local',
  admin: 'admin@primor.local',
}

function normalizeUsername(value = '') {
  return value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMessage, setAuthMessage] = useState('')

  const clearSession = useCallback((message = '') => {
    setSession(null)
    setUser(null)
    setProfile(null)
    setAuthMessage(message)
  }, [])

  const resolveSession = useCallback(async (nextSession) => {
    if (!nextSession?.user || !supabase) {
      clearSession()
      return null
    }

    const { data: nextProfile, error } = await supabase
      .from('profiles')
      .select('user_id,username,display_name,role,active,created_at')
      .eq('user_id', nextSession.user.id)
      .maybeSingle()

    if (error || !nextProfile) {
      await supabase.auth.signOut()
      clearSession('Seu perfil de acesso não foi encontrado.')
      throw new Error('Seu perfil de acesso não foi encontrado.')
    }

    if (!nextProfile.active) {
      await supabase.auth.signOut()
      clearSession('Este usuário está desativado.')
      throw new Error('Este usuário está desativado.')
    }

    setSession(nextSession)
    setUser(nextSession.user)
    setProfile(nextProfile)
    setAuthMessage('')
    return nextProfile
  }, [clearSession])

  useEffect(() => {
    let active = true

    if (!supabaseConfigured || !supabase) {
      setLoading(false)
      setAuthMessage('A conexão com o Supabase não está configurada.')
      return undefined
    }

    const loadInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (active) await resolveSession(data.session)
      } catch (error) {
        if (active) clearSession(error?.message || 'Não foi possível validar a sessão.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadInitialSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      if (!nextSession) {
        clearSession()
        setLoading(false)
        return
      }

      void resolveSession(nextSession)
        .catch(() => undefined)
        .finally(() => active && setLoading(false))
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [clearSession, resolveSession])

  const signIn = useCallback(async (username, password) => {
    if (!supabase) throw new Error('A conexão com o Supabase não está disponível.')

    const email = LOGIN_EMAILS[normalizeUsername(username)]
    if (!email) throw new Error('Usuário ou senha inválidos.')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) throw new Error('Usuário ou senha inválidos.')

    return resolveSession(data.session)
  }, [resolveSession])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    clearSession()
  }, [clearSession])

  const value = useMemo(() => ({
    session,
    user,
    profile,
    role: profile?.role || null,
    loading,
    authMessage,
    signIn,
    signOut,
    isAdmin: profile?.role === 'admin',
    hasPermission: (permission) => checkPermission(profile?.role, permission),
  }), [authMessage, loading, profile, session, signIn, signOut, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}
