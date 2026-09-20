import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[key]) {
      return (import.meta as any).env[key];
    }
  } catch {
    // import.meta unavailable in Next.js Edge / Webpack context
  }
  return '';
};

const SUPABASE_URL =
  getEnvVar('NEXT_PUBLIC_SUPABASE_URL') ||
  getEnvVar('SUPABASE_URL') ||
  getEnvVar('VITE_SUPABASE_URL') ||
  'https://deqrfmjzoxlirgfhuouh.supabase.co';

const SUPABASE_ANON_KEY =
  getEnvVar('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
  getEnvVar('SUPABASE_ANON_KEY') ||
  getEnvVar('VITE_SUPABASE_ANON_KEY') ||
  'sb_publishable_bvWbNpkJMLzR0NOgQTOFQQ_C-G9N-2P';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
