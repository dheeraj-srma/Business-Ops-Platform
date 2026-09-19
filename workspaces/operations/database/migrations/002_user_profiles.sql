-- Migration 002: User Profiles Table, Security Helper Functions & Policies
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

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

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
