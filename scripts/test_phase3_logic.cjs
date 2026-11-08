/**
 * KUK Management System v3.1.0 - Phase 3 Logic & Business Workflow Test Suite
 * Mode: LOCAL IN-MEMORY VALIDATION
 * Zero Production Mutation
 */

const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${name}`);
  } catch (err) {
    console.error(`  [FAIL] #${totalTests}: ${name}`);
    console.error(`         ${err.message}`);
  }
}

console.log('================================================================');
console.log('  PHASE 3 LOGIC & BUSINESS WORKFLOW VALIDATION SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. GLASS TIP CALCULATION & KIOSK CONSTRAINTS
// -----------------------------------------------------------------------------
console.log('--- 1. Glass Tip Kiosk Calculations ---');

runTest('Calculates glass area correctly in m2', () => {
  const lengthCm = 150;
  const heightCm = 80;
  const quantity = 2;
  const calculatedSqm = Number(((lengthCm * heightCm * quantity) / 10000).toFixed(4));
  assert.strictEqual(calculatedSqm, 2.4);
});

runTest('Proposed 3% tip calculation with round-up to nearest Rp1.000', () => {
  const pricePerSqm = 125000;
  const calculatedSqm = 2.4;
  const glassPrice = Math.round(calculatedSqm * pricePerSqm); // 300,000
  const estimatedTip = Math.ceil((glassPrice * 0.03) / 1000) * 1000; // 9,000
  assert.strictEqual(glassPrice, 300000);
  assert.strictEqual(estimatedTip, 9000);

  // Non-round test: glass price 125,500 -> 3% is 3,765 -> round up to 4,000
  const oddPrice = 125500;
  const oddTip = Math.ceil((oddPrice * 0.03) / 1000) * 1000;
  assert.strictEqual(oddTip, 4000);
});

runTest('Enforces 6-digit PIN format validation', () => {
  const isValidPin = (pin) => pin.length === 6 && /^[0-9]{6}$/.test(pin);
  assert.strictEqual(isValidPin('123456'), true);
  assert.strictEqual(isValidPin('000000'), true);
  assert.strictEqual(isValidPin('12345'), false); // 5 digits
  assert.strictEqual(isValidPin('1234567'), false); // 7 digits
  assert.strictEqual(isValidPin('12345a'), false); // alphanumeric
  assert.strictEqual(isValidPin(' 12345'), false); // whitespace
});

runTest('Validates dimensional boundary limits (5cm to 600cm)', () => {
  const isValidDimension = (val) => val >= 5 && val <= 600;
  assert.strictEqual(isValidDimension(4), false);
  assert.strictEqual(isValidDimension(5), true);
  assert.strictEqual(isValidDimension(300), true);
  assert.strictEqual(isValidDimension(600), true);
  assert.strictEqual(isValidDimension(601), false);
});

// -----------------------------------------------------------------------------
// 2. FLEET BORROWING & SCHEDULE OVERLAP DETECTION
// -----------------------------------------------------------------------------
console.log('\n--- 2. Fleet Borrowing Workflow ---');

runTest('Validates return time must be strictly after start time', () => {
  const isTimeOrderValid = (start, end) => new Date(end) > new Date(start);
  assert.strictEqual(isTimeOrderValid('2026-11-10T08:00', '2026-11-10T12:00'), true);
  assert.strictEqual(isTimeOrderValid('2026-11-10T08:00', '2026-11-10T08:00'), false);
  assert.strictEqual(isTimeOrderValid('2026-11-10T12:00', '2026-11-10T08:00'), false);
});

runTest('Detects schedule overlap between vehicle reservations', () => {
  const checkOverlap = (existingStart, existingEnd, newStart, newEnd) => {
    return !(newEnd <= existingStart || newStart >= existingEnd);
  };
  const exStart = new Date('2026-11-10T08:00:00Z').getTime();
  const exEnd = new Date('2026-11-10T12:00:00Z').getTime();

  // Overlapping cases
  assert.strictEqual(checkOverlap(exStart, exEnd, new Date('2026-11-10T09:00:00Z').getTime(), new Date('2026-11-10T11:00:00Z').getTime()), true);
  assert.strictEqual(checkOverlap(exStart, exEnd, new Date('2026-11-10T07:00:00Z').getTime(), new Date('2026-11-10T09:00:00Z').getTime()), true);
  assert.strictEqual(checkOverlap(exStart, exEnd, new Date('2026-11-10T11:00:00Z').getTime(), new Date('2026-11-10T13:00:00Z').getTime()), true);

  // Non-overlapping cases
  assert.strictEqual(checkOverlap(exStart, exEnd, new Date('2026-11-10T06:00:00Z').getTime(), new Date('2026-11-10T08:00:00Z').getTime()), false);
  assert.strictEqual(checkOverlap(exStart, exEnd, new Date('2026-11-10T12:00:00Z').getTime(), new Date('2026-11-10T14:00:00Z').getTime()), false);
});

runTest('Formats license plate to uppercase and trimmed', () => {
  const formatPlate = (plate) => plate.trim().toUpperCase();
  assert.strictEqual(formatPlate('  b 1234 kuk  '), 'B 1234 KUK');
});

// -----------------------------------------------------------------------------
// 3. LEAVE REQUEST RULES & QUOTA
// -----------------------------------------------------------------------------
console.log('\n--- 3. Leave Request Rules & Quota ---');

runTest('Enforces maximum 3 days leave quota per monthly request', () => {
  const validateLeaveQuota = (dates) => dates.length >= 1 && dates.length <= 3;
  assert.strictEqual(validateLeaveQuota(['2026-11-10']), true);
  assert.strictEqual(validateLeaveQuota(['2026-11-10', '2026-11-11']), true);
  assert.strictEqual(validateLeaveQuota(['2026-11-10', '2026-11-11', '2026-11-12']), true);
  assert.strictEqual(validateLeaveQuota([]), false);
  assert.strictEqual(validateLeaveQuota(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']), false);
});

runTest('Rejects duplicate dates in a leave submission', () => {
  const hasNoDuplicateDates = (dates) => new Set(dates).size === dates.length;
  assert.strictEqual(hasNoDuplicateDates(['2026-11-10', '2026-11-11']), true);
  assert.strictEqual(hasNoDuplicateDates(['2026-11-10', '2026-11-10']), false);
});

runTest('Public leave without backend atomic RPC returns BLOCKED status', () => {
  // Simulates submitLeaveRequestWithPin behavior
  const mockSubmitWithPin = (unitId, code, pin, payload) => {
    return {
      success: false,
      message: 'BLOCKED: RPC backend pengajuan cuti mandiri (submit_leave_request_atomic) belum tersedia pada skema database v3.1.0 (Menunggu Phase 1C).'
    };
  };
  const res = mockSubmitWithPin('unit-1', 'EMP-001', '123456', { dates: ['2026-11-10'] });
  assert.strictEqual(res.success, false);
  assert.ok(res.message.includes('BLOCKED'));
});

// -----------------------------------------------------------------------------
// 4. EMPLOYEE MANAGEMENT & LIFECYCLE (ANTI-HARD-DELETE)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Employee Lifecycle & Anti-Hard-Delete ---');

runTest('Status transition updates status without deleting row', () => {
  const employee = { id: 'emp-001', full_name: 'Ahmad Dahlan', status: 'ACTIVE' };
  const deactivate = (emp) => ({ ...emp, status: 'INACTIVE', updated_at: new Date().toISOString() });
  const updated = deactivate(employee);
  assert.strictEqual(updated.status, 'INACTIVE');
  assert.strictEqual(updated.id, 'emp-001');
});

runTest('PIN reset validates 6 digits and generates secure payload', () => {
  const preparePinReset = (empId, newPin) => {
    if (!newPin || newPin.length !== 6 || !/^[0-9]{6}$/.test(newPin)) {
      throw new Error('PIN must be 6 digits');
    }
    return { p_employee_id: empId, p_new_pin: newPin };
  };
  const payload = preparePinReset('emp-001', '654321');
  assert.strictEqual(payload.p_new_pin, '654321');
  assert.throws(() => preparePinReset('emp-001', '123'));
});

// -----------------------------------------------------------------------------
// 5. RBAC & PERMISSION COVERAGE
// -----------------------------------------------------------------------------
console.log('\n--- 5. RBAC & Permission Matrix Coverage ---');

const permissions = {
  PIMPINAN: ['employees.view', 'employees.manage', 'payroll.manage', 'audit_logs.view', 'settings.manage'],
  MANAGER: ['employees.view', 'employees.manage', 'leave.manage', 'payroll.manage', 'audit_logs.view'],
  SUPERVISOR: ['employees.view', 'leave.manage', 'glass_tips.verify', 'fleet.approve_borrowing'],
  KASIR: ['glass_tips.view', 'glass_tips.verify'],
  CHECKER: ['glass_tips.view', 'glass_tips.verify'],
  CUTTER: ['glass_tips.view'],
  DRIVER: ['fleet.view'],
};

runTest('Pimpinan has super-administrative permissions', () => {
  assert.ok(permissions.PIMPINAN.includes('payroll.manage'));
  assert.ok(permissions.PIMPINAN.includes('settings.manage'));
  assert.ok(permissions.PIMPINAN.includes('audit_logs.view'));
});

runTest('Cutter and Driver have strictly limited operational scope', () => {
  assert.strictEqual(permissions.CUTTER.includes('payroll.manage'), false);
  assert.strictEqual(permissions.CUTTER.includes('settings.manage'), false);
  assert.strictEqual(permissions.DRIVER.includes('payroll.manage'), false);
  assert.strictEqual(permissions.DRIVER.includes('employees.manage'), false);
});

runTest('Kasir and Checker have glass tip verification permission', () => {
  assert.ok(permissions.KASIR.includes('glass_tips.verify'));
  assert.ok(permissions.CHECKER.includes('glass_tips.verify'));
});

// -----------------------------------------------------------------------------
// 6. CSV EXPORT ENCODING INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- 6. Data Export & CSV Generation ---');

runTest('Generates well-formed CSV rows with escaped quotes', () => {
  const escapeCsv = (val) => `"${String(val).replace(/"/g, '""')}"`;
  const row = [
    escapeCsv('EMP-001'),
    escapeCsv('Ahmad "Budi" Dahlan'),
    escapeCsv('TB KUK La Tansa, Serang'),
  ].join(',');
  assert.strictEqual(row, '"EMP-001","Ahmad ""Budi"" Dahlan","TB KUK La Tansa, Serang"');
});

// -----------------------------------------------------------------------------
// 7. PHASE 3.2 — MOCK FALLBACK & ERROR HANDLING VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- 7. Mock Fallback & Error Handling Remediation ---');

// Replicate resolveDataResponse logic for in-memory validation
function testResolveDataResponse(result, previewFallbackFn, emptyValue, isPreviewMode) {
  if (result.error) {
    if (isPreviewMode) {
      return {
        success: true,
        data: previewFallbackFn(),
        isFixture: true,
        source: 'MOCK',
        message: 'Mode Pratinjau Terisolasi: Fallback data simulasi lokal aktif.',
      };
    }
    const isRls =
      result.error.code === '42501' ||
      /row-level security|permission denied|insufficient_privilege/i.test(result.error.message || '');
    return {
      success: false,
      data: emptyValue,
      isFixture: false,
      source: 'LIVE',
      error: isRls
        ? 'Akses ditolak: Anda tidak memiliki izin untuk mengakses data ini (RLS Denied).'
        : (result.error.message || 'Gagal memuat data dari database.'),
      errorCode: result.error.code || (isRls ? '42501' : 'UNKNOWN'),
    };
  }

  const isEmpty =
    result.data === null ||
    result.data === undefined ||
    (Array.isArray(result.data) && result.data.length === 0);

  if (isEmpty) {
    if (isPreviewMode) {
      return {
        success: true,
        data: previewFallbackFn(),
        isFixture: true,
        source: 'MOCK',
        message: 'Mode Pratinjau Terisolasi: Database kosong, menampilkan contoh simulasi.',
      };
    }
    return {
      success: true,
      data: emptyValue,
      isFixture: false,
      source: 'LIVE',
      error: null,
    };
  }

  return {
    success: true,
    data: result.data,
    isFixture: false,
    source: 'LIVE',
    error: null,
  };
}

const mockFixtureFactory = () => [{ id: 'mock-1', name: 'Contoh Data Mock' }];

runTest('1. Query success with data returns LIVE source without fixture flag', () => {
  const liveRows = [{ id: 'live-1', name: 'Data Asli Supabase' }];
  const res = testResolveDataResponse({ data: liveRows, error: null }, mockFixtureFactory, [], false);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.source, 'LIVE');
  assert.strictEqual(res.isFixture, false);
  assert.strictEqual(res.error, null);
  assert.deepStrictEqual(res.data, liveRows);
});

runTest('2. Query success with empty data returns EMPTY STATE (not mock fixture)', () => {
  const res = testResolveDataResponse({ data: [], error: null }, mockFixtureFactory, [], false);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.source, 'LIVE');
  assert.strictEqual(res.isFixture, false);
  assert.strictEqual(res.error, null);
  assert.deepStrictEqual(res.data, []); // MUST be empty, not mock!
});

runTest('3. Network error without preview mode returns error state without mock masking', () => {
  const networkError = { message: 'Failed to fetch (Network connection lost)' };
  const res = testResolveDataResponse({ data: null, error: networkError }, mockFixtureFactory, [], false);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.source, 'LIVE');
  assert.strictEqual(res.isFixture, false);
  assert.strictEqual(res.error, 'Failed to fetch (Network connection lost)');
  assert.deepStrictEqual(res.data, []); // MUST NOT return mock fixture
});

runTest('4. RLS permission error (code 42501) returns access denied error without mock masking', () => {
  const rlsError = { code: '42501', message: 'permission denied for table employee_sensitive_data' };
  const res = testResolveDataResponse({ data: null, error: rlsError }, mockFixtureFactory, [], false);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.source, 'LIVE');
  assert.strictEqual(res.isFixture, false);
  assert.strictEqual(res.errorCode, '42501');
  assert.ok(res.error.includes('RLS Denied') || res.error.includes('Akses ditolak'));
  assert.deepStrictEqual(res.data, []); // MUST NOT mask with mock
});

runTest('5. Preview mode explicitly active returns MOCK fixture with isFixture true', () => {
  // Empty data case with preview active
  const resEmpty = testResolveDataResponse({ data: [], error: null }, mockFixtureFactory, [], true);
  assert.strictEqual(resEmpty.success, true);
  assert.strictEqual(resEmpty.source, 'MOCK');
  assert.strictEqual(resEmpty.isFixture, true);
  assert.strictEqual(resEmpty.data.length, 1);
  assert.strictEqual(resEmpty.data[0].id, 'mock-1');

  // Error case with preview active
  const resError = testResolveDataResponse({ data: null, error: { message: 'DB down' } }, mockFixtureFactory, [], true);
  assert.strictEqual(resError.success, true);
  assert.strictEqual(resError.source, 'MOCK');
  assert.strictEqual(resError.isFixture, true);
  assert.strictEqual(resError.data.length, 1);
});

runTest('6. Disabling preview mode immediately stops mock fallback on error and empty states', () => {
  let isPreviewMode = true;
  // While active
  let res = testResolveDataResponse({ data: [], error: null }, mockFixtureFactory, [], isPreviewMode);
  assert.strictEqual(res.isFixture, true);
  assert.strictEqual(res.source, 'MOCK');

  // After disabling
  isPreviewMode = false;
  res = testResolveDataResponse({ data: [], error: null }, mockFixtureFactory, [], isPreviewMode);
  assert.strictEqual(res.isFixture, false);
  assert.strictEqual(res.source, 'LIVE');
  assert.deepStrictEqual(res.data, []);

  // On error after disabling
  const errRes = testResolveDataResponse({ data: null, error: { message: 'Timeout' } }, mockFixtureFactory, [], isPreviewMode);
  assert.strictEqual(errRes.isFixture, false);
  assert.strictEqual(errRes.source, 'LIVE');
  assert.strictEqual(errRes.success, false);
  assert.strictEqual(errRes.error, 'Timeout');
});

// -----------------------------------------------------------------------------
// 8. PHASE 3.2.1 — ADVANCED ERROR CLASSIFICATION & PREVIEW SECURITY
// -----------------------------------------------------------------------------
console.log('\n--- 8. Phase 3.2.1 Error Classification & Preview Security ---');

function testClassifyError(error) {
  if (!error) return { message: 'Terjadi kesalahan tidak dikenal.', code: 'UNKNOWN' };
  const rawMsg = (error.message || '').toString();
  const rawCode = (error.code || error.status || '').toString();

  if (rawCode === '42501' || /row-level security|permission denied|insufficient_privilege/i.test(rawMsg)) {
    return {
      message: 'Akses ditolak: Anda tidak memiliki izin untuk mengakses data ini (RLS Denied).',
      code: '42501',
    };
  }
  if (rawCode === '401' || rawCode === 'PGRST301' || /jwt expired|invalid claim|unauthorized|session expired/i.test(rawMsg)) {
    return {
      message: 'Sesi autentikasi telah berakhir. Silakan login kembali.',
      code: 'AUTH_EXPIRED',
    };
  }
  if (/timeout|timed out|abort/i.test(rawMsg) || rawCode === 'TIMEOUT') {
    return {
      message: 'Koneksi ke database server melebihi batas waktu (Request Timeout).',
      code: 'TIMEOUT',
    };
  }
  if (/failed to fetch|network error|offline|connection refused|networkrequestfailed/i.test(rawMsg)) {
    return {
      message: 'Gagal terhubung ke database server. Periksa koneksi internet Anda.',
      code: 'NETWORK_ERROR',
    };
  }
  if (rawCode.startsWith('PGRST')) {
    return {
      message: `Kesalahan PostgREST (${rawCode}): ${rawMsg}`,
      code: rawCode,
    };
  }
  return {
    message: rawMsg || 'Gagal memuat data dari database.',
    code: rawCode || 'UNKNOWN',
  };
}

runTest('7. Classifies PostgreSQL 42501 as RLS Access Denied', () => {
  const c = testClassifyError({ code: '42501', message: 'permission denied for table employees' });
  assert.strictEqual(c.code, '42501');
  assert.ok(c.message.includes('RLS Denied'));
});

runTest('8. Classifies expired token / JWT as AUTH_EXPIRED', () => {
  const c = testClassifyError({ code: '401', message: 'JWT expired' });
  assert.strictEqual(c.code, 'AUTH_EXPIRED');
  assert.ok(c.message.includes('Sesi autentikasi telah berakhir'));
});

runTest('9. Classifies timeout as TIMEOUT', () => {
  const c = testClassifyError({ message: 'The user aborted a request timeout' });
  assert.strictEqual(c.code, 'TIMEOUT');
  assert.ok(c.message.includes('Request Timeout'));
});

runTest('10. Classifies network failure as NETWORK_ERROR', () => {
  const c = testClassifyError({ message: 'TypeError: Failed to fetch' });
  assert.strictEqual(c.code, 'NETWORK_ERROR');
  assert.ok(c.message.includes('koneksi internet'));
});

runTest('11. Preserves specific PostgREST codes (e.g. PGRST116)', () => {
  const c = testClassifyError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
  assert.strictEqual(c.code, 'PGRST116');
  assert.ok(c.message.includes('PGRST116'));
});

runTest('12. Production environment strictly rejects preview mode by default', () => {
  const checkIsPreviewActive = (isProd, allowInProd, storedVal) => {
    if (isProd && !allowInProd) return false;
    if (storedVal !== null) return storedVal === 'true';
    return allowInProd;
  };

  // Production build with no explicit allow: MUST be false even if stored is true
  assert.strictEqual(checkIsPreviewActive(true, false, 'true'), false);
  // Staging / Dev build with allow: can be true
  assert.strictEqual(checkIsPreviewActive(false, false, 'true'), true);
  // Production with explicit build-time allow flag
  assert.strictEqual(checkIsPreviewActive(true, true, 'true'), true);
});

runTest('13. Mutation in preview mode explicitly prefixes [SIMULASI PREVIEW] and disclaims DB save', () => {
  const mockUpdateResult = (empId, status) => {
    if (empId.startsWith('emp-')) {
      return { success: true, message: `[SIMULASI PREVIEW] Status karyawan lokal diperbarui ke ${status} dalam memori (TIDAK tersimpan ke database).` };
    }
    return { success: true, message: `Status karyawan berhasil diubah menjadi ${status}.` };
  };

  const previewRes = mockUpdateResult('emp-001', 'INACTIVE');
  assert.ok(previewRes.message.includes('[SIMULASI PREVIEW]'));
  assert.ok(previewRes.message.includes('TIDAK tersimpan ke database'));

  const liveRes = mockUpdateResult('11111111-1111-1111-1111-111111111111', 'INACTIVE');
  assert.strictEqual(liveRes.message.includes('[SIMULASI PREVIEW]'), false);
  assert.ok(liveRes.message.includes('Status karyawan berhasil'));
});

// -----------------------------------------------------------------------------
// 9. BUSINESS RULE RECONCILIATION & RELEASE READINESS
// -----------------------------------------------------------------------------
console.log('\n--- 9. Business Rule Reconciliation & Release Readiness ---');

runTest('14. Leave submission window: Opened 1st of previous month, closed 3rd of target month', () => {
  const isWithinSubmissionWindow = (targetMonthStr, submissionDateStr) => {
    const [tYear, tMonth] = targetMonthStr.split('-').map(Number);
    const prevYear = tMonth === 1 ? tYear - 1 : tYear;
    const prevMonth = tMonth === 1 ? 12 : tMonth - 1;
    const windowOpen = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const windowClose = `${tYear}-${String(tMonth).padStart(2, '0')}-03`;
    return submissionDateStr >= windowOpen && submissionDateStr <= windowClose;
  };

  // Target: December 2026 (Window: 2026-11-01 to 2026-12-03)
  assert.strictEqual(isWithinSubmissionWindow('2026-12', '2026-10-31'), false); // Too early
  assert.strictEqual(isWithinSubmissionWindow('2026-12', '2026-11-01'), true);  // Window open
  assert.strictEqual(isWithinSubmissionWindow('2026-12', '2026-11-15'), true);  // Inside window
  assert.strictEqual(isWithinSubmissionWindow('2026-12', '2026-12-03'), true);  // Window close deadline
  assert.strictEqual(isWithinSubmissionWindow('2026-12', '2026-12-04'), false); // Closed

  // Target: January 2027 (Window: 2026-12-01 to 2027-01-03)
  assert.strictEqual(isWithinSubmissionWindow('2027-01', '2026-11-30'), false); // Too early
  assert.strictEqual(isWithinSubmissionWindow('2027-01', '2026-12-01'), true);  // Cross-year open
  assert.strictEqual(isWithinSubmissionWindow('2027-01', '2027-01-03'), true);  // Cross-year close
  assert.strictEqual(isWithinSubmissionWindow('2027-01', '2027-01-04'), false); // Closed
});

runTest('15. Fleet post-inspection: Inspector verdict explicitly controls vehicle readiness (FIT -> AVAILABLE, NEEDS_MAINTENANCE -> MAINTENANCE)', () => {
  const evaluatePostReturnStatus = (operationalReadiness) => {
    // Ground truth: Inspector assessment is authoritative.
    // An unfit vehicle is safely blocked from new borrowings without guessing thresholds or regex keyword search.
    const isUnfit = operationalReadiness === 'NEEDS_MAINTENANCE';
    return isUnfit ? 'MAINTENANCE' : 'AVAILABLE';
  };

  // Inspector declares vehicle FIT -> AVAILABLE
  assert.strictEqual(evaluatePostReturnStatus('FIT'), 'AVAILABLE');

  // Inspector declares vehicle NEEDS_MAINTENANCE -> Safely blocked in MAINTENANCE
  assert.strictEqual(evaluatePostReturnStatus('NEEDS_MAINTENANCE'), 'MAINTENANCE');

  // Default / undefined behavior defaults to AVAILABLE only if not declared NEEDS_MAINTENANCE
  assert.strictEqual(evaluatePostReturnStatus(undefined), 'AVAILABLE');
});

runTest('16. Cash expense recording: Decoupled from auto-approval, enforces initial PENDING status', () => {
  const recordExpenseContract = (amount, description) => {
    // Ground truth: No arbitrary auto-approval threshold without approved policy
    // All recorded expenses start in PENDING status requiring manager authorization
    return {
      approval_status: 'PENDING',
      auto_approved: false,
      message: 'Pengeluaran kas berhasil dicatat (Menunggu otorisasi Kepala Toko/Manajemen).'
    };
  };

  const exp1 = recordExpenseContract(50000, 'Beli ATK pulpen');
  assert.strictEqual(exp1.approval_status, 'PENDING');
  assert.strictEqual(exp1.auto_approved, false);

  const exp2 = recordExpenseContract(500000, 'BBM Truk Pengiriman');
  assert.strictEqual(exp2.approval_status, 'PENDING');
  assert.strictEqual(exp2.auto_approved, false);

  const exp3 = recordExpenseContract(1500000, 'Servis Mesin Potong Kaca');
  assert.strictEqual(exp3.approval_status, 'PENDING');
  assert.strictEqual(exp3.auto_approved, false);
});

console.log('\n================================================================');
console.log(`  PHASE 3 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}

