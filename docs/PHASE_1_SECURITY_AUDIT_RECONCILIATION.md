# PHASE 1 — SECURITY AUDIT CONTRADICTION RESOLUTION REPORT
## KUK MANAGEMENT SYSTEM v3.1.0

> **STATUS: RECONCILIATION & CONFLICT RESOLUTION COMPLETED**  
> **DOKUMEN YANG DIREKONSILIASI**:  
> 1. `docs/PHASE_1_FULL_RLS_POLICY_AUDIT.md`  
> 2. `docs/PHASE_1_RLS_FINDINGS_VALIDATION.md`  
> 3. `supabase/migrations/20261104000001_core_schema_v3_1_0.sql`  
> 4. `supabase/migrations/20261104000002_harden_rpc_security.sql`  
> **BATASAN MUTLAK**: Static audit saja. Tidak ada eksekusi SQL ke Supabase Production, DDL, DML, migrasi baru, pembuatan akun/data pengujian, atau penutupan Phase 1.

---

## 1. DAFTAR KONTRADIKSI DAN PENYELESAIANNYA

Berdasarkan audit silang antara dokumen temuan audit (`FULL_RLS_POLICY_AUDIT`) dan dokumen validasi temuan (`RLS_FINDINGS_VALIDATION`), ditemukan 4 kontradiksi utama:

### Kontradiksi 1: Keberadaan RPC `validate_and_consume_token`
- **Pernyataan Dokumen Audit (`FULL_RLS_POLICY_AUDIT`)**:  
  Menyatakan terdapat fungsi/RPC `validate_and_consume_token(p_token text, p_form_type text)` yang memeriksa token hash, kedaluwarsa, dan status konsumsi. Penyerang anonim diklaim dapat memalsukan token untuk membobol endpoint formulir publik.
- **Pernyataan Dokumen Validasi (`RLS_FINDINGS_VALIDATION`)**:  
  Menyatakan fungsi tersebut **tidak pernah ada** dalam kode database maupun frontend.
- **Bukti Sumber Kode**:  
  Pemeriksaan teks menyeluruh pada kedua file migrasi menghasilkan:
  - `validate_and_consume_token` di `20261104000001`: **FALSE (0 kemunculan)**.
  - `validate_and_consume_token` di `20261104000002`: **FALSE (0 kemunculan)**.
  - Tidak ada fungsi SQL apa pun yang mengandung kata `token` dalam namanya.
  - Direktori `src/` (frontend) tidak memiliki referensi ke `public_form_tokens`.
- **Penyelesaian Final**:  
  Dokumen audit pertama melakukan **asumsi yang tidak berdasar kode (halusinasi)** karena melihat index `idx_form_tokens_validity ON public_form_tokens(token_hash, expires_at, is_consumed)`.  
  **Status Tabel**: `public_form_tokens` adalah **ORPHANED / DORMANT TABLE**.  
  **Tingkat Risiko**: Diturunkan dari **HIGH** ke **LOW TO MEDIUM** (terbatas pada risiko *Table Bloating / Resource Exhaustion Spam*, bukan bypass autentikasi alur bisnis).

---

### Kontradiksi 2: Keberadaan Trigger `trg_glass_tips_updated_at` & `trg_vehicle_borrowing_requests_updated_at`
- **Pernyataan Dokumen Audit (`FULL_RLS_POLICY_AUDIT`)**:  
  Menyatakan tabel `glass_tips` memiliki trigger `trg_glass_tips_updated_at` dan tabel `vehicle_borrowing_requests` memiliki trigger `trg_vehicle_borrowing_requests_updated_at` untuk memperbarui timestamp `updated_at`.
- **Pernyataan Dokumen Validasi (`RLS_FINDINGS_VALIDATION`)**:  
  Menyatakan kedua tabel tersebut memiliki **0 trigger**.
- **Bukti Sumber Kode**:  
  Pencarian klausul `CREATE TRIGGER` pada kedua migrasi membuktikan bahwa di seluruh skema database hanya terdapat **TEPAT 2 TRIGGER**:
  1. `trg_protect_audit_logs` (Baris 1251 pada `audit_logs`).
  2. `trg_protect_payroll_records` (Baris 1272 pada `payroll_records`).  
  Tidak ada fungsi `update_updated_at_column()` dan tidak ada trigger `updated_at` pada tabel manapun.
- **Penyelesaian Final**:  
  Dokumen audit pertama mengasumsikan pola trigger timestamp PostgreSQL standar ada di dalam skema.  
  **Status Nyata**: Pada tabel `glass_tips` dan `vehicle_borrowing_requests`, **TRIGGER SAMA SEKALI TIDAK ADA (0 Trigger)**.  
  Konfirmasi ini memperkuat temuan bahwa tidak ada trigger pembatas untuk kolom `status` atau nominal pada operasi `INSERT`.

---

### Kontradiksi 3: Potensi Kalkulasi Ganda Tip Kaca pada Payroll
- **Pernyataan Dokumen Audit (`FULL_RLS_POLICY_AUDIT`)**:  
  Memberi kesan bahwa tip palsu dapat terserap berkali-kali ke siklus penggajian berikutnya.
- **Pernyataan Dokumen Validasi (`RLS_FINDINGS_VALIDATION`)**:  
  Menyatakan tip tidak dapat dihitung lebih dari sekali karena fungsi atomic langsung mengikat `payroll_period_id`.
- **Bukti Sumber Kode (`calculate_and_finalize_payroll_atomic`)**:
  ```sql
  SELECT COALESCE(SUM(verified_amount), 0.00) INTO v_tip_amount
  FROM glass_tips
  WHERE unit_id = p_unit_id AND employee_id = v_emp.id AND status = 'VERIFIED' AND payroll_period_id IS NULL;

  IF v_tip_amount > 0 THEN
      -- ...
      UPDATE glass_tips
      SET payroll_period_id = p_payroll_period_id, updated_at = now()
      WHERE unit_id = p_unit_id AND employee_id = v_emp.id AND status = 'VERIFIED' AND payroll_period_id IS NULL;
  END IF;
  ```
- **Penyelesaian Final**:  
  Tip palsu **hanya dihitung tepat 1 kali** pada periode payroll yang sedang diproses (karena klausa `WHERE payroll_period_id IS NULL`). Risiko finansial tetap **CRITICAL**, namun eksploitasinya berupa injeksi sekali per transaksi, bukan pengulangan otomatis.

---

### Kontradiksi 4: Definisi & Keterbukaan Hak Hard DELETE
- **Pernyataan Dokumen Audit (`FULL_RLS_POLICY_AUDIT`)**:  
  Menyebutkan 21 tabel manajemen unit berisiko *hard-delete* tanpa memisahkan antara izin RLS dengan privilege SQL GRANT tabel.
- **Pernyataan Dokumen Validasi (`RLS_FINDINGS_VALIDATION`)**:  
  Menegaskan bahwa hard-delete adalah isu pengguna berwenang unit (*over-privileged unit managers*), bukan celah penyerang luar atau anonim.
- **Bukti Sumber Kode & Runtime Katalog**:  
  - Di Supabase Production, privilege default `GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated` aktif (terbukti via `CMD-SQL-02: has_table_privilege('authenticated', tbl, 'DELETE') = true`).
  - PostgreSQL memerlukan **KEDUA** syarat: privilege GRANT tabel = true **DAN** RLS mengizinkan evaluasi DELETE.
  - Pada 20 tabel unit operasional yang memiliki policy `FOR ALL`, klausul `USING (has_unit_permission(unit_id, ...))` berlaku untuk `DELETE`.
  - Pada tabel `payroll_records`, trigger `trg_protect_payroll_records` memblokir DELETE jika status sudah `FINALIZED`, namun **mengizinkan** DELETE jika status masih `DRAFT` atau `CALCULATED`.
- **Penyelesaian Final**:  
  Hak hard-delete terbuka bagi pengguna yang memiliki wewenang unit terkait (seperti HR Manager unit), yang menyalahi prinsip keabadian jejak audit (*audit trail immutability*). Pihak luar (anon) dan staf tanpa izin unit tetap ditolak secara mutlak.

---

## 2. BUKTI SUMBER KODE UNTUK SETIAP KESIMPULAN

### 2.1. Tabel `public_form_tokens`
- **Definisi Skema (Migrasi 1, Baris 1224-1233)**:
  ```sql
  CREATE TABLE public_form_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
      form_type VARCHAR(50) NOT NULL,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      ip_address VARCHAR(45) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
- **RLS Policies (Migrasi 1, Baris 2068-2069)**:
  ```sql
  ALTER TABLE public_form_tokens ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "public_form_tokens_anon_insert" ON public_form_tokens FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "public_form_tokens_read_manage" ON public_form_tokens FOR ALL TO authenticated USING (has_system_role('super_admin'));
  ```
- **Kesimpulan Status**: **DORMANT / ORPHANED**. Tabel ini dibuat pada skema v3.1.0 tetapi belum terhubung ke sistem form publik manapun.

---

### 2.2. Tabel `glass_tips` dan Alur Payroll
- **Definisi RLS (Migrasi 1, Baris 1938-1941)**:
  ```sql
  ALTER TABLE glass_tips ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "glass_tips_read" ON glass_tips FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.view'));
  CREATE POLICY "glass_tips_update" ON glass_tips FOR UPDATE TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.verify'));
  CREATE POLICY "glass_tips_insert_anon" ON glass_tips FOR INSERT TO anon WITH CHECK (true);
  ```
- **Jalur Akses INSERT & UPDATE**:
  - `anon`: Memiliki hak `INSERT` via policy `glass_tips_insert_anon`.
  - `authenticated`: **TIDAK MEMILIKI HAK INSERT**. Jika user terautentikasi mengirim `POST /rest/v1/glass_tips`, request ditolak RLS (karena tidak ada INSERT policy untuk role `authenticated`).
  - `authenticated`: Memiliki hak `UPDATE` via policy `glass_tips_update` (khusus pemegang izin `glass_tips.verify`).
- **Trigger**: **0 trigger**.

---

### 2.3. Tabel `vehicle_borrowing_requests` dan RPC `book_vehicle_atomic`
- **Definisi RLS (Migrasi 1, Baris 2030-2033)**:
  ```sql
  ALTER TABLE vehicle_borrowing_requests ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "vehicle_borrowing_requests_read" ON vehicle_borrowing_requests FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'fleet.view'));
  CREATE POLICY "vehicle_borrowing_requests_update" ON vehicle_borrowing_requests FOR UPDATE TO authenticated USING (has_unit_permission(unit_id, 'fleet.approve_borrowing'));
  CREATE POLICY "vehicle_borrowing_requests_insert_anon" ON vehicle_borrowing_requests FOR INSERT TO anon WITH CHECK (true);
  ```
- **Perilaku RPC `book_vehicle_atomic` (Migrasi 1, Baris 1500-1550)**:
  - Mewajibkan status awal `'PENDING'`.
  - Menghasilkan kode dokumen resmi via `generate_document_number_atomic`.
- **Celah Bypass via PostgREST Langsung**:
  - Karena PostgREST mengekspos tabel langsung dan policy `WITH CHECK (true)` terbuka untuk `anon`, penyerang anonim dapat langsung mem-bypass RPC dan mengeksekusi `POST /rest/v1/vehicle_borrowing_requests` dengan status `'APPROVED'`.

---

## 3. INVENTARISASI TEPAT 32 KEBIJAKAN `FOR ALL`

Berdasarkan parsing menyeluruh terhadap 107 policy, seluruh 32 kebijakan `FOR ALL` terdaftar secara pasti pada tabel berikut:

| No | Nama Tabel | Nama Policy | Target Role | Klausul `USING` |
|---|---|---|---|---|
| 1 | `organizations` | `organizations_manage_super_admin` | `authenticated` | `has_system_role('super_admin')` |
| 2 | `units` | `units_manage_super_admin` | `authenticated` | `has_system_role('super_admin')` |
| 3 | `profiles` | `profiles_manage_super_admin` | `authenticated` | `has_system_role('super_admin')` |
| 4 | `roles` | `roles_manage_super_admin` | `authenticated` | `has_system_role('super_admin')` |
| 5 | `permissions` | `permissions_manage_super_admin` | `authenticated` | `has_system_role('super_admin')` |
| 6 | `role_permissions` | `role_permissions_manage_super_admin` | `authenticated` | `has_system_role('super_admin')` |
| 7 | `user_system_roles` | `user_system_roles_manage_super_admin` | `authenticated` | `has_system_role('super_admin')` |
| 8 | `user_unit_roles` | `user_unit_roles_manage_super_admin` | `authenticated` | `has_system_role('super_admin')` |
| 9 | `departments` | `departments_manage_unit` | `authenticated` | `has_unit_permission(unit_id, 'units.manage')` |
| 10 | `positions` | `positions_manage_unit` | `authenticated` | `has_unit_permission(unit_id, 'units.manage')` |
| 11 | `work_schedules` | `work_schedules_manage_unit` | `authenticated` | `has_unit_permission(unit_id, 'units.manage')` |
| 12 | `employee_sensitive_data` | `employee_sensitive_manage` | `authenticated` | `has_unit_permission(unit_id, 'employees.manage_sensitive')` |
| 13 | `employee_portal_auth` | `employee_portal_auth_deny_all` | `authenticated` | `false` |
| 14 | `leave_policies` | `leave_policies_manage` | `authenticated` | `has_unit_permission(unit_id, 'leave.manage')` |
| 15 | `leave_conflict_groups` | `leave_conflict_groups_manage` | `authenticated` | `has_unit_permission(unit_id, 'leave.manage')` |
| 16 | `leave_conflict_departments` | `leave_conflict_departments_manage` | `authenticated` | `has_unit_permission(unit_id, 'leave.manage')` |
| 17 | `leave_requests` | `leave_requests_manage` | `authenticated` | `has_unit_permission(unit_id, 'leave.manage')` |
| 18 | `glass_types` | `glass_types_manage` | `authenticated` | `has_unit_permission(unit_id, 'glass_tips.manage_rates')` |
| 19 | `glass_tip_rates` | `glass_tip_rates_manage` | `authenticated` | `has_unit_permission(unit_id, 'glass_tips.manage_rates')` |
| 20 | `violation_types` | `violation_types_manage` | `authenticated` | `has_unit_permission(unit_id, 'violations.manage')` |
| 21 | `violation_records` | `violation_records_manage` | `authenticated` | `has_unit_permission(unit_id, 'violations.manage')` |
| 22 | `warning_letters` | `warning_letters_manage` | `authenticated` | `has_unit_permission(unit_id, 'violations.issue_sp')` |
| 23 | `briefing_sessions` | `briefing_sessions_manage` | `authenticated` | `has_unit_permission(unit_id, 'attendance.manage_briefing')` |
| 24 | `briefing_attendances` | `briefing_attendances_manage` | `authenticated` | `has_unit_permission(unit_id, 'attendance.manage_briefing')` |
| 25 | `attendance_daily_records` | `attendance_daily_records_manage` | `authenticated` | `has_unit_permission(unit_id, 'attendance.adjust')` |
| 26 | `salary_components` | `salary_components_manage` | `authenticated` | `has_unit_permission(unit_id, 'payroll.manage')` |
| 27 | `employee_salary_structures` | `employee_salary_structures_manage` | `authenticated` | `has_unit_permission(unit_id, 'payroll.manage')` |
| 28 | `payroll_periods` | `payroll_periods_manage` | `authenticated` | `has_unit_permission(unit_id, 'payroll.manage')` |
| 29 | `payroll_records` | `payroll_records_manage` | `authenticated` | `has_unit_permission(unit_id, 'payroll.manage')` |
| 30 | `vehicles` | `vehicles_manage_unit` | `authenticated` | `has_unit_permission(unit_id, 'fleet.manage')` |
| 31 | `system_settings` | `system_settings_manage` | `authenticated` | `has_system_role('super_admin')` |
| 32 | `public_form_tokens` | `public_form_tokens_read_manage` | `authenticated` | `has_system_role('super_admin')` |

---

## 4. MATRIKS EVALUASI HAK DELETE PER TABEL

Matriks ini merekonsiliasi antara hak privilege SQL GRANT, keberadaan kebijakan RLS, trigger pelindung, dan potensi eksekusi *hard-delete* via API:

| Kategori Tabel | Daftar Tabel (Jumlah) | GRANT DELETE (`authenticated`) | Policy Evaluasi DELETE | Trigger Pelindung | Potensi Hard-Delete Nyata |
|---|---|---|---|---|---|
| **Eksplisit Deny Delete** | `employees`, `audit_logs` (2) | `true` | `employees_delete_deny` (`USING false`), `audit_logs_deny_delete` (`USING false`) | `trg_protect_audit_logs` (pada `audit_logs`) | **TERTOLAK MUTLAK (BLOCKED)** |
| **Deny All** | `employee_portal_auth` (1) | `true` | `employee_portal_auth_deny_all` (`USING false`) | Tidak ada | **TERTOLAK MUTLAK (BLOCKED)** |
| **Read-Only by Design (Hanya SELECT)** | 20 tabel (misal `payroll_items`, `leave_request_dates`, `fingerprint_raw_logs`, dll.) (20) | `true` | **TIDAK ADA POLICY DELETE ATAU ALL** | Tidak ada | **TERTOLAK MUTLAK (BLOCKED)** (Prinsip default-deny PostgreSQL) |
| **Super Admin Scoped** | `organizations`, `units`, `profiles`, `roles`, `permissions`, `role_permissions`, `user_system_roles`, `user_unit_roles`, `system_settings`, `public_form_tokens` (10) | `true` | `has_system_role('super_admin')` | Tidak ada | **DAPAT DIHAPUS OLEH SUPER ADMIN** (Akses administratif yang sah) |
| **Payroll Records** | `payroll_records` (1) | `true` | `has_unit_permission(unit_id, 'payroll.manage')` | `trg_protect_payroll_records` | **BLOCKED jika status FINALIZED**; **DAPAT DIHAPUS jika DRAFT** |
| **Tabel Operasional Unit (Tanpa Trigger)** | 20 tabel (`leave_requests`, `warning_letters`, `violation_records`, `departments`, `positions`, `work_schedules`, `employee_sensitive_data`, `leave_policies`, `leave_conflict_groups`, `leave_conflict_departments`, `glass_types`, `glass_tip_rates`, `violation_types`, `briefing_sessions`, `briefing_attendances`, `attendance_daily_records`, `salary_components`, `employee_salary_structures`, `payroll_periods`, `vehicles`) (20) | `true` | `has_unit_permission(unit_id, ...)` | **TIDAK ADA TRIGGER** | **DAPAT DIHAPUS FISIK OLEH MANAJER UNIT** (Risiko Kehilangan Jejak Audit) |

---

## 5. REKONSILIASI KONSISTENSI KESELURUHAN (KATALOG VS MIGRASI)

| Dimensi | Migrasi Lokal (`20261104000001` + `02`) | Katalog Supabase Production | Status Rekonsiliasi |
|---|---|---|---|
| **Total Tabel Public** | 60 tabel | 60 tabel | **100% MATCH** |
| **Status RLS Aktif** | 60 tabel | 60 tabel | **100% MATCH** |
| **Total RLS Policy** | 107 policies | 107 policies | **100% MATCH** |
| **Role `authenticated`** | 101 policies | 101 policies | **100% MATCH** |
| **Role `anon`** | 4 policies | 4 policies | **100% MATCH** |
| **Role `PUBLIC`** | 2 policies | 2 policies | **100% MATCH** |
| **Command `SELECT`** | 59 policies | 59 policies | **100% MATCH** |
| **Command `ALL`** | 32 policies | 32 policies | **100% MATCH** |
| **Command `INSERT`** | 9 policies | 9 policies | **100% MATCH** |
| **Command `UPDATE`** | 5 policies | 5 policies | **100% MATCH** |
| **Command `DELETE`** | 2 policies | 2 policies | **100% MATCH** |
| **Total Trigger Skema** | 2 triggers | 2 triggers | **100% MATCH** |

---

## 6. MATRIKS FINAL TEMUAN KEAMANAN TERKOREKSI

### A. Temuan Terbukti Nyata (Proven by Code)
1. **`SEC-REC-01` (CRITICAL)**: `glass_tips_insert_anon` mengizinkan anon menyuntikkan tip berstatus `VERIFIED` dan `verified_amount` langsung ke slip gaji karyawan pada RPC payroll, karena ketiadaan trigger dan klausul `WITH CHECK (true)`.
2. **`SEC-REC-02` (HIGH)**: `vehicle_borrowing_requests_insert_anon` mengizinkan anon menyuntikkan peminjaman armada berstatus `APPROVED` dan `approved_by = NULL`, mem-bypass RPC persetujuan petugas fleet.
3. **`SEC-REC-03` (MEDIUM)**: `audit_logs_insert` mengizinkan pengguna terautentikasi memalsukan `actor_id` milik akun lain pada baris audit baru.
4. **`SEC-REC-04` (MEDIUM)**: Kebijakan `FOR ALL` pada 20 tabel operasional unit mengizinkan manajer unit melakukan *hard delete* fisik terhadap data audit sensitif (`leave_requests`, `warning_letters`, `violation_records`).

### B. Temuan yang Membutuhkan Runtime Test (Di Lingkungan Terisolasi)
1. **`RUN-TEST-01`**: Pengujian integritas PostgREST filter header untuk memastikan apakah gateway membatasi payload request anonim sebelum kueri dievaluasi oleh PostgreSQL.
2. **`RUN-TEST-02`**: Pengujian perilaku cascade delete foreign key pada relasi data induk vs tabel anak transaksi saat dilakukan mutasi terotorisasi.

---

## 7. REKOMENDASI DESAIN REMEDIASI SKEMA (CETAK BIRU)

> [!IMPORTANT]
> **CATATAN KESELAMATAN**:  
> Seluruh DDL di bawah ini adalah konsep desain remediasi untuk diajukan sebelum migrasi diterapkan. **TIDAK DIJALANKAN PADA SAAT INI**.

1. **Remediasi `glass_tips`**:
   - Ubah policy `glass_tips_insert_anon` agar mewajibkan status `PENDING`, `verified_amount IS NULL`, dan `payroll_period_id IS NULL`.
2. **Remediasi `vehicle_borrowing_requests`**:
   - Ubah policy `vehicle_borrowing_requests_insert_anon` agar mewajibkan status `PENDING`, `approved_by IS NULL`, dan `approved_at IS NULL`.
3. **Remediasi `public_form_tokens`**:
   - Cabut hak INSERT anon (`REVOKE INSERT ON TABLE public_form_tokens FROM anon;`) dan drop policy `public_form_tokens_anon_insert`.
4. **Remediasi `audit_logs`**:
   - Perketat policy `audit_logs_insert` dengan klausul `WITH CHECK (actor_id = auth.uid())`.
5. **Remediasi Immutabilitas Data Transaksional**:
   - Tambahkan policy `DENY DELETE` (`FOR DELETE TO authenticated USING (false)`) pada tabel: `leave_requests`, `warning_letters`, `violation_records`, dan `attendance_daily_records`.

---

## 8. DAFTAR PEKERJAAN YANG BELUM SELESAI

1. Pembuatan draf berkas migrasi remediasi RLS (misalnya `20261105000001_remediate_rls_security.sql`).
2. Persetujuan tertulis pengguna (*explicit user consent*) sebelum pengujian atau penerapan migrasi ke database.
3. Pengujian regresi frontend untuk memastikan pengetatan RLS tidak merusak antarmuka form publik yang sah.

> **KESIMPULAN STATUS: PHASE 1 TETAP AKTIF DAN BELUM DITUTUP.**

