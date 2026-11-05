# PHASE 1 — PRE-EXECUTION REVIEW: READ-ONLY RLS VERIFICATION
## KUK MANAGEMENT SYSTEM v3.1.0

**Tanggal Dokumen:** 2026-11-05  
**Auditor / Arsitek:** Antigravity Autonomous Agent  
**Target Environment:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — PostgreSQL 17.11.0.011  
**Status Evaluasi:** **`READY — AWAITING EXPLICIT USER APPROVAL`**  
**Dokumen Referensi:**
- [`docs/PHASE_1_RLS_READ_ONLY_VERIFICATION_PLAN.md`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/PHASE_1_RLS_READ_ONLY_VERIFICATION_PLAN.md)
- [`docs/PHASE_1_RLS_HARNESS_REMEDIATION_REPORT.md`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/PHASE_1_RLS_HARNESS_REMEDIATION_REPORT.md)

---

## 1. TUJUAN & PRINSIP KESELAMATAN SEBELUM EKSEKUSI

Dokumen ini merupakan laporan pra-eksekusi (*pre-execution audit & package verification*) untuk paket pengujian keamanan *Row Level Security* (RLS) pada Supabase Cloud Production.

### Jaminan Keamanan Pra-Eksekusi (Zero Risk Assurance):
1. **Nol Mutasi Database:** Tidak ada perintah `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, `CREATE`, `DROP`, atau pemanggilan fungsi sekuensial.
2. **Nol Mutasi Auth & Identitas:** Tidak ada pembuatan, perubahan, atau penghapusan akun pada `auth.users` maupun `profiles`.
3. **Nol Fixture & Mock Data:** Tidak ada data sintetis yang dimasukkan ke dalam tabel produksi.
4. **Ketiadaan Service Role:** Paket pengujian dilarang keras memuat atau menggunakan `service_role` key.
5. **Ketiadaan Mode Tulis PostgREST:** Tidak ada request HTTP dengan kata kerja `POST`, `PATCH`, `PUT`, atau `DELETE`.
6. **Perlindungan Rahasia:** Kunci API anonim dibaca melalui variabel lingkungan lokal (`.env`) dan tidak pernah dicetak dalam teks biasa ke terminal, file log, atau artefak markdown.
7. **Pemisahan Tegas Desain vs Bukti Empiris:** Setiap hasil dari tabel kosong dilabeli secara jujur sebagai **`INCONCLUSIVE`** atau **`BLOCKED`**, bukan `PASS`.

---

## 2. REKAPITULASI JUMLAH PERINTAH DALAM PAKET EKSEKUSI

Paket eksekusi verifikasi read-only dirancang secara minimalis dan terukur:

| Kategori Perintah | Protokol / Engine | Jumlah Perintah | Batasan Keamanan |
| :--- | :---: | :---: | :--- |
| **Pemeriksaan Katalog Sistem** | PostgreSQL SQL (Read-Only) | **3 Kueri** | Hanya membaca tabel sistem (`pg_class`, `pg_namespace`, `pg_policies`, `information_schema`) via flag `--read-only` |
| **Simulasi Akses Anonim** | HTTP GET (PostgREST API) | **4 Request** | Hanya membaca proyeksi minimum (`select=id`) via Dedicated Anon Client tanpa sesi |
| **Operasi Mutasi / INSERT** | *Semua* | **0 (DITIADAKAN)** | `RLS-18` (INSERT anonim) dikeluarkan dari paket eksekusi karena berstatus `BLOCKED` |
| **TOTAL PERINTAH** | — | **7 Perintah** | **100% Non-Destruktif & Zero-Persistence** |

---

## 3. AUDIT MENDALAM & URUTAN EKSEKUSI PERINTAH

Berikut adalah rincian berurutan dari 7 perintah yang direncanakan beserta analisis objek, ekspektasi, dan batas pembuktiannya:

### TAHAP 1: PEMERIKSAAN KATALOG SISTEM POSTGRESQL (SQL READ-ONLY)

Eksekusi kueri katalog direncanakan melalui Supabase CLI dengan flag `--read-only` pada database remote `ckzciuybedefbsdfsexh`.

#### 1. Perintah: `CMD-SQL-01` (Rekonsiliasi 60 Tabel Kanonikal vs Status RLS)
- **Tujuan Pemeriksaan:** Membuktikan bahwa seluruh 60 tabel operasional v3.1.0 benar-benar ada di skema `public`, RLS aktif (`relrowsecurity = true`), dan memeriksa apakah RLS dipaksakan (`relforcerowsecurity`).
- **Objek yang Dibaca:** `pg_class`, `pg_namespace`, dan CTE 60 tabel kanonikal.
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
- **Hasil yang Diharapkan:** Tepat 60 baris dengan `audit_status = 'RLS_ACTIVE'`. Nol baris `MISSING_TABLE` atau `RLS_DISABLED`.
- **Risiko & Batas Pembuktian:** **Sifat: KONKLUSIF untuk status skema.** Kueri ini membuktikan struktur DDL katalog, namun tidak membuktikan apakah ekspresi kebijakan RLS menyaring baris secara akurat saat ada data transaksi.

---

#### 2. Perintah: `CMD-SQL-02` (Audit Table-Level Privilege via `has_table_privilege()`)
- **Tujuan Pemeriksaan:** Mengetahui hak akses efektif (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) untuk role `anon` dan `authenticated` pada tabel kunci (`organizations`, `employees`, `vehicles`, `audit_logs`).
- **Objek yang Dibaca:** ACL internal PostgreSQL melalui evaluasi fungsi `has_table_privilege()`.
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
- **Hasil yang Diharapkan:** Role `anon` dan `authenticated` memiliki `has_privilege = true` untuk tabel publik bawaan Supabase, membuktikan bahwa penolakan akses berikutnya berasal murni dari kebijakan RLS dan bukan penolakan privilege tingkat tabel.
- **Risiko & Batas Pembuktian:** **Sifat: KONKLUSIF untuk lapisan privilege.**

---

#### 3. Perintah: `CMD-SQL-03` (Audit Definisi Kebijakan RLS, `permissive`, dan Target `PUBLIC`)
- **Tujuan Pemeriksaan:** Memvalidasi ekspresi klausa `USING` dan `WITH CHECK`, nilai kolom `permissive` (`PERMISSIVE` vs `RESTRICTIVE`), serta target role (memastikan tidak ada kebocoran melalui target role `PUBLIC`).
- **Objek yang Dibaca:** Katalog view `pg_policies` pada tabel target.
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
- **Hasil yang Diharapkan:**
  - `organizations`: `organizations_read_authenticated` (`roles = {authenticated}`, `cmd = SELECT`, `qual = true`), `organizations_manage_super_admin` (`roles = {authenticated}`, `cmd = ALL`). Tidak ada policy untuk `anon` atau `PUBLIC`.
  - `employees`: `employees_read_unit` (`roles = {authenticated}`, `cmd = SELECT`), dan tidak ada policy untuk `anon` atau `PUBLIC`.
  - `vehicles`: `vehicles_read_anon` (`roles = {anon}`, `cmd = SELECT`, `qual = (status = 'AVAILABLE'::vehicle_status AND is_active = true)`).
  - `audit_logs`: Seluruh policy hanya untuk role `authenticated`.
- **Risiko & Batas Pembuktian:** **Sifat: KONKLUSIF untuk teks aturan katalog.**

---

### TAHAP 2: SIMULASI AKSES REST API POSTGREST (DEDICATED ANON CLIENT)

Seluruh pengujian REST API menggunakan client JavaScript mandiri yang diinisialisasi secara ketat tanpa sesi pengguna:

```javascript
import { createClient } from '@supabase/supabase-js';

// Dedicated Anon Client: Terisolasi 100% dari sesi pengguna dan auth storage aplikasi
const anonClient = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,        // Mencegah pembacaan/penulisan sesi di localStorage
      autoRefreshToken: false,      // Menonaktifkan auto-refresh token
      detectSessionInUrl: false     // Menonaktifkan token parsing dari URL
    }
  }
);
```

#### 4. Perintah: `CMD-HTTP-01` (Skenario RLS-14: Anonymous GET `organizations`)
- **Tujuan Pemeriksaan:** Menguji respon PostgREST saat klien anonim mencoba membaca data organisasi internal.
- **Objek yang Dibaca:** Endpoint REST PostgREST `/rest/v1/organizations?select=id`.
- **Kode Permintaan:**
  ```javascript
  const { data, count, error, status } = await anonClient
      .from('organizations')
      .select('id', { count: 'exact' });
  ```
- **Hasil yang Diharapkan:** HTTP Status `200 OK`, `count = 0`, `data = []`.
- **Risiko & Batas Pembuktian:** **STATUS: `INCONCLUSIVE`**. Karena tabel `organizations` di Production saat ini berstatus zero-state (0 baris fisik), kembalian 0 baris tidak dapat membuktikan apakah baris disaring oleh RLS atau karena tabel memang kosong.

---

#### 5. Perintah: `CMD-HTTP-02` (Skenario RLS-15: Anonymous GET `employees`)
- **Tujuan Pemeriksaan:** Menguji respon PostgREST saat klien anonim mencoba membaca data karyawan internal.
- **Objek yang Dibaca:** Endpoint REST PostgREST `/rest/v1/employees?select=id`.
- **Kode Permintaan:**
  ```javascript
  const { data, count, error, status } = await anonClient
      .from('employees')
      .select('id', { count: 'exact' });
  ```
- **Hasil yang Diharapkan:** HTTP Status `200 OK`, `count = 0`, `data = []`.
- **Risiko & Batas Pembuktian:** **STATUS: `INCONCLUSIVE`**. Ketiadaan data fisik karyawan di database remote menyebabkan hasil 0 baris bersifat tautologis dan tidak membuktikan keaktifan RLS secara empiris.

---

#### 6. Perintah: `CMD-HTTP-03` (Skenario RLS-16: Anonymous GET `vehicles` AVAILABLE)
- **Tujuan Pemeriksaan:** Menguji apakah katalog armada publik dengan status `AVAILABLE` dapat dibaca oleh anonim sesuai policy `vehicles_read_anon`.
- **Objek yang Dibaca:** Endpoint REST PostgREST `/rest/v1/vehicles?status=eq.AVAILABLE&select=id`.
- **Kode Permintaan:**
  ```javascript
  const { data, count, error, status } = await anonClient
      .from('vehicles')
      .select('id', { count: 'exact' })
      .eq('status', 'AVAILABLE');
  ```
- **Hasil yang Diharapkan:** HTTP Status `200 OK`. Mengembalikan `count = 0` karena tabel kosong.
- **Risiko & Batas Pembuktian:** **STATUS: `BLOCKED (DATA REQUIRED)`**. Untuk membuktikan bahwa kueri ini mengizinkan pembacaan (`ALLOW >0 rows`), wajib ada baris kendaraan nyata berstatus `AVAILABLE`.

---

#### 7. Perintah: `CMD-HTTP-04` (Skenario RLS-17: Anonymous GET `vehicles` MAINTENANCE)
- **Tujuan Pemeriksaan:** Menguji apakah katalog armada dengan status `MAINTENANCE` disembunyikan dari publik oleh policy `vehicles_read_anon`.
- **Objek yang Dibaca:** Endpoint REST PostgREST `/rest/v1/vehicles?status=eq.MAINTENANCE&select=id`.
- **Kode Permintaan:**
  ```javascript
  const { data, count, error, status } = await anonClient
      .from('vehicles')
      .select('id', { count: 'exact' })
      .eq('status', 'MAINTENANCE');
  ```
- **Hasil yang Diharapkan:** HTTP Status `200 OK`, `count = 0`, `data = []`.
- **Risiko & Batas Pembuktian:** **STATUS: `BLOCKED (DATA REQUIRED)`**. Diperlukan baris fisik armada berstatus `MAINTENANCE` untuk membuktikan bahwa RLS secara aktif menyaringnya keluar dari hasil pencarian publik.

---

## 4. PENJELASAN PENGECUALIAN SKENARIO RLS-18

Skenario **`RLS-18` (Anonymous INSERT organizations)** berstatus:
### **`BLOCKED (WRITE OPERATION PROHIBITED)`**
- **Alasan Pengecualian:** Skenario ini memerlukan eksekusi operasi penulisan (`INSERT` / HTTP `POST`). Sesuai mandat perlindungan Production zero-state, **seluruh operasi mutasi DML dilarang mutlak**.
- **Asumsi Rollback Ditolak:** Tidak boleh mengasumsikan bahwa transaksi `BEGIN ... ROLLBACK` aman dilakukan di Production, karena keterbatasan Supabase CLI yang menolak transaksi multi-statement tanpa intervensi manual dan potensi table lock pada engine.
- **Status Penegakan:** Penolakan `INSERT` oleh anonim pada tabel organisasi diverifikasi secara statis melalui ketiadaan policy `WITH CHECK` untuk role `anon` pada `CMD-SQL-03`.

---

## 5. MATRIKS KLASIFIKASI KELAYAKAN HASIL UJI

| Test ID | Skenario Pengujian | Perintah Terkait | Target Objek | Ekspektasi | Status Klasifikasi | Keterangan Batas Pembuktian |
| :---: | :--- | :---: | :--- | :--- | :---: | :--- |
| **`RLS-14`** | Anonymous SELECT organizations | `CMD-HTTP-01` | `organizations` | 0 rows (HTTP 200) | **`INCONCLUSIVE`** | Tabel fisik kosong; 0 baris tidak membuktikan filtrasi RLS |
| **`RLS-15`** | Anonymous SELECT employees | `CMD-HTTP-02` | `employees` | 0 rows (HTTP 200) | **`INCONCLUSIVE`** | Tabel fisik kosong; 0 baris tidak membuktikan filtrasi RLS |
| **`RLS-16`** | Anonymous SELECT vehicles AVAILABLE | `CMD-HTTP-03` | `vehicles` (AVAILABLE) | ALLOW (>0 rows) | **`BLOCKED`** | Memerlukan baris data kendaraan AVAILABLE |
| **`RLS-17`** | Anonymous SELECT vehicles MAINTENANCE | `CMD-HTTP-04` | `vehicles` (MAINTENANCE) | 0 rows (HTTP 200) | **`BLOCKED`** | Memerlukan baris data kendaraan MAINTENANCE |
| **`RLS-18`** | Anonymous INSERT organizations | *(Ditiadakan)* | `organizations` | REJECT (42501) | **`BLOCKED`** | Operasi mutasi dilarang dalam verifikasi read-only |

---

## 6. KESIMPULAN & STATUS AKHIR

1. **Paket Verifikasi Read-Only Siap:** Seluruh 3 kueri SQL katalog dan 4 request HTTP GET PostgREST telah diaudit secara teliti dan terbukti 100% bebas dari efek samping, mutasi, pembuatan user, maupun kebocoran token.
2. **Kepatuhan Larangan Mutlak:** Tidak ada satu pun kueri atau request yang telah dieksekusi pada sesi ini. Eksekusi menunggu persetujuan eksplisit dari pengguna.

**STATUS AKHIR:**  
### **`READY — AWAITING EXPLICIT USER APPROVAL`**

