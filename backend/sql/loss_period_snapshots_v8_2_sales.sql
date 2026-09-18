-- Painel de Gestão — MIGRAÇÃO Perdas V8.2
-- Execute no SQL Editor do Supabase em projeto que já possui loss_period_snapshots.

alter table public.loss_period_snapshots
    add column if not exists current_sales_value numeric(20,4),
    add column if not exists previous_sales_value numeric(20,4),
    add column if not exists current_loss_sales_percent numeric(20,6),
    add column if not exists previous_loss_sales_percent numeric(20,6),
    add column if not exists sales_difference numeric(20,4),
    add column if not exists sales_variation_percent numeric(20,6),
    add column if not exists loss_difference numeric(20,4),
    add column if not exists loss_variation_percent numeric(20,6),
    add column if not exists current_sales_sha256 text,
    add column if not exists previous_sales_sha256 text;

comment on column public.loss_period_snapshots.current_sales_value is
    'Venda real do mesmo período selecionado na tela de Perdas.';
comment on column public.loss_period_snapshots.current_loss_sales_percent is
    'current_total_value / current_sales_value * 100.';

grant select on public.loss_period_snapshots to anon, authenticated;
grant all on public.loss_period_snapshots to service_role;
