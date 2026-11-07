-- Plano de ação operacional por loja/departamento. Não altera vendas ou perdas.
create table if not exists public.store_action_plans (
  id uuid primary key default gen_random_uuid(),
  store_code text not null check (store_code in ('307','212','600','120','033','018')),
  department text not null check (department in ('VENDAS','PERDAS')),
  sector text not null default '',
  product_code text not null default '',
  title text not null check (length(btrim(title)) between 5 and 180),
  description text not null default '',
  owner_name text not null default '',
  due_date date,
  status text not null default 'PENDENTE'
    check (status in ('PENDENTE','EM_ANDAMENTO','CONCLUIDO','CANCELADO')),
  baseline_value numeric(18,2) check (baseline_value is null or baseline_value >= 0),
  target_value numeric(18,2) check (target_value is null or target_value >= 0),
  result_notes text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_action_plans_department_store_due_idx
  on public.store_action_plans (department, store_code, due_date, created_at desc);
create index if not exists store_action_plans_status_due_idx
  on public.store_action_plans (status, due_date);
alter table public.store_action_plans enable row level security;

revoke all on public.store_action_plans from public, anon, authenticated;
grant select, insert, update on public.store_action_plans to authenticated;
grant all on public.store_action_plans to service_role;

drop policy if exists "primor action plans visible by department" on public.store_action_plans;
create policy "primor action plans visible by department"
on public.store_action_plans for select to authenticated
using (
  (select public.current_user_role()) = 'admin'
  or (department = 'VENDAS' and (select public.current_user_role()) = 'gerencia')
  or (department = 'PERDAS' and (select public.current_user_role()) = 'prevencao')
);
drop policy if exists "primor action plans insert by department" on public.store_action_plans;
create policy "primor action plans insert by department"
on public.store_action_plans for insert to authenticated
with check (
  created_by = (select auth.uid()) and
  ((select public.current_user_role()) = 'admin'
   or (department = 'VENDAS' and (select public.current_user_role()) = 'gerencia')
   or (department = 'PERDAS' and (select public.current_user_role()) = 'prevencao'))
);
drop policy if exists "primor action plans update by department" on public.store_action_plans;
create policy "primor action plans update by department"
on public.store_action_plans for update to authenticated
using (
  (select public.current_user_role()) = 'admin'
  or (department = 'VENDAS' and (select public.current_user_role()) = 'gerencia')
  or (department = 'PERDAS' and (select public.current_user_role()) = 'prevencao')
)
with check (
  (select public.current_user_role()) = 'admin'
  or (department = 'VENDAS' and (select public.current_user_role()) = 'gerencia')
  or (department = 'PERDAS' and (select public.current_user_role()) = 'prevencao')
);
notify pgrst, 'reload schema';
