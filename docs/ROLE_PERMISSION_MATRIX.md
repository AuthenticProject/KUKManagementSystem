# ROLE-PERMISSION MATRIX — KUK MANAGEMENT SYSTEM
## Granular RBAC & Contextual Access Control
**Versi:** 3.0.0  
**Tanggal:** 2026-11-04  
**Status:** RBAC Baseline / Phase 0 Final  

---

## 1. Definisi Peran Sistem (System Roles)

Sistem KUK Management System menetapkan 7 peran terstandarisasi:

1. **Super Admin (`super_admin`)**:
   - Pemegang kendali tertinggi seluruh sistem KUK.
   - Hak akses lintas unit secara global tanpa batas.
   - Mengelola akun staf, konfigurasi organisasi, skema tarif, dan memeriksa rekaman audit trail.
2. **Admin Pusat (`admin_pusat`)**:
   - Pimpinan eksekutif dan auditor operasional kantor pusat.
   - Memiliki visibilitas lintas unit (*multi-unit aggregate scope*).
   - Memantau dasbor eksekutif, rekapitulasi cuti, kepatuhan presensi, armada, dan ringkasan keuangan.
3. **HRD Manager (`hrd_manager`)**:
   - Pengelola operasional kepegawaian dan kepatuhan SDM.
   - Berwenang mengelola master data karyawan, permohonan cuti, sanksi pelanggaran, penerbitan Surat Peringatan (SP), dan pemantauan presensi briefing/fingerprint.
4. **Finance / Payroll (`finance_payroll`)**:
   - Pengelola keuangan, struktur gaji, dan penggajian.
   - Berwenang memvalidasi tip potong kaca, menjalankan kalkulasi payroll, melakukan penyesuaian/koreksi, memfinalisasi slip gaji, dan mencetak slip PDF.
5. **Fleet Manager (`fleet_manager`)**:
   - Pengelola aset kendaraan dan armada operasional toko/gudang.
   - Berwenang menyetujui peminjaman kendaraan, melakukan inspeksi fisik Check-In/Check-Out, memvalidasi log BBM, dan menangani klaim kompensasi kerusakan.
6. **Admin Unit (`admin_unit`)**:
   - Administrator operasional di unit kerja lokal (misal: TB KUK La Tansa atau KUK Palen).
   - Mengelola operasional harian terbatas pada unit yang ditugaskan (pencatatan absensi, input cuti bantuan, cek armada, update data profil karyawan unit).
7. **Operator (`operator`)**:
   - Staf pelaksana teknis di lapangan.
   - Berwenang mencatat presensi briefing pagi, memverifikasi fisik kendaraan, dan membantu input operasional harian dengan hak akses paling terbatas.

---

## 2. Matriks Izin Granular (Permissions Matrix)

Keterangan Simbol:
- `✓ (Global)` : Berlaku otomatis untuk seluruh unit dalam sistem.
- `✓ (Unit)`   : Berlaku terbatas hanya pada unit kerja yang ditugaskan kepada staf (`user_unit_access`).
- `-`          : Tidak memiliki hak akses (ditolak di level RLS).

| Modul Sistem | Kode Izin Granular (*Permission Code*) | Super Admin | Admin Pusat | HRD Manager | Finance Payroll | Fleet Manager | Admin Unit | Operator |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Organisasi & Unit** | `organizations.manage` | ✓ (Global) | - | - | - | - | - | - |
| | `units.manage` | ✓ (Global) | - | - | - | - | - | - |
| **Master Karyawan** | `employees.view` | ✓ (Global) | ✓ (Global) | ✓ (Unit) | ✓ (Unit) | ✓ (Unit) | ✓ (Unit) | ✓ (Unit) |
| | `employees.create` | ✓ (Global) | - | ✓ (Unit) | - | - | ✓ (Unit) | - |
| | `employees.update` | ✓ (Global) | - | ✓ (Unit) | - | - | ✓ (Unit) | - |
| | `employees.deactivate` | ✓ (Global) | - | ✓ (Unit) | - | - | - | - |
| **Modul Cuti** | `leave.view` | ✓ (Global) | ✓ (Global) | ✓ (Unit) | ✓ (Unit) | - | ✓ (Unit) | - |
| | `leave.manage` | ✓ (Global) | - | ✓ (Unit) | - | - | ✓ (Unit) | - |
| | `leave.override_window` | ✓ (Global) | - | ✓ (Unit) | - | - | - | - |
| **Tip Potong Kaca** | `glass_tips.view` | ✓ (Global) | ✓ (Global) | - | ✓ (Unit) | - | ✓ (Unit) | ✓ (Unit) |
| | `glass_tips.verify` | ✓ (Global) | - | - | ✓ (Unit) | - | ✓ (Unit) | - |
| | `glass_tips.rates_manage`| ✓ (Global) | - | - | ✓ (Unit) | - | - | - |
| **Pelanggaran & SP** | `violations.view` | ✓ (Global) | ✓ (Global) | ✓ (Unit) | - | - | ✓ (Unit) | - |
| | `violations.manage` | ✓ (Global) | - | ✓ (Unit) | - | - | ✓ (Unit) | - |
| | `violations.issue_sp` | ✓ (Global) | - | ✓ (Unit) | - | - | - | - |
| **Presensi & Mesin** | `attendance.view` | ✓ (Global) | ✓ (Global) | ✓ (Unit) | ✓ (Unit) | - | ✓ (Unit) | ✓ (Unit) |
| | `attendance.manage_briefing`| ✓ (Global) | - | ✓ (Unit) | - | - | ✓ (Unit) | ✓ (Unit) |
| | `attendance.import_fingerprint`| ✓ (Global) | - | ✓ (Unit) | - | - | ✓ (Unit) | - |
| | `attendance.adjust` | ✓ (Global) | - | ✓ (Unit) | - | - | - | - |
| **Penggajian / Payroll**| `payroll.view` | ✓ (Global) | ✓ (Global) | - | ✓ (Unit) | - | - | - |
| | `payroll.calculate` | ✓ (Global) | - | - | ✓ (Unit) | - | - | - |
| | `payroll.manage` | ✓ (Global) | - | - | ✓ (Unit) | - | - | - |
| | `payroll.finalize` | ✓ (Global) | - | - | ✓ (Unit) | - | - | - |
| | `payroll.unfinalize` | ✓ (Global) | - | - | - | - | - | - |
| **Armada Kendaraan** | `fleet.view` | ✓ (Global) | ✓ (Global) | - | - | ✓ (Unit) | ✓ (Unit) | ✓ (Unit) |
| | `fleet.manage` | ✓ (Global) | - | - | - | ✓ (Unit) | ✓ (Unit) | - |
| | `fleet.approve_borrowing` | ✓ (Global) | - | - | - | ✓ (Unit) | ✓ (Unit) | - |
| | `fleet.inspect` | ✓ (Global) | - | - | - | ✓ (Unit) | ✓ (Unit) | ✓ (Unit) |
| | `fleet.manage_damages` | ✓ (Global) | - | - | - | ✓ (Unit) | - | - |
| **Laporan & Ekspor** | `reports.view` | ✓ (Global) | ✓ (Global) | ✓ (Unit) | ✓ (Unit) | ✓ (Unit) | ✓ (Unit) | - |
| | `reports.export_excel` | ✓ (Global) | ✓ (Global) | ✓ (Unit) | ✓ (Unit) | ✓ (Unit) | ✓ (Unit) | - |
| **Staf & Akun Pengguna**| `staff.view` | ✓ (Global) | ✓ (Global) | - | - | - | - | - |
| | `staff.manage` | ✓ (Global) | - | - | - | - | - | - |
| | `roles.manage` | ✓ (Global) | - | - | - | - | - | - |
| **Audit & Pengaturan** | `audit_logs.view` | ✓ (Global) | ✓ (Global) | - | - | - | - | - |
| | `activity_logs.view` | ✓ (Global) | ✓ (Global) | - | - | - | - | - |
| | `settings.manage` | ✓ (Global) | - | - | - | - | - | - |

---

## 3. Logika Resolusi Izin (Permission Resolution Engine)

Resolusi hak akses dieksekusi secara berlapis baik di backend (PostgreSQL RLS) maupun di frontend (React Route Guards & UI Hooks):

### 3.1 Implementasi Frontend Hook (`usePermission`)
```typescript
// src/hooks/usePermission.ts
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';

export function usePermission() {
  const { userProfile, permissions } = useAuth();
  const { activeUnitId } = useUnit();

  const can = (permissionCode: string, targetUnitId?: string): boolean => {
    // 1. Super Admin selalu memiliki izin absolut
    if (userProfile?.is_super_admin) return true;

    // 2. Tentukan konteks unit yang divalidasi
    const contextUnitId = targetUnitId || activeUnitId;
    if (!contextUnitId) return false;

    // 3. Evaluasi apakah izin terdaftar untuk kombinasi (unit, permissionCode)
    return permissions.some(
      (p) => p.unit_id === contextUnitId && p.code === permissionCode
    );
  };

  const hasAny = (permissionCodes: string[], targetUnitId?: string): boolean => {
    return permissionCodes.some((code) => can(code, targetUnitId));
  };

  const hasAll = (permissionCodes: string[], targetUnitId?: string): boolean => {
    return permissionCodes.every((code) => can(code, targetUnitId));
  };

  return { can, hasAny, hasAll };
}
```

### 3.2 Implementasi PostgreSQL RPC Enforcement
```sql
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_unit_id UUID,
    p_permission_code VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_super BOOLEAN;
    v_has_perm BOOLEAN;
BEGIN
    -- Cek Super Admin
    SELECT is_super_admin INTO v_is_super FROM profiles WHERE id = p_user_id;
    IF v_is_super = TRUE THEN
        RETURN TRUE;
    END IF;

    -- Cek Penugasan Role & Permission
    SELECT EXISTS (
        SELECT 1
        FROM user_unit_access uua
        JOIN role_permissions rp ON uua.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE uua.user_id = p_user_id
          AND uua.unit_id = p_unit_id
          AND p.code = p_permission_code
    ) INTO v_has_perm;

    RETURN v_has_perm;
END;
$$;
```

---

## 4. Perlindungan Menu Navigasi & Tindakan

Setiap komponen UI interaktif (tombol Aksi, tab menu, tombol ekspor) dibungkus oleh komponen pelindung `<RequirePermission>`:
```tsx
<RequirePermission permission="payroll.finalize">
  <Button variant="primary" onClick={handleFinalizePayroll}>
    Finalisasi Payroll & Terbitkan Slip
  </Button>
</RequirePermission>
```
Jika pengguna tidak memiliki hak akses, komponen tidak dirender, dan setiap panggilan API/RPC di backend tetap menolak request secara independen.

