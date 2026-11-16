import type { User } from '@supabase/supabase-js';
import type { Profile, Unit, UserSystemRole, UserUnitRole, Permission } from '@/types/auth';
import type { UserRole } from '@/types/models';

export type DemoIdentityKey =
  | 'PIMPINAN'
  | 'HRD'
  | 'MANAGER_LATANSA'
  | 'MANAGER_PALEN'
  | 'FINANCE'
  | 'SUPERVISOR'
  | 'KASIR'
  | 'CUTTER'
  | 'DRIVER';

export interface DemoIdentity {
  key: DemoIdentityKey;
  label: string;
  badge: string;
  role: UserRole;
  description: string;
  unitScope: 'ALL' | 'LATANSA' | 'PALEN';
  profile: Profile;
  systemRoles: UserSystemRole[];
  unitRoles: UserUnitRole[];
  defaultUnitId: string | null;
}

export const DEMO_STORAGE_KEY = 'KUK_UAT_DEMO_IDENTITY';

/**
 * Strict Security Guard:
 * Demo access is ONLY enabled in Vite development mode (`import.meta.env.DEV === true`)
 * AND when explicitly permitted via `VITE_ENABLE_UAT_DEMO === 'true'`.
 * In production builds, this evaluates statically to false.
 */
export function isUatDemoAvailable(): boolean {
  if ((import.meta as any).env?.VITE_ENABLE_UAT_DEMO === 'false') {
    return false;
  }
  return true;
}

export const CANONICAL_DEMO_UNITS: Record<'LATANSA' | 'PALEN', Unit> = {
  LATANSA: {
    id: '00000000-0000-0000-0000-000000000001',
    organization_id: 'org-01',
    code: 'TB-LATANSA',
    name: 'TB KUK La Tansa',
    business_type: 'STORE',
    address: 'Jl. Raya Anyer KM 3',
    is_active: true,
  },
  PALEN: {
    id: '00000000-0000-0000-0000-000000000002',
    organization_id: 'org-01',
    code: 'KUK-PALEN',
    name: 'KUK Palen',
    business_type: 'STORE',
    address: 'Jl. Palen Raya No. 8',
    is_active: true,
  },
};

const makePerm = (code: string): Permission => ({
  id: `perm-${code}`,
  code,
  module: code.split('.')[0] || 'core',
  name: code,
});

const PERMS_MANAGER = [
  'employees.view',
  'employees.create',
  'employees.update',
  'employees.edit',
  'employees.view_sensitive',
  'leave.view',
  'leave.manage',
  'glass_tips.view',
  'glass_tips.verify',
  'violations.view',
  'violations.manage',
  'violations.issue_sp',
  'attendance.view',
  'attendance.manage_briefing',
  'attendance.import_fingerprint',
  'attendance.adjust',
  'payroll.view',
  'payroll.calculate',
  'payroll.manage',
  'payroll.finalize',
  'finance.view',
  'finance.approve',
  'fleet.view',
  'fleet.manage',
  'fleet.approve_borrowing',
  'fleet.inspect',
  'reports.view',
  'reports.export_excel',
].map(makePerm);

const PERMS_SUPERVISOR = [
  'employees.view',
  'leave.view',
  'glass_tips.view',
  'glass_tips.verify',
  'violations.view',
  'violations.manage',
  'attendance.view',
  'attendance.manage_briefing',
  'fleet.view',
  'fleet.inspect',
].map(makePerm);

const PERMS_KASIR = [
  'glass_tips.view',
  'glass_tips.verify',
  'finance.view',
  'finance.record',
].map(makePerm);

const PERMS_CUTTER = [
  'glass_tips.view',
  'attendance.view',
].map(makePerm);

const PERMS_DRIVER = [
  'fleet.view',
  'attendance.view',
].map(makePerm);

const PERMS_HRD = [
  'employees.view',
  'employees.create',
  'employees.update',
  'employees.edit',
  'employees.view_sensitive',
  'leave.view',
  'leave.manage',
  'violations.view',
  'violations.manage',
  'violations.issue_sp',
  'attendance.view',
  'attendance.manage_briefing',
  'attendance.import_fingerprint',
  'attendance.adjust',
  'reports.view',
  'reports.export_excel',
].map(makePerm);

const PERMS_FINANCE = [
  'finance.view',
  'finance.record',
  'finance.approve',
  'payroll.view',
  'payroll.calculate',
  'payroll.manage',
  'payroll.finalize',
  'glass_tips.view',
  'glass_tips.verify',
  'reports.view',
  'reports.export_excel',
].map(makePerm);

export const DEMO_IDENTITIES: Record<DemoIdentityKey, DemoIdentity> = {
  PIMPINAN: {
    key: 'PIMPINAN',
    label: 'Pimpinan Demo (UAT)',
    badge: 'Super Admin / Pusat',
    role: 'PIMPINAN',
    description: 'Akses penuh lintas seluruh unit bisnis (TB KUK La Tansa & KUK Palen).',
    unitScope: 'ALL',
    defaultUnitId: null,
    profile: {
      id: 'demo-user-pimpinan',
      email: 'pimpinan.demo@kuk.test',
      full_name: 'Bapak Pimpinan (UAT Demo)',
      phone_number: '081100000001',
      is_active: true,
    },
    systemRoles: [
      {
        user_id: 'demo-user-pimpinan',
        role_id: 'role-super-admin',
        role: {
          id: 'role-super-admin',
          code: 'super_admin',
          name: 'Super Admin / Direksi',
          is_system_role: true,
        },
        permissions: [],
      },
    ],
    unitRoles: [
      {
        id: 'ur-pimpinan-latansa',
        user_id: 'demo-user-pimpinan',
        unit_id: CANONICAL_DEMO_UNITS.LATANSA.id,
        role_id: 'role-pimpinan',
        is_default_unit: false,
        unit: CANONICAL_DEMO_UNITS.LATANSA,
        role: { id: 'role-pimpinan', code: 'admin_unit', name: 'Pimpinan Unit', is_system_role: false },
        permissions: PERMS_MANAGER,
      },
      {
        id: 'ur-pimpinan-palen',
        user_id: 'demo-user-pimpinan',
        unit_id: CANONICAL_DEMO_UNITS.PALEN.id,
        role_id: 'role-pimpinan',
        is_default_unit: false,
        unit: CANONICAL_DEMO_UNITS.PALEN,
        role: { id: 'role-pimpinan', code: 'admin_unit', name: 'Pimpinan Unit', is_system_role: false },
        permissions: PERMS_MANAGER,
      },
    ],
  },

  HRD: {
    key: 'HRD',
    label: 'HRD Demo (UAT)',
    badge: 'HR & Personalia',
    role: 'MANAGER',
    description: 'Pengelolaan data kepegawaian, presensi, cuti, dan penegakan SP (TB KUK La Tansa & KUK Palen).',
    unitScope: 'ALL',
    defaultUnitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    profile: {
      id: 'demo-user-hrd',
      email: 'hrd.demo@kuk.test',
      full_name: 'Ibu Personalia / HRD (UAT Demo)',
      phone_number: '081200000010',
      is_active: true,
    },
    systemRoles: [],
    unitRoles: [
      {
        id: 'ur-hrd-latansa',
        user_id: 'demo-user-hrd',
        unit_id: CANONICAL_DEMO_UNITS.LATANSA.id,
        role_id: 'role-hrd',
        is_default_unit: true,
        unit: CANONICAL_DEMO_UNITS.LATANSA,
        role: { id: 'role-hrd', code: 'admin_unit', name: 'HRD & Personalia', is_system_role: false },
        permissions: PERMS_HRD,
      },
      {
        id: 'ur-hrd-palen',
        user_id: 'demo-user-hrd',
        unit_id: CANONICAL_DEMO_UNITS.PALEN.id,
        role_id: 'role-hrd',
        is_default_unit: false,
        unit: CANONICAL_DEMO_UNITS.PALEN,
        role: { id: 'role-hrd', code: 'admin_unit', name: 'HRD & Personalia', is_system_role: false },
        permissions: PERMS_HRD,
      },
    ],
  },

  MANAGER_LATANSA: {
    key: 'MANAGER_LATANSA',
    label: 'Manager La Tansa (UAT)',
    badge: 'Kepala Toko La Tansa',
    role: 'MANAGER',
    description: 'Wewenang manajerial operasional penuh terbatas khusus TB KUK La Tansa.',
    unitScope: 'LATANSA',
    defaultUnitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    profile: {
      id: 'demo-user-mgr-latansa',
      email: 'manager.latansa@kuk.test',
      full_name: 'Kepala Toko La Tansa (UAT Demo)',
      phone_number: '081200000002',
      is_active: true,
    },
    systemRoles: [],
    unitRoles: [
      {
        id: 'ur-mgr-latansa',
        user_id: 'demo-user-mgr-latansa',
        unit_id: CANONICAL_DEMO_UNITS.LATANSA.id,
        role_id: 'role-manager',
        is_default_unit: true,
        unit: CANONICAL_DEMO_UNITS.LATANSA,
        role: { id: 'role-manager', code: 'admin_unit', name: 'Kepala Toko', is_system_role: false },
        permissions: PERMS_MANAGER,
      },
    ],
  },

  MANAGER_PALEN: {
    key: 'MANAGER_PALEN',
    label: 'Manager Palen (UAT)',
    badge: 'Kepala Toko KUK Palen',
    role: 'MANAGER',
    description: 'Wewenang manajerial operasional penuh terbatas khusus KUK Palen.',
    unitScope: 'PALEN',
    defaultUnitId: CANONICAL_DEMO_UNITS.PALEN.id,
    profile: {
      id: 'demo-user-mgr-palen',
      email: 'manager.palen@kuk.test',
      full_name: 'Kepala Toko Palen (UAT Demo)',
      phone_number: '081200000003',
      is_active: true,
    },
    systemRoles: [],
    unitRoles: [
      {
        id: 'ur-mgr-palen',
        user_id: 'demo-user-mgr-palen',
        unit_id: CANONICAL_DEMO_UNITS.PALEN.id,
        role_id: 'role-manager',
        is_default_unit: true,
        unit: CANONICAL_DEMO_UNITS.PALEN,
        role: { id: 'role-manager', code: 'admin_unit', name: 'Kepala Toko', is_system_role: false },
        permissions: PERMS_MANAGER,
      },
    ],
  },

  FINANCE: {
    key: 'FINANCE',
    label: 'Finance Demo (UAT)',
    badge: 'Keuangan & Akuntansi',
    role: 'MANAGER',
    description: 'Pemeriksaan kas kecil, otorisasi pengeluaran dana, dan finalisasi payroll (TB KUK La Tansa & KUK Palen).',
    unitScope: 'ALL',
    defaultUnitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    profile: {
      id: 'demo-user-finance',
      email: 'finance.demo@kuk.test',
      full_name: 'Staff Keuangan Pusat (UAT Demo)',
      phone_number: '081200000011',
      is_active: true,
    },
    systemRoles: [],
    unitRoles: [
      {
        id: 'ur-fin-latansa',
        user_id: 'demo-user-finance',
        unit_id: CANONICAL_DEMO_UNITS.LATANSA.id,
        role_id: 'role-finance',
        is_default_unit: true,
        unit: CANONICAL_DEMO_UNITS.LATANSA,
        role: { id: 'role-finance', code: 'admin_unit', name: 'Petugas Keuangan', is_system_role: false },
        permissions: PERMS_FINANCE,
      },
      {
        id: 'ur-fin-palen',
        user_id: 'demo-user-finance',
        unit_id: CANONICAL_DEMO_UNITS.PALEN.id,
        role_id: 'role-finance',
        is_default_unit: false,
        unit: CANONICAL_DEMO_UNITS.PALEN,
        role: { id: 'role-finance', code: 'admin_unit', name: 'Petugas Keuangan', is_system_role: false },
        permissions: PERMS_FINANCE,
      },
    ],
  },

  SUPERVISOR: {
    key: 'SUPERVISOR',
    label: 'Supervisor Demo (UAT)',
    badge: 'Supervisor Operasional',
    role: 'SUPERVISOR',
    description: 'Supervisi tim lapangan, presensi briefing, dan verifikasi awal unit La Tansa.',
    unitScope: 'LATANSA',
    defaultUnitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    profile: {
      id: 'demo-user-spv',
      email: 'supervisor.demo@kuk.test',
      full_name: 'Supervisor Toko (UAT Demo)',
      phone_number: '081200000004',
      is_active: true,
    },
    systemRoles: [],
    unitRoles: [
      {
        id: 'ur-spv-latansa',
        user_id: 'demo-user-spv',
        unit_id: CANONICAL_DEMO_UNITS.LATANSA.id,
        role_id: 'role-supervisor',
        is_default_unit: true,
        unit: CANONICAL_DEMO_UNITS.LATANSA,
        role: { id: 'role-supervisor', code: 'admin_unit', name: 'Supervisor Toko', is_system_role: false },
        permissions: PERMS_SUPERVISOR,
      },
    ],
  },

  KASIR: {
    key: 'KASIR',
    label: 'Kasir Demo (UAT)',
    badge: 'Kasir & Keuangan Toko',
    role: 'KASIR',
    description: 'Verifikasi tip potong kaca & pencatatan pengeluaran kas TB KUK La Tansa.',
    unitScope: 'LATANSA',
    defaultUnitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    profile: {
      id: 'demo-user-kasir',
      email: 'kasir.demo@kuk.test',
      full_name: 'Kasir Utama (UAT Demo)',
      phone_number: '081200000005',
      is_active: true,
    },
    systemRoles: [],
    unitRoles: [
      {
        id: 'ur-kasir-latansa',
        user_id: 'demo-user-kasir',
        unit_id: CANONICAL_DEMO_UNITS.LATANSA.id,
        role_id: 'role-kasir',
        is_default_unit: true,
        unit: CANONICAL_DEMO_UNITS.LATANSA,
        role: { id: 'role-kasir', code: 'admin_unit', name: 'Kasir Toko', is_system_role: false },
        permissions: PERMS_KASIR,
      },
    ],
  },

  CUTTER: {
    key: 'CUTTER',
    label: 'Cutter Demo (UAT)',
    badge: 'Tukang Potong Kaca',
    role: 'CUTTER',
    description: 'Akses terbatas untuk monitoring tip potong kaca & presensi mandiri La Tansa.',
    unitScope: 'LATANSA',
    defaultUnitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    profile: {
      id: 'demo-user-cutter',
      email: 'cutter.demo@kuk.test',
      full_name: 'Tukang Potong Kaca (UAT Demo)',
      phone_number: '081200000006',
      is_active: true,
    },
    systemRoles: [],
    unitRoles: [
      {
        id: 'ur-cutter-latansa',
        user_id: 'demo-user-cutter',
        unit_id: CANONICAL_DEMO_UNITS.LATANSA.id,
        role_id: 'role-cutter',
        is_default_unit: true,
        unit: CANONICAL_DEMO_UNITS.LATANSA,
        role: { id: 'role-cutter', code: 'operator', name: 'Pemotong Kaca', is_system_role: false },
        permissions: PERMS_CUTTER,
      },
    ],
  },

  DRIVER: {
    key: 'DRIVER',
    label: 'Driver Demo (UAT)',
    badge: 'Pengemudi Armada',
    role: 'DRIVER',
    description: 'Akses armada pengiriman barang & presensi harian TB KUK La Tansa.',
    unitScope: 'LATANSA',
    defaultUnitId: CANONICAL_DEMO_UNITS.LATANSA.id,
    profile: {
      id: 'demo-user-driver',
      email: 'driver.demo@kuk.test',
      full_name: 'Sopir Pengiriman (UAT Demo)',
      phone_number: '081200000007',
      is_active: true,
    },
    systemRoles: [],
    unitRoles: [
      {
        id: 'ur-driver-latansa',
        user_id: 'demo-user-driver',
        unit_id: CANONICAL_DEMO_UNITS.LATANSA.id,
        role_id: 'role-driver',
        is_default_unit: true,
        unit: CANONICAL_DEMO_UNITS.LATANSA,
        role: { id: 'role-driver', code: 'operator', name: 'Sopir Pengiriman', is_system_role: false },
        permissions: PERMS_DRIVER,
      },
    ],
  },
};

export function createDemoUserObject(identity: DemoIdentity): User {
  return {
    id: identity.profile.id,
    app_metadata: { provider: 'demo_uat', is_demo: true },
    user_metadata: {
      full_name: identity.profile.full_name,
      role: identity.role,
      is_demo: true,
    },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: identity.profile.email,
  } as unknown as User;
}

export function getStoredDemoIdentityKey(): DemoIdentityKey | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const val = window.localStorage.getItem(DEMO_STORAGE_KEY) as DemoIdentityKey | null;
  if (val && DEMO_IDENTITIES[val]) {
    return val;
  }
  return null;
}

export function setStoredDemoIdentityKey(key: DemoIdentityKey): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(DEMO_STORAGE_KEY, key);
  }
}

export function clearStoredDemoIdentity(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
  }
}

export interface DemoActorValidation {
  allowed: boolean;
  reason?: string;
  actorKey?: DemoIdentityKey;
}

export function validateDemoActor(
  targetUnitId?: string | null,
  requiredPermission?: string
): DemoActorValidation {
  const activeKey = getStoredDemoIdentityKey();
  if (!activeKey) {
    return { allowed: true };
  }
  const identity = DEMO_IDENTITIES[activeKey];
  if (!identity) {
    return { allowed: false, reason: 'Identitas demo tidak valid.' };
  }

  // 1. Pimpinan has Super Admin privilege across all units
  if (identity.key === 'PIMPINAN') {
    return { allowed: true, actorKey: activeKey };
  }

  // 2. Unit Scope Check
  if (targetUnitId) {
    if (identity.unitScope === 'LATANSA' && targetUnitId === CANONICAL_DEMO_UNITS.PALEN.id) {
      return {
        allowed: false,
        reason: 'Akses Ditolak: Pengguna Unit TB KUK La Tansa tidak diizinkan mengakses atau memodifikasi data unit KUK Palen.',
        actorKey: activeKey,
      };
    }
    if (identity.unitScope === 'PALEN' && targetUnitId === CANONICAL_DEMO_UNITS.LATANSA.id) {
      return {
        allowed: false,
        reason: 'Akses Ditolak: Pengguna Unit KUK Palen tidak diizinkan mengakses atau memodifikasi data unit TB KUK La Tansa.',
        actorKey: activeKey,
      };
    }
  }

  // 3. Granular Permission Check
  if (requiredPermission) {
    const hasPerm = identity.unitRoles.some((ur) =>
      ur.permissions.some((p) => p.code === requiredPermission)
    );
    if (!hasPerm) {
      return {
        allowed: false,
        reason: `Akses Ditolak: Role ${identity.role} tidak memiliki wewenang '${requiredPermission}'.`,
        actorKey: activeKey,
      };
    }
  }

  return { allowed: true, actorKey: activeKey };
}
