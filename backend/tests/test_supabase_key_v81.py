from __future__ import annotations

import base64
import json

import pytest

from src.supabase.client import (
    SupabaseKeyError,
    SupabaseRestClient,
    classify_supabase_key,
)


def _jwt(role: str) -> str:
    def enc(value: dict[str, object]) -> str:
        raw = json.dumps(value, separators=(',', ':')).encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip('=')
    return f'{enc({"alg": "HS256", "typ": "JWT"})}.{enc({"role": role})}.signature'


def test_new_secret_key_is_privileged_and_has_no_bearer_header():
    key = 'sb_secret_' + 'x' * 32
    info = classify_supabase_key(key)
    assert info['privileged'] is True
    assert info['postgres_role'] == 'service_role'
    client = SupabaseRestClient('https://example.supabase.co', key)
    headers = client._headers()
    assert headers['apikey'] == key
    assert 'Authorization' not in headers


def test_publishable_key_is_rejected_for_backend_write_client():
    key = 'sb_publishable_' + 'x' * 32
    with pytest.raises(SupabaseKeyError):
        SupabaseRestClient('https://example.supabase.co', key)


def test_legacy_service_role_uses_bearer():
    key = _jwt('service_role')
    client = SupabaseRestClient('https://example.supabase.co', key)
    headers = client._headers()
    assert headers['apikey'] == key
    assert headers['Authorization'] == f'Bearer {key}'


def test_legacy_anon_is_rejected():
    with pytest.raises(SupabaseKeyError):
        SupabaseRestClient('https://example.supabase.co', _jwt('anon'))
