const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261105000002_security_rpc_and_remediation.sql');
const dataServicePath = path.join(__dirname, '..', 'src', 'services', 'dataService.ts');

if (!fs.existsSync(migrationPath)) {
  console.error(`ERROR: Target migration file does not exist: ${migrationPath}`);
  process.exit(1);
}
if (!fs.existsSync(dataServicePath)) {
  console.error(`ERROR: Target frontend file does not exist: ${dataServicePath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');
const dataServiceCode = fs.readFileSync(dataServicePath, 'utf8');

console.log('================================================================');
console.log('BATCH B.3 — FINAL SQL SECURITY SPECIFICATION & INTEGRATION VALIDATOR');
console.log(`Migration File: ${migrationPath} (${Buffer.byteLength(sql, 'utf8')} bytes)`);
console.log(`Frontend Service: ${dataServicePath} (${Buffer.byteLength(dataServiceCode, 'utf8')} bytes)`);
console.log('================================================================\n');

// 1. Parse SQL Structure
const hasBegin = /^BEGIN;/m.test(sql);
const hasCommit = /^COMMIT;/m.test(sql);
const dollarMatches = sql.match(/\$\$/g);
const dollarCount = dollarMatches ? dollarMatches.length : 0;

// 2. Parse RPC Functions
const functionRegex = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS\s+([a-z0-9_]+)/gi;
let fMatch;
const functions = [];
while ((fMatch = functionRegex.exec(sql)) !== null) {
  functions.push({
    name: fMatch[1],
    params: fMatch[2].trim().replace(/\s+/g, ' '),
    returns: fMatch[3]
  });
}

// 3. Parse search_path Configurations
const searchPaths = [...sql.matchAll(/SET\s+search_path\s*=\s*([^;\n]+)/gi)].map(m => m[1].trim());

// 4. Parse Policies
const policyRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+public\.([a-z0-9_]+)\s+(AS\s+RESTRICTIVE\s+)?FOR\s+([A-Z]+)\s+TO\s+([a-z0-9_]+)/gi;
let pMatch;
const policies = [];
while ((pMatch = policyRegex.exec(sql)) !== null) {
  policies.push({
    name: pMatch[1],
    table: pMatch[2],
    restrictive: !!pMatch[3],
    command: pMatch[4],
    role: pMatch[5]
  });
}

// 4.1. Extract Specific Function Bodies for Granular Inspection
const bookVehicleAtomicStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.book_vehicle_atomic');
const approveVehicleAtomicStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.approve_vehicle_atomic');
const bookVehicleAtomicBody = bookVehicleAtomicStart !== -1 && approveVehicleAtomicStart !== -1
  ? sql.substring(bookVehicleAtomicStart, approveVehicleAtomicStart)
  : '';

// 5. Restrictive DELETE Policy Table-Policy Pairs Verification
const restrictiveDeletePolicies = policies.filter(p => p.restrictive && p.command === 'DELETE');

// Required exact pairs
const requiredCompliancePairs = [
  { table: 'leave_requests', policy: 'leave_requests_delete_deny', altPolicy: 'leave_requests_deny_delete' },
  { table: 'warning_letters', policy: 'warning_letters_delete_deny', altPolicy: 'warning_letters_deny_delete' },
  { table: 'violation_records', policy: 'violation_records_delete_deny', altPolicy: 'violation_records_deny_delete' },
  { table: 'attendance_daily_records', policy: 'attendance_daily_records_delete_deny', altPolicy: 'attendance_daily_records_deny_delete' }
];

// Check each required pair strictly
const pairsValid = requiredCompliancePairs.every(req => {
  return restrictiveDeletePolicies.some(p => 
    p.table === req.table && 
    (p.name === req.policy || p.name === req.altPolicy) &&
    p.command === 'DELETE' &&
    p.restrictive === true &&
    p.role === 'authenticated'
  );
});

// Check that NO non-compliance tables have restrictive DELETE
const invalidRestrictiveTables = restrictiveDeletePolicies
  .map(p => p.table)
  .filter(t => !requiredCompliancePairs.some(req => req.table === t));

// 6. Security Assertions
const assertions = [
  // A. SQL Structure
  {
    category: 'SQL_STRUCTURE',
    name: 'Migration wrapped in valid BEGIN; ... COMMIT; transaction boundary',
    pass: hasBegin && hasCommit
  },
  {
    category: 'SQL_STRUCTURE',
    name: 'Balanced $$ quote delimiters across all PL/pgSQL function bodies',
    pass: dollarCount > 0 && dollarCount % 2 === 0
  },
  {
    category: 'SQL_STRUCTURE',
    name: 'Exactly 7 functions defined (5 core business RPCs + 2 rate-limit & maintenance helpers)',
    pass: functions.length === 7 && functions.some(f => f.name === 'check_and_increment_rate_limit') && functions.some(f => f.name === 'cleanup_expired_rate_limits')
  },

  // B. CRIT: EXECUTE Privilege Revocation from PUBLIC
  {
    category: 'CRIT_EXECUTE',
    name: 'submit_glass_tip_atomic explicitly REVOKES EXECUTE from PUBLIC before granting',
    pass: /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_glass_tip_atomic[^\n;]*FROM\s+PUBLIC;/i.test(sql)
  },
  {
    category: 'CRIT_EXECUTE',
    name: 'submit_glass_tip_atomic GRANTS EXECUTE specifically to anon, authenticated, service_role',
    pass: /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_glass_tip_atomic[^\n;]*TO\s+anon,\s*authenticated,\s*service_role;/i.test(sql)
  },
  {
    category: 'CRIT_EXECUTE',
    name: 'book_vehicle_atomic explicitly REVOKES EXECUTE from PUBLIC before granting',
    pass: /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.book_vehicle_atomic[^\n;]*FROM\s+PUBLIC;/i.test(sql)
  },
  {
    category: 'CRIT_EXECUTE',
    name: 'book_vehicle_atomic GRANTS EXECUTE specifically to anon, authenticated, service_role',
    pass: /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.book_vehicle_atomic[^\n;]*TO\s+anon,\s*authenticated,\s*service_role;/i.test(sql)
  },
  {
    category: 'CRIT_EXECUTE',
    name: 'check_and_increment_rate_limit REVOKES EXECUTE from PUBLIC, anon, authenticated',
    pass: /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.check_and_increment_rate_limit[^\n;]*FROM\s+PUBLIC,\s*anon,\s*authenticated;/i.test(sql)
  },
  {
    category: 'CRIT_EXECUTE',
    name: 'Administrative RPCs (reset_pin, verify_tip, approve_vehicle) REVOKE EXECUTE from PUBLIC and anon',
    pass: /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.reset_employee_kiosk_pin[^\n;]*FROM\s+PUBLIC,\s*anon;/i.test(sql) &&
          /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.verify_glass_tip_atomic[^\n;]*FROM\s+PUBLIC,\s*anon;/i.test(sql) &&
          /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.approve_vehicle_atomic[^\n;]*FROM\s+PUBLIC,\s*anon;/i.test(sql)
  },
  {
    category: 'CRIT_EXECUTE',
    name: 'Administrative RPCs GRANT EXECUTE strictly to authenticated, service_role only',
    pass: /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.reset_employee_kiosk_pin[^\n;]*TO\s+authenticated,\s*service_role;/i.test(sql) &&
          /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.verify_glass_tip_atomic[^\n;]*TO\s+authenticated,\s*service_role;/i.test(sql) &&
          /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.approve_vehicle_atomic[^\n;]*TO\s+authenticated,\s*service_role;/i.test(sql)
  },

  // C. HIGH: Restrictive DELETE Table-Policy Pairs
  {
    category: 'HIGH_RLS_RESTRICTIVE',
    name: 'All 4 compliance tables matched exactly with their respective RESTRICTIVE DELETE policies',
    pass: pairsValid && restrictiveDeletePolicies.length === 4
  },
  {
    category: 'HIGH_RLS_RESTRICTIVE',
    name: 'NO RESTRICTIVE DELETE policies erroneously assigned to glass_tips, vehicle_borrowing_requests, audit_logs, or public_form_tokens',
    pass: invalidRestrictiveTables.length === 0
  },

  // D. HIGH: search_path Configuration
  {
    category: 'HIGH_SEARCH_PATH',
    name: 'All 7 SECURITY DEFINER functions enforce "SET search_path = public, extensions, pg_temp" with pg_temp last',
    pass: searchPaths.length === 7 && searchPaths.every(sp => sp === 'public, extensions, pg_temp')
  },

  // E. CRIT: Direct Table Access Revocation & RLS Dropping
  {
    category: 'CRIT_TABLE_GRANTS',
    name: 'Direct INSERT and UPDATE on glass_tips revoked from anon, authenticated, PUBLIC',
    pass: /REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.glass_tips\s+FROM\s+anon,\s*authenticated,\s*PUBLIC;/i.test(sql) &&
          /REVOKE\s+UPDATE\s+ON\s+TABLE\s+public\.glass_tips\s+FROM\s+anon,\s*authenticated,\s*PUBLIC;/i.test(sql)
  },
  {
    category: 'CRIT_TABLE_GRANTS',
    name: 'Direct INSERT and UPDATE on vehicle_borrowing_requests revoked from anon, authenticated, PUBLIC',
    pass: /REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.vehicle_borrowing_requests\s+FROM\s+anon,\s*authenticated,\s*PUBLIC;/i.test(sql) &&
          /REVOKE\s+UPDATE\s+ON\s+TABLE\s+public\.vehicle_borrowing_requests\s+FROM\s+anon,\s*authenticated,\s*PUBLIC;/i.test(sql)
  },
  {
    category: 'CRIT_TABLE_GRANTS',
    name: 'Direct INSERT on audit_logs revoked from anon and PUBLIC',
    pass: /REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.audit_logs\s+FROM\s+anon,\s*PUBLIC;/i.test(sql)
  },
  {
    category: 'CRIT_TABLE_GRANTS',
    name: 'Direct access on dormant public_form_tokens revoked from anon, authenticated, and PUBLIC',
    pass: /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.public_form_tokens\s+FROM\s+anon,\s*authenticated,\s*PUBLIC;/i.test(sql)
  },
  {
    category: 'HIGH_AUDIT_SPOOFING',
    name: 'audit_logs_insert policy enforces WITH CHECK (actor_id = auth.uid()) and drops permissive check',
    pass: /CREATE\s+POLICY\s+"audit_logs_insert"\s+ON\s+public\.audit_logs\s+FOR\s+INSERT\s+TO\s+authenticated\s+WITH\s+CHECK\s*\(\s*actor_id\s*=\s*auth\.uid\(\)\s*\);/i.test(sql)
  },

  // F. CRIT: Database-Side Rate Limiting (Option 2 Implementation)
  {
    category: 'CRIT_RATE_LIMITING',
    name: 'Dedicated rpc_rate_limits table created with RLS enabled and direct access revoked from anon, authenticated, PUBLIC',
    pass: /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.rpc_rate_limits/i.test(sql) &&
          /ALTER\s+TABLE\s+public\.rpc_rate_limits\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/i.test(sql) &&
          /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.rpc_rate_limits\s+FROM\s+anon,\s*authenticated,\s*PUBLIC;/i.test(sql)
  },
  {
    category: 'CRIT_RATE_LIMITING',
    name: 'check_and_increment_rate_limit uses concurrency loop with SELECT FOR UPDATE and handles unique_violation',
    pass: /LOOP[\s\S]*?SELECT\s+\*\s+INTO\s+v_rec\s+FROM\s+rpc_rate_limits\s+WHERE\s+bucket_key\s*=\s*p_bucket_key\s+FOR\s+UPDATE;[\s\S]*?WHEN\s+unique_violation\s+THEN[\s\S]*?END\s+LOOP;/i.test(sql)
  },
  {
    category: 'CRIT_RATE_LIMITING',
    name: 'submit_glass_tip_atomic enforces rate limit on client IP and employee code',
    pass: /check_and_increment_rate_limit\('tip_ip:'\s*\|\|\s*v_client_ip/i.test(sql) &&
          /check_and_increment_rate_limit\('tip_emp:'\s*\|\|\s*p_unit_id::text/i.test(sql)
  },
  {
    category: 'CRIT_RATE_LIMITING',
    name: 'book_vehicle_atomic enforces rate limit on client IP and vehicle ID',
    pass: /check_and_increment_rate_limit\('book_ip:'\s*\|\|\s*v_client_ip/i.test(sql) &&
          /check_and_increment_rate_limit\('book_veh:'\s*\|\|\s*p_vehicle_id::text/i.test(sql)
  },
  {
    category: 'CRIT_RATE_LIMITING',
    name: 'book_vehicle_atomic returns JSONB on validation and rate limit failure without unhandled RAISE EXCEPTION',
    pass: /RETURN\s+jsonb_build_object\s*\(\s*'success'\s*,\s*false\s*,\s*'code'\s*,\s*'RATE_LIMIT_EXCEEDED'/i.test(bookVehicleAtomicBody) &&
          !/RAISE\s+EXCEPTION/i.test(bookVehicleAtomicBody)
  },
  {
    category: 'CRIT_RATE_LIMITING',
    name: 'cleanup_expired_rate_limits maintenance function created and granted strictly to service_role',
    pass: /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.cleanup_expired_rate_limits/i.test(sql) &&
          /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cleanup_expired_rate_limits[^\n;]*FROM\s+PUBLIC,\s*anon,\s*authenticated;/i.test(sql) &&
          /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cleanup_expired_rate_limits[^\n;]*TO\s+service_role;/i.test(sql)
  },

  // G. HIGH: Row Count Integrity & NULL Safety
  {
    category: 'HIGH_ROW_COUNT',
    name: 'reset_employee_kiosk_pin checks GET DIAGNOSTICS ROW_COUNT and rejects 0 rows modified',
    pass: /GET\s+DIAGNOSTICS\s+v_rows_affected\s*=\s*ROW_COUNT;/i.test(sql) &&
          /IF\s+v_rows_affected\s*=\s*0\s+THEN[\s\S]*?'NO_ROWS_MODIFIED'/i.test(sql)
  },
  {
    category: 'HIGH_NULL_SAFETY',
    name: 'reset_employee_kiosk_pin and submit_glass_tip_atomic use IS DISTINCT FROM for employee status check',
    pass: (sql.match(/status\s+IS\s+DISTINCT\s+FROM\s+'ACTIVE'/gi) || []).length >= 2
  },
  {
    category: 'HIGH_NULL_SAFETY',
    name: 'submit_glass_tip_atomic safely handles failed_attempts addition with COALESCE',
    pass: /v_new_attempts\s*:=\s*COALESCE\(v_auth\.failed_attempts,\s*0\)\s*\+\s*1;/i.test(sql)
  },
  {
    category: 'HIGH_TIP_SNAPSHOT',
    name: 'tip_percentage_snapshot constraint relaxed (DROP NOT NULL/DEFAULT) and avoids arbitrary 3% fallback',
    pass: /ALTER\s+TABLE\s+public\.glass_tips\s+ALTER\s+COLUMN\s+tip_percentage_snapshot\s+DROP\s+NOT\s+NULL;/i.test(sql) &&
          /ALTER\s+TABLE\s+public\.glass_tips\s+ALTER\s+COLUMN\s+tip_percentage_snapshot\s+DROP\s+DEFAULT;/i.test(sql) &&
          /CASE\s+WHEN\s+v_rate\.calculation_method\s*=\s*'PERCENTAGE'\s+AND\s+v_rate\.base_rate\s+BETWEEN\s+0\s+AND\s+1\s+THEN\s+v_rate\.base_rate\s+ELSE\s+NULL\s+END/i.test(sql)
  },
  {
    category: 'HIGH_FORMAT_LITERAL',
    name: 'to_char properly quotes literal WIB inside format mask ("WIB")',
    pass: /to_char\(v_auth\.locked_until\s+AT\s+TIME\s+ZONE\s+'Asia\/Jakarta',\s*'HH24:MI:SS\s+"WIB"'\)/i.test(sql)
  },

  // H. CRIT: Kiosk PIN Lockout & Timing Hardening
  {
    category: 'CRIT_KIOSK_PIN',
    name: 'submit_glass_tip_atomic validates PIN NOT NULL and exact 6-digits format regex ^[0-9]{6}$',
    pass: /p_auth_pin\s+IS\s+NULL\s+OR\s+length\(p_auth_pin\)\s*!=\s*6\s+OR\s+p_auth_pin\s*!~\s*'\^\[0-9\]\{6\}\$'/i.test(sql)
  },
  {
    category: 'CRIT_KIOSK_PIN',
    name: 'submit_glass_tip_atomic uses IS DISTINCT FROM for null-safe hash comparison',
    pass: /v_auth\.pin_hash\s+IS\s+DISTINCT\s+FROM\s+v_calculated_hash/i.test(sql)
  },
  {
    category: 'CRIT_KIOSK_PIN',
    name: 'submit_glass_tip_atomic runs dummy bcrypt timing defense when employee not found or PIN invalid',
    pass: /crypt\(COALESCE\(p_auth_pin,\s*'000000'\),\s*'\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'\)/i.test(sql)
  },
  {
    category: 'CRIT_KIOSK_PIN',
    name: 'submit_glass_tip_atomic persists failed_attempts and returns JSONB without exception rollback',
    pass: /UPDATE\s+employee_portal_auth\s+SET\s+failed_attempts\s*=\s*v_new_attempts/i.test(sql) &&
          /jsonb_build_object\s*\(\s*'success'\s*,\s*false\s*,\s*'code'\s*,\s*'AUTH_FAILED'/i.test(sql) &&
          /jsonb_build_object\s*\(\s*'success'\s*,\s*false\s*,\s*'code'\s*,\s*'ACCOUNT_LOCKED'/i.test(sql)
  },
  {
    category: 'HIGH_MULTI_TENANT',
    name: 'reset_employee_kiosk_pin enforces unit isolation in ON CONFLICT UPDATE clause',
    pass: /WHERE\s+employee_portal_auth\.unit_id\s*=\s*p_unit_id;/i.test(sql)
  },

  // I. HIGH & MEDIUM: Vehicle Booking & Approval Integrity
  {
    category: 'HIGH_VEHICLE',
    name: 'book_vehicle_atomic validates borrower, phone, responsible person, destination, purpose non-empty',
    pass: /TRIM\(p_borrower_name\)\s*=\s*''/i.test(sql) &&
          /TRIM\(p_borrower_phone\)\s*=\s*''/i.test(sql) &&
          /TRIM\(p_responsible_person\)\s*=\s*''/i.test(sql) &&
          /TRIM\(p_destination\)\s*=\s*''/i.test(sql) &&
          /TRIM\(p_purpose\)\s*=\s*''/i.test(sql)
  },
  {
    category: 'HIGH_VEHICLE',
    name: 'book_vehicle_atomic enforces 15-minute past tolerance and 30-day max duration limit',
    pass: /p_start_time\s*<\s*\((clock_timestamp\(\)|now\(\))\s*-\s*INTERVAL\s*'15 minutes'\)/i.test(bookVehicleAtomicBody) &&
          /p_estimated_return_time\s*>\s*\(p_start_time\s*\+\s*INTERVAL\s*'30 days'\)/i.test(bookVehicleAtomicBody)
  },
  {
    category: 'HIGH_VEHICLE',
    name: 'approve_vehicle_atomic specifically traps PostgreSQL exclusion_violation (23P01)',
    pass: /WHEN\s+exclusion_violation\s+THEN/i.test(sql) && /ERRCODE\s*=\s*'23P01'/i.test(sql)
  },
  {
    category: 'HIGH_VEHICLE',
    name: 'approve_vehicle_atomic handles optional rejection reason with default fallback',
    pass: /cancellation_reason\s*=\s*COALESCE\(p_rejection_reason,\s*'Ditolak oleh petugas armada'\)/i.test(sql)
  },

  // J. MEDIUM: Glass Tip Verification & Free-Text Length Bounds
  {
    category: 'MEDIUM_GLASS_TIP',
    name: 'verify_glass_tip_atomic rejects NULL or invalid action (strictly VERIFY or REJECT)',
    pass: /p_action\s+IS\s+NULL\s+OR\s+p_action\s+NOT\s+IN\s*\('VERIFY',\s*'REJECT'\)/i.test(sql)
  },
  {
    category: 'MEDIUM_GLASS_TIP',
    name: 'verify_glass_tip_atomic rejects verified_amount if action is REJECT',
    pass: /p_action\s*=\s*'REJECT'\s+AND\s+p_verified_amount\s+IS\s+NOT\s+NULL/i.test(sql)
  },
  {
    category: 'MEDIUM_INPUT_BOUNDS',
    name: 'Free-text input length upper bounds enforced (500 chars on notes and rejection reasons)',
    pass: /p_rejection_reason\s+IS\s+NOT\s+NULL\s+AND\s+length\(p_rejection_reason\)\s*>\s*500/i.test(sql) &&
          /p_notes\s+IS\s+NOT\s+NULL\s+AND\s+length\(p_notes\)\s*>\s*500/i.test(sql)
  },

  // K. FRONTEND INTEGRATION: No direct UPDATE and proper RPC usage
  {
    category: 'FRONTEND_RPC',
    name: 'Frontend dataService does NOT execute direct .update() on glass_tips',
    pass: !/\.from\(['"]glass_tips['"]\)\s*\.update\(/i.test(dataServiceCode)
  },
  {
    category: 'FRONTEND_RPC',
    name: 'Frontend dataService does NOT execute direct .update() on vehicle_borrowing_requests',
    pass: !/\.from\(['"]vehicle_borrowing_requests['"]\)\s*\.update\(/i.test(dataServiceCode)
  },
  {
    category: 'FRONTEND_RPC',
    name: 'Frontend glassTipService.verifyTipNota calls RPC verify_glass_tip_atomic with exact parameters',
    pass: /\.rpc\(['"]verify_glass_tip_atomic['"],\s*\{[\s\S]*?p_unit_id[\s\S]*?p_tip_id[\s\S]*?p_action[\s\S]*?p_verified_amount[\s\S]*?p_notes/i.test(dataServiceCode)
  },
  {
    category: 'FRONTEND_RPC',
    name: 'Frontend fleetService.approveBorrowing calls RPC approve_vehicle_atomic with exact parameters and traps 23P01',
    pass: /\.rpc\(['"]approve_vehicle_atomic['"],\s*\{[\s\S]*?p_unit_id[\s\S]*?p_request_id[\s\S]*?p_action[\s\S]*?p_rejection_reason/i.test(dataServiceCode) &&
          /23P01/i.test(dataServiceCode)
  },
  {
    category: 'FRONTEND_RPC',
    name: 'Frontend dataService checks data.success === false and propagates failure without masking',
    pass: /data\.success\s*===\s*false/i.test(dataServiceCode)
  }
];

let allPass = true;
let passCount = 0;
let failCount = 0;

console.log('--- EXECUTING BATCH B.3 COMPREHENSIVE SECURITY ASSERTIONS ---');
assertions.forEach((a, idx) => {
  if (a.pass) {
    passCount++;
    console.log(`[PASS] #${String(idx + 1).padStart(2, '0')} [${a.category}] ${a.name}`);
  } else {
    failCount++;
    allPass = false;
    console.log(`[FAIL] #${String(idx + 1).padStart(2, '0')} [${a.category}] ${a.name}`);
  }
});

console.log('\n================================================================');
console.log(`VALIDATION RESULT: ${passCount} PASSED, ${failCount} FAILED out of ${assertions.length} total assertions.`);
console.log(`Status: ${allPass ? 'ALL AUDIT CHECKS PASSED (BATCH B.3 READY FOR REVIEW)' : 'AUDIT FAILED'}`);
console.log('================================================================');

console.log('\n[LIMITATION NOTICE] This validator executes static AST/regex analysis on local files.');
console.log('It does NOT execute statements on a live PostgreSQL engine or Supabase remote.');
console.log('PostgreSQL catalog checks and runtime query executions remain strictly UNPERFORMED / NOT TESTED.');

process.exit(allPass ? 0 : 1);
