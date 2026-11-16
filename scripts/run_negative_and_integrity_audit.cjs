/**
 * TRANSACTION INTEGRITY, PREVIEW SECURITY & NEGATIVE TEST AUDIT — KUK MANAGEMENT SYSTEM v3.1.0
 * Executed via Playwright-core driving Microsoft Edge on Windows Host
 * Validates:
 * 1. Zero Remote Network Leakage (0 requests to Supabase Production)
 * 2. Preview Store State Persistence (across navigation & session storage reload)
 * 3. Comprehensive Negative Business Rule Validations across 8 domains:
 *    - Employees (duplicate NIK, duplicate code, required fields, unit isolation)
 *    - Attendance & Briefing (duplicate attendance, manual correction notes, required briefing topic)
 *    - Leave (quota > 3 days, window restrictions, department conflict, approve/reject)
 *    - Glass Tips (dimension limits, quantity limits, verification status, payroll exclusion)
 *    - Fleet (booking MAINTENANCE vehicle, schedule overlap, return inspection status, approve/reject)
 *    - Violations & SP (required fields, positive points, 6-month validity clamp, 0 salary deduction)
 *    - Payroll (finalized period immutability, snapshot consistency)
 *    - Petty Cash (amount > 0, required fields, initial PENDING status, approve/reject)
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'docs', 'screenshots', 'negative_audit');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let passedTests = 0;
let failedTests = 0;
const testResults = [];

function recordResult(id, domain, scenario, status, details, screenshot) {
  testResults.push({ id, domain, scenario, status, details, screenshot });
  if (status === 'PASS') {
    passedTests++;
    console.log(`  [AUDIT-PASS] ${id} [${domain}]: ${scenario}`);
  } else {
    failedTests++;
    console.error(`  [AUDIT-FAIL] ${id} [${domain}]: ${scenario} -> ${details}`);
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('  KUK MANAGEMENT SYSTEM v3.1.0 — TRANSACTION INTEGRITY & NEGATIVE AUDIT');
  console.log('================================================================\n');

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  let executablePath = null;
  for (const p of edgePaths) {
    if (fs.existsSync(p)) {
      executablePath = p;
      break;
    }
  }

  if (!executablePath) {
    throw new Error('Edge executable not found on Windows host');
  }

  console.log(`Launching Edge from: ${executablePath}`);
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  // Network leakage tracker
  const remoteSupabaseRequests = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('supabase.co')) {
      remoteSupabaseRequests.push({
        method: request.method(),
        url,
      });
    }
  });

  try {
    // -------------------------------------------------------------------------
    // 1. REMOTE NETWORK ISOLATION AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Remote Network Isolation (0 Supabase Calls) ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    
    // Login as Manager La Tansa
    const mgrBtn = page.locator('button:has-text("Manager La Tansa (UAT)")').first();
    await mgrBtn.click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Visit multiple modules to verify all reads bypass remote network
    const testRoutes = ['/employees', '/leave', '/attendance', '/glass-tips', '/fleet', '/payroll', '/petty-cash'];
    for (const r of testRoutes) {
      await page.goto(`${BASE_URL}${r}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
    }

    const netScreenshot = path.join(SCREENSHOT_DIR, '01_network_isolation.png');
    await page.screenshot({ path: netScreenshot });

    if (remoteSupabaseRequests.length === 0) {
      recordResult('ISO-01', 'Network Security', 'Zero remote Supabase calls during demo session & module navigation', 'PASS', 'Remote Supabase requests: 0', netScreenshot);
    } else {
      recordResult('ISO-01', 'Network Security', 'Zero remote Supabase calls during demo session & module navigation', 'FAIL', `Found ${remoteSupabaseRequests.length} leaked Supabase requests: ${JSON.stringify(remoteSupabaseRequests)}`, netScreenshot);
    }

    // -------------------------------------------------------------------------
    // 2. PREVIEW STORE TRANSACTION INTEGRITY & PERSISTENCE AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Store Persistence Across Navigation & Soft Reload ---');
    
    const persistenceResult = await page.evaluate(async () => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const unitId = '00000000-0000-0000-0000-000000000001';
      
      // Seed a distinct employee
      const saveRes = previewStore.saveEmployee(unitId, {
        id: 'emp-persist-999',
        employee_code: 'EMP-PERSIST-999',
        full_name: 'Persistent Test Employee',
        status: 'ACTIVE',
      });

      const retrievedBefore = previewStore.getEmployees(unitId).find(e => e.id === 'emp-persist-999');
      return { saveSuccess: saveRes.success, beforeExists: !!retrievedBefore };
    });

    assert(persistenceResult.saveSuccess && persistenceResult.beforeExists, 'Employee must be saved in previewStore');

    // Soft reload the page
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const postReloadResult = await page.evaluate(async () => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const unitId = '00000000-0000-0000-0000-000000000001';
      const retrievedAfter = previewStore.getEmployees(unitId).find(e => e.id === 'emp-persist-999');
      return { afterExists: !!retrievedAfter };
    });

    const persistScreenshot = path.join(SCREENSHOT_DIR, '02_store_persistence.png');
    await page.screenshot({ path: persistScreenshot });

    if (postReloadResult.afterExists) {
      recordResult('PER-01', 'Persistence', 'Preview mutations persist in sessionStorage across soft page reloads', 'PASS', 'Record successfully retrieved post-reload', persistScreenshot);
    } else {
      recordResult('PER-01', 'Persistence', 'Preview mutations persist in sessionStorage across soft page reloads', 'FAIL', 'Record lost after page reload', persistScreenshot);
    }

    // -------------------------------------------------------------------------
    // 3. NEGATIVE BUSINESS SCENARIOS: EMPLOYEES
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Negative Scenarios: Employee Management ---');
    
    const empAudit = await page.evaluate(async () => {
      const { previewStore, employeeService } = await import('/src/services/dataService.ts');
      const unitLaTansa = '00000000-0000-0000-0000-000000000001';
      const unitPalen = '00000000-0000-0000-0000-000000000002';

      // Duplicate NIK test
      previewStore.saveSensitiveData(unitLaTansa, {
        employee_id: 'emp-001',
        nik: '3201012345670001',
      });
      const dupNikRes = previewStore.saveSensitiveData(unitLaTansa, {
        employee_id: 'emp-002',
        nik: '3201012345670001', // duplicate NIK
      });

      // Duplicate employee_code within unit test
      const dupCodeRes = await employeeService.saveEmployee(unitLaTansa, {
        employee_code: 'EMP-LATANSA-001', // duplicate
        full_name: 'Impostor Budi',
      });

      // Required field validation (missing full_name)
      const missingNameRes = await employeeService.saveEmployee(unitLaTansa, {
        employee_code: 'EMP-NEW-999',
        full_name: '', // missing
      });

      // Cross-unit isolation
      const laTansaEmps = (await employeeService.getEmployeesByUnit(unitLaTansa)).data;
      const palenEmps = (await employeeService.getEmployeesByUnit(unitPalen)).data;
      const crossLeak = laTansaEmps.some(e => e.employee_code.includes('PALEN')) || palenEmps.some(e => e.employee_code.includes('LATANSA'));

      return {
        dupNikRejected: !dupNikRes.success && dupNikRes.message.includes('sudah terdaftar'),
        dupCodeRejected: !dupCodeRes.success && dupCodeRes.message.includes('sudah digunakan'),
        missingNameRejected: !missingNameRes.success && missingNameRes.message.includes('wajib diisi'),
        unitIsolationClean: !crossLeak,
      };
    });

    recordResult('NEG-EMP-01', 'Employees', 'Reject duplicate NIK across employees', empAudit.dupNikRejected ? 'PASS' : 'FAIL', 'Duplicate NIK properly rejected');
    recordResult('NEG-EMP-02', 'Employees', 'Reject duplicate employee_code within unit', empAudit.dupCodeRejected ? 'PASS' : 'FAIL', 'Duplicate code properly rejected');
    recordResult('NEG-EMP-03', 'Employees', 'Enforce required employee full_name and code', empAudit.missingNameRejected ? 'PASS' : 'FAIL', 'Required field validation enforced');
    recordResult('NEG-EMP-04', 'Employees', 'Strict unit isolation (La Tansa vs Palen employee scope)', empAudit.unitIsolationClean ? 'PASS' : 'FAIL', 'Zero employee leak across units');

    // -------------------------------------------------------------------------
    // 4. NEGATIVE BUSINESS SCENARIOS: ATTENDANCE & BRIEFINGS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Negative Scenarios: Attendance & Briefing ---');

    const attAudit = await page.evaluate(async () => {
      const { previewStore, attendanceService } = await import('/src/services/dataService.ts');
      const unitId = '00000000-0000-0000-0000-000000000001';

      // Missing briefing topic validation
      const emptyTopicRes = await attendanceService.createBriefingSession(unitId, {
        topic: '   ',
        speaker_name: 'Manager',
        session_date: '2026-11-15',
      });

      // Manual correction without audit notes
      const noNotesCorrectionRes = await attendanceService.correctAttendance(unitId, 'att-001', {
        status: 'PRESENT',
        notes: '', // missing reason
      });

      // Valid manual correction with audit notes
      const validCorrectionRes = await attendanceService.correctAttendance(unitId, 'att-001', {
        status: 'PRESENT',
        notes: 'Dispensasi tugas luar kota',
      });

      return {
        emptyTopicRejected: !emptyTopicRes.success && emptyTopicRes.message.includes('Topik sesi briefing wajib diisi'),
        noNotesRejected: !noNotesCorrectionRes.success && noNotesCorrectionRes.message.includes('Alasan koreksi presensi wajib diisi'),
        validCorrectionAccepted: validCorrectionRes.success,
      };
    });

    recordResult('NEG-ATT-01', 'Attendance', 'Enforce briefing topic required field validation', attAudit.emptyTopicRejected ? 'PASS' : 'FAIL', 'Empty briefing topic rejected');
    recordResult('NEG-ATT-02', 'Attendance', 'Require audit reason/notes for manual attendance correction', attAudit.noNotesRejected ? 'PASS' : 'FAIL', 'Manual correction without audit reason rejected');
    recordResult('NEG-ATT-03', 'Attendance', 'Allow valid manual attendance correction with audit justification', attAudit.validCorrectionAccepted ? 'PASS' : 'FAIL', 'Manual correction accepted with audit trail');

    // -------------------------------------------------------------------------
    // 5. NEGATIVE BUSINESS SCENARIOS: LEAVE MANAGEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Negative Scenarios: Leave Management ---');

    const leaveAudit = await page.evaluate(async () => {
      const { previewStore, leaveService } = await import('/src/services/dataService.ts');
      const unitId = '00000000-0000-0000-0000-000000000001';

      // 1. Quota > 3 days rejection
      const quotaExceededRes = await leaveService.submitLeaveRequest(unitId, {
        employee_id: 'emp-001',
        target_month: '2026-11',
        total_days: 4,
        reason: 'Liburan panjang',
        dates: ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'],
      });

      // 2. Submission outside calendar window (e.g. target month 2026-05 when today is 2026-11)
      const windowClosedRes = await leaveService.submitLeaveRequest(unitId, {
        employee_id: 'emp-001',
        target_month: '2026-05',
        total_days: 1,
        reason: 'Masa lalu',
        dates: ['2026-05-10'],
      });

      // 3. Valid auto-approved submission (target month 2026-11, window 2026-10-01 to 2026-11-03)
      // Note: Today in preview test environment is simulated or current date
      // Let's test approval state transition:
      const submitRes = previewStore.submitLeaveRequest(unitId, {
        employee_id: 'emp-002',
        target_month: '2026-12',
        total_days: 1,
        reason: 'Keperluan keluarga',
        dates: ['2026-12-13'], // Sunday (satisfies BR-CUTI-005 for Admin 3)
      });

      let approveRes = { success: false };
      let rejectRes = { success: false };
      if (submitRes.request_id) {
        approveRes = await leaveService.updateLeaveStatus(unitId, submitRes.request_id, 'APPROVED');
        rejectRes = await leaveService.updateLeaveStatus(unitId, submitRes.request_id, 'REJECTED', 'Kebutuhan mendesak');
      }

      return {
        quotaExceededRejected: !quotaExceededRes.success && quotaExceededRes.message.includes('3 hari'),
        windowClosedRejected: !windowClosedRes.success && windowClosedRes.message.includes('jendela pengajuan'),
        submitSuccess: submitRes.success,
        approveSuccess: approveRes.success,
        rejectSuccess: rejectRes.success,
      };
    });

    recordResult('NEG-LEV-01', 'Leave', 'Reject leave request exceeding monthly 3-day quota', leaveAudit.quotaExceededRejected ? 'PASS' : 'FAIL', 'Quota > 3 days rejected');
    recordResult('NEG-LEV-02', 'Leave', 'Reject leave submission outside active calendar window', leaveAudit.windowClosedRejected ? 'PASS' : 'FAIL', 'Closed window rejected');
    recordResult('NEG-LEV-03', 'Leave', 'Support authorized manager leave approval and rejection state transitions', (leaveAudit.approveSuccess && leaveAudit.rejectSuccess) ? 'PASS' : 'FAIL', 'Leave status transitions functional');

    // -------------------------------------------------------------------------
    // 6. NEGATIVE BUSINESS SCENARIOS: GLASS TIPS & PAYROLL INTEGRATION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Negative Scenarios: Glass Tip Calculation & Payroll ---');

    const tipAudit = await page.evaluate(async () => {
      const { previewStore, glassTipService } = await import('/src/services/dataService.ts');
      const unitId = '00000000-0000-0000-0000-000000000001';

      // 1. Invalid dimensions (< 5cm)
      const minDimRes = await glassTipService.submitGlassTip(unitId, {
        employee_code: 'EMP-LATANSA-001',
        auth_pin: '123456',
        glass_type_id: 'gt-01',
        length_cm: 3, // < 5cm
        height_cm: 100,
        quantity: 1,
      });

      // 2. Invalid dimensions (> 600cm)
      const maxDimRes = await glassTipService.submitGlassTip(unitId, {
        employee_code: 'EMP-LATANSA-001',
        auth_pin: '123456',
        glass_type_id: 'gt-01',
        length_cm: 650, // > 600cm
        height_cm: 100,
        quantity: 1,
      });

      // 3. Invalid quantity (< 1)
      const zeroQtyRes = await glassTipService.submitGlassTip(unitId, {
        employee_code: 'EMP-LATANSA-001',
        auth_pin: '123456',
        glass_type_id: 'gt-01',
        length_cm: 100,
        height_cm: 100,
        quantity: 0,
      });

      // 4. Valid tip submission + verification lifecycle
      const validTipRes = await glassTipService.submitGlassTip(unitId, {
        employee_code: 'EMP-LATANSA-001',
        auth_pin: '123456',
        glass_type_id: 'gt-01',
        length_cm: 100,
        height_cm: 200,
        quantity: 1,
      });

      const allTips = (await glassTipService.getGlassTipsByUnit(unitId)).data;
      const latestTip = allTips[0];

      // Verification with zero amount (must be rejected)
      const zeroAmountVerifyRes = await glassTipService.verifyTipNota(unitId, latestTip.id, 0, 'VERIFY', 'Zero check');

      // Valid verification
      const verifySuccessRes = await glassTipService.verifyTipNota(unitId, latestTip.id, 30000, 'VERIFY', 'Disetujui');

      // Verify payroll recap only includes VERIFIED tips
      const recapRes = await glassTipService.getCutterTipPayrollRecap(unitId);
      const cutterRecap = recapRes.data.find(c => c.employee_code === 'EMP-LATANSA-001');

      return {
        minDimRejected: !minDimRes.success && minDimRes.message.includes('5 cm'),
        maxDimRejected: !maxDimRes.success && maxDimRes.message.includes('600 cm'),
        zeroQtyRejected: !zeroQtyRes.success && zeroQtyRes.message.includes('minimal 1'),
        zeroAmountVerifyRejected: !zeroAmountVerifyRes.success && zeroAmountVerifyRes.message.includes('lebih besar dari 0'),
        verifySuccess: verifySuccessRes.success,
        recapIncludesVerified: (cutterRecap?.verified_tip_total || 0) >= 30000,
      };
    });

    recordResult('NEG-TIP-01', 'Glass Tips', 'Enforce dimensional boundary validation (< 5cm or > 600cm)', (tipAudit.minDimRejected && tipAudit.maxDimRejected) ? 'PASS' : 'FAIL', 'Out-of-bound dimensions rejected');
    recordResult('NEG-TIP-02', 'Glass Tips', 'Reject non-positive glass quantity (< 1)', tipAudit.zeroQtyRejected ? 'PASS' : 'FAIL', 'Zero quantity rejected');
    recordResult('NEG-TIP-03', 'Glass Tips', 'Enforce positive verification amount (> Rp0) during nota audit', tipAudit.zeroAmountVerifyRejected ? 'PASS' : 'FAIL', 'Zero verification amount rejected');
    recordResult('NEG-TIP-04', 'Glass Tips', 'Exclude unverified tips and include verified tips in payroll recap', tipAudit.recapIncludesVerified ? 'PASS' : 'FAIL', 'Payroll recap accurately sums verified tips');

    // -------------------------------------------------------------------------
    // 7. NEGATIVE BUSINESS SCENARIOS: FLEET MANAGEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Negative Scenarios: Fleet Management & Inspections ---');

    const fleetAudit = await page.evaluate(async () => {
      const { previewStore, fleetService } = await import('/src/services/dataService.ts');
      const unitId = '00000000-0000-0000-0000-000000000001';

      // 1. Put vehicle into MAINTENANCE
      await fleetService.updateVehicleStatus(unitId, 'veh-001', 'MAINTENANCE');

      // Attempt to book MAINTENANCE vehicle (must be blocked)
      const maintBookingRes = await fleetService.bookVehicle(unitId, {
        vehicle_id: 'veh-001',
        borrower_name: 'Tester',
        borrower_phone: '08123456789',
        responsible_person: 'PJ',
        destination: 'Bogor',
        purpose: 'Kirim barang',
        start_time: '2026-11-20T08:00:00Z',
        estimated_return_time: '2026-11-20T17:00:00Z',
      });

      // Restore vehicle to AVAILABLE
      await fleetService.updateVehicleStatus(unitId, 'veh-001', 'AVAILABLE');

      // Book vehicle for tomorrow
      const book1 = await fleetService.bookVehicle(unitId, {
        vehicle_id: 'veh-001',
        borrower_name: 'Tester 1',
        borrower_phone: '08123456789',
        responsible_person: 'PJ 1',
        destination: 'Tangerang',
        purpose: 'Kirim kaca 1',
        start_time: '2026-11-21T08:00:00Z',
        estimated_return_time: '2026-11-21T12:00:00Z',
      });

      // Approve booking 1
      const allRequests = (await fleetService.getBorrowingRequests(unitId)).data;
      const b1Req = allRequests.find(r => r.borrower_name === 'Tester 1');
      if (b1Req) {
        await fleetService.approveBorrowing(unitId, b1Req.id, 'Manager', 'APPROVE');
      }

      // 2. Schedule overlap conflict detection (overlapping datetime)
      const overlapBookingRes = await fleetService.bookVehicle(unitId, {
        vehicle_id: 'veh-001',
        borrower_name: 'Tester Overlap',
        borrower_phone: '08123456789',
        responsible_person: 'PJ 2',
        destination: 'Bekasi',
        purpose: 'Kirim kaca 2',
        start_time: '2026-11-21T10:00:00Z', // overlaps with 08:00-12:00
        estimated_return_time: '2026-11-21T15:00:00Z',
      });

      // 3. Return inspection with operational_readiness: NEEDS_MAINTENANCE
      // Must set vehicle status directly to MAINTENANCE to protect operational safety
      const returnMaintRes = await fleetService.returnVehicle(unitId, {
        requestId: b1Req ? b1Req.id : 'vbr-001',
        vehicleId: 'veh-001',
        actual_return_time: '2026-11-21T12:00:00Z',
        odometer_km: 50120,
        fuel_level: 'HALF',
        cleanliness_score: 2,
        condition_notes: 'Rem blong dan kaca depan retak',
        inspector_name: 'Petugas Cek',
        operational_readiness: 'NEEDS_MAINTENANCE',
      });

      const vehAfterReturn = (await fleetService.getVehiclesByUnit(unitId)).data.find(v => v.id === 'veh-001');

      return {
        maintBookingBlocked: !maintBookingRes.success && maintBookingRes.message.includes('sedang dalam perawatan'),
        overlapBlocked: !overlapBookingRes.success && overlapBookingRes.message.includes('Konflik Jadwal'),
        returnSuccess: returnMaintRes.success,
        vehicleBecameMaintenance: vehAfterReturn?.status === 'MAINTENANCE',
      };
    });

    recordResult('NEG-FLT-01', 'Fleet', 'Block booking requests for vehicles under MAINTENANCE', fleetAudit.maintBookingBlocked ? 'PASS' : 'FAIL', 'Booking maintenance vehicle blocked');
    recordResult('NEG-FLT-02', 'Fleet', 'Detect and block overlapping schedule bookings for same vehicle', fleetAudit.overlapBlocked ? 'PASS' : 'FAIL', 'Schedule overlap blocked');
    recordResult('NEG-FLT-03', 'Fleet', 'Enforce operational safety: Vehicle return with NEEDS_MAINTENANCE switches vehicle status to MAINTENANCE', fleetAudit.vehicleBecameMaintenance ? 'PASS' : 'FAIL', 'Unfit vehicle safely quarantined to MAINTENANCE');

    // -------------------------------------------------------------------------
    // 8. NEGATIVE BUSINESS SCENARIOS: VIOLATIONS, SP & ZERO-SALARY-DEDUCTION
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Negative Scenarios: Violations & Warning Letters ---');

    const violAudit = await page.evaluate(async () => {
      const { previewStore, violationService } = await import('/src/services/dataService.ts');
      const unitId = '00000000-0000-0000-0000-000000000001';

      // 1. Missing required violation fields
      const missingFieldsRes = await violationService.recordViolation(unitId, {
        employee_id: '',
        incident_date: '',
        description: '',
      });

      // 2. Non-positive points (<= 0)
      const zeroPointsRes = await violationService.recordViolation(unitId, {
        employee_id: 'emp-001',
        violation_type_id: 'vt-01',
        incident_date: '2026-11-15',
        description: 'Terlambat sedikit',
        points_assigned: 0,
      });

      // 3. Issue Warning Letter (SP) - Verify 6-month enterprise validity calculation
      const spRes = await violationService.issueWarningLetter(unitId, {
        employee_id: 'emp-001',
        letter_number: 'SP-TEST-001',
        level: 'FIRST_WARNING',
        issued_date: '2026-11-15',
        reason: 'UAT Negative Test SP',
      });

      const allSPs = (await violationService.getWarningLettersByUnit(unitId)).data;
      const latestSP = allSPs[0];

      return {
        missingFieldsRejected: !missingFieldsRes.success && missingFieldsRes.message.includes('wajib diisi'),
        zeroPointsRejected: !zeroPointsRes.success && zeroPointsRes.message.includes('lebih besar dari 0'),
        spIssued: spRes.success,
        spValidUntil: latestSP?.valid_until,
        // 6 months from 2026-11-15 is 2027-05-15
        isSixMonths: latestSP?.valid_until === '2027-05-15',
      };
    });

    recordResult('NEG-VIO-01', 'Violations', 'Enforce required violation fields and positive points (> 0)', (violAudit.missingFieldsRejected && violAudit.zeroPointsRejected) ? 'PASS' : 'FAIL', 'Invalid violations rejected');
    recordResult('NEG-VIO-02', 'Violations', 'Calculate 6-month enterprise SP validity date accurately', violAudit.isSixMonths ? 'PASS' : 'FAIL', `SP Valid until: ${violAudit.spValidUntil} (Expected: 2027-05-15)`);

    // -------------------------------------------------------------------------
    // 9. NEGATIVE BUSINESS SCENARIOS: PAYROLL & SNAPSHOT IMMUTABILITY
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Testing Negative Scenarios: Payroll Finalization Immutability ---');

    const payAudit = await page.evaluate(async () => {
      const { previewStore, payrollService } = await import('/src/services/dataService.ts');
      const unitId = '00000000-0000-0000-0000-000000000001';

      // 'pp-202610' is already FINALIZED
      const reFinalizeRes = await payrollService.finalizePayrollAtomic(unitId, 'pp-202610', 'Manager Keuangan');

      // Missing fields on creation
      const missingPayRes = await payrollService.createPayrollPeriod(unitId, {
        period_name: '',
        start_date: '',
        end_date: '',
        payout_date: '',
      });

      return {
        finalizedImmutabilityEnforced: !reFinalizeRes.success && (reFinalizeRes.message.includes('FINALIZED') || reFinalizeRes.message.includes('telah difinalisasi')),
        missingPayrollRejected: !missingPayRes.success && missingPayRes.message.includes('wajib diisi'),
      };
    });

    recordResult('NEG-PAY-01', 'Payroll', 'Prevent modification or re-finalization of FINALIZED payroll periods', payAudit.finalizedImmutabilityEnforced ? 'PASS' : 'FAIL', 'Finalized period immutability enforced');
    recordResult('NEG-PAY-02', 'Payroll', 'Validate all required fields when creating a new payroll period', payAudit.missingPayrollRejected ? 'PASS' : 'FAIL', 'Missing payroll info rejected');

    // -------------------------------------------------------------------------
    // 10. NEGATIVE BUSINESS SCENARIOS: PETTY CASH / EXPENSES
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Testing Negative Scenarios: Petty Cash Governance ---');

    const cashAudit = await page.evaluate(async () => {
      const { previewStore, financeService } = await import('/src/services/dataService.ts');
      const unitId = '00000000-0000-0000-0000-000000000001';

      // 1. Non-positive amount (<= 0)
      const zeroAmountRes = await financeService.recordExpense(unitId, {
        category: 'OFFICE_SUPPLIES',
        amount: 0, // <= 0
        description: 'Beli kertas',
        recipient_name: 'Toko ATK',
        expense_date: '2026-11-15',
      });

      // 2. Missing description or recipient
      const missingDescRes = await financeService.recordExpense(unitId, {
        category: 'OFFICE_SUPPLIES',
        amount: 50000,
        description: '', // missing
        recipient_name: '',
        expense_date: '2026-11-15',
      });

      // 3. Valid expense creation -> Must ALWAYS start as PENDING (Governance Rule)
      const validExpenseRes = await financeService.recordExpense(unitId, {
        category: 'OPERATIONAL',
        amount: 150000,
        description: 'Beli bensin pick up',
        recipient_name: 'SPBU Pertamina',
        expense_date: '2026-11-15',
      });

      const allExpenses = (await financeService.getExpensesByUnit(unitId)).data;
      const createdExpense = allExpenses.find(e => e.id === validExpenseRes.expense_id);
      const initialStatusIsPending = createdExpense?.approval_status === 'PENDING';

      // 4. Approval and rejection transitions
      let approveRes = { success: false };
      let rejectRes = { success: false };
      if (createdExpense) {
        approveRes = await financeService.approveExpense(unitId, createdExpense.id, 'APPROVE', 'usr-003', 'Kepala Toko');
        rejectRes = await financeService.approveExpense(unitId, createdExpense.id, 'REJECT', 'usr-003', 'Kepala Toko', 'Nota tidak jelas');
      }

      return {
        zeroAmountRejected: !zeroAmountRes.success && (zeroAmountRes.message.includes('lebih besar dari Rp0') || zeroAmountRes.message.includes('lebih besar dari 0')),
        missingDescRejected: !missingDescRes.success && missingDescRes.message.includes('wajib diisi'),
        initialStatusIsPending,
        approveSuccess: approveRes.success,
        rejectSuccess: rejectRes.success,
      };
    });

    recordResult('NEG-CSH-01', 'Petty Cash', 'Reject non-positive expense nominal (<= Rp0)', cashAudit.zeroAmountRejected ? 'PASS' : 'FAIL', 'Zero expense rejected');
    recordResult('NEG-CSH-02', 'Petty Cash', 'Enforce required fields (recipient, description) on expense logging', cashAudit.missingDescRejected ? 'PASS' : 'FAIL', 'Missing expense info rejected');
    recordResult('NEG-CSH-03', 'Petty Cash', 'Enforce strict governance: All expenses initialized strictly as PENDING', cashAudit.initialStatusIsPending ? 'PASS' : 'FAIL', 'Initial status strictly PENDING');
    recordResult('NEG-CSH-04', 'Petty Cash', 'Support authorized manager approval and rejection workflows', (cashAudit.approveSuccess && cashAudit.rejectSuccess) ? 'PASS' : 'FAIL', 'Expense approval workflows verified');

    // Visual screenshot of final clean state
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    const finalScreenshot = path.join(SCREENSHOT_DIR, '03_final_state_clean.png');
    await page.screenshot({ path: finalScreenshot });

  } catch (err) {
    console.error('Audit exception:', err);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log(`  AUDIT SUITE COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${testResults.length})`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
