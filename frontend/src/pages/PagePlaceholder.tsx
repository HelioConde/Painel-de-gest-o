import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

type PagePlaceholderProps = { title: string; dashboard?: boolean }

export function PagePlaceholder({ title, dashboard = false }: PagePlaceholderProps) {
  return (
    <div className="page">
      <PageHeader title={title} />
      <Card>
        <h2>{dashboard ? 'Projeto inicial configurado com sucesso.' : 'Página em construção'}</h2>
        <p>Dados ainda não conectados.</p>
      </Card>
    </div>
  )
}
