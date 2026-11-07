import { History, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { EmptyState, LoadingState } from '../components/States'
import useAsyncData from '../hooks/useAsyncData'
import { money, periodLabel } from '../utils/formatters'
import '../styles/management-intelligence.css'

const STORE_NAMES = {
  '307': 'Loja 01', '212': 'Loja 02', '600': 'Loja 03',
  '120': 'Loja 04', '033': 'Loja 05', '018': 'Loja 06',
}

async function getProductHistory({ term, storeCode }) {
  if (!term.trim()) return []
  let query = supabase.from('loss_product_monthly_history')
    .select('month_start,current_start,current_end,store_code,sector,product_code,product_name,loss_value,loss_quantity')
    .order('month_start', { ascending: false })
    .order('loss_value', { ascending: false })
    .limit(400)
  if (storeCode) query = query.eq('store_code', storeCode)
  if (term) {
    // Higieniza os operadores embutidos na sintaxe .or() do PostgREST.
    const safe = term.normalize('NFC').replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 70)
    if (safe) query = query.or(`product_code.ilike.%${safe}%,product_name.ilike.%${safe}%`)
  }
  const { data, error } = await query
  if (error) throw error
  return data || []
}

function aggregateByProduct(rows) {
  const group = new Map()
  for (const row of rows) {
    const key = row.product_code
    const existing = group.get(key) || { code: key, name: row.product_name, months: new Set(), stores: new Set(), total: 0, records: [] }
    existing.months.add(row.month_start)
    existing.stores.add(row.store_code)
    existing.total += Number(row.loss_value) || 0
    existing.records.push(row)
    group.set(key, existing)
  }
  return [...group.values()].map(({ months, stores, ...value }) => ({
    ...value, monthCount: months.size, storeCount: stores.size,
  })).sort((a, b) => b.total - a.total)
}

export default function ProductLossHistoryPage() {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [storeCode, setStoreCode] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const { data, loading, refreshing, error, refresh } = useAsyncData(
    () => getProductHistory({ term: search, storeCode }), [search, storeCode],
  )
  const products = useMemo(() => aggregateByProduct(data || []), [data])
  const selected = products.find((item) => item.code === selectedProduct) || products[0]
  const rows = selected ? [...selected.records].sort((a, b) => b.month_start.localeCompare(a.month_start) || a.store_code.localeCompare(b.store_code)) : []
  const display = showAll ? products : products.slice(0, 25)
  return (
    <div className="page page-tight manager-page page-view-enter">
      <header className="manager-header">
        <div>
          <span className="manager-eyebrow"><History size={16} /> EVOLUÇÃO HISTÓRICA <b className="feature-new-badge">NOVO</b></span>
          <h1>Histórico de perdas por produto</h1>
          <p>Pesquise produtos e acompanhe perdas por mês e loja, sem duplicar coletas acumulativas.</p>
        </div>
        <button className="manager-refresh" type="button" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </header>
      <section className="manager-panel">
        <div className="manager-panel-heading"><h2>Pesquisar e comparar</h2><span>Até 400 registros por consulta</span></div>
        <form className="manager-controls" onSubmit={(event) => { event.preventDefault(); setSearch(input.trim()); setSelectedProduct(null) }}>
          <label className="manager-search">
            <Search size={17} />
            <input type="search" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Código ou nome do produto" aria-label="Buscar produto" />
          </label>
          <label className="manager-select">
            Loja <select value={storeCode} onChange={(event) => { setStoreCode(event.target.value); setSelectedProduct(null) }}>
              <option value="">Todas as lojas</option>
              {Object.entries(STORE_NAMES).map(([code, label]) => <option key={code} value={code}>{label} · {code}</option>)}
            </select>
          </label>
          <button type="submit" className="manager-refresh">Buscar</button>
        </form>
        <p className="manager-explanation">Cada competência usa o último relatório aprovado por loja. Meses ainda em andamento são parciais. A soma de meses distintos é histórica e não representa perda de um único mês.</p>
      </section>
      {loading && !data ? <LoadingState /> : null}
      {error ? <p className="manager-notice manager-notice--warning" role="alert">Não foi possível consultar o histórico. Confira a conexão e o acesso ao módulo de perdas.</p> : null}
      {data ? (
        <>
          <section className="manager-panel">
            <div className="manager-panel-heading"><h2>Produtos encontrados <b className="feature-new-badge">NOVO</b></h2><span>{products.length} produtos · classificação por perda acumulada das competências retornadas</span></div>
            {products.length ? (
              <div className="manager-table-scroll">
                <table className="manager-table">
                  <thead><tr><th>Produto</th><th>Meses presentes</th><th>Lojas presentes</th><th>Total histórico consultado</th><th>Detalhes</th></tr></thead>
                  <tbody>{display.map((item) => (
                    <tr key={item.code}>
                      <th scope="row"><strong>{item.name}</strong><small>Cód. {item.code}</small></th>
                      <td>{item.monthCount}</td><td>{item.storeCount}</td>
                      <td className="manager-negative">{money(item.total)}</td>
                      <td><button type="button" className="manager-small-button" onClick={() => { setSelectedProduct(item.code); setShowAll(false) }}>Ver lojas e meses</button></td>
                    </tr>
                  ))}</tbody>
                </table>
                {!showAll && products.length > 25 ? <button type="button" className="manager-small-button" onClick={() => setShowAll(true)}>Mostrar mais produtos</button> : null}
              </div>
            ) : <div className="manager-empty"><EmptyState message="Digite um nome ou código e clique em Buscar para consultar o histórico do produto." /></div>}
          </section>
          {selected ? (
            <section className="manager-panel">
              <div className="manager-panel-heading"><h2>{selected.name} · {selected.code}</h2><span>Competência e loja</span></div>
              <div className="manager-table-scroll">
                <table className="manager-table">
                  <thead><tr><th>Mês</th><th>Período incluído</th><th>Loja</th><th>Setor</th><th>Quantidade perdida</th><th>Valor da perda</th></tr></thead>
                  <tbody>{rows.map((row, index) => (
                    <tr key={`${row.month_start}-${row.store_code}-${row.sector}-${index}`}>
                      <td>{row.month_start.slice(0, 7)}</td>
                      <td>{periodLabel(row.current_start, row.current_end)}</td>
                      <td>{STORE_NAMES[row.store_code] || row.store_code}</td>
                      <td>{row.sector}</td>
                      <td>{Number(row.loss_quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                      <td className="manager-negative">{money(Number(row.loss_value))}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
