import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy_anon_key';

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn(
    '[Supabase Configuration] VITE_SUPABASE_URL tidak didefinisikan. Menggunakan fallback lokal staging.'
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

