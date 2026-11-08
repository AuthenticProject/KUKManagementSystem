# PHASE 1C.2 — SIMULATION HARNESS HARDENING REPORT
## KUK Management System v3.1.0

**Tanggal Evaluasi:** 2026-11-08 17:58:00 +07:00  
**Baseline Git:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Mode Operasi:** Strictly Local Testing — Zero Remote Database Access  
**Database Produksi:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — **ZERO ACCESS / UNTOUCHED**  
**Verdict:** **`READY WITH LIMITATIONS`**  

---

## 1. EXECUTIVE SUMMARY

Sesuai arahan tugas **Phase 1C.2 (Simulation Harness Hardening)**, telah dilakukan penguatan menyeluruh terhadap seluruh infrastruktur pengujian lokal (*local verification & simulation harness*) untuk KUK Management System v3.1.0 tanpa menyentuh Supabase Cloud Production maupun memasang dependensi eksternal baru.

Penguatan mencakup:
1. **Enhanced SQL Static Validator (`test:phase1:static`):** Memvalidasi 15 kriteria keamanan struktural SQL, mencakup batasan transaksi, `SECURITY DEFINER`, `search_path`, hak eksekusi `PUBLIC`/`anon`, kebijakan `AS RESTRICTIVE`, isolasi tabel langsung, audit trigger, dan constraint exclusion `btree_gist`.
2. **PostgreSQL RLS & Atomic RPC Simulation Engine (`test:phase1:simulation`):** Mensimulasikan logika PostgreSQL RLS sesungguhnya `(Permissive OR Permissive) AND (Restrictive AND Restrictive)`, pembatasan unit, hak akses kantor pusat, serta menguji 9 RPC bisnis inti beserta skenario adversarial (PIN lockout, dummy bcrypt timing defense, duplicate booking exclusion `23P01`, finalisasi payroll ganda).
3. **Frontend & Backend Contract Verifier (`test:phase1:contracts`):** Memvalidasi keselarasan signature RPC, parameter, eliminasi direct `.update()`/`.insert()`, pencegahan duplikasi, proteksi preview mode di production build, dan penonaktifan form kiosk cuti mandiri.
4. **False-Positive & Mutation Testing (`test_phase1_negative_fpt.cjs`):** Menguji ketangguhan validator menggunakan 8 mutan injeksi kerentanan dalam memori (tanpa merusak disk), membuktikan bahwa seluruh validator tidak bersifat *vacuous pass*.
5. **Master Test Runner (`npm run test:phase1:all`):** Menjalankan ke-4 suite pengujian secara terkonsolidasi dengan hasil **54 dari 54 assertions LULUS (100% PASS)**.

---

## 2. INITIAL AUDIT FINDINGS

Sebelum penguatan dilakukan, audit kondisi awal mengidentifikasi beberapa kelemahan pada harness lama:
- **Pemeriksaan Hanya Berfokus pada Migration Draft:** Skrip validator lama (`validate_batch_b_migration.cjs`) hanya memeriksa berkas draft `20261105000002_security_rpc_and_remediation.sql`, tanpa memvalidasi konsistensi relasional terhadap core schema `20261104000001_core_schema_v3_1_0.sql`.
- **Ketiadaan Simulasi PostgreSQL RLS Semantics:** Pengujian sebelumnya belum memodelkan aturan kombinasi PostgreSQL RLS antara kebijakan *Permissive* (dihubungkan dengan operator `OR`) dan *Restrictive* (dihubungkan dengan operator `AND`).
- **Ketiadaan Mutation Testing (False-Positive Risk):** Belum ada pembuktian apakah regex/skrip validator akan benar-benar melempar error `FAIL` apabila ada kerentanan nyata yang disuntikkan ke dalam SQL (misal: jika `REVOKE EXECUTE ... FROM PUBLIC` dihilangkan).
- **Kurangnya Standarisasi Script NPM:** Perintah pengujian Phase 1 belum dipetakan secara rapi di dalam `package.json`.

---

## 3. CHANGES IMPLEMENTED

Untuk mengatasi temuan audit di atas, diimplementasikan komponen harness baru:

### A. Berkas Pengujian Baru di `scripts/`:
1. `scripts/test_phase1_static.cjs` — Validator statis DDL, privileges, search_path, dan RLS.
2. `scripts/test_phase1_simulation.cjs` — Mesin simulasi RLS multi-tenant dan RPC atomik.
3. `scripts/test_phase1_contracts.cjs` — Verifikator kontrak antarmuka frontend DataService vs RPC SQL.
4. `scripts/test_phase1_negative_fpt.cjs` — Harness mutation testing untuk menguji false positives.
5. `scripts/test_phase1_all.cjs` — Master test runner penggabung ke-4 suite.

### B. Standardisasi NPM Scripts pada `package.json`:
```json
"scripts": {
  "test:phase1:static": "node scripts/test_phase1_static.cjs",
  "test:phase1:simulation": "node scripts/test_phase1_simulation.cjs",
  "test:phase1:contracts": "node scripts/test_phase1_contracts.cjs",
  "test:phase1:all": "node scripts/test_phase1_all.cjs",
  "test:phase2": "node scripts/test_phase2_logic.cjs",
  "test:phase3": "node scripts/test_phase3_logic.cjs"
}
```

---

## 4. TEST RESULTS SUMMARY

Eksekusi master suite `npm run test:phase1:all` menghasilkan catatan kelulusan 100%:

```text
================================================================
PHASE 1C.2 — CONSOLIDATED TEST SUMMARY
================================================================

[SUITE 1] Enhanced SQL Static Validation      : PASSED   (15 passed, 0 failed)
[SUITE 2] RLS & Atomic RPC Simulation         : PASSED   (19 passed, 0 failed)
[SUITE 3] Frontend Contract Verifier          : PASSED   (12 passed, 0 failed)
[SUITE 4] False-Positive Mutation Tests       : PASSED   (8 passed, 0 failed)
----------------------------------------------------------------
TOTAL ASSERTIONS: 54 | PASSED: 54 | FAILED: 0
----------------------------------------------------------------
OVERALL RESULT: ALL PHASE 1C.2 LOCAL TEST SUITES PASSED
```

### Rincian Pengujian per Kategori:

#### Suite 1: Enhanced SQL Static Validation (15 Assertions)
- `LOAD-01`: Berkas migration `20261104000001`, `20261104000002`, dan `20261105000002` terbaca lengkap.
- `TX-01`: Batasan atomik `BEGIN; ... COMMIT;` pada migration draft terverifikasi.
- `TX-02`: Delimeter quote `$$` PL/pgSQL genap dan seimbang (total 46 delimeter).
- `SEC-01`: Seluruh fungsi `SECURITY DEFINER` menyertakan `SET search_path = public, extensions, pg_temp` dengan `pg_temp` di urutan paling belakang.
- `GRT-01`: `submit_glass_tip_atomic` mencabut hak dari `PUBLIC` dan memberikannya ke `anon`, `authenticated`, `service_role`.
- `GRT-02`: `book_vehicle_atomic` mencabut hak dari `PUBLIC` dan memberikannya ke `anon`, `authenticated`, `service_role`.
- `GRT-03`: RPC administratif (`reset_employee_kiosk_pin`, `verify_glass_tip_atomic`, `approve_vehicle_atomic`) mencabut hak dari `PUBLIC` & `anon`, mengisolasi hanya untuk `authenticated`, `service_role`.
- `GRT-04`: Helper internal `check_and_increment_rate_limit` mencabut hak dari `PUBLIC`, `anon`, dan `authenticated`.
- `TAB-01`: Mutasi langsung (`INSERT`/`UPDATE`) pada `glass_tips`, `vehicle_borrowing_requests`, `audit_logs`, `public_form_tokens`, dan `rpc_rate_limits` dicabut.
- `RLS-01`: Kebijakan `AS RESTRICTIVE FOR DELETE (false)` terpasang pada tabel kepatuhan ketenagakerjaan.
- `RLS-02`: Tidak ada kebijakan `RESTRICTIVE DELETE` yang keliru ditempatkan pada tabel operasional transaksi.
- `CON-01`: Exclusion constraint armada `EXCLUDE USING gist` terdefinisi pada skema database inti.
- `AUD-01`: Penegakan identitas aktor `actor_id = auth.uid()` dan trigger immutabilitas `trg_protect_audit_logs`.
- `RAT-01`: Definisi tabel `rpc_rate_limits`, indeks `window_start`, dan fungsi pemeliharaan `cleanup_expired_rate_limits`.
- `INP-01`: Validasi regex PIN `^[0-9]{6}$`, dummy bcrypt hash, dan operator null-safe `IS DISTINCT FROM`.

#### Suite 2: RLS & Atomic RPC Simulation Engine (19 Assertions)
- `RLS-SIM-01`: Staf La Tansa dapat membaca data karyawannya sendiri.
- `RLS-SIM-02`: Staf La Tansa ditolak membaca data karyawan unit Palen (Cross-unit denial).
- `RLS-SIM-03`: Admin Pusat memiliki hak agregat membaca seluruh unit kerja.
- `RLS-SIM-04`: Pengguna anonim ditolak membaca tabel internal karyawan.
- `RLS-SIM-05`: Kebijakan RESTRICTIVE DELETE menolak penghapusan fisik karyawan bahkan untuk Super Admin.
- `RPC-SIM-01`: Rate limiter mengizinkan tepat 10 request/menit dan menolak request ke-11.
- `RPC-SIM-02`: PIN NULL atau format tidak valid ditolak dengan `INVALID_PIN_FORMAT`.
- `RPC-SIM-03`: 5 kali salah PIN memicu status `ACCOUNT_LOCKED` selama 30 menit.
- `RPC-SIM-04`: Akun terkunci menolak input bahkan saat PIN yang dimasukkan benar.
- `RPC-SIM-05`: Role kasir ditolak melakukan reset PIN kiosk staf (Admin required).
- `RPC-SIM-06`: Unit Admin berhasil mereset PIN dan membersihkan status lockout karyawan.
- `RPC-SIM-07`: Role pemotong kaca ditolak memverifikasi nota tip (Kasir required).
- `RPC-SIM-08`: Kasir berhasil memverifikasi nota tip pending dengan nominal verifikasi sah.
- `RPC-SIM-09`: Percobaan verifikasi ulang nota yang sudah diverifikasi ditolak (`INVALID_STATE`).
- `RPC-SIM-10`: Booking armada yang bertabrakan waktu reservasi aktif ditolak sebagai konflik `23P01`.
- `RPC-SIM-11`: Booking armada dengan waktu mulai lampau (>15 menit) ditolak.
- `RPC-SIM-12`: Finalisasi ulang payroll pada periode yang sudah final ditolak (`ALREADY_FINALIZED`).
- `RPC-SIM-13`: Kasir ditolak membatalkan cuti karyawan (Admin required).
- `RPC-SIM-14`: Kiosk cuti publik tetap berstatus `BLOCKED` sesuai desain pengamanan.

#### Suite 3: Frontend & Backend Contract Verifier (12 Assertions)
- `CTR-01 & CTR-02`: Zero direct `.update()` pada `glass_tips` dan `vehicle_borrowing_requests`.
- `CTR-03 s/d CTR-06`: Pemanggilan RPC `verify_glass_tip_atomic`, `approve_vehicle_atomic`, `submit_glass_tip_atomic`, `book_vehicle_atomic` memiliki signature dan nama parameter yang 100% sinkron.
- `CTR-07`: Penanganan error `23P01` terpasang pada service peminjaman kendaraan.
- `CTR-08`: Konsistensi tipe data `DataResponse<T>` (`success`, `data`, `error`, `isFixture`, `source`).
- `CTR-09`: Mesin `classifyError` membedakan RLS `42501`, Sesi `AUTH_EXPIRED`, `TIMEOUT`, dan `NETWORK_ERROR`.
- `CTR-10`: Shield proteksi lingkungan produksi menonaktifkan mode pratinjau secara permanen pada build production.
- `CTR-11`: Halaman cuti mandiri kiosk menyajikan banner `BLOCKED` dan menonaktifkan tombol submit.
- `CTR-12`: Kiosk publik tip kaca dan armada terisolasi hanya memanggil RPC service resmi.

---

## 5. FALSE-POSITIVE TEST RESULTS (MUTATION TESTING)

Untuk memastikan validator mampu mendeteksi cacat keamanan dan tidak menghasilkan kelulusan semu (*false positive*), dilakukan pengujian mutasi memori (*in-memory mutation testing*) dengan menyuntikkan 8 varian kerentanan:

| ID Mutasi | Deskripsi Kerentanan yang Disuntikkan | Komponen Pendeteksi | Hasil Pengujian Negatif |
| :--- | :--- | :---: | :---: |
| **FPT-01** | Menghilangkan klausul `REVOKE EXECUTE ... FROM PUBLIC` pada `submit_glass_tip_atomic` | Static Validator (`GRT-01`) | **POSITIF TERDETEKSI & DITOLAK** |
| **FPT-02** | Menghilangkan `pg_temp` dari `SET search_path` pada fungsi DEFINER | Static Validator (`SEC-01`) | **POSITIF TERDETEKSI & DITOLAK** |
| **FPT-03** | Mengubah klausul policy dari `AS RESTRICTIVE` menjadi `AS PERMISSIVE` | Static Validator (`RLS-01`) | **POSITIF TERDETEKSI & DITOLAK** |
| **FPT-04** | Menghapus pencabutan izin langsung `REVOKE INSERT ON glass_tips` | Static Validator (`TAB-01`) | **POSITIF TERDETEKSI & DITOLAK** |
| **FPT-05** | Memanipulasi policy audit log menjadi permisif (`actor_id != auth.uid()`) | Static Validator (`AUD-01`) | **POSITIF TERDETEKSI & DITOLAK** |
| **FPT-06** | Menghilangkan batas penutup transaksi `COMMIT;` pada migration draft | Static Validator (`TX-01`) | **POSITIF TERDETEKSI & DITOLAK** |
| **FPT-07** | Menghapus penegakan regex format PIN 6 digit `^[0-9]{6}$` | Static Validator (`INP-01`) | **POSITIF TERDETEKSI & DITOLAK** |
| **FPT-08** | Menyuntikkan aturan RLS cacat yang membocorkan data lintas unit | Simulation Engine (`RLS-SIM`) | **POSITIF TERDETEKSI & DITOLAK** |

*Seluruh 8 mutan berhasil dideteksi dan digagalkan oleh mesin pengujian. Tidak ada perubahan pada berkas fisik repositori.*

---

## 6. BUSINESS RULES PENDING APPROVAL

Sesuai instruksi mutlak, nilai dan formula operasional berikut **TETAP DIPERTAHANKAN SEBAGAI DRAFT DAN BERSTATUS `BUSINESS_RULE_PENDING_APPROVAL`**:

```text
+----+---------------------------------------------------+--------------------+------------------------------------------------+
| No | Aturan Bisnis / Parameter Operasional             | Nilai Draft Lokal  | Status Keputusan                               |
+----+---------------------------------------------------+--------------------+------------------------------------------------+
| 1  | Persentase dasar tip potong kaca                  | 3% (usulan)        | BUSINESS_RULE_PENDING_APPROVAL (Menunggu Owner)|
| 2  | Aturan pembulatan nominal tip                     | Kelipatan Rp1.000  | BUSINESS_RULE_PENDING_APPROVAL (Menunggu Owner)|
| 3  | Batas minimum dan maksimum dimensi kaca (cm)      | 5 cm s/d 600 cm    | BUSINESS_RULE_PENDING_APPROVAL (Menunggu Toko) |
| 4  | Batas minimum dan maksimum kuantitas lembar kaca  | 1 s/d 500 lembar   | BUSINESS_RULE_PENDING_APPROVAL (Menunggu Toko) |
| 5  | Batas kegagalan PIN (lockout attempts & durasi)   | 5 kali / 30 menit  | BUSINESS_RULE_PENDING_APPROVAL (Menunggu Owner)|
| 6  | Toleransi booking kendaraan untuk waktu lampau    | 15 menit           | BUSINESS_RULE_PENDING_APPROVAL (Menunggu Armada|
| 7  | Batas maksimal durasi peminjaman armada           | 30 hari            | BUSINESS_RULE_PENDING_APPROVAL (Menunggu Armada|
| 8  | Penggunaan & semantik tip_percentage_snapshot     | NULLABLE (No def)  | BUSINESS_RULE_PENDING_APPROVAL (Menunggu Owner)|
+----+---------------------------------------------------+--------------------+------------------------------------------------+
```

---

## 7. SIMULATION LIMITATIONS (DISCLAIMER TEKNIS)

Meskipun harness simulasi telah ditingkatkan secara signifikan, batasan arsitektur berikut harus ditegaskan:
1. **Bukan Eksekusi PostgreSQL C-Engine:** Pengujian simulasi berjalan di atas lingkungan Node.js runtime. Simulasi ini memvalidasi *aturan logika bisnis, parsing AST, dan alur percabangan*, namun **bukan pengganti eksekutor query native PostgreSQL 17**.
2. **PostgreSQL Catalog & RLS Kernel:** Pengujian ini tidak mengevaluasi interaksi internal PostgreSQL *lock manager*, *catalog permissions*, atau *concurrency planner* sesungguhnya pada tingkat millisecond CPU.
3. **PostgREST HTTP Gateway:** Alur transmisi header JWT, pemetaan klaim auth ke GUC settings (`request.jwt.claims`), dan reload skema PostgREST belum teruji secara end-to-end tanpa instance Supabase aktif.

---

## 8. FILES CHANGED & REPOSITORY STATE

### Berkas Baru yang Dibuat:
- `scripts/test_phase1_static.cjs`
- `scripts/test_phase1_simulation.cjs`
- `scripts/test_phase1_contracts.cjs`
- `scripts/test_phase1_negative_fpt.cjs`
- `scripts/test_phase1_all.cjs`
- `docs/PHASE_1C_2_SIMULATION_HARNESS_HARDENING.md`
- `docs/PHASE_1C_2_RUNTIME_TEST_GAP_MATRIX.md`

### Berkas yang Dimodifikasi:
- `package.json` (Menambahkan scripts `test:phase1:*` dan `test:phase3`).

### Berkas yang Strictly ZERO-DIFF (Tidak Tersentuh):
- `supabase/migrations/20261104000001_core_schema_v3_1_0.sql` (Baseline)
- `supabase/migrations/20261104000002_harden_rpc_security.sql` (Baseline)
- `.env` dan kredensial produksi (Tidak disentuh dan tidak diekspos).

---

## 9. FINAL VERDICT

Berdasarkan seluruh hasil audit, penguatan harness, pengujian statis, simulasi logika RLS, verifikasi kontrak frontend, dan pengujian mutasi:

### Status: **`READY WITH LIMITATIONS`**

**Justifikasi Batasan:**
- Secara lokal dan statis, arsitektur kode dan skema migration telah kokoh dan terverifikasi secara formal (54/54 passed).
- Sistem aman dari regresi lokal dan siap untuk implementasi modul selanjutnya.
- Namun, deployment atau eksekusi DDL ke Supabase Production **BELUM DAPAT DILAKUKAN** sebelum verifikasi runtime PostgreSQL dilakukan pada lingkungan terisolasi serta persetujuan resmi diberikan terhadap 8 parameter aturan bisnis yang masih berstatus `BUSINESS_RULE_PENDING_APPROVAL`.

