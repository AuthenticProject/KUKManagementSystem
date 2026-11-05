# PHASE 1 — RLS FINDINGS VALIDATION REPORT
## KUK MANAGEMENT SYSTEM v3.1.0

> **STATUS: STATIC CODE & CATALOG VALIDATION COMPLETED**  
> **SCOPE: Verifikasi Teknis Temuan Dokumen `PHASE_1_FULL_RLS_POLICY_AUDIT.md`**  
> **BATASAN MUTLAK: Read-Only Static Audit — Tanpa DDL, DML, Akun Uji, atau Mutasi Database**

---

## 1. REKONSILIASI KUANTITATIF & KOREKSI KATALOG

Pemeriksaan ulang terhadap definisi skema migrasi lokal (`20261104000001_core_schema_v3_1_0.sql` dan `20261104000002_harden_rpc_security.sql`) serta katalog PostgreSQL dari Supabase Production menghasilkan data absolut:

- **Total Tabel Schema Public**: 60 tabel operasional.
- **Tabel dengan RLS Aktif**: 60 / 60 tabel (100%).
- **Total Kebijakan RLS (Production & Migrasi)**: **Tepat 107 policies**.
- **Distribusi Berdasarkan Target Role**:
  - `authenticated`: **101 policies** (94.39%)
  - `anon`: **4 policies** (3.74%)
  - `PUBLIC`: **2 policies** (1.87% — khusus eksplisit DENY UPDATE & DELETE pada `audit_logs`)
- **Distribusi Berdasarkan SQL Command**:
  - `SELECT`: **59 policies**
  - `ALL` (`SELECT, INSERT, UPDATE, DELETE`): **32 policies**
  - `INSERT`: **9 policies**
  - `UPDATE`: **5 policies**
  - `DELETE`: **2 policies** (keduanya `USING (false)`)
- **Distribusi Jumlah Policy per Tabel (60 Tabel)**:
  - **1 Policy (21 tabel)**: 20 tabel hanya memiliki `SELECT TO authenticated` (deny-by-default untuk mutasi), dan 1 tabel (`employee_portal_auth`) memiliki `ALL TO authenticated USING (false)`.
  - **2 Policies (33 tabel)**: Umumnya kombinasi 1 `SELECT` + 1 `ALL` (manajemen unit atau super_admin), atau 1 `SELECT` + 1 `INSERT` (misal `employee_status_history`).
  - **3 Policies (4 tabel)**: `profiles`, `glass_tips`, `vehicles`, `vehicle_borrowing_requests`.
  - **4 Policies (2 tabel)**: `employees` dan `audit_logs`.

---

## 2. VALIDASI MENDALAM ATAS 5 AREA TEMUAN KEAMANAN

---

### 2.1. Validasi Temuan 1: `glass_tips_insert_anon` (Tabel `glass_tips`)

#### A. Pemeriksaan Struktur, Kolom, dan Constraint
Tabel `glass_tips` memuat kolom-kolom utama:
- `id` (UUID PRIMARY KEY, default `gen_random_uuid()`)
- `unit_id` (UUID NOT NULL)
- `reference_code` (VARCHAR(50) NOT NULL UNIQUE)
- `employee_id` (UUID NOT NULL, FK ke `employees(unit_id, id)`)
- `glass_type_id` (UUID NOT NULL, FK ke `glass_types(unit_id, id)`)
- `rate_id` (UUID, nullable, FK ke `glass_tip_rates(unit_id, id)`)
- `length_cm`, `height_cm`, `quantity` (NUMERIC/INT, dengan constraint `chk_dimensions_positive: length_cm > 0 AND height_cm > 0 AND quantity > 0`)
- `calculated_sqm` (NUMERIC(10,4) NOT NULL)
- `glass_price_snapshot`, `tip_amount` (dengan constraint `chk_glass_price_positive: glass_price_snapshot >= 0 AND tip_amount >= 0`)
- `tip_percentage_snapshot` (NUMERIC(5,4) NOT NULL DEFAULT 0.0300)
- `rounding_rule` (tip_rounding_rule_enum NOT NULL DEFAULT 'ROUND_UP_1000')
- `verified_amount` (NUMERIC(12,2) NULLABLE)
- `status` (`glass_tip_status_enum` NOT NULL DEFAULT 'PENDING')
- `payroll_period_id` (UUID NULLABLE)

#### B. Pemeriksaan Hak Akses GRANT, Policy, dan Trigger
- **GRANT**: Role `anon` memiliki privilege `INSERT` pada tabel `glass_tips`.
- **Policy**: `CREATE POLICY "glass_tips_insert_anon" ON glass_tips FOR INSERT TO anon WITH CHECK (true);`.
- **Trigger**: **TIDAK ADA TRIGGER APAPUN** pada tabel `glass_tips` (jumlah trigger = 0). Tidak ada trigger `BEFORE INSERT` yang membatasi kolom `status` atau `verified_amount`.

#### C. Penelusuran Logika Payroll (`calculate_and_finalize_payroll_atomic`)
Fungsi `calculate_and_finalize_payroll_atomic` memproses tip pemotongan kaca dengan kode berikut:
```sql
SELECT COALESCE(SUM(verified_amount), 0.00) INTO v_tip_amount
FROM glass_tips
WHERE unit_id = p_unit_id
  AND employee_id = v_emp.id
  AND status = 'VERIFIED'
  AND payroll_period_id IS NULL;

IF v_tip_amount > 0 THEN
    v_earnings := v_earnings + v_tip_amount;

    INSERT INTO payroll_items (unit_id, payroll_record_id, component_name, component_type, amount)
    VALUES (p_unit_id, v_slip_id, 'Tip Pemotongan Kaca Terverifikasi', 'ALLOWANCE', v_tip_amount);

    UPDATE glass_tips
    SET payroll_period_id = p_payroll_period_id, updated_at = now()
    WHERE unit_id = p_unit_id AND employee_id = v_emp.id AND status = 'VERIFIED' AND payroll_period_id IS NULL;
END IF;
```

#### D. Analisis Perhitungan Ganda dan Manipulasi Nominal
- **Apakah tip dapat dihitung lebih dari sekali?**  
  **TIDAK.** Fungsi atomic segera menjalankan `UPDATE glass_tips SET payroll_period_id = p_payroll_period_id ... WHERE payroll_period_id IS NULL`. Setelah terikat pada satu slip, tip tersebut tidak akan dihitung ulang pada periode penggajian berikutnya.
- **Apakah manipulasi nominal oleh anon dapat masuk ke payroll?**  
  **YA, TERBUKTI.** Karena fungsi payroll menjumlahkan kolom `verified_amount` pada baris berstatus `VERIFIED`, dan tidak ada constraint yang melarang anon memasukkan `verified_amount` atau `status = 'VERIFIED'`.

#### E. Skenario Eksploitasi Nyata (Berdasarkan Kode)
1. **Prasyarat**: Penyerang mengetahui atau memperoleh `unit_id`, `employee_id` sasaran, dan `glass_type_id` yang valid (misalnya: karyawan internal yang ingin mendongkrak slip gajinya sendiri, atau pihak luar yang mendapatkan UUID dari tanda terima/dokumen cetak).
2. **Langkah Penyerangan**:
   Penyerang mengirimkan HTTP request tanpa token autentikasi ke PostgREST:
   ```http
   POST /rest/v1/glass_tips HTTP/1.1
   Host: ckzciuybedefbsdfsexh.supabase.co
   apikey: <anon_key>
   Content-Type: application/json

   {
     "unit_id": "00000000-0000-0000-0000-000000000001",
     "employee_id": "00000000-0000-0000-0000-000000000002",
     "glass_type_id": "00000000-0000-0000-0000-000000000003",
     "reference_code": "INJECT-TIP-202611-001",
     "length_cm": 150.0,
     "height_cm": 200.0,
     "quantity": 2,
     "calculated_sqm": 6.0,
     "glass_price_snapshot": 1500000,
     "tip_amount": 45000,
     "verified_amount": 10000000.00,
     "status": "VERIFIED"
   }
   ```
3. **Hasil**: Database menerima baris ini karena `WITH CHECK (true)` terpenuhi dan seluruh constraint database (`chk_dimensions_positive`, `chk_glass_price_positive`) valid.
4. **Dampak Saat Payroll Berjalan**:
   Ketika manajer unit menjalankan RPC `calculate_and_finalize_payroll_atomic`, kueri `SUM(verified_amount)` akan menyerap Rp10.000.000 ke dalam komponen pendapatan `ALLOWANCE` slip gaji karyawan tersebut tanpa pernah diverifikasi oleh staf verifikator.

---

### 2.2. Validasi Temuan 2: `vehicle_borrowing_requests_insert_anon` (Tabel `vehicle_borrowing_requests`)

#### A. Pemeriksaan Struktur, Kolom, dan Constraint
Tabel `vehicle_borrowing_requests` memuat:
- `id`, `unit_id`, `vehicle_id`, `booking_code` (UNIQUE), `borrower_name`, `borrower_institution`, `borrower_phone`, `responsible_person`
- `start_time`, `estimated_return_time` (dengan constraint `chk_booking_time_valid: estimated_return_time > start_time`)
- `status` (`borrowing_status_enum` DEFAULT 'PENDING')
- `approved_by` (UUID nullable, REFERENCES `profiles(id)`)
- `approved_at` (TIMESTAMPTZ nullable)
- **Constraint Eksklusi**:
  ```sql
  CONSTRAINT uq_vehicle_no_double_booking
      EXCLUDE USING gist (
          vehicle_id WITH =,
          tstzrange(start_time, estimated_return_time, '[)') WITH &&
      ) WHERE (status IN ('APPROVED', 'IN_USE'))
  ```

#### B. Pemeriksaan GRANT, Policy, dan Trigger
- **GRANT**: Role `anon` memiliki hak `INSERT`.
- **Policy**: `CREATE POLICY "vehicle_borrowing_requests_insert_anon" ON vehicle_borrowing_requests FOR INSERT TO anon WITH CHECK (true);`.
- **Trigger**: **TIDAK ADA TRIGGER APAPUN** pada tabel ini.
- **RPC Terkait**: Terdapat fungsi atomic `book_vehicle_atomic` yang memaksa `status = 'PENDING'`. Namun, karena PostgREST membuka akses langsung ke tabel, fungsi ini dapat di-bypass sepenuhnya.

#### C. Analisis Kemudahan Akses Anonim & Bypass Approval
- **Apakah anon bisa mengatur status `APPROVED` dan `approved_by` secara langsung?**  
  **YA, TERBUKTI 100%.** Kolom `approved_by` bersifat nullable sehingga penyerang tidak perlu mengetahui profile ID siapapun; cukup mengirim `"status": "APPROVED"` dan `"approved_by": null`.
- **Apakah anon dapat memperoleh `vehicle_id` dan `unit_id` tanpa izin khusus?**  
  **YA, TERBUKTI.** Berdasarkan policy:
  `CREATE POLICY "vehicles_read_anon" ON vehicles FOR SELECT TO anon USING (status = 'AVAILABLE' AND is_active = true);`  
  Klien anonim dapat menjalankan `GET /rest/v1/vehicles?status=eq.AVAILABLE` untuk memanen seluruh ID armada aktif dan `unit_id` yang tersedia.
- **Apakah melewati alur persetujuan?**  
  **YA, TERBUKTI.** Kendaraan langsung terkunci sebagai `APPROVED`. Constraint eksklusi PostgreSQL `uq_vehicle_no_double_booking` akan memblokir pengajuan peminjaman lain pada rentang waktu yang sama, mengacaukan operasional armada tanpa persetujuan manajer armada (`fleet.approve_borrowing`).

---

### 2.3. Validasi Temuan 3: `public_form_tokens_anon_insert` (Tabel `public_form_tokens`)

#### A. Pemeriksaan Struktur, Kolom, Constraint, dan Fungsi Pengguna
Tabel `public_form_tokens` memuat:
- `id`, `unit_id` (REFERENCES `units(id)`), `form_type`, `token_hash` (UNIQUE), `ip_address`, `expires_at`, `is_consumed` (BOOLEAN DEFAULT FALSE), `created_at`.
- Policy: `CREATE POLICY "public_form_tokens_anon_insert" ON public_form_tokens FOR INSERT TO anon WITH CHECK (true);`.
- Policy: `CREATE POLICY "public_form_tokens_read_manage" ON public_form_tokens FOR ALL TO authenticated USING (has_system_role('super_admin'));`.

#### B. Koreksi Kritis: Keberadaan Fungsi Pemvalidasi Token
> [!CAUTION]
> **KOREKSI TEMUAN SEBELUMNYA**:  
> Dokumen `PHASE_1_FULL_RLS_POLICY_AUDIT.md` sebelumnya menyatakan terdapat fungsi `validate_and_consume_token(p_token text, p_form_type text)`.  
> Berdasarkan audit statis mendalam pada seluruh baris migrasi `20261104000001` dan `20261104000002` serta repositori frontend:  
> **FUNGSI TERSEBUT TIDAK PERNAH ADA DI DALAM KODE DATABASE (TIDAK DITEMUKAN)**.  
> Tabel `public_form_tokens` saat ini berstatus **dormant/orphaned** (tidak ada RPC maupun trigger yang membaca atau mengonsumsi baris dalam tabel ini).

#### C. Penilaian Risiko Nyata
- **Apakah anon dapat membuat token yang "valid" untuk membobol alur bisnis?**  
  **TIDAK TERBUKTI (HIPOTESIS TIDAK BERDASAR KODE SAAT INI)**. Karena tidak ada fungsi sistem yang mengonsumsi token tersebut untuk otentikasi formulir. Form cuti menggunakan `p_auth_pin` (`employee_portal_auth`), form tip kaca dan fleet request tidak memvalidasi `public_form_tokens`.
- **Risiko Nyata yang Terbukti**:  
  **Penyalahgunaan Penyimpanan / Table Bloating (Denial of Service)**. Penyerang anonim dapat membombardir tabel `public_form_tokens` dengan jutaan baris data sampah melalui PostgREST `POST /rest/v1/public_form_tokens`, menghabiskan kapasitas database Supabase.

---

### 2.4. Validasi Temuan 4: `audit_logs_insert` (Tabel `audit_logs`)

#### A. Pemeriksaan Struktur, Kolom, dan Constraint
Tabel `audit_logs` memuat:
- `id` (BIGSERIAL PRIMARY KEY)
- `unit_id` (UUID nullable)
- `actor_id` (UUID nullable, REFERENCES `profiles(id)`)
- `action` (VARCHAR(50) NOT NULL)
- `table_name` (VARCHAR(100) NOT NULL)
- `record_id` (VARCHAR(100) NOT NULL)
- `old_data`, `new_data` (JSONB)
- `ip_address`, `user_agent`, `created_at`

#### B. Pemeriksaan Immutabilitas dan Trigger
- **Perlindungan Terhadap Modifikasi & Penghapusan**:
  Tabel ini dilindungi oleh dua lapis pertahanan:
  1. Trigger `trg_protect_audit_logs` mengeksekusi `protect_audit_log_immutability()`: membatalkan seluruh operasi `BEFORE UPDATE OR DELETE` dengan `RAISE EXCEPTION`.
  2. Policy `audit_logs_deny_update` (`USING false`) dan `audit_logs_deny_delete` (`USING false`).
  *Immutabilitas log (anti-delete dan anti-update) terbukti 100% aman.*

#### C. Analisis Pemalsuan Identitas (Log Forgery & Spoofing)
- **Privilege & Policy INSERT**:
  Role `authenticated` memiliki privilege `INSERT`.  
  Policy: `CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);`.
- **Apakah authenticated user dapat memalsukan identitas pembuat audit log?**  
  **YA, TERBUKTI 100%.**  
  Tidak ada klausul `WITH CHECK (actor_id = auth.uid())` dan tidak ada trigger `BEFORE INSERT` yang menyuntikkan `auth.uid()`. Setiap pengguna terautentikasi (bahkan staf biasa) dapat mengirim POST ke `/rest/v1/audit_logs` dengan mengisi `actor_id` milik akun lain (misalnya akun Direktur atau Super Admin) untuk menjebak rekan kerja atau menciptakan alibi palsu dalam investigasi forensik.

---

### 2.5. Validasi Temuan 5: Inventarisasi Kebijakan `FOR ALL` dan Hak DELETE

#### A. Mekanisme Evaluasi PostgreSQL RLS pada Perintah DELETE
Dalam arsitektur RLS PostgreSQL:
1. Perintah `DELETE` memeriksa seluruh kebijakan yang berlaku untuk command `DELETE` atau `ALL`.
2. Kebijakan bertipe `PERMISSIVE` (default). Jika terdapat minimal satu kebijakan yang klausul `USING`-nya mengevaluasi `true`, operasi `DELETE` diizinkan (kecuali dibatalkan oleh kebijakan `RESTRICTIVE` atau trigger).
3. Pada tabel yang memiliki kebijakan `FOR ALL` tanpa kebijakan `DELETE` terpisah, klausul `USING` dari kebijakan `FOR ALL` itulah yang mengatur apakah suatu baris boleh dihapus.
4. Role `authenticated` memiliki hak `GRANT DELETE` pada seluruh tabel operasional secara default di Supabase.

#### B. Inventarisasi Akurat 32 Kebijakan `FOR ALL` (Tepat 32 Tabel)
Berikut adalah daftar 32 tabel yang memiliki kebijakan `FOR ALL`, diklasifikasikan berdasarkan cakupan wewenang:

1. **Kelompok Super Admin (10 Tabel)** — Akses DELETE dibatasi untuk `has_system_role('super_admin')`:
   - `organizations` (`organizations_manage_super_admin`)
   - `units` (`units_manage_super_admin`)
   - `profiles` (`profiles_manage_super_admin`)
   - `roles` (`roles_manage_super_admin`)
   - `permissions` (`permissions_manage_super_admin`)
   - `role_permissions` (`role_permissions_manage_super_admin`)
   - `user_system_roles` (`user_system_roles_manage_super_admin`)
   - `user_unit_roles` (`user_unit_roles_manage_super_admin`)
   - `system_settings` (`system_settings_manage`)
   - `public_form_tokens` (`public_form_tokens_read_manage`)

2. **Kelompok Explicit Deny-All (1 Tabel)** — Akses DELETE ditolak mutlak:
   - `employee_portal_auth` (`employee_portal_auth_deny_all`: `USING false`)

3. **Kelompok Pengelola Unit / Manajer Operasional (21 Tabel)** — Akses DELETE terbuka bagi staf yang memiliki izin unit terkait:
   - `departments` (`departments_manage_unit`: `units.manage`)
   - `positions` (`positions_manage_unit`: `units.manage`)
   - `work_schedules` (`work_schedules_manage_unit`: `units.manage`)
   - `employee_sensitive_data` (`employee_sensitive_manage`: `employees.manage_sensitive`)
   - `leave_policies` (`leave_policies_manage`: `leave.manage`)
   - `leave_conflict_groups` (`leave_conflict_groups_manage`: `leave.manage`)
   - `leave_conflict_departments` (`leave_conflict_departments_manage`: `leave.manage`)
   - `leave_requests` (`leave_requests_manage`: `leave.manage`)
   - `glass_types` (`glass_types_manage`: `glass_tips.manage_rates`)
   - `glass_tip_rates` (`glass_tip_rates_manage`: `glass_tips.manage_rates`)
   - `violation_types` (`violation_types_manage`: `violations.manage`)
   - `violation_records` (`violation_records_manage`: `violations.manage`)
   - `warning_letters` (`warning_letters_manage`: `violations.issue_sp`)
   - `briefing_sessions` (`briefing_sessions_manage`: `attendance.manage_briefing`)
   - `briefing_attendances` (`briefing_attendances_manage`: `attendance.manage_briefing`)
   - `attendance_daily_records` (`attendance_daily_records_manage`: `attendance.adjust`)
   - `salary_components` (`salary_components_manage`: `payroll.manage`)
   - `employee_salary_structures` (`employee_salary_structures_manage`: `payroll.manage`)
   - `payroll_periods` (`payroll_periods_manage`: `payroll.manage`)
   - `payroll_records` (`payroll_records_manage`: `payroll.manage` — *catatan: dilindungi sebagian oleh trigger `trg_protect_payroll_records` saat status FINALIZED*)
   - `vehicles` (`vehicles_manage_unit`: `fleet.manage`)

#### C. Klarifikasi Sifat Risiko DELETE
- **Bukan Celah Eksternal/Anonim**: Pihak luar (anon) atau staf tanpa permission unit tidak dapat menghapus baris apapun.
- **Risiko Pengguna Berwenang Berlebih (Over-Privileged Unit Managers)**:  
  Di dalam sistem SDM & Enterprise ERP, penghapusan transaksi transaksional inti (seperti Surat Peringatan `warning_letters`, pengajuan cuti `leave_requests`, dan catatan pelanggaran `violation_records`) seharusnya hanya melalui mekanisme pembatalan (*soft-delete* atau status `CANCELLED`). Saat ini, database mengizinkan manajer unit melakukan *hard delete* fisik baris-baris tersebut via PostgREST, yang dapat melenyapkan riwayat kepatuhan karyawan secara permanen.

---

## 3. RINGKASAN KLASIFIKASI VALIDASI & TINGKAT RISIKO TERKOREKSI

### A. Temuan Terbukti (Secara Statis & Nyata pada Kode)
1. **`SEC-VAL-01` — Pemalsuan Tip Potong Kaca Masuk ke Payroll (`glass_tips_insert_anon`)**:  
   Terbukti bahwa anon dapat meng-insert baris dengan `status = 'VERIFIED'` dan `verified_amount`, yang langsung ditarik ke dalam perhitungan slip gaji karyawan saat fungsi `calculate_and_finalize_payroll_atomic` dieksekusi.
2. **`SEC-VAL-02` — Pemesanan Kendaraan Melewati Approval (`vehicle_borrowing_requests_insert_anon`)**:  
   Terbukti bahwa anon dapat meng-insert peminjaman armada dengan `status = 'APPROVED'` dan `approved_by = NULL`, memanfaatkan data armada aktif yang dapat dibaca anon melalui `vehicles_read_anon`.
3. **`SEC-VAL-03` — Pemalsuan Identitas Audit Log (`audit_logs_insert`)**:  
   Terbukti bahwa pengguna terautentikasi dapat meng-insert baris log audit dengan mengisi `actor_id` milik pengguna lain tanpa validasi `auth.uid()`.
4. **`SEC-VAL-04` — Hard DELETE Terbuka pada 20 Tabel Transaksional**:  
   Terbukti bahwa kebijakan `FOR ALL` memberikan hak `DELETE` kepada pemegang hak unit tanpa pencegahan hard-delete pada tabel transaksional sensitif (`leave_requests`, `warning_letters`, `violation_records`, dll.).

### B. Temuan Tidak Terbukti / Gugur (Overstated Claims)
1. **Bypass Validasi Token Bisnis pada `public_form_tokens_anon_insert`**:  
   Klaim bahwa token yang dibuat anonim dapat digunakan untuk membobol formulir publik melalui fungsi `validate_and_consume_token` dinyatakan **GUGUR / TIDAK TERBUKTI**, karena fungsi tersebut tidak ada di dalam basis data dan tabel tersebut saat ini berstatus *orphaned*.
2. **Kalkulasi Ganda Tip Potong Kaca pada Payroll**:  
   Klaim bahwa tip potong kaca dapat dihitung berulang kali dinyatakan **TIDAK TERBUKTI**, karena fungsi payroll secara atomik memperbarui `payroll_period_id` pada setiap tip yang telah diserap.

### C. Temuan yang Membutuhkan Runtime Test (Di Lingkungan Terisolasi)
1. **Verifikasi Perilaku PostgREST Filter Header pada RPC Non-Bypass**: Memastikan apakah gateway Supabase/Kong di depan PostgREST menerapkan rate-limiting atau header sanitization pada payload anonim sebelum mencapai PostgreSQL kernel.

### D. Matriks Tingkat Risiko yang Telah Dikoreksi

| ID Temuan | Komponen / Policy | Tingkat Risiko Awal | Tingkat Risiko Terkoreksi | Alasan Koreksi |
|---|---|---|---|---|
| **SEC-01** | `glass_tips_insert_anon` | CRITICAL | **CRITICAL** | Terbukti memicu injeksi nominal langsung ke slip gaji karyawan. |
| **SEC-02** | `vehicle_borrowing_requests_insert_anon` | HIGH | **HIGH** | Terbukti dapat mengunci armada langsung `APPROVED` tanpa persetujuan petugas. |
| **SEC-03** | `public_form_tokens_anon_insert` | HIGH | **LOW TO MEDIUM** | Diturunkan: tidak ada fungsi bisnis yang mengonsumsi token; risiko terbatas pada spam database / table bloat. |
| **SEC-04** | `audit_logs_insert` | MEDIUM | **MEDIUM** | Terbukti dapat memalsukan `actor_id` pembuat log, meski immutabilitas UPDATE/DELETE terjaga. |
| **SEC-05** | Kebijakan `FOR ALL` pada Tabel Transaksi | MEDIUM | **MEDIUM** | Terbukti memungkinkan manajer unit melakukan hard-delete permanen pada riwayat pelanggaran/cuti. |

---

## 4. REKOMENDASI REMEDIASI TEKNIS (KONSEP DRAF, TANPA IMPLEMENTASI)

> [!IMPORTANT]
> **PERINGATAN KESELAMATAN**:  
> Seluruh rekomendasi di bawah ini merupakan cetak biru teknis perbaikan skema.  
> **JANGAN MENJALANKAN DDL DI BAWAH INI PADA FASE 1 INI**.

1. **Remediasi `glass_tips`**:
   - Batasi klausul `WITH CHECK` pada `glass_tips_insert_anon` menjadi:
     ```sql
     WITH CHECK (
         status = 'PENDING'
         AND verified_amount IS NULL
         AND payroll_period_id IS NULL
     )
     ```
   - Tambahkan trigger `BEFORE INSERT OR UPDATE` yang memastikan `verified_amount` hanya boleh diisi jika `status = 'VERIFIED'` oleh pengguna dengan permission `glass_tips.verify`.

2. **Remediasi `vehicle_borrowing_requests`**:
   - Batasi klausul `WITH CHECK` pada `vehicle_borrowing_requests_insert_anon` menjadi:
     ```sql
     WITH CHECK (
         status = 'PENDING'
         AND approved_by IS NULL
         AND approved_at IS NULL
         AND cancellation_reason IS NULL
     )
     ```

3. **Remediasi `public_form_tokens`**:
   - Cabut hak `INSERT` anonim langsung pada tabel (`REVOKE INSERT ON TABLE public_form_tokens FROM anon;`).
   - Hapus policy `public_form_tokens_anon_insert`. Jika sistem form publik membutuhkan token, terbitkan token secara eksklusif melalui RPC terotentikasi/terbatas.

4. **Remediasi `audit_logs`**:
   - Perketat policy `audit_logs_insert`:
     ```sql
     WITH CHECK (actor_id = auth.uid())
     ```
   - Pertahankan trigger immutabilitas `trg_protect_audit_logs`.

5. **Remediasi Pencegahan Hard-Delete Transaksional**:
   - Tambahkan kebijakan eksplisit `RESTRICTIVE` atau `DENY DELETE` pada tabel-tabel transaksional inti:
     - `leave_requests`
     - `warning_letters`
     - `violation_records`
     - `attendance_daily_records`
     - `employee_sensitive_data`

---

## 5. KESIMPULAN STATUS FASE 1

Validasi teknis statis telah berhasil memisahkan risiko nyata yang terbukti secara teknis dari hipotesis yang belum didukung kode.  
**PHASE 1 TETAP AKTIF DAN BELUM DITUTUP.** Seluruh temuan valid ini siap dijadikan dasar penyusunan migrasi remediasi keamanan pada fase berikutnya setelah mendapatkan persetujuan eksplisit.

