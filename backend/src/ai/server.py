from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from src.ai.service import AiAnalysisError, GeminiAnalysisService
from src.config.settings import Settings


def _response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    origin = handler.headers.get('Origin') or ''
    allowed_origin = origin if origin.startswith(('http://127.0.0.1:', 'http://localhost:')) else 'http://127.0.0.1:5184'
    handler.send_header('Access-Control-Allow-Origin', allowed_origin)
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type')
    handler.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def run_ai_server(host: str = '127.0.0.1', port: int = 8787) -> None:
    settings = Settings.from_environment()
    service = GeminiAnalysisService(settings.gemini_api_key, model=settings.gemini_model, timeout=settings.gemini_timeout)

    class Handler(BaseHTTPRequestHandler):
        def do_OPTIONS(self) -> None:  # noqa: N802
            _response(self, 204, {})

        def do_GET(self) -> None:  # noqa: N802
            if self.path == '/api/ai/health':
                _response(self, 200, {'configured': bool(settings.gemini_api_key), 'model': settings.gemini_model})
            else:
                _response(self, 404, {'error': 'NOT_FOUND'})

        def do_POST(self) -> None:  # noqa: N802
            try:
                size = int(self.headers.get('Content-Length') or 0)
                payload = json.loads(self.rfile.read(size).decode('utf-8'))
                if self.path == '/api/ai/analysis':
                    analysis, cached = service.analyze(payload.get('context') or {}, force=bool(payload.get('force')))
                    _response(self, 200, {'analysis': analysis, 'cached': cached, 'model': settings.gemini_model})
                    return
                if self.path == '/api/ai/question':
                    answer = service.answer(payload.get('context') or {}, payload.get('analysis') or {}, payload.get('question'))
                    _response(self, 200, {'answer': answer, 'model': settings.gemini_model})
                    return
                _response(self, 404, {'error': 'NOT_FOUND'})
            except AiAnalysisError as error:
                _response(self, error.status, {'error': error.code, 'message': str(error)})
            except (json.JSONDecodeError, ValueError):
                _response(self, 400, {'error': 'AI_INVALID_REQUEST', 'message': 'A solicitação de análise é inválida.'})
            except Exception:
                _response(self, 500, {'error': 'AI_UNAVAILABLE', 'message': 'Não foi possível concluir a análise com IA agora. Os dados do painel continuam disponíveis normalmente.'})

        def log_message(self, format: str, *args: Any) -> None:
            return

    print(f'API de Análise com IA disponível em http://{host}:{port}')
    ThreadingHTTPServer((host, port), Handler).serve_forever()
