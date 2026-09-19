-- ====================================================================
-- SUPABASE COMPLETE DATABASE SCHEMA FOR STOCK MANAGEMENT & ORDER APP
-- Enterprise Security, Trusted User Identity, RLS & Authoritative RPC
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 2. USER PROFILES TABLE (Bound to Supabase Auth)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'salesman' CHECK (role IN ('salesman', 'customer', 'admin', 'manager')),
  salesman_id TEXT,
  salesman_name TEXT,
  shop_name TEXT,
  customer_code TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_salesman_id ON public.user_profiles(salesman_id);

-- ====================================================================
-- 3. PENDING ORDERS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.pending_orders (
  order_id TEXT PRIMARY KEY,
  salesman_id TEXT NOT NULL,
  salesman_name TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  location_id TEXT,
  city TEXT,
  state TEXT,
  item_count NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- 4. PENDING ORDER LINE ITEMS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.pending_order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.pending_orders(order_id) ON DELETE CASCADE,
  sku TEXT,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON public.pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_pending_orders_salesman_id ON public.pending_orders(salesman_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_shop_name ON public.pending_orders(shop_name);
CREATE INDEX IF NOT EXISTS idx_pending_order_items_order_id ON public.pending_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pending_order_items_item_name ON public.pending_order_items(item_name);

-- ====================================================================
-- 5. INVENTORY CATALOG TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  item_name TEXT PRIMARY KEY,
  sku TEXT,
  category TEXT,
  brand TEXT,
  price NUMERIC DEFAULT 0,
  current_stock NUMERIC DEFAULT 0,
  reserved_stock NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON public.inventory(sku);

-- ====================================================================
-- 6. SYSTEM SETTINGS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  setting TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default system setting for allow_negative_orders
INSERT INTO public.system_settings (setting, value, updated_at)
VALUES ('allow_negative_orders', 'false'::jsonb, NOW())
ON CONFLICT (setting) DO NOTHING;

-- ====================================================================
-- 7. SECURITY HELPER FUNCTIONS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_auth_profile()
RETURNS public.user_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
      AND role IN ('admin', 'manager') 
      AND is_active = true
  );
$$;

-- ====================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 8.1 USER PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.user_profiles;
CREATE POLICY "Users can view own profile or admins view all"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR public.is_admin_or_manager() = true
  );

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.user_profiles;
CREATE POLICY "Admins can manage profiles"
  ON public.user_profiles FOR ALL
  TO authenticated
  USING (public.is_admin_or_manager() = true)
  WITH CHECK (public.is_admin_or_manager() = true);

-- 8.2 INVENTORY POLICIES
DROP POLICY IF EXISTS "Allow public all access on inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can read inventory" ON public.inventory;
CREATE POLICY "Authenticated users can read inventory"
  ON public.inventory FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Admins can modify inventory" ON public.inventory;
CREATE POLICY "Admins can modify inventory"
  ON public.inventory FOR ALL
  TO authenticated
  USING (public.is_admin_or_manager() = true)
  WITH CHECK (public.is_admin_or_manager() = true);

-- 8.3 SYSTEM SETTINGS POLICIES
DROP POLICY IF EXISTS "Allow public all access on system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read settings"
  ON public.system_settings FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Admins can modify settings" ON public.system_settings;
CREATE POLICY "Admins can modify settings"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (public.is_admin_or_manager() = true)
  WITH CHECK (public.is_admin_or_manager() = true);

-- 8.4 PENDING ORDERS POLICIES
DROP POLICY IF EXISTS "Allow public all access on pending_orders" ON public.pending_orders;
DROP POLICY IF EXISTS "Restricted read on pending_orders" ON public.pending_orders;
CREATE POLICY "Restricted read on pending_orders"
  ON public.pending_orders FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_manager() = true
    OR salesman_id = (SELECT salesman_id FROM public.user_profiles WHERE id = auth.uid())
    OR shop_name = (SELECT shop_name FROM public.user_profiles WHERE id = auth.uid())
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can modify pending_orders" ON public.pending_orders;
CREATE POLICY "Admins can modify pending_orders"
  ON public.pending_orders FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager() = true)
  WITH CHECK (public.is_admin_or_manager() = true);

DROP POLICY IF EXISTS "Admins can delete pending_orders" ON public.pending_orders;
CREATE POLICY "Admins can delete pending_orders"
  ON public.pending_orders FOR DELETE
  TO authenticated
  USING (public.is_admin_or_manager() = true);

-- 8.5 PENDING ORDER ITEMS POLICIES
DROP POLICY IF EXISTS "Allow public all access on pending_order_items" ON public.pending_order_items;
DROP POLICY IF EXISTS "Restricted read on pending_order_items" ON public.pending_order_items;
CREATE POLICY "Restricted read on pending_order_items"
  ON public.pending_order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pending_orders po
      WHERE po.order_id = pending_order_items.order_id
        AND (
          public.is_admin_or_manager() = true
          OR po.salesman_id = (SELECT salesman_id FROM public.user_profiles WHERE id = auth.uid())
          OR po.shop_name = (SELECT shop_name FROM public.user_profiles WHERE id = auth.uid())
          OR po.created_by = auth.uid()
        )
    )
  );

-- ====================================================================
-- 9. AUTHORITATIVE ORDER SUBMISSION RPC (submit_order)
-- ====================================================================
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

-- ====================================================================
-- 10. COMPATIBILITY VIEWS
-- ====================================================================
CREATE OR REPLACE VIEW public.orders AS SELECT * FROM public.pending_orders;
CREATE OR REPLACE VIEW public.order_items AS SELECT * FROM public.pending_order_items;
