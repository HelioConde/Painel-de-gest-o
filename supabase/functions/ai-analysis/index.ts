import {
  corsHeaders,
  authorizeAiRequest,
  errorCode,
  generateGeminiContent,
  hasValidContext,
  jsonResponse,
  sanitizeForAi,
} from '../_shared/ai.ts'

const LOSSES_SCHEMA = `{
  "resumoExecutivo": "string",
  "indicadores": { "situacaoPerdas": "string", "variacaoVsAnterior": "string", "setoresAcimaMeta": 0 },
  "alertas": [{ "nivel": "baixo|medio|alto", "titulo": "string", "descricao": "string", "valor": 0 }],
  "setoresCriticos": [{ "setor": "string", "motivo": "string", "perda": 0, "percentual": 0, "meta": 0 }],
  "produtosCriticos": [{ "produto": "string", "setor": "string", "codigo": "string", "motivoDestaque": "string", "valorPerda": 0 }],
  "acoesRecomendadas": [{ "prioridade": 1, "acao": "string", "justificativa": "string" }],
  "pontosParaInvestigar": ["string"]
}`

const SALES_SCHEMA = `{
  "resumoExecutivo": "string",
  "indicadores": { "situacaoVendas": "string", "variacaoVsAnterior": "string", "setoresEmAlta": 0, "setoresEmQueda": 0, "setoresEstaveis": 0 },
  "destaquesPositivos": [{ "setor": "string", "titulo": "string", "descricao": "string", "valorAtual": 0, "variacaoPercentual": 0 }],
  "alertas": [{ "nivel": "baixo|medio|alto", "setor": "string|null", "titulo": "string", "descricao": "string", "impactoFinanceiro": 0 }],
  "setoresPrioritarios": [{ "setor": "string", "motivo": "string", "vendaAtual": 0, "vendaAnterior": 0, "diferenca": 0, "variacaoPercentual": 0 }],
  "oportunidades": [{ "titulo": "string", "descricao": "string", "impacto": "alto|medio|baixo" }],
  "acoesRecomendadas": [{ "prioridade": 1, "acao": "string", "justificativa": "string", "setor": "string|null" }],
  "pontosParaInvestigar": ["string"]
}`

const BASE_INSTRUCTION = `Você é um analista gerencial para supermercados. Use exclusivamente os dados recebidos como fonte oficial. Não invente números, produtos, setores ou causas. Diferencie fatos, hipóteses e recomendações. Quando a causa não puder ser determinada pelos dados, diga explicitamente que ela precisa ser investigada. Escreva em português do Brasil, com tom objetivo e acionável. Retorne exclusivamente JSON válido, sem markdown.`

const LOSSES_INSTRUCTION = `Analise perdas operacionais e financeiras. Priorize maior valor financeiro perdido, maior percentual de perda, setores acima da meta, pior evolução versus período anterior, concentração em poucos produtos, produtos com perda desproporcional e oportunidades de redução. Não recalcule perdas. Não atribua causas como validade, refrigeração, equipamento, armazenamento ou erro humano sem evidência; trate-as somente como hipótese de investigação.`

const SALES_INSTRUCTION = `Analise desempenho comercial. Identifique crescimento ou queda total, setores que contribuíram para alta e baixa, impacto financeiro absoluto, participação no faturamento, variações percentuais de baixo impacto e oportunidades comerciais. Uma variação percentual alta em setor pequeno não é automaticamente mais importante que uma variação financeira relevante. Não afirme que promoção, ruptura, preço, estoque ou concorrência causaram uma variação sem evidência; use "os dados indicam" ou "vale investigar se".`

const toNumber = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function buildFallbackAnalysis(context: Record<string, any>) {
  const resumo = context.resumo || {}
  const sectors = Array.isArray(context.setores) ? context.setores : []
  const products = Array.isArray(context.topPerdas) ? context.topPerdas : []
  const criticalSectors = [...sectors]
    .sort((left, right) => toNumber(right.perda) - toNumber(left.perda))
    .slice(0, 5)
  const criticalProducts = [...products]
    .sort((left, right) => toNumber(right.valorPerda) - toNumber(left.valorPerda))
    .slice(0, 5)
  const lossTotal = toNumber(resumo.perdaTotal)
  const lossPercent = toNumber(resumo.percentualPerda)

  return {
    resumoExecutivo: `A análise automática identificou perdas de ${lossTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, equivalentes a ${lossPercent.toFixed(2)}% das vendas do período. Priorize os setores e produtos com maior impacto financeiro listados abaixo.`,
    indicadores: {
      situacaoPerdas: `${lossPercent.toFixed(2)}% de perdas sobre as vendas.`,
      variacaoVsAnterior: 'Comparativo detalhado indisponível na análise de contingência.',
      setoresAcimaMeta: criticalSectors.filter((sector) => toNumber(sector.percentualPerda) > toNumber(sector.meta)).length,
    },
    alertas: criticalSectors.slice(0, 3).map((sector) => ({
      nivel: 'medio',
      titulo: sector.setor || 'Setor sem identificação',
      descricao: `Perda de ${toNumber(sector.perda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no período.`,
      valor: toNumber(sector.perda),
    })),
    setoresCriticos: criticalSectors.map((sector) => ({
      setor: sector.setor || 'Setor sem identificação',
      motivo: 'Setor priorizado pelo maior valor absoluto de perdas.',
      perda: toNumber(sector.perda),
      percentual: toNumber(sector.percentualPerda),
      meta: toNumber(sector.meta),
    })),
    produtosCriticos: criticalProducts.map((product) => ({
      produto: product.produto || 'Produto sem identificação',
      setor: product.setor || 'Sem setor',
      codigo: product.codigo || '',
      motivoDestaque: 'Produto priorizado pelo valor de perda no período.',
      valorPerda: toNumber(product.valorPerda),
    })),
    acoesRecomendadas: [
      { prioridade: 1, acao: 'Conferir os produtos com maior valor de perda.', justificativa: 'Eles concentram o maior impacto financeiro do período.' },
      { prioridade: 2, acao: 'Validar processos dos setores prioritários.', justificativa: 'A concentração de perdas indica pontos operacionais para investigação.' },
      { prioridade: 3, acao: 'Acompanhar a evolução diária das perdas.', justificativa: 'O monitoramento recorrente ajuda a confirmar se as ações reduziram o impacto.' },
    ],
    pontosParaInvestigar: [
      'Divergências de inventário e recebimento nos setores prioritários.',
      'Validade, armazenamento e exposição dos produtos com maior perda.',
      'Registros de avaria, descarte e quebra operacional.',
    ],
  }
}

function buildSalesFallbackAnalysis(context: Record<string, any>) {
  const resumo = context.resumoVendas || {}
  const sectors = Array.isArray(context.setores) ? context.setores : []
  const ordered = [...sectors].sort((left, right) => toNumber(right.diferenca) - toNumber(left.diferenca))
  const positives = ordered.filter((sector) => toNumber(sector.diferenca) > 0).slice(0, 5)
  const negatives = [...ordered].reverse().filter((sector) => toNumber(sector.diferenca) < 0).slice(0, 5)
  const current = toNumber(resumo.vendaAtual)
  const previous = toNumber(resumo.vendaAnterior)
  const difference = toNumber(resumo.diferenca)
  const variation = toNumber(resumo.variacaoPercentual)

  return {
    resumoExecutivo: `As vendas do período totalizaram ${current.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, com variação de ${variation.toFixed(2)}% frente ao período comparativo. A leitura prioriza o impacto financeiro por setor disponível no painel.`,
    indicadores: {
      situacaoVendas: difference >= 0 ? 'Crescimento no período comparativo.' : 'Queda no período comparativo.',
      variacaoVsAnterior: `${variation.toFixed(2)}% (${difference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) frente a ${previous.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
      setoresEmAlta: positives.length,
      setoresEmQueda: negatives.length,
      setoresEstaveis: toNumber(context.contagemSetores?.estaveis),
    },
    destaquesPositivos: positives.slice(0, 3).map((sector) => ({
      setor: sector.setor || 'Setor sem identificação',
      titulo: 'Maior contribuição positiva',
      descricao: 'Setor priorizado pela contribuição financeira positiva frente ao período anterior.',
      valorAtual: toNumber(sector.vendaAtual),
      variacaoPercentual: toNumber(sector.variacaoPercentual),
    })),
    alertas: negatives.slice(0, 3).map((sector) => ({
      nivel: 'medio',
      setor: sector.setor || null,
      titulo: 'Queda a investigar',
      descricao: 'Setor com redução financeira frente ao período anterior. A causa precisa ser investigada com dados operacionais adicionais.',
      impactoFinanceiro: Math.abs(toNumber(sector.diferenca)),
    })),
    setoresPrioritarios: [...positives, ...negatives].slice(0, 5).map((sector) => ({
      setor: sector.setor || 'Setor sem identificação',
      motivo: 'Priorizado pelo impacto financeiro da variação no período.',
      vendaAtual: toNumber(sector.vendaAtual),
      vendaAnterior: toNumber(sector.vendaAnterior),
      diferenca: toNumber(sector.diferenca),
      variacaoPercentual: toNumber(sector.variacaoPercentual),
    })),
    oportunidades: positives.slice(0, 3).map((sector) => ({
      titulo: `Acompanhar ${sector.setor || 'setor'}`,
      descricao: 'O resultado positivo merece acompanhamento para verificar se a evolução se sustenta nos próximos períodos.',
      impacto: 'medio',
    })),
    acoesRecomendadas: [
      { prioridade: 1, acao: 'Acompanhar os setores com maior impacto financeiro.', justificativa: 'Eles têm maior potencial de alterar o resultado consolidado.', setor: null },
      { prioridade: 2, acao: 'Investigar setores com queda relevante.', justificativa: 'Os dados mostram a queda, mas não determinam sua causa.', setor: negatives[0]?.setor || null },
      { prioridade: 3, acao: 'Comparar a evolução nas próximas coletas.', justificativa: 'A consistência do movimento confirma se há tendência comercial.', setor: null },
    ],
    pontosParaInvestigar: [
      'Disponibilidade, preço e execução comercial dos setores com queda.',
      'Sustentação dos setores com maior contribuição positiva.',
      'Participação dos principais setores no faturamento da loja.',
    ],
  }
}

function sectorKey(value: unknown) {
  return String(value || '').trim().toLocaleUpperCase('pt-BR')
}

function enforceSalesRanking(analysis: any, context: Record<string, any>) {
  const sectors = (Array.isArray(context.setores) ? context.setores : [])
    .filter((sector) => sector?.setor)
    .sort((left, right) => Math.abs(toNumber(right.diferenca)) - Math.abs(toNumber(left.diferenca)))
  const bySector = new Map(sectors.map((sector) => [sectorKey(sector.setor), sector]))
  const generated = new Map((analysis.setoresPrioritarios || []).map((sector: any) => [sectorKey(sector.setor), sector]))
  const counts = context.contagemSetores || {}

  analysis.indicadores = {
    ...(analysis.indicadores || {}),
    setoresEmAlta: toNumber(counts.emAlta),
    setoresEmQueda: toNumber(counts.emQueda),
    setoresEstaveis: toNumber(counts.estaveis),
  }
  analysis.setoresPrioritarios = sectors.slice(0, 5).map((sector) => {
    const generatedSector = generated.get(sectorKey(sector.setor)) || {}
    return {
      ...generatedSector,
      setor: sector.setor,
      motivo: generatedSector.motivo || 'Setor priorizado pelo impacto financeiro absoluto da diferença.',
      vendaAtual: toNumber(sector.vendaAtual),
      vendaAnterior: toNumber(sector.vendaAnterior),
      diferenca: toNumber(sector.diferenca),
      variacaoPercentual: toNumber(sector.variacaoPercentual),
    }
  })
  analysis.destaquesPositivos = [...(analysis.destaquesPositivos || [])]
    .filter((item: any) => toNumber(bySector.get(sectorKey(item.setor))?.diferenca) > 0)
    .map((item: any) => ({
      ...item,
      valorAtual: toNumber(bySector.get(sectorKey(item.setor))?.vendaAtual),
      variacaoPercentual: toNumber(bySector.get(sectorKey(item.setor))?.variacaoPercentual),
    }))
    .sort((left: any, right: any) => toNumber(bySector.get(sectorKey(right.setor))?.diferenca) - toNumber(bySector.get(sectorKey(left.setor))?.diferenca))
  analysis.alertas = [...(analysis.alertas || [])]
    .sort((left: any, right: any) => {
      const leftDifference = toNumber(bySector.get(sectorKey(left.setor))?.diferenca)
      const rightDifference = toNumber(bySector.get(sectorKey(right.setor))?.diferenca)
      return Math.abs(Math.min(rightDifference, 0)) - Math.abs(Math.min(leftDifference, 0))
    })

  return analysis
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) })
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { success: false, error: 'INVALID_CONTEXT' }, 405)
  }

  try {
    const body = await request.json()
    const analysisType = body?.analysisType === 'sales' ? 'sales' : 'losses'
    const { context } = body
    const authorization = await authorizeAiRequest(request, analysisType)
    if (!authorization.allowed) return jsonResponse(request, authorization.body, authorization.status)
    console.log('[AI] analysisType recebido:', analysisType)
    console.log('[AI] context keys:', Object.keys(context || {}))
    console.log('[AI] context recebido:', JSON.stringify(context).slice(0, 10000))
    if (!hasValidContext(context)) {
      return jsonResponse(request, { success: false, error: 'INVALID_CONTEXT' }, 400)
    }

    if (analysisType === 'sales' && (!context.resumoVendas || !Array.isArray(context.setores))) {
      return jsonResponse(request, {
        success: false,
        error: 'INVALID_SALES_CONTEXT',
        message: 'O contexto de vendas está incompleto.',
      }, 400)
    }

    if (analysisType === 'losses' && (!context.resumo || !Array.isArray(context.setores))) {
      return jsonResponse(request, {
        success: false,
        error: 'INVALID_LOSSES_CONTEXT',
        message: 'O contexto de perdas está incompleto.',
      }, 400)
    }

    const safeContext = sanitizeForAi(context)
    const specificInstruction = analysisType === 'sales' ? SALES_INSTRUCTION : LOSSES_INSTRUCTION
    const schema = analysisType === 'sales' ? SALES_SCHEMA : LOSSES_SCHEMA
    const prompt = `${BASE_INSTRUCTION}\n\n${specificInstruction}\n\nSiga exatamente este formato JSON:\n${schema}\n\nDados consolidados:\n${JSON.stringify(safeContext)}`
    let generated
    try {
      generated = await generateGeminiContent(prompt, 'application/json')
    } catch (error) {
      if (['GEMINI_UNAVAILABLE', 'GEMINI_QUOTA'].includes(errorCode(error))) {
        console.warn('[ai-analysis] Gemini unavailable or rate limited; returning contingency analysis')
        return jsonResponse(request, {
          success: true,
          analysis: analysisType === 'sales'
            ? buildSalesFallbackAnalysis(safeContext as Record<string, any>)
            : buildFallbackAnalysis(safeContext as Record<string, any>),
          cached: false,
          fallback: true,
          analysisType,
          model: 'contingency-rules',
        })
      }

      throw error
    }

    let analysis: unknown
    try {
      analysis = JSON.parse(generated.text)
    } catch {
      throw new Error('INVALID_AI_JSON')
    }

    if (analysisType === 'sales') {
      analysis = enforceSalesRanking(analysis, safeContext as Record<string, any>)
    }

    return jsonResponse(request, { success: true, analysis, cached: false, analysisType, model: generated.model })
  } catch (error) {
    const code = errorCode(error)
    console.error('[ai-analysis]', code)
    return jsonResponse(request, { success: false, error: code }, code === 'INVALID_CONTEXT' ? 400 : 502)
  }
})
