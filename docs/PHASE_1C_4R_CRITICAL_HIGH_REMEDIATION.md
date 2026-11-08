# DOKUMENTASI REMEDIASI KEAMANAN KRITIKAL & TINGGI (PHASE 1C.4-R)
## KUK Management System v3.1.0
**Tanggal:** 8 November 2026  
**Status Audit:** REMEDIATED & LOCALLY VERIFIED  
**Baseline Git:** `b77fc90`  
**Target Environment:** Local Simulation & Migration Preparation (Supabase Cloud Production Zero-Touch)

---

## 1. RINGKASAN EKSEKUTIF

Berdasarkan audit komprehensif jalur mutasi data pada Phase 1C.4, telah teridentifikasi empat kerentanan keamanan utama (2 CRITICAL dan 2 HIGH). Sesuai dengan batasan keselamatan mutlak:
1. **Supabase Cloud Production TIDAK disentuh sama sekali** (tanpa koneksi jaringan, DDL, DML, maupun migrasi remote).
2. **Historical migration yang sudah diaplikasikan (`20261104000001_core_schema_v3_1_0.sql` dan `20261104000002_harden_rpc_security.sql`) dijaga kekal dengan ZERO DIFF.**
3. Seluruh perbaikan skema database dikemas dalam file migration baru yang belum diaplikasikan:
   `supabase/migrations/20261106000001_critical_security_remediation.sql`.
4. Seluruh perbaikan lapisan aplikasi frontend diintegrasikan ke dalam `src/services/dataService.ts`.
5. Seluruh aturan bisnis operasional (8 aturan bisnis) tetap berstatus eksplisit `BUSINESS_RULE_PENDING_APPROVAL`.
6. Form pengajuan cuti mandiri pada portal kiosk publik (`PublicLeaveRequestPage.tsx`) tetap **TERKUNCI SECARA EKSPLISIT (`BLOCKED`)** menunggu otorisasi pimpinan dan migrasi live database.

---

## 2. DETAIL REMEDIASI KEAMANAN

### A. Remediation 1 (CRITICAL): `submit_leave_request_atomic` Rollback Prevention & Persistent PIN Lockout
- **Vulnerabilitas Awal:**
  Pada migrasi historis `20261104000001_core_schema_v3_1_0.sql`, implementasi RPC `submit_leave_request_atomic` menggunakan `RAISE EXCEPTION 'PIN otentikasi salah.'` setelah meng-update kolom `failed_attempts` pada tabel `employee_portal_auth`. Dalam semantik mesin PostgreSQL, pelemparan exception yang tidak tertangkap membatalkan (*rollback*) seluruh transaksi, sehingga counter `failed_attempts` kembali ke angka semula dan fitur lockout (30 menit setelah 5 kali gagal) tidak pernah tercapai (*ineffective lockout defense*).
- **Tindakan Remediasi:**
  Dibuat fungsi pengganti `submit_leave_request_atomic` di file migrasi baru `supabase/migrations/20261106000001_critical_security_remediation.sql`:
  1. Mengganti `RAISE EXCEPTION` dengan pengembalian objek JSONB terstruktur `jsonb_build_object('success', false, 'code', 'AUTH_FAILED', 'message', '...')`.
  2. Counter `failed_attempts` dan `locked_until` di-update dan di-commit secara persisten tanpa ter-rollback.
  3. Mempertahankan pertahanan *dummy Bcrypt timing defense* untuk mencegah timing attack saat record auth tidak ditemukan.
  4. Mengintegrasikan pencatatan audit log otomatis (`KIOSK_LEAVE_PIN_FAILED`) dan rate limiter (`check_and_increment_rate_limit`).
  5. Menjaga otorisasi hak akses: `REVOKE ALL ... FROM PUBLIC;` dan `GRANT EXECUTE ... TO anon, authenticated, service_role;`.
- **Status Frontend:**
  `leaveService.submitLeaveRequestWithPin` dan antarmuka `PublicLeaveRequestPage.tsx` **tetap dipertahankan BLOCKED**. Tombol pengajuan disarm secara permanen dan banner peringatan tetap aktif sampai ada instruksi penerapan produksi.

### B. Remediation 2 (CRITICAL): Sinkronisasi Schema Role Pengguna (`assign_user_roles_atomic`)
- **Vulnerabilitas Awal:**
  Frontend pada `systemService.saveUserRole` dan `getUsers` sebelumnya memanggil tabel non-eksisten `user_profiles` dengan asumsi kolom `system_role` dan `assigned_units`. Pada skema kanonik PostgreSQL `20261104000001_core_schema_v3_1_0.sql`, data pengguna dan otorisasi ter-normalisasi ke dalam:
  - `profiles` (`id`, `email`, `full_name`, `is_active`)
  - `user_system_roles` (relasi ke `roles`)
  - `user_unit_roles` (relasi many-to-many ke `units` dan `roles`)
  Kondisi ini menyebabkan kegagalan mutasi saat koneksi live dan ketidakmampuan mengubah hak akses pengguna operasional.
- **Tindakan Remediasi:**
  1. Dibuat RPC atomik `assign_user_roles_atomic(p_target_user_id, p_system_role_code, p_unit_ids)` pada migrasi baru:
     - Memverifikasi otorisasi pemanggil wajib memiliki role `super_admin` via fungsi `has_system_role('super_admin')`.
     - Meng-update tabel `user_system_roles` secara transactional.
     - Melakukan rekonsiliasi atomik pada `user_unit_roles` (menghapus penugasan lama dan memasukkan unit baru).
     - Mencatat jejak mutasi ke `audit_logs` dengan aksi `ASSIGN_USER_ROLES`.
     - `REVOKE ALL FROM PUBLIC, anon;` dan `GRANT EXECUTE TO authenticated, service_role;`.
  2. Refactor `systemService.getUsers` di `src/services/dataService.ts`:
     - Membaca data dari tabel `profiles` dengan relasi PostgREST ke `user_system_roles` dan `user_unit_roles`.
     - Menyediakan fallback bersih jika nested relation PostgREST belum ter-cache.
  3. Refactor `systemService.saveUserRole` di `src/services/dataService.ts`:
     - Memanggil RPC `assign_user_roles_atomic` dengan payload `{ p_target_user_id, p_system_role_code, p_unit_ids }`.
     - Menghapus total seluruh ketergantungan pada tabel fiktif `user_profiles`.

### C. Remediation 3 (HIGH): Proteksi Hard-Delete `employee_sensitive_data`
- **Vulnerabilitas Awal:**
  Pada skema v3.1.0, tabel `employee_sensitive_data` memiliki policy permissive `employee_sensitive_manage` dengan klausul `FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'employees.manage_sensitive'))`. Klausul `FOR ALL` secara implisit mencakup operasi `DELETE`, membuka risiko penghapusan fisik (*hard-delete*) data kepatuhan ketenagakerjaan dan identitas (NIK, BPJS, rekening bank) oleh pengguna berwenang yang akunnya terkompromi.
- **Tindakan Remediasi:**
  Pada migrasi `supabase/migrations/20261106000001_critical_security_remediation.sql`:
  1. Ditambahkan policy pembatas mutlak:
     ```sql
     CREATE POLICY "employee_sensitive_delete_deny"
     ON public.employee_sensitive_data
     AS RESTRICTIVE
     FOR DELETE
     TO authenticated
     USING (false);
     ```
     Sesuai semantik PostgreSQL RLS: `(Permissive = TRUE) AND (Restrictive = FALSE) ==> HASIL AKHIR: FALSE (DENY)`.
  2. Ditambahkan pencabutan hak akses eksplisit pada level tabel:
     ```sql
     REVOKE DELETE ON TABLE public.employee_sensitive_data FROM anon, authenticated, PUBLIC;
     ```
  Dengan kombinasi ini, hard-delete pada data sensitif karyawan diblokir secara permanen di level database engine.

### D. Remediation 4 (HIGH): Pencegahan Mass-Assignment pada `employeeService.saveEmployee`
- **Vulnerabilitas Awal:**
  Pada `src/services/dataService.ts`, method `employeeService.saveEmployee` melakukan penyusunan payload menggunakan spread operator tidak tersaring: `const payload = { ...employee, unit_id: unitId, updated_at: ... }`. Hal ini memungkinkan manipulasi payload tak terotorisasi (*mass-assignment / object injection*), seperti mengubah field sensitif atau field sistem yang seharusnya terlindungi.
- **Tindakan Remediasi:**
  Diterapkan strict explicit field whitelisting di `employeeService.saveEmployee`:
  1. Menghilangkan penggunaan `{ ...employee }`.
  2. Menyusun `sanitizedPayload` hanya dari properti yang diizinkan secara eksplisit:
     - `employee_code`, `full_name`, `department_id`, `position_id`, `work_schedule_id`
     - `employment_type`, `status`, `join_date`, `end_date` (atau `resign_date`)
     - `phone_number` (atau `phone`), `address`, `gender`, `marital_status`
     - `dependents_count`, `notes`, `avatar_url`
  3. Properti sistem (`unit_id` dan `updated_at`) selalu dikontrol langsung oleh parameter fungsi dan waktu sistem.
  4. Field `id` tidak pernah dimasukkan ke dalam payload insert maupun update, mencegah ID spoofing.

---

## 3. MATRIKS ATURAN BISNIS PENDING APPROVAL

Seluruh business rules di bawah ini dipertahankan secara eksplisit dengan label status `BUSINESS_RULE_PENDING_APPROVAL`:

| No | Aturan Bisnis | Implementasi Saat Ini | Status Kepatuhan |
|---|---|---|---|
| 1 | Tip Kaca 3% dari nominal nota | Perhitungan frontend & default RPC | `BUSINESS_RULE_PENDING_APPROVAL` |
| 2 | Batas dimensi kaca (5 - 600 cm) | Validasi formulir & schema bounds | `BUSINESS_RULE_PENDING_APPROVAL` |
| 3 | Kuota cuti bulanan 3 hari | Validasi RPC `submit_leave_request_atomic` | `BUSINESS_RULE_PENDING_APPROVAL` |
| 4 | Jendela pengajuan cuti tanggal 1-3 | Logika kiosk & advisory display | `BUSINESS_RULE_PENDING_APPROVAL` |
| 5 | Aturan cuti Admin hari Minggu | Validasi jadwal kerja | `BUSINESS_RULE_PENDING_APPROVAL` |
| 6 | Lockout PIN 5 kali / 30 menit | Logika `employee_portal_auth` | `BUSINESS_RULE_PENDING_APPROVAL` |
| 7 | Booking armada masa lampau 15 mnt | Validasi RPC armada | `BUSINESS_RULE_PENDING_APPROVAL` |
| 8 | Durasi maksimal booking armada 30 hari | Validasi RPC armada | `BUSINESS_RULE_PENDING_APPROVAL` |

---

## 4. VERIFIKASI LINGKUNGAN & STATUS SISTEM

- **Supabase Cloud Production Project:** `ckzciuybedefbsdfsexh` (Tak Tersentuh)
- **Historical Migration 20261104000001:** Identik / Zero Diff terhadap Git Baseline
- **Historical Migration 20261104000002:** Identik / Zero Diff terhadap Git Baseline
- **TypeScript Typecheck:** 0 Errors (`tsc --noEmit` lulus)
- **Vite Production Build:** Berhasil dalam 8.14 detik tanpa error
- **Master Test Runner (`npm run test:phase1:all`):** 68 / 68 Passed
- **Phase 2 Test Runner (`npm run test:phase2`):** 11 / 11 Passed
- **Phase 3 Test Runner (`npm run test:phase3`):** 29 / 29 Passed
- **Total Pengujian Otomatis Lulus:** 108 / 108 Passed (100% Lulus)

