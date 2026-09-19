import { createClient } from '@supabase/supabase-js';

const meta = import.meta as any;
const SUPABASE_URL = meta.env?.VITE_SUPABASE_URL || 'https://xbsikbexdpsyrstnptug.supabase.co';
const SUPABASE_ANON_KEY = meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhic2lrYmV4ZHBzeXJzdG5wdHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMDAwMDAsImV4cCI6MjA1NzU3NjAwMH0.sample';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
