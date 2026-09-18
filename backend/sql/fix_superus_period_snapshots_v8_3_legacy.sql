-- Hotfix V8.3/V8.3.1 — compatibilidade com schema legado do Supabase
-- Seguro para executar mais de uma vez.
-- Corrige os dois problemas observados:
--   1) run_id legado UUID -> TEXT
--   2) colunas opcionais da V8.3 ainda marcadas NOT NULL no schema antigo

begin;

alter table public.superus_period_snapshots
    alter column run_id type text using run_id::text;

alter table public.superus_period_snapshots
    alter column event_slug drop not null,
    alter column event_name drop not null,
    alter column mode drop not null,
    alter column unit drop not null,
    alter column variation_percent drop not null;

commit;

notify pgrst, 'reload schema';
