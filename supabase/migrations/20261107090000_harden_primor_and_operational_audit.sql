-- Primor · segurança por perfil, trilha de sincronização e consultas leves.
-- A escrita do SUPERUS permanece exclusiva das credenciais de servidor (service_role).
-- Não altera nem remove lançamentos históricos.

begin;

alter table public.superus_period_snapshots enable row level security;
alter table public.loss_period_snapshots enable row level security;

drop policy if exists "sales snapshots read anon authenticated" on public.superus_period_snapshots;
drop policy if exists "superus_period_snapshots_anon_select" on public.superus_period_snapshots;
drop policy if exists "superus_period_snapshots_anon_insert" on public.superus_period_snapshots;
drop policy if exists "superus_period_snapshots_anon_update" on public.superus_period_snapshots;
drop policy if exists "loss snapshots read anon authenticated" on public.loss_period_snapshots;
drop policy if exists "primor sales management select" on public.superus_period_snapshots;
drop policy if exists "primor losses prevention select" on public.loss_period_snapshots;

revoke select, insert, update, delete on public.superus_period_snapshots from public, anon, authenticated;
revoke select, insert, update, delete on public.loss_period_snapshots from public, anon, authenticated;
grant select on public.superus_period_snapshots, public.loss_period_snapshots to authenticated;
grant all on public.superus_period_snapshots, public.loss_period_snapshots to service_role;

create policy "primor sales management select"
on public.superus_period_snapshots for select to authenticated
using ((select public.current_user_role()) in ('admin', 'gerencia'));

create policy "primor losses prevention select"
on public.loss_period_snapshots for select to authenticated
using ((select public.current_user_role()) in ('admin', 'prevencao'));

-- Bloqueia a RPC para visitantes; permanece acessível aos perfis autenticados.
revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

-- O worker já registra tentativas aqui; antes a tabela ainda não existia.
create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  sync_type text not null check (sync_type in ('VENDAS', 'PERDAS')),
  period_start date not null,
  period_end date not null,
  status text not null check (status in ('RUNNING','SUCCESS','FAILED')),
  machine_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  message text,
  constraint sync_runs_period_check check (period_start <= period_end)
);
create index if not exists sync_runs_period_status_idx
on public.sync_runs (sync_type, period_start, period_end, started_at desc);
alter table public.sync_runs enable row level security;
drop policy if exists "primor sync admin select" on public.sync_runs;
revoke all on public.sync_runs from public, anon, authenticated;
grant select on public.sync_runs to authenticated;
grant all on public.sync_runs to service_role;
create policy "primor sync admin select"
on public.sync_runs for select to authenticated
using ((select public.current_user_role()) = 'admin');

-- Evita trafegar JSONB volumoso ao consultar as datas diárias.
create index if not exists superus_snapshots_type_slug_recent_idx
  on public.superus_period_snapshots (snapshot_type, slug, reference_date desc, updated_at desc);
create index if not exists superus_daily_sales_end_idx
  on public.superus_period_snapshots (current_end desc)
  where snapshot_type = 'DAILY' and slug = 'daily' and current_end is not null;
create index if not exists loss_snapshots_latest_updated_idx
  on public.loss_period_snapshots (updated_at desc);
create index if not exists loss_snapshots_period_recent_idx
  on public.loss_period_snapshots
  (current_end desc, current_start, previous_start, previous_end);
create index if not exists tabloid_campaigns_period_recent_idx
  on public.tabloid_campaigns (start_date desc, updated_at desc);
create index if not exists tabloid_snapshots_campaign_recent_idx
  on public.tabloid_snapshots (campaign_id, reference_date desc);
create index if not exists tabloid_product_sales_snapshot_sales_idx
  on public.tabloid_product_sales (snapshot_id, sales_value desc);

create or replace view public.daily_sales_available_dates
with (security_invoker = true) as
select distinct current_end
from public.superus_period_snapshots
where snapshot_type = 'DAILY' and slug = 'daily' and current_end is not null;
revoke all on public.daily_sales_available_dates from public, anon, authenticated;
grant select on public.daily_sales_available_dates to authenticated;

notify pgrst, 'reload schema';
commit;
