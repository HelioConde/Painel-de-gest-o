from src.ai.service import AiAnalysisError, GeminiAnalysisService, sanitize_context
from urllib.error import URLError


CONTEXT = {
    'loja': {'codigo': '033', 'nome': 'SUPERMERCADO PRIMOR 05 033'},
    'resumo': {'vendaTotal': 1000, 'perdaTotal': 20, 'percentualPerda': 2},
    'setores': [],
    'topPerdas': [],
}


def gemini_response(url, payload, timeout):
    assert 'senha' not in payload['contents'][0]['parts'][0]['text'].lower()
    return {'candidates': [{'content': {'parts': [{'text': '''{
      "resumoExecutivo": "Perda sob controle.",
      "indicadores": {}, "alertas": [], "setoresCriticos": [], "produtosCriticos": [],
      "oportunidades": [], "acoesRecomendadas": [], "pontosParaInvestigar": []
    }'''}]}}]}


def test_analysis_response_is_normalized_and_cached():
    calls = []

    def request(url, payload, timeout):
        calls.append(payload)
        return gemini_response(url, payload, timeout)

    service = GeminiAnalysisService('test-key', request_json=request)
    first, cached_first = service.analyze(CONTEXT)
    second, cached_second = service.analyze(CONTEXT)

    assert first['resumoExecutivo'] == 'Perda sob controle.'
    assert second == first
    assert cached_first is False
    assert cached_second is True
    assert len(calls) == 1


def test_context_removes_credentials_before_sending_to_gemini():
    sanitized = sanitize_context({**CONTEXT, 'senha': 'nunca-enviar', 'nested': {'api_key': 'nunca-enviar'}})
    assert 'senha' not in sanitized
    assert 'api_key' not in sanitized['nested']


def test_analysis_without_key_has_clear_error():
    service = GeminiAnalysisService(None)
    try:
        service.analyze(CONTEXT)
    except AiAnalysisError as error:
        assert error.code == 'AI_NOT_CONFIGURED'
    else:
        raise AssertionError('A análise deveria exigir chave configurada.')


def test_invalid_gemini_json_is_rejected():
    service = GeminiAnalysisService('test-key', request_json=lambda *_: {'candidates': [{'content': {'parts': [{'text': 'não é JSON'}]}}]})
    try:
        service.analyze(CONTEXT)
    except AiAnalysisError as error:
        assert error.code == 'AI_INVALID_RESPONSE'
    else:
        raise AssertionError('JSON inválido deveria ser rejeitado.')


def test_force_analysis_bypasses_cache():
    calls = []

    def request(url, payload, timeout):
        calls.append(payload)
        return gemini_response(url, payload, timeout)

    service = GeminiAnalysisService('test-key', request_json=request)
    service.analyze(CONTEXT)
    _, cached = service.analyze(CONTEXT, force=True)

    assert cached is False
    assert len(calls) == 2


def test_incomplete_context_is_rejected_before_api_call():
    service = GeminiAnalysisService('test-key')
    try:
        service.analyze({'loja': {'codigo': '033'}})
    except AiAnalysisError as error:
        assert error.code == 'AI_INVALID_CONTEXT'
    else:
        raise AssertionError('Contexto incompleto deveria ser rejeitado.')


def test_timeout_has_actionable_error():
    def timeout(*_):
        raise URLError('timeout')

    service = GeminiAnalysisService('test-key', request_json=timeout)
    try:
        service.analyze(CONTEXT)
    except AiAnalysisError as error:
        assert error.code == 'AI_TIMEOUT'
    else:
        raise AssertionError('Timeout deveria retornar erro controlado.')


def test_contextual_question_reuses_analysis_and_returns_answer():
    def request(url, payload, timeout):
        assert 'pergunta' in payload['contents'][0]['parts'][0]['text']
        return {'candidates': [{'content': {'parts': [{'text': '{"resposta":"Priorize o produto de maior perda."}'}]}}]}

    service = GeminiAnalysisService('test-key', request_json=request)
    answer = service.answer(CONTEXT, {
        'resumoExecutivo': 'Resumo válido.', 'indicadores': {}, 'alertas': [], 'setoresCriticos': [],
        'produtosCriticos': [], 'oportunidades': [], 'acoesRecomendadas': [], 'pontosParaInvestigar': [],
    }, 'O que devo priorizar?')

    assert answer == 'Priorize o produto de maior perda.'


def test_empty_contextual_question_is_rejected():
    service = GeminiAnalysisService('test-key')
    try:
        service.answer(CONTEXT, {
            'resumoExecutivo': 'Resumo válido.', 'indicadores': {}, 'alertas': [], 'setoresCriticos': [],
            'produtosCriticos': [], 'oportunidades': [], 'acoesRecomendadas': [], 'pontosParaInvestigar': [],
        }, '')
    except AiAnalysisError as error:
        assert error.code == 'AI_INVALID_QUESTION'
    else:
        raise AssertionError('Pergunta vazia deveria ser rejeitada.')
