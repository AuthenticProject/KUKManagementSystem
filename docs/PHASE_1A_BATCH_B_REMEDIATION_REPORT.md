# PHASE 1A — BATCH B REMEDIATION REPORT
## KUK Management System v3.1.0

- **Baseline Commit:** `b77fc90`
- **Migration Target:** `supabase/migrations/20261105000002_security_rpc_and_remediation.sql`
- **Scope:** LOCAL ONLY — Remediasi Hardening Database RPC & RLS Policies
- **Target Supabase Environment:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — **ZERO MUTATION / TIDAK DISENTUH**
- **Status Proyek:** **PHASE 1 MASIH TERBUKA (OPEN)** — Menunggu Review Manual

---

### 1. Ringkasan Eksekutif Remediasi Batch B

Remediasi Batch B telah menyelesaikan seluruh temuan audit keamanan (CRITICAL, HIGH, dan MEDIUM) yang ditemukan pada draft awal migrasi Phase 1A. Seluruh perbaikan diimplementasikan secara terisolasi pada file migrasi lokal `supabase/migrations/20261105000002_security_rpc_and_remediation.sql` tanpa menyentuh migrasi historis yang telah diaplikasikan (`20261104000001_core_schema_v3_1_0.sql` dan `20261104000002_harden_rpc_security.sql`), tanpa modifikasi frontend `src/`, dan tanpa eksekusi DDL/DML ke database remote Supabase Cloud.

---

### 2. Status Temuan Keamanan (Initial vs. Remaining)

| Kategori | Temuan Awal | Status Remediasi | Temuan Tersisa |
| :--- | :---: | :---: | :---: |
| **CRITICAL** | 3 | Teratasi Penuh (3/3) | **0** |
| **HIGH** | 3 | Teratasi Penuh (3/3) | **0** |
| **MEDIUM** | 8 | Teratasi Penuh (8/8) | **0** |
| **TOTAL** | **14** | **14 Teratasi** | **0** |

---

### 3. Matriks Perubahan Kebijakan RLS (Before vs. After)

| Tabel | Status Awal (Sebelum Remediasi) | Status Akhir (Pasca Remediasi Batch B) | Dampak Keamanan |
| :--- | :--- | :--- | :--- |
| `glass_tips` | Direct `INSERT` terbuka untuk role `anon` via RLS permissive. | Direct `INSERT` di-REVOKE total dari `anon` & `PUBLIC`. Policy `glass_tips_insert_anon` di-DROP. Akses publik dialihkan 100% via RPC `submit_glass_tip_atomic`. | Menutup manipulasi langsung data tip dan spoofing parameter verifikasi. |
| `vehicle_borrowing_requests` | Direct `INSERT` terbuka untuk role `anon` via RLS permissive. | Direct `INSERT` di-REVOKE total dari `anon` & `PUBLIC`. Policy `vehicle_borrowing_requests_insert_anon` di-DROP. Akses publik dialihkan 100% via RPC `book_vehicle_atomic`. | Menutup injeksi reservasi ilegal, bypass status PENDING, dan manipulasi approval. |
| `audit_logs` | Direct `INSERT` diizinkan tanpa validasi aktor asli (`actor_id`). | Direct `INSERT` di-REVOKE dari `anon` & `PUBLIC`. Policy `audit_logs_insert` ditegakkan dengan `WITH CHECK (actor_id = auth.uid())`. RPC mencatat audit via `SECURITY DEFINER`. | Menutup celah spoofing jejak audit dan pemalsuan ID aktor. |
| `public_form_tokens` | Tabel berpotensi diakses tanpa penguncian hak izin eksplisit. | `REVOKE ALL ON TABLE public.public_form_tokens FROM anon, PUBLIC;` diterapkan secara eksplisit. | Mencegah token harvesting dan akses langsung tanpa izin. |
| `leave_requests` | Celah hard-delete jika terdapat policy permisif. | Ditambahkan policy `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`. | Menjamin kepatuhan data ketenagakerjaan tidak dapat dihapus permanen. |
| `warning_letters` | Celah hard-delete jika terdapat policy permisif. | Ditambahkan policy `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`. | Menjamin catatan SP bersifat permanen & auditabel. |
| `violation_records` | Celah hard-delete jika terdapat policy permisif. | Ditambahkan policy `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`. | Menjamin catatan pelanggaran disiplin tidak dapat dihapus. |
| `attendance_daily_records` | Celah hard-delete jika terdapat policy permisif. | Ditambahkan policy `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`. | Menjamin presensi harian karyawan tidak dapat dimanipulasi/dihapus. |

---

### 4. Kontrak & Tanda Tangan RPC Definitif

Seluruh RPC didefinisikan dengan isolasi schema `SET search_path = public, extensions, pg_temp;` (meletakkan `pg_temp` di urutan terakhir untuk mitigasi object shadowing).

#### 4.1. `public.reset_employee_kiosk_pin`
- **Mode Keamanan:** `SECURITY DEFINER`
- **Izin Eksekusi:** Di-`REVOKE` dari `anon` dan `PUBLIC`. Di-`GRANT` hanya kepada `authenticated` dan `service_role`.
- **Parameter:**
  - `p_unit_id UUID`
  - `p_employee_id UUID`
  - `p_new_pin VARCHAR(10)`
- **Validasi Kritis:**
  - Memeriksa sesi login aktif (`auth.uid() IS NOT NULL`).
  - Memeriksa permission unit: `has_unit_permission(p_unit_id, 'employees.manage_sensitive')`.
  - Format PIN tepat 6 digit angka (`^[0-9]{6}$`).
  - Memvalidasi karyawan aktif pada unit bersangkutan (`unit_id = p_unit_id AND id = p_employee_id`).
  - `ON CONFLICT (employee_id) DO UPDATE ... WHERE employee_portal_auth.unit_id = p_unit_id` (anti-cross-unit).
  - Reset `failed_attempts = 0` dan `locked_until = NULL`.
  - Mencatat audit log `RESET_KIOSK_PIN`.

#### 4.2. `public.submit_glass_tip_atomic`
- **Mode Keamanan:** `SECURITY DEFINER`
- **Izin Eksekusi:** Di-`GRANT` kepada `anon`, `authenticated`, dan `service_role`.
- **Parameter:**
  - `p_unit_id UUID`
  - `p_employee_code VARCHAR(50)`
  - `p_auth_pin VARCHAR(10)`
  - `p_glass_type_id UUID`
  - `p_length_cm NUMERIC(10, 2)`
  - `p_height_cm NUMERIC(10, 2)`
  - `p_quantity INT`
  - `p_notes TEXT DEFAULT NULL`
- **Validasi Kritis & Alur Otentikasi:**
  - Validasi parameter wajib dan batas panjang teks (`notes <= 500`).
  - Format PIN tepat 6 digit angka. Jika tidak valid, mengeksekusi dummy bcrypt untuk menyamarkan timing sebelum mengembalikan `{ success: false, code: 'AUTH_FAILED' }`.
  - Validasi batas fisik: panjang 5.0–600.0 cm, tinggi 5.0–350.0 cm, kuantitas 1–500 lembar.
  - Verifikasi karyawan pada unit; jika tidak ada/nonaktif, mengeksekusi dummy bcrypt.
  - Row locking eksklusif: `SELECT * FROM employee_portal_auth ... FOR UPDATE`.
  - Evaluasi status lockout (`locked_until > now()`).
  - Komparasi hash PIN menggunakan perbandingan null-safe (`IS DISTINCT FROM`).
  - **Persistensi Kegagalan Tanpa Rollback:** Jika PIN salah, `failed_attempts` dinaikkan dan disimpan secara persisten via `UPDATE`, menetapkan `locked_until = now() + INTERVAL '30 minutes'` jika $\ge 5$, dan mengembalikan JSONB failure tanpa memicu `RAISE EXCEPTION` yang membatalkan transaksi.
  - Jika otentikasi berhasil: `failed_attempts` direset ke 0, menghitung kalkulasi luas dan tip berdasarkan master tarif aktif, men-generate nomor nota dokumen via `generate_document_number_atomic`, dan menyimpan transaksi dengan status terkunci `PENDING`.

#### 4.3. `public.verify_glass_tip_atomic`
- **Mode Keamanan:** `SECURITY DEFINER`
- **Izin Eksekusi:** Di-`REVOKE` dari `anon` dan `PUBLIC`. Di-`GRANT` hanya kepada `authenticated` dan `service_role`.
- **Parameter:**
  - `p_unit_id UUID`
  - `p_tip_id UUID`
  - `p_action VARCHAR(20)` — Wajib `'VERIFY'` atau `'REJECT'`
  - `p_verified_amount NUMERIC(12, 2) DEFAULT NULL`
  - `p_notes TEXT DEFAULT NULL`
- **Validasi Kritis:**
  - Memeriksa sesi login aktif (`auth.uid() IS NOT NULL`).
  - Validasi permission: `has_unit_permission(p_unit_id, 'glass_tips.verify')`.
  - Validasi aksi: Menolak `p_action IS NULL` atau selain `'VERIFY'` / `'REJECT'`.
  - Validasi nominal: Wajib $> 0$ saat `VERIFY`, wajib `NULL` saat `REJECT`.
  - Batas panjang catatan $\le 500$ karakter.
  - Kunci baris sasaran: `SELECT * FROM glass_tips ... FOR UPDATE`.
  - Memastikan nota belum diserap payroll (`payroll_period_id IS NULL`) dan berstatus awal `PENDING`.
  - Mengupdate status ke `VERIFIED` atau `REJECTED`, dan mencatat audit log `VERIFY_TIP`.

#### 4.4. `public.book_vehicle_atomic`
- **Mode Keamanan:** `SECURITY DEFINER`
- **Izin Eksekusi:** Di-`GRANT` kepada `anon`, `authenticated`, dan `service_role`.
- **Parameter:**
  - `p_unit_id UUID`
  - `p_vehicle_id UUID`
  - `p_borrower_name VARCHAR(150)`
  - `p_borrower_institution VARCHAR(150)`
  - `p_borrower_phone VARCHAR(30)`
  - `p_responsible_person VARCHAR(150)`
  - `p_start_time TIMESTAMPTZ`
  - `p_estimated_return_time TIMESTAMPTZ`
  - `p_destination TEXT`
  - `p_purpose TEXT`
- **Validasi Kritis:**
  - Validasi kelengkapan string tidak boleh kosong (`TRIM(val) = ''`).
  - Batas panjang string ketat (`name <= 150`, `phone <= 30`, `destination <= 500`, `purpose <= 1000`).
  - Validasi status armada: `is_active = TRUE` dan bukan `DECOMMISSIONED`.
  - Validasi waktu: Waktu mulai tidak boleh lampau (`>= now() - INTERVAL '15 minutes'`), waktu kembali $>$ waktu keluar, durasi maksimal $\le 30$ hari.
  - Pengecekan awal benturan jadwal terhadap reservasi aktif.
  - Men-generate booking code via `generate_document_number_atomic`.
  - Menyimpan reservasi dengan status terkunci `PENDING`, `approved_by = NULL`, `approved_at = NULL`.
  - Mencatat audit log `BOOK_VEHICLE`.

#### 4.5. `public.approve_vehicle_atomic`
- **Mode Keamanan:** `SECURITY DEFINER`
- **Izin Eksekusi:** Di-`REVOKE` dari `anon` dan `PUBLIC`. Di-`GRANT` hanya kepada `authenticated` dan `service_role`.
- **Parameter:**
  - `p_unit_id UUID`
  - `p_booking_id UUID`
  - `p_action VARCHAR(20)` — Wajib `'APPROVE'` atau `'REJECT'`
  - `p_rejection_reason TEXT DEFAULT NULL`
- **Validasi Kritis:**
  - Memeriksa sesi login aktif (`auth.uid() IS NOT NULL`).
  - Validasi permission: `has_unit_permission(p_unit_id, 'fleet.manage')`.
  - Validasi aksi: Menolak `p_action IS NULL` atau selain `'APPROVE'` / `'REJECT'`.
  - Validasi alasan penolakan: Wajib diisi jika `REJECT` (maksimal 500 karakter), wajib `NULL` jika `APPROVE`.
  - Kunci baris sasaran: `SELECT * FROM vehicle_borrowing_requests ... FOR UPDATE`.
  - Memastikan status awal permohonan adalah `PENDING`.
  - Menangani error benturan jadwal konkurensi secara spesifik pada level constraint eksklusi PostgreSQL: `WHEN exclusion_violation THEN ... ERRCODE = '23P01'` tanpa mem-masking database error lain.
  - Mengupdate status ke `APPROVED` (dengan `approved_by = auth.uid()` dan `approved_at = now()`) atau `REJECTED`.
  - Mencatat audit log `APPROVE_VEHICLE_BOOKING`.

---

### 5. Hasil Verifikasi Lingkungan Lokal

- **Validator Skrip Migrasi (`scripts/validate_batch_b_migration.cjs`):** 23/23 Asersi Lulus (100% PASS).
- **TypeScript Typecheck (`tsc --noEmit`):** Exit Code 0 (0 error).
- **Vite Production Build (`vite build`):** Exit Code 0 (Success).
- **Regression Suite Phase 2 (`scripts/test_phase2_logic.cjs`):** 11/11 Tes Lulus (100% PASS).
- **Integritas Git:** 0 diff pada file-file historis dan file frontend `src/`. Tidak ada commit/push.

