-- Migration 005: System Settings Table & Default Seed
CREATE TABLE IF NOT EXISTS public.system_settings (
  setting TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

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

INSERT INTO public.system_settings (setting, value, updated_at)
VALUES ('allow_negative_orders', 'false'::jsonb, NOW())
ON CONFLICT (setting) DO NOTHING;
