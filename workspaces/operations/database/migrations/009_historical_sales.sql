-- ==============================================================================
-- Migration 009: Historical Sales, Returns & Purchases Canonical Foundation
-- ==============================================================================
-- This migration establishes the authoritative historical accounting ledger for
-- imported Tally records (2026-06-01 through 2026-09-21).
--
-- IMPORTANT SEMANTIC SEPARATION:
-- OPERATIONAL ORDER != HISTORICAL ACCOUNTING SALE
-- Historical sales represent demand history and accounting revenue.
-- They do NOT decrement physical stock, nor do they appear as live pending orders.
-- ==============================================================================

-- 1. Historical Sales Header Table
CREATE TABLE IF NOT EXISTS public.historical_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number TEXT NOT NULL,
    voucher_date DATE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_gstin TEXT,
    customer_address TEXT,
    voucher_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    gross_amount NUMERIC(15, 2) DEFAULT 0.00,
    source TEXT NOT NULL DEFAULT 'TALLY_HISTORICAL_IMPORT',
    source_import_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_historical_sales_source_vchno UNIQUE (source, voucher_number)
);

-- 2. Historical Sales Line Items Table
CREATE TABLE IF NOT EXISTS public.historical_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    historical_sale_id UUID NOT NULL REFERENCES public.historical_sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    unit TEXT DEFAULT 'NOS',
    unit_rate NUMERIC(15, 2),
    line_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    source_line_id TEXT NOT NULL,
    item_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_historical_sale_items_source_line UNIQUE (historical_sale_id, source_line_id)
);

-- 3. Historical Returns Header Table
CREATE TABLE IF NOT EXISTS public.historical_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number TEXT NOT NULL,
    voucher_date DATE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_gstin TEXT,
    voucher_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    source TEXT NOT NULL DEFAULT 'TALLY_HISTORICAL_IMPORT',
    source_import_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_historical_returns_source_vchno UNIQUE (source, voucher_number)
);

-- 4. Historical Returns Line Items Table
CREATE TABLE IF NOT EXISTS public.historical_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    historical_return_id UUID NOT NULL REFERENCES public.historical_returns(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    unit TEXT DEFAULT 'NOS',
    unit_rate NUMERIC(15, 2),
    line_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    source_line_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_historical_return_items_source_line UNIQUE (historical_return_id, source_line_id)
);

-- 5. Historical Purchases Header Table
CREATE TABLE IF NOT EXISTS public.historical_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number TEXT NOT NULL,
    voucher_date DATE NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT NOT NULL,
    supplier_gstin TEXT,
    voucher_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    source TEXT NOT NULL DEFAULT 'TALLY_HISTORICAL_IMPORT',
    source_import_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_historical_purchases_source_vchno UNIQUE (source, voucher_number)
);

-- 6. Historical Purchases Line Items Table
CREATE TABLE IF NOT EXISTS public.historical_purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    historical_purchase_id UUID NOT NULL REFERENCES public.historical_purchases(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    unit TEXT DEFAULT 'NOS',
    unit_rate NUMERIC(15, 2),
    line_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    source_line_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_historical_purchase_items_source_line UNIQUE (historical_purchase_id, source_line_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_hist_sales_date ON public.historical_sales(voucher_date);
CREATE INDEX IF NOT EXISTS idx_hist_sales_customer ON public.historical_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_hist_sales_source ON public.historical_sales(source, source_import_id);
CREATE INDEX IF NOT EXISTS idx_hist_sale_items_sale ON public.historical_sale_items(historical_sale_id);
CREATE INDEX IF NOT EXISTS idx_hist_sale_items_product ON public.historical_sale_items(product_id);

CREATE INDEX IF NOT EXISTS idx_hist_returns_date ON public.historical_returns(voucher_date);
CREATE INDEX IF NOT EXISTS idx_hist_returns_customer ON public.historical_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_hist_return_items_return ON public.historical_return_items(historical_return_id);

CREATE INDEX IF NOT EXISTS idx_hist_purchases_date ON public.historical_purchases(voucher_date);
CREATE INDEX IF NOT EXISTS idx_hist_purchases_supplier ON public.historical_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_hist_purchase_items_purchase ON public.historical_purchase_items(historical_purchase_id);

-- Enable RLS for all historical tables
ALTER TABLE public.historical_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_purchase_items ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users (and service role has full access)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow read access to historical_sales" ON public.historical_sales;
    CREATE POLICY "Allow read access to historical_sales" ON public.historical_sales FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Allow read access to historical_sale_items" ON public.historical_sale_items;
    CREATE POLICY "Allow read access to historical_sale_items" ON public.historical_sale_items FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Allow read access to historical_returns" ON public.historical_returns;
    CREATE POLICY "Allow read access to historical_returns" ON public.historical_returns FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Allow read access to historical_return_items" ON public.historical_return_items;
    CREATE POLICY "Allow read access to historical_return_items" ON public.historical_return_items FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Allow read access to historical_purchases" ON public.historical_purchases;
    CREATE POLICY "Allow read access to historical_purchases" ON public.historical_purchases FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Allow read access to historical_purchase_items" ON public.historical_purchase_items;
    CREATE POLICY "Allow read access to historical_purchase_items" ON public.historical_purchase_items FOR SELECT USING (true);
END $$;
