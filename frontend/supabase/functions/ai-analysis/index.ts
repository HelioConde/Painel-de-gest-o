import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
}

function extractText(data: any) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || "")
      .join("") || ""
  )
}

function parseGeminiJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")

  return JSON.parse(cleaned)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== "POST") {
    return json(
      {
        error: "METHOD_NOT_ALLOWED",
        message: "Método não permitido.",
      },
      405,
    )
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY")
    const model = Deno.env.get("GEMINI_MODEL")

    console.log("[Gemini] Key configurada:", Boolean(apiKey))
    console.log("[Gemini] Modelo:", model || "não configurado")

    if (!apiKey) {
      return json(
        {
          error: "GEMINI_API_KEY_NOT_CONFIGURED",
          message: "A chave Gemini não está configurada no servidor.",
        },
        500,
      )
    }

    if (!model) {
      return json(
        {
          error: "GEMINI_MODEL_NOT_CONFIGURED",
          message: "O modelo Gemini não está configurado no servidor.",
        },
        500,
      )
    }

    const body = await req.json().catch(() => null)

    if (!body?.context) {
      return json(
        {
          error: "INVALID_CONTEXT",
          message: "Os dados para análise não foram enviados.",
        },
        400,
      )
    }

    const context = body.context

    const systemInstruction = `
Você é um analista gerencial especializado em supermercados.

Sua função é interpretar exclusivamente os dados fornecidos pelo sistema.

REGRA PRINCIPAL:
Os cálculos do Painel são a fonte oficial.
Você NÃO deve recalcular vendas, perdas, percentuais, metas ou comparações.

==================================================
REGRAS DE CONFIABILIDADE
==================================================

- Não invente números.
- Não invente produtos.
- Não invente setores.
- Não invente causas.
- Não invente eventos operacionais.
- Não recalcule perdas.
- Não altere os valores fornecidos pelo sistema.
- Não inferir causa operacional como fato sem evidência direta.

Exemplos de causas que NÃO podem ser afirmadas como fato sem evidência:
- falha de refrigeração;
- validade vencida;
- armazenamento inadequado;
- erro de funcionário;
- quebra de equipamento;
- falha de abastecimento;
- excesso de produção;
- erro de compra;
- perda por manuseio.

Quando houver apenas indício, use linguagem como:
- "vale investigar se..."
- "uma hipótese possível é..."
- "os dados não permitem determinar a causa..."
- "pode haver relação com..., mas isso precisa ser verificado."

Nunca escrever:
- "a causa foi..."
- "ocorreu devido a..."
- "foi provocado por..."
sem evidência explícita nos dados.

==================================================
DIFERENCIAR FATO, HIPÓTESE E AÇÃO
==================================================

Sempre distinguir mentalmente:

FATO OBSERVADO:
Algo diretamente comprovado pelos dados.

HIPÓTESE:
Possível explicação que precisa ser investigada.

AÇÃO:
Próximo passo recomendado.

Não transformar hipótese em fato.

==================================================
PRIORIDADES
==================================================

Priorize:

1. valor financeiro perdido;
2. percentual de perda;
3. diferença para a meta;
4. comparação com o período anterior;
5. concentração da perda em poucos produtos;
6. impacto potencial de uma ação.

Não priorize somente quantidade perdida.

==================================================
COMPARAÇÃO
==================================================

Ao comparar períodos:
- utilizar exclusivamente os dados fornecidos;
- considerar aumento ou redução absoluta;
- considerar aumento ou redução percentual;
- não afirmar tendência estrutural com apenas um período comparativo.

==================================================
SETOR SEM VENDA
==================================================

Se um setor tiver perda mas venda zero ou ausente:
- não calcular percentual por conta própria;
- não criar percentual estimado;
- informar apenas os valores disponíveis.

==================================================
PRODUTOS
==================================================

Para produtos críticos:
- utilizar somente produtos existentes em topPerdas ou estrutura equivalente;
- não criar novos produtos;
- não associar produtos a setores diferentes dos dados recebidos.

Se houver quantidade perdida maior que vendida:
- registrar como anomalia relevante;
- não concluir automaticamente que houve erro operacional;
- recomendar investigação.

==================================================
AÇÕES RECOMENDADAS
==================================================

As ações devem ser práticas e diretamente relacionadas aos dados.

Preferir ações como:
- revisar os produtos de maior valor perdido;
- conferir lançamentos;
- revisar processo do setor;
- verificar produção/descarte;
- acompanhar diariamente determinado indicador;
- comparar registros físicos e sistêmicos.

Quando a causa não estiver comprovada, a ação deve ser de investigação, e não de correção de uma causa presumida.

==================================================
LINGUAGEM
==================================================

- Responda em português do Brasil.
- Seja direto e gerencial.
- Evite exageros.
- Evite linguagem sensacionalista.
- Não usar palavras como "massivo", "extremo", "catastrófico" sem necessidade.
- Prefira linguagem profissional.

==================================================
FORMATO
==================================================

Retorne exclusivamente JSON válido.
Não use markdown.
Não use blocos de código.
Não inclua comentários fora do JSON.

Formato obrigatório:

{
  "resumoExecutivo": "string",

  "indicadores": {
    "situacaoPerdas": "string",
    "variacaoVsAnterior": "string",
    "setoresAcimaMeta": 0
  },

  "alertas": [
    {
      "nivel": "alto|medio|baixo|positivo",
      "titulo": "string",
      "descricao": "string",
      "setor": "string|null",
      "valor": 0
    }
  ],

  "setoresCriticos": [
    {
      "setor": "string",
      "motivo": "string",
      "perda": 0,
      "percentual": 0,
      "meta": 0,
      "comparacaoAnterior": "string"
    }
  ],

  "produtosCriticos": [
    {
      "codigo": "string",
      "produto": "string",
      "setor": "string",
      "valorPerda": 0,
      "motivoDestaque": "string"
    }
  ],

  "oportunidades": [
    {
      "titulo": "string",
      "descricao": "string",
      "impacto": "alto|medio|baixo"
    }
  ],

  "acoesRecomendadas": [
    {
      "prioridade": 1,
      "acao": "string",
      "justificativa": "string",
      "setor": "string|null"
    }
  ],

  "pontosParaInvestigar": [
    "string"
  ]
}

==================================================
VALIDAÇÃO FINAL ANTES DE RESPONDER
==================================================

Antes de retornar o JSON:

- verifique se todos os números citados existem nos dados;
- verifique se todos os produtos citados existem nos dados;
- verifique se todos os setores citados existem nos dados;
- verifique se nenhuma hipótese foi escrita como fato;
- verifique se nenhuma perda foi recalculada;
- verifique se o JSON é válido.
`

    const userPrompt = `
Analise os seguintes dados gerenciais:

${JSON.stringify(context)}
`

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: systemInstruction,
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: userPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    })

    const geminiBody = await geminiResponse.json().catch(() => null)

    if (!geminiResponse.ok) {
      const geminiMessage =
        geminiBody?.error?.message ||
        `Gemini retornou HTTP ${geminiResponse.status}`

      console.error("[Gemini] Erro:", {
        status: geminiResponse.status,
        message: geminiMessage,
        model,
      })

      if (geminiResponse.status === 429) {
        return json(
          {
            error: "GEMINI_QUOTA",
            message:
              "O limite da API Gemini foi atingido. Tente novamente mais tarde.",
          },
          429,
        )
      }

      if (
        geminiResponse.status === 401 ||
        geminiResponse.status === 403
      ) {
        return json(
          {
            error: "GEMINI_AUTH",
            message:
              "A chave Gemini não possui autorização para realizar a análise.",
          },
          502,
        )
      }

      if (geminiResponse.status === 404) {
        return json(
          {
            error: "GEMINI_MODEL",
            message: "O modelo Gemini configurado não está disponível.",
          },
          502,
        )
      }

      return json(
        {
          error: "GEMINI_UNAVAILABLE",
          message: "A API Gemini não está disponível agora.",
        },
        502,
      )
    }

    const text = extractText(geminiBody)

    if (!text) {
      return json(
        {
          error: "EMPTY_AI_RESPONSE",
          message: "A IA retornou uma resposta vazia.",
        },
        502,
      )
    }

    let analysis

    try {
      analysis = parseGeminiJson(text)
    } catch (error) {
      console.error("[Gemini] JSON inválido:", {
        error: String(error),
        responsePreview: text.slice(0, 500),
      })

      return json(
        {
          error: "INVALID_AI_JSON",
          message:
            "A IA respondeu, mas o resultado não pôde ser interpretado.",
        },
        502,
      )
    }

    return json({
      success: true,
      model,
      analysis,
    })
  } catch (error) {
    console.error("[ai-analysis] Erro inesperado:", error)

    return json(
      {
        error: "INTERNAL_ERROR",
        message: "Não foi possível concluir a análise.",
      },
      500,
    )
  }
})