import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// 1. Baca konfigurasi dari .env tanpa mencetak nilai rahasia
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*([^\r\n]+)/);

if (!urlMatch || !keyMatch) {
  console.error('[FATAL] VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY tidak ditemukan di .env');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = keyMatch[1].trim();

// 2. Inisialisasi Dedicated Anon Client (Zero Session Leaks)
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function runBatch3Http() {
  console.log('=== EXECUTION OF BATCH 3: HTTP GET VIA DEDICATED ANON CLIENT ===\n');

  // --- CMD-HTTP-01: organizations ---
  const time01 = new Date().toISOString();
  console.log(`[${time01}] Running CMD-HTTP-01: GET /rest/v1/organizations?select=id ...`);
  const res01 = await anonClient.from('organizations').select('id', { count: 'exact' });
  console.log(`Result CMD-HTTP-01: Status = ${res01.status}, Count = ${res01.count}, DataLength = ${res01.data?.length ?? 0}, Error = ${res01.error ? JSON.stringify(res01.error) : 'null'}\n`);

  // --- CMD-HTTP-02: employees ---
  const time02 = new Date().toISOString();
  console.log(`[${time02}] Running CMD-HTTP-02: GET /rest/v1/employees?select=id ...`);
  const res02 = await anonClient.from('employees').select('id', { count: 'exact' });
  console.log(`Result CMD-HTTP-02: Status = ${res02.status}, Count = ${res02.count}, DataLength = ${res02.data?.length ?? 0}, Error = ${res02.error ? JSON.stringify(res02.error) : 'null'}\n`);

  // --- CMD-HTTP-03: vehicles AVAILABLE ---
  const time03 = new Date().toISOString();
  console.log(`[${time03}] Running CMD-HTTP-03: GET /rest/v1/vehicles?status=eq.AVAILABLE&select=id ...`);
  const res03 = await anonClient.from('vehicles').select('id', { count: 'exact' }).eq('status', 'AVAILABLE');
  console.log(`Result CMD-HTTP-03: Status = ${res03.status}, Count = ${res03.count}, DataLength = ${res03.data?.length ?? 0}, Error = ${res03.error ? JSON.stringify(res03.error) : 'null'}\n`);

  // --- CMD-HTTP-04: vehicles MAINTENANCE ---
  const time04 = new Date().toISOString();
  console.log(`[${time04}] Running CMD-HTTP-04: GET /rest/v1/vehicles?status=eq.MAINTENANCE&select=id ...`);
  const res04 = await anonClient.from('vehicles').select('id', { count: 'exact' }).eq('status', 'MAINTENANCE');
  console.log(`Result CMD-HTTP-04: Status = ${res04.status}, Count = ${res04.count}, DataLength = ${res04.data?.length ?? 0}, Error = ${res04.error ? JSON.stringify(res04.error) : 'null'}\n`);

  console.log('=== BATCH 3 HTTP EXECUTION COMPLETE ===');
}

runBatch3Http();

