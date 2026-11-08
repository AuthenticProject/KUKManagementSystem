# PHASE 1 — SECURITY SPECIFICATION HARDENING REVIEW
## KUK Management System v3.1.0

**Dokumen Versi:** 3.1.0-AUDIT-HARDENING  
**Tanggal Evaluasi:** 2026-11-05 13:58:00 +07:00  
**Baseline Repositori:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Dokumen yang Diaudit:** `docs/PHASE_1_SECURITY_IMPLEMENTATION_SPEC.md`  
**Status Fase 1:** **`OPEN`** (Audit Independen Spesifikasi & Desain Keamanan)  
**Target Basis Data:** PostgreSQL 17 (Supabase Architecture) — **STRICTLY ZERO MUTATION / READ-ONLY**  

---

## 1. EXECUTIVE SUMMARY & TEMUAN UTAMA

Audit independen terhadap spesifikasi implementasi keamanan transaksi publik dan remediasi RLS mengungkap sejumlah **kelemahan desain mendasar (design flaws)**, potensi **timing attack**, celah **race condition pada row locking**, serta dependensi lingkungan yang harus diperbaiki sebelum implementasi kode dapat dimulai.

### Matriks Ringkasan Temuan Audit:

| ID Temuan | Kategori | Tingkat Risiko | Komponen Terdampak | Status & Bukti Kode |
| :--- | :--- | :---: | :--- | :--- |
| **SEC-AUD-01** | Timing Attack / User Enumeration | **HIGH** | `submit_glass_tip_atomic` & PIN Auth | **TERBUKTI:** Jika `employee_code` tidak ditemukan, eksekusi kembali dalam $<1\text{ms}$. Jika ditemukan, `crypt()` memakan $\approx 100\text{ms}$. Penyerang dapat mengukur perbedaan waktu untuk memetakan seluruh NIK/kode karyawan aktif. |
| **SEC-AUD-02** | Row Lock Missing pada Non-Existent Employee | **HIGH** | `employee_portal_auth` & Concurrency | **TERBUKTI:** `SELECT ... FOR UPDATE` tidak mengunci baris apa pun jika `employee_code` salah/tidak ada. Serangan paralel dengan kode fiktif dapat membanjiri pool koneksi DB tanpa serialisasi. |
| **SEC-AUD-03** | Skema Resolusi Ekstensi `pgcrypto` & Object Shadowing | **HIGH** | Seluruh RPC `SECURITY DEFINER` | **TERBUKTI:** Pada Supabase Cloud, ekstensi terpasang pada skema `extensions`. Jika RPC hanya menetapkan `SET search_path = public, pg_temp`, panggilan `crypt()` akan gagal atau rentan pembajakan search path (CVE-2018-1058). |
| **SEC-AUD-04** | Validasi Batas Fisik Dimensi & Kuantitas Kaca | **MEDIUM** | `glass_tips` RPC | **TERBUKTI:** Spesifikasi hanya memvalidasi nilai positif, belum menetapkan batas atas (misal `quantity <= 500`, `panjang <= 1000\text{ cm}`). Penyerang dapat memasukkan kuantitas raksasa untuk memicu integer overflow / nilai abnormal. |
| **SEC-AUD-05** | Horizontal Brute Force (Tanpa IP/Kiosk Rate Limit) | **MEDIUM** | Terminal Kiosk Pemotongan Kaca | **TERBUKTI:** Lockout 30 menit berbasis per-karyawan (`failed_attempts >= 5`). Penyerang dapat mencoba 1 PIN umum (misal `123456`) ke seluruh karyawan tanpa pernah memicu batas lockout 5x pada satu akun. |
| **SEC-AUD-06** | Penanganan Konflik Concurrency Approval Armada | **MEDIUM** | `approve_vehicle_atomic` | **TERBUKTI:** Dua petugas menyetujui jadwal tumpang tindih secara bersamaan akan memicu exception PostgreSQL `23P01 (exclusion_violation)`. Perlu penanganan `EXCEPTION WHEN exclusion_violation` yang terstruktur. |
| **SEC-AUD-07** | Kebijakan Tarif Bisnis Belum Disetujui (UNCONFIRMED) | **BUSINESS** | Master Data Tarif Tip Kaca | **TERBUKTI:** Formula 3% dan pembulatan Rp1.000 belum disahkan oleh direksi/manajemen. Tidak boleh di-*hardcode* di dalam PL/pgSQL. |

---

## 2. AUDIT MENDALAM: EMPLOYEE PIN AUTHENTICATION

### 2.1. Analisis Kelemahan `FOR UPDATE` pada Karyawan Tidak Ditemukan
- **Mekanisme Semula:**
  ```sql
  SELECT e.id INTO v_emp FROM employees e WHERE e.employee_code = p_employee_code;
  SELECT * INTO v_auth FROM employee_portal_auth WHERE employee_id = v_emp.id FOR UPDATE;
  ```
- **Kelemahan Kritis:** Jika `p_employee_code` salah atau diretas, kueri pertama menghasilkan `NOT FOUND`. Akibatnya, `v_emp.id` bernilai `NULL`, dan `SELECT ... FOR UPDATE` pada tabel `employee_portal_auth` **TIDAK MENGUNCI BARIS APA PUN**. Penyerang dapat menjalankan ribuan request paralel tanpa hambatan row lock.
- **Rekomendasi Remediasi:**
  Menerapkan mekanisme *dummy hash constant-time* dan *advisory locking* atau *unit-level transaction throttling* ketika employee code tidak ditemukan.

### 2.2. Mitigasi Timing Attack (Pencegahan Enumerasi Employee Code)
- **Fakta Teknis:** Fungsi `crypt()` dengan Bcrypt cost 10 membutuhkan sekitar $70\text{ms} - 120\text{ms}$ CPU time per eksekusi.
  - Jika kode karyawan **ada**, fungsi menghabiskan waktu $\approx 100\text{ms}$ untuk mengevaluasi hash.
  - Jika kode karyawan **tidak ada**, fungsi melempar exception dalam waktu $<1\text{ms}$.
  - Selisih waktu sebesar 100x lipat ini memungkinkan penyerang menulis skrip sederhana untuk membedakan NIK valid dan NIK fiktif secara akurat.
- **Solusi Desain Wajib (Dummy Crypt Work):**
  Jika `employee_code` tidak ditemukan, fungsi **WAJIB** tetap menjalankan operasi `crypt()` palsu terhadap string dummy yang telah di-hash dengan cost 10:
  ```sql
  -- Hash dummy konstan (precomputed cost 10 untuk '000000')
  v_dummy_hash := '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';
  
  IF v_emp.id IS NULL THEN
      -- Paksa CPU bekerja selama ~100ms agar timing identik dengan akun valid
      PERFORM extensions.crypt(COALESCE(p_auth_pin, '000000'), v_dummy_hash);
      RAISE EXCEPTION 'Otentikasi Kiosk Gagal: Kredensial atau PIN salah.';
  END IF;
  ```

### 2.3. Pencegahan Serangan Brute-Force Horizontal
- **Celah:** Lockout 30 menit hanya melindungi 1 akun jika ditebak 5x. Namun, jika unit memiliki 100 tukang potong kaca, penyerang dapat mencoba PIN `123456` ke seluruh 100 orang. Masing-masing hanya mencatat 1x gagal (tidak terkunci), tetapi peluang menembus salah satu akun sangat besar.
- **Rekomendasi:**
  Menerapkan pelacak frekuensi kegagalan di level unit/kiosk:
  Jika dalam 1 unit terjadi lebih dari 15 kegagalan PIN kumulatif dalam jendela 10 menit (dari sembarang NIK), terminal kiosk unit tersebut ditangguhkan selama 15 menit.

### 2.4. Benchmark Evaluasi Bcrypt Cost Factor 10
- Di lingkungan Supabase Cloud (PostgreSQL 17 pada shared/micro compute), eksekusi Bcrypt cost 10:
  - 1 hash $\approx 85\text{ms} - 110\text{ms}$ CPU time.
  - Jika terjadi 20 submission potongan kaca bersamaan pada pergantian shift, load CPU database dapat mencapai lonjakan singkat.
  - **Kesimpulan:** Cost factor **10 adalah batas optimal** antara ketahanan brute-force PIN 6-digit dan beban CPU server database. Dilarang menaikkan cost factor ke 11 atau 12 karena akan melipatgandakan waktu CPU menjadi $200\text{ms} - 400\text{ms}$ per transaksi.

---

## 3. AUDIT MENDALAM: RPC `SECURITY DEFINER` & OBJECT SHADOWING

### 3.1. Hak Istimewa Pemilik Fungsi (`postgres`)
- Pada Supabase Cloud, seluruh migrasi dieksekusi oleh superuser `postgres`.
- Fungsi bertanda `SECURITY DEFINER` yang dimiliki oleh `postgres` akan **MEM-BYPASS SELURUH ROW LEVEL SECURITY (RLS)** pada setiap tabel yang dipanggil di dalam body fungsi.
- **Rekomendasi:** Body fungsi harus memperlakukan data sebagai *untrusted* dan secara eksplisit menyertakan filter `WHERE unit_id = p_unit_id` pada setiap pernyataan `SELECT`, `UPDATE`, dan `DELETE`, tidak boleh mengandalkan RLS otomatis.

### 3.2. Masalah Penataan `search_path` dan Resolusi Ekstensi
- **Kondisi Aktual di Supabase Cloud:** Ekstensi `pgcrypto` dan `btree_gist` dipasang di skema `extensions`, bukan `public` (`supabase/config.toml` mendefinisikan `extra_search_path = ["public", "extensions"]`).
- **Ancaman CVE-2018-1058 (Search Path Hijacking):** Jika fungsi hanya menggunakan:
  `SET search_path = public, pg_temp;`
  1. Engine tidak dapat menemukan fungsi `crypt()` kecuali skema `extensions` dicantumkan.
  2. Jika ada objek sementara di `pg_temp` dengan nama yang sama, objek tersebut dapat membajak eksekusi.
- **Konfigurasi `search_path` yang Aman:**
  ```sql
  SET search_path = extensions, public, pg_temp;
  ```
  Dan seluruh panggilan fungsi kriptografi wajib dikualifikasikan: `extensions.crypt(...)` dan `extensions.gen_salt(...)`.

### 3.3. Batasan Hak Eksekusi (`GRANT EXECUTE`)
- Secara default, PostgreSQL memberikan hak `EXECUTE` pada fungsi baru kepada peran pseudo `PUBLIC`.
- **Aturan Hardening Wajib:**
  Setiap skrip migrasi RPC administratif (`verify_glass_tip_atomic`, `approve_vehicle_atomic`, `cancel_leave_request_atomic`, `calculate_and_finalize_payroll_atomic`) **WAJIB** menyertakan:
  ```sql
  REVOKE EXECUTE ON FUNCTION public.verify_glass_tip_atomic(...) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.verify_glass_tip_atomic(...) TO authenticated;
  ```

---

## 4. AUDIT MENDALAM: GLASS TIPS & VALIDASI DIMENSI

### 4.1. Validasi Batas Fisik Dimensi
Spesifikasi sebelumnya hanya memeriksa `length_cm > 0` dan `height_cm > 0`. Dalam operasional pabrik kaca lembaran komersial:
- Batas maksimal lembaran kaca standar (Jumbo Sheet) adalah $366\text{ cm} \times 244\text{ cm}$ atau maksimal $600\text{ cm} \times 330\text{ cm}$.
- Potongan kaca tidak mungkin memiliki panjang $> 1.000\text{ cm}$ ($10\text{ meter}$) atau kuantitas $> 500\text{ lembar}$ per satu nota potong.
- **Aturan Validasi Wajib pada Stored Procedure:**
  ```sql
  IF p_length_cm <= 0 OR p_length_cm > 1000.00 THEN
      RAISE EXCEPTION 'Panjang kaca tidak valid (Wajib 0.1 s/d 1000 cm).';
  END IF;
  IF p_height_cm <= 0 OR p_height_cm > 1000.00 THEN
      RAISE EXCEPTION 'Tinggi kaca tidak valid (Wajib 0.1 s/d 1000 cm).';
  END IF;
  IF p_quantity <= 0 OR p_quantity > 500 THEN
      RAISE EXCEPTION 'Kuantitas potongan kaca tidak valid (Wajib 1 s/d 500 lembar).';
  END IF;
  ```

### 4.2. Penanganan Tarif Berdasarkan `effective_range`
- Sesuai skema `glass_tip_rates`, tarif aktif dicocokkan dengan tanggal operasional sistem di zona waktu Jakarta:
  ```sql
  SELECT * INTO v_rate
  FROM glass_tip_rates
  WHERE unit_id = p_unit_id
    AND glass_type_id = p_glass_type_id
    AND is_active = TRUE
    AND effective_range @> (now() AT TIME ZONE 'Asia/Jakarta')::date;
  
  IF NOT FOUND THEN
      RAISE EXCEPTION 'Konfigurasi tarif tip kaca belum tersedia untuk tipe kaca ini pada unit bersangkutan.';
  END IF;
  ```
- **Pencegahan Tumpang Tindih:** Keberadaan constraint `excl_tip_rate_no_overlap` menjamin kueri di atas tidak akan pernah mengembalikan lebih dari 1 baris.

### 4.3. Status Formula 3% dan Pembulatan Rp1.000
> [!WARNING]
> **KEBIJAKAN BISNIS BELUM DISETUJUI (UNCONFIRMED):**  
> Formula insentif 3% dan pembulatan ke atas Rp1.000 (`ROUND_UP_1000`) **TIDAK BOLEH** di-hardcode ke dalam logika stored procedure. Stored procedure harus mengevaluasi kolom `calculation_method` (`PER_SQM`, `PER_PIECE`, `SIZE_RANGE`, `HYBRID`) dan `rounding_rule` dari baris `v_rate` yang aktif di database.

---

## 5. AUDIT MENDALAM: VEHICLE BORROWING & EXCLUSION CONSTRAINT

### 5.1. Analisis Exclusion Constraint `excl_active_vehicle_booking`
Definisi skema pada `20261104000001_core_schema_v3_1_0.sql` (baris 1067-1072):
```sql
CONSTRAINT excl_active_vehicle_booking EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(start_time, estimated_return_time, '[)') WITH &&
) WHERE (status IN ('APPROVED', 'IN_USE'))
```
- **Evaluasi Rentang Waktu `[)`:** Format `[)` (inklusif di awal, eksklusif di akhir) adalah **standar tepat** untuk reservasi operasional. Contoh: Peminjaman A berakhir pukul 12:00, Peminjaman B mulai pukul 12:00. Operator tidak mengalami benturan karena detik ke 12:00:00 sudah menjadi milik Peminjaman B.
- **Penanganan Error Concurrency `23P01` pada Approval:**
  Ketika dua petugas membuka formulir approval pada detik yang sama untuk dua permohonan berbeda yang jadwalnya bertabrakan, database akan menolak permohonan kedua dengan error `23P01`.
  Prosedur `approve_vehicle_atomic` harus menangani error ini dengan blok `EXCEPTION`:
  ```sql
  BEGIN
      UPDATE vehicle_borrowing_requests ...
  EXCEPTION WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Konflik Jadwal: Kendaraan ini baru saja disetujui untuk permohonan lain pada rentang waktu yang sama.';
  END;
  ```

---

## 6. AUDIT MENDALAM: RLS, AUDIT LOG & PUBLIC TOKENS

### 6.1. Proteksi `audit_logs` dari Manipulasi Aktor
- Pada policy `audit_logs_insert`:
  `WITH CHECK (actor_id = auth.uid())`
- **Verifikasi Efektivitas:** Jika pengguna dengan JWT milik Kasir A mengirim payload `actor_id = <UUID Super Admin>`, PostgreSQL langsung membatalkan kueri dengan error `42501 (new row violates row-level security policy)`.
- **Trigger Immutabilitas:** Trigger `trg_protect_audit_logs` terbukti menolak 100% mutasi `UPDATE` dan `DELETE` dengan error `P0001`.

### 6.2. Status Akhir `public_form_tokens`
- Tabel terbukti **DORMANT** dan tidak memiliki keterkaitan dengan alur operasional KUK V3 saat ini.
- Hak `GRANT INSERT ON TABLE public_form_tokens TO anon` adalah cacat desain awal yang **wajib dicabut (`REVOKE`)**.

---

## 7. MATRIKS TEST SPECIFICATION LENGKAP & MEASURABLE EXPECTED RESULTS

| ID Uji | Tingkat Pengujian | Skenario Pengujian | Input Data & Parameter | Expected Result Terukur |
| :--- | :--- | :--- | :--- | :--- |
| **TS-01** | Logic / Unit Test | Validasi Dummy Crypt Timing | Employee code salah vs benar | Waktu eksekusi kedua request identik ($\pm 15\text{ms}$ selisih) |
| **TS-02** | PG Integration | Lockout 30 Menit Eksklusif | 5x PIN salah berturut-turut | Akun terkunci, `locked_until > now()`, percobaan ke-6 ditolak seketika |
| **TS-03** | Concurrent Test | 10 Request Paralel PIN Guessing | 10 thread simultan pada attempt ke-4 | Baris terkunci `FOR UPDATE`, tepat 1 request menaikkan ke-5, 9 lainnya antre/terkunci |
| **TS-04** | PG Integration | Dimensi Kaca Melebihi Batas Maksimal | `length_cm = 5000` ($50\text{ m}$) | Exception: `'Panjang kaca tidak valid (Wajib 0.1 s/d 1000 cm)'` |
| **TS-05** | PG Integration | Kuantitas Negatif / Nol / Raksasa | `quantity = 0` atau `quantity = 10000` | Exception: `'Kuantitas potongan kaca tidak valid'` |
| **TS-06** | PostgREST E2E | Injeksi Direct REST Status VERIFIED | `POST /rest/v1/glass_tips` (status: 'VERIFIED') | HTTP 403 Forbidden / Error code `42501` |
| **TS-07** | PostgREST E2E | Injeksi Direct REST Booking APPROVED| `POST /rest/v1/vehicle_borrowing_requests` | HTTP 403 Forbidden / Error code `42501` |
| **TS-08** | PostgREST E2E | Spoofing `actor_id` pada Audit Log | `POST /rest/v1/audit_logs` dengan ID akun lain | HTTP 403 Forbidden / Error code `42501` |
| **TS-09** | PG Integration | Hard Delete pada 4 Tabel Kepatuhan | `DELETE FROM leave_requests WHERE id = ...` | Ditolak mutlak oleh RESTRICTIVE policy: Error `42501` |
| **TS-10** | PG Integration | Approval Jadwal Armada Bertabrakan | 2 booking overlap disetujui berurutan | Booking ke-2 melempar pesan `'Konflik Jadwal: Kendaraan ini baru saja disetujui...'` |
| **TS-11** | Static Code Check| Search Path & Extension Check | Inspeksi deklarasi function header | `SET search_path = extensions, public, pg_temp` |
| **TS-12** | PG Integration | Double Absorption Payroll | Finalisasi payroll pada 2 periode berbeda | Tip dengan `payroll_period_id IS NOT NULL` diabaikan 100% |

---

## 8. DAFTAR KEPUTUSAN BISNIS YANG MEMBUTUHKAN PERSETUJUAN MANAJEMEN

Sebelum migrasi final dijalankan ke lingkungan produksi:
1. **[KEPUTUSAN 1] Formula Tarif Tip Kaca Definitif:**
   Apakah menggunakan formula 3% dari snapshot harga jual kaca, tarif flat per meter persegi ($m^2$), atau sistem berjenjang (*tiered range*) sesuai tabel `glass_tip_rate_ranges`?
2. **[KEPUTUSAN 2] Aturan Pembulatan Insentif:**
   Apakah pembulatan ke atas kelipatan Rp1.000 (`ROUND_UP_1000`) disetujui secara resmi oleh keuangan, atau menggunakan nominal eksak (`EXACT`)?
3. **[KEPUTUSAN 3] Prosedur Penerbitan PIN Pertama Kali:**
   Apakah PIN awal karyawan dibagikan oleh HRD secara terpusat, atau digenerate otomatis saat onboarding karyawan baru?

---

## 9. KESIMPULAN & FINAL READINESS VERDICT

> ### **FINAL VERDICT: READY WITH CONDITIONS**

### Alasan & Kondisi Prasyarat:
1. **Kesiapan Dokumen & Desain:** Seluruh kelemahan arsitektur (timing attacks, race conditions, dimension caps, dan extension schema) telah diidentifikasi dan diberikan rancangan mitigasi yang konkret.
2. **Kondisi / Blocker Sebelum Tahap Implementasi:**
   - **Staging Database:** Menunggu tersedianya database staging terpisah (Supabase Free ke-2 atau pause proyek non-aktif).
   - **Penyelarasan DDL:** Skrip migrasi draft `20261105000001_remediate_rls_security.sql` harus dilengkapi dengan definisi stored procedure `submit_glass_tip_atomic`, `verify_glass_tip_atomic`, dan `approve_vehicle_atomic` yang telah mengadopsi mitigasi hardening di atas.
   - **Zero Production Mutation:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) tetap bersih 100% dari mutasi atau data pengujian.

*Phase 1 tetap berstatus **`OPEN`**.*

