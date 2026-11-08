# LAPORAN AUDIT & REMEDIASI KEAMANAN AKHIR — PHASE 1A BATCH B.3
## KUK Management System v3.1.0

**Tanggal Pelaksanaan:** 2026-11-08  
**Mode Operasional:** LOCAL ONLY (Zero Remote Access / No Production Mutation)  
**Baseline Git:** `b77fc90`  
**Target Migration:** `supabase/migrations/20261105000002_security_rpc_and_remediation.sql`  
**Validator:** `scripts/validate_batch_b_migration.cjs` (46/46 Passed)

---

## RINGKASAN EKSEKUTIF

Audit dan remediasi keamanan Batch B.3 telah diselesaikan pada lingkungan lokal untuk menutup celah keamanan tingkat CRITICAL dan HIGH yang teridentifikasi pada Batch B.2, yaitu:
1. **Mitigasi Rollback Counter Rate Limiter:** Seluruh fungsi transaksi publik (`submit_glass_tip_atomic` dan `book_vehicle_atomic`) kini menggunakan pattern return `JSONB` (`success: false`, `code`, `message`) dan exception catching internal alih-alih melempar unhandled `RAISE EXCEPTION`. Hal ini menjamin bahwa kegagalan validasi, benturan jadwal, atau penolakan rate-limit tidak memicu rollback transaksi PostgreSQL, sehingga counter percobaan pada `rpc_rate_limits` tetap tersimpan secara persisten.
2. **Serializability & Concurrency Atomicity Rate Limiter:** Prosedur `check_and_increment_rate_limit` ditingkatkan menggunakan concurrency loop terproteksi `SELECT ... FOR UPDATE` dan penanganan `unique_violation` pada klausa `INSERT`, mengeliminasi celah race condition antar permintaan paralel.
3. **Pembersihan Berkala & Indeks Rate Limit:** Disediakan fungsi maintenance `cleanup_expired_rate_limits(INTERVAL)` dan indeks `idx_rpc_rate_limits_window_start` untuk mencegah pembengkakan tabel `rpc_rate_limits` akibat akumulasi bucket kadaluarsa.
4. **Relaksasi Constraint `tip_percentage_snapshot`:** Menghapus constraint `NOT NULL` dan default hardcoded 3% (`0.0300`) pada tabel `glass_tips`. Nilai persentase hanya dicatat jika metode tarif adalah `PERCENTAGE`; untuk metode tarif non-persentase (`PER_SQM` dan `PER_PIECE`), nilai dicatat sebagai `NULL` guna mencegah numeric overflow dan data misleading.
5. **Penutupan Total Direct UPDATE Frontend:** `glassTipService.verifyTipNota()` dan `fleetService.approveBorrowing()` telah sepenuhnya dialihkan ke RPC atomik bersertifikasi keamanan dengan penanganan error state yang ketat tanpa kegagalan yang tersamarkan (*anti-failure masking*).

---

## 1. FIXED & VERIFIED SECARA STATIS

Bagian ini merangkum perbaikan yang telah diverifikasi secara matematis/statis melalui validator regex/AST, compiler TypeScript (`tsc`), dan static build Vite:

| No | Komponen / Fitur | Status Statis | Bukti Verifikasi Statis |
|---|---|---|---|
| 1 | **Boundary Transaksi Migration** | VERIFIED | Dibungkus dalam blok `BEGIN; ... COMMIT;` dengan tanda kurung quote `$$` seimbang. |
| 2 | **Pencabutan Hak Eksekusi PUBLIC** | VERIFIED | `REVOKE EXECUTE ON FUNCTION` dari `PUBLIC` dieksekusi eksplisit pada seluruh 7 fungsi sebelum pemberian hak khusus. |
| 3 | **Pengetatan Hak Eksekusi RPC Admin** | VERIFIED | Prosedur `reset_employee_kiosk_pin`, `verify_glass_tip_atomic`, `approve_vehicle_atomic`, `check_and_increment_rate_limit`, dan `cleanup_expired_rate_limits` hanya diberikan hak `EXECUTE` kepada `authenticated` dan `service_role`. Role `anon` dan `PUBLIC` dicabut total. |
| 4 | **Hak Eksekusi Transaksi Publik** | VERIFIED | Prosedur `submit_glass_tip_atomic` dan `book_vehicle_atomic` diberikan hak `EXECUTE` secara eksplisit kepada `anon, authenticated, service_role`. |
| 5 | **Restrictive DELETE Compliance** | VERIFIED | Tepat 4 tabel kepatuhan ketenagakerjaan (`leave_requests`, `warning_letters`, `violation_records`, `attendance_daily_records`) dipasangkan dengan policy `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`. Tidak ada tabel operasional lain yang terdampak. |
| 6 | **Pemberlakuan `search_path` Aman** | VERIFIED | Seluruh 7 fungsi PL/pgSQL mendefinisikan `SET search_path = public, extensions, pg_temp` dengan `pg_temp` berada di posisi paling akhir untuk mitigasi object shadowing. |
| 7 | **Penutupan Direct INSERT/UPDATE DML** | VERIFIED | Hak `INSERT, UPDATE` pada `glass_tips` dan `vehicle_borrowing_requests` dicabut dari `anon, authenticated, PUBLIC`. Policy permisif lama di-`DROP`. |
| 8 | **Anti-Spoofing `audit_logs`** | VERIFIED | Direct `INSERT` pada `audit_logs` dicabut dari `anon, PUBLIC`. Policy `audit_logs_insert` diberlakukan `WITH CHECK (actor_id = auth.uid())`. |
| 9 | **Isolasi Tabel `public_form_tokens`** | VERIFIED | Hak akses dicabut dari `anon, authenticated, PUBLIC`; hanya `service_role` yang mempertahankan hak akses. |
| 10 | **Struktur Tabel & RLS `rpc_rate_limits`** | VERIFIED | Dibuat dengan RLS enabled, akses DML dicabut total dari `anon, authenticated, PUBLIC`, granted khusus ke `service_role`. |
| 11 | **Proteksi Anti-Rollback Rate Limiter** | VERIFIED | `book_vehicle_atomic` dan `submit_glass_tip_atomic` tidak menggunakan unhandled `RAISE EXCEPTION` untuk validasi input dan penolakan frekuensi. Keduanya mengembalikan payload JSONB dan menangani error DML internal dalam blok `EXCEPTION WHEN ...`. |
| 12 | **Verifikasi ROW_COUNT PIN Reset** | VERIFIED | `reset_employee_kiosk_pin` mengecek `GET DIAGNOSTICS v_rows_affected = ROW_COUNT;`. Jika `v_rows_affected = 0`, eksekusi berhenti dengan payload error dan log audit sukses dicegah. |
| 13 | **NULL-Safe Status Comparison** | VERIFIED | Seluruh pengecekan status operasional menggunakan `IS DISTINCT FROM` (`ACTIVE`, `AVAILABLE`, `PENDING`). |
| 14 | **NULL-Safe Lockout Counter** | VERIFIED | Penambahan percobaan gagal menggunakan `COALESCE(failed_attempts, 0) + 1`. |
| 15 | **Format Mask Literal `to_char` WIB** | VERIFIED | Literal zona waktu WIB dikutip secara benar menggunakan double-quotes (`"WIB"`). |
| 16 | **Frontend Zero Direct UPDATE** | VERIFIED | `src/services/dataService.ts` bersih dari pemanggilan `.update()` langsung pada tabel `glass_tips` maupun `vehicle_borrowing_requests`. Mutasi status diverifikasi melalui RPC. |
| 17 | **Frontend Error Propagation** | VERIFIED | UI Kiosk/Daftar Karyawan dan Armada menangani `data.success === false` dan kode `23P01` tanpa menutup modal secara prematur. |

---

## 2. FIXED TETAPI BELUM DIUJI RUNTIME

Perbaikan berikut telah diimplementasikan secara struktural di kode SQL/TypeScript, namun verifikasi perilakunya membutuhkan eksekusi nyata pada engine PostgreSQL aktif:

1. **Efektivitas Concurrency Lock `rpc_rate_limits`:**
   - *Desain:* Menggunakan `LOOP ... SELECT ... FOR UPDATE` dan penanganan `WHEN unique_violation`.
   - *Kondisi Runtime:* Memerlukan simulasi beban paralel (e.g. 50 concurrent HTTP threads via k6/autocannon) untuk memverifikasi ketiadaan deadlock (`40P01`) di bawah volume transaksi puncak.
2. **Daya Tahan Kuota Rate Limit terhadap Kegagalan Klien:**
   - *Desain:* Mengembalikan JSONB `{ success: false }` agar transaksi di-commit dan counter `rpc_rate_limits` tidak ikut rollback.
   - *Kondisi Runtime:* Memerlukan pengujian pengiriman 15 request berurutan dengan PIN salah untuk memverifikasi apakah counter di database mencapai 10 dan menolak request ke-11 dengan `RATE_LIMIT_EXCEEDED`.
3. **Ekstraksi Client IP dari Reverse Proxy:**
   - *Desain:* Memeriksa header `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`, dan fallback `inet_client_addr()`.
   - *Kondisi Runtime:* Memerlukan pengujian melalui Supabase Kong Gateway guna memastikan urutan pembacaan header menghasilkan IP publik klien yang sesungguhnya dan tidak dapat dimanipulasi dengan spoofing header manual dari browser/Postman.
4. **Penanganan Benturan Jadwal Kendaraan `23P01` (Exclusion Constraint):**
   - *Desain:* Klausa `WHEN exclusion_violation THEN` pada `approve_vehicle_atomic` dan `book_vehicle_atomic`.
   - *Kondisi Runtime:* Memerlukan pengujian 2 permohonan kendaraan yang diajukan pada mikrodetik yang sama dengan range waktu tumpang tindih.

---

## 3. UNVERIFIED KARENA MEMBUTUHKAN POSTGRESQL RUNTIME

Sesuai batasan mutlak keamanan, hal-hal berikut **TIDAK BISA DIKLAIM AMAN** tanpa query langsung ke katalog PostgreSQL Supabase:

1. **Schema Aktual Lokasi Ekstensi `pgcrypto` dan `btree_gist`:**
   - *Status:* **UNVERIFIED**.
   - *Alasan:* File migration lama memanggil `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`, namun lokasi katalog sesungguhnya (`pg_extension.extnamespace`) hanya bisa dipastikan melalui:
     ```sql
     SELECT extname, nspname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid;
     ```
2. **Hak Privilege `CREATE` pada Schema `public` dan `extensions`:**
   - *Status:* **UNVERIFIED**.
   - *Alasan:* Pada PostgreSQL default atau konfigurasi cloud tertentu, role `PUBLIC` terkadang masih memiliki privilege `CREATE` pada schema `public`. Hal ini berisiko memunculkan serangan *object shadowing* jika search_path menyertakan `public` sebelum `extensions`. Status hak ini wajib diuji dengan:
     ```sql
     SELECT has_schema_privilege('anon', 'public', 'CREATE'), has_schema_privilege('authenticated', 'public', 'CREATE');
     ```
3. **Ownership Seluruh Fungsi SECURITY DEFINER:**
   - *Status:* **UNVERIFIED**.
   - *Alasan:* Pada arsitektur Supabase, fungsi SECURITY DEFINER berjalan dengan hak istimewa pemilik fungsi (*function owner*). Jika diterapkan via CLI atau web UI, owner biasanya adalah `postgres` atau `supabase_admin`. Kepastian hak minimum pemilik ini memerlukan runtime catalog check (`pg_proc.proowner`).

---

## 4. KEPUTUSAN BISNIS YANG MASIH MENUNGGU PERSETUJUAN (UNCONFIRMED)

Seluruh parameter bisnis berikut **TIDAK DIASUMSIKAN SEBAGAI ATURAN FINAL** dan wajib divalidasi oleh Product Owner / Manajemen KUK:

| Parameter Bisnis | Implementasi Draft Saat Ini | Status Keputusan | Catatan Evaluasi Bisnis |
|---|---|---|---|
| **Batas Dimensi Kaca Kiosk** | Panjang/Tinggi: 5 s/d 600 cm, Lembar: 1 s/d 100 | **UNCONFIRMED** | Belum ada lembar spesifikasi teknis pabrik/mesin potong kaca KUK yang memvalidasi ukuran maksimum lembaran kaca lembaran jumbo. |
| **Kebijakan Kiosk Lockout** | 5 kali gagal berturut-turut memicu lockout 30 menit | **UNCONFIRMED** | Perlu persetujuan operasional: apakah 30 menit terlalu lama bagi karyawan shift pabrik yang salah memasukkan PIN? |
| **Toleransi Waktu Armada di Masa Lampau** | 15 menit | **UNCONFIRMED** | Diberikan toleransi 15 menit untuk mengantisipasi perbedaan waktu jam pada perangkat pengemudi/kiosk. |
| **Batas Maksimum Durasi Peminjaman Armada** | 30 hari kalender | **UNCONFIRMED** | Perlu konfirmasi apakah ada armada operasional luar kota yang disewa lebih dari 1 bulan. |
| **Makna & Formula Kolom `tip_percentage_snapshot`** | Dibuat `NULLABLE` tanpa default; hanya diisi jika metode tarif adalah `PERCENTAGE` | **UNCONFIRMED** | Pada skema awal v3.1.0, kolom ini bertipe `NUMERIC(5, 4)` dengan default 3% (`0.0300`). Mengingat tarif dominan menggunakan Rupiah flat per meter persegi (`PER_SQM`), angka persentase tidak relevan untuk transaksi flat. |

---

## 5. RISIKO YANG MASIH TERSISA (RESIDUAL RISKS)

1. **Risiko Denial-of-Service pada IP Bersama (Shared Office / NAT Network):**
   - Jika beberapa kiosk atau ratusan karyawan mengakses internet melalui single NAT IP yang sama, rate limit IP (`30 request / 5 menit`) dapat tercapai oleh aktivitas gabungan karyawan yang sah.
   - *Mitigasi cadangan:* Disediakan bucket rate limit sekunder berbasis identitas karyawan (`tip_emp`) dan armada (`book_veh`) untuk memastikan pembatasan tetap selektif.
2. **Akumulasi Baris pada Tabel `rpc_rate_limits`:**
   - Jika sistem dibanjiri request publik berkecepatan tinggi dengan jutaan variasi IP acak, tabel `rpc_rate_limits` dapat membesar.
   - *Mitigasi:* Indeks `idx_rpc_rate_limits_window_start` telah dibuat, dan fungsi pembersihan `cleanup_expired_rate_limits()` telah disediakan untuk dijadwalkan via pg_cron atau cloud scheduler.
3. **Keterbatasan Analisis Statis Validator:**
   - Script validator bekerja menggunakan parsing struktural dan regex pada source code lokal. Validator tidak dapat mendeteksi kondisi runtime seperti trigger database tak terduga, konflik ekstensi, atau constraint fisik server.

---

## 6. REKOMENDASI LANGKAH BERIKUTNYA

1. **JANGAN MELAKUKAN DEPLOYMENT KE PRODUCTION.**
2. **Lakukan Pengujian Runtime pada Local Supabase Docker Container:**
   - Jalankan local supabase stack (`supabase start`).
   - Terapkan migration draft ini pada local container (`supabase db reset`).
   - Jalankan automated integration test suite yang memverifikasi skenario race condition, lockout, dan rate limiting.
3. **Ajukan Dokumen Konfirmasi Bisnis ke Manajemen:**
   - Minta persetujuan resmi tertulis mengenai 5 butir keputusan bisnis pada Bagian 4.
4. **Audit Katalog Postgres:**
   - Jalankan query katalog pada database staging Supabase untuk memverifikasi lokasi schema `pgcrypto` dan mencabut privilege `CREATE` dari schema `public` bila masih terbuka bagi role `PUBLIC`.

---

## HASIL PENGUJIAN KUALITAS (QUALITY GATES)

| Pengujian | Perintah | Exit Code | Status |
|---|---|---|---|
| **SQL Security & Frontend Validator** | `node scripts/validate_batch_b_migration.cjs` | `0` | **PASS (46/46 Assertions)** |
| **TypeScript Typecheck** | `npm.cmd run typecheck` | `0` | **PASS (0 Errors)** |
| **Frontend Production Build** | `npm.cmd run build` | `0` | **PASS (Build Selesai: 8.49s)** |
| **Phase 2 Regression Test Suite** | `npm.cmd run test:phase2` | `0` | **PASS (11/11 Scenarios)** |
| **Historical Migration Immutability** | `git diff HEAD supabase/migrations/20261104*` | `0` | **PASS (0 Diff / Intact)** |

---

## VERDICT AKHIR

Berdasarkan pemenuhan seluruh kriteria keamanan statis, perbaikan arsitektur rate limiting tanpa rollback, relaksasi constraint tip snapshot, penutupan direct mutation, dan keberhasilan seluruh quality gate:

**VERDICT: APPROVED FOR RUNTIME TESTING**

*(Catatan: Status ini HANYA memberikan izin untuk pengujian pada lingkungan database lokal / staging berisolasi. Migration TIDAK DIIZINKAN untuk diterapkan langsung ke Supabase Production).*

