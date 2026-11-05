# PHASE 1 — LIVE SECURITY TESTING PREPARATION
## SAFE RLS TESTING FEASIBILITY AUDIT & EXECUTION STRATEGY
### KUK MANAGEMENT SYSTEM v3.1.0

**Tanggal Dokumen:** 2026-11-05  
**Auditor:** Antigravity Autonomous Agent  
**Target Environment:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — PostgreSQL 17.11.0.011  
**Status Evaluasi:** **`SAFE RLS TESTING STRATEGY — REVIEW REQUIRED`**  
**Kondisi Baseline:**
- 60 tabel operasional public berstatus **murni 0 rows (zero-state)**.
- 0 pengguna terdaftar pada `auth.users`.
- 0 bucket pada `storage.buckets`.
- Migrasi canonical `20261104000001` dan remediasi `20261104000002` berstatus **`APPLIED & VERIFIED`**.
- Tidak tersedia project Supabase staging terpisah (single-project constraint).
- **Pengguna belum memberikan izin pembuatan akun Auth riil maupun penyuntikan data.**

---

## 1. AUDIT ARSITEKTUR RLS & DILEMA ZERO-STATE (TASK 1)

Pemeriksaan komparatif dilakukan terhadap seluruh 60 tabel dan 107 kebijakan RLS di skema database v3.1.0:

### 1.1. Dependensi RLS Helper Functions
Seluruh kebijakan RLS yang mengatur pemisahan horizontal (multi-tenant unit) dan vertikal (RBAC) bergantung secara mutlak pada 3 fungsi helper:
1. `has_system_role(p_role_code)`:
   ```sql
   SELECT EXISTS (
       SELECT 1 FROM user_system_roles usr 
       JOIN roles r ON usr.role_id = r.id 
       WHERE usr.user_id = auth.uid() AND r.code = p_role_code
   );
   ```
2. `has_unit_access(p_unit_id)`:
   ```sql
   SELECT has_system_role('super_admin') OR has_system_role('admin_pusat') OR EXISTS (
       SELECT 1 FROM user_unit_roles uur 
       WHERE uur.user_id = auth.uid() AND uur.unit_id = p_unit_id
   );
   ```
3. `has_unit_permission(p_unit_id, p_permission_code)`:
   ```sql
   SELECT has_system_role('super_admin') OR EXISTS (
       SELECT 1 FROM user_unit_roles uur 
       JOIN role_permissions rp ON uur.role_id = rp.role_id 
       JOIN permissions p ON rp.permission_id = p.id 
       WHERE uur.user_id = auth.uid() AND uur.unit_id = p_unit_id AND p.code = p_permission_code
   ) OR EXISTS (... user_system_roles ...);
   ```

### 1.2. Dilema Metodologis: "Tautological Pass" pada Zero-State Database
Dalam kondisi database kosong (0 rows di seluruh tabel):
- Jika kita mengeksekusi: `SELECT * FROM employees WHERE unit_id = '<palen-id>';`
- Kueri akan mengembalikan **0 rows (Empty Array)**.
- **Masalah Kritis:** Apakah 0 rows tersebut terjadi karena *kebijakan RLS berhasil memblokir akses pengguna*, atau semata-mata karena *tabelnya memang tidak memiliki data*?
- Jika kueri mengembalikan 0 rows karena tabel kosong, pengujian tersebut adalah **False Positive / Tautological Pass** yang tidak membuktikan efektivitas RLS di dunia nyata.
- **Kesimpulan Task 1:**
  - Pengujian isolasi data `SELECT` (membaca data La Tansa vs Palen) **MUSTAHIL DIBUKTIKAN SECARA SUBSTANTIF** tanpa adanya data fisik yang menjadi sasaran pembacaan.
  - Sebaliknya, pengujian `INSERT` penolakan (misal Admin La Tansa mencoba menambah karyawan di Palen) dapat diuji tanpa data awal karena kebijakan `WITH CHECK` langsung mengevaluasi klausa izin sebelum data ditulis. Namun jika pengujian `INSERT` positif diuji (misal Admin La Tansa menambah karyawan La Tansa), pengujian tersebut **AKAN MENINGGALKAN BARIS DATA** jika tidak di-rollback.

---

## 2. EVALUASI EMPAT METODE PENGUJIAN (TASK 2)

| Kriteria Evaluasi | Metode A: SQL Transaction (`BEGIN ... ROLLBACK`) | Metode B: Session Simulation (`SET LOCAL ROLE` + JWT Claims) | Metode C: Supabase Auth (Akun Nyata di `auth.users`) | Metode D: Supabase Client / PostgREST via HTTP |
| :--- | :--- | :--- | :--- | :--- |
| **Deskripsi Teknis** | Menjalankan seluruh pengujian dalam satu blok transaksi atomik yang diakhiri `ROLLBACK;`. | Mensimulasikan konteks sesi via `SET LOCAL ROLE authenticated;` dan `SELECT set_config('request.jwt.claim.sub', '<uuid>', true);`. | Mendaftarkan 5 akun uji khusus di `auth.users` dan menghubungkannya ke `profiles` & `user_unit_roles`. | Menginisialisasi `createClient()` dengan token JWT asli dan mengirim request REST/GraphQL ke PostgREST. |
| **Apa yang Bisa Dibuktikan?** | Logika evaluasi RLS di tingkat engine PostgreSQL, constraint integritas, dan trigger keamanan. | Evaluasi ekspresi RLS dan helper permissions untuk UUID pengguna tertentu tanpa login fisik. | Alur login autentikasi end-to-end (GoTrue, password hashing bcrypt, refresh token, session persistence). | Perilaku nyata aplikasi: PostgREST HTTP status codes (200, 401, 403, 42501), header, dan serialisasi JSON. |
| **Apa yang TIDAK Bisa Dibuktikan?** | Tidak bisa membuktikan integrasi API PostgREST, header HTTP, token expiry, dan alur SDK frontend. | Tidak bisa membuktikan verifikasi kriptografi signature JWT oleh PostgREST dan middleware Auth. | Tidak membuktikan isolasi data jika data multi-tenant (La Tansa vs Palen) tidak di-seed. | Tidak bisa membatalkan (*rollback*) mutasi secara otomatis per request HTTP REST. |
| **Risiko Perubahan Permanen pada Production** | **0% (NOL)** — Seluruh mutasi di-rollback seketika di akhir transaksi. | **0% (NOL)** — Bersifat lokal pada sesi transaksi bersangkutan. | **TINGGI** — Menyuntikkan baris permanen di tabel `auth.users` & `auth.identities` Production. | **TINGGI** — Setiap panggilan `INSERT` atau `UPDATE` yang berhasil akan tersimpan permanen di Production. |
| **Keamanan pada Production** | **SANGAT AMAN** jika dieksekusi dalam single-statement batch script dengan `ROLLBACK` terjamin. | **SANGAT AMAN** jika dikombinasikan dengan Metode A (`SET LOCAL`). | **BERISIKO** — Mengotori zero-state database Production dan memicu log Auth. | **BERISIKO TINGGI** — Mengharuskan proses cleanup manual pasca-uji yang rentan residu. |
| **Kesesuaian Skenario** | Cocok untuk validasi matematis kebijakan RLS engine. | Cocok untuk validasi matriks wewenang RBAC. | Wajib untuk pengujian UI frontend dan login riil. | Wajib untuk uji integrasi API/REST pasca-seeding. |

---

## 3. AUDIT TRANSACTION SAFETY & BATASAN ALAT (TASK 3)

Pemeriksaan mendalam terhadap mekanisme `BEGIN` / `ROLLBACK` menggunakan alat yang tersedia (`npx supabase db query --remote`):

### 3.1. Karakteristik Tool `supabase db query --remote`
- Perintah CLI `supabase db query --remote` mengirimkan seluruh naskah SQL sebagai **satu batch transaksi tunggal** ke PostgreSQL engine.
- Jika sebuah naskah diawali dengan `BEGIN;` dan diakhiri dengan `ROLLBACK;`, engine PostgreSQL menjamin bahwa:
  1. Baris data yang di-insert untuk keperluan uji coba (unit, role, data karyawan) **hanya terlihat di dalam transaksi tersebut**.
  2. Seluruh mutasi dibuang seketika saat `ROLLBACK;` dieksekusi.
  3. Status database remote kembali murni 0 rows pasca-eksekusi.

### 3.2. Penanganan `SET LOCAL ROLE` & JWT Claims
- Di PostgreSQL, perintah:
  ```sql
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  ```
  menggunakan parameter `true` (is_local). Artinya, variabel sesi ini **hanya berlaku selama transaksi berlangsung** dan otomatis ter-reset saat transaksi berakhir (`COMMIT` atau `ROLLBACK`).
- **Keamanan Connection Pooling:** Karena menggunakan `SET LOCAL`, pengaturan ini tidak akan bocor (*session leakage*) ke koneksi lain di pooler (PgBouncer/Supavisor).

### 3.3. Batasan Mutlak Transaksi yang TIDAK Dapat Di-Rollback
Terdapat 2 operasi yang memiliki efek samping permanen di PostgreSQL meskipun berada di dalam blok `ROLLBACK`:
1. **Penomoran Sekuensial Dokumen (`generate_document_number_atomic`):**
   Fungsi ini memodifikasi tabel `document_sequences`. Namun jika dipanggil di dalam transaksi yang di-rollback, baris tabel `document_sequences` ikut ter-rollback. Tetapi jika memanggil `nextval()` dari objek sequence PostgreSQL native, sequence counter tidak pernah mundur.
2. **Akun Supabase Auth (`auth.users`):**
   Tabel `auth.users` dikelola oleh skema `auth`. Menulis ke `auth.users` via SQL langsung di Production sangat tidak disarankan karena bypass proses internal GoTrue webhooks.

### 3.4. Risiko Terputusnya Koneksi Jaringan
- Sesuai standar protokol PostgreSQL, jika koneksi klien terputus mendadak (*network drop / timeout*) sebelum `COMMIT;` diterima, PostgreSQL **SECARA OTOMATIS MENGEKSEKUSI ROLLBACK**. Tidak ada risiko transaksi menggantung dalam status commit parsial.

---

## 4. TEST MATRIX: 18 SKENARIO RLS & STATUS KELAYAKAN (TASK 4)

Berikut adalah audit kelayakan per skenario dari `docs/PHASE_1_RLS_SECURITY_TEST_PLAN.md` dalam kondisi database Production zero-state:

| ID Test | Sasaran & Skenario | Operasi | Kebutuhan Auth User | Kebutuhan Data Uji | Risiko Production | Bisa Diuji Tanpa Persistent Write? | Status Kelayakan |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **RLS-01** | Admin La Tansa membaca karyawan La Tansa | `SELECT` | `admin_latansa` | Unit & Karyawan La Tansa | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-02** | Admin La Tansa membaca karyawan Palen | `SELECT` | `admin_latansa` | Unit & Karyawan Palen | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-03** | Admin La Tansa menambah karyawan di Palen | `INSERT` | `admin_latansa` | Unit Palen | Rendah | Ya (Langsung REJECT RLS) | **READY (In-Session Rollback)** |
| **RLS-04** | Admin La Tansa mengubah karyawan di Palen | `UPDATE` | `admin_latansa` | Unit & Karyawan Palen | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-05** | Admin Palen membaca cuti di La Tansa | `SELECT` | `admin_palen` | Cuti di La Tansa | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-06** | Admin Palen mengubah tip kaca di La Tansa | `UPDATE` | `admin_palen` | Tip Kaca di La Tansa | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-07** | Operator Kasir membaca payroll La Tansa | `SELECT` | `operator_latansa`| Payroll La Tansa | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-08** | Operator Kasir membaca data gaji rahasia | `SELECT` | `operator_latansa`| Sensitive Data La Tansa | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-09** | Operator Kasir membaca audit log | `SELECT` | `operator_latansa`| Baris Audit Log | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-10** | Admin La Tansa membaca payroll La Tansa | `SELECT` | `admin_latansa` | Payroll La Tansa | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-11** | Super Admin mencoba UPDATE audit logs | `UPDATE` | `super_admin` | 1 Baris Audit Log | Nol | Ya (Ditolak Trigger) | **READY (In-Session Rollback)** |
| **RLS-12** | Super Admin mencoba DELETE audit logs | `DELETE` | `super_admin` | 1 Baris Audit Log | Nol | Ya (Ditolak Trigger) | **READY (In-Session Rollback)** |
| **RLS-13** | Admin Unit mencoba DELETE karyawan | `DELETE` | `admin_latansa` | 1 Karyawan La Tansa | Nol | Ya (Ditolak Policy Deny) | **READY (In-Session Rollback)** |
| **RLS-14** | Anonim membaca tabel organisasi | `SELECT` | *(None)* | Organisasi | Nol | Ya (Read-Only) | **READY (Live Read-Only)** |
| **RLS-15** | Anonim membaca tabel karyawan | `SELECT` | *(None)* | Karyawan | Nol | Ya (Read-Only) | **READY (Live Read-Only)** |
| **RLS-16** | Anonim membaca armada status AVAILABLE | `SELECT` | *(None)* | Armada AVAILABLE | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-17** | Anonim membaca armada status MAINTENANCE| `SELECT` | *(None)* | Armada MAINTENANCE | Rendah | Ya (via In-Session Rollback) | **NEEDS SAFE ENVIRONMENT** |
| **RLS-18** | Anonim mencoba INSERT organisasi baru | `INSERT` | *(None)* | *(None)* | Nol | Ya (Langsung REJECT 42501) | **READY (Live Reject)** |

---

## 5. REKOMENDASI STRATEGI PENGUJIAN PALING AMAN (TASK 5)

Berdasarkan fakta bahwa saat ini **hanya ada satu environment Production** dan **database masih berstatus murni 0 rows**:

### Opsi Rekomendasi 1 (SANGAT DIREKOMENDASIKAN):
**In-Session Ephemeral SQL Harness (Pure Transactional Rollback)**
- **Mekanisme:**
  Menyusun skrip pengujian SQL batch mandiri (`scripts/safe_in_session_rls_harness.sql`) yang dijalankan via `npx supabase db query --remote`:
  ```sql
  BEGIN;
  -- 1. Setup data master sementara (Unit La Tansa, Palen, Roles, Test Profiles)
  -- 2. Setup sample data transaksional (Karyawan La Tansa, Karyawan Palen, Audit Log)
  -- 3. Simulasi ACT-03 (Admin La Tansa): Buktikan SELECT La Tansa ada, SELECT Palen 0 rows, INSERT Palen REJECT.
  -- 4. Simulasi ACT-04 (Admin Palen): Buktikan UPDATE Tip La Tansa 0 rows.
  -- 5. Simulasi ACT-05 (Operator Kasir): Buktikan SELECT Payroll 0 rows, SELECT Sensitive 0 rows.
  -- 6. Simulasi ACT-01 (Super Admin): Buktikan UPDATE/DELETE audit_logs dilempar error P0001 oleh trigger.
  -- 7. KEMBALIKAN KEADAAN SEMULA SECARA MUTLAK:
  ROLLBACK;
  ```
- **Keunggulan:**
  1. Nol akun dibuat di `auth.users`.
  2. Nol data yang tertinggal di 60 tabel public (100% atomik dibuang oleh `ROLLBACK`).
  3. Membuktikan seluruh 18 skenario RLS secara empiris pada engine PostgreSQL Production tanpa risiko residu data kotor.

### Opsi Rekomendasi 2:
**Staging Branching via Supabase CLI**
- Menggunakan fitur Supabase Branching atau menduplikasi skema ke Supabase local/docker/staging terpisah jika suatu saat infrastruktur staging disediakan oleh organisasi.

---

## 6. HAL-HAL YANG BELUM BISA DIVERIFIKASI SEBELUM TAHAP BERIKUTNYA

1. **Integrasi Login Browser Frontend (GoTrue Client SDK):**  
   Pengujian alur login di form antarmuka web (`/login`) belum bisa diverifikasi secara end-to-end tanpa membuat setidaknya 1 akun pengguna riil di `auth.users`.
2. **PostgREST HTTP Status Serialization (200 vs 403 vs 42501):**  
   Pengujian via SQL `SET LOCAL ROLE` membuktikan penolakan di tingkat database, namun pembuktian bahwa PostgREST memetakan penolakan tersebut menjadi kode HTTP 403 / 42501 pada API browser membutuhkan token JWT nyata.
3. **Session Persistence & Expired Token Handling di Browser:**  
   Penyimpanan token JWT di `localStorage` dan alur *silent refresh* oleh Supabase Auth client belum dapat diuji di browser tanpa login aktif.

---

### KESIMPULAN & STATUS AKHIR:
### **`SAFE RLS TESTING STRATEGY — REVIEW REQUIRED`**

Laporan strategi ini menyajikan bukti bahwa **pengujian keamanan RLS multi-tenant dapat dieksekusi secara aman dan valid tanpa menyisakan data permanen di Production melalui metode In-Session Ephemeral Transaction (Opsi Rekomendasi 1)**.

Silakan pelajari dokumen strategi ini dan berikan arahan apakah Anda menyetujui penyusunan naskah skrip pengujian Opsi 1 (`BEGIN ... ROLLBACK`).

