# PHASE 1 — SECURITY REMEDIATION PREPARATION
## KUK Management System v3.1.0

**Tanggal Evaluasi:** 2026-11-05 13:40:00 +07:00  
**Baseline Repositori:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Status Fase 1:** **`OPEN`** (Belum Ditutup)  
**Target Basis Data:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — **STRICTLY ZERO MUTATION / READ-ONLY**  
**Dokumen Referensi:**
- `supabase/migrations/20261104000001_core_schema_v3_1_0.sql` (Baseline Schema)
- `supabase/migrations/20261104000002_harden_rpc_security.sql` (Hardened RPC Baseline)
- `supabase/migrations/20261105000001_remediate_rls_security.sql` (Draft Remediasi RLS Lokal)
- `scripts/test_rls_security_harness.sql` (Draft Spesifikasi Pengujian)
- `docs/ROLE_PERMISSION_MATRIX.md` (Matriks Kewenangan RBAC)

---

## 1. INVENTARIS TEMUAN KEAMANAN & STATUS PEMBUKTIAN

Berdasarkan audit statis komparatif antara kode skema produksi dan analisis mekanisme PostgreSQL RLS Engine, berikut adalah status definitif dari setiap temuan:

| ID Temuan | Komponen / Objek | Klasifikasi Risiko | Status Pembuktian | Ringkasan Analisis |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | `glass_tips` (`glass_tips_insert_anon`) | **CRITICAL** | **TERBUKTI SECARA TEKNIS (PROVEN)** | Klausul `WITH CHECK (true)` di skema awal mengizinkan klien anonim meng-insert baris tip dengan `status = 'VERIFIED'` dan `verified_amount` bernilai nominal berapa pun. Pada akhir bulan, fungsi `calculate_and_finalize_payroll_atomic` menyerap semua tip `VERIFIED` tanpa verifikasi fisik lanjutan. |
| **SEC-02** | `vehicle_borrowing_requests` (`vehicle_borrowing_requests_insert_anon`) | **HIGH** | **TERBUKTI SECARA TEKNIS (PROVEN)** | Klausul `WITH CHECK (true)` dan kolom `approved_by` yang nullable memungkinkan klien publik mengirimkan data peminjaman dengan status langsung `'APPROVED'`. Melalui exclusion constraint `excl_active_vehicle_booking`, pemesanan ini memblokir armada dari pemesanan sah lainnya. |
| **SEC-03** | `audit_logs` (`audit_logs_insert`) | **HIGH** | **TERBUKTI SECARA TEKNIS (PROVEN)** | Policy awal mengizinkan role `authenticated` melakukan `INSERT WITH CHECK (true)` tanpa mencocokkan `actor_id = auth.uid()`. Karyawan atau kasir dapat memalsukan baris audit dengan menaruh UUID Super Admin pada `actor_id`. |
| **SEC-04** | 4 Tabel Kepatuhan (`leave_requests`, `warning_letters`, `violation_records`, `attendance_daily_records`) | **HIGH** | **TERBUKTI SECARA TEKNIS (PROVEN)** | Policy `FOR ALL` berbasis permission unit (`*.manage`) mengizinkan manajer unit menghapus fisik baris transaksional (`DELETE`). Mengingat evaluasi policy permissive bersifat `OR`, ketiadaan policy `RESTRICTIVE` membuka peluang penghilangan jejak pelanggaran atau riwayat cuti. |
| **SEC-05** | `public_form_tokens` (`public_form_tokens_anon_insert`) | **MEDIUM** | **TERBUKTI SECARA TEKNIS (PROVEN)** | Hak `GRANT INSERT ON TABLE public_form_tokens TO anon` terbuka bersamaan dengan policy `WITH CHECK (true)`. Tabel berstatus dormant (tidak dikonsumsi antarmuka mana pun), sehingga membuka celah eksploitasi *storage bloat* / spam DoS. |
| **SEC-06** | `employee_job_history` (`employee_job_history_read/insert`) | **MEDIUM (BUG RLS)** | **TERBUKTI SECARA TEKNIS (PROVEN)** | Policy skema awal merujuk pada kolom `unit_id` yang tidak ada dalam tabel fisik (tabel menggunakan `from_unit_id` dan `to_unit_id`). Setiap kueri SELECT/INSERT pada tabel ini akan menghasilkan error `42703 (undefined column)` pada runtime PostgreSQL. |
| **SEC-07** | `system_notifications` (`system_notifications_read_recipient`) | **MEDIUM (BUG RLS)** | **TERBUKTI SECARA TEKNIS (PROVEN)** | Policy awal merujuk pada `recipient_profile_id` yang tidak ada (kolom asli adalah `recipient_user_id`). Menyebabkan kegagalan runtime saat pengguna membaca notifikasi mereka. |
| **SEC-08** | Helper Functions RLS Context Switching | **LOW** | **MEMBUTUHKAN UJI DB NYATA (NEEDS REAL DB TEST)** | Perilaku helper functions (`has_unit_permission`, `has_system_role`) saat beroperasi di bawah sesi PostgREST dengan multi-tenant JWT claims. Perlu pengujian performa cache dan penanganan klaim `sub` kosong. |
| **SEC-09** | Deadlock pada Konkurensi Payroll Atomic | **MEDIUM** | **DUGAAN (HYPOTHESIS / NEEDS REAL DB TEST)** | Potensi lock contention antara `calculate_and_finalize_payroll_atomic` (`FOR UPDATE` pada `payroll_periods`) dengan operasi manual kasir pada `glass_tips` di bawah beban konkurensi tinggi. |

---

## 2. ANALISIS MENDALAM DRAFT MIGRASI (`20261105000001_remediate_rls_security.sql`)

### 2.1. Validasi Sintaks dan Logika Policy yang Dibuat / Diubah

```text
+------------------------------------------------------------------------------------------------------------------+
| Objek Database                 | Jenis Aksi         | Klausul Perlindungan Baru                                   | Status Validasi |
+------------------------------------------------------------------------------------------------------------------+
| public.glass_tips              | DROP & CREATE      | WITH CHECK (status = 'PENDING' AND verified_amount IS NULL  | SANGAT EFEKTIF  |
|                                | FOR INSERT TO anon |             AND payroll_period_id IS NULL)                  |                 |
|                                |                    |                                                             |                 |
| public.vehicle_borrowing_      | DROP & CREATE      | WITH CHECK (status = 'PENDING' AND approved_by IS NULL      | SANGAT EFEKTIF  |
| requests                       | FOR INSERT TO anon |             AND approved_at IS NULL                         |                 |
|                                |                    |             AND cancellation_reason IS NULL)                |                 |
|                                |                    |                                                             |                 |
| public.audit_logs              | DROP & CREATE      | WITH CHECK (actor_id = auth.uid())                          | SANGAT EFEKTIF  |
|                                | FOR INSERT TO auth |                                                             |                 |
|                                |                    |                                                             |                 |
| public.leave_requests          | CREATE RESTRICTIVE | FOR DELETE TO authenticated USING (false)                   | MUTLAK MENOLAK  |
| public.warning_letters         | CREATE RESTRICTIVE | FOR DELETE TO authenticated USING (false)                   | MUTLAK MENOLAK  |
| public.violation_records       | CREATE RESTRICTIVE | FOR DELETE TO authenticated USING (false)                   | MUTLAK MENOLAK  |
| public.attendance_daily_records| CREATE RESTRICTIVE | FOR DELETE TO authenticated USING (false)                   | MUTLAK MENOLAK  |
|                                |                    |                                                             |                 |
| public.public_form_tokens      | DROP POLICY &      | REVOKE INSERT ON TABLE public_form_tokens FROM anon         | BERSIH & AMAN   |
|                                | REVOKE GRANT       |                                                             |                 |
|                                |                    |                                                             |                 |
| public.employee_job_history    | DROP & CREATE      | USING has_unit_permission(to_unit_id, 'employees.view') ... | MEMPERBAIKI BUG |
| public.system_notifications    | DROP & CREATE      | USING (recipient_user_id = auth.uid() OR ... IS NULL)       | MEMPERBAIKI BUG |
+------------------------------------------------------------------------------------------------------------------+
```

### 2.2. Mekanisme RESTRICTIVE DELETE Policies
Dalam arsitektur PostgreSQL Row-Level Security:
$$\text{Izin Akses Akhir} = (\text{Permissive Policy}_1 \lor \text{Permissive Policy}_2 \lor \dots) \land (\text{Restrictive Policy}_1 \land \text{Restrictive Policy}_2 \land \dots)$$
- Pada skema awal, tabel transaksional memiliki policy permissive `FOR ALL` berbasis permission unit.
- Jika dibuat policy penolakan delete bertipe **PERMISSIVE** dengan `USING (false)`, operasi DELETE tetap diizinkan karena $(\text{True} \lor \text{False}) = \text{True}$.
- Penggunaan klausul **`AS RESTRICTIVE`** menghasilkan evaluasi $(\text{Permissive Policies}) \land \text{False} = \text{False}$.
- **Kesimpulan:** 4 kebijakan RESTRICTIVE delete menolak mutlak operasi hard-delete oleh role `authenticated` apa pun (termasuk manajer unit), tanpa mengganggu hak SELECT, INSERT, atau UPDATE.

### 2.3. Potensi Konflik dengan 107 Kebijakan Eksisting
- **Idempotensi:** Semua pernyataan pembuatan policy diawali dengan `DROP POLICY IF EXISTS "..." ON ...;` sehingga aman dijalankan berulang kali.
- **Interferensi Relasi:** Policy baru tidak mengubah skema tipe data kolom atau foreign key. Foreign key cascade/restrict tetap utuh.
- **Catatan Rekomendasi:** Draft migrasi saat ini belum dibungkus secara eksplisit dengan `BEGIN;` dan `COMMIT;`. Saat diterapkan, disarankan untuk menyertakan blok transaksi agar kegagalan parsial langsung di-rollback.

---

## 3. RLS SECURITY ACCESS MATRIX

Matriks evaluasi konseptual akses data terhadap 6 profil peran di bawah rancangan migrasi remediasi:

| Operasi / Skenario Keamanan | Anonim (`anon`) | Auth Staf Biasa (Kasir / No Role) | Admin Unit La Tansa | Admin Unit Palen | Admin Pusat | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **SELECT Profil Publik / Org** | DENIED (0 rows) | ALLOWED (Unit Sendiri) | ALLOWED (Unit La Tansa) | ALLOWED (Unit Palen) | ALLOWED (Seluruh Org) | ALLOWED (Seluruh Sistem) |
| **SELECT Karyawan Umum** | DENIED | ALLOWED (Unit Sendiri) | ALLOWED (Unit La Tansa) | ALLOWED (Unit Palen) | ALLOWED (Seluruh Org) | ALLOWED (Seluruh Sistem) |
| **SELECT Data Sensitif (Gaji/NIK)** | DENIED | **DENIED** | ALLOWED (Unit La Tansa) | ALLOWED (Unit Palen) | ALLOWED (Seluruh Org) | ALLOWED (Seluruh Sistem) |
| **UPDATE Data Sensitif Karyawan** | DENIED | **DENIED** | ALLOWED (`manage_sensitive`) | ALLOWED (`manage_sensitive`) | ALLOWED | ALLOWED |
| **Akses Lintas Unit (La Tansa vs Palen)** | DENIED | **TERISOLASI (0 rows)** | **TERISOLASI (0 rows)** | **TERISOLASI (0 rows)** | ALLOWED (Konsolidasi) | ALLOWED (Penuh) |
| **Manipulasi `unit_id` pada INSERT** | REJECT (42501) | REJECT (42501) | REJECT jika $\ne$ La Tansa | REJECT jika $\ne$ Palen | ALLOWED (Unit Org) | ALLOWED |
| **Injeksi Tip Kaca `status = 'VERIFIED'`** | **REJECT (42501)** | **REJECT (42501)** | REJECT (Wajib via Update) | REJECT (Wajib via Update) | REJECT | REJECT |
| **Pengajuan Tip Kaca `PENDING` (Formulir)** | **ALLOWED** | **ALLOWED** | ALLOWED | ALLOWED | ALLOWED | ALLOWED |
| **Injeksi Armada `status = 'APPROVED'`** | **REJECT (42501)** | **REJECT (42501)** | REJECT (Wajib via Update) | REJECT (Wajib via Update) | REJECT | REJECT |
| **Pengajuan Armada `PENDING` (Formulir)** | **ALLOWED** | **ALLOWED** | ALLOWED | ALLOWED | ALLOWED | ALLOWED |
| **INSERT Audit Log (`actor_id = auth.uid()`)** | DENIED | ALLOWED | ALLOWED | ALLOWED | ALLOWED | ALLOWED |
| **Pemalsuan `actor_id` Audit Log** | DENIED | **REJECT (42501)** | **REJECT (42501)** | **REJECT (42501)** | **REJECT (42501)** | **REJECT (42501)** |
| **UPDATE / DELETE Audit Log** | DENIED | **REJECT (P0001 Trigger)**| **REJECT (P0001 Trigger)** | **REJECT (P0001 Trigger)** | **REJECT (P0001 Trigger)**| **REJECT (P0001 Trigger)**|
| **Hard DELETE Cuti / SP / Pelanggaran** | DENIED | **REJECT (42501 Restrictive)**| **REJECT (42501 Restrictive)**| **REJECT (42501 Restrictive)**| **REJECT (42501 Restrictive)**| **REJECT (42501 Restrictive)**|
| **Pembatalan Cuti (Soft Cancel via RPC)** | DENIED | **DENIED** | ALLOWED (Cuti La Tansa) | ALLOWED (Cuti Palen) | ALLOWED | ALLOWED |
| **INSERT `public_form_tokens`** | **REJECT (42501 Revoked)**| DENIED | DENIED | DENIED | DENIED | DENIED |

---

## 4. TEST PREPARATION & COVERAGE GAP ANALYSIS

### 4.1. Evaluasi `scripts/test_rls_security_harness.sql`
Skrip harness yang ada di repositori dirancang dengan arsitektur transaksi rollback (`BEGIN ... ROLLBACK;`) dengan positive control.

**Skenario yang Sudah Tercakup:**
1. `RLS-01`: Positif kontrol pembacaan karyawan oleh Admin La Tansa.
2. `RLS-02`: Isolasi horizontal antar unit (Admin La Tansa membaca Karyawan Palen).
3. `RLS-11`: Immutabilitas audit log terhadap modifikasi UPDATE (rejection trigger `P0001`).
4. `RLS-14`: Penolakan pembacaan organisasi oleh anonim.
5. `RLS-15`: Penolakan pembacaan karyawan oleh anonim.
6. `RLS-16`: Akses armada berstatus AVAILABLE oleh publik.
7. `RLS-17`: Penolakan pembacaan armada berstatus MAINTENANCE oleh publik.
8. `RLS-18`: Penolakan INSERT organisasi oleh publik (`42501`).

### 4.2. Kesenjangan Cakupan Uji (Coverage Gap):
Pengujian berikut **BELUM** tercakup di dalam harness dan wajib ditambahkan:
1. **Verifikasi Penolakan Injeksi Tip Kaca:**
   - Test Case: `anon` mencoba `INSERT INTO glass_tips (status, verified_amount) VALUES ('VERIFIED', 500000)`. Ekspektasi: REJECT `42501`.
   - Test Case: `anon` mencoba `INSERT INTO glass_tips (status, verified_amount) VALUES ('PENDING', NULL)`. Ekspektasi: ALLOW (201 Created).
2. **Verifikasi Penolakan Injeksi Armada:**
   - Test Case: `anon` mencoba `INSERT INTO vehicle_borrowing_requests (status, approved_by) VALUES ('APPROVED', gen_random_uuid())`. Ekspektasi: REJECT `42501`.
3. **Verifikasi Pemalsuan Identitas Audit Log:**
   - Test Case: `authenticated` mencoba `INSERT INTO audit_logs (actor_id) VALUES (other_user_id)`. Ekspektasi: REJECT `42501`.
4. **Verifikasi RESTRICTIVE DELETE Policy:**
   - Test Case: Unit Admin (yang memiliki izin `leave.manage`) mencoba `DELETE FROM leave_requests WHERE id = '...'`. Ekspektasi: REJECT `42501`.
   - Test Case: Unit Admin mencoba `DELETE FROM warning_letters`. Ekspektasi: REJECT `42501`.
   - Test Case: Unit Admin mencoba `DELETE FROM violation_records`. Ekspektasi: REJECT `42501`.
   - Test Case: Unit Admin mencoba `DELETE FROM attendance_daily_records`. Ekspektasi: REJECT `42501`.
5. **Verifikasi Pencabutan Hak Token Formulir:**
   - Test Case: `anon` mencoba `INSERT INTO public_form_tokens`. Ekspektasi: REJECT `42501` (Permission Denied).
6. **Verifikasi Kolom Bug Fix:**
   - Test Case: Kueri SELECT pada `employee_job_history` (harus berhasil tanpa error `unit_id does not exist`).
   - Test Case: Kueri SELECT pada `system_notifications` (harus berhasil tanpa error `recipient_profile_id does not exist`).

---

## 5. EVALUASI DAN REKOMENDASI STRATEGI ENVIRONMENT

### 5.1. Analisis Kendala & Kondisi
- **Supabase Cloud Production (`ckzciuybedefbsdfsexh`)**: DILARANG MUTLAK untuk eksperimen atau pengujian migrasi.
- **Docker**: Tidak digunakan di lingkungan pengembangan saat ini.
- **PostgreSQL Lokal**: Binary engine `psql`/`postgres` tidak terpasang di sistem PATH Windows lokal.
- **Paket Supabase**: Akun Supabase Free tier mengizinkan hingga **2 proyek aktif** secara gratis.

### 5.2. Opsi Lingkungan Pengujian

| Opsi Lingkungan | Deskripsi | Risiko Terhadap Prod | Kemudahan Eksekusi | Akurasi Terhadap Prod |
| :--- | :--- | :---: | :---: | :---: |
| **Opsi A: Dedicated Supabase Free Project (Staging/Sandbox)** | Membuat proyek kedua gratis di dashboard Supabase (misal `kuk-v3-staging`). Menjalankan baseline migrasi + migrasi remediasi. | **0% (Nol)** | **Tinggi (2 menit)** | **100% Identik** (Engine PostgreSQL 17, PostgREST, Auth Schema) |
| **Opsi B: Portable PostgreSQL 17 Windows (Zero-Install)** | Mengunduh portable zip PostgreSQL 17, `initdb` di direktori terisolasi, simulasi skema `auth`. | **0% (Nol)** | **Sedang** | **90%** (Perlu mock fungsi ekstensi Supabase `auth.uid()`) |
| **Opsi C: PGlite (WASM Postgres di Node.js)** | Menggunakan `@electric-sql/pglite` di script runner Node.js. | **0% (Nol)** | **Cepat** | **75%** (Keterbatasan dukungan ekstensi `btree_gist`) |

### 5.3. Rekomendasi Utama (Paling Aman, Realistis, dan Akurat)
> [!IMPORTANT]
> **REKOMENDASI: Opsi A — Dedicated Supabase Free Staging Project**
> 1. Akun Supabase Free Plan memiliki kuota **2 proyek aktif**. Proyek 1 saat ini adalah Production.
> 2. Proyek ke-2 dapat dibuat melalui Supabase Web UI tanpa biaya sepeser pun.
> 3. Lingkungan ini menyediakan ekosistem Supabase lengkap (PostgreSQL 17, auth schema resmi, PostgREST, dan JWT handling) yang 100% identik dengan Production.
> 4. Seluruh skrip migrasi dan uji RLS dapat dieksekusi secara nyata tanpa ada risiko kebocoran, modifikasi data, atau downtime pada Supabase Production.

---

## 6. LANGKAH BERIKUTNYA (ACTION PLAN)

1. **Persiapan Paket Uji Lengkap (Test Package Completion):**
   - Perluas berkas `scripts/test_rls_security_harness.sql` untuk memuat 6 skenario baru (penolakan tip injeksi, armada injeksi, audit spoofing, restrictive delete, dan token revocation).
2. **Penyediaan Staging Project (User Action):**
   - Pengguna membuat 1 proyek Supabase baru di Dashboard (misal: `kuk-staging`).
   - Salin URL dan anon key staging ke konfigurasi pengujian terisolasi (bukan file `.env` utama).
3. **Eksekusi dan Verifikasi pada Staging:**
   - Terapkan `20261104000001_core_schema_v3_1_0.sql`.
   - Terapkan `20261104000002_harden_rpc_security.sql`.
   - Terapkan `20261105000001_remediate_rls_security.sql`.
   - Jalankan `test_rls_security_harness.sql` dan catat log hasil pengujian aktual.
4. **Evaluasi Penutupan Phase 1:**
   - Setelah seluruh pengujian pada staging environment menghasilkan status **PASS (100%)**, susun laporan penutupan dan ajukan jadwal rollout ke Supabase Production dengan otorisasi tertulis.

