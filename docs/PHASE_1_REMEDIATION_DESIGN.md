# PHASE 1 — RLS & DATABASE SECURITY REMEDIATION DESIGN
## KUK MANAGEMENT SYSTEM v3.1.0

> **STATUS: LOCAL REMEDIATION DESIGN & DRAFT SPECIFICATION**  
> **TARGET DATABASE: Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — DRAFT ONLY, DO NOT APPLY**  
> **SCOPE: Perbaikan 4 Kebijakan RLS Kritis, Pencegahan Hard-Delete Transaksional, Perlindungan Audit Trail**  
> **BATASAN MUTLAK: Dokumen ini dan berkas migrasi terkait berstatus DRAFT lokal. Tidak dieksekusi ke Production tanpa persetujuan eksplisit.**

---

## 1. LATAR BELAKANG & TUJUAN REMEDIASI

Berdasarkan validasi menyeluruh pada dokumen:
- `docs/PHASE_1_SECURITY_AUDIT_RECONCILIATION.md`
- `docs/PHASE_1_FINAL_SECURITY_MATRIX_VALIDATION.md`

Ditemukan beberapa celah keamanan struktural pada skema `public` PostgreSQL Supabase Production:
1. **Injeksi Nominal Tip Kaca ke Slip Gaji (`glass_tips_insert_anon`)**: Celah `WITH CHECK (true)` tanpa trigger pembatas memungkinkan klien anonim memasukkan baris tip dengan `status = 'VERIFIED'` dan `verified_amount`, yang langsung terserap ke penggajian karyawan aktif oleh fungsi atomik `calculate_and_finalize_payroll_atomic`.
2. **Pemesanan Armada Langsung APPROVED Tanpa Persetujuan Petugas (`vehicle_borrowing_requests_insert_anon`)**: Celah `WITH CHECK (true)` dan kolom `approved_by` yang nullable memungkinkan klien anonim memasukkan peminjaman dengan `status = 'APPROVED'` langsung, mem-bypass RPC `book_vehicle_atomic` dan memblokir peminjaman lain via exclusion constraint.
3. **Pemalsuan Identitas Audit Trail (`audit_logs_insert`)**: Pengguna terautentikasi dapat meng-insert baris log audit dengan memalsukan `actor_id` milik akun lain (misalnya Super Admin) karena ketiadaan filter `actor_id = auth.uid()`.
4. **Celah Hard-Delete pada 4 Tabel Transaksional Kepatuhan**: Kebijakan `FOR ALL` pada `leave_requests`, `warning_letters`, `violation_records`, dan `attendance_daily_records` memungkinkan manajer unit menghapus fisik baris riwayat, menghilangkan jejak audit ketenagakerjaan secara permanen.
5. **Akses Insert Anonim pada Tabel Dormant (`public_form_tokens`)**: Tabel token tidak digunakan oleh fungsi atau frontend manapun, namun membuka hak insert publik yang berisiko disalahgunakan untuk *storage bloat/DoS*.

---

## 2. DETAIL RANCANGAN REMEDIASI (TEKNIS & KODE DDL)

Berikut adalah 5 aksi perbaikan teknis yang dirancang ke dalam berkas migrasi lokal:
`supabase/migrations/20261105000001_remediate_rls_security.sql`.

---

### A. Remediasi 1: Pengetatan Kebijakan `glass_tips_insert_anon`
- **Objek Database**: `public.glass_tips` (RLS Policy).
- **Masalah Semula**: Klausul `WITH CHECK (true)` mengizinkan pemanggil mengatur `status = 'VERIFIED'` dan menentukan nominal `verified_amount` sesuka hati.
- **Solusi DDL**:
  ```sql
  DROP POLICY IF EXISTS "glass_tips_insert_anon" ON public.glass_tips;
  CREATE POLICY "glass_tips_insert_anon" ON public.glass_tips
      FOR INSERT TO anon
      WITH CHECK (
          status = 'PENDING'
          AND verified_amount IS NULL
          AND payroll_period_id IS NULL
      );
  ```
- **Rasional Keselamatan**:
  - Memaksa setiap input tip pemotongan kaca baru dari formulir publik memiliki status awal `PENDING`.
  - Memastikan nominal verifikasi `verified_amount` wajib bernilai `NULL` saat pengajuan awal.
  - Memastikan tip baru tidak dapat langsung ditautkan ke periode payroll manapun (`payroll_period_id IS NULL`).
  - Mengeliminasi 100% risiko penyerapan dana fiktif ke slip gaji karyawan pada RPC `calculate_and_finalize_payroll_atomic`.

---

### B. Remediasi 2: Pengetatan Kebijakan `vehicle_borrowing_requests_insert_anon`
- **Objek Database**: `public.vehicle_borrowing_requests` (RLS Policy).
- **Masalah Semula**: Klausul `WITH CHECK (true)` mengizinkan klien anonim mengatur status langsung `'APPROVED'` dan mengisi kolom persetujuan tanpa melewati persetujuan petugas fleet.
- **Solusi DDL**:
  ```sql
  DROP POLICY IF EXISTS "vehicle_borrowing_requests_insert_anon" ON public.vehicle_borrowing_requests;
  CREATE POLICY "vehicle_borrowing_requests_insert_anon" ON public.vehicle_borrowing_requests
      FOR INSERT TO anon
      WITH CHECK (
          status = 'PENDING'
          AND approved_by IS NULL
          AND approved_at IS NULL
          AND cancellation_reason IS NULL
      );
  ```
- **Rasional Keselamatan**:
  - Memastikan pengajuan peminjaman kendaraan publik selalu berstatus awal `PENDING`.
  - Mencegah manipulasi kolom pengesahan (`approved_by`, `approved_at`).
  - Memaksa setiap persetujuan hanya dapat dilakukan melalui staf operasional yang memiliki izin `fleet.approve_borrowing` via policy `vehicle_borrowing_requests_update`.

---

### C. Remediasi 3: Penegakan Identitas Asli pada `audit_logs_insert`
- **Objek Database**: `public.audit_logs` (RLS Policy).
- **Masalah Semula**: Staf terautentikasi dapat memalsukan baris audit dengan menyisipkan `actor_id` milik akun lain.
- **Solusi DDL**:
  ```sql
  DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
  CREATE POLICY "audit_logs_insert" ON public.audit_logs
      FOR INSERT TO authenticated
      WITH CHECK (
          actor_id = auth.uid()
      );
  ```
- **Rasional Keselamatan**:
  - Memastikan setiap baris audit yang dicatat langsung via API klien terautentikasi wajib memiliki `actor_id` yang identik dengan token JWT pengguna yang sedang aktif (`auth.uid()`).
  - Mencegah fitnah forensik atau alibi palsu antar staf.
  - Tetap mempertahankan immutabilitas update dan delete yang sudah terproteksi ganda oleh trigger `trg_protect_audit_logs`.

---

### D. Remediasi 4: Perlindungan Immutabilitas Data Transaksional Kepatuhan (Anti Hard-Delete)
- **Objek Database**: `leave_requests`, `warning_letters`, `violation_records`, `attendance_daily_records` (RLS Policies).
- **Masalah Semula**: Kebijakan `FOR ALL` berbasis izin unit mengizinkan manajer unit melakukan operasi SQL `DELETE` fisik terhadap data riwayat transaksional.
- **Solusi DDL**:
  ```sql
  -- Cegah hard-delete pada riwayat pengajuan cuti
  DROP POLICY IF EXISTS "leave_requests_delete_deny" ON public.leave_requests;
  CREATE POLICY "leave_requests_delete_deny" ON public.leave_requests
      FOR DELETE TO authenticated
      USING (false);

  -- Cegah hard-delete pada surat peringatan (SP)
  DROP POLICY IF EXISTS "warning_letters_delete_deny" ON public.warning_letters;
  CREATE POLICY "warning_letters_delete_deny" ON public.warning_letters
      FOR DELETE TO authenticated
      USING (false);

  -- Cegah hard-delete pada catatan pelanggaran disiplin
  DROP POLICY IF EXISTS "violation_records_delete_deny" ON public.violation_records;
  CREATE POLICY "violation_records_delete_deny" ON public.violation_records
      FOR DELETE TO authenticated
      USING (false);

  -- Cegah hard-delete pada rekapitulasi presensi harian
  DROP POLICY IF EXISTS "attendance_daily_records_delete_deny" ON public.attendance_daily_records;
  CREATE POLICY "attendance_daily_records_delete_deny" ON public.attendance_daily_records
      FOR DELETE TO authenticated
      USING (false);
  ```
- **Rasional Keselamatan**:
  - Mengikuti pola proteksi yang sudah sukses diterapkan pada tabel `employees` (`employees_delete_deny`).
  - Memaksa siklus hidup data transaksional menggunakan pembatalan status (*soft cancellation* via status `'CANCELLED'` atau `'REJECTED'`), bukan penghapusan baris fisik database.
  - Menjaga keutuhan audit kepatuhan regulasi ketenagakerjaan dan histori disiplin staf.

---

### E. Remediasi 5: Penutupan Hak Akses Insert Publik pada Tabel Dormant `public_form_tokens`
- **Objek Database**: `public.public_form_tokens` (RLS Policy & Table Grant).
- **Masalah Semula**: Tabel form token tidak dikonsumsi oleh fungsi atau frontend manapun, namun membuka hak `INSERT` publik tanpa validasi.
- **Solusi DDL**:
  ```sql
  DROP POLICY IF EXISTS "public_form_tokens_anon_insert" ON public.public_form_tokens;
  REVOKE INSERT ON TABLE public.public_form_tokens FROM anon;
  ```
- **Rasional Keselamatan**:
  - Menutup celah eksploitasi kapasitas penyimpanan (*database bloating/storage exhaustion DoS*).
  - Mengembalikan tabel ke status aman terkunci hingga fitur form token resmi diimplementasikan di fase mendatang.

---

## 3. PROSEDUR PENGUJIAN DAN ROLLOUT SAFETY

### Tahapan Verifikasi Sebelum Penerapan:
1. **Dry-Run Validasi Sintaks Lokal**:
   Memastikan berkas `supabase/migrations/20261105000001_remediate_rls_security.sql` lulus pengujian linting SQL dan memiliki penomoran sekuensial yang valid terhadap `20261104000002_harden_rpc_security.sql`.
2. **Pengujian Staging Terisolasi**:
   Sebelum diterapkan ke Supabase Production (`ckzciuybedefbsdfsexh`), migrasi wajib diuji pada Supabase Local / Staging environment untuk memvalidasi:
   - Request `POST /rest/v1/glass_tips` dengan `status = 'VERIFIED'` menghasilkan error `42501 (new row violates row-level security policy)`.
   - Request `POST /rest/v1/glass_tips` dengan `status = 'PENDING'` dan `verified_amount = null` berhasil `201 Created`.
   - Request `DELETE /rest/v1/leave_requests` menghasilkan error `42501`.
3. **Pemberian Persetujuan Eksplisit**:
   Tidak ada langkah penerapan remote ke Production sebelum pengguna memberikan instruksi persetujuan tertulis secara langsung.

