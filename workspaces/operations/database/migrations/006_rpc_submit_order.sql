-- Migration 006: Authoritative RPC Function (submit_order)
CREATE OR REPLACE FUNCTION public.submit_order(
  p_order_id TEXT DEFAULT NULL,
  p_salesman_id TEXT DEFAULT NULL,
  p_salesman_name TEXT DEFAULT NULL,
  p_shop_name TEXT DEFAULT '',
  p_city TEXT DEFAULT '',
  p_state TEXT DEFAULT '',
  p_location_id TEXT DEFAULT '',
  p_notes TEXT DEFAULT '',
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_profile public.user_profiles%ROWTYPE;
  v_salesman_id TEXT;
  v_salesman_name TEXT;
  v_shop_name TEXT;
  v_city TEXT;
  v_state TEXT;
  v_location_id TEXT;
  v_allow_negative BOOLEAN := false;
  v_item JSONB;
  v_item_name TEXT;
  v_req_qty NUMERIC;
  v_inv_row public.inventory%ROWTYPE;
  v_current_stock NUMERIC;
  v_reserved_stock NUMERIC;
  v_available_stock NUMERIC;
  v_price NUMERIC;
  v_line_total NUMERIC;
  v_total_amount NUMERIC := 0;
  v_item_count INT := 0;
  v_final_order_id TEXT;
  v_rejected_items JSONB := '[]'::jsonb;
  v_setting_row public.system_settings%ROWTYPE;
BEGIN
  -- 1. Caller Authentication & Profile Lookup
  v_caller_id := auth.uid();

  IF v_caller_id IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_caller_id;
  END IF;

  IF v_profile.id IS NOT NULL THEN
    IF v_profile.role = 'customer' THEN
      v_salesman_id := COALESCE(v_profile.salesman_id, 'DIRECT');
      v_salesman_name := COALESCE(v_profile.salesman_name, 'Direct / House Account');
      v_shop_name := v_profile.shop_name;
    ELSIF v_profile.role = 'salesman' THEN
      v_salesman_id := v_profile.salesman_id;
      v_salesman_name := v_profile.salesman_name;
      v_shop_name := TRIM(COALESCE(p_shop_name, ''));
    ELSIF v_profile.role IN ('admin', 'manager') THEN
      v_salesman_id := COALESCE(NULLIF(TRIM(p_salesman_id), ''), v_profile.salesman_id, 'DIRECT');
      v_salesman_name := COALESCE(NULLIF(TRIM(p_salesman_name), ''), v_profile.salesman_name, 'Direct / House Account');
      v_shop_name := TRIM(COALESCE(p_shop_name, ''));
    END IF;
  ELSE
    v_salesman_id := COALESCE(NULLIF(TRIM(p_salesman_id), ''), 'DIRECT');
    v_salesman_name := COALESCE(NULLIF(TRIM(p_salesman_name), ''), 'Direct / House Account');
    v_shop_name := TRIM(COALESCE(p_shop_name, ''));
  END IF;

  -- 2. Validate Required Fields
  IF v_shop_name = '' THEN
    RAISE EXCEPTION 'Validation Failed: Shop / Customer Name is required.';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Validation Failed: Order must contain at least one item.';
  END IF;

  v_city := COALESCE(NULLIF(TRIM(p_city), ''), 'Faridabad');
  v_state := COALESCE(NULLIF(TRIM(p_state), ''), 'Haryana');
  v_location_id := COALESCE(p_location_id, '');

  -- 3. Check System Settings for Stock Override
  SELECT * INTO v_setting_row FROM public.system_settings WHERE setting = 'allow_negative_orders';
  IF FOUND THEN
    v_allow_negative := (
      v_setting_row.value = 'true'::jsonb 
      OR v_setting_row.value = '"true"'::jsonb 
      OR v_setting_row.value = '1'::jsonb
    );
  END IF;

  -- 4. Validate Items, Stock Availability & Recalculate Prices
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_name := TRIM(COALESCE(v_item->>'item_name', v_item->>'name', ''));
    v_req_qty := COALESCE((v_item->>'quantity')::numeric, (v_item->>'qty')::numeric, 0);

    IF v_item_name = '' THEN
      RAISE EXCEPTION 'Validation Failed: Line item name cannot be empty.';
    END IF;

    IF v_req_qty <= 0 THEN
      RAISE EXCEPTION 'Validation Failed: Item "%" must have quantity greater than 0 (provided: %).', v_item_name, v_req_qty;
    END IF;

    SELECT * INTO v_inv_row 
    FROM public.inventory 
    WHERE item_name = v_item_name 
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Validation Failed: Item "%" is not recognized in the inventory catalog.', v_item_name;
    END IF;

    SELECT COALESCE(SUM(quantity), 0) INTO v_reserved_stock
    FROM public.pending_order_items
    WHERE item_name = v_item_name;

    v_current_stock := COALESCE(v_inv_row.current_stock, 0);
    v_available_stock := GREATEST(0, v_current_stock - v_reserved_stock);

    IF NOT v_allow_negative AND v_req_qty > v_available_stock THEN
      v_rejected_items := v_rejected_items || jsonb_build_object(
        'item_name', v_item_name,
        'requested_quantity', v_req_qty,
        'available_stock', v_available_stock,
        'current_stock', v_current_stock
      );
    END IF;

    v_price := COALESCE(v_inv_row.price, 0);
    v_line_total := ROUND((v_price * v_req_qty)::numeric, 2);
    v_total_amount := v_total_amount + v_line_total;
    v_item_count := v_item_count + 1;
  END LOOP;

  -- 5. Rollback on Any Stock Errors (Atomic Transaction Protection)
  IF jsonb_array_length(v_rejected_items) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_STOCK',
      'message', 'One or more items exceed live available warehouse stock.',
      'rejected_items', v_rejected_items
    );
  END IF;

  -- 6. Generate Server Authoritative Order ID
  IF p_order_id IS NOT NULL AND TRIM(p_order_id) <> '' THEN
    v_final_order_id := TRIM(p_order_id);
  ELSE
    v_final_order_id := 'ORD-' || REGEXP_REPLACE(v_salesman_id, '[^a-zA-Z0-9_-]', '', 'g') || '-' || to_char(NOW(), 'YYYYMMDDHH24MISS');
  END IF;

  -- 7. Atomically Insert Order Header
  INSERT INTO public.pending_orders (
    order_id,
    salesman_id,
    salesman_name,
    shop_name,
    location_id,
    city,
    state,
    item_count,
    total_amount,
    status,
    notes,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_final_order_id,
    v_salesman_id,
    v_salesman_name,
    v_shop_name,
    v_location_id,
    v_city,
    v_state,
    v_item_count,
    v_total_amount,
    'Pending',
    COALESCE(p_notes, ''),
    v_caller_id,
    NOW(),
    NOW()
  );

  -- 8. Atomically Insert Line Items with Authoritative Prices and Totals
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_name := TRIM(COALESCE(v_item->>'item_name', v_item->>'name', ''));
    v_req_qty := COALESCE((v_item->>'quantity')::numeric, (v_item->>'qty')::numeric, 0);

    SELECT * INTO v_inv_row FROM public.inventory WHERE item_name = v_item_name;
    v_price := COALESCE(v_inv_row.price, 0);
    v_line_total := ROUND((v_price * v_req_qty)::numeric, 2);

    INSERT INTO public.pending_order_items (
      order_id,
      sku,
      item_name,
      category,
      quantity,
      price,
      total_price,
      created_at
    ) VALUES (
      v_final_order_id,
      COALESCE(v_inv_row.sku, v_item->>'sku', v_item_name),
      v_item_name,
      COALESCE(v_inv_row.category, v_item->>'category', 'General'),
      v_req_qty,
      v_price,
      v_line_total,
      NOW()
    );
  END LOOP;

  -- 9. Return Structured Success Response
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_final_order_id,
    'salesman_id', v_salesman_id,
    'salesman_name', v_salesman_name,
    'shop_name', v_shop_name,
    'item_count', v_item_count,
    'total_amount', v_total_amount,
    'status', 'Pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_order TO authenticated, anon;
