const ALLOWED_ORIGINS = new Set([
  'https://helioconde.github.io',
  'http://127.0.0.1:5183',
  'http://localhost:5183',
  'http://127.0.0.1:5184',
  'http://localhost:5184',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
])

const BLOCKED_FIELD = /password|senha|token|secret|key|credential|authorization/i

export function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || ''

  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin)
      ? origin
      : 'https://helioconde.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  }
}

export function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  })
}

export function sanitizeForAi(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForAi)

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !BLOCKED_FIELD.test(key))
        .map(([key, nestedValue]) => [key, sanitizeForAi(nestedValue)]),
    )
  }

  return value
}

export function hasValidContext(context: unknown) {
  return Boolean(context && typeof context === 'object')
}

function extractText(payload: Record<string, any>) {
  const parts = payload.candidates?.[0]?.content?.parts
  const text = Array.isArray(parts)
    ? parts.map((part) => part?.text || '').join('').trim()
    : ''

  if (!text) throw new Error('GEMINI_UNAVAILABLE')

  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

export async function generateGeminiContent(
  prompt: string,
  responseMimeType?: 'application/json',
) {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'

  if (!geminiApiKey) throw new Error('GEMINI_API_KEY_NOT_CONFIGURED')

  let response: Response | undefined
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              ...(responseMimeType ? { responseMimeType } : {}),
            },
          }),
        },
      )
    } catch (error) {
      console.error(
        '[gemini] network request failed',
        error instanceof Error ? error.message : String(error),
      )
      throw new Error('GEMINI_UNAVAILABLE')
    } finally {
      clearTimeout(timeout)
    }

    if (response.status !== 503 || attempt === 2) break

    console.warn('[gemini] service unavailable, retrying', attempt + 1)
    await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)))
  }

  if (!response) throw new Error('GEMINI_UNAVAILABLE')

  if (!response.ok) {
    console.error('[gemini] request failed', response.status, response.statusText)
    if (response.status === 401 || response.status === 403) throw new Error('GEMINI_AUTH')
    if (response.status === 404) throw new Error('GEMINI_MODEL')
    if (response.status === 429) throw new Error('GEMINI_QUOTA')
    throw new Error('GEMINI_UNAVAILABLE')
  }

  return { text: extractText(await response.json()), model }
}

export function errorCode(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  return [
    'GEMINI_API_KEY_NOT_CONFIGURED',
    'GEMINI_AUTH',
    'GEMINI_MODEL',
    'GEMINI_QUOTA',
    'GEMINI_UNAVAILABLE',
    'INVALID_AI_JSON',
    'INVALID_CONTEXT',
    'INVALID_SALES_CONTEXT',
    'INVALID_LOSSES_CONTEXT',
  ].includes(code)
    ? code
    : 'GEMINI_UNAVAILABLE'
}

type AnalysisType = 'sales' | 'losses'
type AiAuthorization =
  | { allowed: true; userId: string; role: string }
  | { allowed: false; status: number; body: Record<string, unknown> }

export async function authorizeAiRequest(request: Request, analysisType: AnalysisType): Promise<AiAuthorization> {
  const authorization = request.headers.get('authorization') || ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')

  if (!authorization.startsWith('Bearer ') || !supabaseUrl || !publishableKey) {
    return { allowed: false, status: 401, body: { success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' } }
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) {
    return { allowed: false, status: 401, body: { success: false, error: 'UNAUTHORIZED', message: 'Autenticação necessária.' } }
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role,active')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  const role = profile?.role
  const allowed = Boolean(
    !profileError &&
    profile?.active &&
    (role === 'admin' || (role === 'gerencia' && analysisType === 'sales') || (role === 'prevencao' && analysisType === 'losses')),
  )

  if (!allowed) {
    return {
      allowed: false,
      status: 403,
      body: { success: false, error: 'FORBIDDEN', message: 'Seu perfil não possui acesso a esta análise.' },
    }
  }

  return { allowed: true, userId: userData.user.id, role }
}
import { createClient } from 'npm:@supabase/supabase-js@2'
