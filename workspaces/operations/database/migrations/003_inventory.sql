-- Migration 003: Inventory Catalog Table & Policies
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

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

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
