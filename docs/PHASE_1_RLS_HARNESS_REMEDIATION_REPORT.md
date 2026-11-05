# PHASE 1 — RLS HARNESS DESIGN REMEDIATION REPORT
## KUK MANAGEMENT SYSTEM v3.1.0

**Tanggal Dokumen:** 2026-11-05  
**Auditor:** Antigravity Autonomous Agent  
**Target Environment:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — PostgreSQL 17.11.0.011  
**Target File Desain:** [`scripts/test_rls_security_harness.sql`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/scripts/test_rls_security_harness.sql)  
**Status Evaluasi:** **`DESIGN REMEDIATION BLOCKED — ADDITIONAL INVESTIGATION REQUIRED`**  
**Tujuan Dokumen:** Melaporkan hasil audit keselamatan mendalam terhadap rancangan *In-Session Ephemeral Test Harness*, mengidentifikasi cacat desain, menyajikan perbaikan teknis, serta menetapkan batas kelayakan eksekusi pada database Production.

---

## 1. DAFTAR MASALAH LAMA & PERBAIKANNYA (TASK 2)

Audit keselamatan terhadap naskah awal `test_rls_security_harness.sql` mengidentifikasi 6 kelemahan desain fundamental:

### A. Masalah Auth Fixture (Penulisan Langsung ke `auth.users`)
- **Cacat Desain Lama:** Naskah awal mengasumsikan bahwa melakukan `INSERT` langsung ke `auth.users` aman selama dibungkus dalam blok `BEGIN ... ROLLBACK;`.
- **Analisis Risiko Nyata:**
  1. `auth.users` adalah tabel internal engine yang dikelola secara eksklusif oleh daemon GoTrue. Penulisan SQL langsung melompati siklus hidup identitas, salting bcrypt, dan instance binding.
  2. Meskipun di-rollback, operasi `INSERT` memperoleh *row/table lock* pada tabel `auth.users`. Jika ada pengguna riil yang melakukan login pada milidetik yang sama, transaksi login dapat mengalami *lock wait* atau kegagalan serialisasi.
  3. **Kesimpulan:** Tidak ada jaminan mutlak bahwa operasi ke skema `auth` di Production bebas dari efek samping. **Penulisan langsung ke `auth.users` pada Production diklasifikasikan sebagai `NOT SAFE`.**
- **Perbaikan:** Seluruh skenario yang memerlukan akun terautentikasi ditandai sebagai **`BLOCKED`** pada Production dan dialihkan ke lingkungan terisolasi.

### B. Masalah Role & JWT Simulation
- **Cacat Desain Lama:** Naskah mengasumsikan perintah `PERFORM set_config('role', 'authenticated', true)` dapat dipanggil secara bebas bolak-balik di dalam satu blok PL/pgSQL `DO`.
- **Temuan Empiris PostgreSQL:**
  1. Pengujian live membuktikan bahwa `set_config('role', 'authenticated', true)` melempar error:
     ```text
     ERROR: 42501: permission denied to set role "authenticated"
     ```
     karena role session (`supabase_read_only_user`) tidak memiliki hak keanggotaan pada role `authenticated`.
  2. Bahkan jika dijalankan sebagai superuser `postgres`, sekali role dialihkan menjadi `authenticated` (non-superuser), role tersebut **kehilangan wewenang untuk berganti peran kembali** (`SET ROLE anon` atau `RESET ROLE`) di dalam sesi yang sama.
  3. Mengatur `request.jwt.claim.sub` saat role masih `postgres` **TIDAK MENEGAKKAN RLS**, karena superuser `postgres` memiliki atribut bawaan `BYPASSRLS` pada tabel yang tidak memiliki `FORCE ROW LEVEL SECURITY`.
- **Perbaikan:** Menegaskan secara eksplisit dalam dokumentasi bahwa simulasi multi-role sequential di dalam satu blok DO adalah **cacat arsitektur PostgreSQL**. Uji coba multi-aktor mewajibkan koneksi terpisah per aktor (seperti pada PostgREST).

### C. Masalah Hak Akses Tabel Hasil Sementara (`temp_rls_test_results`)
- **Cacat Desain Lama:** Tabel sementara dibuat oleh `postgres`, kemudian saat role diuji sebagai `authenticated` atau `anon`, kueri mencoba melakukan `INSERT INTO temp_rls_test_results`.
- **Analisis:** Role `authenticated` dan `anon` tidak memiliki hak `INSERT` pada tabel sementara yang dibuat oleh `postgres`. Hal ini akan memicu error `42501: permission denied for table temp_rls_test_results`, menggagalkan pencatatan pengujian sebelum RLS dievaluasi.
- **Perbaikan:** Ditambahkan perintah eksplisit:
  ```sql
  GRANT ALL ON temp_rls_test_results TO PUBLIC, anon, authenticated;
  ```
  sebelum pengujian dimulai.

### D. Masalah Integritas Fixture (Relasi FK yang Rusak)
- **Cacat Desain Lama:**
  1. Pada `glass_tips`, kolom `glass_type_id` diisi `gen_random_uuid()`. Padahal constraint `fk_tip_glass_type` mewajibkan `FOREIGN KEY (unit_id, glass_type_id) REFERENCES glass_types(unit_id, id)`. Hal ini pasti memicu error `23503 foreign_key_violation`.
  2. Nama kolom `glass_tips` pada naskah lama menggunakan nama kolom fiktif (`transaction_number`, `width_mm`, `length_mm`), padahal skema kanonikal v3.1.0 menggunakan `reference_code`, `length_cm`, `height_cm`, `calculated_sqm`, `glass_price_snapshot`.
  3. Pada `leave_requests`, kolom snapshot wajib (`snapshot_employee_name`, `snapshot_department_name`, `snapshot_position_title`) tidak disertakan.
- **Perbaikan:** Memperbaiki seluruh naskah fixture agar 100% patuh terhadap skema kanonikal, menyertakan tabel induk `glass_types`, dan menambahkan blok validasi integritas pra-pengujian (*Pre-Flight Fixture Assertion*).

### E. Masalah Klasifikasi Error (False Positive pada Error Catching)
- **Cacat Desain Lama:** Pada pengujian `RLS-11` dan `RLS-12` (Immutability trigger), naskah menangkap `EXCEPTION WHEN OTHERS THEN ... status = 'PASS'`. Hal ini menyebabkan error apapun (termasuk syntax error atau tabel hilang) dianggap lolos sebagai bukti trigger bekerja.
- **Perbaikan:** Validasi error diperketat secara presisi:
  ```sql
  EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_code = 'P0001' AND v_err_msg ILIKE '%Audit log bersifat immutable%' THEN
          -- BARU DINYATAKAN PASS
      ELSE
          -- DINYATAKAN FAIL / WRONG ERROR
      END IF;
  ```
  Dan membedakan secara tegas antara penolakan RLS (`WITH CHECK policy violation`), penolakan hak SQL GRANT (`permission denied for table`), dan penolakan constraint.

### F. Masalah Validasi Positive-Control
- **Cacat Desain Lama:** Kueri yang menghasilkan `0 rows` langsung dianggap `PASS`, padahal jika data fixture gagal disisipkan, kueri juga menghasilkan 0 baris (*Tautological Pass*).
- **Perbaikan:** Menerapkan **Positive-Control Validation**:
  Sebelum membuktikan bahwa Aktor A tidak dapat melihat data Unit B, sistem wajib membuktikan terlebih dahulu bahwa data Unit B **benar-benar ada dan dapat dibaca oleh pemiliknya (Aktor B)**.

---

## 2. EVALUASI METODE EKSEKUSI (`supabase db query --remote`) (TASK 4)

Pemeriksaan mendalam terhadap perilaku tool CLI membuktikan bahwa pendekatan in-session rollback **TIDAK DAPAT DIJALANKAN SECARA HEADLESS DI PRODUCTION**:

1. **Penolakan Flag `--read-only`:**
   Perintah `npx supabase db query --remote --read-only` secara mutlak menolak pernyataan `BEGIN`, `COMMIT`, `SET`, dan DML sementara:
   ```text
   DbQueryReadOnlyStatementError: --read-only only allows SELECT, WITH, VALUES, TABLE, SHOW, EXPLAIN statements (found: BEGIN)
   ```
2. **Prompt Konfirmasi Interaktif pada Hosted Database:**
   Jika flag `--read-only` dihilangkan, Supabase CLI mendeteksi pernyataan sebagai operasi tulis dan menghentikan eksekusi untuk meminta konfirmasi interaktif manual:
   ```text
   Drop --read-only to run this statement; a hosted database then asks you to confirm the write.
   ```
   Hal ini menghalangi eksekusi otomatis tanpa intervensi manusia.
3. **Pemberian Hasil Kueri Sebelum `ROLLBACK`:**
   Pada protokol PostgreSQL, sebuah payload multi-statement yang diakhiri `ROLLBACK;` hanya akan mengembalikan respon dari pernyataan terakhir (`ROLLBACK`). Hasil kueri `SELECT * FROM temp_rls_test_results` yang dijalankan sebelum rollback akan dibuang oleh adapter HTTP.
4. **Kesimpulan Eksekusi:** **`BLOCKED`**. Metode eksekusi transactional rollback tidak dapat diverifikasi secara aman menggunakan tool yang tersedia di Production.

---

## 3. AUDIT ULANG 18 SKENARIO UJI RLS (TASK 3)

Berikut dokumentasi mendalam 18 skenario RLS:

| ID | Tujuan Uji | Aktor | Fixture yang Dibutuhkan | Hak SQL Minimum | Policy/Trigger yang Diuji | Hasil yang Diharapkan | Risiko False Positive | Status Kelayakan Saat Ini |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **RLS-01** | Buktikan Admin La Tansa membaca karyawan unitnya | Admin La Tansa (`a0...03`) | Unit & Emp La Tansa | `SELECT` on `employees` | `employees_read_unit` | ALLOW (>0 rows) | Fixture La Tansa tidak ada (menghasilkan 0 rows) | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-02** | Buktikan Admin La Tansa terisolasi dari karyawan Palen | Admin La Tansa (`a0...03`) | Emp Palen | `SELECT` on `employees` | `employees_read_unit` | DENY (0 rows) | Emp Palen memang tidak ada (0 rows tautologis) | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-03** | Buktikan Admin La Tansa ditolak menambah karyawan Palen | Admin La Tansa (`a0...03`) | Unit Palen | `INSERT` on `employees` | `employees_insert_unit` | REJECT (42501 RLS) | Ditolak karena FK salah, bukan karena RLS | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-04** | Buktikan Admin La Tansa ditolak mengubah karyawan Palen | Admin La Tansa (`a0...03`) | Emp Palen | `UPDATE` on `employees` | `employees_update_unit` | REJECT (0 rows) | Emp Palen tidak ada sehingga 0 rows ter-update | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-05** | Buktikan Admin Palen terisolasi dari cuti La Tansa | Admin Palen (`a0...04`) | Leave La Tansa | `SELECT` on `leave_requests` | `leave_requests_read` | DENY (0 rows) | Cuti La Tansa tidak ada (0 rows tautologis) | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-06** | Buktikan Admin Palen ditolak mengubah tip kaca La Tansa | Admin Palen (`a0...04`) | Tip La Tansa | `UPDATE` on `glass_tips` | `glass_tips_manage` | REJECT (0 rows) | Tip La Tansa tidak ada | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-07** | Buktikan Kasir ditolak membaca slip gaji | Kasir La Tansa (`a0...05`) | Slip La Tansa | `SELECT` on `payroll_records` | `payroll_records_read` | DENY (0 rows) | Slip La Tansa tidak ada | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-08** | Buktikan Kasir ditolak membaca gaji pokok/rekening | Kasir La Tansa (`a0...05`) | Sensitive La Tansa | `SELECT` on `employee_sensitive_data` | `employee_sensitive_read`| DENY (0 rows) | Sensitive data tidak ada | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-09** | Buktikan Kasir ditolak membaca rekaman audit | Kasir La Tansa (`a0...05`) | Audit Log row | `SELECT` on `audit_logs` | `audit_logs_read` | DENY (0 rows) | Audit log kosong | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-10** | Buktikan Admin La Tansa diizinkan membaca slip unitnya | Admin La Tansa (`a0...03`) | Slip La Tansa | `SELECT` on `payroll_records` | `payroll_records_read` | ALLOW (>0 rows) | Slip La Tansa tidak ada (gagal padahal sah) | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-11** | Buktikan Super Admin ditolak mengubah audit log | Super Admin (`a0...01`) | 1 Baris Audit | `UPDATE` on `audit_logs` | Trigger `trg_protect_audit_logs` | REJECT (P0001) | Menangkap syntax error via WHEN OTHERS | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-12** | Buktikan Super Admin ditolak menghapus audit log | Super Admin (`a0...01`) | 1 Baris Audit | `DELETE` on `audit_logs` | Trigger `trg_protect_audit_logs` | REJECT (P0001) | Menangkap syntax error via WHEN OTHERS | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-13** | Buktikan Admin Unit ditolak hard delete karyawan | Admin La Tansa (`a0...03`) | Emp La Tansa | `DELETE` on `employees` | Policy `employees_delete_deny` | REJECT (42501/0 rows) | Karyawan tidak ada sehingga 0 rows terhapus | **BLOCKED (Requires Fixture & Auth)** |
| **RLS-14** | Buktikan anonim ditolak membaca organisasi | Anonim (`role=anon`) | Organisasi | `SELECT` on `organizations` | `organizations_read_authenticated`| DENY (0 rows) | Organisasi kosong (0 rows tautologis, tidak konklusif) | **INCONCLUSIVE (Zero-State Empty Table)** |
| **RLS-15** | Buktikan anonim ditolak membaca karyawan | Anonim (`role=anon`) | Karyawan | `SELECT` on `employees` | `employees_read_unit` | DENY (0 rows) | Tabel karyawan kosong (0 rows tautologis, tidak konklusif) | **INCONCLUSIVE (Zero-State Empty Table)** |
| **RLS-16** | Buktikan anonim dapat melihat kendaraan AVAILABLE | Anonim (`role=anon`) | Veh AVAILABLE | `SELECT` on `vehicles` | `vehicles_read_anon` | ALLOW (>0 rows) | Tabel kendaraan kosong (gagal padahal sah) | **BLOCKED (Requires Vehicle AVAILABLE Fixture)** |
| **RLS-17** | Buktikan anonim tidak dapat melihat kendaraan MAINTENANCE | Anonim (`role=anon`) | Veh MAINT | `SELECT` on `vehicles` | `vehicles_read_anon` | DENY (0 rows) | Tabel kendaraan kosong | **BLOCKED (Requires Vehicle MAINTENANCE Fixture)** |
| **RLS-18** | Buktikan anonim ditolak menambah organisasi | Anonim (`role=anon`) | *(None)* | `INSERT` on `organizations` | RLS No Policy (`WITH CHECK`) | REJECT (42501) | Operasi tulis dilarang pada audit read-only | **BLOCKED (Write Prohibited in Read-Only Audit)** |

---

## 4. KLASIFIKASI KELAYAKAN PENGUJIAN (TERKOREKSI)

Klasifikasi diperbarui secara ketat sesuai prinsip zero-assumptions dan limitasi database zero-state:

- **`PASS` (0 Skenario):**  
  Tidak ada skenario yang diklaim lulus (*PASS*). Sesuai standar audit keinsinyuran, status PASS hanya boleh disematkan jika pengujian telah dieksekusi secara nyata dan menghasilkan bukti empiris dengan data kontrol positif.
- **`INCONCLUSIVE` (2 Skenario: RLS-14, RLS-15):**  
  Pengujian akses pembacaan anonim terhadap `organizations` dan `employees` mengembalikan `count = 0`. Namun, karena kedua tabel tersebut saat ini berstatus *zero-state* (0 baris), hasil tersebut tidak dapat membedakan apakah data disaring oleh RLS atau semata-mata karena tabel kosong. Klasifikasi `PASS-ELIGIBLE` telah dihapus seluruhnya.
- **`BLOCKED (DATA / FIXTURE REQUIRED)` (15 Skenario: RLS-01 s/d RLS-13, RLS-16, RLS-17):**  
  - Skenario `RLS-01` s/d `RLS-13` memerlukan akun uji terautentikasi (`auth.users`) dan baris multi-tenant (*positive controls*).
  - Skenario `RLS-16` dan `RLS-17` memerlukan data armada riil berstatus `AVAILABLE` dan `MAINTENANCE`.
- **`BLOCKED (WRITE PROHIBITED)` (1 Skenario: RLS-18):**  
  Pengujian mutasi `INSERT` oleh anonim dilarang dieksekusi pada database Production aktif.

Rencana pengujian kueri inspeksi katalog sistem selengkapnya didokumentasikan pada:  
[`docs/PHASE_1_RLS_READ_ONLY_VERIFICATION_PLAN.md`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/PHASE_1_RLS_READ_ONLY_VERIFICATION_PLAN.md).

---

## 5. KESIMPULAN & REKOMENDASI LINGKUNGAN PENGUJIAN

1. **Production Database Tidak Boleh Digunakan untuk Uji Coba Transaksional:**  
   Mengingat database Production berstatus aktif (*zero-state*) dan tidak memiliki fasilitas rollback batch non-interaktif yang aman, **eksekusi `test_rls_security_harness.sql` pada Production DILARANG MUTLAK**.
2. **Pengalihan ke Rencana Verifikasi Read-Only:**  
   Pendekatan in-session write harness dibatalkan untuk Production. Verifikasi dialihkan sepenuhnya ke audit katalog dan simulasi PostgREST GET yang aman sesuai dokumen:  
   [`docs/PHASE_1_RLS_READ_ONLY_VERIFICATION_PLAN.md`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/PHASE_1_RLS_READ_ONLY_VERIFICATION_PLAN.md).
3. **Rekomendasi Lingkungan Terisolasi untuk 13 Skenario Terotentikasi:**  
   Untuk membuktikan 13 skenario terotentikasi (`RLS-01` s/d `RLS-13`) dan mutasi `RLS-18`, organisasi disarankan memilih salah satu dari dua jalur resmi:
   - **Jalur A (Supabase Branching):** Mengaktifkan fitur branching pada project untuk membuat database staging terisolasi sementara.
   - **Jalur B (Supabase Local Docker):** Menjalankan skema migrasi pada environment Supabase lokal di mana penulisan fixture ke `auth.users` dapat dijalankan 100% tanpa risiko terhadap Production.

---

### KESIMPULAN STATUS AKHIR:
### **`RLS VERIFICATION PLAN APPROVED FOR READ-ONLY EXECUTION REVIEW — NOT EXECUTED`**

> **Pernyataan Integritas:** Sesuai batasan mutlak, **TIDAK ADA skrip pengujian yang dieksekusi**, tidak ada perintah INSERT/UPDATE/DELETE fisik yang dikirim ke Supabase Production, dan database Production tetap terjaga murni dalam status zero-state.

