# SECURITY RULES & ROW LEVEL SECURITY (RLS) SPECIFICATION
## KUK Management System · Multi-Unit Security Architecture
**Versi:** 3.0.0  
**Tanggal:** 2026-11-04  
**Status:** Security Baseline / Phase 0 Final  

---

## 1. Model Ancaman (Threat Modeling)

Dalam sistem hybrid (portal publik untuk karyawan/peminjam + dashboard manajemen internal staf), ancaman potensial yang dimitigasi meliputi:

| ID Ancaman | Skenario Ancaman | Dampak | Mitigasi Arsitektur |
|---|---|---|---|
| **THREAT-01** | Akses Lintas Unit (*Cross-Unit Data Leak*) oleh Staf Unit A ke Unit B. | Pelanggaran kerahasiaan omzet, data karyawan, dan armada unit lain. | RLS PostgreSQL mengunci seluruh kueri berdasarkan `user_unit_access(user_id, unit_id)`. |
| **THREAT-02** | Pengunjung Portal Publik Membaca Data Sensitif Karyawan / Gaji. | Kebocoran data pribadi (gaji pokok, NIK, nomor telepon). | Endpoint publik hanya dapat mengeksekusi RPC tertentu (`SECURITY DEFINER`), tidak memiliki izin `SELECT` langsung ke tabel `employees` atau `payroll_records`. |
| **THREAT-03** | Eskalasi Peran Mandiri (*Self Privilege Escalation*). | Staf mengubah perannya sendiri menjadi Super Admin via manipulasi REST API Supabase. | Tabel `roles`, `permissions`, `user_unit_access`, dan kolom `is_super_admin` pada `profiles` dilindungi RLS sehingga hanya `super_admin` yang dapat melakukan mutasi. |
| **THREAT-04** | Manipulasi Nominal Tip Kaca dari Sisi Klien (*Client-side Price Tampering*). | Karyawan memotong kaca mengirimkan nominal tip buatan sendiri. | Sistem menolak nominal kiriman klien. Nominal tip dihitung murni di server/database berdasarkan formula resmi dan tarif master aktif. |
| **THREAT-05** | Eksploitasi *Race-Condition* Pengajuan Cuti / Peminjaman Armada. | Dua orang mengklaim kuota cuti terakhir atau memesan truk pada waktu yang sama. | Transaksi atomik dengan *PostgreSQL Advisory Lock* dan *Database Constraint* eksklusif. |
| **THREAT-06** | Modifikasi atau Penghapusan Jejak Audit (*Audit Trail Tampering*). | Staf menghapus catatan manipulasi data pada database. | Tabel `audit_logs` bersifat *Append-Only*. RLS menolak mutasi `UPDATE` dan `DELETE` bagi seluruh pengguna (bahkan `super_admin`). |
| **THREAT-07** | *Spamming & Denial of Service* pada Formulir Publik. | Bot membanjiri permohonan pinjam kendaraan atau pengajuan tip palsu. | Rate Limiting per IP address, verifikasi hCaptcha/Turnstile pada form publik, dan validasi Zod ketat. |

---

## 2. Prinsip & Penegakan Row Level Security (RLS)

Seluruh tabel publik di PostgreSQL Supabase wajib mengaktifkan RLS:
```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
```

### 2.1 Fungsi Pembantu Keamanan (Security Helper Functions)

```sql
-- Memeriksa apakah pengguna saat ini adalah Super Admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(is_super_admin, FALSE)
    FROM profiles
    WHERE id = auth.uid();
$$;

-- Memeriksa apakah pengguna memiliki akses ke unit tertentu
CREATE OR REPLACE FUNCTION has_unit_access(p_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT is_super_admin() OR EXISTS (
        SELECT 1 FROM user_unit_access
        WHERE user_id = auth.uid() AND unit_id = p_unit_id
    );
$$;

-- Memeriksa izin granular pada unit tertentu
CREATE OR REPLACE FUNCTION has_unit_permission(p_unit_id UUID, p_permission_code VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT is_super_admin() OR EXISTS (
        SELECT 1
        FROM user_unit_access uua
        JOIN role_permissions rp ON uua.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE uua.user_id = auth.uid()
          AND uua.unit_id = p_unit_id
          AND p.code = p_permission_code
    );
$$;
```

---

## 3. Kebijakan RLS per Entitas Utama

### 3.1 Entitas Profil & Kontrol Akses (`profiles`, `user_unit_access`)
```sql
-- PROFILES: Semua staf terdaftar dapat melihat nama & avatar sesama staf, hanya diri sendiri atau super_admin yang dapat mengedit profil dasar
CREATE POLICY "profiles_view_all_authenticated"
ON profiles FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "profiles_update_self"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid() 
    AND is_super_admin = (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) -- Mencegah eskalasi
);

CREATE POLICY "profiles_superadmin_all"
ON profiles FOR ALL
TO authenticated
USING (is_super_admin());

-- USER_UNIT_ACCESS: Hanya Super Admin / Admin Pusat yang dapat menambah/menghapus penugasan
CREATE POLICY "uua_view_assigned"
ON user_unit_access FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_super_admin());

CREATE POLICY "uua_manage_superadmin"
ON user_unit_access FOR ALL
TO authenticated
USING (is_super_admin());
```

### 3.2 Entitas Master Karyawan (`employees`)
```sql
-- EMPLOYEES: Hanya dapat dilihat oleh pengguna yang memiliki hak akses unit & izin 'employees.view'
CREATE POLICY "employees_select_policy"
ON employees FOR SELECT
TO authenticated
USING (has_unit_permission(unit_id, 'employees.view'));

CREATE POLICY "employees_insert_policy"
ON employees FOR INSERT
TO authenticated
WITH CHECK (has_unit_permission(unit_id, 'employees.create'));

CREATE POLICY "employees_update_policy"
ON employees FOR UPDATE
TO authenticated
USING (has_unit_permission(unit_id, 'employees.update'))
WITH CHECK (has_unit_permission(unit_id, 'employees.update'));

-- Dilarang menghapus baris karyawan
CREATE POLICY "employees_no_delete"
ON employees FOR DELETE
TO authenticated
USING (FALSE);
```

### 3.3 Entitas Transaksional Cuti (`leave_requests`, `leave_request_dates`)
```sql
-- LEAVE_REQUESTS: Publik tidak dapat SELECT langsung (hanya melalui RPC terproteksi / kalender publik berfilter)
CREATE POLICY "leave_requests_view_staff"
ON leave_requests FOR SELECT
TO authenticated
USING (has_unit_permission(unit_id, 'leave.view'));

CREATE POLICY "leave_requests_manage_staff"
ON leave_requests FOR ALL
TO authenticated
USING (has_unit_permission(unit_id, 'leave.manage'));

-- Penambahan cuti publik hanya diizinkan via SECURITY DEFINER function submit_leave_request_atomic()
```

### 3.4 Entitas Penggajian (`payroll_records`, `payroll_items`, `employee_salary_structures`)
```sql
-- PAYROLL_RECORDS: Pengguna biasa (Operator, Admin Unit biasa) DILARANG MEMBACA data penggajian
CREATE POLICY "payroll_records_view_authorized"
ON payroll_records FOR SELECT
TO authenticated
USING (has_unit_permission(unit_id, 'payroll.view'));

CREATE POLICY "payroll_records_modify_authorized"
ON payroll_records FOR ALL
TO authenticated
USING (has_unit_permission(unit_id, 'payroll.manage'));

-- Kolom gaji pada employee_salary_structures hanya untuk role payroll / super admin
CREATE POLICY "salary_structures_view_authorized"
ON employee_salary_structures FOR SELECT
TO authenticated
USING (has_unit_permission(unit_id, 'payroll.view'));
```

### 3.5 Entitas Audit Trail (`audit_logs`)
```sql
-- AUDIT_LOGS: Mutlak Append-Only
CREATE POLICY "audit_logs_select_policy"
ON audit_logs FOR SELECT
TO authenticated
USING (is_super_admin() OR has_unit_permission(unit_id, 'audit_logs.view'));

CREATE POLICY "audit_logs_insert_policy"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (TRUE);

-- Mutasi UPDATE dan DELETE ditolak permanen
CREATE POLICY "audit_logs_no_update"
ON audit_logs FOR UPDATE
TO PUBLIC
USING (FALSE);

CREATE POLICY "audit_logs_no_delete"
ON audit_logs FOR DELETE
TO PUBLIC
USING (FALSE);
```

---

## 4. Keamanan Supabase Storage (Berkas & Dokumen)

Sistem penyimpanan berkas KUK dibagi ke dalam 2 jenis bucket:

### 4.1 Private Storage Buckets
1. `payroll-slips` — Berkas PDF Slip Gaji Karyawan.
2. `hr-documents` — Dokumen PKWT, Surat Peringatan (SP), KTP/Kartu Keluarga.
3. `violation-evidence` — Foto bukti pelanggaran operasional.

**Aturan Keamanan Storage:**
- Akses baca (*Download / Preview*) hanya dapat dilakukan via **Signed URL** dengan masa kedaluwarsa singkat (maksimal 15 menit).
- Pengunduhan slip gaji diverifikasi menggunakan policy `payroll.view` atau verifikasi autentikasi pemilik slip.
- File diunggah dengan pembatasan ukuran: Maksimal 5 MB per berkas.
- Validasi MIME type ketat pada tingkat klien dan server: Hanya menerima `application/pdf`, `image/jpeg`, dan `image/png`. Berkas biner eksekutabel (`.exe`, `.sh`, `.bat`, `.js`, `.html`) ditolak seketika.

### 4.2 Public Storage Bucket
1. `vehicle-public-photos` — Foto kondisi armada kendaraan (inspeksi fisik Check-In/Check-Out).
- Hanya dapat dibaca publik (CDN *read-only*), pengunggahan wajib melalui token sesi terverifikasi.

---

## 5. Validasi Masukan & Perlindungan Formulir Publik

1. **Zod Schema Validation**:
   - Seluruh input form divalidasi ganda: di antarmuka sebelum request dikirim dan di dalam handler RPC / Edge Function.
   - Angka desimal (panjang, tinggi, kuantitas kaca) dipastikan bernilai positif dan wajar ($0 < \text{dimensi} \le 1.000\text{ cm}$).
2. **Perlindungan Anti-Spam & Rate Limiting**:
   - Form publik Peminjaman Kendaraan dan Tip Kaca dibatasi maksimal 5 pengajuan per IP address per 10 menit.
   - Pemanfaatan *honeypot fields* dan CAPTCHA tak kasat mata (*invisible CAPTCHA*) saat lalu lintas mencurigakan terdeteksi.
3. **Penyimpanan PIN Karyawan Aman**:
   - PIN otentikasi portal mandiri karyawan disimpan menggunakan algoritma hashing *bcrypt* dengan *salt rounds* 10 (`auth_pin_hash`). Sistem tidak pernah menyimpan atau menstransmisikan PIN dalam bentuk teks biasa (*plaintext*).

---

## 6. Skenario Pengujian Keamanan Wajib (Security Test Suite)

Sebelum aplikasi dinyatakan lolos QA fase pengembangan, sistem harus lulus 6 skenario uji keamanan berikut:

```
[TEST-SEC-01] Isolasi Multi-Unit
- Setup: Login sebagai Admin Unit Palen (KUK-PALEN).
- Aksi: Mengirimkan HTTP request kueri SELECT / INSERT ke tabel employees dengan unit_id = TB-LATANSA.
- Ekspektasi: Respon 0 baris (SELECT) atau 403 Forbidden / RLS Policy Error (INSERT).

[TEST-SEC-02] Otorisasi Penggajian
- Setup: Login sebagai Operator atau Admin Unit tanpa hak 'payroll.view'.
- Aksi: Membuka endpoint kueri ke tabel payroll_records.
- Ekspektasi: Database mengembalikan 0 baris atau pesan Exception RLS.

[TEST-SEC-03] Isolasi Pengunjung Publik
- Setup: Pengunjung web anonim (tanpa token sesi Supabase).
- Aksi: Mengakses URL rute dashboard /admin/* atau membaca tabel profiles.
- Ekspektasi: Frontend me-redirect ke login, database menolak akses langsung ke data privat.

[TEST-SEC-04] Pencegahan Eskalasi Peran
- Setup: Login sebagai Staf biasa.
- Aksi: Mengirimkan mutasi UPDATE ke tabel profiles mengubah is_super_admin = true.
- Ekspektasi: Mutasi ditolak oleh RLS check constraint WITH CHECK.

[TEST-SEC-05] Integritas Perhitungan Tip Kaca
- Setup: Form publik mengirim payload manipulasi: calculated_amount = Rp 10.000.000.
- Aksi: Handler memproses data.
- Ekspektasi: Parameter nominal kiriman klien diabaikan; nilai akhir dihitung murni dari rumus luas x tarif master.

[TEST-SEC-06] Kekekalan Dokumen Audit Trail
- Setup: Login sebagai Super Admin.
- Aksi: Menjalankan perintah DELETE FROM audit_logs WHERE id = 1.
- Ekspektasi: PostgreSQL melemparkan error "Policy does not permit DELETE on audit_logs".
```

