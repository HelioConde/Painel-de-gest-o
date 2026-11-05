-- Diagnóstico SOMENTE LEITURA: cole no SQL Editor do projeto Primor.
-- Não executar no projeto pizzaria-db.
-- 1. Tamanho real das tabelas e indices envolvidos.
select
  c.relname as tabela,
  c.reltuples::bigint as linhas_estimadas,
  pg_size_pretty(pg_relation_size(c.oid)) as tamanho_tabela,
  pg_size_pretty(pg_indexes_size(c.oid)) as tamanho_indices,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname in (
    'superus_period_snapshots',
    'loss_period_snapshots',
    'tabloid_campaigns',
    'tabloid_snapshots',
    'tabloid_product_sales'
  )
order by pg_total_relation_size(c.oid) desc;

-- 2. Uso do indice vs leituras sequenciais e registros mortos.
select
  schemaname, relname, seq_scan, idx_scan,
  n_live_tup, n_dead_tup, last_autoanalyze, last_autovacuum
from pg_stat_user_tables
where schemaname = 'public'
  and relname in (
    'superus_period_snapshots', 'loss_period_snapshots',
    'tabloid_campaigns', 'tabloid_snapshots', 'tabloid_product_sales'
  )
order by relname;

-- 3. Verificar indices que realmente existem.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'superus_period_snapshots', 'loss_period_snapshots',
    'tabloid_campaigns', 'tabloid_snapshots', 'tabloid_product_sales'
  )
order by tablename, indexname;

-- 4. Amostra das dimensoes do JSONB sem exportar dados de vendas.
select
  snapshot_type,
  count(*) as linhas,
  pg_size_pretty(coalesce(sum(pg_column_size(details)), 0)::bigint) as details_total,
  pg_size_pretty(coalesce(max(pg_column_size(details)), 0)::bigint) as details_maior
from public.superus_period_snapshots
group by snapshot_type
order by snapshot_type;

-- 5. Confirmar se a view de datas ja foi instalada.
select to_regclass('public.daily_sales_available_dates') as view_datas_disponiveis;
