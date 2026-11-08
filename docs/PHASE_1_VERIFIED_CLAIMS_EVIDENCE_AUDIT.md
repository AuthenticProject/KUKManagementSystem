# PHASE 1 — VERIFIED CLAIMS EVIDENCE AUDIT
## KUK Management System v3.1.0

**Dokumen Versi:** 3.1.0-EVIDENCE-AUDIT  
**Tanggal Evaluasi:** 2026-11-05 14:10:00 +07:00  
**Baseline Repositori:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Dokumen Sasaran Audit:**
1. `docs/PHASE_1_SECURITY_IMPLEMENTATION_SPEC.md`
2. `docs/PHASE_1_SECURITY_SPECIFICATION_HARDENING_REVIEW.md`
3. `docs/PHASE_1_FINAL_TECHNICAL_DESIGN_VALIDATION.md`  
**Status Fase 1:** **`OPEN`** (Audit Bukti Teknis & Rekonsiliasi Klaim)  
**Metodologi:** Static Code Inspection, Migration DDL Parsing, dan Audit Bukti Katalog Database  

---

## 1. RINGKASAN REKONSILIASI STATUS KLAIM

Audit ini memverifikasi secara independen apakah seluruh klaim yang sebelumnya dilabeli **`VERIFIED`** pada dokumen spesifikasi benar-benar didukung bukti teknis fisik dalam repositori lokal atau katalog database.

```text
+---------------------------------------------------------------------------------------------------------------------+
| Domain Pemeriksaan             | Status Sebelumnya | Status Sebenarnya | Keterangan Rekonsiliasi                    |
+---------------------------------------------------------------------------------------------------------------------+
| 1. Skema Ekstensi pgcrypto     | VERIFIED          | UNVERIFIED        | extnamespace tidak diperiksa; skema        |
|    & btree_gist                |                   |                   | extensions hanya asumsi konfigurasi default|
|                                |                   |                   |                                            |
| 2. Privilege CREATE pada       | VERIFIED          | VERIFIED (Public) | Terbukti FALSE pada public via CLI;        |
|    Schema                      |                   | UNVERIFIED (Ext)  | Belum ada bukti katalog untuk extensions   |
|                                |                   |                   |                                            |
| 3. Benchmark Dummy Bcrypt      | VERIFIED          | UNVERIFIED        | Format hash valid, tetapi belum pernah ada |
|    & Timing Masking            |                   |                   | benchmark runtime pada lingkungan target   |
|                                |                   |                   |                                            |
| 4. Batas Dimensi Kaca          | VERIFIED          | PROPOSED          | Angka 5-600 cm berasal dari asumsi domain, |
|    (5 s/d 600 cm)              |                   |                   | bukan spesifikasi tertulis pabrik di repo  |
|                                |                   |                   |                                            |
| 5. Kebutuhan SECURITY DEFINER  | VERIFIED (Semua)  | VERIFIED (Sebagian| verify_glass_tip & approve_vehicle bisa    |
|    pada 6 RPC                  |                   | PROPOSED (Sebagian| memakai SECURITY INVOKER secara teknis     |
|                                |                   |                   |                                            |
| 6. Prosedur reset_employee_   | VERIFIED          | PROPOSED          | Prosedur ini BELUM ADA di berkas migrasi   |
|    kiosk_pin                   |                   |                   | manapun; murni rancangan desain            |
|                                |                   |                   |                                            |
| 7. Matriks Pengujian           | VERIFIED (Runtime)| PROPOSED (Spec)   | Seluruh 15 skenario pengujian adalah       |
|    (VAL-01 s/d VAL-15)         |                   |                   | spesifikasi rencana, belum pernah dieksekusi|
+---------------------------------------------------------------------------------------------------------------------+
```

---

## 2. AUDIT RINCI SETIAP KLAIM

---

### KLAIM 1: Lokasi Skema Fisik Ekstensi `pgcrypto` dan `btree_gist`

- **Teks Klaim Sebelumnya:**  
  *"Pada Supabase Cloud, ekstensi terpasang pada skema extensions... Status: VERIFIED"*
- **Status Hasil Audit:** **`UNVERIFIED`**
- **Bukti File / Kode:**  
  [`supabase/migrations/20261104000001_core_schema_v3_1_0.sql#L16-L17`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/supabase/migrations/20261104000001_core_schema_v3_1_0.sql#L16-L17):
  ```sql
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  CREATE EXTENSION IF NOT EXISTS "btree_gist";
  ```
  [`supabase/config.toml#L10`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/supabase/config.toml#L10):
  ```toml
  extra_search_path = ["public", "extensions"]
  ```
- **Jenis Pemeriksaan:** Static Migration & Config Inspection.
- **Kekurangan Bukti:**  
  Perintah `CREATE EXTENSION` di migrasi kanonikal tidak menyertakan klausa `WITH SCHEMA extensions;`. Kueri katalog pada [`scripts/fetch_remote_schema.js#L16`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/scripts/fetch_remote_schema.js#L16) hanya mengambil `extname, extversion`, tanpa kolom `extnamespace::regnamespace`. Tidak ada rekaman bukti katalog aktual yang menunjukkan apakah `pgcrypto` berada di skema `public` atau `extensions` pada instance remote.
- **Tindakan Berikutnya:**  
  Saat staging database aktif, jalankan query katalog read-only:  
  `SELECT extname, n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE extname IN ('pgcrypto', 'btree_gist');`. RPC `SECURITY DEFINER` sementara wajib menyetel `SET search_path = public, extensions, pg_temp;` untuk mengakomodasi kedua kemungkinan.

---

### KLAIM 2: Ketiadaan Hak `CREATE` pada Skema Database

- **Teks Klaim Sebelumnya:**  
  *"Hak CREATE pada skema public dicabut dari anon dan authenticated... Status: VERIFIED"*
- **Status Hasil Audit:**  
  - Untuk Skema `public`: **`VERIFIED`**
  - Untuk Skema `extensions`: **`UNVERIFIED`**
- **Bukti File / Kode:**  
  [`docs/PHASE_1_FINAL_SECURITY_APPROVAL.md#L76-L90`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/PHASE_1_FINAL_SECURITY_APPROVAL.md#L76-L90):
  Log eksekusi CLI historis pada Supabase Production:
  `has_schema_privilege('anon', 'public', 'CREATE') -> false`  
  `has_schema_privilege('authenticated', 'public', 'CREATE') -> false`  
  `has_schema_privilege('public', 'public', 'CREATE') -> false`
- **Jenis Pemeriksaan:** Catalog Audit Execution Log.
- **Kekurangan Bukti:**  
  Pemeriksaan di atas hanya menguji skema `public`. Belum pernah dijalankan pemeriksaan:  
  `SELECT has_schema_privilege('anon', 'extensions', 'CREATE');` atau untuk `authenticated`.
- **Tindakan Berikutnya:**  
  Verifikasi hak `CREATE` pada skema `extensions` saat staging project terpasang.

---

### KLAIM 3: Validitas Dummy Bcrypt & Ketahanan Timing Attack

- **Teks Klaim Sebelumnya:**  
  *"Operasi Bcrypt cost 10 menghabiskan ~70-110ms... selisih waktu database I/O secara statistik tersamarkan (statistically masked)... Status: VERIFIED"*
- **Status Hasil Audit:** **`UNVERIFIED`** (Estimasi Teoretis, Bukan Bukti Benchmark)
- **Bukti File / Kode:**  
  Uji integritas hash string `$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy` membuktikan format Bcrypt valid (panjang 60 karakter, cost 10, format `$2a$`).
- **Jenis Pemeriksaan:** Static String Format Check.
- **Kekurangan Bukti:**  
  1. **Nol Benchmark Runtime:** Belum pernah ada pengukuran waktu eksekusi (microbenchmark) fungsi `crypt()` di mesin atau container Supabase yang sesungguhnya.
  2. **Klaim Masking Tidak Terbukti:** Menyatakan bahwa variasi latensi jaringan internet pasti menutupi perbedaan timing adalah hipotesis teoretis, bukan fakta empiris. Dalam serangan *statistical timing attack* (misal Box-Cox regression atas 10.000 sampel), perbedaan 2–3ms pada koneksi lokal/LAN tetap dapat diekstraksi secara teoretis.
- **Tindakan Berikutnya:**  
  Turunkan status dari `VERIFIED` menjadi **`UNVERIFIED (PROPOSED ESTIMATE)`**. Lakukan benchmark empiris nyata (100 request employee valid vs 100 invalid) di lingkungan staging untuk mengukur distribusi *mean* dan *standard deviation*.

---

### KLAIM 4: Batas Dimensi Kaca (5.0 cm s/d 600.0 cm)

- **Teks Klaim Sebelumnya:**  
  *"Berdasarkan spesifikasi standar pabrik Asahi Mas dan Mulia Glass... Status: VERIFIED"*
- **Status Hasil Audit:** **`PROPOSED`** (Bukan Spesifikasi Terverifikasi di Repositori)
- **Bukti File / Kode:**  
  Pemeriksaan menyeluruh pada repositori (`Get-ChildItem -Recurse -File -Include *asahi*,*mulia*,*kaca*`) membuktikan bahwa **TIDAK ADA** dokumen katalog pabrik atau tabel referensi ukuran resmi di dalam kode proyek.
- **Jenis Pemeriksaan:** Repository File Scan.
- **Kekurangan Bukti:**  
  Angka $5.0\text{ cm}$ s/d $600.0\text{ cm}$ dan kuantitas $500\text{ lembar}$ adalah angka asumsi domain umum, belum divalidasi dengan SOP pemotongan toko retail KUK yang sesungguhnya.
- **Tindakan Berikutnya:**  
  Ubah status menjadi **`PROPOSED`**. Batas dimensi harus dikonfirmasi oleh manajer operasional unit KUK sebelum dimasukkan sebagai hard constraint database.

---

### KLAIM 5: Kebutuhan Mutlak `SECURITY DEFINER` pada Seluruh RPC

- **Teks Klaim Sebelumnya:**  
  *"Seluruh fungsi RPC membutuhkan SECURITY DEFINER... Status: VERIFIED"*
- **Status Hasil Audit:** **`VERIFIED SEBAGIAN / PROPOSED SEBAGIAN`**
- **Bukti File / Kode:**  
  Evaluasi individual terhadap 6 fungsi RPC:
  1. `submit_glass_tip_atomic`: **`VERIFIED NEED`**. Dipanggil oleh `anon`. Tabel `employee_portal_auth` memiliki policy `FOR ALL TO authenticated USING (false)`. Klien `anon` tidak memiliki akses apa pun ke tabel ini. Fungsi mutlak butuh `SECURITY DEFINER`.
  2. `book_vehicle_atomic`: **`VERIFIED NEED`**. Dipanggil oleh `anon`. Memerlukan eksekusi `generate_document_number_atomic` pada tabel `document_sequences` yang tidak dapat diakses publik.
  3. `calculate_and_finalize_payroll_atomic`: **`VERIFIED NEED`**. Membaca tabel gaji sensitif `employee_sensitive_data` dan menandai tip di `glass_tips`.
  4. `cancel_leave_request_atomic`: **`VERIFIED NEED`**. Mengubah kolom `is_active` pada `leave_conflict_slots` yang hanya memiliki policy `SELECT`.
  5. `verify_glass_tip_atomic`: **`PROPOSED (BISA SECURITY INVOKER)`**.
     - *Bukti Skema:* Pada [`supabase/migrations/20261104000001_core_schema_v3_1_0.sql#L1940`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/supabase/migrations/20261104000001_core_schema_v3_1_0.sql#L1940), peran `authenticated` dengan izin `glass_tips.verify` **SUDAH MEMILIKI** hak UPDATE pada tabel `glass_tips`.
     - *Analisis:* Fungsi ini secara teknis **dapat berjalan sebagai `SECURITY INVOKER`**. `SECURITY DEFINER` hanya diperlukan jika hak UPDATE direct pada tabel `glass_tips` dicabut total dari role `authenticated`.
  6. `approve_vehicle_atomic`: **`PROPOSED (BISA SECURITY INVOKER)`**.
     - *Bukti Skema:* Pada baris 2032, peran `authenticated` dengan izin `fleet.approve_borrowing` **SUDAH MEMILIKI** hak UPDATE pada tabel `vehicle_borrowing_requests`.
     - *Analisis:* Dapat berjalan sebagai `SECURITY INVOKER`.
- **Tindakan Berikutnya:**  
  Pisahkan dengan tegas: fungsi publik wajib `SECURITY DEFINER`, sedangkan fungsi staf dapat dipertimbangkan menggunakan `SECURITY INVOKER` kecuali bila akses direct REST ke tabel sengaja diblokir total.

---

### KLAIM 6: Ketersediaan Prosedur `reset_employee_kiosk_pin`

- **Teks Klaim Sebelumnya:**  
  *"Prosedur khusus reset_employee_kiosk_pin memvalidasi otorisasi dan mencatat aksi ke audit_logs... Status: VERIFIED"*
- **Status Hasil Audit:** **`PROPOSED`** (Fungsi Belum Ada di Basis Data)
- **Bukti File / Kode:**  
  Pencarian kata kunci `reset_employee_kiosk_pin` pada seluruh berkas migrasi `supabase/migrations/*.sql` menghasilkan **0 baris**.
- **Jenis Pemeriksaan:** Migration Source Inspection.
- **Kekurangan Bukti:**  
  Fungsi ini **belum pernah dibuat atau dideklarasikan** di dalam migrasi kanonikal maupun draft migrasi `20261105000001_remediate_rls_security.sql`. Fungsi ini berstatus murni sebagai usulan desain (*design draft*).
- **Tindakan Berikutnya:**  
  Turunkan status dari `VERIFIED` menjadi **`PROPOSED`**. Sertakan DDL fungsi ini ke dalam paket migrasi remediasi jika disetujui.

---

### KLAIM 7: Hasil Pengujian Matriks (VAL-01 s/d VAL-15)

- **Teks Klaim Sebelumnya:**  
  *"VAL-01 s/d VAL-15: Status: VERIFIED"*
- **Status Hasil Audit:** **`PROPOSED (TEST SPECIFICATION ONLY)`**
- **Bukti File / Kode:**  
  Tidak ada log eksekusi terminal atau tabel hasil yang membuktikan pengujian VAL-01 s/d VAL-15 pernah dijalankan pada PostgreSQL nyata. Repositori saat ini berada dalam status zero-mutation terhadap database remote.
- **Jenis Pemeriksaan:** Workspace State & Execution Log Audit.
- **Kekurangan Bukti:**  
  Klaim hasil uji tersebut merupakan **kriteria kelulusan teoritis (expected outcomes)**, bukan hasil pengujian runtime aktual.
- **Tindakan Berikutnya:**  
  Ubah judul tabel menjadi **`TEST SPECIFICATION & ACCEPTANCE CRITERIA`**, bukan hasil pengujian terverifikasi.

---

## 3. INVENTARIS KLAIM YANG BENAR-BENAR TERBUKTI (GENUINELY VERIFIED)

Berdasarkan inspeksi statis kode dan bukti katalog, hanya klaim berikut yang sah berstatus **`VERIFIED`**:

1. **Immutabilitas Jejak Audit:**  
   Trigger `trg_protect_audit_logs` melempar error `P0001` saat UPDATE/DELETE ([`20261104000001_core_schema_v3_1_0.sql#L1251`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/supabase/migrations/20261104000001_core_schema_v3_1_0.sql#L1251)).
2. **Ketiadaan Hak CREATE Publik:**  
   Katalog membuktikan `has_schema_privilege('public', 'public', 'CREATE') = false` ([`PHASE_1_FINAL_SECURITY_APPROVAL.md#L85`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/PHASE_1_FINAL_SECURITY_APPROVAL.md#L85)).
3. **Penyerap Gaji Memfilter Tip:**  
   `calculate_and_finalize_payroll_atomic` hanya menarik `status = 'VERIFIED' AND payroll_period_id IS NULL` ([`20261104000001_core_schema_v3_1_0.sql#L1720`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/supabase/migrations/20261104000001_core_schema_v3_1_0.sql#L1720)).
4. **Exclusion Constraint Jadwal Armada:**  
   Constraint `excl_active_vehicle_booking` terpasang fisik dengan status `APPROVED` dan `IN_USE` ([`20261104000001_core_schema_v3_1_0.sql#L1067`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/supabase/migrations/20261104000001_core_schema_v3_1_0.sql#L1067)).
5. **Format Validitas Bcrypt Hash:**  
   String `$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy` terbukti merupakan struktur Bcrypt cost 10 valid via runtime parser Node.js.

---

## 4. KEPUTUSAN FINAL AUDIT BUKTI (FINAL VERDICT)

> ### **FINAL VERDICT: READY WITH CONDITIONS**

### Blocker yang Ditetapkan:
1. **[EVIDENCE GAP 1 — RUNTIME BENCHMARK]:** Seluruh klaim performa Bcrypt dan timing attack wajib diuji secara empiris pada database nyata sebelum Phase 1 dapat dinyatakan lulus.
2. **[EVIDENCE GAP 2 — EXTENSION NAMESPACE]:** Query katalog `SELECT nspname FROM pg_extension ...` harus dijalankan saat staging database aktif untuk mengonfirmasi lokasi skema `pgcrypto`.
3. **[EVIDENCE GAP 3 — BUSINESS OPERATIONAL BOUNDS]:** Batas fisik potongan kaca wajib disahkan oleh pihak operasional, bukan bersandar pada angka perkiraan.
4. **[ZERO PRODUCTION MUTATION]:** Supabase Production tetap terlindungi murni dalam status *read-only*.

*Phase 1 tetap berstatus **`OPEN`**.*

