-- Auditoria operacional da sincronização local SUPERUS -> Supabase.
-- Cada tentativa registra seu próprio identificador; não bloqueia reexecuções.

create extension if not exists pgcrypto;

create table if not exists public.sync_runs (
    id uuid primary key default gen_random_uuid(),
    sync_type text not null check (sync_type in ('VENDAS', 'PERDAS')),
    period_start date not null,
    period_end date not null,
    status text not null check (status in ('RUNNING', 'SUCCESS', 'FAILED')),
    machine_name text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    message text,
    constraint sync_runs_period_check check (period_start <= period_end)
);

create index if not exists sync_runs_period_status_idx
    on public.sync_runs (sync_type, period_start, period_end, started_at desc);

alter table public.sync_runs enable row level security;

-- A auditoria é exclusivamente do worker local autenticado com Secret key.
revoke all on public.sync_runs from anon, authenticated;
grant all on public.sync_runs to service_role;

notify pgrst, 'reload schema';
