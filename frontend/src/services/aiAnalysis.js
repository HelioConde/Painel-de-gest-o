import { supabase } from '../supabaseClient.js'

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
  { force = false } = {}
) {
  const { data, error } = await supabase.functions.invoke(
    'ai-analysis',
    {
      body: {
        context,
        force,
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
  question
) {
  const { data, error } = await supabase.functions.invoke(
    'ai-question',
    {
      body: {
        context,
        analysis,
        question,
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