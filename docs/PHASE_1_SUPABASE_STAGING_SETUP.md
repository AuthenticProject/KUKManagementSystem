# PHASE 1 SUPABASE STAGING SETUP & MIGRATION AUDIT
## Supabase CLI Integration, Schema Compatibility & Safe Deployment Guide (v3.1.0)
**Tanggal Audit:** 2026-11-04  
**Versi Sistem:** 3.1.0  
**Target Staging Project:** `ckzciuybedefbsdfsexh` (`https://ckzciuybedefbsdfsexh.supabase.co`)  
**Status Fase:** PHASE 1 — AUDITED & READY (AWAITING APPROVAL TO PUSH)

---

## 1. Hasil Audit Kompatibilitas Skema Migrasi Kanonikal

Audit teknis mendalam terhadap file migrasi utama:  
📁 `supabase/migrations/20261104000001_core_schema_v3_1_0.sql` (86.590 bytes, 2.084 baris SQL)

| Kriteria Kompatibilitas | Standar Supabase Cloud PostgreSQL 15+ | Status Audit | Catatan Teknis |
| :--- | :--- | :---: | :--- |
| **Ketiadaan Perintah Khusus PSQL** | Dilarang memuat `\echo`, `\c`, `\i`, `\set` | **PASSED** | 0 perintah meta psql. 100% standar ANSI/PostgreSQL DDL. |
| **Ketiadaan Perintah Destruktif** | Dilarang memuat `DROP TABLE`, `TRUNCATE` liar | **PASSED** | 0 operasi penghapusan destruktif. |
| **Penggunaan Ekstensi** | Mendukung `pgcrypto` dan `btree_gist` | **PASSED** | Menggunakan `CREATE EXTENSION IF NOT EXISTS`. |
| **Relasi Schema Auth Supabase** | `profiles.id REFERENCES auth.users(id)` | **PASSED** | Sesuai arsitektur bawaan Supabase Auth (`ON DELETE CASCADE`). |
| **Proteksi Search Path Function** | Mencegah pembajakan search path | **PASSED** | Seluruh 10 fungsi `SECURITY DEFINER` menyertakan `SET search_path = public, pg_temp`. |
| **Cakupan Row Level Security** | Seluruh tabel wajib mengaktifkan RLS | **PASSED** | **60 dari 60 tabel (100%)** memiliki `ENABLE ROW LEVEL SECURITY;`. |
| **Urutan Dependensi Antar-Tabel** | Nol forward-reference foreign key | **PASSED** | Seluruh tabel tujuan dibuat sebelum tabel yang mengacu padanya. |

---

## 2. Temuan Kritis & Remediasi Kolom RLS yang Diterapkan

Saat dilakukan simulasi eksekusi skema, terdeteksi 2 ketidaksesuaian nama kolom pada Seksi 14 (RLS Policies):

### 2.1 Mismatch pada Tabel `employee_job_history` (ERROR 42703)
- **Gejala Awal**: PostgreSQL melempar galat `ERROR: 42703: column "unit_id" does not exist. HINT: Perhaps you meant to reference the column "employee_job_history.to_unit_id".`
- **Penyebab**: Tabel `employee_job_history` mencatat mutasi antar-unit sehingga kolom yang ada adalah `from_unit_id` dan `to_unit_id`, bukan `unit_id`.
- **Tindakan Perbaikan**: Kebijakan RLS diperbaiki menjadi:
  ```sql
  CREATE POLICY "employee_job_history_read" ON employee_job_history FOR SELECT TO authenticated
      USING (has_unit_permission(to_unit_id, 'employees.view') OR (from_unit_id IS NOT NULL AND has_unit_permission(from_unit_id, 'employees.view')));
  CREATE POLICY "employee_job_history_insert" ON employee_job_history FOR INSERT TO authenticated
      WITH CHECK (has_unit_permission(to_unit_id, 'employees.update'));
  ```

### 2.2 Mismatch pada Tabel `system_notifications`
- **Penyebab**: Kebijakan RLS sebelumnya mengacu ke `recipient_profile_id`, sedangkan nama kolom aktual pada definisi tabel adalah `recipient_user_id`.
- **Tindakan Perbaikan**: Kebijakan RLS diperbaiki menjadi:
  ```sql
  CREATE POLICY "system_notifications_read_recipient" ON system_notifications FOR SELECT TO authenticated
      USING (recipient_user_id = auth.uid() OR recipient_user_id IS NULL);
  ```

Hasil verifikasi ulang menggunakan skrip [`scripts/audit_rls_columns.js`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/scripts/audit_rls_columns.js) membuktikan **0 kesalahan kolom** pada seluruh 60 tabel dan kebijakannya.

---

## 3. Konfigurasi Supabase CLI (`supabase/config.toml`)

File konfigurasi [`supabase/config.toml`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/supabase/config.toml) telah disiapkan tanpa mengganggu file migrasi yang ada:

```toml
# KUK Management System v3.1.0 — Supabase Configuration
project_id = "ckzciuybedefbsdfsexh"

[api]
enabled = true
port = 54321
schemas = ["public", "storage", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323

[auth]
enabled = true
site_url = "http://127.0.0.1:5173"
additional_redirect_urls = ["https://127.0.0.1:5173"]
jwt_expiry = 3600
enable_signup = false

[storage]
enabled = true
file_size_limit = "50MiB"
```

---

## 4. Prosedur Penerapan Migration via Supabase CLI

Untuk menghubungkan dan menerapkan migrasi ke Supabase Staging menggunakan Supabase CLI, ikuti langkah standar berikut:

### Langkah 1: Login Akun Supabase CLI
Buat Personal Access Token di dashboard akun Anda:  
👉 [https://supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)

Jalankan perintah:
```bash
npx.cmd supabase login
```
*(Masukkan Access Token yang dibuat).*

### Langkah 2: Hubungkan Proyek Staging (`supabase link`)
Jalankan perintah linking ke proyek staging:
```bash
npx.cmd supabase link --project-ref ckzciuybedefbsdfsexh
```
*(CLI akan meminta Database Password yang ditentukan saat pembuatan database).*

### Langkah 3: Pratinjau Daftar Migrasi (`migration list`)
Periksa status migrasi lokal terhadap remote database staging:
```bash
npx.cmd supabase migration list
```
*(File `20261104000001_core_schema_v3_1_0.sql` akan berstatus belum diterapkan pada remote).*

### Langkah 4: Terapkan Migrasi (`db push`) — *Menunggu Persetujuan*
Setelah mendapat persetujuan tertulis:
```bash
npx.cmd supabase db push
```
Supabase CLI akan:
1. Membuka koneksi aman ke PostgreSQL project `ckzciuybedefbsdfsexh`.
2. Mengeksekusi seluruh 2.084 baris SQL di dalam satu transaksi terisolasi.
3. Mencatat riwayat migrasi pada tabel sistem `supabase_migrations.schema_migrations`.
4. Mengembalikan status keberhasilan migrasi.

---

## 5. Analisis Risiko & Mitigasi

1. **Risiko Kerusakan Data Lama**:  
   - **Tingkat Risiko**: **Nol (None)**.
   - Proyek `ckzciuybedefbsdfsexh` merupakan proyek staging baru yang masih kosong. Tidak ada data operasional yang dapat terhapus.
2. **Risiko Kegagalan Parsial**:  
   - **Mitigasi**: `supabase db push` mengeksekusi migrasi di dalam blok transaksi PostgreSQL. Jika terjadi kesalahan pada baris manapun, seluruh perubahan akan di-*rollback* otomatis tanpa meninggalkan tabel separuh jadi.
3. **Risiko Akses Database Produksi**:  
   - **Mitigasi**: Referensi proyek dikunci secara eksplisit ke project ID staging (`ckzciuybedefbsdfsexh`). Tidak ada token atau koneksi ke produksi yang aktif.

---

## 6. Status & Batasan Saat Ini

- **Status**: **AUDIT LENGKAP · SIAP DIEKSEKUSI (READY TO PUSH)**
- **Kondisi**: `db push` **BELUM DIJALANKAN**, SQL **TIDAK DIJALANKAN DI DASHBOARD**, dan sistem **TETAP DI PHASE 1**.
- Menunggu persetujuan Anda untuk mengeksekusi `supabase link` dan `supabase db push`.

