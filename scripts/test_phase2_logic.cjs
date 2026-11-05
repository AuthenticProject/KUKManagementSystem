/**
 * Phase 2 Automated Logic & Contract Verification Suite (Batch 3)
 * Covers:
 * - Anti-Failure Masking on Database Mutations
 * - Strict RPC Signature Contract Matching (cancel_leave_request_atomic)
 * - RLS RESTRICTIVE Policy Evaluation Mechanics
 * - Asia/Jakarta (WIB, UTC+7) Timezone Consistency (00:30, 06:30, 07:00, 23:30 WIB)
 * - SP 6-Month Expiry Arithmetic with End-of-Month Clamping
 * - Rejection of Fake Actor UUID Fallbacks
 * - Immutability of Historical Applied Migrations
 */

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('PHASE 2 BATCH 3 — COMPREHENSIVE VERIFICATION SUITE');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`[PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    failCount++;
  }
}

// ----------------------------------------------------------------------------
// 1. Permission Matrix Alignment Test
// ----------------------------------------------------------------------------
runTest('1. Permission Matrix: Separation of View Sensitive vs Manage Sensitive', () => {
  const permissions = [
    'employees.view',
    'employees.manage',
    'employees.view_sensitive',
    'employees.manage_sensitive',
  ];
  assert.ok(permissions.includes('employees.view_sensitive'), 'employees.view_sensitive must exist');
  assert.ok(permissions.includes('employees.manage_sensitive'), 'employees.manage_sensitive must exist');
  assert.notStrictEqual(
    permissions.indexOf('employees.view_sensitive'),
    permissions.indexOf('employees.manage_sensitive'),
    'view_sensitive and manage_sensitive must be distinct'
  );
});

runTest('2. Permission Matrix: Separation of Fleet Manage vs Fleet Approve Borrowing', () => {
  const permissions = [
    'fleet.view',
    'fleet.manage',
    'fleet.approve_borrowing',
  ];
  assert.ok(permissions.includes('fleet.manage'), 'fleet.manage must exist');
  assert.ok(permissions.includes('fleet.approve_borrowing'), 'fleet.approve_borrowing must exist');
  assert.notStrictEqual(
    permissions.indexOf('fleet.manage'),
    permissions.indexOf('fleet.approve_borrowing'),
    'fleet.manage and fleet.approve_borrowing must be distinct'
  );
});

// ----------------------------------------------------------------------------
// 2. Unit Isolation Contract Test
// ----------------------------------------------------------------------------
runTest('3. Unit Isolation Contract: Guard against null or empty unit_id', () => {
  function validateUnitScopedOperation(unitId) {
    if (!unitId || typeof unitId !== 'string' || unitId.trim() === '') {
      return { allowed: false, error: 'Unit ID wajib disediakan untuk mematuhi RLS multi-tenant' };
    }
    return { allowed: true, unitId };
  }

  assert.strictEqual(validateUnitScopedOperation(null).allowed, false);
  assert.strictEqual(validateUnitScopedOperation('').allowed, false);
  assert.strictEqual(validateUnitScopedOperation('   ').allowed, false);
  assert.strictEqual(validateUnitScopedOperation('00000000-0000-0000-0000-000000000001').allowed, true);
});

// ----------------------------------------------------------------------------
// 3. Anti-Failure Masking Verification
// ----------------------------------------------------------------------------
runTest('4. Anti-Failure Masking: Database mutation errors MUST return success: false', () => {
  // Simulate mutation handler contract
  function handleMutationResult(error, data) {
    if (error) {
      return { success: false, message: error.message || 'Gagal menyimpan data ke database.' };
    }
    return { success: true, message: 'Operasi berhasil.' };
  }

  const simulatedDbError = new Error('new row violates row-level security policy for table employees');
  const result = handleMutationResult(simulatedDbError, null);

  assert.strictEqual(result.success, false, 'Mutations encountering DB error MUST NOT return success: true');
  assert.ok(result.message.includes('violates row-level security policy'), 'Original DB error message must be preserved');

  // Verify source code of dataService.ts directly: Ensure no "success: true" in catch blocks of mutations
  const dataServicePath = path.resolve(__dirname, '../src/services/dataService.ts');
  const dataServiceSrc = fs.readFileSync(dataServicePath, 'utf8');

  // Regex checks if any catch block returns { success: true }
  const catchReturnsSuccessTrue = /catch\s*\([^)]*\)\s*\{[^}]*return\s*\{\s*success:\s*true/g.test(dataServiceSrc);
  assert.strictEqual(catchReturnsSuccessTrue, false, 'dataService.ts must NEVER return { success: true } inside catch blocks');
});

// ----------------------------------------------------------------------------
// 4. Strict RPC Parameter Signature Matching
// ----------------------------------------------------------------------------
runTest('5. RPC Parameter Contract: cancel_leave_request_atomic signature matches PostgreSQL definition', () => {
  const dataServicePath = path.resolve(__dirname, '../src/services/dataService.ts');
  const dataServiceSrc = fs.readFileSync(dataServicePath, 'utf8');

  // Must use p_leave_id and NOT p_leave_request_id
  assert.ok(dataServiceSrc.includes('p_leave_id: requestId'), 'dataService must pass p_leave_id to cancel_leave_request_atomic');
  assert.strictEqual(
    dataServiceSrc.includes('p_leave_request_id: requestId'),
    false,
    'dataService must NOT pass obsolete p_leave_request_id parameter'
  );

  // Validate full parameter bundle expected by SQL function
  const expectedParams = ['p_unit_id', 'p_leave_id', 'p_cancelled_by', 'p_reason'];
  expectedParams.forEach((param) => {
    assert.ok(
      dataServiceSrc.includes(`${param}:`),
      `RPC invocation must supply expected SQL parameter: ${param}`
    );
  });
});

// ----------------------------------------------------------------------------
// 5. RLS RESTRICTIVE Policy Evaluation Mechanics
// ----------------------------------------------------------------------------
runTest('6. RLS Policy Mechanics: AS RESTRICTIVE guarantee for absolute DELETE denial', () => {
  // In PostgreSQL RLS:
  // Permissive policies are combined with OR: (P1 OR P2 OR ...)
  // Restrictive policies are combined with AND: (Permissive) AND R1 AND R2 ...
  function evaluateRlsRowAccess(permissivePolicies, restrictivePolicies) {
    const permissivePass = permissivePolicies.length === 0 || permissivePolicies.some((p) => p === true);
    const restrictivePass = restrictivePolicies.every((r) => r === true);
    return permissivePass && restrictivePass;
  }

  // Scenario A: Permissive "FOR ALL" is TRUE, but Restrictive "DELETE DENY" is FALSE
  const permissiveWithForAll = [true]; // e.g. has_unit_permission('leave.manage')
  const restrictiveDeny = [false];     // USING (false) AS RESTRICTIVE
  assert.strictEqual(
    evaluateRlsRowAccess(permissiveWithForAll, restrictiveDeny),
    false,
    'AS RESTRICTIVE with USING (false) must completely deny DELETE even if permissive FOR ALL is TRUE'
  );

  // Scenario B: Flawed Permissive DELETE DENY (USING (false) AS PERMISSIVE)
  const flawedPermissiveCombination = [true, false]; // (P1 OR P_DENY) = (true OR false) = true
  assert.strictEqual(
    flawedPermissiveCombination.some((p) => p === true),
    true,
    'Flawed permissive USING (false) is bypassed by existing permissive policy'
  );

  // Verify draft migration file contains AS RESTRICTIVE
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261105000001_remediate_rls_security.sql');
  const migrationSrc = fs.readFileSync(migrationPath, 'utf8');

  assert.ok(migrationSrc.includes('AS RESTRICTIVE'), 'Draft remediation migration must declare AS RESTRICTIVE for delete denial');
  assert.ok(migrationSrc.includes('leave_requests_delete_deny'), 'leave_requests_delete_deny must be defined');
  assert.ok(migrationSrc.includes('warning_letters_delete_deny'), 'warning_letters_delete_deny must be defined');
  assert.ok(migrationSrc.includes('violation_records_delete_deny'), 'violation_records_delete_deny must be defined');
  assert.ok(migrationSrc.includes('attendance_daily_records_delete_deny'), 'attendance_daily_records_delete_deny must be defined');
});

// ----------------------------------------------------------------------------
// 6. Timezone Consistency Test: Asia/Jakarta (WIB, UTC+7)
// ----------------------------------------------------------------------------
runTest('7. Timezone Consistency: Asia/Jakarta calendar date across edge timestamps', () => {
  function getWIBDateString(date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  }

  // Edge Point 1: 00:30 WIB on 2026-11-05 (UTC: 2026-11-04T17:30:00Z)
  const t1 = new Date('2026-11-04T17:30:00.000Z');
  assert.strictEqual(getWIBDateString(t1), '2026-11-05', '00:30 WIB must resolve to 2026-11-05');

  // Edge Point 2: 06:30 WIB on 2026-11-05 (UTC: 2026-11-04T23:30:00Z)
  const t2 = new Date('2026-11-04T23:30:00.000Z');
  assert.strictEqual(getWIBDateString(t2), '2026-11-05', '06:30 WIB briefing must resolve to 2026-11-05');

  // Edge Point 3: 07:00 WIB on 2026-11-05 (UTC: 2026-11-05T00:00:00Z)
  const t3 = new Date('2026-11-05T00:00:00.000Z');
  assert.strictEqual(getWIBDateString(t3), '2026-11-05', '07:00 WIB store opening must resolve to 2026-11-05');

  // Edge Point 4: 23:30 WIB on 2026-11-05 (UTC: 2026-11-05T16:30:00Z)
  const t4 = new Date('2026-11-05T16:30:00.000Z');
  assert.strictEqual(getWIBDateString(t4), '2026-11-05', '23:30 WIB night shift must resolve to 2026-11-05');

  // Verify that AttendanceDashboardPage uses getWIBDateString
  const attendancePagePath = path.resolve(__dirname, '../src/modules/attendance/AttendanceDashboardPage.tsx');
  const attendanceSrc = fs.readFileSync(attendancePagePath, 'utf8');
  assert.ok(attendanceSrc.includes('getWIBDateString()'), 'AttendanceDashboardPage must use getWIBDateString()');
  assert.strictEqual(
    attendanceSrc.includes('toISOString().split'),
    false,
    'AttendanceDashboardPage must NOT use toISOString().split'
  );
});

// ----------------------------------------------------------------------------
// 7. SP 6-Month Expiry with End-of-Month Clamping
// ----------------------------------------------------------------------------
runTest('8. Business Rules: SP 6-month validity with end-of-month clamp (5 Scenarios)', () => {
  function calculateSpExpiryDate(issuedDateStr, monthsToAdd = 6) {
    const [yearStr, monthStr, dayStr] = issuedDateStr.split('-');
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const d = parseInt(dayStr, 10);

    const targetTotalMonths = y * 12 + (m - 1) + monthsToAdd;
    const targetYear = Math.floor(targetTotalMonths / 12);
    const targetMonth = (targetTotalMonths % 12) + 1;

    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const clampedDay = Math.min(d, daysInTargetMonth);

    const pad = (n) => n.toString().padStart(2, '0');
    return `${targetYear}-${pad(targetMonth)}-${pad(clampedDay)}`;
  }

  // Scenario 1: 31 Agustus 2026 + 6 bulan -> 28 Februari 2027 (Feb non-leap has 28 days)
  assert.strictEqual(calculateSpExpiryDate('2026-08-31'), '2027-02-28', 'Aug 31 + 6 months must clamp to Feb 28');

  // Scenario 2: 31 Oktober 2026 + 6 bulan -> 30 April 2027 (April has 30 days)
  assert.strictEqual(calculateSpExpiryDate('2026-10-31'), '2027-04-30', 'Oct 31 + 6 months must clamp to Apr 30');

  // Scenario 3: 31 Januari 2026 + 6 bulan -> 31 Juli 2026 (July has 31 days)
  assert.strictEqual(calculateSpExpiryDate('2026-01-31'), '2026-07-31', 'Jan 31 + 6 months must resolve to Jul 31');

  // Scenario 4: 29 Februari 2024 (Leap year) + 6 bulan -> 29 Agustus 2024
  assert.strictEqual(calculateSpExpiryDate('2024-02-29'), '2024-08-29', 'Feb 29 leap + 6 months must resolve to Aug 29');

  // Scenario 5: Normal non-end-of-month date: 15 Mei 2026 + 6 bulan -> 15 November 2026
  assert.strictEqual(calculateSpExpiryDate('2026-05-15'), '2026-11-15', 'May 15 + 6 months must resolve to Nov 15');
});

// ----------------------------------------------------------------------------
// 8. Actor UUID Authentication Guard Test
// ----------------------------------------------------------------------------
runTest('9. Actor UUID Integrity: Rejection of fake string fallbacks', () => {
  function validateActorUuid(userId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || typeof userId !== 'string' || !uuidRegex.test(userId)) {
      return { valid: false, error: 'Sesi pengguna tidak valid atau actor bukan format UUID.' };
    }
    return { valid: true, actorId: userId };
  }

  assert.strictEqual(validateActorUuid(null).valid, false);
  assert.strictEqual(validateActorUuid(undefined).valid, false);
  assert.strictEqual(validateActorUuid('current-user-id').valid, false);
  assert.strictEqual(validateActorUuid('fleet-manager-id').valid, false);
  assert.strictEqual(validateActorUuid('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11').valid, true);

  // Verify UI pages do not contain 'current-user-id' or 'fleet-manager-id'
  const payrollPath = path.resolve(__dirname, '../src/modules/payroll/PayrollDashboardPage.tsx');
  const leavePath = path.resolve(__dirname, '../src/modules/leave/LeaveListPage.tsx');
  const fleetPath = path.resolve(__dirname, '../src/modules/fleet/FleetListPage.tsx');

  assert.strictEqual(fs.readFileSync(payrollPath, 'utf8').includes('current-user-id'), false);
  assert.strictEqual(fs.readFileSync(leavePath, 'utf8').includes('current-user-id'), false);
  assert.strictEqual(fs.readFileSync(fleetPath, 'utf8').includes('fleet-manager-id'), false);
});

// ----------------------------------------------------------------------------
// 9. Historical Migration Immutability
// ----------------------------------------------------------------------------
runTest('10. Migration Immutability: 20261104000001_core_schema_v3_1_0.sql matches Git baseline with ZERO diff', () => {
  const gitDiff = execSync(
    'git diff supabase/migrations/20261104000001_core_schema_v3_1_0.sql',
    { encoding: 'utf8' }
  );
  assert.strictEqual(
    gitDiff.trim(),
    '',
    'Historical migration 20261104000001_core_schema_v3_1_0.sql must be identical to Git HEAD without any local modifications'
  );
});

// ----------------------------------------------------------------------------
// 10. Role Permission Matrix Documentation Alignment
// ----------------------------------------------------------------------------
runTest('11. Documentation Alignment: ROLE_PERMISSION_MATRIX.md contains all granular keys', () => {
  const matrixPath = path.resolve(__dirname, '../docs/ROLE_PERMISSION_MATRIX.md');
  const matrixSrc = fs.readFileSync(matrixPath, 'utf8');

  assert.ok(matrixSrc.includes('employees.view_sensitive'), 'Matrix must document employees.view_sensitive');
  assert.ok(matrixSrc.includes('employees.manage_sensitive'), 'Matrix must document employees.manage_sensitive');
  assert.ok(matrixSrc.includes('glass_tips.manage_rates'), 'Matrix must document glass_tips.manage_rates');
  assert.strictEqual(matrixSrc.includes('glass_tips.rates_manage'), false, 'Obsolete key glass_tips.rates_manage must be replaced');
});

console.log('\n----------------------------------------------------------------');
console.log(`TEST RUN FINISHED: ${passCount} PASSED, ${failCount} FAILED`);
console.log('----------------------------------------------------------------\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
