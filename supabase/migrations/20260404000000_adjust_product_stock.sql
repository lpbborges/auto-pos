
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id uuid,
  p_delta numeric,
  p_updated_at timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  new_stock numeric;
  result jsonb;
BEGIN
  UPDATE public.products
  SET stock = stock + p_delta,
      updated_at = p_updated_at
  WHERE id = p_product_id
  RETURNING stock INTO new_stock;

  IF NOT FOUND THEN
    result := jsonb_build_object('success', false, 'error', 'Product not found');
    RETURN result;
  END IF;

  IF new_stock < 0 THEN
    result := jsonb_build_object('success', false, 'error', 'Insufficient stock');
    RETURN result;
  END IF;

  result := jsonb_build_object('success', true, 'stock', new_stock);
  RETURN result;
END;
$$;
