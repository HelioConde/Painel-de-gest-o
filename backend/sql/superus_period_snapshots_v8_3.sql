-- Painel de Gestão — V8.3 — Vendas → Supabase
-- Não destrutivo: pode ser executado mais de uma vez.
-- Mantém a tabela histórica superus_period_snapshots e acrescenta o contrato V8.3.

create extension if not exists pgcrypto;

create table if not exists public.superus_period_snapshots (
    id uuid primary key default gen_random_uuid(),
    snapshot_key text,
    reference_date date,
    snapshot_type text,
    period_type text,
    kind text,
    slug text,
    event_slug text,
    event_name text,
    name text,
    mode text,
    metric text,
    unit text,
    current_start date,
    current_end date,
    previous_start date,
    previous_end date,
    current_value numeric(20,4),
    previous_value numeric(20,4),
    difference_value numeric(20,4),
    variation_percent numeric(20,6),
    sector_count integer,
    store_count integer,
    subgroup_count integer,
    current_sha256 text,
    previous_sha256 text,
    run_id text,
    source_files jsonb not null default '{}'::jsonb,
    details jsonb not null default '{}'::jsonb,
    payload jsonb not null default '{}'::jsonb,
    quality jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.superus_period_snapshots
    add column if not exists snapshot_key text,
    add column if not exists reference_date date,
    add column if not exists snapshot_type text,
    add column if not exists period_type text,
    add column if not exists kind text,
    add column if not exists slug text,
    add column if not exists event_slug text,
    add column if not exists event_name text,
    add column if not exists name text,
    add column if not exists mode text,
    add column if not exists metric text,
    add column if not exists unit text,
    add column if not exists current_start date,
    add column if not exists current_end date,
    add column if not exists previous_start date,
    add column if not exists previous_end date,
    add column if not exists current_value numeric(20,4),
    add column if not exists previous_value numeric(20,4),
    add column if not exists difference_value numeric(20,4),
    add column if not exists variation_percent numeric(20,6),
    add column if not exists sector_count integer,
    add column if not exists store_count integer,
    add column if not exists subgroup_count integer,
    add column if not exists current_sha256 text,
    add column if not exists previous_sha256 text,
    add column if not exists run_id text,
    add column if not exists source_files jsonb default '{}'::jsonb,
    add column if not exists details jsonb default '{}'::jsonb,
    add column if not exists payload jsonb default '{}'::jsonb,
    add column if not exists quality jsonb default '{}'::jsonb,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now();

-- Compatibilidade com schemas legados anteriores à V8.3.
-- ADD COLUMN IF NOT EXISTS não altera tipo nem constraints de colunas já existentes.
-- O run_id atual inclui timestamp + identificador e, portanto, precisa ser TEXT.
alter table public.superus_period_snapshots
    alter column run_id type text using run_id::text;

-- Na V8.3 estes campos são opcionais por contrato:
-- DAILY/MONTHLY não possuem event_slug/event_name; mode pode não existir;
-- vendas monetárias não possuem unit; variation_percent pode ser NULL se a base anterior for zero.
alter table public.superus_period_snapshots
    alter column event_slug drop not null,
    alter column event_name drop not null,
    alter column mode drop not null,
    alter column unit drop not null,
    alter column variation_percent drop not null;


-- Uma execução repetida para a mesma referência/tipo atualiza o mesmo snapshot.
-- UNIQUE aceita múltiplos NULL, então linhas históricas antigas sem snapshot_key
-- não impedem a migração.
create unique index if not exists superus_period_snapshots_snapshot_key_uidx
    on public.superus_period_snapshots (snapshot_key);

create index if not exists superus_period_snapshots_reference_idx
    on public.superus_period_snapshots (reference_date desc, snapshot_type);

alter table public.superus_period_snapshots enable row level security;

drop policy if exists "sales snapshots read anon authenticated"
    on public.superus_period_snapshots;

create policy "sales snapshots read anon authenticated"
    on public.superus_period_snapshots
    for select
    to anon, authenticated
    using (true);

-- Escrita somente pelo backend com Secret key/service_role.
grant select on public.superus_period_snapshots to anon, authenticated;
grant all on public.superus_period_snapshots to service_role;

comment on column public.superus_period_snapshots.details is
    'V8.3: hierarquia fixa 17 setores → grupos → subgrupos, rede + seis lojas, current/previous.';
comment on column public.superus_period_snapshots.metric is
    'monetary para vendas normais; quantity para Segunda da Pizza.';
comment on column public.superus_period_snapshots.snapshot_key is
    'reference_date|snapshot_type|slug; chave idempotente do UPSERT V8.3.';

notify pgrst, 'reload schema';
