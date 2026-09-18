-- Painel de Gestão — hotfix V8.3.1
-- Corrige instalações antigas onde public.superus_period_snapshots.run_id ficou UUID.
-- Seguro para executar mais de uma vez.
--
-- Motivo:
-- o backend usa run_id no formato YYYYMMDDTHHMMSS_<uuidhex>, por exemplo:
-- 20260905T082334_c2c2f6302f22454f8ab396c43b1942d7
-- Esse identificador precisa ser TEXT para corresponder à pasta data/runs/<run_id>.

begin;

alter table public.superus_period_snapshots
    alter column run_id type text using run_id::text;

comment on column public.superus_period_snapshots.run_id is
    'Identificador textual completo do run local: YYYYMMDDTHHMMSS_<uuidhex>.';

commit;

notify pgrst, 'reload schema';
