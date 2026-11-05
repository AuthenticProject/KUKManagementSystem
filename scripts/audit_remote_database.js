import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ckzciuybedefbsdfsexh.supabase.co';
const supabaseKey = 'sb_publishable_Q8N64Hiqq7hYAG69F6Fs5g_hveDpB7N';

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditRemoteDb() {
  console.log('=== AUDITING REMOTE SUPABASE DATABASE (ckzciuybedefbsdfsexh) ===');

  // 1. Check Tables via PostgREST
  const sampleTables = ['organizations', 'units', 'profiles', 'employees', 'leave_requests', 'vehicles', 'audit_logs'];
  const tableResults = {};
  for (const t of sampleTables) {
    const { data, error, status } = await supabase.from(t).select('*').limit(1);
    tableResults[t] = { status, error: error?.message || null };
  }
  console.log('[1] Table probe results:\n', JSON.stringify(tableResults, null, 2));

  // 2. Check Storage Buckets
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    console.log('[2] Storage buckets status:', res.status);
    const buckets = await res.json();
    console.log('    Buckets:', buckets);
  } catch (e) {
    console.log('[2] Storage bucket check error:', e.message);
  }

  // 3. Check Auth Settings
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    console.log('[3] Auth settings status:', res.status);
    const settings = await res.json();
    console.log('    Disable signup:', settings.disable_signup);
    console.log('    Mailer autoconfirm:', settings.mailer_autoconfirm);
  } catch (e) {
    console.log('[3] Auth check error:', e.message);
  }
}

auditRemoteDb();

