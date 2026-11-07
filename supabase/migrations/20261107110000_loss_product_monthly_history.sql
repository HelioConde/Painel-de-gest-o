-- Histórico de perdas por produto, sem duplicar coletas acumulativas.
-- Para cada loja e mês, considera somente o snapshot aprovado mais recente.
-- SECURITY INVOKER faz a view respeitar o RLS de loss_period_snapshots.
create or replace view public.loss_product_monthly_history
with (security_invoker = true)
as
with latest as (
  select distinct on (l.store_code, date_trunc('month', l.current_start))
    l.store_code,
    date_trunc('month', l.current_start)::date as month_start,
    l.current_start, l.current_end,
    l.details
  from public.loss_period_snapshots l
  where l.quality->>'status' = 'PASS'
    and l.current_start = date_trunc('month', l.current_start)::date
  order by l.store_code, date_trunc('month', l.current_start),
           l.current_end desc, l.updated_at desc
),
products as (
  select l.store_code, l.month_start, l.current_start, l.current_end,
         sector->>'name' as sector,
         product->>'product_code' as product_code,
         product->>'product_name' as product_name,
         coalesce((product->>'total_value')::numeric, 0) as loss_value,
         coalesce((product->>'loss_quantity')::numeric, 0) as loss_quantity
  from latest l
  cross join lateral jsonb_array_elements(l.details->'current'->'sectors') sector
  cross join lateral jsonb_array_elements(sector->'mips') mip
  cross join lateral jsonb_array_elements(mip->'products') product
)
select month_start, current_start, current_end,
       store_code, sector, product_code, max(product_name) as product_name,
       sum(loss_value) as loss_value, sum(loss_quantity) as loss_quantity
from products
where product_code is not null and product_code <> ''
  and loss_value > 0
group by month_start, current_start, current_end, store_code, sector, product_code;

revoke all on public.loss_product_monthly_history from public, anon, authenticated;
grant select on public.loss_product_monthly_history to authenticated;
notify pgrst, 'reload schema';
