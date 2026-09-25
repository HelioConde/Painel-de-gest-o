create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  role text not null check (role in ('gerencia', 'prevencao', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

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
