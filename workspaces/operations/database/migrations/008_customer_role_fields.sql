-- Migration 008: Add Customer role fields to user_profiles table
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS location_id TEXT;

-- Update role check constraint to include customer, salesman, manager, admin, staff
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('salesman', 'customer', 'admin', 'manager', 'employee', 'staff'));

-- Create index for customer fields
CREATE INDEX IF NOT EXISTS idx_user_profiles_customer_name ON public.user_profiles(customer_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_shop_name ON public.user_profiles(shop_name);
