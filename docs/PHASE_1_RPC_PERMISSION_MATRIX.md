# PHASE 1 — RPC PERMISSION & ACCESS MATRIX
## KUK MANAGEMENT SYSTEM v3.1.0

**Tanggal Dokumen:** 2026-11-04  
**Auditor:** Antigravity Autonomous Agent  
**Target Environment:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`)  
**PostgreSQL Engine:** v17.11.0.011  
**Tujuan Dokumen:** Memetakan status hak akses eksekusi aktual (`GRANT EXECUTE`) dan merancang matriks hak akses target yang menerapkan prinsip Least Privilege pada 10 fungsi PostgreSQL sistem.

---

## 1. MATRIKS PERBANDINGAN HAK AKSES EKSEKUSI (CURRENT VS TARGET)

| No | Nama Fungsi | Status Aktual (Current) | Target yang Diusulkan (Target) | Alasan Perubahan & Prinsip Keamanan |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `generate_document_number_atomic` | `PUBLIC:EXECUTE`<br>(anon, auth, service) | **`authenticated`, `service_role`**<br>(REVOKE dari anon & PUBLIC) | Mencegah penomoran seri dokumen di-enumerasi atau di-spam oleh publik tanpa login. |
| 2 | `submit_leave_request_atomic` | `PUBLIC:EXECUTE`<br>(anon, auth, service) | **`anon`, `authenticated`, `service_role`** | Kebutuhan Kiosk/Portal mandiri karyawan pabrik/toko yang tidak memiliki akun login Supabase Auth. Aman dengan validasi PIN & rate limit. |
| 3 | `cancel_leave_request_atomic` | `PUBLIC:EXECUTE`<br>(anon, auth, service) | **`authenticated`, `service_role`**<br>(REVOKE dari anon & PUBLIC) | Pembatalan cuti adalah tindakan administratif; tidak boleh dieksekusi oleh pihak publik anonim. |
| 4 | `book_vehicle_atomic` | `PUBLIC:EXECUTE`<br>(anon, auth, service) | **`anon`, `authenticated`, `service_role`** | Kebutuhan formulir permohonan publik peminjaman armada antar-unit terafiliasi. Status hasil selalu `PENDING`. |
| 5 | `calculate_and_finalize_payroll_atomic` | `PUBLIC:EXECUTE`<br>(anon, auth, service) | **`authenticated`, `service_role`**<br>(REVOKE dari anon & PUBLIC) | **KRITIS.** Perhitungan gaji staf adalah data paling rahasia; wajib dibatasi hanya untuk staf terautentikasi dengan izin khusus. |
| 6 | `has_system_role` | `PUBLIC:EXECUTE`<br>(anon, auth, service) | **`anon`, `authenticated`, `service_role`** | Helper RLS; mengembalikan `FALSE` jika anon (`auth.uid() IS NULL`). Diperlukan untuk evaluasi query engine. |
| 7 | `has_unit_access` | `PUBLIC:EXECUTE`<br>(anon, auth, service) | **`anon`, `authenticated`, `service_role`** | Helper RLS; mengembalikan `FALSE` jika anon. Diperlukan untuk evaluasi policy tabel publik. |
| 8 | `has_unit_permission` | `PUBLIC:EXECUTE`<br>(anon, auth, service) | **`anon`, `authenticated`, `service_role`** | Helper RLS; mengembalikan `FALSE` jika anon. Diperlukan untuk evaluasi filter izin unit. |
| 9 | `protect_audit_log_immutability` | `PUBLIC:EXECUTE`<br>(Trigger only) | **`service_role` / `postgres` only** | Trigger function; tidak pernah dipanggil via REST. Hak publik dicabut untuk memperkuat postur keamanan. |
| 10 | `protect_finalized_payroll` | `PUBLIC:EXECUTE`<br>(Trigger only) | **`service_role` / `postgres` only** | Trigger function; tidak pernah dipanggil via REST. Hak publik dicabut untuk memperkuat postur keamanan. |

---

## 2. MATRIKS VALIDASI INTERNAL DI DALAM BODY FUNGSI (IN-BODY DEFENSE)

Membatasi `GRANT` saja **TIDAK CUKUP** untuk sistem multi-tenant. Pengguna yang berhasil login sebagai Admin Toko A tetap memiliki role `authenticated` di Supabase. Oleh karena itu, pemeriksaan otorisasi internal di dalam body PL/pgSQL wajib diterapkan:

| Nama Fungsi | Cek `auth.uid() IS NOT NULL` | Cek Anti-Spoofing Parameter | Cek Permission Granular Unit | Penanganan Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| `calculate_and_finalize_payroll_atomic` | **WAJIB** | `p_finalized_by = auth.uid()` | `has_unit_permission(p_unit_id, 'payroll.manage')` | Bypass melalui `has_system_role('super_admin')` |
| `cancel_leave_request_atomic` | **WAJIB** | `p_cancelled_by = auth.uid()` | `has_unit_permission(p_unit_id, 'leave.manage')` | Bypass melalui `has_system_role('super_admin')` |
| `submit_leave_request_atomic` | N/A (Kiosk Mode) | Bcrypt PIN Hash matching | Verifikasi status `ACTIVE` di `p_unit_id` | N/A |
| `book_vehicle_atomic` | N/A (Public Form) | Parameter permohonan | Verifikasi armada `AVAILABLE` di `p_unit_id` | N/A |
| `generate_document_number_atomic` | Optional (Internal) | N/A | Verifikasi `p_unit_id` valid | N/A |
| Helper RLS (3 fungsi) | Evaluasi otomatis | N/A | N/A | Evaluasi otomatis |
| Trigger Functions (2 fungsi) | Event Trigger | N/A | Immutability Enforced | N/A |

---

## 3. ANALISIS EKSPOSUR POSTGREST REST API

Supabase secara otomatis mengekspos setiap fungsi di schema `public` yang memiliki hak akses `EXECUTE` ke endpoint `/rest/v1/rpc/<function_name>`.

### Dampak Pemetaan Endpoint:

1. **`POST /rest/v1/rpc/calculate_and_finalize_payroll_atomic`:**
   - *Kondisi Saat Ini:* Terbuka untuk request publik dengan header `apikey` anonim.
   - *Target Pasca-Remediasi:* Hanya menerima request yang menyertakan header `Authorization: Bearer <JWT_USER>`. PostgREST akan menolak request anon dengan HTTP 401 Unauthorized.
2. **`POST /rest/v1/rpc/cancel_leave_request_atomic`:**
   - *Kondisi Saat Ini:* Terbuka untuk publik anonim.
   - *Target Pasca-Remediasi:* Ditolak dengan HTTP 401 Unauthorized jika tidak menyertakan JWT pengguna login.
3. **`POST /rest/v1/rpc/generate_document_number_atomic`:**
   - *Kondisi Saat Ini:* Terbuka untuk publik anonim.
   - *Target Pasca-Remediasi:* Ditolak untuk anonim. Hanya dapat dipanggil oleh staf terautentikasi atau secara internal dari fungsi lain.
4. **`POST /rest/v1/rpc/submit_leave_request_atomic` & `book_vehicle_atomic`:**
   - Tetap terbuka untuk `anon` karena merupakan antarmuka resmi formulir mandiri pegawai dan peminjaman armada.

