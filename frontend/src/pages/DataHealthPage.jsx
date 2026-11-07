import { Activity, AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { EmptyState, LoadingState } from '../components/States'
import DataStatusBanner from '../components/DataStatusBanner'
import useAsyncData from '../hooks/useAsyncData'
import { money, periodLabel } from '../utils/formatters'
import '../styles/management-intelligence.css'

const SALES = 'superus_period_snapshots'
const LOSSES = 'loss_period_snapshots'
const STORES = ['307', '212', '600', '120', '033', '018']

async function fetchHealth() {
  // Consultas enxutas: metadados, sem baixar dezenas de MB de JSONB.
  const [salesResult, lossesResult, syncResult, anomaliesResult] = await Promise.allSettled([
    supabase.from(SALES)
      .select('reference_date,current_start,current_end,store_count,quality,updated_at')
      .eq('snapshot_type', 'MONTHLY').eq('slug', 'monthly')
      .eq('mode', 'RUNNING_MONTH')
      .order('reference_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from(LOSSES)
      .select('store_code,current_start,current_end,quality,run_id,updated_at')
      .order('current_end', { ascending: false }).order('updated_at', { ascending: false })
      .limit(6),
    supabase.from('sync_runs')
      .select('id,sync_type,period_start,period_end,status,started_at,finished_at,message')
      .order('started_at', { ascending: false }).limit(15),
    supabase.from('tabloid_price_anomalies')
      .select('reference_date,store_code,product_code,product_name,quantity,sales_value,implied_unit_price,benchmark_unit_price,difference_from_benchmark')
      .order('reference_date', { ascending: false })
      .order('difference_from_benchmark', { ascending: false }).limit(30),
  ])
  const unwrap = (result) => {
    if (result.status === 'rejected') return { data: null, error: result.reason }
    return result.value
  }
  return {
    sales: unwrap(salesResult),
    losses: unwrap(lossesResult),
    syncs: unwrap(syncResult),
    anomalies: unwrap(anomaliesResult),
  }
}

function statusOf(result) {
  return result.error ? 'Consulta indisponível' : result.data ? 'Disponível' : 'Sem registros'
}

function formatDate(value) {
  return value ? new Date(value.includes('T') ? value : value.replace(' ', 'T')).toLocaleString('pt-BR') : '—'
}

function Currency({ value }) {
  return <span>{value === null || value === undefined ? '—' : money(Number(value))}</span>
}

export default function DataHealthPage() {
  const { data, loading, refreshing, error, refresh } = useAsyncData(fetchHealth, [])
  const latestSales = data?.sales?.data
  const latestLosses = data?.losses?.data || []
  const dateOfLosses = latestLosses[0]?.current_end
  const samePeriodLosses = latestLosses.filter((row) => row.current_end === dateOfLosses && row.current_start === latestLosses[0]?.current_start)
  const missingStores = STORES.filter((code) => !samePeriodLosses.some((row) => row.store_code === code))
  const salesOk = latestSales?.quality?.status === 'PASS' && latestSales?.store_count === 6
  const lossesOk = samePeriodLosses.length === 6 && missingStores.length === 0 &&
    samePeriodLosses.every((row) => row.quality?.status === 'PASS')
  const aligned = Boolean(latestSales && dateOfLosses &&
    latestSales.current_start === latestLosses[0]?.current_start && latestSales.current_end === dateOfLosses)
  const alerts = useMemo(() => (data?.anomalies?.data || []).map((row) => ({
    ...row,
    difference: Number(row.difference_from_benchmark),
  })), [data])
  return (
    <div className="page page-tight manager-page page-view-enter">
      <header className="manager-header">
        <div>
          <span className="manager-eyebrow"><Activity size={16} /> CENTRAL DE QUALIDADE <b className="feature-new-badge">NOVO</b></span>
          <h1>Saúde dos dados</h1>
          <p>Integridade das coletas, auditoria de sincronização e valores suspeitos no Tabloide. Acesso administrativo.</p>
        </div>
        <button type="button" className="manager-refresh" disabled={refreshing} onClick={refresh}>
          <RefreshCw size={16} /> {refreshing ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>
      {loading && !data ? <LoadingState /> : null}
      {error ? <DataStatusBanner error={error} /> : null}
      {data ? (
        <>
          <section className="manager-kpis" aria-label="Indicadores de integridade">
            <article>
              <small><ShieldCheck size={14} /> Vendas mensais</small>
              <strong>{salesOk ? '6 / 6' : 'Verificar'}</strong>
              <span>{latestSales ? periodLabel(latestSales.current_start, latestSales.current_end) : statusOf(data.sales)}</span>
              <span>{latestSales?.quality?.status || 'Qualidade indisponível'}</span>
            </article>
            <article>
              <small><CheckCircle2 size={14} /> Perdas</small>
              <strong>{lossesOk ? '6 / 6' : `${samePeriodLosses.length} / 6`}</strong>
              <span>{latestLosses[0] ? periodLabel(latestLosses[0].current_start, latestLosses[0].current_end) : statusOf(data.losses)}</span>
              <span>{lossesOk ? 'Qualidade aprovada' : 'Conferir qualidade / lojas ausentes'}</span>
            </article>
            <article>
              <small>Períodos de vendas e perdas</small>
              <strong>{aligned ? 'Alinhados' : 'Conferir'}</strong>
              <span>Comparações só devem unir períodos idênticos.</span>
            </article>
            <article>
              <small>Alertas financeiros do Tabloide</small>
              <strong>{data.anomalies.error ? '—' : alerts.length}</strong>
              <span>{data.anomalies.error ? 'Consulta indisponível' : 'Amostra dos 30 alertas mais recentes'}</span>
            </article>
          </section>
          {missingStores.length ? <p className="manager-notice manager-notice--warning" role="alert">Lojas ausentes na competência mais recente de perdas: {missingStores.join(', ')}.</p> : null}
          {data.sales.error || data.losses.error || data.syncs.error || data.anomalies.error ? (
            <p className="manager-notice manager-notice--warning">Alguma fonte não pôde ser consultada. Verifique as permissões, a publicação das views e as migrações do banco. Nenhum valor ausente foi tratado como zero.</p>
          ) : null}
          <section className="manager-panel">
            <div className="manager-panel-heading">
              <h2><AlertTriangle size={18} /> Revisão financeira do Tabloide <b className="feature-new-badge">NOVO</b></h2>
              <span>Preço implícito versus mediana de lojas</span>
            </div>
            <p className="manager-explanation">Sinais exploratórios: valor de vendas dividido pela quantidade reportada. Divergências superiores a 3 vezes a mediana e R$ 1.000 de diferença exigem revisão na origem. Os dados não são corrigidos automaticamente.</p>
            {alerts.length ? (
              <div className="manager-table-scroll">
                <table className="manager-table">
                  <thead><tr><th>Data</th><th>Loja</th><th>Produto</th><th>Venda reportada</th><th>Valor unitário implícito</th><th>Mediana das lojas</th><th>Diferença estimada</th></tr></thead>
                  <tbody>{alerts.map((row, index) => (
                    <tr key={`${row.reference_date}-${row.store_code}-${row.product_code}-${index}`}>
                      <td>{row.reference_date}</td>
                      <td>{row.store_code}</td>
                      <td>{row.product_name} <small>({row.product_code})</small></td>
                      <td><Currency value={row.sales_value} /></td>
                      <td><Currency value={row.implied_unit_price} /></td>
                      <td><Currency value={row.benchmark_unit_price} /></td>
                      <td className="manager-negative"><Currency value={row.difference} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="manager-empty"><EmptyState message={data.anomalies.error ? 'A consulta de alertas está indisponível.' : 'Nenhuma divergência detectada nos snapshots recentes.'} /></div>}
          </section>
          <section className="manager-panel">
            <div className="manager-panel-heading"><h2>Execuções de sincronização <b className="feature-new-badge">NOVO</b></h2><span>Histórico de auditoria</span></div>
            {(data.syncs.data || []).length ? (
              <div className="manager-table-scroll"><table className="manager-table">
                <thead><tr><th>Tipo</th><th>Período</th><th>Resultado</th><th>Início</th><th>Término</th><th>Mensagem</th></tr></thead>
                <tbody>{data.syncs.data.map((run) => <tr key={run.id}>
                  <td>{run.sync_type}</td><td>{run.period_start} a {run.period_end}</td>
                  <td className={run.status === 'FAILED' ? 'manager-negative' : 'manager-positive'}>{run.status}</td>
                  <td>{formatDate(run.started_at)}</td><td>{formatDate(run.finished_at)}</td><td>{run.message || '—'}</td>
                </tr>)}</tbody>
              </table></div>
            ) : <p className="manager-empty">{data.syncs.error ? 'Não foi possível carregar o histórico.' : 'Nenhuma execução registrada ainda. Os próximos ciclos do worker preencherão esta tabela.'}</p>}
          </section>
        </>
      ) : null}
    </div>
  )
}
