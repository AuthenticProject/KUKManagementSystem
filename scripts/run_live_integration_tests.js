import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ckzciuybedefbsdfsexh.supabase.co';
const supabaseAnonKey = 'sb_publishable_Q8N64Hiqq7hYAG69F6Fs5g_hveDpB7N';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runLiveTests() {
  console.log('====================================================');
  console.log('KUK MANAGEMENT SYSTEM v3.1.0 — LIVE INTEGRATION TEST');
  console.log('Target: Supabase Cloud ckzciuybedefbsdfsexh (Production)');
  console.log('====================================================\n');

  const results = [];

  // TEST 1: Supabase Client Connectivity
  try {
    const start = Date.now();
    const { data, error, status } = await supabase.from('units').select('count', { count: 'exact', head: true });
    const elapsed = Date.now() - start;
    if (status === 200 || status === 206) {
      results.push({ id: 'INT-01', name: 'Supabase Cloud Client Connectivity', status: 'PASS', detail: `Connected in ${elapsed}ms (HTTP ${status})` });
    } else {
      results.push({ id: 'INT-01', name: 'Supabase Cloud Client Connectivity', status: 'FAIL', detail: error?.message || `HTTP ${status}` });
    }
  } catch (err) {
    results.push({ id: 'INT-01', name: 'Supabase Cloud Client Connectivity', status: 'FAIL', detail: err.message });
  }

  // TEST 2: Auth Login with Invalid Credentials
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'nonexistent_test_user@kuk.co.id',
      password: 'WrongPassword123!'
    });
    if (error && (error.message.includes('Invalid login credentials') || error.status === 400)) {
      results.push({ id: 'INT-02', name: 'Supabase Auth Rejection on Invalid Credentials', status: 'PASS', detail: `Correctly rejected: "${error.message}" (HTTP ${error.status})` });
    } else if (data?.user) {
      results.push({ id: 'INT-02', name: 'Supabase Auth Rejection on Invalid Credentials', status: 'FAIL', detail: 'Unexpectedly logged in with invalid credentials!' });
    } else {
      results.push({ id: 'INT-02', name: 'Supabase Auth Rejection on Invalid Credentials', status: 'FAIL', detail: error?.message || 'Unknown response' });
    }
  } catch (err) {
    results.push({ id: 'INT-02', name: 'Supabase Auth Rejection on Invalid Credentials', status: 'FAIL', detail: err.message });
  }

  // TEST 3: Auth Session Restoration with Null Session
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (!error && session === null) {
      results.push({ id: 'INT-03', name: 'Session State on Unauthenticated Client', status: 'PASS', detail: 'Clean null session returned, no phantom session' });
    } else {
      results.push({ id: 'INT-03', name: 'Session State on Unauthenticated Client', status: 'FAIL', detail: error?.message || 'Unexpected session found' });
    }
  } catch (err) {
    results.push({ id: 'INT-03', name: 'Session State on Unauthenticated Client', status: 'FAIL', detail: err.message });
  }

  // TEST 4: Direct Unauthenticated SELECT on Protected Table (organizations)
  try {
    const { data, error } = await supabase.from('organizations').select('*');
    // Organizations policy: "organizations_read_authenticated" TO authenticated USING (true)
    // Anonymous user should receive empty array (0 rows) due to RLS
    if (!error && Array.isArray(data) && data.length === 0) {
      results.push({ id: 'INT-04', name: 'RLS Anon Isolation on organizations', status: 'PASS', detail: 'Anon received 0 rows (RLS enforced)' });
    } else if (data && data.length > 0) {
      results.push({ id: 'INT-04', name: 'RLS Anon Isolation on organizations', status: 'FAIL', detail: `Data leak! Anon received ${data.length} rows` });
    } else {
      results.push({ id: 'INT-04', name: 'RLS Anon Isolation on organizations', status: 'PASS', detail: `Blocked/Empty: ${error?.message || 'Empty'}` });
    }
  } catch (err) {
    results.push({ id: 'INT-04', name: 'RLS Anon Isolation on organizations', status: 'FAIL', detail: err.message });
  }

  // TEST 5: Direct Unauthenticated INSERT on Protected Table (organizations)
  try {
    const { data, error } = await supabase.from('organizations').insert({
      code: 'ILLEGAL-INSERT',
      name: 'Illegal Org Attempt'
    });
    // Policy requires super_admin
    if (error) {
      results.push({ id: 'INT-05', name: 'RLS Anon Block on INSERT organizations', status: 'PASS', detail: `Correctly rejected by RLS: "${error.message}"` });
    } else {
      results.push({ id: 'INT-05', name: 'RLS Anon Block on INSERT organizations', status: 'FAIL', detail: 'CRITICAL SECURITY BREACH: Anon allowed to insert into organizations!' });
    }
  } catch (err) {
    results.push({ id: 'INT-05', name: 'RLS Anon Block on INSERT organizations', status: 'FAIL', detail: err.message });
  }

  // TEST 6: Direct Unauthenticated INSERT on Protected Table (employees)
  try {
    const { data, error } = await supabase.from('employees').insert({
      nik: '000000',
      full_name: 'Illegal Employee'
    });
    if (error) {
      results.push({ id: 'INT-06', name: 'RLS Anon Block on INSERT employees', status: 'PASS', detail: `Correctly rejected by RLS: "${error.message}"` });
    } else {
      results.push({ id: 'INT-06', name: 'RLS Anon Block on INSERT employees', status: 'FAIL', detail: 'CRITICAL SECURITY BREACH: Anon allowed to insert into employees!' });
    }
  } catch (err) {
    results.push({ id: 'INT-06', name: 'RLS Anon Block on INSERT employees', status: 'FAIL', detail: err.message });
  }

  // TEST 7: Direct Unauthenticated SELECT on Payroll Records
  try {
    const { data, error } = await supabase.from('payroll_records').select('*');
    if (!error && Array.isArray(data) && data.length === 0) {
      results.push({ id: 'INT-07', name: 'RLS Anon Isolation on payroll_records', status: 'PASS', detail: 'Anon cannot access payroll records (0 rows returned)' });
    } else if (data && data.length > 0) {
      results.push({ id: 'INT-07', name: 'RLS Anon Isolation on payroll_records', status: 'FAIL', detail: 'CRITICAL LEAK: Payroll records accessible to anon!' });
    } else {
      results.push({ id: 'INT-07', name: 'RLS Anon Isolation on payroll_records', status: 'PASS', detail: `Protected: ${error?.message}` });
    }
  } catch (err) {
    results.push({ id: 'INT-07', name: 'RLS Anon Isolation on payroll_records', status: 'FAIL', detail: err.message });
  }

  // TEST 8: Direct Unauthenticated SELECT on audit_logs
  try {
    const { data, error } = await supabase.from('audit_logs').select('*');
    if (!error && Array.isArray(data) && data.length === 0) {
      results.push({ id: 'INT-08', name: 'RLS Anon Isolation on audit_logs', status: 'PASS', detail: 'Anon cannot access audit logs (0 rows returned)' });
    } else if (data && data.length > 0) {
      results.push({ id: 'INT-08', name: 'RLS Anon Isolation on audit_logs', status: 'FAIL', detail: 'CRITICAL LEAK: Audit logs accessible to anon!' });
    } else {
      results.push({ id: 'INT-08', name: 'RLS Anon Isolation on audit_logs', status: 'PASS', detail: `Protected: ${error?.message}` });
    }
  } catch (err) {
    results.push({ id: 'INT-08', name: 'RLS Anon Isolation on audit_logs', status: 'FAIL', detail: err.message });
  }

  // TEST 9: Legitimate Anon Read on Vehicles (policy: vehicles_read_anon)
  try {
    // Policy allows anon to select vehicles WHERE status = 'AVAILABLE' AND is_active = true
    const { data, error, status } = await supabase.from('vehicles').select('*');
    if (status === 200) {
      results.push({ id: 'INT-09', name: 'Legitimate Anon Access on vehicles (AVAILABLE only)', status: 'PASS', detail: `Allowed per policy vehicles_read_anon (HTTP 200, count: ${data?.length || 0})` });
    } else {
      results.push({ id: 'INT-09', name: 'Legitimate Anon Access on vehicles (AVAILABLE only)', status: 'FAIL', detail: error?.message });
    }
  } catch (err) {
    results.push({ id: 'INT-09', name: 'Legitimate Anon Access on vehicles (AVAILABLE only)', status: 'FAIL', detail: err.message });
  }

  // TEST 10: RPC Execution & Validation via REST API (generate_document_number_atomic)
  try {
    const { data, error } = await supabase.rpc('generate_document_number_atomic', {
      p_unit_id: '00000000-0000-0000-0000-000000000000',
      p_doc_type: 'LEAVE',
      p_period_key: '202611'
    });
    if (error && error.message.includes('Unit ID tidak valid')) {
      results.push({ id: 'INT-10', name: 'RPC Validation Logic Enforcement (Document Number)', status: 'PASS', detail: `Correctly validated unit existence: "${error.message}"` });
    } else if (data) {
      results.push({ id: 'INT-10', name: 'RPC Validation Logic Enforcement (Document Number)', status: 'FAIL', detail: `Generated number for non-existent unit: ${data}` });
    } else {
      results.push({ id: 'INT-10', name: 'RPC Validation Logic Enforcement (Document Number)', status: 'FAIL', detail: error?.message });
    }
  } catch (err) {
    results.push({ id: 'INT-10', name: 'RPC Validation Logic Enforcement (Document Number)', status: 'FAIL', detail: err.message });
  }

  // TEST 11: RPC book_vehicle_atomic Validation
  try {
    const { data, error } = await supabase.rpc('book_vehicle_atomic', {
      p_unit_id: '00000000-0000-0000-0000-000000000000',
      p_vehicle_id: '00000000-0000-0000-0000-000000000000',
      p_borrower_name: 'Test Borrower',
      p_borrower_institution: 'Test Inst',
      p_borrower_phone: '08123456789',
      p_responsible_person: 'Responsible Person',
      p_start_time: new Date().toISOString(),
      p_estimated_return_time: new Date(Date.now() + 86400000).toISOString(),
      p_destination: 'Test Destination',
      p_purpose: 'Test Purpose'
    });
    if (error && (error.message.includes('Kendaraan tidak ditemukan') || error.code === 'P0001')) {
      results.push({ id: 'INT-11', name: 'RPC Validation Logic Enforcement (Vehicle Booking)', status: 'PASS', detail: `Correctly validated vehicle: "${error.message}"` });
    } else {
      results.push({ id: 'INT-11', name: 'RPC Validation Logic Enforcement (Vehicle Booking)', status: 'FAIL', detail: error?.message || 'Unexpected response' });
    }
  } catch (err) {
    results.push({ id: 'INT-11', name: 'RPC Validation Logic Enforcement (Vehicle Booking)', status: 'FAIL', detail: err.message });
  }

  // TEST 12: RPC submit_leave_request_atomic Validation
  try {
    const { data, error } = await supabase.rpc('submit_leave_request_atomic', {
      p_unit_id: '00000000-0000-0000-0000-000000000000',
      p_employee_id: '00000000-0000-0000-0000-000000000000',
      p_auth_pin: '123456',
      p_target_month: '2026-11',
      p_leave_dates: ['2026-11-10'],
      p_reason: 'Testing validation',
      p_client_ip: '127.0.0.1',
      p_user_agent: 'TestAgent/1.0'
    });
    if (error && (error.message.includes('Karyawan tidak ditemukan') || error.code === 'P0001')) {
      results.push({ id: 'INT-12', name: 'RPC Validation Logic Enforcement (Leave Request)', status: 'PASS', detail: `Correctly validated employee: "${error.message}"` });
    } else {
      results.push({ id: 'INT-12', name: 'RPC Validation Logic Enforcement (Leave Request)', status: 'FAIL', detail: error?.message || 'Unexpected response' });
    }
  } catch (err) {
    results.push({ id: 'INT-12', name: 'RPC Validation Logic Enforcement (Leave Request)', status: 'FAIL', detail: err.message });
  }

  console.log('\n=== LIVE TEST EXECUTION SUMMARY ===\n');
  results.forEach(r => {
    console.log(`[${r.status}] ${r.id}: ${r.name}`);
    console.log(`       Detail: ${r.detail}`);
  });

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  console.log(`\nTOTAL: ${results.length} | PASS: ${passCount} | FAIL: ${failCount}`);

  return results;
}

runLiveTests();

