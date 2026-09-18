from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


class SupabaseHttpError(RuntimeError):
    """Falha HTTP ao falar com o PostgREST do Supabase."""


class SupabaseKeyError(RuntimeError):
    """Chave Supabase inadequada para o backend privilegiado."""


def _decode_jwt_payload(token: str) -> dict[str, Any] | None:
    """Decodifica somente o payload para diagnóstico local; NÃO valida assinatura."""
    parts = token.split('.')
    if len(parts) != 3:
        return None
    try:
        raw = parts[1] + '=' * (-len(parts[1]) % 4)
        payload = base64.urlsafe_b64decode(raw.encode('ascii'))
        value = json.loads(payload.decode('utf-8'))
        return value if isinstance(value, dict) else None
    except Exception:
        return None


def classify_supabase_key(key: str) -> dict[str, Any]:
    value = key.strip().strip('"').strip("'")

    if value.startswith('sb_secret_'):
        return {
            'kind': 'secret',
            'label': 'Secret key (sb_secret_...)',
            'privileged': True,
            'send_authorization': False,
            'postgres_role': 'service_role',
        }

    if value.startswith('sb_publishable_'):
        return {
            'kind': 'publishable',
            'label': 'Publishable key (sb_publishable_...)',
            'privileged': False,
            'send_authorization': False,
            'postgres_role': 'anon',
        }

    payload = _decode_jwt_payload(value)
    if payload is not None:
        role = str(payload.get('role') or '')
        if role == 'service_role':
            return {
                'kind': 'legacy_service_role',
                'label': 'Legacy service_role JWT',
                'privileged': True,
                'send_authorization': True,
                'postgres_role': 'service_role',
            }
        if role:
            return {
                'kind': f'legacy_{role}',
                'label': f'Legacy JWT role={role}',
                'privileged': False,
                'send_authorization': True,
                'postgres_role': role,
            }

    return {
        'kind': 'unknown',
        'label': 'Chave Supabase de tipo não reconhecido',
        'privileged': False,
        'send_authorization': False,
        'postgres_role': None,
    }


def require_privileged_supabase_key(key: str) -> dict[str, Any]:
    info = classify_supabase_key(key)
    if info['privileged']:
        return info

    if info['kind'] == 'publishable':
        raise SupabaseKeyError(
            'SUPABASE_SECRET_KEY contém uma Publishable key (sb_publishable_...). '
            'Ela usa o papel anon e NÃO pode gravar nesta tabela com RLS. '
            'No backend use uma Secret key (sb_secret_...) do projeto.'
        )

    if str(info['kind']).startswith('legacy_'):
        raise SupabaseKeyError(
            f'SUPABASE_SECRET_KEY contém {info["label"]}, que não é service_role. '
            'Use uma Secret key (sb_secret_...) ou a legacy service_role key.'
        )

    raise SupabaseKeyError(
        'SUPABASE_SECRET_KEY não parece ser uma Secret key (sb_secret_...) nem '
        'uma legacy service_role JWT. Confira Settings > API Keys no Supabase.'
    )


@dataclass(frozen=True)
class SupabaseRestClient:
    url: str
    key: str
    timeout: float = 30.0

    def __post_init__(self) -> None:
        object.__setattr__(self, 'key', self.key.strip().strip('"').strip("'"))
        require_privileged_supabase_key(self.key)

    @property
    def key_info(self) -> dict[str, Any]:
        return require_privileged_supabase_key(self.key)

    @property
    def project_host(self) -> str:
        return urlparse(self.url).netloc

    def _endpoint(self, table: str, query: dict[str, str] | None = None) -> str:
        base = self.url.rstrip('/')
        endpoint = f'{base}/rest/v1/{table}'
        if query:
            endpoint += '?' + urlencode(query, safe=',.*()')
        return endpoint

    def _headers(self) -> dict[str, str]:
        info = self.key_info
        headers = {
            'apikey': self.key,
            'Accept': 'application/json',
            # Evita aparência de browser; secret keys são destinadas a backend.
            'User-Agent': 'PainelGestao-SuperusWorker/8.1',
        }

        # Secret keys novas (sb_secret_...) NÃO são JWTs e devem ir no apikey.
        # Legacy service_role é JWT e continua usando Authorization: Bearer.
        if info['send_authorization']:
            headers['Authorization'] = f'Bearer {self.key}'

        return headers

    def request(
        self,
        method: str,
        table: str,
        *,
        query: dict[str, str] | None = None,
        body: Any | None = None,
        prefer: str | None = None,
    ) -> Any:
        payload = None
        headers = self._headers()

        if body is not None:
            payload = json.dumps(body, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        if prefer:
            headers['Prefer'] = prefer

        request = Request(
            self._endpoint(table, query),
            data=payload,
            headers=headers,
            method=method.upper(),
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
                if not raw:
                    return None
                content_type = response.headers.get('Content-Type', '')
                if 'application/json' in content_type or raw[:1] in (b'{', b'['):
                    return json.loads(raw.decode('utf-8'))
                return raw.decode('utf-8', errors='replace')
        except HTTPError as error:
            try:
                body_text = error.read().decode('utf-8', errors='replace')
            finally:
                error.close()
            hint = ''
            if error.code == 401 and 'row-level security' in body_text.lower():
                hint = (
                    ' | Diagnóstico: a requisição chegou sem privilégio service_role. '
                    'Rode: main.py --check-supabase'
                )
            raise SupabaseHttpError(
                f'Supabase HTTP {error.code} {error.reason}: {body_text}{hint}'
            ) from error
        except URLError as error:
            raise SupabaseHttpError(f'Falha de rede ao acessar Supabase: {error}') from error

    def upsert(
        self,
        table: str,
        rows: list[dict[str, Any]],
        *,
        on_conflict: str,
    ) -> list[dict[str, Any]]:
        result = self.request(
            'POST',
            table,
            query={'on_conflict': on_conflict},
            body=rows,
            prefer='resolution=merge-duplicates,return=representation',
        )
        if not isinstance(result, list):
            raise SupabaseHttpError(f'Upsert retornou formato inesperado: {type(result).__name__}')
        return result

    def select(
        self,
        table: str,
        *,
        select: str,
        filters: dict[str, str],
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        query = {'select': select}
        query.update(filters)
        if limit is not None:
            query['limit'] = str(limit)
        result = self.request('GET', table, query=query)
        if not isinstance(result, list):
            raise SupabaseHttpError(f'Select retornou formato inesperado: {type(result).__name__}')
        return result
