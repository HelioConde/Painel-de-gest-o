
import { AlertTriangle, ClipboardPlus, Radar, RefreshCw, TrendingDown } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { LoadingState, EmptyState } from '../components/States'
import DataStatusBanner from '../components/DataStatusBanner'
import useAsyncData from '../hooks/useAsyncData'
import { getLatestMonthlySnapshot } from '../services/sales'
import { getLatestLossRun } from '../services/losses'
import { money, percent, periodLabel } from '../utils/formatters'
import { actionPlanLink, buildOpportunityRadar } from '../utils/operationalInsights'
import '../styles/management-intelligence.css'
import '../styles/operational-insights.css'

function OpportunitySection({ heading, description, items, department, empty }) {
  return (
    <section className="manager-panel">
      <div className="manager-panel-heading">
        <h2>{heading}</h2><span>{items.length} oportunidades identificadas</span>
      </div>
      <p className="manager-explanation">{description}</p>
      {items.length ? (
        <div className="opportunity-grid">
          {items.slice(0, 24).map((item) => (
            <article className="opportunity-card" key={item.kind + '-' + item.storeCode + '-' + item.sector}>
              <div className="opportunity-card-top">
                <strong>{item.storeName}</strong>
                <span>{item.sector || 'Total da loja'}</span>
              </div>
              <h3>{item.title}</h3>
              <div className="opportunity-impact">
                <small>{department === 'VENDAS' ? 'Diferença negativa vs. comparativo' : 'Excesso teórico sobre meta'}</small>
                <strong>{money(item.impact)}</strong>
              </div>
              <p>{department === 'VENDAS'
                ? 'Variação: ' + percent(item.variation) + '. Consulte os setores com maior queda no diagnóstico comercial.'
                : 'Perda: ' + percent(item.currentRate) + ' · Meta: ' + percent(item.targetRate) + '.'}</p>
              <Link className="manager-small-button opportunity-action" to={actionPlanLink(item)}>
                <ClipboardPlus size={15} /> Criar plano de ação
              </Link>
            </article>
          ))}
        </div>
      ) : <p className="manager-empty">{empty}</p>}
    </section>
  )
}

export default function OpportunityRadarPage() {
  const { hasPermission } = useAuth()
  const canSeeSales = hasPermission('vendaMensal')
  const canSeeLosses = hasPermission('perdas')
  const { data, loading, refreshing, error, refresh } = useAsyncData(async () => {
    const [sales, losses] = await Promise.allSettled([
      canSeeSales ? getLatestMonthlySnapshot() : Promise.resolve(null),
      canSeeLosses ? getLatestLossRun() : Promise.resolve(null),
    ])
    return {
      sales: sales.status === 'fulfilled' ? sales.value : null,
      losses: losses.status === 'fulfilled' ? losses.value : null,
      salesError: sales.status === 'rejected' ? sales.reason : null,
      lossesError: losses.status === 'rejected' ? losses.reason : null,
    }
  }, [canSeeSales, canSeeLosses])
  const radar = useMemo(() => buildOpportunityRadar({ salesSnapshot: data?.sales, lossRun: data?.losses }), [data])

  return (
    <div className="page page-tight manager-page page-view-enter">
      <header className="manager-header">
        <div>
          <span className="manager-eyebrow"><Radar size={17} /> INTELIGÊNCIA OPERACIONAL <b className="feature-new-badge">NOVO</b></span>
          <h1>Radar de oportunidades</h1>
          <p>Identifique onde investigar e abra um plano de ação com o contexto preenchido automaticamente.</p>
        </div>
        <button type="button" className="manager-refresh" disabled={refreshing} onClick={refresh}>
          <RefreshCw size={16} /> {refreshing ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>
      {loading && !data ? <LoadingState /> : null}
      {error ? <DataStatusBanner error={error} /> : null}
      {data ? (
        <>
          {data.salesError || data.lossesError ? <p className="manager-notice manager-notice--warning" role="alert">Algumas fontes não puderam ser carregadas. Os alertas disponíveis não incluem dados sem autorização ou consulta inválida.</p> : null}
          {radar.errors.map((message) => <p className="manager-notice manager-notice--warning" role="alert" key={message}><AlertTriangle size={15} /> {message}</p>)}
          <div className="manager-source-grid">
            {canSeeSales ? <div className="manager-source"><TrendingDown size={17} /><span><strong>Competência comercial</strong><small>{data.sales ? periodLabel(data.sales.current_start, data.sales.current_end) : 'Não disponível'}</small></span></div> : null}
            {canSeeLosses ? <div className="manager-source"><AlertTriangle size={17} /><span><strong>Competência de perdas</strong><small>{data.losses ? periodLabel(data.losses.current_start, data.losses.current_end) : 'Não disponível'}</small></span></div> : null}
          </div>
          <section className="manager-kpis">
            {canSeeSales ? <article><small>Quedas comerciais relevantes</small><strong>{radar.sales.length}</strong><span>Queda de pelo menos 5% e acima de R$ 10 mil</span></article> : null}
            {canSeeLosses ? <article><small>Setores acima da meta</small><strong>{radar.losses.length}</strong><span>Excesso teórico de pelo menos R$ 500</span></article> : null}
          </section>
          {canSeeSales ? <OpportunitySection heading="Quedas comerciais prioritárias" items={radar.sales} department="VENDAS"
            description="Queda em reais e percentual contra o período comparativo do SUPERUS. Não implica causa diagnosticada; abrir o plano registra uma investigação."
            empty="Nenhuma loja atingiu os critérios nesta competência ou o relatório ainda não está validado." /> : null}
          {canSeeLosses ? <OpportunitySection heading="Oportunidades de prevenção de perdas" items={radar.losses} department="PERDAS"
            description="Diferença teórica entre a perda registrada e a meta do setor, usando vendas da própria competência de perdas. Não é uma economia garantida."
            empty="Nenhum setor atingiu os critérios, ou as seis lojas não passaram na validação de qualidade." /> : null}
          {!canSeeSales && !canSeeLosses ? <EmptyState message="Seu perfil não possui acesso às fontes para gerar alertas." /> : null}
          <p className="manager-explanation">Os dois tipos de oportunidades são listados separadamente: queda de vendas e excesso teórico de perdas não devem ser somados. Os dados são de leitura; criar um plano de ação exige sua confirmação no formulário.</p>
        </>
      ) : null}
    </div>
  )
}
