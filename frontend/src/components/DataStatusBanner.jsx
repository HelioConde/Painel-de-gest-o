import { AlertTriangle } from 'lucide-react'

export default function DataStatusBanner({ error }) {
  if (!error) return null

  return (
    <div className="data-status-banner" role="status">
      <AlertTriangle size={14} />
      <span>Não foi possível atualizar agora. Exibindo o último dado carregado.</span>
    </div>
  )
}
