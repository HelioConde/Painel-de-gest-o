import { supabase, supabaseConfigured } from '../lib/supabase.js'

function requireAiService() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'A conexão com o serviço de IA ainda não está disponível.'
    )
  }

  return supabase
}

function logContextSummary(analysisType, context) {
  if (analysisType === 'sales') {
    console.log('[AI][SALES] Context summary', {
      loja: context?.loja,
      periodo: context?.periodoAtual,
      vendaAtual: context?.resumoVendas?.vendaAtual,
      vendaAnterior: context?.resumoVendas?.vendaAnterior,
      quantidadeSetores: context?.setores?.length || 0,
      quantidadeSubgrupos: context?.subgrupos?.length || 0,
      quantidadeEventos: context?.eventos?.length || 0,
    })
    return
  }

  console.log('[AI][LOSSES] Context summary', {
    loja: context?.loja,
    periodo: context?.periodoAtual,
    vendaTotal: context?.resumo?.vendaTotal,
    perdaTotal: context?.resumo?.perdaTotal,
    percentualPerda: context?.resumo?.percentualPerda,
    quantidadeSetores: context?.setores?.length || 0,
    quantidadeProdutos: context?.topPerdas?.length || 0,
  })
}

function getFriendlyAiMessage(error, data) {
  const code =
    data?.error ||
    data?.code ||
    error?.context?.body?.error ||
    error?.name

  switch (code) {
    case 'GEMINI_QUOTA':
      return 'O limite da API Gemini foi atingido. Tente novamente mais tarde.'

    case 'GEMINI_AUTH':
      return 'Não foi possível autenticar o serviço de IA.'

    case 'GEMINI_MODEL':
      return 'O modelo de IA configurado não está disponível.'

    case 'GEMINI_UNAVAILABLE':
      return 'A API Gemini não está disponível agora.'

    case 'INVALID_AI_JSON':
      return 'A IA respondeu, mas não foi possível interpretar a análise.'

    case 'GEMINI_API_KEY_NOT_CONFIGURED':
      return 'A chave Gemini não está configurada no servidor.'

    case 'GEMINI_MODEL_NOT_CONFIGURED':
      return 'O modelo Gemini não está configurado no servidor.'

    case 'INVALID_CONTEXT':
      return 'Os dados da análise não foram enviados corretamente.'

    case 'FORBIDDEN':
      return 'Seu perfil não possui acesso a esta análise.'

    case 'UNAUTHORIZED':
      return 'Sua sessão expirou. Entre novamente para continuar.'

    case 'INVALID_SALES_CONTEXT':
      return 'O contexto de vendas está incompleto. Atualize os dados e tente novamente.'

    case 'INVALID_LOSSES_CONTEXT':
      return 'O contexto de perdas está incompleto. Atualize os dados e tente novamente.'

    default:
      return (
        data?.message ||
        error?.message ||
        'Não foi possível concluir a análise com IA agora.'
      )
  }
}

async function readFunctionError(error) {
  if (!error?.context) return null

  try {
    return await error.context.clone().json()
  } catch {
    try {
      const text = await error.context.clone().text()

      return text
        ? {
            message: text,
          }
        : null
    } catch {
      return null
    }
  }
}

export async function requestAiAnalysis(
  context,
  { force = false, analysisType = 'losses' } = {}
) {
  console.log('[AI] analysisType:', analysisType)
  console.log('[AI] context enviado:', context)
  console.log('[AI] context JSON:', JSON.stringify(context))
  logContextSummary(analysisType, context)

  const { data, error } = await requireAiService().functions.invoke(
    'ai-analysis',
    {
      body: {
        context,
        force,
        analysisType,
      },
    }
  )

  if (error) {
    const details = await readFunctionError(error)

    console.error('[AI] Edge Function error:', {
      error,
      details,
    })

    throw new Error(
      getFriendlyAiMessage(error, details)
    )
  }

  if (!data?.success) {
    console.error(
      '[AI] Resposta inválida da Edge Function:',
      data
    )

    throw new Error(
      getFriendlyAiMessage(null, data)
    )
  }

  return data
}

export async function askAiQuestion(
  context,
  analysis,
  question,
  { analysisType = 'losses' } = {}
) {
  const { data, error } = await requireAiService().functions.invoke(
    'ai-question',
    {
      body: {
        context,
        analysis,
        question,
        analysisType,
      },
    }
  )

  if (error) {
    const details = await readFunctionError(error)

    console.error('[AI] Edge Function question error:', {
      error,
      details,
    })

    throw new Error(
      getFriendlyAiMessage(error, details)
    )
  }

  if (!data?.success) {
    throw new Error(
      getFriendlyAiMessage(null, data)
    )
  }

  return data
}
