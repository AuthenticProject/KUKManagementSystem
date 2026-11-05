import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ckzciuybedefbsdfsexh.supabase.co';
const supabaseKey = 'sb_publishable_Q8N64Hiqq7hYAG69F6Fs5g_hveDpB7N';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRemoteDetails() {
  console.log('=== CHECKING REMOTE FUNCTIONS AND POLICIES ===');

  // Test has_system_role RPC
  const { data: roleData, error: roleError } = await supabase.rpc('has_system_role', { p_role_code: 'super_admin' });
  console.log('Function has_system_role:', roleError ? `Error: ${roleError.message}` : `Data: ${roleData}`);

  // Test has_unit_access RPC
  const { data: unitData, error: unitError } = await supabase.rpc('has_unit_access', { p_unit_id: '00000000-0000-0000-0000-000000000000' });
  console.log('Function has_unit_access:', unitError ? `Error: ${unitError.message}` : `Data: ${unitData}`);

  // Test generate_document_number_atomic RPC
  const { data: docData, error: docError } = await supabase.rpc('generate_document_number_atomic', {
    p_unit_id: '00000000-0000-0000-0000-000000000000',
    p_doc_type: 'LEAVE',
    p_prefix: 'LV'
  });
  console.log('Function generate_document_number_atomic:', docError ? `Error: ${docError.message}` : `Data: ${docData}`);

  // Test public anon insert on organizations (should be rejected by RLS if RLS is enabled)
  const { data: insData, error: insError } = await supabase.from('organizations').insert({
    code: 'TEST-UNAUTH',
    name: 'Unauthorized Org'
  });
  console.log('Anon INSERT on organizations (RLS check):', insError ? `REJECTED: ${insError.message}` : 'ALLOWED (RLS NOT ACTIVE!)');
}

checkRemoteDetails();

