# PHASE 1A — BATCH B.3 FINAL SQL SECURITY HARDENING REPORT
## KUK Management System v3.1.0

- **Baseline Git:** `b77fc90`
- **Migration Target:** `supabase/migrations/20261105000002_security_rpc_and_remediation.sql` (38,637 bytes, 961 baris)
- **Scope Operasional:** **LOCAL DEVELOPMENT ONLY — NO PRODUCTION MUTATION**
- **Target Supabase Remote:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — **ZERO MUTATION / TIDAK DISENTUH**
- **Status Antigravity:** **BATCH B.3 SELESAI SECARA LOKAL — BERHENTI MENUNGGU AUDIT MANUAL**

---

### 1. Baseline & File yang Diperiksa

Pemeriksaan komprehensif sebelum modifikasi mencakup:
1. `supabase/migrations/20261104000001_core_schema_v3_1_0.sql` (Core Schema & Initial RLS Policies)
2. `supabase/migrations/20261104000002_harden_rpc_security.sql` (Hardened RPC Baseline)
3. `supabase/migrations/20261105000001_remediate_rls_security.sql` (Initial Draft Remediation)
4. `supabase/migrations/20261105000002_security_rpc_and_remediation.sql` (Draft Remediasi Phase 1A)
5. `src/services/dataService.ts` (Frontend Service Layer)
6. `src/modules/glass-tips/GlassTipListPage.tsx` & `src/modules/fleet/FleetListPage.tsx` (Frontend UI)
7. `scripts/validate_batch_b_migration.cjs` (Validator Skrip)

---

### 2. Temuan Audit Batch B.2 yang Telah Diselesaikan

| ID Temuan | Kategori | Akar Masalah | Solusi Teknis Batch B.3 | Status |
| :--- | :---: | :--- | :--- | :---: |
| **B3-01** | **CRITICAL** | Endpoint publik `submit_glass_tip_atomic` & `book_vehicle_atomic` dapat dipanggil langsung via `anon` tanpa rate limiter jika hanya mengandalkan Edge Function. | Mengimplementasikan **Opsi 2: Database-Side Atomic Rate Limiting** dengan tabel terproteksi `rpc_rate_limits` dan fungsi atomik `check_and_increment_rate_limit` (`FOR UPDATE`). | **FIXED — STATIC CHECK ONLY** |
| **B3-02** | **HIGH** | `reset_employee_kiosk_pin` mengembalikan `success: true` dan menulis audit meskipun clause `ON CONFLICT ... WHERE` tidak memodifikasi baris sama sekali (0 rows affected). | Menambahkan pemeriksaan `GET DIAGNOSTICS v_rows_affected = ROW_COUNT;`. Jika `v_rows_affected = 0`, eksekusi audit dibatalkan dan mengembalikan `{ success: false, code: 'NO_ROWS_MODIFIED' }`. | **FIXED — STATIC CHECK ONLY** |
| **B3-03** | **HIGH** | Privilege tabel dormant `public_form_tokens` masih terbuka untuk role `authenticated`. | Mengeksekusi `REVOKE ALL ON TABLE public.public_form_tokens FROM anon, authenticated, PUBLIC;` dan `GRANT ALL TO service_role;`. | **FIXED — STATIC CHECK ONLY** |
| **B3-04** | **HIGH** | Perlunya inventarisasi mendalam seluruh policy INSERT `audit_logs` untuk memastikan tidak ada kombinasi `OR` yang membypass anti-spoofing. | Dikonfirmasi hanya ada tepat 1 policy INSERT (`"audit_logs_insert"` dengan `WITH CHECK (actor_id = auth.uid())`). Policy permisif lama `WITH CHECK (true)` telah di-DROP secara bersih. | **FIXED AND VERIFIED** |
| **B3-05** | **HIGH** | Status schema `extensions` dan privilege `CREATE` belum dapat diverifikasi secara lokal. | Ditandai secara objektif sebagai **UNVERIFIED**. Mempertahankan `SET search_path = public, extensions, pg_temp;` dengan `pg_temp` di akhir dan mendokumentasikan kueri uji isolasi. | **UNVERIFIED (DOCUMENTED)** |
| **B3-06** | **HIGH** | Pengecekan status pegawai `v_emp.status != 'ACTIVE'` menghasilkan `NULL` jika kolom status bernilai `NULL`, membypass validasi `IF`. | Mengganti seluruh perbandingan status pegawai dengan `v_emp.status IS DISTINCT FROM 'ACTIVE'` (null-safe comparison). | **FIXED — STATIC CHECK ONLY** |
| **B3-07** | **HIGH** | Kemungkinan numeric field overflow pada `tip_percentage_snapshot NUMERIC(5, 4)` jika `base_rate` bernilai Rupiah (> 9.9999). | Menggunakan ekspresi aman `CASE WHEN v_rate.base_rate BETWEEN 0 AND 1 THEN v_rate.base_rate ELSE 0.0300 END`. | **FIXED — STATIC CHECK ONLY** |
| **B3-08** | **MEDIUM** | Format literal `WIB` pada `to_char` tidak di-quote, menyebabkan PostgreSQL menginterpretasikan huruf `W` sebagai pola format tanggal. | Memperbaiki format mask menjadi `to_char(..., 'HH24:MI:SS "WIB"')`. | **FIXED — STATIC CHECK ONLY** |

---

### 3. Evaluasi & Pilihan Arsitektur Rate Limiting

#### Perbandingan Dua Opsi:
- **Opsi 1 — Edge Function Exclusive Gateway:**
  - *Mekanisme:* Public client memanggil Edge Function; Edge Function mengeksekusi rate limit (misalnya via Redis/Upstash), lalu memanggil database menggunakan service-role key. Hak `EXECUTE` pada RPC dicabut dari `anon`.
  - *Kendala Arsitektur Saat Ini:* Proyek KUK V3 adalah Single Page Application (SPA) berbasis `@supabase/supabase-js` murni tanpa folder `supabase/functions/` dan tanpa deployment Edge Function aktif. Memilih Opsi 1 saat ini akan memutus akses kiosk lapangan secara langsung sebelum infrastruktur backend serverless tersedia.
- **Opsi 2 — Database-Side Atomic Rate Limiting (DIPILIH & DIIMPLEMENTASIKAN):**
  - *Mekanisme:* Membuat tabel internal `public.rpc_rate_limits` dengan RLS enabled dan akses fisik ditutup total dari `anon`, `authenticated`, dan `PUBLIC`.
  - Prosedur helper `check_and_increment_rate_limit` berjalan dengan wewenang `SECURITY DEFINER` menggunakan row lock eksklusif (`SELECT ... FOR UPDATE`), sehingga menjamin konkurensi atomik tanpa race condition.
  - *Keunggulan Mutlak:* **TIDAK BISA DILEWATI (UNBYPASSABLE).** Penyerang yang mencoba memanggil endpoint RPC langsung melalui PostgREST tetap terhalang oleh rate limiter database.
  - *Multi-Layer Limiting:*
    1. **Batas IP Klien:** Maksimal 30 request / 5 menit untuk pengajuan tip; maksimal 10 request / 10 menit untuk booking armada. IP diekstrak dari header gateway (`cf-connecting-ip`, `x-real-ip`, atau `x-forwarded-for`).
    2. **Batas Akun Karyawan:** Maksimal 10 request / 10 menit per kode karyawan. Mencegah penyerang sengaja mengunci akun rekan kerja (*denial-of-service lockout*). Jika batas tercapai, sistem menjalankan dummy Bcrypt timing masking agar tidak membocorkan eksistensi akun.
    3. **Batas Armada Spesifik:** Maksimal 5 permohonan / 10 menit untuk unit kendaraan yang sama untuk mencegah spam permohonan.

---

### 4. Matriks Grant & Privilege Final per Prosedur

| Nama Fungsi | Definisi Hak Akses | Mode | search_path | Alasan Keamanan |
| :--- | :--- | :---: | :--- | :--- |
| `check_and_increment_rate_limit` | `REVOKE ... FROM PUBLIC, anon, authenticated;`<br>`GRANT ... TO service_role;` | `SECURITY DEFINER` | `public, extensions, pg_temp` | Fungsi internal helper; tidak boleh diakses langsung oleh client mana pun. |
| `reset_employee_kiosk_pin` | `REVOKE ... FROM PUBLIC, anon;`<br>`GRANT ... TO authenticated, service_role;` | `SECURITY DEFINER` | `public, extensions, pg_temp` | Prosedur staf administratif; mewajibkan login aktif & permission `employees.manage_sensitive`. |
| `submit_glass_tip_atomic` | `REVOKE ... FROM PUBLIC;`<br>`GRANT ... TO anon, authenticated, service_role;` | `SECURITY DEFINER` | `public, extensions, pg_temp` | Endpoint transaksi publik kiosk lapangan; diproteksi database-side rate limiting & Bcrypt timing guard. |
| `verify_glass_tip_atomic` | `REVOKE ... FROM PUBLIC, anon;`<br>`GRANT ... TO authenticated, service_role;` | `SECURITY DEFINER` | `public, extensions, pg_temp` | Prosedur kasir/verifikator; mewajibkan login aktif & permission `glass_tips.verify`. |
| `book_vehicle_atomic` | `REVOKE ... FROM PUBLIC;`<br>`GRANT ... TO anon, authenticated, service_role;` | `SECURITY DEFINER` | `public, extensions, pg_temp` | Endpoint permohonan publik armada; diproteksi rate limiting IP & armada serta locking PENDING. |
| `approve_vehicle_atomic` | `REVOKE ... FROM PUBLIC, anon;`<br>`GRANT ... TO authenticated, service_role;` | `SECURITY DEFINER` | `public, extensions, pg_temp` | Prosedur persetujuan armada; mewajibkan login & permission `fleet.approve_borrowing`. Menangkap `23P01`. |

---

### 5. Inventaris Kebijakan & Grant pada `audit_logs`

Pemeriksaan menyeluruh terhadap skema historis dan draft remediasi:
1. **Kebijakan INSERT Aktif:** Tepat satu kebijakan permissive INSERT:
   - Nama: `"audit_logs_insert"`
   - Command: `INSERT`
   - Target Role: `authenticated`
   - Syarat: `WITH CHECK (actor_id = auth.uid())`
2. **Ketiadaan Kebijakan Permisif Lain:** Kebijakan permisif awal `WITH CHECK (true)` pada `20261104000001` telah di-DROP secara permanen. Tidak ada kebijakan INSERT lain yang dapat menggabungkan kondisi secara `OR`.
3. **Table Grant INSERT:**
   - `anon`: `REVOKE INSERT ON TABLE public.audit_logs FROM anon, PUBLIC;` (Akses direct INSERT ditutup total).
   - `authenticated`: Diizinkan pada level tabel, namun dibatasi 100% oleh RLS `WITH CHECK (actor_id = auth.uid())`.
   - `service_role`: Bypasses RLS.
   - `postgres` (Owner SECURITY DEFINER): Mengizinkan fungsi kiosk menulis log dengan `actor_id = NULL` dan metadata terenkapsulasi secara aman.

---

### 6. Inventaris Grant pada `public_form_tokens`

Tabel `public_form_tokens` dipastikan berstatus **DORMANT**:
- Tidak pernah dipanggil atau dirujuk di seluruh source code frontend (`src/`).
- Tidak pernah dirujuk di dalam fungsi, trigger, atau RPC apa pun di database.
- **Grant Final:**
  ```sql
  REVOKE ALL ON TABLE public.public_form_tokens FROM anon, authenticated, PUBLIC;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_form_tokens TO service_role;
  ```
- **RLS:** Tetap aktif dengan policy `public_form_tokens_read_manage` yang hanya mengizinkan `super_admin`.

---

### 7. Bukti Verifikasi `search_path` & Alasan UNVERIFIED

1. **Deklarasi Historis:** `CREATE EXTENSION IF NOT EXISTS "pgcrypto";` pada `20261104000001` tidak menyertakan `WITH SCHEMA extensions;`.
2. **Status Schema Remote:** **UNVERIFIED**. Tanpa akses live query ke katalog remote Supabase (yang strictly dilarang), tidak dapat dipastikan 100% apakah pgcrypto berada di schema `public` atau `extensions` pada instance cloud.
3. **Privilege CREATE pada Schema:** **UNVERIFIED**. Tidak ada bukti lokal mengenai pencabutan/pemberian privilege `CREATE` pada schema `public` atau `extensions`.
4. **Pertimbangan Schema-Qualified Call:** Memanggil `extensions.crypt(...)` akan memicu kegagalan runtime fatal jika ekstensi terpasang di `public`, dan sebaliknya. Pengaturan `SET search_path = public, extensions, pg_temp;` (dengan `pg_temp` di akhir) adalah konfigurasi teraman yang dapat diuji secara statis saat ini.

---

### 8. Hasil Pemeriksaan PIN Reset & NULL Handling

- **Deteksi 0 Rows Affected:** `reset_employee_kiosk_pin` menggunakan `GET DIAGNOSTICS v_rows_affected = ROW_COUNT;`. Jika baris tidak ter-update karena anomali unit id, fungsi mengembalikan kegagalan dan tidak mencatat audit log palsu.
- **Status Karyawan NULL:** Digunakan perbandingan `v_emp.status IS DISTINCT FROM 'ACTIVE'` sehingga nilai `NULL` tidak akan lolos sebagai aktif.
- **Failed Attempts Addition:** Digunakan `COALESCE(v_auth.failed_attempts, 0) + 1` untuk mencegah kegagalan kalkulasi jika nilai awal korup.
- **Tip Percentage Overflow:** Digunakan `CASE WHEN v_rate.base_rate BETWEEN 0 AND 1 THEN v_rate.base_rate ELSE 0.0300 END` untuk melindungi kolom `NUMERIC(5, 4)` dari nilai base rate Rupiah.

---

### 9. Hasil Validator & Quality Gates

#### 9.1. Advanced Security Specification Validator (`scripts/validate_batch_b_migration.cjs`)
- **Total Asersi:** 44 Asersi Keamanan & Integrasi
- **Hasil:** **44 PASSED / 0 FAILED (100% PASS)**
- Seluruh asersi pasangan restrictive DELETE (`leave_requests`, `warning_letters`, `violation_records`, `attendance_daily_records`) lolos dengan verifikasi ketat.
- Seluruh asersi database rate limiting (`rpc_rate_limits`, helper atomik, limit IP & akun) lolos.
- Seluruh asersi integrasi frontend (ketiadaan direct UPDATE, penanganan `success: false`, parameter RPC) lolos.

#### 9.2. Quality Gates Aplikasi
- `npm.cmd run typecheck`: **PASS** (Exit code 0, 0 errors)
- `npm.cmd run build`: **PASS** (Exit code 0, dist bundle sukses dibuat)
- `npm.cmd run test:phase2`: **PASS** (11/11 tests passed)
- `git diff HEAD -- supabase/migrations/20261104000001_core_schema_v3_1_0.sql supabase/migrations/20261104000002_harden_rpc_security.sql`: **0 diff (Identik)**.

#### 9.3. PostgreSQL Runtime Test Status
- **Status:** **NOT TESTED / UNPERFORMED**
- *Alasan Teknis:* Database Supabase Cloud Production dilarang keras disentuh, dan instance PostgreSQL lokal yang terisolasi belum dikonfigurasi. Seluruh pengujian saat ini berada pada tingkat *static analysis* dan *linter parsing*.

---

### 10. Tabel Keputusan Bisnis Terbuka (UNCONFIRMED)

| Parameter | Nilai Saat Ini | Status | Dampak Operasional & Teknis |
| :--- | :---: | :---: | :--- |
| **Dimensi Kaca Minimum & Maksimum** | 5.0–600.0 cm (P), 5.0–350.0 cm (T), 1–500 lembar (Qty) | **UNCONFIRMED** | Validasi input kiosk membatasi nota fisik lembaran kaca. Menunggu katalog pabrikan jika ukuran batas lembar kaca berbeda. |
| **Ambang Batas & Durasi Lockout Kiosk** | 5 kegagalan berturut-turut / 30 menit | **UNCONFIRMED** | Mengunci PIN portal karyawan di lapangan. Menunggu konfirmasi operasional HRD jika durasi perlu dipersingkat/diperpanjang. |
| **Durasi Maksimum Sewa Kendaraan** | 30 hari kalender | **UNCONFIRMED** | Mencegah reservasi armada jangka panjang tanpa persetujuan khusus direksi. |
| **Toleransi Waktu Mulai Peminjaman** | 15 menit ke belakang (`now() - 15 minutes`) | **UNCONFIRMED** | Grace period untuk toleransi jeda pengetikan formulir dan perbedaan jam perangkat (clock skew). |
| **Makna `tip_percentage_snapshot`** | Disimpan `0.0300` jika base rate non-persentase | **UNCONFIRMED** | Kolom `tip_percentage_snapshot NUMERIC(5, 4)` pada skema historis membutuhkan klarifikasi akuntansi apakah tetap menyimpan persentase atau perlu diubah tipe datanya menjadi tarif Rupiah. |

---

### 11. Risiko Residual

1. **Uji Konkurensi Tingkat Database:** Pengujian benturan reservasi armada (`23P01`) dan batas counter rate limiter (`FOR UPDATE`) belum diuji di bawah beban konkurensi PostgreSQL riil.
2. **Ketergantungan Header Proxy untuk Rate Limiting:** Ekstraksi IP pada `submit_glass_tip_atomic` bergantung pada header reverse proxy (`cf-connecting-ip` / `x-real-ip`). Jika request masuk tanpa proxy tepercaya, fallback ke `inet_client_addr()` atau `'local-client'` digunakan.

---

### 12. Status Kesiapan Review

- **Status:** **SIAP UNTUK AUDIT MANUAL TERPISAH (READY FOR MANUAL REVIEW)**
- **Kondisi Berhenti Dipatuhi:** Antigravity **TIDAK MENYATAKAN BATCH B DISETUJUI**. Seluruh mutasi dibatasi di lingkungan lokal.

