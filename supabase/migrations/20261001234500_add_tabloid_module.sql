create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select role
  from public.profiles
  where user_id = (select auth.uid())
    and active = true
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create table public.tabloid_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  promotion_type integer not null default 1,
  promotion_name text not null default 'TABLOIDE',
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create unique index tabloid_one_active_campaign on public.tabloid_campaigns (active) where active;

create table public.tabloid_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.tabloid_campaigns(id) on delete cascade,
  reference_date date not null,
  period_start date not null,
  period_end date not null,
  imported_at timestamptz not null default now(),
  source_file_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (campaign_id, reference_date),
  check (period_start <= period_end)
);

create table public.tabloid_product_sales (
  id bigint generated always as identity primary key,
  snapshot_id uuid not null references public.tabloid_snapshots(id) on delete cascade,
  store_code text not null,
  store_name text not null,
  product_code text not null,
  product_name text not null,
  family_key text not null,
  family_name text not null,
  package_size text,
  variant_name text not null default '',
  quantity numeric not null,
  sales_value numeric not null,
  unique (snapshot_id, store_code, product_code, product_name)
);

create table public.tabloid_family_overrides (
  id bigint generated always as identity primary key,
  original_name text not null unique,
  family_key text not null,
  family_name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index tabloid_product_sales_snapshot_family_idx on public.tabloid_product_sales (snapshot_id, family_key);
create index tabloid_product_sales_snapshot_store_idx on public.tabloid_product_sales (snapshot_id, store_code);

alter table public.tabloid_campaigns enable row level security;
alter table public.tabloid_snapshots enable row level security;
alter table public.tabloid_product_sales enable row level security;
alter table public.tabloid_family_overrides enable row level security;

create policy "tabloid campaigns visible to management" on public.tabloid_campaigns for select to authenticated using (public.current_user_role() in ('admin', 'gerencia'));
create policy "tabloid campaigns admin writes" on public.tabloid_campaigns for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy "tabloid snapshots visible to management" on public.tabloid_snapshots for select to authenticated using (public.current_user_role() in ('admin', 'gerencia'));
create policy "tabloid products visible to management" on public.tabloid_product_sales for select to authenticated using (public.current_user_role() in ('admin', 'gerencia'));
create policy "tabloid overrides admin writes" on public.tabloid_family_overrides for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

grant select, insert, update, delete on public.tabloid_campaigns, public.tabloid_family_overrides to authenticated;
grant select on public.tabloid_snapshots, public.tabloid_product_sales to authenticated;
grant all on public.tabloid_campaigns, public.tabloid_snapshots, public.tabloid_product_sales, public.tabloid_family_overrides to service_role;
