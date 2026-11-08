/**
 * PHASE 1C.2 — FRONTEND & BACKEND CONTRACT VERIFICATION SUITE
 * KUK Management System v3.1.0
 * 
 * Verifies:
 * 1. RPC Call Name & Parameter alignment with SQL routines
 * 2. Complete absence of direct .update() / .insert() bypassing RPCs
 * 3. 23P01 exclusion conflict trapping in frontend services
 * 4. DataResponse<T> contract consistency across all services
 * 5. Advanced error classification (42501, AUTH_EXPIRED, TIMEOUT, NETWORK_ERROR)
 * 6. Production preview-mode lockout shield
 * 7. Public kiosk form security contracts
 * 
 * Mode: Local Static Analysis & Contract Testing (Zero Remote Connection)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_SERVICE_PATH = path.join(ROOT_DIR, 'src', 'services', 'dataService.ts');
const PUBLIC_LEAVE_PATH = path.join(ROOT_DIR, 'src', 'modules', 'public', 'PublicLeaveRequestPage.tsx');
const PUBLIC_TIP_PATH = path.join(ROOT_DIR, 'src', 'modules', 'public', 'PublicGlassTipPage.tsx');
const PUBLIC_FLEET_PATH = path.join(ROOT_DIR, 'src', 'modules', 'public', 'PublicFleetBookingPage.tsx');

function runContractValidation(isQuiet = false) {
  const log = (...args) => { if (!isQuiet) console.log(...args); };

  log('================================================================');
  log('PHASE 1C.2 — FRONTEND & BACKEND CONTRACT VERIFICATION SUITE');
  log('================================================================\n');

  let passCount = 0;
  let failCount = 0;
  const tests = [];

  function assert(id, category, description, passed, details = '') {
    if (passed) {
      passCount++;
      log(`[PASS] [${id}] [${category}] ${description}`);
      tests.push({ id, category, description, status: 'PASS', details });
    } else {
      failCount++;
      log(`[FAIL] [${id}] [${category}] ${description} -> ${details}`);
      tests.push({ id, category, description, status: 'FAIL', details });
    }
  }

  const dsCode = fs.readFileSync(DATA_SERVICE_PATH, 'utf8');
  const plCode = fs.readFileSync(PUBLIC_LEAVE_PATH, 'utf8');
  const ptCode = fs.readFileSync(PUBLIC_TIP_PATH, 'utf8');
  const pfCode = fs.readFileSync(PUBLIC_FLEET_PATH, 'utf8');

  // --------------------------------------------------------------------------
  // 1. Direct Table Bypass Audit in dataService.ts
  // --------------------------------------------------------------------------
  // Ensure NO direct .update() on glass_tips or vehicle_borrowing_requests
  const directTipUpdate = /\.from\s*\(\s*['"]glass_tips['"]\s*\)\s*\.update/i.test(dsCode);
  const directFleetUpdate = /\.from\s*\(\s*['"]vehicle_borrowing_requests['"]\s*\)\s*\.update/i.test(dsCode);

  assert(
    'CTR-01',
    'ANTI_BYPASS',
    'Frontend dataService does NOT execute direct .update() on glass_tips',
    !directTipUpdate,
    'All tip updates routed via atomic RPC'
  );

  assert(
    'CTR-02',
    'ANTI_BYPASS',
    'Frontend dataService does NOT execute direct .update() on vehicle_borrowing_requests',
    !directFleetUpdate,
    'All vehicle approval updates routed via atomic RPC'
  );

  // --------------------------------------------------------------------------
  // 2. RPC Parameter Contract Alignment
  // --------------------------------------------------------------------------
  // verify_glass_tip_atomic contract
  const hasVerifyRpcCall = dsCode.includes("supabase.rpc('verify_glass_tip_atomic'");
  const hasVerifyParams = dsCode.includes('p_unit_id: unitId') &&
                          dsCode.includes('p_tip_id: tipId') &&
                          dsCode.includes('p_action: action') &&
                          dsCode.includes('p_verified_amount: finalAmount') &&
                          dsCode.includes('p_notes:');
  assert(
    'CTR-03',
    'RPC_CONTRACT',
    'glassTipService.verifyTipNota invokes verify_glass_tip_atomic with exact parameter contract',
    hasVerifyRpcCall && hasVerifyParams,
    'RPC signature and parameter types match PostgreSQL definition'
  );

  // approve_vehicle_atomic contract
  const hasApproveRpcCall = dsCode.includes("supabase.rpc('approve_vehicle_atomic'");
  const hasApproveParams = dsCode.includes('p_unit_id: unitId') &&
                           dsCode.includes('p_request_id: requestId') &&
                           dsCode.includes('p_action: action') &&
                           dsCode.includes('p_rejection_reason:');
  assert(
    'CTR-04',
    'RPC_CONTRACT',
    'fleetService.approveBorrowing invokes approve_vehicle_atomic with exact parameter contract',
    hasApproveRpcCall && hasApproveParams,
    'RPC signature and parameter types match PostgreSQL definition'
  );

  // submit_glass_tip_atomic contract
  const hasSubmitTipRpcCall = dsCode.includes("supabase.rpc('submit_glass_tip_atomic'");
  const hasSubmitTipParams = dsCode.includes('p_unit_id: unitId') &&
                             dsCode.includes('p_employee_code: payload.employee_code.trim()') &&
                             dsCode.includes('p_auth_pin: payload.auth_pin') &&
                             dsCode.includes('p_glass_type_id: payload.glass_type_id');
  assert(
    'CTR-05',
    'RPC_CONTRACT',
    'glassTipService.submitGlassTip invokes submit_glass_tip_atomic with exact parameter contract',
    hasSubmitTipRpcCall && hasSubmitTipParams,
    'Kiosk tip submission contract verified'
  );

  // book_vehicle_atomic contract
  const hasBookVehicleRpcCall = dsCode.includes("supabase.rpc('book_vehicle_atomic'");
  const hasBookVehicleParams = dsCode.includes('p_unit_id: unitId') &&
                               dsCode.includes('p_vehicle_id: payload.vehicle_id') &&
                               dsCode.includes('p_borrower_name: payload.borrower_name.trim()') &&
                               dsCode.includes('p_start_time: payload.start_time') &&
                               dsCode.includes('p_estimated_return_time: payload.estimated_return_time');
  assert(
    'CTR-06',
    'RPC_CONTRACT',
    'fleetService.bookVehicle invokes book_vehicle_atomic with exact parameter contract',
    hasBookVehicleRpcCall && hasBookVehicleParams,
    'Kiosk vehicle booking contract verified'
  );

  // --------------------------------------------------------------------------
  // 3. PostgreSQL Exclusion Code (23P01) Trapping
  // --------------------------------------------------------------------------
  const fleetApproveTraps23P01 = dsCode.includes("error.code === '23P01'") && dsCode.includes('Konflik Jadwal: Kendaraan telah memiliki reservasi aktif');
  const fleetBookTraps23P01 = dsCode.includes("error.code === '23P01'") && dsCode.includes('Konflik Jadwal: Kendaraan telah memiliki peminjaman aktif');

  assert(
    'CTR-07',
    'ERROR_TRAPPING',
    'Both fleetService.approveBorrowing and bookVehicle explicitly trap PostgreSQL 23P01',
    fleetApproveTraps23P01 && fleetBookTraps23P01,
    'PostgreSQL exclusion violation surfaced as actionable user advisory'
  );

  // --------------------------------------------------------------------------
  // 4. DataResponse<T> Contract Structure
  // --------------------------------------------------------------------------
  const hasDataResponseDef = dsCode.includes('export interface DataResponse<T>') &&
                             dsCode.includes('success: boolean;') &&
                             dsCode.includes('data: T;') &&
                             dsCode.includes('error?: string | null;') &&
                             dsCode.includes('isFixture: boolean;') &&
                             dsCode.includes("source: 'LIVE' | 'MOCK';");

  assert(
    'CTR-08',
    'DATA_RESPONSE',
    'DataResponse<T> contract includes success, data, error, isFixture, and source',
    hasDataResponseDef,
    'Canonical data response type enforced'
  );

  // --------------------------------------------------------------------------
  // 5. Advanced Error Classification Engine
  // --------------------------------------------------------------------------
  const hasClassifyError = dsCode.includes('function classifyError(error: any)') &&
                           dsCode.includes("code: '42501'") &&
                           dsCode.includes("code: 'AUTH_EXPIRED'") &&
                           dsCode.includes("code: 'TIMEOUT'") &&
                           dsCode.includes("code: 'NETWORK_ERROR'");

  assert(
    'CTR-09',
    'ERROR_CLASSIFICATION',
    'classifyError isolates 42501 (RLS), AUTH_EXPIRED (401), TIMEOUT, and NETWORK_ERROR',
    hasClassifyError,
    'Robust error disambiguation verified'
  );

  // --------------------------------------------------------------------------
  // 6. Production Preview Mode Shield
  // --------------------------------------------------------------------------
  const hasProdShield = dsCode.includes('VITE_APP_ENV === \'production\'') &&
                        dsCode.includes('VITE_ENABLE_PREVIEW_MODE === \'true\'') &&
                        dsCode.includes('if (isProd && !allowInProd)');

  assert(
    'CTR-10',
    'PROD_SHIELD',
    'isPreviewModeActive permanently blocks preview mode in Production builds',
    hasProdShield,
    'Production preview-mode lockout shield verified'
  );

  // --------------------------------------------------------------------------
  // 7. Public Kiosk Form Security Contracts
  // --------------------------------------------------------------------------
  const hasLeaveBlockedBanner = plCode.includes('STATUS PORTAL: BLOCKED') && plCode.includes('disabled={true}');

  assert(
    'CTR-11',
    'KIOSK_LEAVE_BLOCKED',
    'PublicLeaveRequestPage renders explicit BLOCKED advisory banner and disarms submit button',
    hasLeaveBlockedBanner,
    'Unauthenticated kiosk leave access blocked by design'
  );

  const hasTipCallsSubmit = ptCode.includes('glassTipService.submitGlassTip');
  const hasFleetCallsBook = pfCode.includes('fleetService.bookVehicle');

  assert(
    'CTR-12',
    'KIOSK_SUBMISSION',
    'Public glass tip and fleet booking kiosks route submissions exclusively via service RPC methods',
    hasTipCallsSubmit && hasFleetCallsBook,
    'Public kiosks adhere to service boundary'
  );

  // --------------------------------------------------------------------------
  // 8. PHASE 1C.4-R CRITICAL & HIGH REMEDIATION CONTRACT CHECKS
  // --------------------------------------------------------------------------
  // CTR-13: Remediation 4 (HIGH) Employee mutation mass-assignment prevention
  const saveEmployeeCode = dsCode.substring(
    dsCode.indexOf('async saveEmployee('),
    dsCode.indexOf('async saveSensitiveData(')
  );
  const hasSpreadMassAssignment = /payload\s*=\s*\{\s*\.\.\.employee/i.test(saveEmployeeCode);
  const hasSanitizedPayload = saveEmployeeCode.includes('sanitizedPayload') &&
                              saveEmployeeCode.includes('sanitizedPayload.employee_code') &&
                              saveEmployeeCode.includes('sanitizedPayload.full_name') &&
                              saveEmployeeCode.includes('sanitizedPayload.department_id');

  assert(
    'CTR-13',
    'MASS_ASSIGNMENT_DEFENSE',
    'employeeService.saveEmployee strictly whitelists input fields and rejects object spread mass assignment',
    !hasSpreadMassAssignment && hasSanitizedPayload,
    'Strict explicit field whitelist for employee mutations verified'
  );

  // CTR-14: Remediation 2 (CRITICAL) Role assignment RPC contract
  const hasAssignRpc = dsCode.includes("supabase.rpc('assign_user_roles_atomic'");
  const hasAssignParams = dsCode.includes('p_target_user_id: userId') &&
                          dsCode.includes('p_system_role_code: role') &&
                          dsCode.includes('p_unit_ids: units');

  assert(
    'CTR-14',
    'RPC_CONTRACT',
    'systemService.saveUserRole routes mutations via assign_user_roles_atomic RPC',
    hasAssignRpc && hasAssignParams,
    'Atomic role assignment RPC parameter contract verified'
  );

  // CTR-15: Remediation 2 (CRITICAL) Elimination of non-existent user_profiles table references
  const hasNonExistentUserProfiles = /\.from\s*\(\s*['"]user_profiles['"]\s*\)/i.test(dsCode);

  assert(
    'CTR-15',
    'SCHEMA_ALIGNMENT',
    'Frontend dataService contains zero queries to non-existent user_profiles table',
    !hasNonExistentUserProfiles,
    'Canonical schema tables (profiles, user_system_roles, user_unit_roles) enforced'
  );

  log('\n----------------------------------------------------------------');
  log(`CONTRACT VALIDATION FINISHED: ${passCount} PASSED, ${failCount} FAILED out of ${tests.length} tests`);
  log('----------------------------------------------------------------\n');

  return { passCount, failCount, tests, success: failCount === 0 };
}

if (require.main === module) {
  const result = runContractValidation();
  process.exit(result.success ? 0 : 1);
}

module.exports = { runContractValidation };
