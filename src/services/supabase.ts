import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ckzciuybedefbsdfsexh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Q8N64Hiqq7hYAG69F6Fs5g_hveDpB7N';

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.info(
    '[Supabase Configuration] Menggunakan konfigurasi default Supabase.'
  );
}

// Inisialisasi Supabase Client dengan konfigurasi penyimpanan sesi yang aman
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

