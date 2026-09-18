-- Painel de Gestão — Perdas
-- Execute uma vez no SQL Editor do Supabase antes do primeiro --sync.

create extension if not exists pgcrypto;

create table if not exists public.loss_period_snapshots (
    id uuid primary key default gen_random_uuid(),

    store_code text not null,
    store_name text not null,

    current_start date not null,
    current_end date not null,
    previous_start date not null,
    previous_end date not null,

    current_record_count integer not null default 0,
    previous_record_count integer not null default 0,

    current_loss_quantity numeric(20,4),
    previous_loss_quantity numeric(20,4),

    current_gross_cost_total numeric(20,4),
    previous_gross_cost_total numeric(20,4),

    current_sale_price_total numeric(20,4),
    previous_sale_price_total numeric(20,4),

    current_total_value numeric(20,4),
    previous_total_value numeric(20,4),

    -- V8.2: faturamento real do mesmo período (Vendas > Vendas).
    current_sales_value numeric(20,4),
    previous_sales_value numeric(20,4),
    current_loss_sales_percent numeric(20,6),
    previous_loss_sales_percent numeric(20,6),
    sales_difference numeric(20,4),
    sales_variation_percent numeric(20,6),
    loss_difference numeric(20,4),
    loss_variation_percent numeric(20,6),

    current_sha256 text not null,
    previous_sha256 text not null,
    current_sales_sha256 text,
    previous_sales_sha256 text,

    run_id text not null,
    source_format text not null default 'htm',

    source_files jsonb not null default '{}'::jsonb,
    details jsonb not null default '{}'::jsonb,
    quality jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint loss_period_snapshots_store_check
        check (store_code in ('307','212','600','120','033','018')),

    constraint loss_period_snapshots_period_check
        check (current_start <= current_end and previous_start <= previous_end),

    constraint loss_period_snapshots_source_format_check
        check (source_format = 'htm'),

    constraint loss_period_snapshots_unique_period_store
        unique (store_code, current_start, current_end, previous_start, previous_end)
);

create index if not exists loss_period_snapshots_current_end_idx
    on public.loss_period_snapshots (current_end desc);

create index if not exists loss_period_snapshots_store_idx
    on public.loss_period_snapshots (store_code, current_end desc);

alter table public.loss_period_snapshots enable row level security;

drop policy if exists "loss snapshots read anon authenticated"
    on public.loss_period_snapshots;

create policy "loss snapshots read anon authenticated"
    on public.loss_period_snapshots
    for select
    to anon, authenticated
    using (true);

-- Não criamos policy de INSERT/UPDATE para anon/authenticated.
-- O backend deve usar SUPABASE_SECRET_KEY / service role, somente no .env local.


grant select on public.loss_period_snapshots to anon, authenticated;
grant all on public.loss_period_snapshots to service_role;
