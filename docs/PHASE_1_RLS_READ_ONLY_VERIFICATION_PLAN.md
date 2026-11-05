# PHASE 1 — RLS READ-ONLY VERIFICATION PLAN
## KUK MANAGEMENT SYSTEM v3.1.0

**Tanggal Dokumen:** 2026-11-05  
**Auditor / Arsitek:** Antigravity Autonomous Agent  
**Target Environment:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — PostgreSQL 17.11.0.011  
**Status Dokumen:** **`RLS VERIFICATION PLAN APPROVED FOR READ-ONLY EXECUTION REVIEW — NOT EXECUTED`**  
**Batasan Operasional:** READ-ONLY DESIGN & SCHEMA AUDIT ONLY. DILARANG mengeksekusi kueri, DDL, DML, migration, pembuatan Auth user, maupun request HTTP ke Production pada sesi ini.

---

## 1. PENDAHULUAN & PRINSIP PENGUJIAN READ-ONLY

Dokumen ini mendefinisikan rencana verifikasi teknis *Row Level Security* (RLS) pada database Supabase Cloud Production berstatus *zero-state* (seluruh 60 tabel operasional v3.1.0 berstatus 0 baris data, 0 pengguna di `auth.users`).

Rencana ini memadukan dua pendekatan verifikasi yang sepenuhnya read-only dan non-destruktif:
1. **Inspeksi Katalog Sistem PostgreSQL:** Memeriksa status pengaktifan RLS pada 60 tabel kanonikal, memverifikasi privilege efektif via `has_table_privilege()`, dan mengevaluasi seluruh kebijakan RLS (termasuk implikasi target `PUBLIC`).
2. **Pengujian PostgREST REST API Layer (Client-Side Anon Key):** Merancang spesifikasi request HTTP `GET` anonim murni melalui PostgREST tanpa sesi pengguna, untuk memverifikasi isolasi API publik.

### Prinsip Keamanan & Integritas Audit:
- **Zero Assumptions:** Suatu skenario **DILARANG DIKLAIM PASS** tanpa adanya pembuktian empiris yang didukung data kontrol positif (*positive control*).
- **Limitasi Database Kosong (*Zero-State Limitation*):** Pembacaan yang menghasilkan 0 baris (`count = 0`) pada tabel kosong berstatus **`INCONCLUSIVE`** karena secara matematis tidak dapat membedakan antara filtrasi baris oleh RLS dengan ketiadaan data fisik pada tabel.
- **Pencegahan Kebocoran Rahasia:** Anon key tidak boleh dicetak atau diekspos dalam plain text pada log audit; gunakan referensi variabel lingkungan `process.env.VITE_SUPABASE_ANON_KEY` atau placeholder `<ANON_KEY>`. Penggunaan `service_role` key DILARANG MUTLAK.

---

## 2. METODE PEMBEDAAN: PRIVILEGE REJECTION VS RLS FILTERING

Dua lapisan otorisasi independen pada PostgreSQL mengatur akses data:

```
[Permintaan Klien (PostgREST API / Anon Key)]
                     │
                     ▼
       ┌───────────────────────────┐
       │ 1. Table Privilege Check  │ ──(TIDAK ADA PRIVILEGE)──> REJECT: ERROR 42501
       │    (has_table_privilege)  │                            "permission denied for table..."
       └─────────────┬─────────────┘                            (PostgREST: HTTP 401 / 403)
                     │ (MEMILIKI PRIVILEGE)
                     ▼
       ┌───────────────────────────┐
       │ 2. Row Level Security     │ ──(RLS NON-AKTIF)────────> Akses Seluruh Baris
       │    (relrowsecurity)       │
       └─────────────┬─────────────┘
                     │ (RLS AKTIF)
                     ▼
       ┌───────────────────────────┐
       │ 3. Evaluasi Kebijakan RLS │
       │    (pg_policies)          │
       └──────┬─────────────┬──────┘
              │             │
    (Operasi SELECT)   (Operasi INSERT/UPDATE/DELETE)
              │             │
    ┌─────────┴─────────┐ ┌─┴─────────────────────────────────┐
    │ USING = true      │ │ WITH CHECK = true  ──> Berhasil   │
    │  ──> Baris Tampak │ │ WITH CHECK = false ──> ERROR 42501│
    │ USING = false     │ │ "new row violates row-level       │
    │  ──> 0 baris      │ │  security policy for table..."    │
    │      (HTTP 200 [])│ └───────────────────────────────────┘
    └───────────────────┘
```

| Dimensi Evaluasi | Penolakan Hak Akses Tabel (Privilege Rejection) | Penolakan Baris RLS (RLS Filtering) |
| :--- | :--- | :--- |
| **Penyebab** | Role tidak memiliki hak tabel (`SELECT`, `INSERT`, dll.) | Role memiliki privilege, namun baris tidak memenuhi klausa `USING` / `WITH CHECK` |
| **Pemeriksaan Katalog** | `has_table_privilege(role, table, privilege)` bernilai `false` | `relrowsecurity = true`, ekspresi `qual` atau `with_check` menyaring baris |
| **Respon pada `SELECT`** | Fatal error SQLSTATE `42501` (`permission denied`), HTTP 401/403 | Mengembalikan himpunan kosong (**0 baris**, HTTP 200 `[]`) |
| **Respon pada `INSERT`** | Fatal error SQLSTATE `42501` (`permission denied for table ...`) | Error SQLSTATE `42501` (`new row violates row-level security policy...`) |
| **Dampak Tabel Kosong** | Tetap melempar error `42501` | Mengembalikan 0 baris (secara matematis tidak dapat dibedakan dari tabel kosong) |

---

## 3. RANCANGAN KUERI KATALOG SISTEM (READ-ONLY)

### Kueri 1: Audit Rekonsiliasi 60 Tabel Kanonikal vs Status RLS & Force RLS
- **Tujuan:** Memvalidasi bahwa seluruh 60 tabel operasional v3.1.0 benar-benar ada di remote dan RLS berstatus aktif (`relrowsecurity = true`) serta memeriksa status `relforcerowsecurity` secara terpisah. Kueri menggunakan *full outer join* terhadap daftar eksplisit 60 tabel kanonikal agar tabel yang hilang terdeteksi.
- **Kueri SQL:**
  ```sql
  WITH expected_tables(table_name) AS (
      VALUES 
          ('organizations'), ('units'), ('profiles'), ('roles'), ('permissions'), ('role_permissions'),
          ('user_system_roles'), ('user_unit_roles'), ('departments'), ('positions'), ('work_schedules'),
          ('employees'), ('employee_sensitive_data'), ('employee_portal_auth'), ('employee_status_history'),
          ('employee_job_history'), ('leave_policies'), ('leave_conflict_groups'), ('leave_conflict_departments'),
          ('leave_requests'), ('leave_request_dates'), ('leave_conflict_slots'), ('glass_types'),
          ('glass_tip_rates'), ('glass_tip_rate_ranges'), ('glass_tips'), ('glass_tip_verifications'),
          ('violation_types'), ('violation_point_rules'), ('warning_letter_templates'), ('violation_records'),
          ('warning_letters'), ('warning_letter_approvals'), ('briefing_sessions'), ('briefing_attendances'),
          ('fingerprint_devices'), ('employee_fingerprint_ids'), ('fingerprint_import_batches'),
          ('fingerprint_raw_logs'), ('attendance_daily_records'), ('attendance_adjustments'),
          ('salary_components'), ('employee_salary_structures'), ('employee_salary_component_items'),
          ('payroll_periods'), ('payroll_records'), ('payroll_items'), ('payroll_revisions'),
          ('vehicles'), ('vehicle_borrowing_requests'), ('vehicle_condition_inspections'), ('vehicle_damages'),
          ('vehicle_fuel_logs'), ('audit_logs'), ('activity_logs'), ('document_sequences'),
          ('system_notifications'), ('system_settings'), ('file_attachments'), ('public_form_tokens')
  )
  SELECT 
      e.table_name AS expected_table,
      c.relname AS actual_table,
      COALESCE(c.relrowsecurity, false) AS rls_enabled,
      COALESCE(c.relforcerowsecurity, false) AS rls_forced,
      CASE 
          WHEN c.relname IS NULL THEN 'MISSING_TABLE'
          WHEN NOT c.relrowsecurity THEN 'RLS_DISABLED'
          ELSE 'RLS_ACTIVE'
      END AS audit_status
  FROM expected_tables e
  LEFT JOIN (
      pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' AND c.relkind = 'r'
  ) ON c.relname = e.table_name
  ORDER BY e.table_name;
  ```
- **Kriteria Keberhasilan:**
  - 60 baris mengembalikan status `RLS_ACTIVE` (`rls_enabled = true`).
  - Nol tabel dengan status `MISSING_TABLE` atau `RLS_DISABLED`.
  - Pemeriksaan `relforcerowsecurity` didokumentasikan untuk mengetahui apakah superuser atau owner tabel dipaksa tunduk pada RLS.
  - Pencocokan namespace `public` secara langsung di dalam sub-join menjamin bahwa tabel dengan nama yang sama dari schema lain (misalnya `auth`, `storage`, atau `vault`) tidak akan pernah salah terhitung.

---

### Kueri 2: Audit Hak Akses Efektif via `has_table_privilege()`
- **Tujuan:** Mengetahui hak akses efektif (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) untuk role `anon` dan `authenticated` pada tabel kunci (`organizations`, `employees`, `vehicles`, `audit_logs`). Fungsi `has_table_privilege()` memperhitungkan seluruh hierarki role dan default privileges.
- **Kueri SQL:**
  ```sql
  SELECT 
      r.role_name,
      t.table_name,
      p.privilege_type,
      has_table_privilege(r.role_name, 'public.' || t.table_name, p.privilege_type) AS has_privilege
  FROM (
      VALUES ('anon'), ('authenticated')
  ) AS r(role_name)
  CROSS JOIN (
      VALUES ('organizations'), ('employees'), ('vehicles'), ('audit_logs')
  ) AS t(table_name)
  CROSS JOIN (
      VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
  ) AS p(privilege_type)
  ORDER BY t.table_name, r.role_name, p.privilege_type;
  ```
- **Interpretasi Hasil:**
  - Memastikan apakah role `anon` memiliki privilege tabel. Pada Supabase standar, `anon` biasanya memiliki `has_privilege = true` untuk `SELECT` dan `INSERT` secara default tabel public.
  - Jika `has_privilege = true`, penolakan akses yang terjadi murni merupakan bukti penegakan pada lapisan **Row Level Security (RLS)**, bukan karena pemblokiran privilege engine.

---

### Kueri 3: Audit Kebijakan RLS Komprehensif (Termasuk Evaluasi Role `PUBLIC` & Permissive)
- **Tujuan:** Mengaudit seluruh kebijakan RLS yang berlaku pada tabel sasaran. **Penting:** Policy yang tidak menyebut role target atau secara eksplisit menargetkan role `PUBLIC` otomatis berlaku untuk SEMUA role (termasuk `anon` dan `authenticated`). Kueri wajib menyertakan kolom `permissive`.
- **Kueri SQL:**
  ```sql
  SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual AS using_expression,
      with_check AS with_check_expression
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('organizations', 'employees', 'vehicles', 'audit_logs')
  ORDER BY tablename, policyname;
  ```
- **Prinsip Evaluasi Kebijakan RLS (PostgreSQL Engine Rules):**
  1. **Penggabungan Kebijakan Permissive (`permissive = 'PERMISSIVE'`):**
     - Seluruh permissive policy untuk role dan command tertentu digabungkan menggunakan operator logika **`OR`**.
     - Cukup salah satu permissive policy menghasilkan evaluasi `true`, maka baris tersebut diizinkan untuk diakses (`USING (policy_1 OR policy_2)`).
  2. **Penggabungan Kebijakan Restrictive (`permissive = 'RESTRICTIVE'`):**
     - Seluruh restrictive policy digabungkan menggunakan operator logika **`AND`**.
     - Setiap baris yang lolos evaluasi permissive policy wajib **lolos seluruh restrictive policy** (`USING ((permissive_1 OR permissive_2) AND restrictive_1 AND restrictive_2)`).
  3. **Evaluasi Target Role `PUBLIC`:**
     - Di PostgreSQL, `PUBLIC` adalah pseudo-role universal yang mencakup setiap role yang ada (termasuk `anon` dan `authenticated`).
     - **Setiap policy yang menargetkan `PUBLIC` (atau didefinisikan tanpa klausa `TO`) otomatis mengikat dan berlaku bagi role `anon`**.
     - **Aturan Audit:** DILARANG menyimpulkan bahwa tidak ada policy yang berlaku bagi `anon` hanya karena tidak ada policy yang secara eksplisit menyebutkan role `anon`. Seluruh policy ber-target `PUBLIC` wajib diaudit secara teliti.
  4. **Limitasi Matematika Hasil GET 200 (0 Baris Tetap INCONCLUSIVE):**
     - Pengembalian HTTP 200 dengan payload array kosong `[]` (`count = 0`) pada tabel yang memang tidak memiliki baris data (*zero-state*) adalah hasil tautologis (*Tautological Empty Result*).
     - Hasil tersebut **TIDAK DAPAT MEMBUKTIKAN** apakah baris disaring oleh evaluasi RLS atau karena tabel kosong secara fisik, sehingga statusnya tetap **`INCONCLUSIVE`**.
  5. **Analisis Kebijakan Spesifik Tabel:**
     - **`organizations`:**
       - Policy `organizations_read_authenticated` (`roles = {authenticated}`, `cmd = SELECT`, `qual = true`, `permissive = PERMISSIVE`).
       - Tidak ada policy `FOR SELECT` untuk role `anon` maupun `PUBLIC`. Maka role `anon` tidak memiliki permissive policy yang bernilai true, menghasilkan 0 baris lolos.
     - **`employees`:**
       - Policy `employees_read_unit` (`roles = {authenticated}`, `cmd = SELECT`, `qual = has_unit_permission(unit_id, 'employees.view')`).
       - Tidak ada policy `FOR SELECT` untuk `anon` maupun `PUBLIC`. Role `anon` disaring habis.
     - **`vehicles`:**
       - Policy `vehicles_read_anon` (`roles = {anon}`, `cmd = SELECT`, `qual = (status = 'AVAILABLE'::vehicle_status AND is_active = true)`).
       - Menjamin kendaraan `AVAILABLE` dan aktif dapat dilihat publik, sedangkan status `MAINTENANCE` di-filter out oleh klausa `USING`.
     - **`audit_logs`:**
       - Seluruh policy hanya untuk role `authenticated` yang memiliki izin audit; tidak ada policy untuk `anon` atau `PUBLIC`.

---

## 4. METODE PENGUJIAN REST API POSTGREST (DEDICATED ANON CLIENT)

Pengujian simulasi anonim sejati dilakukan melalui PostgREST REST API layer menggunakan **Dedicated Anon Client** murni tanpa token sesi pengguna (tanpa header `Authorization: Bearer <user_jwt>`) dan diisolasi sepenuhnya dari state aplikasi browser.

### Inisialisasi Dedicated Anon Client (Zero Session Leaks):
```javascript
import { createClient } from '@supabase/supabase-js';

// Dedicated anon client: diisolasi 100% dari sesi pengguna/auth storage aplikasi
const anonClient = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,        // Mencegah penyimpanan/pembacaan token ke localStorage
      autoRefreshToken: false,      // Menonaktifkan refresh token otomatis
      detectSessionInUrl: false     // Menonaktifkan deteksi sesi OAuth di URL
    }
  }
);
```

### Aturan Keamanan & Integritas Audit:
- **Kunci Rahasia Terlindungi:** Mengambil Supabase URL dan Anon Key secara eksklusif dari file konfigurasi environment lokal (`.env`). Anon key atau JWT token **TIDAK PERNAH DICETAK** ke console, file log, maupun artefak audit.
- **Ketiadaan Sesi Pengguna:** Konfigurasi `persistSession: false` dan ketiadaan pemanggilan `signInWithPassword()` menjamin klien tidak membawa kredensial `authenticated` dari sesi lain.
- **Ketiadaan Service Role:** Penggunaan `service_role` key dilarang mutlak karena service role secara bawaan membypass RLS.
- **Hanya Operasi GET (Read-Only Minimum Column):** Seluruh kueri menggunakan proyeksi kolom minimum `select('id')`, bukan `select('*')`, guna meminimalkan transfer payload dan sepenuhnya bertindak read-only.
- **Dilarang Mutasi:** DILARANG mengirimkan request dengan method `POST`, `PATCH`, `PUT`, atau `DELETE`.

---

### Skenario 1: Verifikasi Anonimitas Organisasi (RLS-14)
- **Metode PostgREST:** HTTP `GET /rest/v1/organizations?select=id`
- **Kode Klien (Supabase JS):**
  ```javascript
  // Context: Dedicated Anon Client (Tanpa login / persistSession: false)
  const { data, count, error, status } = await anonClient
      .from('organizations')
      .select('id', { count: 'exact' });
  ```
- **Ekspektasi PostgREST:**
  - Status HTTP: `200 OK`.
  - Data: `[]` (Array kosong, `count = 0`).
- **Analisis Pembuktian & Batas:**
  - Kembalian HTTP 200 dengan 0 baris pada tabel kosong berstatus **`INCONCLUSIVE`**. Karena tabel `organizations` di Production saat ini berstatus 0 baris, hasil `count = 0` tidak membuktikan apakah data disaring oleh RLS atau karena tabel kosong secara fisik.

---

### Skenario 2: Verifikasi Anonimitas Karyawan (RLS-15)
- **Metode PostgREST:** HTTP `GET /rest/v1/employees?select=id`
- **Kode Klien (Supabase JS):**
  ```javascript
  const { data, count, error, status } = await anonClient
      .from('employees')
      .select('id', { count: 'exact' });
  ```
- **Ekspektasi PostgREST:**
  - Status HTTP: `200 OK`.
  - Data: `[]` (Array kosong, `count = 0`).
- **Analisis Pembuktian & Batas:**
  - Status: **`INCONCLUSIVE`**. Sama halnya dengan organisasi, ketiadaan data fisik karyawan di database remote menjadikan hasil HTTP 200 `0 rows` tidak membuktikan proteksi RLS secara definitif.

---

### Skenario 3: Verifikasi Katalog Publik Armada AVAILABLE (RLS-16)
- **Metode PostgREST:** HTTP `GET /rest/v1/vehicles?status=eq.AVAILABLE&select=id`
- **Kode Klien (Supabase JS):**
  ```javascript
  const { data, count, error, status } = await anonClient
      .from('vehicles')
      .select('id', { count: 'exact' })
      .eq('status', 'AVAILABLE');
  ```
- **Ekspektasi Desain:** Policy `vehicles_read_anon` mengizinkan pembacaan kendaraan `AVAILABLE` dan aktif (`ALLOW (>0 rows)`).
- **Analisis Pembuktian & Batas:**
  - Status: **`BLOCKED (DATA REQUIRED)`**. Karena tabel `vehicles` remote kosong, kueri ini mengembalikan 0 baris (gagal membuktikan klausul izin).

---

### Skenario 4: Verifikasi Filter Publik Armada MAINTENANCE (RLS-17)
- **Metode PostgREST:** HTTP `GET /rest/v1/vehicles?status=eq.MAINTENANCE&select=id`
- **Kode Klien (Supabase JS):**
  ```javascript
  const { data, count, error, status } = await anonClient
      .from('vehicles')
      .select('id', { count: 'exact' })
      .eq('status', 'MAINTENANCE');
  ```
- **Ekspektasi Desain:** Policy `vehicles_read_anon` membatasi `status = 'AVAILABLE'`, sehingga kendaraan maintenance tersembunyi (`DENY (0 rows)`).
- **Analisis Pembuktian & Batas:**
  - Status: **`BLOCKED (DATA REQUIRED)`**. Diperlukan keberadaan fisik armada `MAINTENANCE` untuk membuktikan bahwa RLS benar-benar menyaringnya keluar.

---

### Skenario 5: Penolakan Mutasi Organisasi oleh Anonim (RLS-18)
- **Metode PostgREST:** HTTP `POST /rest/v1/organizations`
- **Ekspektasi Desain:** Ditolak oleh PostgreSQL RLS dengan `ERROR 42501` (PostgREST HTTP 403 / 401).
- **Analisis Pembuktian & Batas:**
  - Status: **`BLOCKED (WRITE OPERATION PROHIBITED)`**. Sesuai batasan operasional audit read-only, pengiriman HTTP `POST` ke Production dilarang mutlak, termasuk asumsi rollback transaksi.

---

## 5. MATRIKS STATUS SKENARIO RLS-14 S/D RLS-18

| Test ID | Skenario Pengujian | Aktor & Konteks | Operasi & Target | Ekspektasi Hasil | Kebijakan / Aturan RLS | Status Audit Terkini | Batas Pembuktian |
| :---: | :--- | :--- | :---: | :--- | :--- | :---: | :--- |
| **RLS-14** | Anonymous SELECT organizations | Unauthenticated (Anon Key) | `SELECT` on `organizations` | DENY (0 rows / HTTP 200 `[]`) | `organizations_read_authenticated` (Khusus authenticated; tidak ada policy untuk anon/public) | **`INCONCLUSIVE`** | Tabel kosong; 0 baris tidak dapat membuktikan filtrasi RLS vs tabel kosong |
| **RLS-15** | Anonymous SELECT employees | Unauthenticated (Anon Key) | `SELECT` on `employees` | DENY (0 rows / HTTP 200 `[]`) | `employees_read_unit` (Khusus authenticated; tidak ada policy untuk anon/public) | **`INCONCLUSIVE`** | Tabel kosong; 0 baris tidak dapat membuktikan filtrasi RLS vs tabel kosong |
| **RLS-16** | Anonymous SELECT vehicles AVAILABLE | Unauthenticated (Anon Key) | `SELECT` on `vehicles` (status=AVAILABLE) | ALLOW (>0 rows / HTTP 200) | `vehicles_read_anon` (`status = 'AVAILABLE' AND is_active = true`) | **`BLOCKED`** | Membutuhkan data fisik kendaraan AVAILABLE |
| **RLS-17** | Anonymous SELECT vehicles MAINTENANCE | Unauthenticated (Anon Key) | `SELECT` on `vehicles` (status=MAINTENANCE) | DENY (0 rows / HTTP 200 `[]`) | `vehicles_read_anon` (Filter klausa USING mengecualikan MAINTENANCE) | **`BLOCKED`** | Membutuhkan data fisik kendaraan MAINTENANCE |
| **RLS-18** | Anonymous INSERT organizations | Unauthenticated (Anon Key) | `INSERT` on `organizations` | REJECT (Error 42501 / HTTP 403) | Tidak ada policy WITH CHECK untuk anon | **`BLOCKED`** | Operasi tulis dilarang dalam verifikasi read-only |

---

## 6. KESIMPULAN & STATUS AKHIR

1. **Rancangan Verifikasi Read-Only Selesai:** Seluruh kueri katalog sistem (rekonsiliasi 60 tabel, `has_table_privilege()`, `pg_policies` dengan evaluasi role `PUBLIC`) dan spesifikasi pengujian PostgREST client-side telah disempurnakan.
2. **Keterbatasan Pembuktian:** Sesuai prinsip keinsinyuran jujur, skenario pada tabel kosong berstatus `INCONCLUSIVE`, dan skenario yang memerlukan mutasi atau data fisik berstatus `BLOCKED`.

**STATUS AKHIR:**  
### **`RLS VERIFICATION PLAN APPROVED FOR READ-ONLY EXECUTION REVIEW — NOT EXECUTED`**
