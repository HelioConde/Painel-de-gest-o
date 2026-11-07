
import { ChartPie, ClipboardPlus, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState, EmptyState } from '../components/States'
import DataStatusBanner from '../components/DataStatusBanner'
import useAsyncData from '../hooks/useAsyncData'
import { getLatestLossRun } from '../services/losses'
import { money, periodLabel } from '../utils/formatters'
import { actionPlanLink, lossPareto } from '../utils/operationalInsights'
import '../styles/management-intelligence.css'
import '../styles/operational-insights.css'

const STORES = [['307','Loja 01'],['212','Loja 02'],['600','Loja 03'],['120','Loja 04'],['033','Loja 05'],['018','Loja 06']]
const DECIMAL = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const asPercent = (value) => DECIMAL.format(value) + '%'

export default function LossParetoPage() {
  const [store, setStore] = useState('')
  const [sector, setSector] = useState('')
  const [classification, setClassification] = useState('')
  const [term, setTerm] = useState('')
  const [showAll, setShowAll] = useState(false)
  const { data, loading, error, refreshing, refresh } = useAsyncData(() => getLatestLossRun(), [])

  const sectors = useMemo(() => [...new Set((data?.rows || [])
    .filter((row) => !store || String(row.store_code).padStart(3, '0') === store)
    .flatMap((row) => (row.details?.current?.sectors || []).map((sectorItem) => sectorItem.name)))].filter(Boolean).sort(), [data, store])
  const pareto = useMemo(() => lossPareto(data, { store, sector }), [data, store, sector])
  const available = pareto.products.filter((item) => (!classification || item.classification === classification) &&
    (!term || (item.code + ' ' + item.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .includes(term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim())))
  const visible = showAll ? available.slice(0, 200) : available.slice(0, 40)
  const topTenShare = pareto.total > 0 ? pareto.products.slice(0, 10).reduce((sum, item) => sum + item.value, 0) / pareto.total * 100 : 0

  function planLink(product) {
    return actionPlanLink({
      kind: 'PERDAS', storeCode: store, sector: sector || product.sectors[0] || '',
      title: 'Investigar perda do produto ' + product.code + ' — loja ' + store,
      description: 'Produto ' + product.name + '. Perdas de ' + data.current_start + ' a ' + data.current_end
        + '. Valor: ' + money(product.value) + '. Classificação ABC: ' + product.classification
        + '. O percentual representa produtos válidos no recorte selecionado.',
      current: product.value,
    })
  }

  return (
    <div className="page page-tight manager-page page-view-enter">
      <header className="manager-header">
        <div>
          <span className="manager-eyebrow"><ChartPie size={17} /> PREVENÇÃO DE PERDAS <b className="feature-new-badge">NOVO</b></span>
          <h1>Curva ABC e Pareto de perdas</h1>
          <p>Priorize os produtos com maior impacto financeiro e investigue o que concentra as perdas.</p>
        </div>
        <button type="button" className="manager-refresh" disabled={refreshing} onClick={refresh}><RefreshCw size={16} /> Atualizar</button>
      </header>
      {loading && !data ? <LoadingState /> : null}
      {error ? <DataStatusBanner error={error} /> : null}
      {data ? (
        <>
          <div className="manager-source"><ChartPie size={18}/><span><strong>Competência {periodLabel(data.current_start, data.current_end)}</strong>
            <small>{data.complete ? '6 lojas presentes' : 'Competência parcial'} · última coleta disponível, sem somar snapshots acumulados</small>
          </span></div>
          {!data.complete || data.rows.some((row) => row.quality?.status !== 'PASS') ?
            <p className="manager-notice manager-notice--warning" role="alert">Atenção: há lojas ou verificações de qualidade pendentes. Os resultados representam somente os registros disponíveis e podem não representar toda a rede.</p> : null}
          <section className="manager-panel">
            <div className="manager-panel-heading"><h2>Escopo da análise</h2><span>Os percentuais são recalculados em cada filtro</span></div>
            <div className="manager-controls">
              <label className="manager-select">Loja<select value={store} onChange={(event) => { setStore(event.target.value); setSector(''); setShowAll(false) }}>
                <option value="">Todas as lojas</option>{STORES.map(([code, name]) => <option key={code} value={code}>{name} · {code}</option>)}
              </select></label>
              <label className="manager-select">Setor<select value={sector} onChange={(event) => { setSector(event.target.value); setShowAll(false) }}>
                <option value="">Todos os setores</option>{sectors.map((name) => <option key={name} value={name}>{name}</option>)}
              </select></label>
              <label className="manager-select">Classe<select value={classification} onChange={(event) => { setClassification(event.target.value); setShowAll(false) }}>
                <option value="">Todas</option><option value="A">A · concentração principal</option>
                <option value="B">B · intermediários</option><option value="C">C · demais</option>
              </select></label>
              <label className="manager-search"><input aria-label="Buscar produto por código ou nome" type="search" placeholder="Código ou produto" value={term} onChange={(event) => setTerm(event.target.value)} /></label>
            </div>
            <p className="manager-explanation">Classe A até atingir 80% do valor acumulado, classe B até 95% e C os demais. O produto que atravessa o limite pertence à classe anterior. O denominador considera somente produtos válidos com perdas positivas no filtro de loja e setor.</p>
          </section>
          <section className="manager-kpis">
            <article><small>Perdas dos produtos válidos</small><strong>{money(pareto.total)}</strong><span>{pareto.count} produtos · {pareto.storeCount} loja(s)</span></article>
            <article><small>Classe A</small><strong>{pareto.classes.A.count} produtos</strong><span>{asPercent(pareto.classes.A.share)} do valor</span></article>
            <article><small>Classe B</small><strong>{pareto.classes.B.count} produtos</strong><span>{asPercent(pareto.classes.B.share)} do valor</span></article>
            <article><small>Classe C</small><strong>{pareto.classes.C.count} produtos</strong><span>{asPercent(pareto.classes.C.share)} do valor</span></article>
            <article><small>Participação dos 10 maiores</small><strong>{asPercent(topTenShare)}</strong><span>Concentração financeira no recorte</span></article>
          </section>
          <section className="manager-panel">
            <div className="manager-panel-heading"><h2>Distribuição ABC <b className="feature-new-badge">NOVO</b></h2><span>Participação do valor, não da quantidade</span></div>
            <div className="pareto-stack" role="img" aria-label={'A: ' + asPercent(pareto.classes.A.share) + ', B: ' + asPercent(pareto.classes.B.share) + ', C: ' + asPercent(pareto.classes.C.share)}>
              {['A','B','C'].map((name) => <div key={name} className={'pareto-stack-' + name} style={{ width: pareto.classes[name].share + '%' }} title={name + ': ' + asPercent(pareto.classes[name].share)} />)}
            </div>
            <div className="pareto-legend">{['A','B','C'].map((name) => <span key={name}><b className={'pareto-dot pareto-dot-' + name}/>{name}: {asPercent(pareto.classes[name].share)} ({pareto.classes[name].count} produtos)</span>)}</div>
          </section>
          <section className="manager-panel">
            <div className="manager-panel-heading"><h2>Produtos por importância financeira</h2><span>{available.length} resultados após filtros · ordem por valor perdido</span></div>
            {visible.length ? <div className="manager-table-scroll"><table className="manager-table">
              <thead><tr><th>Posição</th><th>Produto</th><th>Setor(es)</th><th>Lojas</th><th>Valor perdido</th><th>% do total</th><th>% acumulado</th><th>ABC</th><th>Ação</th></tr></thead>
              <tbody>{visible.map((row) => (
                <tr key={row.code}>
                  <td>{pareto.products.indexOf(row) + 1}</td>
                  <th scope="row"><strong>{row.name}</strong><small>Código {row.code}</small></th>
                  <td>{row.sectors.join(', ')}</td><td>{row.storeCount}</td>
                  <td className="manager-negative">{money(row.value)}</td><td>{asPercent(row.share)}</td>
                  <td><div className="insight-meter"><span style={{ width: row.cumulative + '%' }} /></div>{asPercent(row.cumulative)}</td>
                  <td><strong className={'pareto-class pareto-class-' + row.classification}>{row.classification}</strong></td>
                  <td>{store ? <Link className="manager-small-button insight-action" to={planLink(row)}><ClipboardPlus size={14} /> Plano</Link> : 'Selecione uma loja'}</td>
                </tr>
              ))}</tbody>
            </table>
            {!showAll && available.length > 40 ? <button type="button" className="manager-small-button" onClick={() => setShowAll(true)}>Ver mais resultados (até 200)</button> : null}
            </div> : <p className="manager-empty">Não há perdas válidas no recorte selecionado.</p>}
          </section>
          <p className="manager-explanation">A Curva ABC é uma classificação de concentração de custos, não uma medida de causa, desperdício evitável ou margem. Investigue os produtos de maior impacto antes de definir ações.</p>
        </>
      ) : !loading && !error ? <EmptyState message="Sem competência de perdas disponível." /> : null}
    </div>
  )
}
