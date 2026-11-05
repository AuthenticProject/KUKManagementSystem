import fs from 'fs';

const sql = fs.readFileSync('supabase/migrations/20261104000002_harden_rpc_security.sql', 'utf8');

console.log('=== 1. STATIC SQL & SYNTAX CHECKS ===');

// 1. Transaction wrapping
const hasBegin = /^BEGIN;/m.test(sql);
const hasCommit = /^COMMIT;/m.test(sql);
console.log(`- Transaction boundary: BEGIN=${hasBegin}, COMMIT=${hasCommit}`);

// 2. Count dollar quote delimiters
const dollarMatches = sql.match(/\$\$/g);
console.log(`- Dollar quote count: ${dollarMatches ? dollarMatches.length : 0} (Even=${dollarMatches && dollarMatches.length % 2 === 0})`);

// 3. Check function signatures in CREATE OR REPLACE FUNCTION
const createMatches = [...sql.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(([\s\S]*?)\)/gi)];
console.log(`- Functions redefined count: ${createMatches.length}`);
for (const m of createMatches) {
  console.log(`  * ${m[1]}(${m[2].trim().replace(/\s+/g, ' ')})`);
}

// 4. Check REVOKE & GRANT signatures
const revokeMatches = [...sql.matchAll(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s+FROM\s+([a-z0-9_,\s]+);/gi)];
console.log(`\n- REVOKE Statements (${revokeMatches.length}):`);
for (const m of revokeMatches) {
  console.log(`  * REVOKE public.${m[1]}(${m[2].trim()}) FROM ${m[3].trim()}`);
}

const grantMatches = [...sql.matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s+TO\s+([a-z0-9_,\s]+);/gi)];
console.log(`- GRANT Statements (${grantMatches.length}):`);
for (const m of grantMatches) {
  console.log(`  * GRANT public.${m[1]}(${m[2].trim()}) TO ${m[3].trim()}`);
}

console.log('\n=== 2. REVISION & HARDENING CHECKS ===');
const checks = [
  { name: 'Payroll: auth.uid() check', test: /auth\.uid\(\)\s+IS\s+NULL/i.test(sql) },
  { name: 'Payroll: anti-spoofing check (p_finalized_by != auth.uid())', test: /p_finalized_by\s*!=\s*auth\.uid\(\)/i.test(sql) },
  { name: 'Payroll: permission check (payroll.manage)', test: /has_unit_permission\(\s*p_unit_id\s*,\s*'payroll\.manage'\s*\)/i.test(sql) },
  { name: 'Payroll: FOR UPDATE lock on payroll_periods', test: /FROM\s+payroll_periods[\s\S]*?FOR\s+UPDATE/i.test(sql) },
  { name: 'Payroll: status whitelist (DRAFT, CALCULATED)', test: /v_period\.status\s+NOT\s+IN\s+\('DRAFT',\s*'CALCULATED'\)/i.test(sql) },
  { name: 'Payroll: explicit unit_id on UPDATE payroll_records', test: /UPDATE\s+payroll_records[\s\S]*?WHERE\s+id\s*=\s*v_slip_id\s+AND\s+unit_id\s*=\s*p_unit_id/i.test(sql) },
  { name: 'Payroll: explicit unit_id on UPDATE payroll_periods', test: /UPDATE\s+payroll_periods[\s\S]*?WHERE\s+id\s*=\s*p_payroll_period_id\s+AND\s+unit_id\s*=\s*p_unit_id/i.test(sql) },
  { name: 'Payroll: Strict Least Privilege (GRANT ONLY authenticated)', test: /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.calculate_and_finalize_payroll_atomic\([^\)]*\)\s+TO\s+authenticated;/i.test(sql) && !/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.calculate_and_finalize_payroll_atomic\([^\)]*\)\s+TO[^\n;]*service_role/i.test(sql) },
  { name: 'Cancel leave: auth.uid() check', test: /auth\.uid\(\)\s+IS\s+NULL/i.test(sql) },
  { name: 'Cancel leave: anti-spoofing check (p_cancelled_by != auth.uid())', test: /p_cancelled_by\s*!=\s*auth\.uid\(\)/i.test(sql) },
  { name: 'Cancel leave: permission check (leave.manage)', test: /has_unit_permission\(\s*p_unit_id\s*,\s*'leave\.manage'\s*\)/i.test(sql) },
  { name: 'Cancel leave: absence of phantom permission leave.approve', test: !/leave\.approve/i.test(sql) },
  { name: 'Cancel leave: FOR UPDATE lock on leave_requests', test: /FROM\s+leave_requests[\s\S]*?FOR\s+UPDATE/i.test(sql) },
  { name: 'Cancel leave: explicit unit_id on UPDATE leave_requests', test: /UPDATE\s+leave_requests[\s\S]*?WHERE\s+id\s*=\s*p_leave_id\s+AND\s+unit_id\s*=\s*p_unit_id/i.test(sql) },
  { name: 'Cancel leave: Strict Least Privilege (GRANT ONLY authenticated)', test: /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cancel_leave_request_atomic\([^\)]*\)\s+TO\s+authenticated;/i.test(sql) && !/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.cancel_leave_request_atomic\([^\)]*\)\s+TO[^\n;]*service_role/i.test(sql) }
];

let allPassed = true;
for (const c of checks) {
  if (!c.test) allPassed = false;
  console.log(`  [${c.test ? 'PASS' : 'FAIL'}] ${c.name}`);
}

console.log(`\nOverall Hardening Check Status: ${allPassed ? 'ALL PASSED' : 'SOME CHECKS FAILED'}`);

console.log('\n=== 3. REGRESSION & COMPARISON CHECK ===');
// Verify essential business operations are retained from 20261104000001
const regChecks = [
  { name: 'Payroll: generate_document_number_atomic call', test: /generate_document_number_atomic\(p_unit_id,\s*'SLIP',\s*v_period_key\)/.test(sql) },
  { name: 'Payroll: INSERT INTO payroll_records with RETURNING id', test: /INSERT INTO payroll_records[\s\S]*?RETURNING id INTO v_slip_id/.test(sql) },
  { name: 'Payroll: INSERT INTO payroll_items (Gaji Pokok)', test: /INSERT INTO payroll_items[\s\S]*?'Gaji Pokok',\s*'ALLOWANCE',\s*v_emp\.base_salary/.test(sql) },
  { name: 'Payroll: Loop dynamic salary components', test: /FROM employee_salary_component_items sci/.test(sql) },
  { name: 'Payroll: Sum and link verified glass_tips', test: /FROM glass_tips[\s\S]*?UPDATE glass_tips/.test(sql) },
  { name: 'Payroll: INSERT INTO audit_logs', test: /INSERT INTO audit_logs[\s\S]*?'FINALIZATION',\s*'payroll_periods'/.test(sql) },
  { name: 'Cancel Leave: Release conflict slots', test: /UPDATE leave_conflict_slots\s+SET is_active = FALSE/.test(sql) },
  { name: 'Cancel Leave: Update request to CANCELLED', test: /SET status = 'CANCELLED'/.test(sql) },
  { name: 'Cancel Leave: INSERT INTO audit_logs', test: /INSERT INTO audit_logs[\s\S]*?'UPDATE_CANCEL',\s*'leave_requests'/.test(sql) },
  { name: 'Kiosk Leave: Accessible to anon', test: /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_leave_request_atomic[^\n;]*TO\s+anon/i.test(sql) },
  { name: 'Kiosk Fleet: Accessible to anon', test: /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.book_vehicle_atomic[^\n;]*TO\s+anon/i.test(sql) },
  { name: 'Helper RLS: Accessible to anon', test: /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.has_unit_permission[^\n;]*TO\s+anon/i.test(sql) }
];

let allRegPassed = true;
for (const r of regChecks) {
  if (!r.test) allRegPassed = false;
  console.log(`  [${r.test ? 'PASS' : 'FAIL'}] ${r.name}`);
}
console.log(`\nOverall Regression Check Status: ${allRegPassed ? 'ALL PASSED' : 'SOME CHECKS FAILED'}`);
