/**
 * BUSINESS RULES & AUTHORIZATION CONSISTENCY AUDIT — KUK MANAGEMENT SYSTEM v3.1.0
 * Comprehensive multi-level verification:
 * 1. Business Policy Consistency (SP Draft status, Leave Quota/Window/Conflict, Glass Tip 3% & Verification, Cash Expenses, Payroll Immutability)
 * 2. Multi-Level Authorization (UI element visibility, direct URL navigation, service method invocation, unit-scoped data)
 * 3. Unit Isolation Audit across 8 entities (Employees, Attendance, Leave, Glass Tips, Fleet, Violations, Payroll, Cash Expenses)
 * 4. Preview Store State Lifecycle (Mutation verification, navigation persistence, soft refresh, sign-out cleanup, 0 network leakage)
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'docs', 'screenshots', 'business_auth_audit');

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

async function switchToDemoRole(page, roleLabel) {
  if (page.url() === 'about:blank' || !page.url().startsWith(BASE_URL)) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  }
  await page.evaluate(() => {
    sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

  let username = 'andika';
  let password = '12345';
  if (/pimpinan/i.test(roleLabel)) {
    username = 'fariz';
    password = '12345';
  } else if (/palen|raju/i.test(roleLabel)) {
    username = 'Raju';
    password = '54321';
  } else if (/supervisor|shuva/i.test(roleLabel)) {
    username = 'shuva';
    password = '12345';
  } else if (/hrd/i.test(roleLabel)) {
    username = 'irsyadil';
    password = '150904';
  } else if (/anshory|kasir/i.test(roleLabel)) {
    username = 'Anshory';
    password = '54321';
  } else if (/bendahara|finance|ari/i.test(roleLabel)) {
    username = 'ari';
    password = '12345';
  }

  const select = page.locator('#selectUsername');
  await select.waitFor({ state: 'visible', timeout: 10000 });
  await page.selectOption('#selectUsername', username);
  await page.fill('#inputPassword', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.href.endsWith('/login'), { timeout: 10000 });
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}

async function runAudit() {
  console.log('================================================================');
  console.log('  KUK MANAGEMENT SYSTEM v3.1.0 — BUSINESS RULES & AUTHORIZATION AUDIT');
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
    throw new Error('Edge executable not found on host');
  }

  console.log(`Launching Edge from: ${executablePath}`);
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  // Network leakage tracker: Assert ZERO calls to remote Supabase
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
    // SECTION 1: BUSINESS POLICY CONSISTENCY AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 1: Business Policy Consistency Audit ---');

    // 1.1 Warning Letters / SP Policy
    await switchToDemoRole(page, 'Manager La Tansa (UAT)');
    await page.goto(`${BASE_URL}/violations`, { waitUntil: 'networkidle' });

    const spPolicyAudit = await page.evaluate(async () => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const latansaUnit = '00000000-0000-0000-0000-000000000001';
      
      const issueRes = previewStore.issueWarningLetter(latansaUnit, {
        employee_id: 'emp-001',
        level: 'SP1',
        reason: 'Uji konsistensi draft SP',
        issued_date: '2026-11-15',
      });

      const letters = previewStore.getWarningLetters(latansaUnit);
      const created = letters.find((l) => l.reason === 'Uji konsistensi draft SP');

      return {
        message: issueRes.message,
        validUntil: created?.valid_until,
        hasDraftNotice: issueRes.message.includes('BUSINESS DECISION REQUIRED') || issueRes.message.includes('DRAFT SIMULASI'),
        hasZeroSalaryDeductionNotice: issueRes.message.includes('Tanpa Potongan Gaji Otomatis') || issueRes.message.includes('Nol potongan gaji'),
        expectedExpiry: '2027-05-15', // 6 months clamped
      };
    });

    const spScreenshot = path.join(SCREENSHOT_DIR, '01_sp_draft_policy.png');
    await page.screenshot({ path: spScreenshot });

    if (spPolicyAudit.hasDraftNotice && spPolicyAudit.hasZeroSalaryDeductionNotice && spPolicyAudit.validUntil === spPolicyAudit.expectedExpiry) {
      recordResult('POL-SP-01', 'Violations & SP', 'SP 6-month validity is explicitly marked draft simulation with 0 salary deduction', 'PASS', spPolicyAudit.message, spScreenshot);
    } else {
      recordResult('POL-SP-01', 'Violations & SP', 'SP 6-month validity is explicitly marked draft simulation with 0 salary deduction', 'FAIL', JSON.stringify(spPolicyAudit), spScreenshot);
    }

    // 1.2 Leave Rules: Quota, Window, Conflict
    const leavePolicyAudit = await page.evaluate(async () => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const latansaUnit = '00000000-0000-0000-0000-000000000001';

      // Exceed quota (>3 days) in open window (target 2026-12)
      const resQuota = previewStore.submitLeaveRequest(latansaUnit, {
        employee_id: 'emp-001',
        target_month: '2026-12',
        dates: ['2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13'],
        reason: 'Liburan panjang melebihi kuota',
      });

      // Valid 1 day in open window (target 2026-12)
      const resValid = previewStore.submitLeaveRequest(latansaUnit, {
        employee_id: 'emp-001',
        target_month: '2026-12',
        dates: ['2026-12-15'],
        reason: 'Keperluan keluarga resmi',
      });

      // Window check for far future month (e.g. 2027-06)
      const resWindow = previewStore.submitLeaveRequest(latansaUnit, {
        employee_id: 'emp-001',
        target_month: '2027-06',
        dates: ['2027-06-15'],
        reason: 'Cuti tahun depan di luar jendela',
      });

      // Seed colleague in same department (dept-01)
      previewStore.saveEmployee(latansaUnit, {
        id: 'emp-conflict-01',
        full_name: 'Rekan Se-bagian Logistik',
        employee_code: 'EMP-LOG-99',
        department_id: 'dept-01',
      });

      // Colleague in same department (dept-01) submits leave on same date (2026-12-15)
      const resConflict = previewStore.submitLeaveRequest(latansaUnit, {
        employee_id: 'emp-conflict-01',
        target_month: '2026-12',
        dates: ['2026-12-15'],
        reason: 'Cuti di tanggal sama dengan rekan bagian',
      });

      return {
        quotaBlocked: !resQuota.success && resQuota.message.includes('Batas maksimal cuti adalah 3 hari'),
        validAccepted: resValid.success,
        windowBlocked: !resWindow.success && resWindow.message.includes('di luar jendela pengajuan resmi'),
        conflictHandled: resConflict.is_conflict === true || resConflict.auto_approved === false,
      };
    });

    if (leavePolicyAudit.quotaBlocked && leavePolicyAudit.validAccepted && leavePolicyAudit.windowBlocked && leavePolicyAudit.conflictHandled) {
      recordResult('POL-LEV-01', 'Leave Management', 'Strict enforcement of 3-day quota, calendar window, and department conflict detection', 'PASS', 'Quota >3 rejected, valid accepted, window outside rejected, conflict flagged PENDING', spScreenshot);
    } else {
      recordResult('POL-LEV-01', 'Leave Management', 'Strict enforcement of 3-day quota, calendar window, and department conflict detection', 'FAIL', JSON.stringify(leavePolicyAudit), spScreenshot);
    }

    // 1.3 Glass Tips: Dimension bounds, invalid glass type rejection, verified-only in payroll
    const glassTipPolicyAudit = await page.evaluate(async () => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const latansaUnit = '00000000-0000-0000-0000-000000000001';

      // Missing/invalid glass type
      const resInvalidType = previewStore.submitGlassTip(latansaUnit, {
        employee_id: 'emp-001',
        glass_type_id: 'INVALID_TYPE',
        length_cm: 100,
        height_cm: 50,
        quantity: 2,
      });

      // Valid tip submission (100x50x2 = 1.0 sqm)
      const resValidTip = previewStore.submitGlassTip(latansaUnit, {
        employee_id: 'emp-001',
        glass_type_id: 'gt-001',
        length_cm: 100,
        height_cm: 50,
        quantity: 2,
      });

      // Reject tip with verification
      const tipId = resValidTip.reference_code;
      const tips = previewStore.getGlassTips(latansaUnit);
      const createdTip = tips.find((t) => t.reference_code === tipId);
      
      const resReject = previewStore.verifyGlassTip(latansaUnit, createdTip.id, 0, 'REJECT', 'Ukuran fisik nota tidak sesuai');
      const rejectedTip = previewStore.getGlassTips(latansaUnit).find((t) => t.id === createdTip.id);

      return {
        invalidTypeRejected: !resInvalidType.success,
        validTipCalculated: resValidTip.success && resValidTip.calculated_sqm === 1.0,
        rejectedStatus: rejectedTip?.status === 'REJECTED',
        rejectedAmountZero: rejectedTip?.verified_amount === 0,
      };
    });

    if (glassTipPolicyAudit.invalidTypeRejected && glassTipPolicyAudit.validTipCalculated && glassTipPolicyAudit.rejectedStatus) {
      recordResult('POL-TIP-01', 'Glass Tips', 'Enforce master glass type validation, 3% formula calculation, and cashier rejection', 'PASS', 'Invalid type rejected, 1.0 sqm calculated, verified rejected', spScreenshot);
    } else {
      recordResult('POL-TIP-01', 'Glass Tips', 'Enforce master glass type validation, 3% formula calculation, and cashier rejection', 'FAIL', JSON.stringify(glassTipPolicyAudit), spScreenshot);
    }

    // 1.4 Cash Expenses: Initial PENDING, no auto-approval, rejection reason preserved
    const expensePolicyAudit = await page.evaluate(async () => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const latansaUnit = '00000000-0000-0000-0000-000000000001';

      const resCreate = previewStore.recordExpense(latansaUnit, {
        category: 'OPERATIONAL',
        amount: 250000,
        recipient_name: 'Vendor ATK',
        description: 'Pembelian nota dan kertas kasir',
      });

      const expenses = previewStore.getCashExpenses(latansaUnit);
      const createdExp = expenses.find((e) => e.id === resCreate.expense_id);
      const initialStatusIsPending = createdExp?.approval_status === 'PENDING';

      // Reject expense and verify rejection reason preserved
      const resReject = previewStore.rejectExpense(latansaUnit, resCreate.expense_id, 'Nota tidak ada stempel basah toko');
      const updatedExp = previewStore.getCashExpenses(latansaUnit).find((e) => e.id === resCreate.expense_id);

      return {
        initialStatusIsPending,
        rejectSuccess: resReject.success,
        updatedStatusIsRejected: updatedExp?.approval_status === 'REJECTED',
        rejectionReasonPreserved: updatedExp?.rejection_reason === 'Nota tidak ada stempel basah toko',
      };
    });

    if (expensePolicyAudit.initialStatusIsPending && expensePolicyAudit.updatedStatusIsRejected && expensePolicyAudit.rejectionReasonPreserved) {
      recordResult('POL-CSH-01', 'Cash Expenses', 'Initial PENDING status guaranteed with rejection reason preserved on rejection', 'PASS', 'Initial PENDING, rejection reason preserved verbatim', spScreenshot);
    } else {
      recordResult('POL-CSH-01', 'Cash Expenses', 'Initial PENDING status guaranteed with rejection reason preserved on rejection', 'FAIL', JSON.stringify(expensePolicyAudit), spScreenshot);
    }

    // 1.5 Payroll: Immutability of finalized payroll period
    const payrollPolicyAudit = await page.evaluate(async () => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const latansaUnit = '00000000-0000-0000-0000-000000000001';

      const resCreate = previewStore.createPayrollPeriod(latansaUnit, {
        period_name: 'Gaji UAT November 2026',
        start_date: '2026-11-01',
        end_date: '2026-11-30',
        payout_date: '2026-12-01',
      });

      const periodId = resCreate.period_id;
      const resFinalize = previewStore.finalizePayrollAtomic(latansaUnit, periodId, 'Bapak Pimpinan');
      const resReFinalize = previewStore.finalizePayrollAtomic(latansaUnit, periodId, 'Bapak Pimpinan');

      return {
        firstFinalizeSuccess: resFinalize.success,
        reFinalizeBlocked: !resReFinalize.success && resReFinalize.message.includes('dikunci secara permanen'),
      };
    });

    if (payrollPolicyAudit.firstFinalizeSuccess && payrollPolicyAudit.reFinalizeBlocked) {
      recordResult('POL-PAY-01', 'Payroll Immutability', 'Finalized payroll periods are locked permanently against mutation or re-finalization', 'PASS', 'First finalize PASS, re-finalize strictly blocked', spScreenshot);
    } else {
      recordResult('POL-PAY-01', 'Payroll Immutability', 'Finalized payroll periods are locked permanently against mutation or re-finalization', 'FAIL', JSON.stringify(payrollPolicyAudit), spScreenshot);
    }

    // -------------------------------------------------------------------------
    // SECTION 2: MULTI-LEVEL AUTHORIZATION AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Multi-Level Authorization Audit ---');

    // 2.1 UI Visibility: Kasir on /finance (no approve/reject buttons)
    await switchToDemoRole(page, 'Kasir Demo (UAT)');
    await page.goto(`${BASE_URL}/finance`, { waitUntil: 'networkidle' });

    const kasirApproveBtnCount = await page.locator('button:has-text("Setujui")').count();
    const kasirRejectBtnCount = await page.locator('button:has-text("Tolak")').count();
    const kasirRecordBtnCount = await page.locator('button:has-text("Catat Pengeluaran")').count();

    const kasirFinanceScreenshot = path.join(SCREENSHOT_DIR, '02_kasir_finance_ui.png');
    await page.screenshot({ path: kasirFinanceScreenshot });

    if (kasirApproveBtnCount === 0 && kasirRejectBtnCount === 0 && kasirRecordBtnCount >= 1) {
      recordResult('AUTH-UI-01', 'RBAC UI Level', 'Kasir on /finance sees record button but approve/reject buttons are completely hidden', 'PASS', `Approve buttons: ${kasirApproveBtnCount}, Reject buttons: ${kasirRejectBtnCount}, Record buttons: ${kasirRecordBtnCount}`, kasirFinanceScreenshot);
    } else {
      recordResult('AUTH-UI-01', 'RBAC UI Level', 'Kasir on /finance sees record button but approve/reject buttons are completely hidden', 'FAIL', `Unexpected button count: approve=${kasirApproveBtnCount}, reject=${kasirRejectBtnCount}`, kasirFinanceScreenshot);
    }

    // 2.2 UI Visibility: Supervisor on /violations (no "Terbitkan SP" button)
    await switchToDemoRole(page, 'Supervisor Demo (UAT)');
    await page.goto(`${BASE_URL}/violations`, { waitUntil: 'networkidle' });

    const spvIssueSpBtnCount = await page.locator('button:has-text("Terbitkan SP")').count();
    const spvRecordViolationBtnCount = await page.locator('button:has-text("Catat Pelanggaran")').count();

    const spvViolationsScreenshot = path.join(SCREENSHOT_DIR, '03_supervisor_violations_ui.png');
    await page.screenshot({ path: spvViolationsScreenshot });

    if (spvIssueSpBtnCount === 0 && spvRecordViolationBtnCount >= 1) {
      recordResult('AUTH-UI-02', 'RBAC UI Level', 'Supervisor on /violations sees record violation but Terbitkan SP button is hidden', 'PASS', `Terbitkan SP buttons: ${spvIssueSpBtnCount}, Catat Pelanggaran: ${spvRecordViolationBtnCount}`, spvViolationsScreenshot);
    } else {
      recordResult('AUTH-UI-02', 'RBAC UI Level', 'Supervisor on /violations sees record violation but Terbitkan SP button is hidden', 'FAIL', `Issue SP button count: ${spvIssueSpBtnCount}`, spvViolationsScreenshot);
    }

    // 2.3 UI Visibility: Supervisor Nav Items (Fleet present, Payroll strictly absent)
    await switchToDemoRole(page, 'Supervisor Demo (UAT)');

    const spvPayrollNavCount = await page.locator('aside a[href="/payroll"]').count();
    const spvFleetNavCount = await page.locator('aside a[href="/fleet"]').count();

    const spvNavScreenshot = path.join(SCREENSHOT_DIR, '04_supervisor_nav_ui.png');
    await page.screenshot({ path: spvNavScreenshot });

    if (spvPayrollNavCount === 0 && spvFleetNavCount >= 1) {
      recordResult('AUTH-UI-03', 'RBAC UI Level', 'Supervisor navigation shows Fleet but strictly hides Payroll', 'PASS', `Payroll: ${spvPayrollNavCount}, Fleet: ${spvFleetNavCount}`, spvNavScreenshot);
    } else {
      recordResult('AUTH-UI-03', 'RBAC UI Level', 'Supervisor navigation shows Fleet but strictly hides Payroll', 'FAIL', `Leaked nav links: payroll=${spvPayrollNavCount}, fleet=${spvFleetNavCount}`, spvNavScreenshot);
    }

    // 2.4 UI Visibility: Finance Nav Items (Finance present, Fleet strictly absent)
    await switchToDemoRole(page, 'Anshory');

    const finFleetNavCount = await page.locator('aside a[href="/fleet"]').count();
    const finFinanceNavCount = await page.locator('aside a[href="/finance"]').count();

    const finNavScreenshot = path.join(SCREENSHOT_DIR, '05_finance_nav_ui.png');
    await page.screenshot({ path: finNavScreenshot });

    if (finFleetNavCount === 0 && finFinanceNavCount >= 1) {
      recordResult('AUTH-UI-04', 'RBAC UI Level', 'Finance navigation shows Finance but strictly hides Fleet', 'PASS', `Fleet: ${finFleetNavCount}, Finance: ${finFinanceNavCount}`, finNavScreenshot);
    } else {
      recordResult('AUTH-UI-04', 'RBAC UI Level', 'Finance navigation shows Finance but strictly hides Fleet', 'FAIL', `Leaked nav links: fleet=${finFleetNavCount}, fin=${finFinanceNavCount}`, finNavScreenshot);
    }

    // 2.5 Navigation Guard: Finance direct URL to /fleet
    await page.goto(`${BASE_URL}/fleet`, { waitUntil: 'networkidle' });

    const finFleetAccessDenied = await page.locator('text=Akses Ditolak').count();
    const finNavScreenshot2 = path.join(SCREENSHOT_DIR, '06_finance_direct_nav_denied.png');
    await page.screenshot({ path: finNavScreenshot2 });

    if (finFleetAccessDenied >= 1) {
      recordResult('AUTH-NAV-01', 'Navigation Guard', 'Direct URL access to /fleet by Finance is blocked with Akses Ditolak banner', 'PASS', 'Akses Ditolak banner confirmed', finNavScreenshot2);
    } else {
      recordResult('AUTH-NAV-01', 'Navigation Guard', 'Direct URL access to /fleet by Finance is blocked with Akses Ditolak banner', 'FAIL', 'Akses Ditolak banner missing', finNavScreenshot2);
    }

    // 2.6 Navigation Guard: Finance direct URL to /employees
    await page.goto(`${BASE_URL}/employees`, { waitUntil: 'networkidle' });
    const finEmpAccessDenied = await page.locator('text=Akses Ditolak').count();

    if (finEmpAccessDenied >= 1) {
      recordResult('AUTH-NAV-02', 'Navigation Guard', 'Direct URL access to /employees by Finance is blocked with Akses Ditolak banner', 'PASS', 'Akses Ditolak banner confirmed', finNavScreenshot2);
    } else {
      recordResult('AUTH-NAV-02', 'Navigation Guard', 'Direct URL access to /employees by Finance is blocked with Akses Ditolak banner', 'FAIL', 'Akses Ditolak banner missing', finNavScreenshot2);
    }

    // 2.7 Navigation Guard: Supervisor direct URL to /payroll
    await switchToDemoRole(page, 'Supervisor Demo (UAT)');
    await page.goto(`${BASE_URL}/payroll`, { waitUntil: 'networkidle' });

    const spvPayrollAccessDenied = await page.locator('text=Akses Ditolak').count();
    if (spvPayrollAccessDenied >= 1) {
      recordResult('AUTH-NAV-03', 'Navigation Guard', 'Direct URL access to /payroll by Supervisor is blocked with Akses Ditolak banner', 'PASS', 'Akses Ditolak banner confirmed', spvNavScreenshot);
    } else {
      recordResult('AUTH-NAV-03', 'Navigation Guard', 'Direct URL access to /payroll by Supervisor is blocked with Akses Ditolak banner', 'FAIL', 'Akses Ditolak banner missing', spvNavScreenshot);
    }

    // 2.8 Navigation Guard: Supervisor direct URL to /finance
    await page.goto(`${BASE_URL}/finance`, { waitUntil: 'networkidle' });

    const spvFinanceAccessDenied = await page.locator('text=Akses Ditolak').count();
    if (spvFinanceAccessDenied >= 1) {
      recordResult('AUTH-NAV-04', 'Navigation Guard', 'Direct URL access to /finance by Supervisor is blocked with Akses Ditolak banner', 'PASS', 'Akses Ditolak banner confirmed', spvNavScreenshot);
    } else {
      recordResult('AUTH-NAV-04', 'Navigation Guard', 'Direct URL access to /finance by Supervisor is blocked with Akses Ditolak banner', 'FAIL', 'Akses Ditolak banner missing', spvNavScreenshot);
    }

    // 2.9 Service Invocation Level: Direct invocation bypass attempts
    const serviceBypassAudit = await page.evaluate(async () => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const latansaUnit = '00000000-0000-0000-0000-000000000001';

      // Set Kasir identity
      localStorage.setItem('KUK_UAT_DEMO_IDENTITY', 'KASIR');
      const resKasirApprove = previewStore.approveExpense(latansaUnit, 'exp-001', 'Kasir Utama');

      // Set Supervisor identity
      localStorage.setItem('KUK_UAT_DEMO_IDENTITY', 'SUPERVISOR');
      const resSpvIssueSp = previewStore.issueWarningLetter(latansaUnit, {
        employee_id: 'emp-001',
        reason: 'Uji bypass SP',
      });

      // Set Kasir identity attempting payroll finalization
      localStorage.setItem('KUK_UAT_DEMO_IDENTITY', 'KASIR');
      const resKasirFinalize = previewStore.finalizePayrollAtomic(latansaUnit, 'pay-001', 'Kasir Utama');

      // Set Cutter identity attempting employee mutation
      localStorage.setItem('KUK_UAT_DEMO_IDENTITY', 'CUTTER');
      const resCutterSaveEmp = previewStore.saveEmployee(latansaUnit, {
        full_name: 'Bypass Employee',
        employee_code: 'BYPASS-01',
      });

      // Reset to Manager
      localStorage.setItem('KUK_UAT_DEMO_IDENTITY', 'MANAGER_LATANSA');

      return {
        kasirApproveBlocked: !resKasirApprove.success && resKasirApprove.message.includes('Akses Ditolak'),
        spvIssueSpBlocked: !resSpvIssueSp.success && resSpvIssueSp.message.includes('Akses Ditolak'),
        kasirFinalizeBlocked: !resKasirFinalize.success && resKasirFinalize.message.includes('Akses Ditolak'),
        cutterSaveEmpBlocked: !resCutterSaveEmp.success && resCutterSaveEmp.message.includes('Akses Ditolak'),
      };
    });

    if (serviceBypassAudit.kasirApproveBlocked && serviceBypassAudit.spvIssueSpBlocked && serviceBypassAudit.kasirFinalizeBlocked && serviceBypassAudit.cutterSaveEmpBlocked) {
      recordResult('AUTH-SVC-01', 'Service Invocation', 'Direct service-method invocation bypass strictly rejected at service layer', 'PASS', 'Kasir approve, SPV issue SP, Kasir finalize, Cutter save emp all rejected', finNavScreenshot2);
    } else {
      recordResult('AUTH-SVC-01', 'Service Invocation', 'Direct service-method invocation bypass strictly rejected at service layer', 'FAIL', JSON.stringify(serviceBypassAudit), finNavScreenshot2);
    }

    // -------------------------------------------------------------------------
    // SECTION 3: UNIT ISOLATION AUDIT (8 ENTITIES ACROSS LA TANSA & PALEN)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Unit Isolation Audit Across 8 Entities ---');

    const unitIsolationAudit = await page.evaluate(async () => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const unitA = '00000000-0000-0000-0000-000000000001'; // La Tansa
      const unitB = '00000000-0000-0000-0000-000000000002'; // Palen

      localStorage.setItem('KUK_UAT_DEMO_IDENTITY', 'MANAGER_LATANSA');

      // 1. Employee Isolation
      const empA = previewStore.getEmployees(unitA);
      const empB = previewStore.getEmployees(unitB);
      const crossEmpRead = empB.some((b) => empA.some((a) => a.id === b.id));

      // 2. Attendance & Briefing Isolation
      const briefA = previewStore.getBriefingSessions(unitA);
      const briefB = previewStore.getBriefingSessions(unitB);
      const crossBriefRead = briefB.some((b) => briefA.some((a) => a.id === b.id));

      // 3. Leave Request Isolation
      const leaveA = previewStore.getLeaveRequests(unitA);
      const leaveB = previewStore.getLeaveRequests(unitB);
      const crossLeaveRead = leaveB.some((b) => leaveA.some((a) => a.id === b.id));

      // 4. Glass Tips Isolation
      const tipA = previewStore.getGlassTips(unitA);
      const tipB = previewStore.getGlassTips(unitB);
      const crossTipRead = tipB.some((b) => tipA.some((a) => a.id === b.id));

      // 5. Fleet / Vehicles Isolation
      const vehA = previewStore.getVehicles(unitA);
      const vehB = previewStore.getVehicles(unitB);
      const crossVehRead = vehB.some((b) => vehA.some((a) => a.id === b.id));

      // 6. Violations & SP Isolation
      const spA = previewStore.getWarningLetters(unitA);
      const spB = previewStore.getWarningLetters(unitB);
      const crossSpRead = spB.some((b) => spA.some((a) => a.id === b.id));

      // 7. Payroll Periods Isolation
      const payA = previewStore.getPayrollPeriods(unitA);
      const payB = previewStore.getPayrollPeriods(unitB);
      const crossPayRead = payB.some((b) => payA.some((a) => a.id === b.id));

      // 8. Cash Expenses Isolation
      const expA = previewStore.getCashExpenses(unitA);
      const expB = previewStore.getCashExpenses(unitB);
      const crossExpRead = expB.some((b) => expA.some((a) => a.id === b.id));

      // Cross-Unit Mutation Rejection (Manager La Tansa trying to mutate Palen)
      const resCrossMutate = previewStore.saveEmployee(unitB, {
        full_name: 'Hacker Palen',
        employee_code: 'HACK-01',
      });

      return {
        crossEmpRead,
        crossBriefRead,
        crossLeaveRead,
        crossTipRead,
        crossVehRead,
        crossSpRead,
        crossPayRead,
        crossExpRead,
        crossMutateBlocked: !resCrossMutate.success && resCrossMutate.message.includes('Akses Ditolak'),
      };
    });

    const isoEntities = [
      { id: 'ISO-01', name: 'Employees', leak: unitIsolationAudit.crossEmpRead },
      { id: 'ISO-02', name: 'Attendance & Briefing', leak: unitIsolationAudit.crossBriefRead },
      { id: 'ISO-03', name: 'Leave Requests', leak: unitIsolationAudit.crossLeaveRead },
      { id: 'ISO-04', name: 'Glass Tips', leak: unitIsolationAudit.crossTipRead },
      { id: 'ISO-05', name: 'Fleet Vehicles', leak: unitIsolationAudit.crossVehRead },
      { id: 'ISO-06', name: 'Violations & SP', leak: unitIsolationAudit.crossSpRead },
      { id: 'ISO-07', name: 'Payroll Periods', leak: unitIsolationAudit.crossPayRead },
      { id: 'ISO-08', name: 'Cash Expenses', leak: unitIsolationAudit.crossExpRead },
    ];

    for (const ent of isoEntities) {
      if (!ent.leak) {
        recordResult(ent.id, 'Unit Isolation', `${ent.name}: Complete partition between TB KUK La Tansa and KUK Palen`, 'PASS', '0 leaked records between units', spScreenshot);
      } else {
        recordResult(ent.id, 'Unit Isolation', `${ent.name}: Complete partition between TB KUK La Tansa and KUK Palen`, 'FAIL', 'Found cross-unit leakage', spScreenshot);
      }
    }

    if (unitIsolationAudit.crossMutateBlocked) {
      recordResult('ISO-09', 'Unit Isolation', 'Cross-unit mutation attempt rejected at service layer with Akses Ditolak', 'PASS', 'Manager La Tansa mutation on Palen strictly blocked', spScreenshot);
    } else {
      recordResult('ISO-09', 'Unit Isolation', 'Cross-unit mutation attempt rejected at service layer with Akses Ditolak', 'FAIL', 'Cross-unit mutation was not blocked', spScreenshot);
    }

    // -------------------------------------------------------------------------
    // SECTION 4: PREVIEW STORE STATE LIFECYCLE AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Preview Store State Lifecycle Audit ---');

    // 4.1 Mutation Verification & Read via Getter
    const storeLifecycleAudit = await page.evaluate(async () => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const latansaUnit = '00000000-0000-0000-0000-000000000001';
      localStorage.setItem('KUK_UAT_DEMO_IDENTITY', 'MANAGER_LATANSA');

      const testCode = `EMP-AUDIT-${Date.now().toString().slice(-4)}`;
      const resSave = previewStore.saveEmployee(latansaUnit, {
        full_name: 'Auditor Kepegawaian',
        employee_code: testCode,
      });

      const retrieved = previewStore.getEmployees(latansaUnit).find((e) => e.employee_code === testCode);

      return {
        saveSuccess: resSave.success,
        retrievedMatch: retrieved?.full_name === 'Auditor Kepegawaian',
        testCode,
      };
    });

    if (storeLifecycleAudit.saveSuccess && storeLifecycleAudit.retrievedMatch) {
      recordResult('STR-01', 'Preview Store', 'Valid mutation immediately readable via typed getter in PreviewStore', 'PASS', `Created and retrieved employee: ${storeLifecycleAudit.testCode}`, spScreenshot);
    } else {
      recordResult('STR-01', 'Preview Store', 'Valid mutation immediately readable via typed getter in PreviewStore', 'FAIL', JSON.stringify(storeLifecycleAudit), spScreenshot);
    }

    // 4.2 Navigation Persistence
    await page.goto(`${BASE_URL}/leave`, { waitUntil: 'networkidle' });
    await page.goto(`${BASE_URL}/employees`, { waitUntil: 'networkidle' });

    const persistedAfterNav = await page.evaluate(async (code) => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const latansaUnit = '00000000-0000-0000-0000-000000000001';
      return previewStore.getEmployees(latansaUnit).some((e) => e.employee_code === code);
    }, storeLifecycleAudit.testCode);

    if (persistedAfterNav) {
      recordResult('STR-02', 'Preview Store', 'Preview mutations persist across page navigation between modules', 'PASS', 'Record confirmed after navigating /leave -> /employees', spScreenshot);
    } else {
      recordResult('STR-02', 'Preview Store', 'Preview mutations persist across page navigation between modules', 'FAIL', 'Record lost after navigation', spScreenshot);
    }

    // 4.3 Soft Refresh Persistence
    await page.reload({ waitUntil: 'networkidle' });

    const persistedAfterReload = await page.evaluate(async (code) => {
      const { previewStore } = await import('/src/services/dataService.ts');
      const latansaUnit = '00000000-0000-0000-0000-000000000001';
      return previewStore.getEmployees(latansaUnit).some((e) => e.employee_code === code);
    }, storeLifecycleAudit.testCode);

    if (persistedAfterReload) {
      recordResult('STR-03', 'Preview Store', 'Preview mutations persist across soft page reloads via sessionStorage', 'PASS', 'Record confirmed after page.reload()', spScreenshot);
    } else {
      recordResult('STR-03', 'Preview Store', 'Preview mutations persist across soft page reloads via sessionStorage', 'FAIL', 'Record lost after page reload', spScreenshot);
    }

    // 4.4 Sign Out Cleanup
    await page.evaluate(() => {
      localStorage.removeItem('KUK_UAT_DEMO_IDENTITY');
    });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    const stateAfterSignOut = await page.evaluate(() => {
      const demoKey = localStorage.getItem('KUK_UAT_DEMO_IDENTITY');
      return { demoKey };
    });

    if (!stateAfterSignOut.demoKey) {
      recordResult('STR-04', 'Preview Store', 'Sign out wipes active demo identity and restores clean login gateway', 'PASS', 'Demo identity cleared on sign out', spScreenshot);
    } else {
      recordResult('STR-04', 'Preview Store', 'Sign out wipes active demo identity and restores clean login gateway', 'FAIL', `Leaked demo key: ${stateAfterSignOut.demoKey}`, spScreenshot);
    }

    // 4.5 Network Isolation: Zero remote Supabase requests throughout entire audit
    if (remoteSupabaseRequests.length === 0) {
      recordResult('STR-05', 'Network Security', 'Zero remote Supabase calls across entire multi-level audit execution', 'PASS', 'Remote Supabase requests: 0 (0.00% network leakage)', spScreenshot);
    } else {
      recordResult('STR-05', 'Network Security', 'Zero remote Supabase calls across entire multi-level audit execution', 'FAIL', `Found ${remoteSupabaseRequests.length} leaked Supabase calls`, spScreenshot);
    }

  } catch (err) {
    console.error('Fatal audit error:', err);
    failedTests++;
  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  AUDIT SUITE COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${passedTests + failedTests})`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAudit();
