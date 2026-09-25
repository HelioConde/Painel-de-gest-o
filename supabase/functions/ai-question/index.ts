import {
  corsHeaders,
  authorizeAiRequest,
  errorCode,
  generateGeminiContent,
  hasValidContext,
  jsonResponse,
  sanitizeForAi,
} from '../_shared/ai.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) })
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { success: false, error: 'INVALID_CONTEXT' }, 405)
  }

  try {
    const { context, analysis, question, analysisType: receivedAnalysisType } = await request.json()
    const analysisType = receivedAnalysisType === 'sales' ? 'sales' : 'losses'
    const authorization = await authorizeAiRequest(request, analysisType)
    if (!authorization.allowed) return jsonResponse(request, authorization.body, authorization.status)
    if (!hasValidContext(context) || !hasValidContext(analysis) || typeof question !== 'string' || !question.trim()) {
      return jsonResponse(request, { success: false, error: 'INVALID_CONTEXT' }, 400)
    }

    const safeContext = sanitizeForAi(context) as Record<string, any>
    const safeAnalysis = sanitizeForAi(analysis) as Record<string, any>
    const scopeInstruction = analysisType === 'sales'
      ? 'Você responde perguntas sobre desempenho comercial e vendas. Não trate dados de vendas como perdas e não cite perdas sem que elas estejam explicitamente no contexto.'
      : 'Você responde perguntas sobre perdas operacionais e financeiras. Não invente causas para perdas sem evidência no contexto.'
    const prompt = `${scopeInstruction} Use exclusivamente os dados fornecidos. Não invente números, produtos, setores ou causas. Responda em português do Brasil de forma breve e acionável.\n\nContexto:\n${JSON.stringify(safeContext)}\n\nAnálise anterior:\n${JSON.stringify(safeAnalysis)}\n\nPergunta:\n${question.trim()}`

    let generated
    try {
      generated = await generateGeminiContent(prompt)
    } catch (error) {
      if (['GEMINI_UNAVAILABLE', 'GEMINI_QUOTA'].includes(errorCode(error))) {
        const resumo = safeAnalysis.resumoExecutivo || 'A análise já exibida aponta os pontos prioritários.'
        const retryMessage = analysisType === 'sales'
          ? 'Priorize os setores com maior impacto financeiro e repita a pergunta em alguns instantes para obter um detalhamento adicional.'
          : 'Priorize os itens de maior perda financeira e repita a pergunta em alguns instantes para obter um detalhamento adicional.'
        return jsonResponse(request, {
          success: true,
          answer: `O serviço de IA está temporariamente instável. Use como referência o resumo atual: ${resumo} ${retryMessage}`,
          fallback: true,
          model: 'contingency-rules',
        })
      }

      throw error
    }

    return jsonResponse(request, { success: true, answer: generated.text, model: generated.model })
  } catch (error) {
    const code = errorCode(error)
    console.error('[ai-question]', code)
    return jsonResponse(request, { success: false, error: code }, code === 'INVALID_CONTEXT' ? 400 : 502)
  }
})
