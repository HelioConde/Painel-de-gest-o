from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from time import time
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class AiAnalysisError(RuntimeError):
    def __init__(self, message: str, *, code: str = 'AI_UNAVAILABLE', status: int = 502) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


SYSTEM_PROMPT = """Você é um analista de desempenho de supermercado. Analise somente os dados
fornecidos. Não invente valores, produtos, causas ou eventos. Diferencie claramente fatos,
hipóteses e recomendações. Quando a causa não puder ser determinada pelos dados, diga que
precisa ser investigada. Priorize impacto financeiro, percentual de perda, comparação anual e
metas por setor. Responda em português do Brasil e devolva APENAS JSON válido no formato:
{
  "resumoExecutivo": "texto",
  "indicadores": {"situacaoPerdas": "texto", "variacaoVsAnterior": "texto", "setoresAcimaMeta": 0},
  "alertas": [{"nivel": "alto|medio|baixo", "titulo": "texto", "descricao": "texto", "setor": "texto ou null", "valor": 0}],
  "setoresCriticos": [{"setor": "texto", "motivo": "texto", "perda": 0, "percentual": 0, "meta": 0, "comparacaoAnterior": "texto"}],
  "produtosCriticos": [{"codigo": "texto", "produto": "texto", "setor": "texto", "valorPerda": 0, "quantidadePerdida": 0, "percentualPerda": 0, "motivoDestaque": "texto"}],
  "oportunidades": [{"titulo": "texto", "descricao": "texto", "impacto": "alto|medio|baixo"}],
  "acoesRecomendadas": [{"prioridade": 1, "acao": "texto", "justificativa": "texto", "setor": "texto ou null"}],
  "pontosParaInvestigar": ["texto"]
}"""

SENSITIVE_KEY = re.compile(r'(password|senha|token|secret|credential|api.?key|authorization)', re.I)


def _json_request(url: str, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    request = Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as error:
        if error.code in (401, 403):
            raise AiAnalysisError('A chave Gemini não foi aceita.', code='AI_CONFIGURATION', status=503) from error
        if error.code == 429:
            raise AiAnalysisError('O limite da API Gemini foi atingido. Tente novamente mais tarde.', code='AI_QUOTA', status=429) from error
        raise AiAnalysisError('A API Gemini não está disponível agora.') from error
    except (URLError, TimeoutError) as error:
        raise AiAnalysisError('A API Gemini não respondeu a tempo.', code='AI_TIMEOUT', status=504) from error


def sanitize_context(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): sanitize_context(item) for key, item in value.items() if not SENSITIVE_KEY.search(str(key))}
    if isinstance(value, list):
        return [sanitize_context(item) for item in value]
    return value


def _parse_json(value: str) -> dict[str, Any]:
    cleaned = value.strip()
    if cleaned.startswith('```'):
        cleaned = re.sub(r'^```(?:json)?\s*|\s*```$', '', cleaned, flags=re.I)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise AiAnalysisError('A IA retornou uma resposta em formato inválido.', code='AI_INVALID_RESPONSE') from error
    if not isinstance(parsed, dict):
        raise AiAnalysisError('A IA retornou uma resposta em formato inválido.', code='AI_INVALID_RESPONSE')
    return parsed


def normalize_analysis(value: dict[str, Any]) -> dict[str, Any]:
    result = {
        'resumoExecutivo': str(value.get('resumoExecutivo') or ''),
        'indicadores': value.get('indicadores') if isinstance(value.get('indicadores'), dict) else {},
        'alertas': value.get('alertas') if isinstance(value.get('alertas'), list) else [],
        'setoresCriticos': value.get('setoresCriticos') if isinstance(value.get('setoresCriticos'), list) else [],
        'produtosCriticos': value.get('produtosCriticos') if isinstance(value.get('produtosCriticos'), list) else [],
        'oportunidades': value.get('oportunidades') if isinstance(value.get('oportunidades'), list) else [],
        'acoesRecomendadas': value.get('acoesRecomendadas') if isinstance(value.get('acoesRecomendadas'), list) else [],
        'pontosParaInvestigar': value.get('pontosParaInvestigar') if isinstance(value.get('pontosParaInvestigar'), list) else [],
    }
    if not result['resumoExecutivo']:
        raise AiAnalysisError('A IA retornou uma análise incompleta.', code='AI_INVALID_RESPONSE')
    return result


def context_hash(context: dict[str, Any]) -> str:
    raw = json.dumps(sanitize_context(context), ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


@dataclass
class GeminiAnalysisService:
    api_key: str | None
    model: str = 'gemini-2.0-flash'
    timeout: float = 35.0
    request_json: Callable[[str, dict[str, Any], float], dict[str, Any]] = _json_request
    cache_ttl: float = 3600.0
    cache: dict[str, tuple[float, dict[str, Any]]] = field(default_factory=dict)

    def _require_key(self) -> str:
        if not self.api_key:
            raise AiAnalysisError('A análise com IA ainda não foi configurada.', code='AI_NOT_CONFIGURED', status=503)
        return self.api_key

    def _generate(self, instruction: str) -> str:
        key = self._require_key()
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={key}'
        try:
            response = self.request_json(url, {
                'contents': [{'role': 'user', 'parts': [{'text': instruction}]}],
                'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.2},
            }, self.timeout)
        except (URLError, TimeoutError) as error:
            raise AiAnalysisError('A API Gemini não respondeu a tempo.', code='AI_TIMEOUT', status=504) from error
        try:
            return response['candidates'][0]['content']['parts'][0]['text']
        except (KeyError, IndexError, TypeError) as error:
            raise AiAnalysisError('A IA não devolveu conteúdo para a análise.', code='AI_INVALID_RESPONSE') from error

    def analyze(self, context: dict[str, Any], *, force: bool = False) -> tuple[dict[str, Any], bool]:
        safe_context = sanitize_context(context)
        if not isinstance(safe_context.get('loja'), dict) or not isinstance(safe_context.get('resumo'), dict):
            raise AiAnalysisError('Os dados gerenciais enviados para análise estão incompletos.', code='AI_INVALID_CONTEXT', status=400)
        key = context_hash(safe_context)
        cached = self.cache.get(key)
        if cached and not force and cached[0] > time():
            return cached[1], True
        response = normalize_analysis(_parse_json(self._generate(f'{SYSTEM_PROMPT}\n\nDADOS GERENCIAIS:\n{json.dumps(safe_context, ensure_ascii=False)}')))
        self.cache[key] = (time() + self.cache_ttl, response)
        return response, False

    def answer(self, context: dict[str, Any], analysis: dict[str, Any], question: str) -> str:
        safe_question = str(question or '').strip()
        if not safe_question:
            raise AiAnalysisError('Digite uma pergunta para a análise.', code='AI_INVALID_QUESTION', status=400)
        payload = {'dadosGerenciais': sanitize_context(context), 'analiseAnterior': normalize_analysis(analysis), 'pergunta': safe_question}
        text = self._generate(
            'Responda em português do Brasil em JSON válido no formato {"resposta":"..."}. '
            'Use somente os dados fornecidos, diferencie fatos de hipóteses e não invente causas.\n\n'
            f'{json.dumps(payload, ensure_ascii=False)}'
        )
        answer = _parse_json(text).get('resposta')
        if not isinstance(answer, str) or not answer.strip():
            raise AiAnalysisError('A IA retornou uma resposta em formato inválido.', code='AI_INVALID_RESPONSE')
        return answer.strip()
