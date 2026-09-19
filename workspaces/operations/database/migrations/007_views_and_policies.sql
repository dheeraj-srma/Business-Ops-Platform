-- Migration 007: Compatibility Views for Legacy Query Consumers
CREATE OR REPLACE VIEW public.orders AS SELECT * FROM public.pending_orders;
CREATE OR REPLACE VIEW public.order_items AS SELECT * FROM public.pending_order_items;
