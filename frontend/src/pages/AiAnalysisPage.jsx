import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataStatusBanner from "../components/DataStatusBanner";
import PrintReportHeader from "../components/PrintReportHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import useAsyncData from "../hooks/useAsyncData";
import { askAiQuestion, requestAiAnalysis } from "../services/aiAnalysis";
import { getLatestLossRun } from "../services/losses";
import {
  getLatestEvents,
  getLatestMonthlySnapshot,
  getLatestSnapshot,
} from "../services/sales";
import { buildLossAnalysisContext } from "../utils/analysisContext";
import { LOSS_STORE_ORDER } from "../utils/losses";
import { money, percent, periodLabel } from "../utils/formatters";
import { buildSalesAnalysisContext } from "../utils/salesAnalysisContext";
import {
  ChartCard,
  KpiCard,
  SectorIcon,
  SimpleBarChart,
} from "../components/dashboard/DashboardPrimitives";
import { useAuth } from "../auth/AuthProvider";
import { canUseAnalysis } from "../auth/permissions";

const SUGGESTIONS = [
  "Quais indicadores merecem atenção primeiro?",
  "Quais setores devo investigar?",
  "Onde está concentrado o maior impacto financeiro?",
  "Compare o período atual com o anterior.",
];

const SALES_STORES = [
  { store_code: "307", store_name: "SUPERMERCADO PRIMOR 01 307" },
  { store_code: "212", store_name: "SUPERMERCADO PRIMOR 02 212" },
  { store_code: "600", store_name: "SUPERMERCADO PRIMOR 03 600" },
  { store_code: "120", store_name: "SUPERMERCADO PRIMOR 04 120" },
  { store_code: "033", store_name: "SUPERMERCADO PRIMOR 05 033" },
  { store_code: "018", store_name: "SUPERMERCADO PRIMOR 06 018" },
];

function alertIcon(level) {
  if (level === "alto") return <ShieldAlert size={19} />;
  if (level === "baixo") return <CheckCircle2 size={19} />;
  return <AlertTriangle size={19} />;
}

function AlertCards({ items, sales = false }) {
  if (!items?.length) return null;
  return (
    <section>
      <div className="ai-section-title">
        <AlertTriangle size={18} />
        <div>
          <span>{sales ? "SINAIS COMERCIAIS" : "SINAIS RELEVANTES"}</span>
          <h2>{sales ? "Alertas comerciais" : "Alertas gerenciais"}</h2>
        </div>
      </div>
      <div className="ai-alert-grid">
        {items.slice(0, 6).map((item, index) => (
          <article
            key={`${item.titulo}-${index}`}
            className={`ai-alert ai-alert-${item.nivel || "medio"}`}
          >
            {alertIcon(item.nivel)}
            <div>
              <small>
                {item.nivel || "atenção"}
                {item.setor ? ` · ${item.setor}` : ""}
              </small>
              <strong>{item.titulo}</strong>
              <p>{item.descricao}</p>
              {(item.valor ?? item.impactoFinanceiro) !== null &&
              (item.valor ?? item.impactoFinanceiro) !== undefined ? (
                <em>{money(item.valor ?? item.impactoFinanceiro)}</em>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LossResults({ analysis, context }) {
  const sectors = context?.setores || [];
  const consolidated = Number(context?.resumo?.perdaTotal || 0);
  const sectorTotal = sectors.reduce(
    (total, sector) => total + Number(sector.perda || 0),
    0,
  );
  const auditDifference = consolidated - sectorTotal;
  const potential = sectors.reduce(
    (total, sector) =>
      total +
      Math.max(
        0,
        Number(sector.perda || 0) -
          (Number(sector.venda || 0) * Number(sector.meta || 0)) / 100,
      ),
    0,
  );
  return (
    <>
      <section className="ai-summary-card">
        <div className="ai-section-title">
          <Sparkles size={18} />
          <div>
            <span>RESUMO DA IA</span>
            <h2>O que está acontecendo</h2>
          </div>
        </div>
        <p>{analysis.resumoExecutivo}</p>
        <div className="ai-indicators">
          <span>{analysis.indicadores?.situacaoPerdas}</span>
          <span>{analysis.indicadores?.variacaoVsAnterior}</span>
          <span>
            {analysis.indicadores?.setoresAcimaMeta ?? 0} setores acima da meta
          </span>
        </div>
      </section>
      <section className="ai-intelligence-grid">
        <ChartCard eyebrow="IMPACTO FINANCEIRO" title="Perda por setor" className="ai-standard-chart">
          <SimpleBarChart
            items={sectors
              .map((sector) => ({
                name: sector.setor,
                iconName: sector.setor,
                value: Number(sector.perda || 0),
              }))
              .sort((a, b) => b.value - a.value)}
            valueKey="value"
          />
        </ChartCard>
        <ChartCard eyebrow="AUDITORIA" title="Qualidade dos dados" className="ai-standard-chart">
          <div
            className={`ai-audit-card ${Math.abs(auditDifference) > 0.01 ? "has-difference" : ""}`}
          >
            <span>
              Total consolidado <strong>{money(consolidated)}</strong>
            </span>
            <span>
              Soma dos setores <strong>{money(sectorTotal)}</strong>
            </span>
            <span>
              Diferença <strong>{money(auditDifference)}</strong>
            </span>
          </div>
          <p className="ai-theoretical-note">
            Potencial teórico de redução: <strong>{money(potential)}</strong>.
            Estimativa teórica, não economia garantida.
          </p>
        </ChartCard>
      </section>
      <AlertCards items={analysis.alertas} />
      <section className="ai-two-column">
        <div className="ai-panel">
          <div className="ai-section-title">
            <TrendingDown size={18} />
            <div>
              <span>ONDE AGIR PRIMEIRO</span>
              <h2>Setores prioritários</h2>
            </div>
          </div>
          {analysis.setoresCriticos?.slice(0, 5).map((item, index) => (
            <article className="ai-priority-row" key={`${item.setor}-${index}`}>
              <b>{index + 1}</b>
              <div>
                <strong>
                  <SectorIcon name={item.setor} />
                  {item.setor}
                </strong>
                <p>{item.motivo}</p>
                <span>
                  {money(item.perda)} · {percent(item.percentual)} · meta{" "}
                  {percent(item.meta)}
                </span>
              </div>
            </article>
          ))}
        </div>
        <div className="ai-panel">
          <div className="ai-section-title">
            <CircleDollarSign size={18} />
            <div>
              <span>MAIOR IMPACTO</span>
              <h2>Produtos para investigar</h2>
            </div>
          </div>
          {analysis.produtosCriticos?.slice(0, 5).map((item, index) => (
            <article className="ai-product-row" key={`${item.codigo}-${index}`}>
              <div>
                <strong>{item.produto}</strong>
                <span>
                  {item.setor} · Cód. {item.codigo || "—"}
                </span>
                <p>{item.motivoDestaque}</p>
              </div>
              <b>{money(item.valorPerda)}</b>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SalesResults({ analysis, context }) {
  const sectors = context?.setores || [];
  const prioritySectors = [...sectors]
    .filter((sector) => Number(sector.diferenca || 0) !== 0)
    .sort(
      (a, b) =>
        Math.abs(Number(b.diferenca || 0)) -
        Math.abs(Number(a.diferenca || 0)),
    )
    .slice(0, 5);
  const sectorLookup = new Map(
    sectors.map((sector) => [String(sector.setor || "").toLocaleUpperCase("pt-BR"), sector]),
  );
  return (
    <>
      <section className="ai-summary-card ai-summary-sales">
        <div className="ai-section-title">
          <TrendingUp size={18} />
          <div>
            <span>RESUMO DAS VENDAS</span>
            <h2>O que está acontecendo</h2>
          </div>
        </div>
        <p>{analysis.resumoExecutivo}</p>
        <div className="ai-indicators">
          <span>{analysis.indicadores?.situacaoVendas}</span>
          <span>{analysis.indicadores?.variacaoVsAnterior}</span>
          <span>
            {analysis.indicadores?.setoresEmAlta ?? 0} setores em alta
          </span>
          <span>
            {analysis.indicadores?.setoresEmQueda ?? 0} setores em queda
          </span>
          <span>{analysis.indicadores?.setoresEstaveis ?? 0} estáveis</span>
        </div>
      </section>
      <section className="ai-intelligence-grid">
        <ChartCard eyebrow="IMPACTO FINANCEIRO" title="Vendas por setor" className="ai-standard-chart">
          <SimpleBarChart
            items={sectors
              .map((sector) => ({
                name: sector.setor,
                iconName: sector.setor,
                value: Number(sector.vendaAtual || 0),
                previous: Number(sector.vendaAnterior || 0),
              }))
              .sort((a, b) => b.value - a.value)}
            valueKey="value"
            compareKey="previous"
          />
        </ChartCard>
        <ChartCard eyebrow="VARIAÇÃO FINANCEIRA" title="Impacto por setor" className="ai-standard-chart">
          <SimpleBarChart
            items={sectors
              .map((sector) => ({
                name: sector.setor,
                iconName: sector.setor,
                value: Number(sector.diferenca || 0),
              }))
              .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))}
            valueKey="value"
            toneBySign
          />
        </ChartCard>
      </section>
      {analysis.destaquesPositivos?.length ? (
        <section>
          <div className="ai-section-title">
            <TrendingUp size={18} />
            <div>
              <span>DESTAQUES POSITIVOS</span>
              <h2>Onde houve avanço</h2>
            </div>
          </div>
          <div className="ai-alert-grid">
            {analysis.destaquesPositivos.slice(0, 6).map((item, index) => (
              <article
                key={`${item.setor}-${index}`}
                className="ai-alert ai-positive-card"
              >
                <TrendingUp size={19} />
                <div>
                  <small>{item.setor}</small>
                  <strong>{item.titulo}</strong>
                  <p>{item.descricao}</p>
                  {(() => {
                    const sector = sectorLookup.get(
                      String(item.setor || "").toLocaleUpperCase("pt-BR"),
                    );
                    return (
                      <em>
                        Atual {money(item.valorAtual)} · impacto {money(sector?.diferenca || 0)} · {percent(item.variacaoPercentual)}
                      </em>
                    );
                  })()}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <AlertCards items={analysis.alertas} sales />
      <section className="ai-two-column">
        <div className="ai-panel">
          <div className="ai-section-title">
            <TrendingUp size={18} />
            <div>
              <span>IMPACTO POR SETOR</span>
              <h2>Setores prioritários</h2>
            </div>
          </div>
          {prioritySectors.map((item, index) => {
            const difference = Number(item.diferenca || 0);
            return (
              <article
                className={`ai-priority-row ${difference < 0 ? "is-negative" : "is-positive"}`}
                key={`${item.setor}-${index}`}
              >
                <b>{index + 1}</b>
                <div>
                  <strong>
                    <SectorIcon name={item.setor} />
                    {item.setor}
                  </strong>
                  <p>
                    {difference < 0
                      ? "Impacto negativo relevante no resultado consolidado."
                      : "Contribuição positiva relevante para o resultado consolidado."}
                  </p>
                  <span>
                    Venda {money(item.vendaAtual)} · impacto {money(difference)} · {percent(item.variacaoPercentual)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
        <div className="ai-panel">
          <div className="ai-section-title">
            <Sparkles size={18} />
            <div>
              <span>OPORTUNIDADES</span>
              <h2>Onde avançar</h2>
            </div>
          </div>
          {analysis.oportunidades?.slice(0, 5).map((item, index) => (
            <article className="ai-action-row" key={`${item.titulo}-${index}`}>
              <b>{index + 1}</b>
              <div>
                <strong>{item.titulo}</strong>
                <p>{item.descricao}</p>
                <span>{item.impacto || "médio"} impacto</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function SharedResults({
  analysis,
  activeAnalysis,
  context,
  conversation,
  question,
  asking,
  onQuestionChange,
  onSuggestion,
  onSubmit,
}) {
  return (
    <div className="ai-results">
      {activeAnalysis === "sales" ? (
        <SalesResults analysis={analysis} context={context} />
      ) : (
        <LossResults analysis={analysis} context={context} />
      )}
      <section className="ai-two-column">
        <div className="ai-panel">
          <div className="ai-section-title">
            <CheckCircle2 size={18} />
            <div>
              <span>PLANO DE AÇÃO</span>
              <h2>Ações recomendadas</h2>
            </div>
          </div>
          {analysis.acoesRecomendadas?.slice(0, 5).map((item, index) => (
            <article className="ai-action-row" key={`${item.acao}-${index}`}>
              <b>{item.prioridade || index + 1}</b>
              <div>
                <strong>{item.acao}</strong>
                <p>{item.justificativa}</p>
                {item.setor ? <span>{item.setor}</span> : null}
              </div>
            </article>
          ))}
        </div>
        <div className="ai-panel">
          <div className="ai-section-title">
            <MessageSquare size={18} />
            <div>
              <span>PONTOS EM ABERTO</span>
              <h2>O que investigar</h2>
            </div>
          </div>
          <ul className="ai-investigate-list">
            {analysis.pontosParaInvestigar?.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
      <section className="ai-chat-panel">
        <div className="ai-section-title">
          <MessageSquare size={18} />
          <div>
            <span>CONVERSA CONTEXTUAL</span>
            <h2>Pergunte sobre os resultados</h2>
          </div>
        </div>
        <div className="ai-suggestions">
          {SUGGESTIONS.map((item) => (
            <button type="button" key={item} onClick={() => onSuggestion(item)}>
              {item}
            </button>
          ))}
        </div>
        {conversation.map((item, index) => (
          <div className="ai-message" key={index}>
            <strong>{item.question}</strong>
            <p>{item.answer}</p>
          </div>
        ))}
        <form onSubmit={onSubmit}>
          <input
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="Pergunte sobre os resultados"
            aria-label="Pergunte sobre os resultados"
          />
          <button
            type="submit"
            disabled={!question.trim() || asking}
            aria-label="Enviar pergunta"
          >
            {asking ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Send size={17} />
            )}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function AiAnalysisPage() {
  const { role } = useAuth();
  const allowsSales = canUseAnalysis(role, "sales");
  const allowsLosses = canUseAnalysis(role, "losses");
  const lossRequest = useAsyncData(
    () => (allowsLosses ? getLatestLossRun() : null),
    [allowsLosses],
  );
  const salesRequest = useAsyncData(async () => {
    if (!allowsSales) return null;
    const [monthly, daily, events] = await Promise.all([
      getLatestMonthlySnapshot(),
      getLatestSnapshot({ type: "DAILY", slug: "daily" }),
      getLatestEvents(),
    ]);
    return { monthly, daily, events };
  }, [allowsSales]);
  const [selectedStore, setSelectedStore] = useState("307");
  const [activeAnalysis, setActiveAnalysis] = useState("losses");
  const [lossAnalysis, setLossAnalysis] = useState(null);
  const [salesAnalysis, setSalesAnalysis] = useState(null);
  const [loadingLosses, setLoadingLosses] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [errorLosses, setErrorLosses] = useState("");
  const [errorSales, setErrorSales] = useState("");
  const [question, setQuestion] = useState("");
  const [conversations, setConversations] = useState({ losses: [], sales: [] });
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (allowsSales && !allowsLosses) setActiveAnalysis("sales");
    if (allowsLosses && !allowsSales) setActiveAnalysis("losses");
  }, [allowsLosses, allowsSales]);
  const rows = useMemo(() => {
    const source = lossRequest.data?.rows || [];
    return [...source].sort((a, b) => {
      const ai = LOSS_STORE_ORDER.indexOf(String(a?.store_code).padStart(3, "0"));
      const bi = LOSS_STORE_ORDER.indexOf(String(b?.store_code).padStart(3, "0"));
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
  }, [lossRequest.data]);
  const selectedRow = useMemo(
    () =>
      rows.find(
        (row) => String(row.store_code).padStart(3, "0") === selectedStore,
      ) ||
      rows[0] ||
      null,
    [rows, selectedStore],
  );
  const lossContext = useMemo(
    () => (selectedRow ? buildLossAnalysisContext(selectedRow) : null),
    [selectedRow],
  );
  const salesContext = useMemo(
    () =>
      salesRequest.data
        ? buildSalesAnalysisContext(salesRequest.data, selectedStore)
        : null,
    [salesRequest.data, selectedStore],
  );
  const storeOptions = rows.length ? rows : SALES_STORES;
  const analysis = activeAnalysis === "losses" ? lossAnalysis : salesAnalysis;
  const activeContext =
    activeAnalysis === "losses" ? lossContext : salesContext;
  const activeError = activeAnalysis === "losses" ? errorLosses : errorSales;
  const activeLoading =
    activeAnalysis === "losses" ? loadingLosses : loadingSales;
  const displayContext = activeContext || (allowsLosses ? lossContext : salesContext);
  const selectedStoreOption = storeOptions.find(
    (row) => String(row.store_code).padStart(3, "0") === selectedStore,
  );
  const printStoreCode = String(selectedStore || "").padStart(3, "0");
  const printStoreIndex = LOSS_STORE_ORDER.indexOf(printStoreCode);
  const printStoreSequence = String(printStoreIndex >= 0 ? printStoreIndex + 1 : 1).padStart(2, "0");
  const printStoreName =
    displayContext?.loja?.nome ||
    selectedStoreOption?.store_name ||
    `SUPERMERCADO PRIMOR ${printStoreSequence} ${printStoreCode}`;

  function refreshAll() {
    lossRequest.refresh();
    salesRequest.refresh();
  }

  async function analyze(type) {
    if (!canUseAnalysis(role, type)) return;
    const context = type === "losses" ? lossContext : salesContext;
    if (!context) return;
    setActiveAnalysis(type);
    if (type === "losses") {
      setLoadingLosses(true);
      setErrorLosses("");
    } else {
      setLoadingSales(true);
      setErrorSales("");
    }
    try {
      const result = await requestAiAnalysis(context, { analysisType: type });
      if (type === "losses") setLossAnalysis(result.analysis);
      else setSalesAnalysis(result.analysis);
      setConversations((current) => ({ ...current, [type]: [] }));
    } catch (requestError) {
      if (type === "losses") setErrorLosses(requestError.message);
      else setErrorSales(requestError.message);
    } finally {
      if (type === "losses") setLoadingLosses(false);
      else setLoadingSales(false);
    }
  }

  async function submitQuestion(event) {
    event.preventDefault();
    const value = question.trim();
    if (!value || !analysis || !activeContext || asking) return;
    setAsking(true);
    try {
      const result = await askAiQuestion(activeContext, analysis, value, {
        analysisType: activeAnalysis,
      });
      setConversations((current) => ({
        ...current,
        [activeAnalysis]: [
          ...current[activeAnalysis],
          { question: value, answer: result.answer },
        ],
      }));
      setQuestion("");
    } catch (requestError) {
      if (activeAnalysis === "losses") setErrorLosses(requestError.message);
      else setErrorSales(requestError.message);
    } finally {
      setAsking(false);
    }
  }

  const activeRequest = activeAnalysis === "losses" ? lossRequest : salesRequest;
  const loading = activeRequest.loading && !activeRequest.data;
  const hasData = Boolean(activeAnalysis === "losses" ? lossContext : salesContext);
  return (
    <div className="page ai-analysis-page page-view-enter">
      <header className="ai-compact-header">
        <div className="ai-compact-titlebar">
          <div>
            <span className="ai-eyebrow"><Sparkles size={13} /> ANÁLISE INTELIGENTE</span>
            <h1>Análise com IA</h1>
            <p>Diagnóstico gerencial de vendas e perdas com dados validados do painel.</p>
          </div>
        </div>
      </header>
      {loading ? <LoadingState /> : null}
      {!loading && activeRequest.error && !activeRequest.data ? (
        <ErrorState error={activeRequest.error} onRetry={refreshAll} />
      ) : null}
      {!loading && !activeRequest.error && !hasData ? (
        <EmptyState message={activeAnalysis === "losses" ? "Ainda não existe um período de perdas sincronizado para analisar." : "Ainda não existe um período de vendas sincronizado para analisar."} />
      ) : null}
      {hasData ? (
        <>
          <PrintReportHeader
            title={`Análise com IA — ${activeAnalysis === "losses" ? "Perdas" : "Vendas"}`}
            storeLabel={`Loja ${printStoreSequence} - ${printStoreCode}`}
            storeDetail={printStoreName}
            period={periodLabel(
              displayContext?.periodoAtual?.inicio,
              displayContext?.periodoAtual?.fim,
            )}
            comparison={`Comparativo: ${periodLabel(
              displayContext?.periodoComparativo?.inicio,
              displayContext?.periodoComparativo?.fim,
            )}`}
          />
          <DataStatusBanner error={lossRequest.error || salesRequest.error} />
          <section className="ai-context-card ai-context-compact" aria-label="Contexto da análise">
            <label className="ai-store-field">
              <span>LOJA</span>
              <select
                value={selectedStore}
                onChange={(event) => {
                  setSelectedStore(event.target.value);
                  setLossAnalysis(null);
                  setSalesAnalysis(null);
                  setConversations({ losses: [], sales: [] });
                }}
              >
                {storeOptions.map((row) => (
                  <option
                    key={row.store_code}
                    value={String(row.store_code).padStart(3, "0")}
                  >
                    {row.store_name || `LOJA ${row.store_code}`}
                  </option>
                ))}
              </select>
            </label>
            <div className="ai-period-field">
              <span>PERÍODO</span>
              <strong>
                {periodLabel(displayContext?.periodoAtual?.inicio, displayContext?.periodoAtual?.fim)}
              </strong>
            </div>
            <div className="ai-period-field">
              <span>COMPARATIVO</span>
              <strong>
                {periodLabel(displayContext?.periodoComparativo?.inicio, displayContext?.periodoComparativo?.fim)}
              </strong>
            </div>
            <div className="ai-mode-block">
              <span>MODO</span>
              <div className="ai-mode-switch" role="tablist" aria-label="Tipo de análise">
                {allowsSales ? <button
                  type="button"
                  className={activeAnalysis === "sales" ? "active sales" : ""}
                  aria-selected={activeAnalysis === "sales"}
                  onClick={() => setActiveAnalysis("sales")}
                >
                  <TrendingUp size={14} /> Vendas
                </button> : null}
                {allowsLosses ? <button
                  type="button"
                  className={activeAnalysis === "losses" ? "active losses" : ""}
                  aria-selected={activeAnalysis === "losses"}
                  onClick={() => setActiveAnalysis("losses")}
                >
                  <TrendingDown size={14} /> Perdas
                </button> : null}
              </div>
            </div>
            <button
              type="button"
              className={`ai-run-button ${activeAnalysis}`}
              onClick={() => analyze(activeAnalysis)}
              disabled={activeLoading || !activeContext}
            >
              {activeLoading ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
              {activeLoading ? "Analisando..." : "Atualizar análise"}
            </button>
          </section>
          <section
            className="kpi-grid ai-kpi-grid"
            aria-label="Dados que serão analisados"
          >
            {activeAnalysis === "losses" ? (
              <>
                <KpiCard
                  label="Vendas no período"
                  value={money(lossContext.resumo.vendaTotal)}
                  detail={null}
                  icon={CircleDollarSign}
                  tone="blue"
                />
                <KpiCard
                  label="Perdas no período"
                  value={money(lossContext.resumo.perdaTotal)}
                  detail={null}
                  icon={TrendingDown}
                  tone="red"
                />
                <KpiCard
                  label="Percentual de perda"
                  value={percent(lossContext.resumo.percentualPerda)}
                  detail={null}
                  icon={AlertTriangle}
                  tone="orange"
                />
                <KpiCard
                  label="Produtos priorizados"
                  value={String(lossContext.topPerdas.length)}
                  detail={null}
                  icon={ShieldAlert}
                  tone="purple"
                />
              </>
            ) : (
              <>
                <KpiCard
                  label="Vendas no período"
                  value={money(salesContext?.resumoVendas.vendaAtual)}
                  detail={null}
                  icon={CircleDollarSign}
                  tone="green"
                />
                <KpiCard
                  label="Vendas anteriores"
                  value={money(salesContext?.resumoVendas.vendaAnterior)}
                  detail={null}
                  icon={TrendingUp}
                  tone="slate"
                />
                <KpiCard
                  label="Diferença"
                  value={money(salesContext?.resumoVendas.diferenca)}
                  detail={null}
                  trend={salesContext?.resumoVendas.variacaoPercentual}
                  icon={TrendingUp}
                  tone="blue"
                />
                <KpiCard
                  label="Variação"
                  value={percent(salesContext?.resumoVendas.variacaoPercentual)}
                  detail={null}
                  trend={salesContext?.resumoVendas.variacaoPercentual}
                  icon={Sparkles}
                  tone="purple"
                />
              </>
            )}
          </section>
          {!analysis && !activeLoading && !activeError ? (
            <section className={`ai-ready-card ${activeAnalysis}`}>
              <span className="ai-ready-icon"><Sparkles size={18} /></span>
              <div>
                <strong>{activeAnalysis === "losses" ? "Análise de perdas pronta para iniciar" : "Análise de vendas pronta para iniciar"}</strong>
                <p>Loja {displayContext?.loja?.codigo || selectedStore} selecionada. Confira os indicadores acima e clique em <b>Atualizar análise</b>.</p>
              </div>
            </section>
          ) : null}
          {activeLoading ? (
            <section className="ai-loading-card">
              <LoaderCircle className="spin" size={24} />
              <div>
                <strong>
                  {activeAnalysis === "losses"
                    ? "Analisando perdas da loja..."
                    : "Analisando vendas da loja..."}
                </strong>
                <span>
                  {activeAnalysis === "losses"
                    ? "Consolidando perdas, setores e produtos prioritários."
                    : "Comparando faturamento, setores e evolução comercial."}
                </span>
              </div>
            </section>
          ) : null}
          {activeError ? (
            <div className="ai-error" role="alert">
              {activeError}
            </div>
          ) : null}
          {analysis ? (
            <SharedResults
              analysis={analysis}
              activeAnalysis={activeAnalysis}
              context={activeContext}
              conversation={conversations[activeAnalysis]}
              question={question}
              asking={asking}
              onQuestionChange={setQuestion}
              onSuggestion={setQuestion}
              onSubmit={submitQuestion}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
