CREATE OR REPLACE FUNCTION public.get_avg_product_costs(
  p_product_ids uuid[],
  p_store_id uuid
) RETURNS TABLE(product_id uuid, avg_cost numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    sm.product_id,
    SUM(sm.unit_cost * sm.quantity) / NULLIF(SUM(sm.quantity), 0) AS avg_cost
  FROM public.stock_movements sm
  WHERE sm.product_id = ANY(p_product_ids)
    AND sm.type = 'in'
    AND sm.store_id = p_store_id
  GROUP BY sm.product_id;
$$;
