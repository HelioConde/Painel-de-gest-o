from __future__ import annotations

import json
import os
import socket
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Callable
from uuid import uuid4

from src.config.settings import Settings
from src.config.stores import STORES
from src.supabase.client import SupabaseRestClient


EXPECTED_STORES = tuple(STORES)
RETRY_DELAYS_SECONDS = (10, 30, 60)


class DailySyncError(RuntimeError):
    """A coleta, sincronização ou validação diária não foi concluída."""


class DailySyncAlreadyRunning(DailySyncError):
    """Outra execução local ainda mantém o bloqueio diário."""


@dataclass(frozen=True)
class SyncPeriod:
    start: date
    end: date

    @classmethod
    def for_reference_date(cls, reference_date: date) -> 'SyncPeriod':
        yesterday = reference_date - timedelta(days=1)
        return cls(start=yesterday.replace(day=1), end=yesterday)


@dataclass(frozen=True)
class SyncCheck:
    sync_type: str
    period: SyncPeriod
    exists: bool
    record_count: int
    stores: tuple[str, ...]
    reason: str


@dataclass(frozen=True)
class DailySyncResult:
    period: SyncPeriod
    sales: SyncCheck
    losses: SyncCheck
    sales_action: str
    losses_action: str

    @property
    def success(self) -> bool:
        return self.sales.exists and self.losses.exists


class DailySyncLogger:
    def __init__(self, root: Path, run_date: date) -> None:
        self.path = root / run_date.isoformat() / 'sync.log'
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, message: str) -> None:
        timestamp = datetime.now().astimezone().isoformat(timespec='seconds')
        line = f'[{timestamp}] {message}'
        print(line)
        with self.path.open('a', encoding='utf-8') as handle:
            handle.write(f'{line}\n')


class DailySyncLock:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.acquired = False

    @staticmethod
    def _pid_is_alive(pid: int | None) -> bool:
        if not pid or pid <= 0:
            return False
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
        return True

    def _stale_lock(self) -> bool:
        try:
            data = json.loads(self.path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            return True
        return not self._pid_is_alive(data.get('pid'))

    def acquire(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            if self._stale_lock():
                self.path.unlink(missing_ok=True)
            else:
                raise DailySyncAlreadyRunning(
                    f'Outra sincronização diária está em execução ({self.path}).'
                )
        try:
            descriptor = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError as error:
            raise DailySyncAlreadyRunning(
                f'Outra sincronização diária adquiriu o bloqueio ({self.path}).'
            ) from error
        with os.fdopen(descriptor, 'w', encoding='utf-8') as handle:
            json.dump({'pid': os.getpid(), 'started_at': datetime.now(UTC).isoformat()}, handle)
        self.acquired = True

    def release(self) -> None:
        if self.acquired:
            self.path.unlink(missing_ok=True)
            self.acquired = False

    def __enter__(self) -> 'DailySyncLock':
        self.acquire()
        return self

    def __exit__(self, *_: object) -> None:
        self.release()


class SyncRunAudit:
    """Auditoria best-effort: uma migração pendente não bloqueia a coleta."""

    table = 'sync_runs'

    def __init__(self, settings: Settings, logger: DailySyncLogger) -> None:
        url, key = settings.require_supabase()
        self.client = SupabaseRestClient(url=url, key=key, timeout=settings.supabase_timeout)
        self.logger = logger

    def start(self, sync_type: str, period: SyncPeriod) -> str | None:
        run_id = str(uuid4())
        try:
            self.client.request(
                'POST', self.table,
                body={
                    'id': run_id,
                    'sync_type': sync_type,
                    'period_start': period.start.isoformat(),
                    'period_end': period.end.isoformat(),
                    'status': 'RUNNING',
                    'machine_name': socket.gethostname(),
                    'started_at': datetime.now(UTC).isoformat(),
                },
                prefer='return=minimal',
            )
            return run_id
        except Exception as error:
            self.logger.write(f'auditoria {sync_type}: indisponível ({type(error).__name__}: {error})')
            return None

    def finish(self, run_id: str | None, *, status: str, message: str) -> None:
        if not run_id:
            return
        try:
            self.client.request(
                'PATCH', self.table,
                query={'id': f'eq.{run_id}'},
                body={
                    'status': status,
                    'finished_at': datetime.now(UTC).isoformat(),
                    'message': message[:2000],
                },
                prefer='return=minimal',
            )
        except Exception as error:
            self.logger.write(f'auditoria: não foi possível finalizar ({type(error).__name__}: {error})')


def _expected_stores() -> tuple[str, ...]:
    return tuple(sorted(EXPECTED_STORES))


def _store_codes_from_sales(row: dict[str, object]) -> tuple[str, ...]:
    details = row.get('details') or {}
    stores = details.get('stores') if isinstance(details, dict) else []
    return tuple(sorted(str(item.get('store_code')).zfill(3) for item in stores if isinstance(item, dict)))


def check_sales_sync(settings: Settings, period: SyncPeriod) -> SyncCheck:
    url, key = settings.require_supabase()
    client = SupabaseRestClient(url=url, key=key, timeout=settings.supabase_timeout)
    rows = client.select(
        settings.supabase_sales_table,
        select='snapshot_key,current_value,store_count,details,current_sha256,previous_sha256,run_id',
        filters={
            'snapshot_type': 'eq.MONTHLY',
            'slug': 'eq.monthly',
            'metric': 'eq.monetary',
            'current_start': f'eq.{period.start.isoformat()}',
            'current_end': f'eq.{period.end.isoformat()}',
        },
        limit=2,
    )
    if len(rows) != 1:
        return SyncCheck('VENDAS', period, False, len(rows), (), f'esperado 1 consolidado mensal, recebido {len(rows)}')
    row = rows[0]
    stores = _store_codes_from_sales(row)
    required = {'current_value', 'store_count', 'current_sha256', 'previous_sha256', 'run_id'}
    missing = sorted(field for field in required if row.get(field) in (None, ''))
    if int(row.get('store_count') or 0) != len(EXPECTED_STORES) or stores != _expected_stores():
        return SyncCheck('VENDAS', period, False, 1, stores, 'consolidado não contém as seis lojas esperadas')
    if missing:
        return SyncCheck('VENDAS', period, False, 1, stores, f'campos obrigatórios ausentes: {", ".join(missing)}')
    return SyncCheck('VENDAS', period, True, 1, stores, 'consolidado mensal válido')


def check_losses_sync(settings: Settings, period: SyncPeriod) -> SyncCheck:
    url, key = settings.require_supabase()
    client = SupabaseRestClient(url=url, key=key, timeout=settings.supabase_timeout)
    rows = client.select(
        settings.supabase_loss_table,
        select='store_code,current_total_value,current_record_count,current_sha256,previous_sha256,run_id',
        filters={
            'current_start': f'eq.{period.start.isoformat()}',
            'current_end': f'eq.{period.end.isoformat()}',
        },
        limit=20,
    )
    stores = tuple(sorted(str(row.get('store_code') or '').zfill(3) for row in rows))
    if stores != _expected_stores():
        return SyncCheck('PERDAS', period, False, len(rows), stores, 'não há exatamente as seis lojas esperadas')
    required = {'current_total_value', 'current_record_count', 'current_sha256', 'previous_sha256', 'run_id'}
    incomplete = [str(row.get('store_code')) for row in rows if any(row.get(field) is None for field in required)]
    if incomplete:
        return SyncCheck('PERDAS', period, False, len(rows), stores, f'registros incompletos: {", ".join(incomplete)}')
    return SyncCheck('PERDAS', period, True, len(rows), stores, 'seis snapshots de perdas válidos')


def sync_sales_from_superus(reference_date: date) -> None:
    from src.app.controller import run_daily_auto

    exit_code = run_daily_auto(reference_date, dry_run=False, only_job=None, sync=True)
    if exit_code != 0:
        raise DailySyncError(f'coleta/sincronização de vendas retornou código {exit_code}')


def sync_losses_from_superus(period: SyncPeriod) -> None:
    from src.app.controller import run_losses_auto

    exit_code = run_losses_auto(
        period.start.strftime('%d/%m/%Y'),
        period.end.strftime('%d/%m/%Y'),
        None,
        sync=True,
    )
    if exit_code != 0:
        raise DailySyncError(f'coleta/sincronização de perdas retornou código {exit_code}')


class DailySynchronizer:
    def __init__(
        self,
        settings: Settings,
        logger: DailySyncLogger,
        *,
        sales_check: Callable[[Settings, SyncPeriod], SyncCheck] = check_sales_sync,
        losses_check: Callable[[Settings, SyncPeriod], SyncCheck] = check_losses_sync,
        sales_sync: Callable[[date], None] = sync_sales_from_superus,
        losses_sync: Callable[[SyncPeriod], None] = sync_losses_from_superus,
        sleep: Callable[[float], None] = time.sleep,
        audit: SyncRunAudit | None = None,
    ) -> None:
        self.settings = settings
        self.logger = logger
        self.sales_check = sales_check
        self.losses_check = losses_check
        self.sales_sync = sales_sync
        self.losses_sync = losses_sync
        self.sleep = sleep
        self.audit = audit

    def _sync_missing(
        self,
        sync_type: str,
        period: SyncPeriod,
        action: Callable[[], None],
        check: Callable[[Settings, SyncPeriod], SyncCheck],
    ) -> SyncCheck:
        audit_id = self.audit.start(sync_type, period) if self.audit else None
        last_error: Exception | None = None
        for attempt in range(1, 4):
            try:
                self.logger.write(f'{sync_type}: tentativa {attempt}/3 para {period.start} a {period.end}')
                action()
                status = check(self.settings, period)
                if not status.exists:
                    raise DailySyncError(f'validação pós-upload falhou: {status.reason}')
                self.logger.write(f'{sync_type}: OK após coleta e read-back ({status.reason})')
                if self.audit:
                    self.audit.finish(audit_id, status='SUCCESS', message=status.reason)
                return status
            except Exception as error:
                last_error = error
                self.logger.write(f'{sync_type}: falha na tentativa {attempt}/3: {type(error).__name__}: {error}')
                if attempt < 3:
                    delay = RETRY_DELAYS_SECONDS[attempt - 1]
                    self.logger.write(f'{sync_type}: nova tentativa em {delay}s')
                    self.sleep(delay)
        message = f'{type(last_error).__name__}: {last_error}' if last_error else 'falha desconhecida'
        if self.audit:
            self.audit.finish(audit_id, status='FAILED', message=message)
        raise DailySyncError(f'{sync_type} não foi sincronizado após 3 tentativas: {message}')

    def execute(self, reference_date: date) -> DailySyncResult:
        period = SyncPeriod.for_reference_date(reference_date)
        self.logger.write(f'período calculado: {period.start} a {period.end}')
        sales = self.sales_check(self.settings, period)
        losses = self.losses_check(self.settings, period)
        self.logger.write(f'VENDAS antes: {"OK" if sales.exists else "PENDENTE"} ({sales.reason})')
        self.logger.write(f'PERDAS antes: {"OK" if losses.exists else "PENDENTE"} ({losses.reason})')

        sales_action = 'SKIPPED'
        losses_action = 'SKIPPED'
        if not sales.exists:
            sales = self._sync_missing('VENDAS', period, lambda: self.sales_sync(reference_date), self.sales_check)
            sales_action = 'SYNCED'
        if not losses.exists:
            losses = self._sync_missing('PERDAS', period, lambda: self.losses_sync(period), self.losses_check)
            losses_action = 'SYNCED'
        return DailySyncResult(period, sales, losses, sales_action, losses_action)


def _reference_date(value: date | None) -> date:
    return value or datetime.now(UTC).astimezone().date()


def run_daily_sync_command(reference_date: date | None = None) -> int:
    reference_date = _reference_date(reference_date)
    backend_root = Path(__file__).resolve().parents[2]
    logger = DailySyncLogger(backend_root / 'logs' / 'sync', reference_date)
    settings = Settings.from_environment()
    try:
        with DailySyncLock(backend_root / 'tmp' / 'daily-sync.lock'):
            audit = SyncRunAudit(settings, logger)
            result = DailySynchronizer(settings, logger, audit=audit).execute(reference_date)
    except DailySyncAlreadyRunning as error:
        logger.write(f'SKIPPED: {error}')
        return 0
    except Exception as error:
        logger.write(f'FAIL: {type(error).__name__}: {error}')
        return 2
    logger.write(
        f'PASS: VENDAS={result.sales_action}, PERDAS={result.losses_action}; '
        f'período={result.period.start}->{result.period.end}'
    )
    return 0


def check_daily_sync_command(reference_date: date | None = None) -> int:
    reference_date = _reference_date(reference_date)
    period = SyncPeriod.for_reference_date(reference_date)
    try:
        settings = Settings.from_environment()
        sales = check_sales_sync(settings, period)
        losses = check_losses_sync(settings, period)
    except Exception as error:
        print(f'DAILY SYNC CHECK: FAIL\nerror: {type(error).__name__}: {error}')
        return 2
    print(f'Período esperado: {period.start} a {period.end}')
    print(f'VENDAS: {"OK" if sales.exists else "PENDENTE"} - {sales.reason}')
    print(f'PERDAS: {"OK" if losses.exists else "PENDENTE"} - {losses.reason}')
    return 0 if sales.exists and losses.exists else 2
