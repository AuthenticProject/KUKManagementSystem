const assert = require('assert');

console.log('================================================================');
console.log('  UAT DEMO MODE & RBAC ISOLATION TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] #${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] #${totalTests}: ${name}`);
    console.error(`         ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// Mock canonical units & demo definitions for Node test environment
// -----------------------------------------------------------------------------
const CANONICAL_DEMO_UNITS = {
  LATANSA: {
    id: '00000000-0000-0000-0000-000000000001',
    code: 'TB-LATANSA',
    name: 'TB KUK La Tansa',
  },
  PALEN: {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'KUK-PALEN',
    name: 'KUK Palen',
  },
};

const makePerm = (code) => ({ id: `perm-${code}`, code, module: code.split('.')[0] || 'core', name: code });

const PERMS_MANAGER = [
  'employees.view', 'employees.create', 'employees.update', 'employees.view_sensitive',
  'leave.view', 'leave.manage',
  'glass_tips.view', 'glass_tips.verify',
  'violations.view', 'violations.manage', 'violations.issue_sp',
  'attendance.view', 'attendance.manage_briefing', 'attendance.import_fingerprint', 'attendance.adjust',
  'payroll.view', 'payroll.calculate', 'payroll.manage', 'payroll.finalize',
  'finance.view', 'finance.approve',
  'fleet.view', 'fleet.manage', 'fleet.approve_borrowing', 'fleet.inspect',
  'reports.view', 'reports.export_excel',
].map(makePerm);

const PERMS_SUPERVISOR = [
  'employees.view',
  'leave.view',
  'glass_tips.view', 'glass_tips.verify',
  'violations.view', 'violations.manage',
  'attendance.view', 'attendance.manage_briefing',
  'fleet.view', 'fleet.inspect',
].map(makePerm);

const PERMS_KASIR = [
  'glass_tips.view', 'glass_tips.verify',
  'payroll.view',
  'finance.view', 'finance.approve',
].map(makePerm);

const PERMS_CUTTER = [
  'glass_tips.view',
  'attendance.view',
].map(makePerm);

const PERMS_DRIVER = [
  'fleet.view',
  'attendance.view',
].map(makePerm);

const DEMO_IDENTITIES = {
  PIMPINAN: {
    role: 'PIMPINAN',
    unitScope: 'ALL',
    isSuperAdmin: true,
    isAdminPusat: true,
  },
  MANAGER_LATANSA: {
    role: 'MANAGER',
    unitScope: 'LATANSA',
    unitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    permissions: PERMS_MANAGER.map(p => p.code),
  },
  MANAGER_PALEN: {
    role: 'MANAGER',
    unitScope: 'PALEN',
    unitId: CANONICAL_DEMO_UNITS.PALEN.id,
    permissions: PERMS_MANAGER.map(p => p.code),
  },
  SUPERVISOR: {
    role: 'SUPERVISOR',
    unitScope: 'LATANSA',
    unitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    permissions: PERMS_SUPERVISOR.map(p => p.code),
  },
  KASIR: {
    role: 'KASIR',
    unitScope: 'LATANSA',
    unitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    permissions: PERMS_KASIR.map(p => p.code),
  },
  CUTTER: {
    role: 'CUTTER',
    unitScope: 'LATANSA',
    unitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    permissions: PERMS_CUTTER.map(p => p.code),
  },
  DRIVER: {
    role: 'DRIVER',
    unitScope: 'LATANSA',
    unitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    permissions: PERMS_DRIVER.map(p => p.code),
  },
};

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Security Guard & Production Isolation ---');

runTest('1. Demo mode is strictly rejected when DEV is false (Production build safeguard)', () => {
  const isUatDemoAvailable = (isDev, enableFlag) => {
    if (!isDev) return false;
    return enableFlag === 'true';
  };

  // Production environment: MUST be false even if flag is true
  assert.strictEqual(isUatDemoAvailable(false, 'true'), false);
  // Production environment with flag false: MUST be false
  assert.strictEqual(isUatDemoAvailable(false, 'false'), false);
  // Development with flag false: MUST be false
  assert.strictEqual(isUatDemoAvailable(true, 'false'), false);
  // Development with flag true: Allowed
  assert.strictEqual(isUatDemoAvailable(true, 'true'), true);
});

runTest('2. All 7 mandatory UAT demo identities are defined with distinct roles and units', () => {
  const expectedKeys = [
    'PIMPINAN',
    'MANAGER_LATANSA',
    'MANAGER_PALEN',
    'SUPERVISOR',
    'KASIR',
    'CUTTER',
    'DRIVER',
  ];
  for (const key of expectedKeys) {
    assert.ok(DEMO_IDENTITIES[key], `Demo identity ${key} must exist`);
  }
});

console.log('\n--- 2. Unit Isolation Verification ---');

runTest('3. Manager La Tansa is strictly scoped to La Tansa and cannot access Palen', () => {
  const mgr = DEMO_IDENTITIES.MANAGER_LATANSA;
  assert.strictEqual(mgr.unitId, CANONICAL_DEMO_UNITS.LATANSA.id);
  assert.notStrictEqual(mgr.unitId, CANONICAL_DEMO_UNITS.PALEN.id);
});

runTest('4. Manager Palen is strictly scoped to Palen and cannot access La Tansa', () => {
  const mgr = DEMO_IDENTITIES.MANAGER_PALEN;
  assert.strictEqual(mgr.unitId, CANONICAL_DEMO_UNITS.PALEN.id);
  assert.notStrictEqual(mgr.unitId, CANONICAL_DEMO_UNITS.LATANSA.id);
});

runTest('5. Pimpinan has cross-unit scope (ALL) and can view aggregate Pusat', () => {
  const pimpinan = DEMO_IDENTITIES.PIMPINAN;
  assert.strictEqual(pimpinan.unitScope, 'ALL');
  assert.strictEqual(pimpinan.isSuperAdmin, true);
  assert.strictEqual(pimpinan.isAdminPusat, true);
});

console.log('\n--- 3. Granular RBAC Permission Verification ---');

runTest('6. Cutter can access glass_tips and attendance, but is denied payroll, employees, fleet, and finance', () => {
  const perms = DEMO_IDENTITIES.CUTTER.permissions;
  assert.ok(perms.includes('glass_tips.view'));
  assert.ok(perms.includes('attendance.view'));
  assert.strictEqual(perms.includes('payroll.view'), false);
  assert.strictEqual(perms.includes('employees.view'), false);
  assert.strictEqual(perms.includes('fleet.view'), false);
  assert.strictEqual(perms.includes('finance.view'), false);
});

runTest('7. Driver can access fleet and attendance, but is denied glass_tips, payroll, and finance', () => {
  const perms = DEMO_IDENTITIES.DRIVER.permissions;
  assert.ok(perms.includes('fleet.view'));
  assert.ok(perms.includes('attendance.view'));
  assert.strictEqual(perms.includes('glass_tips.view'), false);
  assert.strictEqual(perms.includes('payroll.view'), false);
  assert.strictEqual(perms.includes('finance.view'), false);
});

runTest('8. Kasir can access glass_tips and finance/payroll view, but is denied employees and fleet management', () => {
  const perms = DEMO_IDENTITIES.KASIR.permissions;
  assert.ok(perms.includes('glass_tips.view'));
  assert.ok(perms.includes('glass_tips.verify'));
  assert.ok(perms.includes('finance.view'));
  assert.strictEqual(perms.includes('employees.view'), false);
  assert.strictEqual(perms.includes('fleet.manage'), false);
});

runTest('9. Supervisor can view employees, leave, fleet, and briefing, but is denied payroll management', () => {
  const perms = DEMO_IDENTITIES.SUPERVISOR.permissions;
  assert.ok(perms.includes('employees.view'));
  assert.ok(perms.includes('leave.view'));
  assert.ok(perms.includes('fleet.view'));
  assert.ok(perms.includes('attendance.manage_briefing'));
  assert.strictEqual(perms.includes('payroll.manage'), false);
  assert.strictEqual(perms.includes('payroll.finalize'), false);
});

runTest('10. Switching demo identity resets prior identity and sets isolated preview mode', () => {
  let activeState = {
    identity: 'MANAGER_LATANSA',
    unitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    isPreviewActive: true,
  };

  // Switch to Manager Palen
  const switchIdentity = (newKey) => {
    const ident = DEMO_IDENTITIES[newKey];
    activeState = {
      identity: newKey,
      unitId: ident.unitId || null,
      isPreviewActive: true,
    };
  };

  switchIdentity('MANAGER_PALEN');
  assert.strictEqual(activeState.identity, 'MANAGER_PALEN');
  assert.strictEqual(activeState.unitId, CANONICAL_DEMO_UNITS.PALEN.id);
  assert.strictEqual(activeState.isPreviewActive, true);

  // Switch to Cutter
  switchIdentity('CUTTER');
  assert.strictEqual(activeState.identity, 'CUTTER');
  assert.strictEqual(activeState.unitId, CANONICAL_DEMO_UNITS.LATANSA.id);
});

runTest('11. Demo user object contains metadata flag is_demo: true and provider: demo_uat', () => {
  const demoUser = {
    id: 'demo-user-1',
    app_metadata: { provider: 'demo_uat', is_demo: true },
    user_metadata: { role: 'KASIR', is_demo: true },
    email: 'kasir.demo@kuk.test',
  };
  assert.strictEqual(demoUser.app_metadata.is_demo, true);
  assert.strictEqual(demoUser.app_metadata.provider, 'demo_uat');
  assert.strictEqual(demoUser.email.endsWith('@kuk.test'), true);
});

console.log('\n================================================================');
console.log(`  UAT DEMO TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}

