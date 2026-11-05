# PHASE 1 — FULL RLS POLICY SECURITY AUDIT REPORT

## KUK MANAGEMENT SYSTEM v3.1.0

> **STATUS: READ-ONLY AUDIT & SECURITY RECONCILIATION COMPLETED**
> **TARGET DATABASE: Supabase Cloud Production (`ckzciuybedefbsdfsexh`)**
> **SCOPE: 60 Tables, 107 RLS Policies, 0 Mutations Executed**
> **COMPLIANCE: STRICT READ-ONLY — NO DDL, NO DML, NO TEST USERS, NO RUNTIME MUTATIONS**

---

## 1. EXECUTIVE SUMMARY & RECONCILIATION MATRIX

Berdasarkan hasil katalog PostgreSQL dari Supabase Cloud Production (`ckzciuybedefbsdfsexh`) dan rekonsiliasi terhadap file migrasi lokal:

- `supabase/migrations/20261104000001_core_schema_v3_1_0.sql`
- `supabase/migrations/20261104000002_harden_rpc_security.sql`

Berikut adalah ringkasan kuantitatif seluruh Row Level Security (RLS) policies:

| Dimensi                                                      | Hitungan Nyata                 | Sumber / Keterangan                                                        |
| ------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------- |
| **Total Tabel Terdaftar**                              | **60 tabel**             | Seluruh tabel operasional dalam schema `public`                          |
| **Tabel dengan RLS Aktif (`relrowsecurity = true`)** | **60 / 60 tabel (100%)** | Terverifikasi runtime via `CMD-SQL-01`                                   |
| **Total RLS Policies**                                 | **107 policies**         | Seluruhnya didefinisikan pada migrasi `20261104000001`                   |
| **Policies pada Migrasi 2**                            | **0 policies**           | Migrasi `20261104000002` khusus pengerasan RPC (`search_path`, REVOKE) |
| **Policies untuk `authenticated`**                   | **101 policies**         | 94.4% dari keseluruhan                                                     |
| **Policies untuk `anon`**                            | **4 policies**           | 3.7% dari keseluruhan                                                      |
| **Policies untuk `PUBLIC`**                          | **2 policies**           | 1.9% dari keseluruhan (eksplisit DENY UPDATE & DELETE pada `audit_logs`) |

### Distribusi Berdasarkan SQL Command

- **SELECT**: 59 policies
- **ALL** (`SELECT, INSERT, UPDATE, DELETE`): 32 policies
- **INSERT**: 9 policies
- **UPDATE**: 5 policies
- **DELETE**: 2 policies (keduanya eksplisit `USING (false)` untuk pencegahan hard-delete)

---

## 2. AUDIT MENDALAM 6 KEBIJAKAN KRITIS

Audit teknis mendalam terhadap 6 policy yang menjadi perhatian keamanan khusus, meninjau hak akses GRANT, trigger database, potensi bypass validasi bisnis, dan risiko kebocoran data.

---

### 2.1. Policy 1: `glass_tips_insert_anon` (Tabel: `glass_tips`)

```sql
CREATE POLICY "glass_tips_insert_anon" ON glass_tips
    FOR INSERT TO anon
    WITH CHECK (true);
```

#### A. Kesesuaian dengan Migrasi

- **Status**: Sesuai 100% dengan definisi baris 1121 pada `20261104000001_core_schema_v3_1_0.sql`.
- **Target Role**: `anon`.
- **Command**: `INSERT`.
- **Klausul**: `WITH CHECK (true)`.

#### B. GRANT SQL dan Akses Langsung PostgREST

- Dalam instalasi default Supabase/PostgREST, role `anon` memiliki `GRANT ALL ON ALL TABLES IN SCHEMA public` atau `GRANT INSERT ON TABLE public.glass_tips TO anon`.
- Hasil `CMD-SQL-02` membuktikan `has_table_privilege('anon', 'public.glass_tips', 'INSERT') = true`.
- **Temuan**: PostgREST mengekspos endpoint `POST /rest/v1/glass_tips` secara publik kepada siapa pun tanpa autentikasi.

#### C. Validasi Tambahan (Trigger / RPC)

- Audit trigger pada tabel `glass_tips`:
  - Hanya terdapat trigger `trg_glass_tips_updated_at` (menjalankan `update_updated_at_column()`).
  - **TIDAK ADA** `BEFORE INSERT` trigger yang memvalidasi atau memaksa nilai `status`, `verified_amount`, atau `payroll_period_id`.
  - RPC verifikasi `verify_glass_tip_claim` bertugas memverifikasi tip yang sudah ada, tetapi tidak mengunci jalur INSERT PostgREST.

#### D. Potensi Bypass Validasi Bisnis & Manipulasi Payroll

- **RISIKO KRITIS (TERBUKTI PADA KODE)**:
  Karena policy menggunakan `WITH CHECK (true)` tanpa trigger pembatas, klien anonim dapat mengirim payload JSON langsung ke PostgREST:
  ```json
  {
    "unit_id": "<target-unit-id>",
    "driver_name": "Injected Driver",
    "delivery_note_number": "SJ-FAKE-999",
    "status": "VERIFIED",
    "verified_amount": 50000000,
    "created_at": "2026-11-01T00:00:00Z"
  }
  ```
- **Dampak Finansial**:
  Fungsi payroll atomic `calculate_and_finalize_payroll_atomic` mengumpulkan tip menggunakan klausa:
  `WHERE status = 'VERIFIED' AND payroll_period_id IS NULL`.
  Tip palsu yang dimasukkan langsung via anonim dengan status `VERIFIED` akan otomatis diserap ke dalam penggajian dan membayarkan dana fiktif kepada sopir!

#### E. Rekomendasi Remediasi Teknis

Ganti policy `glass_tips_insert_anon` agar hanya mengizinkan status awal `PENDING` tanpa jumlah verifikasi:

```sql
DROP POLICY IF EXISTS "glass_tips_insert_anon" ON glass_tips;
CREATE POLICY "glass_tips_insert_anon" ON glass_tips
    FOR INSERT TO anon
    WITH CHECK (
        status = 'PENDING' 
        AND verified_amount IS NULL 
        AND payroll_period_id IS NULL
    );
```

*Atau alternatif yang lebih aman*: Tutup akses INSERT anon pada tabel dan arahkan pengiriman tip publik melalui RPC `submit_public_glass_tip()` yang terkontrol ketat.

---

### 2.2. Policy 2: `public_form_tokens_anon_insert` (Tabel: `public_form_tokens`)

```sql
CREATE POLICY "public_form_tokens_anon_insert" ON public_form_tokens
    FOR INSERT TO anon
    WITH CHECK (true);
```

#### A. Kesesuaian dengan Migrasi

- **Status**: Sesuai 100% dengan baris 1718 pada `20261104000001_core_schema_v3_1_0.sql`.
- **Target Role**: `anon`.
- **Command**: `INSERT`.
- **Klausul**: `WITH CHECK (true)`.

#### B. GRANT SQL dan Akses Langsung PostgREST

- `has_table_privilege('anon', 'public.public_form_tokens', 'INSERT') = true`.
- PostgREST mengekspos endpoint `POST /rest/v1/public_form_tokens`.

#### C. Validasi Tambahan (Trigger / RPC)

- Audit trigger pada `public_form_tokens`:
  - **TIDAK ADA** trigger validasi sebelum insert.
  - Terdapat RPC `validate_and_consume_token(p_token text, p_form_type text)` yang memeriksa `token_hash`, masa kedaluwarsa (`expires_at > now()`), dan status konsumsi (`is_consumed = false`).

#### D. Potensi Bypass Validasi Bisnis & Ancaman Keamanan

- **RISIKO TINGGI (TERBUKTI PADA KODE)**:
  1. **Pemalsuan Token**: Klien anonim dapat meng-insert token hash buatan mereka sendiri dengan masa kedaluwarsa puluhan tahun di masa depan dan `is_consumed = false`. Token ini kemudian dapat digunakan untuk membobol endpoint publik yang mengandalkan `validate_and_consume_token`.
  2. **Table Bloating / Resource Exhaustion (DoS)**: Penyerang anonim dapat membanjiri tabel `public_form_tokens` dengan jutaan baris token sampah tanpa batasan kuota.
- **Kebocoran Data**: Tidak ada kebocoran data baca karena anon tidak memiliki hak `SELECT` (`public_form_tokens_read_manage` dibatasi untuk `super_admin`). Namun integritas token terkompromi.

#### E. Rekomendasi Remediasi Teknis

Hapus policy insert anonim langsung pada tabel. Seluruh pembuatan form token wajib dilakukan oleh backend/RPC berotoritas (`generate_form_token`):

```sql
DROP POLICY IF EXISTS "public_form_tokens_anon_insert" ON public_form_tokens;
REVOKE INSERT ON TABLE public_form_tokens FROM anon;
```

---

### 2.3. Policy 3: `vehicle_borrowing_requests_insert_anon` (Tabel: `vehicle_borrowing_requests`)

```sql
CREATE POLICY "vehicle_borrowing_requests_insert_anon" ON vehicle_borrowing_requests
    FOR INSERT TO anon
    WITH CHECK (true);
```

#### A. Kesesuaian dengan Migrasi

- **Status**: Sesuai 100% dengan baris 1604 pada `20261104000001_core_schema_v3_1_0.sql`.
- **Target Role**: `anon`.
- **Command**: `INSERT`.
- **Klausul**: `WITH CHECK (true)`.

#### B. GRANT SQL dan Akses Langsung PostgREST

- `has_table_privilege('anon', 'public.vehicle_borrowing_requests', 'INSERT') = true`.
- Endpoint publik `POST /rest/v1/vehicle_borrowing_requests` dapat diakses langsung.

#### C. Validasi Tambahan (Trigger / RPC)

- Audit trigger pada `vehicle_borrowing_requests`:
  - Terdapat trigger `trg_vehicle_borrowing_requests_updated_at`.
  - **TIDAK ADA** `BEFORE INSERT` trigger yang memvalidasi kolom status atau tanggal peminjaman.

#### D. Potensi Bypass Validasi Bisnis & Manipulasi Fleet

- **RISIKO TINGGI (TERBUKTI PADA KODE)**:
  Pengguna anonim dapat memasukkan permintaan peminjaman dengan status yang langsung `APPROVED`, mengisi `approved_by` palsu, atau memesan tanggal tumpang tindih secara sembarangan, melewati alur approval manajer armada.
- **Kebocoran Data**: Anon tidak memiliki hak `SELECT` pada tabel ini (policy `vehicle_borrowing_requests_read` dibatasi untuk role `authenticated` dengan permission `fleet.view_requests`). Data peminjam lain tidak bocor ke anon.

#### E. Rekomendasi Remediasi Teknis

Kunci klausul `WITH CHECK` agar membatasi input anonim hanya pada status awal:

```sql
DROP POLICY IF EXISTS "vehicle_borrowing_requests_insert_anon" ON vehicle_borrowing_requests;
CREATE POLICY "vehicle_borrowing_requests_insert_anon" ON vehicle_borrowing_requests
    FOR INSERT TO anon
    WITH CHECK (
        status = 'PENDING'
        AND approved_by IS NULL
        AND approved_at IS NULL
        AND rejection_reason IS NULL
    );
```

---

### 2.4. Policy 4: `audit_logs_insert` (Tabel: `audit_logs`)

```sql
CREATE POLICY "audit_logs_insert" ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);
```

#### A. Kesesuaian dengan Migrasi

- **Status**: Sesuai 100% dengan baris 1656 pada `20261104000001_core_schema_v3_1_0.sql`.
- **Target Role**: `authenticated`.
- **Command**: `INSERT`.
- **Klausul**: `WITH CHECK (true)`.

#### B. Integritas Tabel Audit Logs

Tabel `audit_logs` dilindungi oleh 4 policy lengkap:

1. `audit_logs_read`: `SELECT TO authenticated USING (has_unit_permission(unit_id, 'audit.view') OR has_system_role('super_admin'))`
2. `audit_logs_insert`: `INSERT TO authenticated WITH CHECK (true)`
3. `audit_logs_deny_update`: `UPDATE TO PUBLIC USING (false)`
4. `audit_logs_deny_delete`: `DELETE TO PUBLIC USING (false)`

#### C. Potensi Bypass & Pemalsuan Log (Log Tampering)

- **RISIKO SEDANG (TERBUKTI PADA KODE)**:
  - Kebijakan `UPDATE` dan `DELETE` berhasil memblokir penghapusan atau penyuntingan log oleh siapa pun (`PUBLIC` mencakup `authenticated` dan `anon`). Log bersifat immutable (append-only).
  - Namun, karena `audit_logs_insert` menggunakan `WITH CHECK (true)`, setiap pengguna terautentikasi dapat melakukan `POST /rest/v1/audit_logs` dan memalsukan baris log dengan `actor_id` milik pengguna lain (misalnya impersonasi `super_admin`) atau menyisipkan entri audit palsu untuk mengaburkan investigasi forensik.

#### D. Rekomendasi Remediasi Teknis

Batasi insert audit log agar `actor_id` wajib sama dengan ID pengguna yang sedang login:

```sql
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (actor_id = auth.uid());
```

*Best Practice*: Mutasi audit logs idealnya hanya ditangani oleh trigger internal database dan fungsi `SECURITY DEFINER`, dengan mencabut hak `INSERT` langsung dari role `authenticated`.

---

### 2.5. Policy 5: `profiles_read_authenticated` (Tabel: `profiles`)

```sql
CREATE POLICY "profiles_read_authenticated" ON profiles
    FOR SELECT TO authenticated
    USING (true);
```

#### A. Kesesuaian dengan Migrasi

- **Status**: Sesuai 100% dengan baris 929 pada `20261104000001_core_schema_v3_1_0.sql`.
- **Target Role**: `authenticated`.
- **Command**: `SELECT`.
- **Klausul**: `USING (true)`.

#### B. Analisis Risiko Kebocoran Data (Data Exposure)

- **Kolom pada Tabel `profiles`**:
  `id`, `email`, `full_name`, `phone`, `avatar_url`, `is_active`, `created_at`, `updated_at`.
- **Apakah Ada Data Finansial / Gaji / Bank?**:
  **TIDAK**. Seluruh data sensitif karyawan seperti NIK, nomor rekening, NPWP, dan besaran gaji diisolasi secara ketat pada tabel `employee_sensitive_data` dan `employee_salary_structures`.
- **Tinjauan Kebutuhan Bisnis**:
  Aplikasi KUK v3.1.0 membutuhkan direktori profil dasar agar fitur-fitur berikut dapat berjalan:
  - Dropdown pemilihan approver / atasan pada permohonan cuti.
  - Dropdown pemilihan pemeriksa armada pada inspeksi kendaraan.
  - Komponen mention dan kolaborasi internal.
- **Kesimpulan Risiko**: **LOW / BUSINESS-JUSTIFIED RISK**. Visibilitas nama dan kontak dasar internal bagi staf terautentikasi adalah fitur fungsional yang sah dan tidak melanggar kepatuhan perlindungan data internal.

---

### 2.6. Policy 6: `system_settings_read` (Tabel: `system_settings`)

```sql
CREATE POLICY "system_settings_read" ON system_settings
    FOR SELECT TO authenticated
    USING (true);
```

#### A. Kesesuaian dengan Migrasi

- **Status**: Sesuai 100% dengan baris 1684 pada `20261104000001_core_schema_v3_1_0.sql`.
- **Target Role**: `authenticated`.
- **Command**: `SELECT`.
- **Klausul**: `USING (true)`.

#### B. Kontrol Modifikasi

- Modifikasi tabel dilindungi oleh policy `system_settings_manage`:
  `CREATE POLICY "system_settings_manage" ON system_settings FOR ALL TO authenticated USING (has_system_role('super_admin'));`
- Staf biasa tidak dapat mengubah atau menghapus pengaturan sistem.

#### C. Analisis Risiko Kebocoran Kredensial / Secret

- **Tinjauan Isi `system_settings`**:
  Berisi parameter konfigurasi operasional aplikasi (misalnya jam kerja default, format nomor surat, toleransi keterlambatan).
- **Prinsip Keamanan**:
  Kredensial rahasia (seperti Supabase service_role key, API key pihak ketiga, token webhook) **TIDAK BOLEH** disimpan di dalam tabel `system_settings`. Kredensial rahasia wajib disimpan pada environment variables atau Supabase Vault.
- **Kesimpulan Risiko**: **LOW / ACCEPTABLE RISK**. Selama tidak ada secret yang disimpan dalam tabel ini, akses baca oleh staf terautentikasi aman untuk mendukung konfigurasi UI.

---

## 3. AUDIT 101 KEBIJAKAN RLS LAINNYA

Analisis terstruktur terhadap sisa 101 policy dalam sistem:

### 3.1. Kebijakan `FOR ALL` dan Analisis Hak Hard DELETE

Sebanyak **32 policy** menggunakan klausa `FOR ALL`.
Secara default di PostgreSQL, `FOR ALL` mencakup 4 operasi sekaligus: `SELECT`, `INSERT`, `UPDATE`, dan `DELETE`.

#### A. Kelompok Super Admin (8 Policy) — *Strict & Safe*

- `organizations_manage_super_admin`
- `units_manage_super_admin`
- `profiles_manage_super_admin`
- `roles_manage_super_admin`
- `permissions_manage_super_admin`
- `role_permissions_manage_super_admin`
- `user_system_roles_manage_super_admin`
- `user_unit_roles_manage_super_admin`
- `system_settings_manage`
- `public_form_tokens_read_manage`
  *Analisis*: Seluruhnya dibatasi secara ketat menggunakan fungsi `has_system_role('super_admin')`. Hanya super admin terverifikasi yang dapat mengelola metadata inti ini.

#### B. Kelompok Explicit Deny (1 Policy) — *Strict & Safe*

- `employee_portal_auth_deny_all`: `FOR ALL TO authenticated USING (false)`.
  *Analisis*: Memastikan tabel kredensial portal karyawan sama sekali tidak dapat diakses langsung via API PostgREST klien.

#### C. Kelompok Manajemen Unit Berbasis Hak Akses (21 Policy) — *Risiko Hard DELETE*

Tabel-tabel operasional berikut menggunakan `FOR ALL` yang dikaitkan dengan permission unit tertentu:

1. `departments_manage_unit` (`units.manage`)
2. `positions_manage_unit` (`units.manage`)
3. `work_schedules_manage_unit` (`units.manage`)
4. `employee_sensitive_manage` (`employees.manage_sensitive`)
5. `leave_policies_manage` (`leave.manage`)
6. `leave_conflict_groups_manage` (`leave.manage`)
7. `leave_conflict_departments_manage` (`leave.manage`)
8. `leave_requests_manage` (`leave.manage`)
9. `glass_types_manage` (`glass_tips.manage_rates`)
10. `glass_tip_rates_manage` (`glass_tips.manage_rates`)
11. `violation_types_manage` (`violations.manage`)
12. `violation_records_manage` (`violations.manage`)
13. `warning_letters_manage` (`violations.issue_sp`)
14. `briefing_sessions_manage` (`attendance.manage_briefing`)
15. `briefing_attendances_manage` (`attendance.manage_briefing`)
16. `attendance_daily_records_manage` (`attendance.adjust`)
17. `salary_components_manage` (`payroll.manage`)
18. `employee_salary_structures_manage` (`payroll.manage`)
19. `payroll_periods_manage` (`payroll.manage`)
20. `payroll_records_manage` (`payroll.manage`)
21. `vehicles_manage_unit` (`fleet.manage`)

> [!WARNING]
> **Temuan Kesenjangan Hard-Delete**:
> Pada tabel `employees`, arsitek skema menambahkan policy eksplisit `employees_delete_deny` dengan `USING (false)` untuk mencegah penghapusan fisik karyawan.
> Namun pada tabel transaksi krusial seperti `leave_requests`, `payroll_records`, dan `warning_letters`, kebijakan `FOR ALL` secara otomatis memberikan hak `DELETE` kepada pengguna yang memiliki permission manajerial.
> Jika seorang supervisor melakukan request `DELETE /rest/v1/leave_requests?id=eq.xxx`, baris data akan terhapus secara fisik (hard delete) dan merusak audit trail riwayat ketidakhadiran!

---

### 3.2. Pemeriksaan Klausul `WITH CHECK` pada INSERT dan UPDATE

Dalam PostgreSQL RLS:

- Jika policy `FOR ALL` atau `UPDATE` tidak mencantumkan klausul `WITH CHECK`, PostgreSQL secara otomatis menerapkan ekspresi `USING` sebagai `WITH CHECK`.
- Pada 21 tabel operasional di atas, ekspresi `USING` adalah `has_unit_permission(unit_id, ...)`.
- Ini menjamin bahwa saat melakukan `INSERT` atau `UPDATE`, kolom `unit_id` dari baris baru tetap dievaluasi: pengguna tidak dapat memindahkan atau menyisipkan record ke unit lain yang tidak menjadi wewenangnya (mencegah *Cross-Unit Tenant Injection*).
- **Pengecualian**: Kebijakan `UPDATE profiles_update_self` menggunakan `USING (id = auth.uid())` tanpa `WITH CHECK`, yang memastikan pengguna hanya dapat menyunting record profil miliknya sendiri.

---

### 3.3. Tabel dengan Kebijakan Read-Only (Hanya SELECT)

Sebanyak **21 tabel** hanya memiliki policy `SELECT` untuk `authenticated` dan tidak memiliki policy untuk `INSERT`, `UPDATE`, atau `DELETE`:

- `leave_request_dates`, `leave_conflict_slots`
- `glass_tip_rate_ranges`, `glass_tip_verifications`
- `violation_point_rules`, `warning_letter_templates`, `warning_letter_approvals`
- `fingerprint_devices`, `employee_fingerprint_ids`, `fingerprint_import_batches`
- `attendance_adjustments`
- `employee_salary_component_items`, `payroll_items`, `payroll_revisions`
- `vehicle_condition_inspections`, `vehicle_damages`, `vehicle_fuel_logs`
- `activity_logs`, `document_sequences`, `system_notifications`, `file_attachments`

> [!NOTE]
> **Keamanan Read-Only by Design**:
> Karena RLS aktif pada seluruh 60 tabel, ketidakhadiran policy `INSERT`/`UPDATE`/`DELETE` berarti operasi mutasi dari klien eksternal **DITOLAK SECARA MUTLAK (DENY BY DEFAULT)** oleh PostgreSQL engine.
> Tabel-tabel transaksi turunan ini hanya dapat dimutasi melalui fungsi berstatus `SECURITY DEFINER` (seperti RPC penggajian, RPC verifikasi tip, atau trigger otomatis). Ini adalah desain pertahanan yang sangat kokoh.

---

### 3.4. Evaluasi Kebijakan Permissive dan Potensi Konflik

- Seluruh 107 policy bertipe `AS PERMISSIVE` (tipe default PostgreSQL).
- Dalam evaluasi PostgreSQL:
  $$
  \text{Akses Diizinkan} = \text{Policy}_1 \lor \text{Policy}_2 \lor \dots \lor \text{Policy}_n
  $$
- **Evaluasi Konflik**:
  1. Pada tabel `audit_logs`:
     - Terdapat policy `audit_logs_deny_update` (`FOR UPDATE TO PUBLIC USING (false)`).
     - Terdapat policy `audit_logs_deny_delete` (`FOR DELETE TO PUBLIC USING (false)`).
     - Karena tidak ada policy permissive lain untuk UPDATE atau DELETE, ekspresi menghasilkan `false`, sehingga operasi ditolak mutlak.
  2. Pada tabel `employees`:
     - Terdapat policy `employees_delete_deny` (`FOR DELETE TO authenticated USING (false)`).
     - Tidak ada policy DELETE lain, sehingga hard delete tertolak mutlak.
  3. Pada tabel `vehicles`:
     - Anonim hanya dapat membaca `vehicles` jika `status = 'AVAILABLE' AND is_active = true`.
     - Staf terautentikasi dapat membaca seluruh kendaraan jika memiliki `fleet.view`.
     - Kedua aturan tidak saling berbenturan karena target role terpisah (`anon` vs `authenticated`).

---

## 4. KLASIFIKASI TEMUAN & MATRIKS RISIKO KEAMANAN

| ID Temuan            | Komponen / Policy                          | Tingkat Risiko     | Klasifikasi Status                   | Deskripsi Singkat Risiko                                                                                            |
| -------------------- | ------------------------------------------ | ------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **SEC-RLS-01** | `glass_tips_insert_anon`                 | **CRITICAL** | **PROVEN (Code Audit)**        | Klien anonim dapat meng-insert tip dengan `status = 'VERIFIED'` langsung ke payroll tanpa verifikasi.             |
| **SEC-RLS-02** | `vehicle_borrowing_requests_insert_anon` | **HIGH**     | **PROVEN (Code Audit)**        | Klien anonim dapat mem-bypass persetujuan dengan meng-insert permintaan berstatus `APPROVED`.                     |
| **SEC-RLS-03** | `public_form_tokens_anon_insert`         | **HIGH**     | **PROVEN (Code Audit)**        | Klien anonim dapat memalsukan token valid atau melakukan DoS/table bloat.                                           |
| **SEC-RLS-04** | `audit_logs_insert`                      | **MEDIUM**   | **PROVEN (Code Audit)**        | Pengguna terautentikasi dapat meng-insert log palsu dengan `actor_id` milik orang lain.                           |
| **SEC-RLS-05** | 21 Tabel Operasional `FOR ALL`           | **MEDIUM**   | **PROVEN (Code Audit)**        | Pengguna dengan hak kelola unit dapat melakukan hard-delete record (misal `leave_requests`, `payroll_records`). |
| **SEC-RLS-06** | `profiles_read_authenticated`            | **LOW**      | **ACCEPTABLE (Business Need)** | Akses baca nama/email profil oleh seluruh staf dibutuhkan untuk dropdown UI; tidak ada data gaji yang bocor.        |
| **SEC-RLS-07** | `system_settings_read`                   | **LOW**      | **ACCEPTABLE (Configuration)** | Akses baca setting UI oleh staf sah, selama kredensial rahasia disimpan di Vault/ENV.                               |

---

## 5. REKOMENDASI PERBAIKAN TEKNIS (UNTUK FASE MENDATANG)

> [!IMPORTANT]
> **CATATAN KESELAMATAN EKSEKUSI**:
> Sesuai batasan mutlak Phase 1, **JANGAN MENJALANKAN DDL DI BAWAH INI KE SUPABASE PRODUCTION SAAT INI**.
> Skrip di bawah ini adalah cetak biru teknis (*technical draft*) yang akan dieksekusi secara terencana pada fase remediasi skema berikutnya.

```sql
-- ============================================================================
-- DRAFT REMEDIASI KEAMANAN RLS (FASE MENDATANG)
-- ============================================================================

-- 1. Perbaikan glass_tips: Batasi insert anonim hanya untuk status PENDING
DROP POLICY IF EXISTS "glass_tips_insert_anon" ON public.glass_tips;
CREATE POLICY "glass_tips_insert_anon" ON public.glass_tips
    FOR INSERT TO anon
    WITH CHECK (
        status = 'PENDING'
        AND verified_amount IS NULL
        AND payroll_period_id IS NULL
    );

-- 2. Perbaikan vehicle_borrowing_requests: Batasi insert anonim hanya untuk status PENDING
DROP POLICY IF EXISTS "vehicle_borrowing_requests_insert_anon" ON public.vehicle_borrowing_requests;
CREATE POLICY "vehicle_borrowing_requests_insert_anon" ON public.vehicle_borrowing_requests
    FOR INSERT TO anon
    WITH CHECK (
        status = 'PENDING'
        AND approved_by IS NULL
        AND approved_at IS NULL
        AND rejection_reason IS NULL
    );

-- 3. Perbaikan public_form_tokens: Cabut insert langsung dari anon, alihkan ke RPC
DROP POLICY IF EXISTS "public_form_tokens_anon_insert" ON public.public_form_tokens;
REVOKE INSERT ON TABLE public.public_form_tokens FROM anon;

-- 4. Perbaikan audit_logs: Kunci actor_id agar sesuai dengan auth.uid()
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (actor_id = auth.uid());

-- 5. Perlindungan Hard-Delete pada Tabel Krusial: Tambahkan eksplisit DENY DELETE
CREATE POLICY "leave_requests_delete_deny" ON public.leave_requests
    FOR DELETE TO authenticated
    USING (false);

CREATE POLICY "payroll_records_delete_deny" ON public.payroll_records
    FOR DELETE TO authenticated
    USING (false);

CREATE POLICY "warning_letters_delete_deny" ON public.warning_letters
    FOR DELETE TO authenticated
    USING (false);
```

---

## 6. STATUS AKHIR DAN BATASAN FASE 1

1. **Integritas Batasan Phase 1 Terjaga**:

   - Tidak ada kueri SQL mutasi atau perubahan DDL/DML yang dikirim ke Supabase Production.
   - Tidak ada pembuatan akun Auth baru atau manipulasi data pengujian.
   - Audit dilakukan sepenuhnya melalui analisis kode sumber lokal, artefak migrasi, dan rekonsiliasi katalog metadata.
2. **Status Proyek**:

   - **Phase 1 TETAP AKTIF dan BELUM DITUTUP**.
   - Temuan keamanan pada dokumen ini menjadi masukan resmi (*security backlog*) sebelum transisi ke fase berikutnya diizinkan.
