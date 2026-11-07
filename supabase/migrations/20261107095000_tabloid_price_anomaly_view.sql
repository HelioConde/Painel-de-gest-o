-- Alertas exploratórios de valores unitários para auditoria financeira.
-- Detecta divergências entre lojas NO MESMO relatório e produto; não altera registros.
-- Os preços são implícitos: vendas acumuladas divididas pela quantidade acumulada.
-- A consulta não considera preços oficiais nem corrige os dados automaticamente.
create or replace view public.tabloid_price_anomalies
with (security_invoker = true)
as
with recent_snapshots as (
  select id, reference_date, period_start, period_end
  from public.tabloid_snapshots
  order by reference_date desc, id desc
  limit 12
), observations as (
  select s.id as snapshot_id, s.reference_date, s.period_start, s.period_end,
         p.store_code, p.product_code, p.product_name,
         p.quantity, p.sales_value,
         p.sales_value / nullif(p.quantity, 0) as implied_unit_price
  from recent_snapshots s
  join public.tabloid_product_sales p on p.snapshot_id = s.id
  where p.quantity > 0 and p.sales_value >= 0
), benchmarks as (
  select snapshot_id, product_code,
         count(distinct store_code) as stores,
         percentile_cont(0.5) within group (order by implied_unit_price::double precision) as median_unit_price
  from observations
  group by snapshot_id, product_code
  having count(distinct store_code) >= 3
)
select o.snapshot_id, o.reference_date, o.period_start, o.period_end,
       o.store_code, o.product_code, o.product_name,
       o.quantity, o.sales_value,
       round(o.implied_unit_price, 3) as implied_unit_price,
       round(b.median_unit_price::numeric, 3) as benchmark_unit_price,
       round(o.sales_value - (b.median_unit_price::numeric * o.quantity), 2) as difference_from_benchmark,
       b.stores as benchmark_store_count
from observations o
join benchmarks b using (snapshot_id, product_code)
where b.median_unit_price > 0
  and (o.implied_unit_price > b.median_unit_price * 3
       or o.implied_unit_price < b.median_unit_price / 3)
  and abs(o.sales_value - (b.median_unit_price::numeric * o.quantity)) >= 1000;

revoke all on public.tabloid_price_anomalies from public, anon, authenticated;
grant select on public.tabloid_price_anomalies to authenticated;
notify pgrst, 'reload schema';
