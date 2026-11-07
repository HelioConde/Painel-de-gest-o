import { ArrowDownUp, RefreshCw, Search, ShieldAlert, Store, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import DataStatusBanner from '../components/DataStatusBanner'
import { EmptyState, LoadingState } from '../components/States'
import useAsyncData from '../hooks/useAsyncData'
import { getLatestLossRun } from '../services/losses'
import { getLatestMonthlySnapshot } from '../services/sales'
import { money, percent, periodLabel } from '../utils/formatters'
import { buildStoreIntelligence } from '../utils/storeIntelligence'
import '../styles/management-intelligence.css'

function numberCompare(value, fallback = -Infinity) {
  return value === null || value === undefined ? fallback : Number(value)
}

function ErrorLine({ message }) {
  return <p className="manager-notice manager-notice--warning" role="alert">{message}</p>
}

export default function StoreIntelligencePage() {
  const { hasPermission } = useAuth()
  const canSeeSales = hasPermission('vendaMensal')
  const canSeeLosses = hasPermission('perdas')
  const [term, setTerm] = useState('')
  const [onlyAttention, setOnlyAttention] = useState(false)
  const [sort, setSort] = useState('store')

  const { data, loading, refreshing, error, refresh } = useAsyncData(async () => {
    // Cada perfil só consulta módulos para os quais recebeu autorização.
    const [salesResult, lossResult] = await Promise.allSettled([
      canSeeSales ? getLatestMonthlySnapshot() : Promise.resolve(null),
      canSeeLosses ? getLatestLossRun() : Promise.resolve(null),
    ])
    return {
      sales: salesResult.status === 'fulfilled' ? salesResult.value : null,
      losses: lossResult.status === 'fulfilled' ? lossResult.value : null,
      salesError: salesResult.status === 'rejected' ? 'Não foi possível consultar vendas.' : null,
      lossError: lossResult.status === 'rejected' ? 'Não foi possível consultar perdas.' : null,
    }
  }, [canSeeSales, canSeeLosses])

  const analysis = useMemo(() => buildStoreIntelligence({
    salesSnapshot: data?.sales,
    lossRun: data?.losses,
  }), [data])

  const stores = useMemo(() => {
    const needle = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
    const items = analysis.stores.filter((row) => {
      const name = `${row.name} ${row.code} ${row.label}`
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
      return (!needle || name.includes(needle)) && (!onlyAttention || row.attention)
    })
    if (sort === 'sales') return [...items].sort((a, b) => numberCompare(b.salesValue) - numberCompare(a.salesValue))
    if (sort === 'decline') return [...items].sort((a, b) => numberCompare(a.salesVariation, Infinity) - numberCompare(b.salesVariation, Infinity))
    if (sort === 'loss') return [...items].sort((a, b) => numberCompare(b.lossValue) - numberCompare(a.lossValue))
    if (sort === 'rate') return [...items].sort((a, b) => numberCompare(b.lossRate) - numberCompare(a.lossRate))
    return items
  }, [analysis.stores, term, onlyAttention, sort])

  return (
    <div className="page page-tight manager-page page-view-enter">
      <header className="manager-header">
        <div>
          <span className="manager-eyebrow"><Store size={16} /> INTELIGÊNCIA OPERACIONAL</span>
          <h1>Comparativo de lojas <b className="feature-new-badge">NOVO</b></h1>
          <p>Seis unidades, evolução comercial e perdas com sinalização de dados incompletos.</p>
        </div>
        <button type="button" onClick={refresh} disabled={refreshing} className="manager-refresh">
          <RefreshCw size={16} /> {refreshing ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>

      {loading && !data ? <LoadingState /> : null}
      {!loading && error && !data ? <ErrorLine message="Falha ao carregar o comparativo. Tente novamente." /> : null}
      {data ? (
        <>
          <DataStatusBanner error={error} />
          {data.salesError ? <ErrorLine message={data.salesError} /> : null}
          {data.lossError ? <ErrorLine message={data.lossError} /> : null}
          <div className="manager-source-grid">
            {canSeeSales ? (
              <div className="manager-source">
                <TrendingUp size={17} />
                <span><strong>Vendas mensais</strong><small>{analysis.salesPeriod ? periodLabel(analysis.salesPeriod.start, analysis.salesPeriod.end) : 'Sem período disponível'}</small></span>
              </div>
            ) : null}
            {canSeeLosses ? (
              <div className="manager-source">
                <TrendingDown size={17} />
                <span><strong>Perdas</strong><small>{analysis.lossPeriod ? periodLabel(analysis.lossPeriod.start, analysis.lossPeriod.end) : 'Sem período disponível'}</small></span>
              </div>
            ) : null}
          </div>

          {canSeeSales && canSeeLosses && analysis.salesPeriod && analysis.lossPeriod && !analysis.alignedPeriods ? (
            <ErrorLine message="Os períodos de Vendas e Perdas não coincidem. As colunas usam seus próprios períodos; não são comparadas diretamente." />
          ) : null}
          {analysis.missingSales.length ? (
            <ErrorLine message={`Vendas sem dados por loja: ${analysis.missingSales.join(', ')}. Não há total de rede calculado a partir de lojas parciais.`} />
          ) : null}
          {analysis.missingLosses.length ? (
            <ErrorLine message={`Perdas sem dados por loja: ${analysis.missingLosses.join(', ')}. Não há total de rede calculado a partir de lojas parciais.`} />
          ) : null}

          {!data.sales && !data.losses ? (
            <EmptyState message="Ainda não há indicadores sincronizados para este perfil." />
          ) : (
            <>
              <section className="manager-kpis" aria-label="Indicadores da rede">
                {canSeeSales ? (
                  <article>
                    <small>Venda da rede · {analysis.completeSales ? '6 de 6 lojas' : 'incompleto'}</small>
                    <strong>{money(analysis.totals.sales)}</strong>
                    <span>Competência de Vendas</span>
                  </article>
                ) : null}
                {canSeeLosses ? (
                  <>
                    <article>
                      <small>Perdas da rede · {analysis.completeLosses ? '6 de 6 lojas' : 'incompleto'}</small>
                      <strong>{money(analysis.totals.loss)}</strong>
                      <span>Competência de Perdas</span>
                    </article>
                    <article>
                      <small>Perdas sobre vendas · período de Perdas</small>
                      <strong>{percent(analysis.totals.lossRate)}</strong>
                      <span>Taxa ponderada pelo faturamento da coleta de Perdas</span>
                    </article>
                  </>
                ) : null}
              </section>

              <section className="manager-panel">
                <div className="manager-panel-heading">
                  <h2>Resultado por unidade</h2>
                  <span>{stores.length} de 6 lojas</span>
                </div>
                <div className="manager-controls no-print">
                  <label className="manager-search">
                    <Search size={17} />
                    <input type="search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar loja ou código" aria-label="Buscar loja ou código" />
                  </label>
                  <label className="manager-select">
                    <ArrowDownUp size={16} />
                    <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar lojas">
                      <option value="store">Ordem das lojas</option>
                      {canSeeSales ? <option value="sales">Maior venda</option> : null}
                      {canSeeSales ? <option value="decline">Maior queda comercial</option> : null}
                      {canSeeLosses ? <option value="loss">Maior perda em reais</option> : null}
                      {canSeeLosses ? <option value="rate">Maior taxa de perda</option> : null}
                    </select>
                  </label>
                  <label className="manager-checkbox">
                    <input type="checkbox" checked={onlyAttention} onChange={(event) => setOnlyAttention(event.target.checked)} />
                    Mostrar apenas atenção
                  </label>
                </div>
                <div className="manager-table-scroll">
                  <table className="manager-table">
                    <thead>
                      <tr>
                        <th scope="col">Loja</th>
                        {canSeeSales ? <th scope="col">Venda mensal</th> : null}
                        {canSeeSales ? <th scope="col">Variação de vendas</th> : null}
                        {canSeeLosses ? <th scope="col">Valor perdido</th> : null}
                        {canSeeLosses ? <th scope="col">% perda / venda</th> : null}
                        {canSeeLosses ? <th scope="col">Setores acima da meta</th> : null}
                        <th scope="col">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.map((row) => (
                        <tr key={row.code}>
                          <th scope="row"><strong>{row.label}</strong><small>{row.name}</small></th>
                          {canSeeSales ? <td>{money(row.salesValue)}</td> : null}
                          {canSeeSales ? (
                            <td className={row.salesVariation !== null && row.salesVariation < 0 ? 'manager-negative' : 'manager-positive'}>
                              {percent(row.salesVariation)}
                            </td>
                          ) : null}
                          {canSeeLosses ? <td>{money(row.lossValue)}</td> : null}
                          {canSeeLosses ? <td>{percent(row.lossRate)}</td> : null}
                          {canSeeLosses ? <td>{row.missingLoss ? 'Sem coleta' : row.exceededTargets}</td> : null}
                          <td>{row.missingSales || row.missingLoss ? 'Incompleto' : row.attention ? 'Investigar' : 'Sem alertas detectados'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!stores.length ? <p className="manager-empty">Nenhuma unidade corresponde aos filtros.</p> : null}
              </section>

              {canSeeLosses && analysis.topLossProducts.length ? (
                <section className="manager-panel">
                  <div className="manager-panel-heading">
                    <h2>Produtos mais perdidos <b className="feature-new-badge">NOVO</b></h2>
                    <span>Somente a competência de Perdas exibida acima</span>
                  </div>
                  <p className="manager-explanation">Agrupamento por código do produto nas seis lojas. Os valores referem-se ao período selecionado, não à soma de snapshots acumulativos.</p>
                  <div className="manager-table-scroll">
                    <table className="manager-table">
                      <thead><tr><th>Produto</th><th>Setor</th><th>Lojas afetadas</th><th>Perda total</th></tr></thead>
                      <tbody>{analysis.topLossProducts.slice(0, 12).map((item) => (
                        <tr key={item.code}>
                          <th scope="row"><strong>{item.name}</strong><small>Código {item.code}</small></th>
                          <td>{item.sector}</td><td>{item.storeCount} de 6</td>
                          <td className="manager-negative">{money(item.lossValue)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {canSeeLosses && analysis.hotspots.length ? (
                <section className="manager-panel">
                  <div className="manager-panel-heading">
                    <h2><ShieldAlert size={18} /> Setores acima da meta de perdas</h2>
                    <span>Maiores diferenças teóricas</span>
                  </div>
                  <p className="manager-explanation">Diferença calculada entre a perda registrada e o valor correspondente à meta sobre as vendas do próprio setor. Não é economia garantida.</p>
                  <div className="manager-hotspots">
                    {analysis.hotspots.slice(0, 8).map((item) => (
                      <article key={`${item.code}-${item.sector}`}>
                        <span>Loja {item.code} · {item.sector}</span>
                        <strong>{percent(item.current)} <small>meta {percent(item.target)}</small></strong>
                        <em>Excesso teórico: {money(item.theoreticalExcess)}</em>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
