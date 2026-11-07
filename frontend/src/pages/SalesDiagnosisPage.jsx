
import { ChartNoAxesCombined, ClipboardPlus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useAsyncData from '../hooks/useAsyncData'
import { getLatestMonthlySnapshot } from '../services/sales'
import { EmptyState, LoadingState } from '../components/States'
import DataStatusBanner from '../components/DataStatusBanner'
import { money, percent, periodLabel } from '../utils/formatters'
import { actionPlanLink, diagnoseSales } from '../utils/operationalInsights'
import '../styles/management-intelligence.css'
import '../styles/operational-insights.css'

const STORES = [['307', 'Loja 01'], ['212', 'Loja 02'], ['600', 'Loja 03'], ['120', 'Loja 04'], ['033', 'Loja 05'], ['018', 'Loja 06']]
const LEVELS = [['sector', 'Setores'], ['group', 'Grupos'], ['subgroup', 'Subgrupos']]
const SHARED_NUMBER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

function uniqueNames(list) { return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')) }

export default function SalesDiagnosisPage() {
  const [store, setStore] = useState('')
  const [level, setLevel] = useState('sector')
  const [sector, setSector] = useState('')
  const [group, setGroup] = useState('')
  const { data, loading, error, refreshing, refresh } = useAsyncData(() => getLatestMonthlySnapshot(), [])
  const stores = (data?.details?.stores || []).filter((row) => !store || String(row.store_code).padStart(3, '0') === store)
  const sectorNames = useMemo(() => uniqueNames(stores.flatMap((row) => (row.sectors || []).map((s) => s.name))), [data, store])
  const groupNames = useMemo(() => uniqueNames(stores.flatMap((row) =>
    (row.sectors || []).filter((s) => !sector || s.name === sector).flatMap((s) => (s.groups || []).map((g) => g.name)))), [data, store, sector])
  const report = useMemo(() => diagnoseSales(data, { store, level, sector, group }), [data, store, level, sector, group])
  const approved = data?.quality?.status === 'PASS'

  function plannedLink(row) {
    const title = 'Investigar queda de vendas: ' + row.name + ' — ' + (store || 'rede')
    const description = 'Nível: ' + level + '. Setor: ' + row.sector + (row.group ? '. Grupo: ' + row.group : '')
      + '. Competência: ' + data.current_start + ' a ' + data.current_end
      + '. Comparativo: ' + data.previous_start + ' a ' + data.previous_end
      + '. Variação: ' + money(row.difference) + '. A causa deve ser investigada.'
    return actionPlanLink({ kind: 'VENDAS', storeCode: store || '307', sector: row.sector,
      title, description, current: row.current, previous: row.previous })
  }

  return (
    <div className="page page-tight manager-page page-view-enter">
      <header className="manager-header">
        <div>
          <span className="manager-eyebrow"><ChartNoAxesCombined size={17} /> ANÁLISE COMERCIAL <b className="feature-new-badge">NOVO</b></span>
          <h1>Diagnóstico da queda nas vendas</h1>
          <p>Descubra quais setores, grupos e subgrupos contribuíram para a variação comercial em reais.</p>
        </div>
        <button type="button" className="manager-refresh" disabled={refreshing} onClick={refresh}><RefreshCw size={16} /> Atualizar</button>
      </header>
      {loading && !data ? <LoadingState /> : null}
      {error ? <DataStatusBanner error={error} /> : null}
      {data ? (
        <>
          <div className="manager-source"><TrendingDown size={18} /><span>
            <strong>Atual: {periodLabel(data.current_start, data.current_end)}</strong>
            <small>Comparativo SUPERUS: {periodLabel(data.previous_start, data.previous_end)} · Qualidade: {data.quality?.status || 'não informada'}</small>
          </span></div>
          {!approved ? <p className="manager-notice manager-notice--warning" role="alert">A análise detalhada exige uma coleta com qualidade PASS. Verifique a origem antes de usar esses números.</p> : null}
          {approved && report.storeCount < 6 && !store ? <p className="manager-notice manager-notice--warning" role="alert">Existem dados de apenas {report.storeCount} das seis lojas. Os valores exibidos não representam o total da rede.</p> : null}
          {approved ? (
            <>
              <section className="manager-panel">
                <div className="manager-panel-heading"><h2>Filtros de diagnóstico</h2><span>A mesma competência em todos os níveis</span></div>
                <div className="manager-controls">
                  <label className="manager-select">Loja
                    <select value={store} onChange={(event) => { setStore(event.target.value); setSector(''); setGroup('') }}>
                      <option value="">Rede · todas as lojas</option>
                      {STORES.map(([code, name]) => <option value={code} key={code}>{name} · {code}</option>)}
                    </select>
                  </label>
                  <label className="manager-select">Detalhamento
                    <select value={level} onChange={(event) => { setLevel(event.target.value); setSector(''); setGroup('') }}>
                      {LEVELS.map(([key, label]) => <option value={key} key={key}>{label}</option>)}
                    </select>
                  </label>
                  {level !== 'sector' ? <label className="manager-select">Setor
                    <select value={sector} onChange={(event) => { setSector(event.target.value); setGroup('') }}>
                      <option value="">Todos</option>
                      {sectorNames.map((name) => <option value={name} key={name}>{name}</option>)}
                    </select>
                  </label> : null}
                  {level === 'subgroup' ? <label className="manager-select">Grupo
                    <select value={group} onChange={(event) => setGroup(event.target.value)}>
                      <option value="">Todos</option>
                      {groupNames.map((name) => <option value={name} key={name}>{name}</option>)}
                    </select>
                  </label> : null}
                </div>
              </section>
              <section className="manager-kpis">
                <article><small>Quedas brutas do recorte</small><strong className="manager-negative">{money(report.totalDecline)}</strong><span>Soma apenas das diferenças negativas</span></article>
                <article><small>Crescimentos do recorte</small><strong>{money(report.totalGrowth)}</strong><span>Compensação positiva de outros itens</span></article>
                <article><small>Saldo líquido dos itens</small><strong>{money(report.netDifference)}</strong><span>Não misturar setores com seus subgrupos</span></article>
                <article><small>Itens válidos</small><strong>{report.rows.length}</strong><span>{report.storeCount} loja(s) com dados neste filtro</span></article>
              </section>
              <section className="manager-panel">
                <div className="manager-panel-heading"><h2><TrendingDown size={18} /> Maiores quedas <b className="feature-new-badge">NOVO</b></h2><span>{report.declines.length} itens em queda</span></div>
                <p className="manager-explanation">A contribuição percentual se refere somente ao total bruto dos itens em queda deste nível e filtro. Não representa participação no faturamento da rede.</p>
                {report.declines.length ? <div className="manager-table-scroll"><table className="manager-table">
                  <thead><tr><th>Setor / item</th><th>Lojas</th><th>Vendas atuais</th><th>Comparativo</th><th>Queda (R$)</th><th>Variação</th><th>Contribuição das quedas</th><th>Ação</th></tr></thead>
                  <tbody>{report.declines.slice(0, 25).map((row) => (
                    <tr key={row.sector + '-' + row.group + '-' + row.name}>
                      <th scope="row"><strong>{row.name}</strong><small>{level !== 'sector' ? row.sector + (row.group ? ' / ' + row.group : '') : 'Setor'}</small></th>
                      <td>{row.storeCount}</td><td>{money(row.current)}</td><td>{money(row.previous)}</td>
                      <td className="manager-negative">{money(row.difference)}</td><td className="manager-negative">{percent(row.variation)}</td>
                      <td><div className="insight-meter"><span style={{ width: Math.min(row.declineContribution, 100) + '%' }} /></div>{SHARED_NUMBER.format(row.declineContribution)}%</td>
                      <td>{store ? <Link className="manager-small-button insight-action" to={plannedLink(row)}><ClipboardPlus size={14} /> Plano</Link> : 'Selecione uma loja'}</td>
                    </tr>
                  ))}</tbody>
                </table></div> : <p className="manager-empty">Nenhuma queda identificada nos itens disponíveis deste recorte.</p>}
              </section>
              <section className="manager-panel">
                <div className="manager-panel-heading"><h2><TrendingUp size={18} /> Setores e itens que cresceram</h2><span>Compensações comerciais</span></div>
                {report.growth.length ? <div className="manager-table-scroll"><table className="manager-table">
                  <thead><tr><th>Item</th><th>Lojas</th><th>Venda atual</th><th>Comparativo</th><th>Ganho (R$)</th><th>Variação</th></tr></thead>
                  <tbody>{report.growth.slice(0, 15).map((row) => <tr key={row.sector + '-' + row.group + '-' + row.name}>
                    <th scope="row"><strong>{row.name}</strong><small>{row.sector}</small></th>
                    <td>{row.storeCount}</td><td>{money(row.current)}</td><td>{money(row.previous)}</td>
                    <td className="manager-positive">{money(row.difference)}</td><td className="manager-positive">{percent(row.variation)}</td>
                  </tr>)}</tbody>
                </table></div> : <p className="manager-empty">Nenhum crescimento identificado neste filtro.</p>}
              </section>
            </>
          ) : null}
        </>
      ) : !loading && !error ? <EmptyState message="Nenhuma competência mensal disponível para o diagnóstico." /> : null}
    </div>
  )
}
