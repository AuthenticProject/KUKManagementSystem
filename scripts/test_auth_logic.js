// Verification script for Auth and Multi-Unit permission logic
import assert from 'node:assert';

console.log('=== TEST SUITE: MULTI-UNIT RBAC & PERMISSION LOGIC ===');

// Mock data structures matching v3.1.0 schema
const units = {
  laTansa: { id: 'u-latansa-01', code: 'TB-LATANSA', name: 'TB KUK La Tansa', is_active: true },
  palen: { id: 'u-palen-02', code: 'KUK-PALEN', name: 'KUK Palen', is_active: true },
  unauthorized: { id: 'u-secret-03', code: 'KUK-SECRET', name: 'KUK Confidential Unit', is_active: true }
};

// Pure logic extracted directly from AuthContext.tsx
function createAuthEvaluator(systemRoles, unitRoles) {
  const isSuperAdmin = systemRoles.some((sr) => sr.role.code === 'super_admin');
  const isAdminPusat = isSuperAdmin || systemRoles.some((sr) => sr.role.code === 'admin_pusat');

  const hasPermission = (permissionCode, unitId) => {
    if (isSuperAdmin) return true;

    // Check global system permission
    const hasGlobalPerm = systemRoles.some((sr) =>
      sr.permissions.some((p) => p.code === permissionCode)
    );
    if (hasGlobalPerm) return true;

    if (!unitId) return false;

    // Check unit-scoped permission
    return unitRoles.some(
      (ur) =>
        ur.unit_id === unitId &&
        ur.permissions.some((p) => p.code === permissionCode)
    );
  };

  return { isSuperAdmin, isAdminPusat, hasPermission };
}

// Pure logic extracted directly from UnitContext.tsx
function createUnitSwitcher(isAdminPusat, availableUnits, queryClientMock) {
  let activeUnitId = null;

  const setActiveUnitId = (newUnitId) => {
    if (newUnitId === activeUnitId) return 'NO_OP';

    // 1. Authorization check
    if (newUnitId !== null) {
      const isAllowed = availableUnits.some((u) => u.id === newUnitId);
      if (!isAllowed) {
        return 'REJECTED_UNAUTHORIZED_UNIT';
      }
    } else {
      // 2. Pusat aggregate check
      if (!isAdminPusat) {
        return 'REJECTED_PUSAT_UNAUTHORIZED';
      }
    }

    activeUnitId = newUnitId;
    queryClientMock.clear();
    return 'SUCCESS';
  };

  return { getActiveUnitId: () => activeUnitId, setActiveUnitId };
}

// -------------------------------------------------------------
// CASE 1: Super Admin
// -------------------------------------------------------------
console.log('\n[TEST 1] Testing Super Admin permissions:');
const superAdmin = createAuthEvaluator(
  [{ role: { code: 'super_admin' }, permissions: [] }],
  []
);
assert.strictEqual(superAdmin.isSuperAdmin, true);
assert.strictEqual(superAdmin.isAdminPusat, true);
assert.strictEqual(superAdmin.hasPermission('payroll.manage', units.laTansa.id), true);
assert.strictEqual(superAdmin.hasPermission('settings.manage', null), true);
console.log('✓ Super Admin has unrestricted permissions across all units and global scope.');

// -------------------------------------------------------------
// CASE 2: Admin TB KUK La Tansa (Unit Admin)
// -------------------------------------------------------------
console.log('\n[TEST 2] Testing Admin TB KUK La Tansa (Scoped to La Tansa only):');
const adminLaTansa = createAuthEvaluator(
  [],
  [
    {
      unit_id: units.laTansa.id,
      unit: units.laTansa,
      role: { code: 'unit_admin' },
      permissions: [
        { code: 'employees.view' },
        { code: 'employees.manage' },
        { code: 'leave.view' },
        { code: 'leave.manage' },
        { code: 'glass_tips.view' }
      ]
    }
  ]
);
assert.strictEqual(adminLaTansa.isSuperAdmin, false);
assert.strictEqual(adminLaTansa.isAdminPusat, false);
// Can access La Tansa
assert.strictEqual(adminLaTansa.hasPermission('employees.view', units.laTansa.id), true);
assert.strictEqual(adminLaTansa.hasPermission('leave.manage', units.laTansa.id), true);
// CANNOT access Palen
assert.strictEqual(adminLaTansa.hasPermission('employees.view', units.palen.id), false);
assert.strictEqual(adminLaTansa.hasPermission('leave.manage', units.palen.id), false);
// CANNOT access global settings
assert.strictEqual(adminLaTansa.hasPermission('settings.manage', null), false);
console.log('✓ Admin TB KUK La Tansa permissions are strictly isolated from KUK Palen.');

// -------------------------------------------------------------
// CASE 3: Limited Staff (Operator Potong Kaca)
// -------------------------------------------------------------
console.log('\n[TEST 3] Testing Limited Staff (Glass Cutting Operator):');
const staffKaca = createAuthEvaluator(
  [],
  [
    {
      unit_id: units.palen.id,
      unit: units.palen,
      role: { code: 'operator' },
      permissions: [{ code: 'glass_tips.view' }]
    }
  ]
);
assert.strictEqual(staffKaca.hasPermission('glass_tips.view', units.palen.id), true);
assert.strictEqual(staffKaca.hasPermission('payroll.view', units.palen.id), false);
assert.strictEqual(staffKaca.hasPermission('employees.manage', units.palen.id), false);
console.log('✓ Operator only has access to glass_tips.view, unauthorized views rejected.');

// -------------------------------------------------------------
// CASE 4: Unit Switching & Cache Invalidation
// -------------------------------------------------------------
console.log('\n[TEST 4] Testing Unit Switching Security & Cache Invalidation:');
let cacheClearedCount = 0;
const mockQueryClient = {
  clear: () => { cacheClearedCount++; }
};

const staffUnitSwitcher = createUnitSwitcher(
  false, // NOT admin pusat
  [units.laTansa], // Only has access to La Tansa
  mockQueryClient
);

// Switch to allowed unit
const res1 = staffUnitSwitcher.setActiveUnitId(units.laTansa.id);
assert.strictEqual(res1, 'SUCCESS');
assert.strictEqual(staffUnitSwitcher.getActiveUnitId(), units.laTansa.id);
assert.strictEqual(cacheClearedCount, 1);
console.log('✓ Switching to assigned unit succeeded and cleared query cache.');

// Attempt switch to unauthorized unit (KUK Palen)
const res2 = staffUnitSwitcher.setActiveUnitId(units.palen.id);
assert.strictEqual(res2, 'REJECTED_UNAUTHORIZED_UNIT');
assert.strictEqual(staffUnitSwitcher.getActiveUnitId(), units.laTansa.id); // Did not change
console.log('✓ Switching to unauthorized unit rejected!');

// Attempt switch to Pusat Aggregate mode
const res3 = staffUnitSwitcher.setActiveUnitId(null);
assert.strictEqual(res3, 'REJECTED_PUSAT_UNAUTHORIZED');
assert.strictEqual(staffUnitSwitcher.getActiveUnitId(), units.laTansa.id); // Did not change
console.log('✓ Switching to Pusat aggregate mode rejected for non-pusat role!');

// -------------------------------------------------------------
// CASE 5: Admin Pusat Switching
// -------------------------------------------------------------
console.log('\n[TEST 5] Testing Admin Pusat Switching:');
const pusatUnitSwitcher = createUnitSwitcher(
  true, // Admin pusat
  [units.laTansa, units.palen],
  mockQueryClient
);

assert.strictEqual(pusatUnitSwitcher.setActiveUnitId(units.palen.id), 'SUCCESS');
assert.strictEqual(pusatUnitSwitcher.getActiveUnitId(), units.palen.id);
assert.strictEqual(pusatUnitSwitcher.setActiveUnitId(null), 'SUCCESS');
assert.strictEqual(pusatUnitSwitcher.getActiveUnitId(), null);
console.log('✓ Admin Pusat can seamlessly switch between aggregate view and individual units with total cache clearing.');

console.log('\n>>> ALL 5 MULTI-UNIT RBAC & PERMISSION LOGIC TESTS PASSED 100% <<<');
