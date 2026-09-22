import { AlertTriangle, BrainCircuit, CheckCircle2, CircleDollarSign, LoaderCircle, MessageSquare, RefreshCw, Send, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import DataStatusBanner from '../components/DataStatusBanner'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import useAsyncData from '../hooks/useAsyncData'
import { askAiQuestion, requestAiAnalysis } from '../services/aiAnalysis'
import { getLatestLossRun } from '../services/losses'
import { money, percent, periodLabel } from '../utils/formatters'
import { buildAnalysisContext } from '../utils/analysisContext'

const SUGGESTIONS = [
  'Por que este setor merece atenção?',
  'Quais produtos devo investigar primeiro?',
  'Onde está concentrado o maior prejuízo?',
  'Compare o período atual com o anterior.',
]


function alertIcon(level) {
  if (level === 'alto') return <ShieldAlert size={19} />
  if (level === 'baixo') return <CheckCircle2 size={19} />
  return <AlertTriangle size={19} />
}

export default function AiAnalysisPage() {
  const { data, loading, refreshing, error, refresh } = useAsyncData(getLatestLossRun, [])
  const [selectedStore, setSelectedStore] = useState('033')
  const [analysis, setAnalysis] = useState(null)
  const [cached, setCached] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [question, setQuestion] = useState('')
  const [conversation, setConversation] = useState([])
  const [asking, setAsking] = useState(false)

  const rows = data?.rows || []
  const selectedRow = useMemo(() => rows.find((row) => String(row.store_code).padStart(3, '0') === selectedStore) || rows[0] || null, [rows, selectedStore])
  const context = useMemo(() => selectedRow ? buildAnalysisContext(selectedRow) : null, [selectedRow])

  async function analyze(force = false) {
    if (!context) return
    setAnalyzing(true)
    setAnalysisError('')
    try {
      const result = await requestAiAnalysis(context, { force })
      setAnalysis(result.analysis)
      setCached(Boolean(result.cached))
      setConversation([])
    } catch (requestError) {
      setAnalysisError(requestError.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function submitQuestion(event) {
    event.preventDefault()
    const value = question.trim()
    if (!value || !analysis || asking) return
    setAsking(true)
    setAnalysisError('')
    try {
      const result = await askAiQuestion(context, analysis, value)
      setConversation((items) => [...items, { question: value, answer: result.answer }])
      setQuestion('')
    } catch (requestError) {
      setAnalysisError(requestError.message)
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="page ai-analysis-page page-view-enter">
      <header className="ai-hero">
        <div><span className="ai-eyebrow"><Sparkles size={14} /> ANÁLISE INTELIGENTE</span><h1>Análise com IA Ainda em Desenvolvimento</h1><p>Entenda o desempenho da loja e encontre oportunidades com apoio da inteligência artificial.</p></div>
        <button type="button" className="refresh-button" onClick={refresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /><span>Atualizar dados</span></button>
      </header>

      {loading && !data ? <LoadingState /> : null}
      {!loading && error && !data ? <ErrorState error={error} onRetry={refresh} /> : null}
      {!loading && !error && !data ? <EmptyState message="Ainda não existe um período de perdas sincronizado para analisar." /> : null}

      {selectedRow && context ? <>
        <DataStatusBanner error={error} />
        <section className="ai-context-card" aria-label="Contexto da análise">
          <label><span>LOJA</span><select value={String(selectedRow.store_code).padStart(3, '0')} onChange={(event) => { setSelectedStore(event.target.value); setAnalysis(null); setConversation([]) }}>{rows.map((row) => <option key={row.store_code} value={String(row.store_code).padStart(3, '0')}>{row.store_name || `LOJA ${row.store_code}`}</option>)}</select></label>
          <div><span>PERÍODO</span><strong>{periodLabel(context.periodoAtual.inicio, context.periodoAtual.fim)}</strong></div>
          <div><span>COMPARATIVO</span><strong>{periodLabel(context.periodoComparativo.inicio, context.periodoComparativo.fim)}</strong></div>
          <button type="button" className="ai-analyze-button" onClick={() => analyze(false)} disabled={analyzing}>{analyzing ? <LoaderCircle className="spin" size={18} /> : <BrainCircuit size={18} />}{analyzing ? 'Analisando desempenho...' : analysis ? 'Atualizar análise com IA' : 'Analisar com IA'}</button>
        </section>

        <section className="ai-facts-grid" aria-label="Dados que serão analisados">
          <div><span>VENDAS NO PERÍODO</span><strong>{money(context.resumo.vendaTotal)}</strong></div>
          <div><span>PERDAS NO PERÍODO</span><strong>{money(context.resumo.perdaTotal)}</strong></div>
          <div><span>PERCENTUAL DE PERDA</span><strong>{percent(context.resumo.percentualPerda)}</strong></div>
          <div><span>PRODUTOS PRIORIZADOS</span><strong>{context.topPerdas.length}</strong></div>
        </section>

        {analyzing ? <section className="ai-loading-card"><LoaderCircle className="spin" size={24} /><div><strong>Analisando desempenho da loja...</strong><span>Consolidando vendas, verificando perdas e comparando setores.</span></div></section> : null}
        {analysisError ? <div className="ai-error" role="alert">{analysisError}</div> : null}

        {analysis ? <div className="ai-results">
          <section className="ai-summary-card"><div className="ai-section-title"><Sparkles size={18} /><div><span>RESUMO DA IA {cached ? '· ANÁLISE REUTILIZADA' : ''}</span><h2>O que está acontecendo</h2></div></div><p>{analysis.resumoExecutivo}</p><div className="ai-indicators"><span>{analysis.indicadores?.situacaoPerdas}</span><span>{analysis.indicadores?.variacaoVsAnterior}</span><span>{analysis.indicadores?.setoresAcimaMeta ?? 0} setores acima da meta</span></div></section>

          {analysis.alertas?.length ? <section><div className="ai-section-title"><AlertTriangle size={18} /><div><span>SINAIS RELEVANTES</span><h2>Alertas gerenciais</h2></div></div><div className="ai-alert-grid">{analysis.alertas.map((item, index) => <article key={`${item.titulo}-${index}`} className={`ai-alert ai-alert-${item.nivel || 'medio'}`}>{alertIcon(item.nivel)}<div><small>{item.nivel || 'atenção'}</small><strong>{item.titulo}</strong><p>{item.descricao}</p>{item.valor !== null && item.valor !== undefined ? <em>{money(item.valor)}</em> : null}</div></article>)}</div></section> : null}

          <section className="ai-two-column"><div className="ai-panel"><div className="ai-section-title"><TrendingUp size={18} /><div><span>ONDE AGIR PRIMEIRO</span><h2>Setores prioritários</h2></div></div>{analysis.setoresCriticos?.slice(0, 5).map((item, index) => <article className="ai-priority-row" key={`${item.setor}-${index}`}><b>{index + 1}</b><div><strong>{item.setor}</strong><p>{item.motivo}</p><span>{money(item.perda)} · {percent(item.percentual)} · meta {percent(item.meta)}</span></div></article>)}</div><div className="ai-panel"><div className="ai-section-title"><CircleDollarSign size={18} /><div><span>MAIOR IMPACTO</span><h2>Produtos para investigar</h2></div></div>{analysis.produtosCriticos?.slice(0, 5).map((item, index) => <article className="ai-product-row" key={`${item.codigo}-${index}`}><div><strong>{item.produto}</strong><span>{item.setor} · Cód. {item.codigo || '—'}</span><p>{item.motivoDestaque}</p></div><b>{money(item.valorPerda)}</b></article>)}</div></section>

          <section className="ai-two-column"><div className="ai-panel"><div className="ai-section-title"><CheckCircle2 size={18} /><div><span>PLANO DE AÇÃO</span><h2>Ações recomendadas</h2></div></div>{analysis.acoesRecomendadas?.slice(0, 5).map((item, index) => <article className="ai-action-row" key={`${item.acao}-${index}`}><b>{item.prioridade || index + 1}</b><div><strong>{item.acao}</strong><p>{item.justificativa}</p></div></article>)}</div><div className="ai-panel"><div className="ai-section-title"><MessageSquare size={18} /><div><span>PONTOS EM ABERTO</span><h2>O que investigar</h2></div></div><ul className="ai-investigate-list">{analysis.pontosParaInvestigar?.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div></section>

          <section className="ai-chat-panel"><div className="ai-section-title"><MessageSquare size={18} /><div><span>CONVERSA CONTEXTUAL</span><h2>Pergunte sobre os resultados</h2></div></div><div className="ai-suggestions">{SUGGESTIONS.map((item) => <button type="button" key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div>{conversation.map((item, index) => <div className="ai-message" key={index}><strong>{item.question}</strong><p>{item.answer}</p></div>)}<form onSubmit={submitQuestion}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pergunte sobre os resultados" aria-label="Pergunte sobre os resultados" /><button type="submit" disabled={!question.trim() || asking}>{asking ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}</button></form></section>
        </div> : null}
      </> : null}
    </div>
  )
}
