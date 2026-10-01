-- Perfil operacional com acesso exclusivo ao módulo de Cartazes.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('gerencia', 'prevencao', 'admin', 'atendimento'));
