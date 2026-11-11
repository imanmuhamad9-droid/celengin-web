import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cek apakah variabel benar-benar ada
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Supabase URL atau Key tidak ditemukan di Vercel. URL: ${supabaseUrl ? 'Ada' : 'Kosong'}, Key: ${supabaseAnonKey ? 'Ada' : 'Kosong'}`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);