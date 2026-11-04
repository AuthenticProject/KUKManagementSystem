# ROW LEVEL SECURITY (RLS) POLICY MATRIX — KUK MANAGEMENT SYSTEM
## Enterprise Security, Multi-Unit Isolation & Granular Permission Enforcement (v3.1.0)
**Versi:** 3.1.0  
**Tanggal:** 2026-11-04  
**Target:** PostgreSQL 15+ (Supabase RLS Engine)  

---

## 1. Arsitektur Kebijakan Keamanan Berlapis

Sistem RLS KUK Management System v3.1.0 menegakkan prinsip **Zero Trust & Least Privilege**:
1. **Pemisahan Konteks Publik vs Terautentikasi**:
   - Pengunjung publik (`anon`) **tidak memiliki akses baca langsung (`SELECT`)** ke tabel master karyawan, departemen, atau catatan transaksional internal.
   - Peminjaman armada dan input pemotongan kaca hanya dapat melakukan `INSERT` terfilter via validasi token atau eksekusi fungsi RPC `SECURITY DEFINER`.
2. **Pemisahan Data Multi-Unit**:
   - Staf unit hanya dapat mengakses baris data di mana `unit_id` terdaftar dalam penugasan aktifnya pada `user_unit_roles`.
   - Admin Pusat dan Super Admin yang memiliki penugasan di `user_system_roles` memiliki akses lintas unit sesuai matriks izin.
3. **Pemisahan Kolom & Data Sensitif**:
   - NIK, rekening bank, dan nomor NPWP dipisahkan ke tabel `employee_sensitive_data` dan hanya dapat dibaca oleh staf dengan izin `employees.view_sensitive`.
   - PIN otentikasi portal karyawan disimpan pada `employee_portal_auth` dan ditutup mutlak dari seluruh kueri REST API klien biasa.
4. **Proteksi Mutlak Audit Trail**:
   - Tabel `audit_logs` hanya dapat diakses baca oleh Super Admin / Auditor internal. Hak `UPDATE` dan `DELETE` dicabut permanen dari seluruh peran.

---

## 2. Fungsi Pembantu Keamanan (Security Helper Functions)

```sql
-- Memeriksa apakah pengguna memiliki role sistem tertentu (misal: 'super_admin' atau 'admin_pusat')
CREATE OR REPLACE FUNCTION has_system_role(p_role_code VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_system_roles usr
        JOIN roles r ON usr.role_id = r.id
        WHERE usr.user_id = auth.uid()
          AND r.code = p_role_code
    );
$$;

-- Memeriksa apakah pengguna memiliki hak akses dasar ke suatu unit
CREATE OR REPLACE FUNCTION has_unit_access(p_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT has_system_role('super_admin') OR has_system_role('admin_pusat') OR EXISTS (
        SELECT 1
        FROM user_unit_roles uur
        WHERE uur.user_id = auth.uid()
          AND uur.unit_id = p_unit_id
    );
$$;

-- Memeriksa izin granular pada unit tertentu
CREATE OR REPLACE FUNCTION has_unit_permission(p_unit_id UUID, p_permission_code VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT has_system_role('super_admin') OR EXISTS (
        -- Izin dari penugasan unit lokal
        SELECT 1
        FROM user_unit_roles uur
        JOIN role_permissions rp ON uur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE uur.user_id = auth.uid()
          AND uur.unit_id = p_unit_id
          AND p.code = p_permission_code
    ) OR EXISTS (
        -- Izin dari penugasan role sistem global
        SELECT 1
        FROM user_system_roles usr
        JOIN role_permissions rp ON usr.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE usr.user_id = auth.uid()
          AND p.code = p_permission_code
    );
$$;
```

---

## 3. Matriks Kebijakan RLS Komprehensif per Tabel

| Nama Tabel | Peran Sasaran | Operasi | Kebijakan RLS (Expression / Condition) | Tujuan Keamanan |
|---|---|:---:|---|---|
| **`organizations`** | `authenticated` | `SELECT` | `TRUE` | Membaca profil organisasi induk KUK. |
| | `authenticated` | `ALL` | `has_system_role('super_admin')` | Hanya Super Admin yang dapat mengubah legalitas/logo organisasi. |
| **`units`** | `authenticated` | `SELECT` | `has_unit_access(id)` | Staf hanya melihat unit yang ditugaskan atau seluruh unit bagi Admin Pusat. |
| | `authenticated` | `ALL` | `has_system_role('super_admin')` | Pembentukan unit baru atau pengubahan nama unit terkunci. |
| **`profiles`** | `authenticated` | `SELECT` | `TRUE` | Melihat nama dan avatar staf untuk penugasan kolaboratif. |
| | `authenticated` | `UPDATE` | `id = auth.uid()` | Staf hanya dapat memperbarui foto/nomor telepon milik sendiri. |
| | `authenticated` | `ALL` | `has_system_role('super_admin')` | Manajemen profil staf menyeluruh. |
| **`roles` / `permissions` / `role_permissions`** | `authenticated` | `SELECT` | `TRUE` | Membaca daftar role/izin yang tersedia untuk rendering menu antarmuka. |
| | `authenticated` | `ALL` | `has_system_role('super_admin')` | Mencegah eskalasi hak akses mandiri (*self-privilege escalation*). |
| **`user_system_roles` / `user_unit_roles`** | `authenticated` | `SELECT` | `user_id = auth.uid() OR has_system_role('super_admin')` | Staf hanya melihat role miliknya sendiri. |
| | `authenticated` | `ALL` | `has_system_role('super_admin')` | Penugasan role staf hanya dapat dimutasi oleh Super Admin. |
| **`departments`** | `authenticated` | `SELECT` | `has_unit_access(unit_id)` | Isolasi visibilitas struktur bagian berdasarkan unit kerja staf. |
| | `authenticated` | `ALL` | `has_unit_permission(unit_id, 'units.manage')` | Penambahan/perubahan departemen hanya oleh manajer unit berwenang. |
| **`positions`** | `authenticated` | `SELECT` | `has_unit_access(unit_id)` | Isolasi visibilitas jabatan berdasarkan unit kerja staf. |
| | `authenticated` | `ALL` | `has_unit_permission(unit_id, 'units.manage')` | Penambahan/perubahan jabatan berwenang. |
| **`employees`** | `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'employees.view')` | Hanya staf berizin yang dapat melihat daftar karyawan aktif/nonaktif. |
| | `authenticated` | `INSERT` | `has_unit_permission(unit_id, 'employees.create')` | Penambahan karyawan baru tervalidasi. |
| | `authenticated` | `UPDATE` | `has_unit_permission(unit_id, 'employees.update')` | Pembaruan data karyawan tervalidasi. |
| | `authenticated` | `DELETE` | `FALSE` | **Dilarang keras**: Penonaktifan karyawan hanya via status enum. |
| **`employee_sensitive_data`** | `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'employees.view_sensitive')` | NIK dan nomor rekening bank tersembunyi dari staf biasa/operator. |
| | `authenticated` | `ALL` | `has_unit_permission(unit_id, 'employees.manage_sensitive')` | Mutasi data perbankan & pajak karyawan. |
| **`employee_portal_auth`** | `authenticated` | `ALL` | `FALSE` | Kredensial PIN tertutup mutlak dari REST API; hanya melalui RPC. |
| **`leave_requests`** | `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'leave.view')` | Rekapitulasi cuti hanya untuk staf unit berhak. |
| | `authenticated` | `ALL` | `has_unit_permission(unit_id, 'leave.manage')` | Administrasi dan penyesuaian status cuti. |
| | `anon` | `ALL` | `FALSE` | Pengajuan cuti publik wajib melalui RPC `submit_leave_request_atomic`. |
| **`glass_tips`** | `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'glass_tips.view')` | Melihat daftar pengajuan pemotongan kaca unit. |
| | `authenticated` | `UPDATE` | `has_unit_permission(unit_id, 'glass_tips.verify')` | Verifikasi status dan penyesuaian nominal tip kaca. |
| | `anon` | `INSERT` | `TRUE (with valid token check)` | Pengajuan tip dari form publik diperbolehkan. |
| **`violation_records`** | `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'violations.view')` | Catatan pelanggaran terisolasi pada unit dan staf berizin. |
| | `authenticated` | `ALL` | `has_unit_permission(unit_id, 'violations.manage')` | Pencatatan insiden kerja baru dan bukti foto. |
| **`warning_letters`** | `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'violations.view')` | Akses arsip Surat Peringatan (SP) terisolasi. |
| | `authenticated` | `ALL` | `has_unit_permission(unit_id, 'violations.issue_sp')` | Penerbitan SP resmi berformat PDF. |
| **`briefing_attendances`** | `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'attendance.view')` | Rekapitulasi presensi briefing pagi unit. |
| | `authenticated` | `ALL` | `has_unit_permission(unit_id, 'attendance.manage_briefing')`| Pencatatan kehadiran briefing harian. |
| **`fingerprint_raw_logs`** | `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'attendance.import_fingerprint')` | Audit log mentah sidik jari. |
| | `authenticated` | `INSERT` | `has_unit_permission(unit_id, 'attendance.import_fingerprint')` | Impor data log mentah dari berkas mesin. |
| | `authenticated` | `UPDATE/DELETE` | `FALSE` | **Mutlak Append-Only**: Log mentah mesin tidak boleh diubah/dihapus. |
| **`attendance_daily_records`** | `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'attendance.view')` | Rekap kehadiran harian terisolasi unit. |
| | `authenticated` | `ALL` | `has_unit_permission(unit_id, 'attendance.adjust')` | Penyesuaian presensi harian (wajib mencatat adjustment audit). |
| **`payroll_records` / `payroll_items`** | `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'payroll.view')` | **PROTEKSI GAJI**: Staf biasa, operator, fleet manager DITOLAK membaca slip. |
| | `authenticated` | `ALL` | `has_unit_permission(unit_id, 'payroll.manage')` | Pengelolaan slip dan perhitungan payroll. |
| **`vehicles`** | `authenticated` | `SELECT` | `has_unit_access(unit_id)` | Melihat katalog armada unit. |
| | `anon` | `SELECT` | `status = 'AVAILABLE' AND is_active = TRUE` | Publik hanya dapat melihat armada aktif yang tersedia untuk dipinjam. |
| | `authenticated` | `ALL` | `has_unit_permission(unit_id, 'fleet.manage')` | Manajemen data armada, STNK, dan perawatan rutin. |
| **`vehicle_borrowing_requests`**| `authenticated` | `SELECT` | `has_unit_permission(unit_id, 'fleet.view')` | Petugas armada melihat seluruh permohonan booking. |
| | `authenticated` | `UPDATE` | `has_unit_permission(unit_id, 'fleet.approve_borrowing')` | Menyetujui atau menolak jadwal peminjaman. |
| | `anon` | `INSERT` | `TRUE` | Mengajukan booking kendaraan dari form publik. |
| **`audit_logs`** | `authenticated` | `SELECT` | `has_system_role('super_admin') OR has_unit_permission(unit_id, 'audit_logs.view')` | Penelusuran audit trail bagi auditor internal / Super Admin. |
| | `authenticated` | `INSERT` | `TRUE` | Pencatatan audit trail sistem otomatis. |
| | `PUBLIC` | `UPDATE` | `FALSE` | **MUTLAK DITOLAK**: Audit log tidak boleh diubah oleh siapapun. |
| | `PUBLIC` | `DELETE` | `FALSE` | **MUTLAK DITOLAK**: Audit log tidak boleh dihapus oleh siapapun. |

---

## 4. Keamanan Storage Bucket (Signed URLs & RLS)

```sql
-- Kebijakan Akses Berkas Slip Gaji (Bucket: payroll-slips)
CREATE POLICY "payroll_slips_access"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'payroll-slips'
    AND (
        has_system_role('super_admin')
        OR has_unit_permission((storage.foldername(name))[1]::uuid, 'payroll.view')
    )
);

-- Kebijakan Akses Bukti Pelanggaran (Bucket: violation-evidence)
CREATE POLICY "violation_evidence_access"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'violation-evidence'
    AND has_unit_permission((storage.foldername(name))[1]::uuid, 'violations.view')
);
```

Setiap pengunduhan atau pratinjau berkas privat pada antarmuka klien wajib meminta **Signed URL** dengan masa aktif kedaluwarsa 15 menit melalui server backend.

