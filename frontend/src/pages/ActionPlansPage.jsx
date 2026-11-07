import { ClipboardCheck, Plus, RefreshCw, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { EmptyState, LoadingState } from '../components/States'
import useAsyncData from '../hooks/useAsyncData'
import '../styles/management-intelligence.css'

const STORES = [
  ['307', '01 · 307'], ['212', '02 · 212'], ['600', '03 · 600'],
  ['120', '04 · 120'], ['033', '05 · 033'], ['018', '06 · 018'],
]
const STATUSES = [
  ['PENDENTE', 'Pendente'], ['EM_ANDAMENTO', 'Em andamento'],
  ['CONCLUIDO', 'Concluído'], ['CANCELADO', 'Cancelado'],
]
const empty = {
  store_code: '307', department: 'PERDAS', sector: '', product_code: '',
  title: '', description: '', owner_name: '', due_date: '',
  baseline_value: '', target_value: '',
}

function prefillFromRadar(params, department, isAdmin) {
  const requested = params.get('department')
  const selectedDepartment = isAdmin && ['VENDAS', 'PERDAS'].includes(requested) ? requested : department
  const store = String(params.get('store_code') || '').padStart(3, '0')
  const value = (name, max) => String(params.get(name) || '').trim().slice(0, max)
  const numeric = (name) => {
    const raw = value(name, 30)
    return raw !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0 ? raw : ''
  }
  return {
    ...empty,
    department: selectedDepartment,
    store_code: STORES.some(([code]) => code === store) ? store : '307',
    sector: value('sector', 80),
    title: value('title', 180),
    description: value('description', 2000),
    baseline_value: numeric('baseline_value'),
    target_value: numeric('target_value'),
  }
}

async function fetchPlans() {
  const { data, error } = await supabase.from('store_action_plans')
    .select('id,store_code,department,sector,product_code,title,description,owner_name,due_date,status,baseline_value,target_value,result_notes,created_at,updated_at')
    .order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return data || []
}

export default function ActionPlansPage() {
  const { role, user } = useAuth()
  const isAdmin = role === 'admin'
  const department = role === 'prevencao' ? 'PERDAS' : 'VENDAS'
  const [searchParams, setSearchParams] = useSearchParams()
  const suggested = useMemo(() => prefillFromRadar(searchParams, department, isAdmin), [searchParams, department, isAdmin])
  const [form, setForm] = useState(suggested)
  const [showForm, setShowForm] = useState(Boolean(searchParams.get('title')))
  useEffect(() => {
    if (!searchParams.get('title')) return
    setForm(suggested)
    setShowForm(true)
  }, [searchParams, suggested])
  const [storeFilter, setStoreFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const { data, loading, refreshing, error, refresh } = useAsyncData(fetchPlans, [])
  const records = useMemo(() => (data || []).filter((item) =>
    (!storeFilter || item.store_code === storeFilter) &&
    (!statusFilter || item.status === statusFilter)), [data, storeFilter, statusFilter])
  const pending = (data || []).filter((plan) => plan.status === 'PENDENTE').length
  const inProgress = (data || []).filter((plan) => plan.status === 'EM_ANDAMENTO').length
  const overdue = (data || []).filter((plan) =>
    plan.due_date && plan.due_date < new Date().toLocaleDateString('en-CA') &&
    !['CONCLUIDO', 'CANCELADO'].includes(plan.status)).length
  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  async function savePlan(event) {
    event.preventDefault()
    if (!user?.id || !form.title.trim() || form.title.trim().length < 5) {
      setMessage('Informe um título de pelo menos cinco caracteres.')
      return
    }
    setSaving(true)
    setMessage('')
    const payload = {
      ...form,
      department: isAdmin ? form.department : department,
      title: form.title.trim(),
      due_date: form.due_date || null,
      baseline_value: form.baseline_value === '' ? null : Number(form.baseline_value),
      target_value: form.target_value === '' ? null : Number(form.target_value),
      created_by: user.id,
    }
    const { error: writeError } = await supabase.from('store_action_plans').insert(payload)
    if (writeError) setMessage('Não foi possível registrar o plano: ' + writeError.message)
    else {
      setMessage('Plano de ação registrado.')
      setForm({ ...empty, department })
      setShowForm(false)
      if (searchParams.get('title')) setSearchParams({}, { replace: true })
      await refresh()
    }
    setSaving(false)
  }

  async function updatePlan(plan, status) {
    setSaving(true)
    const { error: writeError } = await supabase.from('store_action_plans')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', plan.id)
    if (writeError) setMessage('Falha ao atualizar: ' + writeError.message)
    else { setMessage('Situação atualizada.'); await refresh() }
    setSaving(false)
  }

  return (
    <div className="page page-tight manager-page page-view-enter">
      <header className="manager-header">
        <div>
          <span className="manager-eyebrow"><ClipboardCheck size={16} /> EXECUÇÃO OPERACIONAL <b className="feature-new-badge">NOVO</b></span>
          <h1>Planos de ação</h1>
          <p>Acompanhe medidas por loja, setor, responsável, prazo e resultado. Histórico separado por departamento.</p>
        </div>
        <button className="manager-refresh" type="button" onClick={() => setShowForm((current) => !current)}>
          <Plus size={16} /> {showForm ? 'Fechar formulário' : 'Novo plano'}
        </button>
      </header>
      {message ? <p className="manager-notice" role="status">{message}</p> : null}
      {showForm ? (
        <section className="manager-panel" style={{ padding: 20 }}>
          <h2>Registrar oportunidade de melhoria</h2>
          <form className="manager-action-form" onSubmit={savePlan}>
            <label>Loja
              <select required value={form.store_code} onChange={(event) => setValue('store_code', event.target.value)}>
                {STORES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <label>Departamento
              <select disabled={!isAdmin} value={isAdmin ? form.department : department} onChange={(event) => setValue('department', event.target.value)}>
                <option value="VENDAS">Vendas</option><option value="PERDAS">Perdas</option>
              </select>
            </label>
            <label>Setor<input maxLength={80} value={form.sector} onChange={(event) => setValue('sector', event.target.value)} placeholder="Ex.: PADARIA" /></label>
            <label>Código do produto<input maxLength={30} value={form.product_code} onChange={(event) => setValue('product_code', event.target.value)} placeholder="Opcional" /></label>
            <label className="manager-action-wide">Ação / problema
              <input required minLength={5} maxLength={180} value={form.title} onChange={(event) => setValue('title', event.target.value)} placeholder="Ex.: ajustar a produção de bolos" />
            </label>
            <label className="manager-action-wide">O que será realizado
              <textarea maxLength={2000} rows={3} value={form.description} onChange={(event) => setValue('description', event.target.value)} />
            </label>
            <label>Responsável<input maxLength={120} value={form.owner_name} onChange={(event) => setValue('owner_name', event.target.value)} /></label>
            <label>Prazo<input type="date" value={form.due_date} onChange={(event) => setValue('due_date', event.target.value)} /></label>
            <label>Valor inicial (R$)<input type="number" min="0" step="0.01" value={form.baseline_value} onChange={(event) => setValue('baseline_value', event.target.value)} /></label>
            <label>Meta em valor (R$)<input type="number" min="0" step="0.01" value={form.target_value} onChange={(event) => setValue('target_value', event.target.value)} /></label>
            <button type="submit" disabled={saving} className="manager-refresh"><Save size={16} /> {saving ? 'Salvando…' : 'Salvar plano'}</button>
          </form>
        </section>
      ) : null}
      {loading && !data ? <LoadingState /> : null}
      {error ? <p role="alert" className="manager-notice manager-notice--warning">Não foi possível consultar os planos. Verifique a conexão e as permissões.</p> : null}
      {data ? (
        <>
          <section className="manager-kpis">
            <article><small>Planos pendentes</small><strong>{pending}</strong><span>Aguardando início</span></article>
            <article><small>Em andamento</small><strong>{inProgress}</strong><span>Medidas sendo executadas</span></article>
            <article><small>Prazo vencido</small><strong>{overdue}</strong><span>Não concluídos no prazo</span></article>
          </section>
          <section className="manager-panel">
            <div className="manager-panel-heading"><h2>Histórico de ações</h2><button type="button" disabled={refreshing} className="manager-refresh" onClick={refresh}><RefreshCw size={15} /> Atualizar</button></div>
            <div className="manager-controls">
              <label className="manager-select">Loja
                <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
                  <option value="">Todas</option>{STORES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              </label>
              <label className="manager-select">Situação
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">Todas</option>{STATUSES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              </label>
            </div>
            {records.length ? (
              <div className="manager-table-scroll"><table className="manager-table">
                <thead><tr><th>Loja</th><th>Departamento / setor</th><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr></thead>
                <tbody>{records.map((plan) => <tr key={plan.id}>
                  <td>{plan.store_code}</td><td>{plan.department} · {plan.sector || 'Geral'}</td>
                  <th scope="row"><strong>{plan.title}</strong><small>{plan.description || '—'}</small></th>
                  <td>{plan.owner_name || '—'}</td><td>{plan.due_date || '—'}</td>
                  <td><select aria-label={`Situação de ${plan.title}`} disabled={saving} value={plan.status} onChange={(event) => updatePlan(plan, event.target.value)}>
                    {STATUSES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select></td>
                </tr>)}</tbody>
              </table></div>
            ) : <div className="manager-empty"><EmptyState message="Nenhum plano encontrado. Registre a primeira ação para acompanhar seus resultados." /></div>}
          </section>
        </>
      ) : null}
    </div>
  )
}
