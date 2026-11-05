-- Indices de leitura e view de datas. Nao remove nem altera registros.
-- Aplicar somente no Supabase do Primor em horario de baixo movimento.
create index if not exists superus_snapshots_type_slug_recent_idx
  on public.superus_period_snapshots
  (snapshot_type, slug, reference_date desc, updated_at desc);

create index if not exists superus_daily_sales_end_idx
  on public.superus_period_snapshots (current_end desc)
  where snapshot_type = 'DAILY' and slug = 'daily' and current_end is not null;

create index if not exists loss_snapshots_latest_updated_idx
  on public.loss_period_snapshots (updated_at desc);

create index if not exists loss_snapshots_run_period_idx
  on public.loss_period_snapshots
  (run_id, current_start, current_end, previous_start, previous_end);

-- Executada com permissoes do usuario: respeita a RLS da tabela.
create or replace view public.daily_sales_available_dates
  with (security_invoker = true)
as
  select distinct current_end
  from public.superus_period_snapshots
  where snapshot_type = 'DAILY'
    and slug = 'daily'
    and current_end is not null;

revoke all on public.daily_sales_available_dates from public;
grant select on public.daily_sales_available_dates to authenticated;
notify pgrst, 'reload schema';
