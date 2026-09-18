import { AlertTriangle, Database, LoaderCircle } from 'lucide-react'

export function LoadingState() {
  return (
    <div className="state-card">
      <LoaderCircle className="spin" size={28} />
      <strong>Carregando dados</strong>
      <span>Consultando o snapshot mais recente no Supabase.</span>
    </div>
  )
}

export function EmptyState({ message = 'Nenhum snapshot encontrado.' }) {
  return (
    <div className="state-card">
      <Database size={28} />
      <strong>Sem dados disponíveis</strong>
      <span>{message}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const needsConfig = error?.message === 'SUPABASE_NOT_CONFIGURED'
  return (
    <div className="state-card state-error">
      <AlertTriangle size={28} />
      <strong>{needsConfig ? 'Configure o Supabase' : 'Não foi possível carregar os dados'}</strong>
      <span>
        {needsConfig
          ? 'Copie .env.example para .env e informe VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
          : error?.message || 'Erro desconhecido.'}
      </span>
      {!needsConfig && <button onClick={onRetry}>Tentar novamente</button>}
    </div>
  )
}
