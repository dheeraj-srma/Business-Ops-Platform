-- Migration 004: Pending Orders & Items Tables & Policies
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

ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_order_items ENABLE ROW LEVEL SECURITY;

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
