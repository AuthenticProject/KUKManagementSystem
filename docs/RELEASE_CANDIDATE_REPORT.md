# KUK MANAGEMENT SYSTEM v3.1.0 — RELEASE CANDIDATE REPORT

**Project:** KUK Management System v3.1.0  
**Git Baseline:** `b77fc90`  
**Branch:** `main`  
**Evaluation Date:** November 2026  
**Final Release Candidate Verdict:** `READY FOR BUSINESS ACCEPTANCE`  
*(Catatan: Status ini BUKAN `READY FOR PRODUCTION` karena pengujian migrasi live database memerlukan lingkungan runtime PostgreSQL/Supabase yang terisolasi).*

---

## 1. RINGKASAN EKSEKUTIF

KUK Management System v3.1.0 telah berhasil difinalisasi sebagai **Release Candidate (RC)** yang stabil, aman, dan konsisten secara arsitektural. Seluruh perbaikan dari Fase 1A hingga Fase 1C.5 telah direkonsiliasi secara menyeluruh pada source code lokal.

### Kepatuhan Batasan Keamanan (Safety Boundaries):
- **Koneksi Supabase Production (`ckzciuybedefbsdfsexh`):** **TIDAK PERNAH DIAKSES** (Zero remote queries, Zero remote mutations).
- **Supabase Staging Project:** **TIDAK DIBUAT** (Sesuai instruksi untuk menjaga batas lokal).
- **Migrasi Historis Kanonikal:**
  - `supabase/migrations/20261104000001_core_schema_v3_1_0.sql` &rarr; **ZERO DIFF** (Identik 100% dengan baseline `b77fc90`).
  - `supabase/migrations/20261104000002_harden_rpc_security.sql` &rarr; **ZERO DIFF** (Identik 100% dengan baseline `b77fc90`).
- **Konfigurasi Environment (`.env`):** **ZERO DIFF** (Kredensial dan endpoint tidak tersentuh).
- **Public Leave Kiosk:** **TETAP DIBLOKIR SECARA AMAN** pada `PublicLeaveRequestPage.tsx` dengan banner peringatan resmi.
- **Migrasi Draf:** Dibiarkan berstatus **UNAPPLIED** pada disk lokal untuk deployment terencana.

---

## 2. STATUS VERDIK SISTEM

| Status Verifikasi | Keterangan |
| :--- | :--- |
| **READY FOR BUSINESS ACCEPTANCE** | **TERCAPAI (LULUS)** — Seluruh modul fungsional, antarmuka pengguna, kontrak frontend-backend, dan mitigasi keamanan lokal telah selesai dan teruji secara penuh. Sistem siap untuk uji penerimaan bisnis (User Acceptance Testing) oleh pemangku kepentingan. |
| **READY FOR PRODUCTION** | **DITANGGUHKAN** — Memerlukan eksekusi dan validasi runtime migrasi database `20261105000002` dan `20261106000001` pada lingkungan PostgreSQL/Supabase nyata sebelum roll-out produksi. |

---

## 3. CAKUPAN FITUR SIAP PAKAI (FEATURE READINESS)

Sistem mencakup 10 modul utama yang siap digunakan dengan isolasi multi-unit (La Tansa vs KUK Palen) dan otorisasi berbasis peran (RBAC):

1. **Dashboard & Analytics Eksekutif (`/`)**
   - KPI ringkasan operasional unit: Karyawan aktif, kehadiran hari ini, pengajuan cuti tertunda, tip potong kaca belum verifikasi, ketersediaan armada, dan pengeluaran kas.
   - Pembedaan konteks pandangan: Unit Lokal vs Kantor Pusat (Pusat View).

2. **Manajemen Karyawan & Data Sensitif (`/employees`)**
   - Manajemen siklus hidup karyawan: Active, Inactive, Suspended, Resigned, Terminated.
   - Perlindungan Anti-Hard-Delete: Penghapusan fisik baris diblokir secara mutlak (`RESTRICTIVE` policy).
   - Akses data sensitif (NIK, BPJS, Rekening Bank) terisolasi dengan otorisasi khusus `employees.view_sensitive` dan pencatatan audit log otomatis.
   - Reset PIN Kiosk (6 digit) dan riwayat mutasi jabatan.

3. **Presensi & Sesi Briefing Pagi (`/attendance`)**
   - Pencatatan presensi harian dengan standardisasi zona waktu Asia/Jakarta (WIB).
   - Log sesi briefing pagi (topik, pemateri, jumlah peserta).
   - Fitur koreksi presensi berbasis audit dan impor log mesin fingerprint.
   - Rekap bulanan presensi per karyawan untuk dasar penggajian.

4. **Pengajuan & Pengelolaan Cuti (`/leave`)**
   - Penegakan kuota maksimal 3 hari cuti per bulan per karyawan.
   - Validasi jendela pengajuan resmi: Dibuka tanggal 1 bulan sebelumnya dan ditutup tanggal 3 pada bulan cuti.
   - Deteksi konflik cuti otomatis berdasarkan kesamaan departemen dan tanggal.
   - Penyetujuan otomatis bagi pengajuan tanpa konflik; pengajuan berkonflik dialihkan ke status `PENDING` untuk persetujuan manual kepala unit.
   - Rekap cuti bulanan unit untuk integrasi HR.

5. **Kalkulasi & Verifikasi Tip Potong Kaca (`/glass-tips`)**
   - Input nota transaksi pemotongan kaca dengan perhitungan luas otomatis ($m^2$).
   - Penerapan tarif resmi per $m^2$ berdasarkan ketebalan dan jenis proses.
   - Batasan keamanan: Metode yang belum disahkan (Size Range, Hybrid) ditolak secara eksplisit.
   - Nota pemotongan wajib diverifikasi oleh Kasir / Checker sebelum masuk ke rekap payroll. Nota ditolak tidak akan pernah masuk ke perhitungan gaji.

6. **Pengelolaan & Peminjaman Armada (`/fleet`)**
   - Katalog kendaraan operasional dan pelacakan status (`AVAILABLE`, `BORROWED`, `MAINTENANCE`).
   - Pencegahan peminjaman bentrok jadwal menggunakan PostgreSQL exclusion constraint (`tsrange` overlap protection).
   - **Protokol Kelaikan Operasional Petugas**: Status pasca-pengembalian ditentukan langsung oleh petugas pemeriksa (`FIT` &rarr; `AVAILABLE`, `NEEDS_MAINTENANCE` &rarr; `MAINTENANCE`). Kendaraan tidak layak langsung dikunci dari peminjaman baru demi keselamatan.

7. **Pelanggaran & Penerbitan Surat Peringatan (`/violations`)**
   - Pencatatan poin pelanggaran kedisiplinan operasional per unit.
   - Penerbitan Surat Peringatan (SP 1, SP 2, SP 3, Teguran Lisan) sebagai catatan administratif transparan.
   - Tidak menimbulkan pemotongan upah sepihak atau penguncian operasional otomatis.

8. **Penggajian & Cetak Slip Gaji (`/payroll`)**
   - Pembentukan periode gaji bulanan per unit bisnis.
   - Imutabilitas periode gaji berstatus `FINALIZED` (dilindungi trigger database anti-mutasi).
   - Penarikan tip potong kaca yang terverifikasi secara akurat.
   - Cetak slip gaji formal karyawan yang merujuk pada snapshot final yang tidak dapat diubah.

9. **Pengeluaran Kas Operasional / Petty Cash (`/finance/cash-expenses`)**
   - Pencatatan pengeluaran kas harian unit (BBM, konsumsi briefing, perlengkapan, operasional).
   - Pemisahan pencatatan dari persetujuan: Semua pengeluaran baru berstatus awal `PENDING`.
   - Otorisasi pencairan dana hanya dapat disetujui atau ditolak oleh Kepala Toko / Manajemen dengan izin `finance.approve`.

10. **Pengaturan Sistem & Hak Akses RBAC (`/settings`)**
    - Konfigurasi unit bisnis, peran pengguna (`PIMPINAN`, `MANAGER`, `SUPERVISOR`, `KASIR`, `CUTTER`, `DRIVER`).
    - Penugasan peran atomik yang aman dari *race condition* (Advisory lock serialization).
    - Mode Preview terisolasi untuk simulasi data demo dengan perlindungan otomatis blokir pada build produksi.

---

## 4. REKONSILIASI ATURAN BISNIS: DIKONFIRMASI VS KEPUTUSAN DIBUTUHKAN

### A. Aturan Bisnis yang Telah Dikonfirmasi (Confirmed Business Rules)

| No | Aturan Bisnis | Status | Implementasi & Penegakan |
| :---: | :--- | :---: | :--- |
| 1 | **Isolasi Unit Bisnis** | `CONFIRMED` | Data unit La Tansa dan KUK Palen terisolasi ketat di tingkat skema, RLS, dan frontend context. |
| 2 | **Kuota Cuti Bulanan** | `CONFIRMED` | Maksimal 3 hari cuti per karyawan per bulan. |
| 3 | **Jendela Pengajuan Cuti** | `CONFIRMED` | Dibuka tgl 1 bulan sebelumnya, ditutup tgl 3 bulan target cuti. Divalidasi di DB RPC & UI modal. |
| 4 | **Deteksi Konflik Cuti** | `CONFIRMED` | Pengajuan pada departemen yang sama di tanggal yang sama otomatis berstatus PENDING. |
| 5 | **Verifikasi Tip Potong Kaca** | `CONFIRMED` | Hanya tip berstatus `VERIFIED` oleh Kasir yang dihitung ke payroll. Tip `REJECTED` dibuang. |
| 6 | **Protokol Keselamatan Armada** | `CONFIRMED` | Kendaraan dinilai `NEEDS_MAINTENANCE` oleh petugas langsung dikunci dari peminjaman baru. |
| 7 | **Tata Kelola Kas Operasional** | `CONFIRMED` | Seluruh pencatatan kas baru berstatus `PENDING` dan membutuhkan otorisasi manajerial resmi. |
| 8 | **Imutabilitas Payroll Final** | `CONFIRMED` | Periode `FINALIZED` terkunci permanen. Slip gaji membaca snapshot historis yang tidak berubah. |
| 9 | **Penjagaan Super Admin** | `CONFIRMED` | Dilarang self-demote, dilarang menghapus Super Admin terakhir, mutasi diserialisasi advisory lock. |

### B. Aturan Berstatus "BUSINESS DECISION REQUIRED" (Telah Diamankan)

Aturan-aturan berikut belum disahkan secara formal oleh pimpinan KUK. Sistem telah **mengamankan dan menonaktifkan konsekuensi otomatis** agar tidak ada proses operasional atau hak finansial karyawan yang terkunci oleh asumsi sepihak:

| Kebijakan | Status Regulasi | Pengamanan Sistem yang Diterapkan |
| :--- | :---: | :--- |
| **Masa Berlaku SP 6 Bulan** | `BUSINESS DECISION REQUIRED` | Dicatat murni sebagai referensi tanggal administratif; **TIDAK** memicu pemotongan gaji atau pemecatan otomatis. |
| **Pemicu Servis Kendaraan Berdasarkan Skor $\le$ 2 & Kata Kunci** | `BUSINESS DECISION REQUIRED` | **DINONAKTIFKAN**. Digantikan sepenuhnya oleh penilaian kelaikan operasional petugas pemeriksa (`operational_readiness`). |
| **Ambang Batas Auto-Approval Pengeluaran Kas (Rp500.000)** | `BUSINESS DECISION REQUIRED` | **DINONAKTIFKAN**. Seluruh pengeluaran berstatus `PENDING` menunggu otorisasi berwenang sampai kebijakan ambang disahkan. |
| **Formula Denda Keterlambatan** | `BUSINESS DECISION REQUIRED` | Presensi mencatat menit keterlambatan sebagai audit; **TIDAK** menghasilkan potongan gaji otomatis sebelum formula disetujui. |
| **Formula Lembur & Pengali Upah** | `BUSINESS DECISION REQUIRED` | Jam lembur dicatat secara faktual; komponen upah lembur memerlukan input persetujuan manual. |
| **Formula Bonus Performa & Tip Pooling** | `BUSINESS DECISION REQUIRED` | Perhitungan bonus dan pooling ditandai pending approval tanpa alokasi persentase asumsi. |
| **Ambang Batas KM Servis Armada** | `BUSINESS DECISION REQUIRED` | Nilai odometer dicatat pada setiap pengembalian; rekomendasi jadwal servis diserahkan ke evaluasi manual teknisi armada. |

---

## 5. DAFTAR BUG & CELAH KEAMANAN YANG TELAH DIPERBAIKI

1. **Super Admin Concurrency Race Condition (`assign_user_roles_atomic`):**
   - *Masalah:* Dua transaksi simultan dapat saling menurunkan pangkat Super Admin secara bersamaan sehingga akun Super Admin habis.
   - *Solusi:* Ditambahkan `pg_advisory_xact_lock(749202611)` di awal transaksi untuk serialisasi eksekusi secara absolut.

2. **Perlindungan Anti Self-Demotion Super Admin:**
   - *Masalah:* Super Admin dapat secara tidak sengaja mencabut perannya sendiri.
   - *Solusi:* Validasi `IF p_target_user_id = v_caller_id THEN RAISE EXCEPTION 'CANNOT_DEMOTE_SELF'`.

3. **Perlindungan Akun Super Admin Terakhir:**
   - *Masalah:* Penurunan peran dapat menyisakan 0 akun Super Admin aktif.
   - *Solusi:* Pengecekan hitungan Super Admin aktif terkunci; jika tersisa $\le 1$ mutasi ditolak dengan `LAST_SUPER_ADMIN_PROTECTED`.

4. **Rollback-Free Rate Limiting PIN Kiosk (`submit_leave_request_atomic`):**
   - *Masalah:* Percobaan PIN salah dengan `RAISE EXCEPTION` membatalkan seluruh transaksi, termasuk increment counter percobaan gagal, membuka celah brute-force.
   - *Solusi:* Implementasi pengembalian status kegagalan tanpa `RAISE EXCEPTION`, counter kegagalan berhasil tersimpan permanen.

5. **Inkonsistensi Skema Tabel Cuti:**
   - *Masalah:* Migrasi draft lama merujuk tabel non-kanonikal `leave_dates` dan kolom `is_sunday`.
   - *Solusi:* Direkonsiliasi penuh merujuk tabel kanonikal `leave_request_dates` (`request_id`, `leave_date`, `is_half_day`, `notes`).

6. **Inkonsistensi Harga Master Potong Kaca:**
   - *Masalah:* Referensi kolom usang `base_price` dan enum `PERCENTAGE`.
   - *Solusi:* Diselaraskan ke kolom kanonikal `selling_price_per_sqm` dan enum resmi. Menolak proses jika harga master `NULL` (`INVALID_GLASS_PRICE`).

7. **Anti-Failure Masking Invariant pada Frontend:**
   - *Masalah:* Blok `catch` mutasi database pada `dataService.ts` berpotensi mengembalikan `{ success: true }` palsu.
   - *Solusi:* Seluruh penanganan mutasi error dijamin mengembalikan `{ success: false, message: ... }`. Simulasi preview dipindahkan ke luar blok eksekusi langsung.

8. **Standardisasi Zona Waktu Asia/Jakarta (WIB):**
   - *Masalah:* Penggunaan UTC mentah menyebabkan ketidaksesuaian tanggal operasional harian di Indonesia bagian barat.
   - *Solusi:* Pemanfaatan `getWIBDateString()` dan `getWIBTimeString()` secara konsisten di seluruh modul presensi dan cuti.

---

## 6. BUKTI HASIL PENGUJIAN REGRESI LOKAL

Seluruh pengujian dijalankan dan diverifikasi secara lokal pada repositori:

```text
================================================================
PHASE 1C.2 / 1C.4-R — CONSOLIDATED TEST SUMMARY
================================================================
[SUITE 1] Enhanced SQL Static Validation      : PASSED   (36 passed, 0 failed)
[SUITE 2] RLS & Atomic RPC Simulation         : PASSED   (32 passed, 0 failed)
[SUITE 3] Frontend Contract Verifier          : PASSED   (15 passed, 0 failed)
[SUITE 4] False-Positive Mutation Tests       : PASSED   (18 passed, 0 failed)
----------------------------------------------------------------
TOTAL PHASE 1 ASSERTIONS: 101 | PASSED: 101 | FAILED: 0
================================================================

================================================================
PHASE 2 BATCH 3 — COMPREHENSIVE VERIFICATION SUITE
================================================================
1. Permission Matrix: View vs Manage Sensitive : PASSED
2. Permission Matrix: Fleet Manage vs Approve  : PASSED
3. Unit Isolation Contract (Guard null/empty)  : PASSED
4. Anti-Failure Masking (Strict success:false) : PASSED
5. RPC Parameter Contract (cancel_leave_req)   : PASSED
6. RLS AS RESTRICTIVE Delete Denial Guarantee  : PASSED
7. Timezone Consistency (WIB Calendar)         : PASSED
8. Business Rules: SP Expiry Clamping          : PASSED
9. Actor UUID Integrity Validation             : PASSED
10. Migration Immutability (Core Schema)       : PASSED
11. Documentation Alignment (Permission Matrix): PASSED
----------------------------------------------------------------
TOTAL PHASE 2 ASSERTIONS: 11 | PASSED: 11 | FAILED: 0
================================================================

================================================================
PHASE 3 LOGIC & BUSINESS WORKFLOW VALIDATION SUITE
================================================================
1. Glass Tip Kiosk Calculations                : PASSED (4 tests)
2. Fleet Borrowing Workflow                    : PASSED (3 tests)
3. Leave Request Rules & Quota                 : PASSED (3 tests)
4. Employee Lifecycle & Anti-Hard-Delete       : PASSED (2 tests)
5. RBAC & Permission Matrix Coverage           : PASSED (3 tests)
6. Data Export & CSV Generation                : PASSED (1 test)
7. Mock Fallback & Error Handling Remediation  : PASSED (6 tests)
8. Phase 3.2.1 Error Classification & Preview  : PASSED (7 tests)
9. Business Rule Reconciliation & RC Readiness : PASSED (3 tests)
   - Leave Submission Window (1st - 3rd)       : PASSED
   - Fleet Post-Inspection Inspector Verdict   : PASSED
   - Cash Expense Decoupled Approval Contract  : PASSED
----------------------------------------------------------------
TOTAL PHASE 3 ASSERTIONS: 32 | PASSED: 32 | FAILED: 0
================================================================

--- STATIC CODE QUALITY & BUILD VERIFICATION ---
- TypeScript Compiler (`tsc --noEmit`)         : 0 ERRORS
- Production Bundle Build (`vite build`)       : SUCCESS (Built in 10.43s)
- Historical Migrations Integrity Check        : ZERO DIFF (100% Identik)
- Environment Variables Integrity Check        : ZERO DIFF (100% Identik)
```

---

## 7. STATUS MIGRASI YANG BELUM DIAPLIKASIKAN (UNAPPLIED MIGRATIONS)

Kedua migrasi draf berikut telah divalidasi secara statis dan struktural pada pengujian lokal, namun **belum diaplikasikan ke database remote**:

1. `supabase/migrations/20261105000002_security_rpc_and_remediation.sql`
   - *Status:* `UNAPPLIED — DRAFT`
   - *Kandungan:* DDL tabel rate-limit `rpc_rate_limits`, fungsi pembersihan `cleanup_expired_rate_limits`, helper pembatas `check_and_increment_rate_limit`, dan RPC atomik transaksi publik (`submit_glass_tip_atomic`, `book_vehicle_atomic`, `verify_glass_tip_atomic`, `approve_vehicle_atomic`).
   - *Status Uji Runtime:* `NOT TESTED — REQUIRES POSTGRESQL/SUPABASE RUNTIME`.

2. `supabase/migrations/20261106000001_critical_security_remediation.sql`
   - *Status:* `UNAPPLIED — DRAFT`
   - *Kandungan:* Penegakan restriktif tabel kepatuhan tenaga kerja, penutupan celah self-demotion dan concurrency lock Super Admin (`assign_user_roles_atomic`), rekonsiliasi skema cuti kanonikal (`submit_leave_request_atomic`), validasi jendela pengajuan cuti, dan penolakan metode tip belum disahkan.
   - *Status Uji Runtime:* `NOT TESTED — REQUIRES POSTGRESQL/SUPABASE RUNTIME`.

---

## 8. PANDUAN LANGKAH SELANJUTNYA (NEXT STEPS)

1. **Tahap 1: User Acceptance Testing (UAT) / Business Review**
   - Presentasikan Release Candidate v3.1.0 kepada manajemen dan pemangku kepentingan unit bisnis KUK.
   - Sahkan keputusan bisnis yang masih berstatus `BUSINESS DECISION REQUIRED` (ambang petty cash, formula keterlambatan/lembur, dan masa berlaku sanksi).

2. **Tahap 2: Staging Database Deployment & Live SQL Validation**
   - Siapkan proyek staging Supabase terisolasi (bukan production).
   - Jalankan migrasi `20261105000002` dan `20261106000001` secara berurutan pada staging.
   - Validasi eksekusi RPC live dan integritas constraint di lingkungan runtime PostgreSQL sesungguhnya.

3. **Tahap 3: Rencana Migrasi Terjadwal ke Production**
   - Setelah UAT dan staging lulus tanpa kendala, jadwalkan jendela pemeliharaan (maintenance window).
   - Backup penuh database Production `ckzciuybedefbsdfsexh`.
   - Aplikasikan migrasi terverifikasi dan aktifkan build Release Candidate.

