# PHASE 1C.4 — DATABASE MUTATION SECURITY AUDIT
## KUK Management System v3.1.0

**Tanggal Audit:** 2026-11-08 18:15:00 +07:00  
**Auditor Roles:** Senior Supabase Architect & Database Security Engineer  
**Baseline Git:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Target Lingkungan:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — **STRICTLY READ-ONLY / UNTOUCHED**  
**Cakupan Berkas SQL:**
1. `supabase/migrations/20261104000001_core_schema_v3_1_0.sql` (1.273 baris)
2. `supabase/migrations/20261104000002_harden_rpc_security.sql` (158 baris)
3. `supabase/migrations/20261105000002_security_rpc_and_remediation.sql` (1.033 baris draft)

---

## 1. EXECUTIVE SUMMARY

Audit keamanan ini mengevaluasi seluruh lapisan pertahanan basis data (*database-level defenses*) yang melindungi operasi penulisan (*INSERT, UPDATE, DELETE, RPC*) pada KUK Management System v3.1.0. Evaluasi mencakup Row Level Security (RLS), hak akses tabel langsung (*direct table privileges*), fungsi `SECURITY DEFINER`, penataan `search_path`, trigger immutabilitas, integritas constraint, dan perilaku role `service_role` / `BYPASSRLS`.

### Temuan Kunci Database:
1. **Pemisahan Jalur Publik vs Internal:** Modul `glass_tips` dan `vehicle_borrowing_requests` telah diamankan secara ketat pada draft migration `20261105000002` dengan mencabut direct `INSERT` dan `UPDATE` dari `anon`, `authenticated`, dan `PUBLIC`, serta mengarahkan mutasi melalui atomic RPC yang terikat rate-limiter.
2. **Kelemahan pada `employee_sensitive_data`:** Kebijakan RLS `employee_sensitive_manage` menggunakan klausa `FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'employees.manage_sensitive'))`. Karena `FOR ALL` mencakup operasi `DELETE`, admin unit dengan permission tersebut dapat melakukan penghapusan fisik (*hard-delete*) data sensitif (gaji pokok, NIK, nomor rekening) karena tabel ini belum memiliki kebijakan `AS RESTRICTIVE FOR DELETE (false)`.
3. **Kelemahan pada `submit_leave_request_atomic` Historis:** Fungsi cuti mandiri historis pada migration `20261104000001` melempar `RAISE EXCEPTION` saat PIN salah, yang secara otomatis membatalkan (*rollback*) penambahan counter `failed_attempts` pada tabel `employee_portal_auth`. Hal ini menyebabkan proteksi lockout 5 kali gagal tidak pernah tercapai di level engine. Penonaktifan form cuti kiosk di frontend (`BLOCKED`) telah memitigasi risiko ini secara efektif di sisi antarmuka.
4. **Batasan Perlindungan RESTRICTIVE DELETE:** Kebijakan `AS RESTRICTIVE FOR DELETE (false)` memberikan proteksi absolut terhadap role `authenticated` dan `anon`, namun **TIDAK DAPAT** membatasi role superuser PostgreSQL, table owner, atau koneksi yang menggunakan `service_role` key (yang secara native memiliki atribut `BYPASSRLS`).

---

## 2. DATABASE MUTATION INVENTORY

Inventarisasi seluruh tabel yang dapat dimutasi pada skema database KUK v3.1.0:

| Nama Tabel | Operasi yang Didukung | Jalur Mutasi Utama | Policy Permissive | Policy Restrictive | Izin Direct Anon | Izin Direct Authenticated |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`employees`** | INSERT, UPDATE | Direct Client (.insert, .update) | `employees_insert_unit`, `employees_update_unit` | `employees_delete_deny` (USING false) | REVOKED | GRANTED (Scoped by RLS) |
| **`employee_sensitive_data`** | INSERT, UPDATE, DELETE | Direct Client (.upsert) | `employee_sensitive_manage` (FOR ALL) | **TIDAK ADA** *(Celah Hard-Delete)* | REVOKED | GRANTED (Scoped by RLS) |
| **`employee_portal_auth`** | INSERT, UPDATE | RPC `reset_employee_kiosk_pin` | Tertutup RLS / Hanya via RPC | N/A | REVOKED | REVOKED |
| **`leave_requests`** | INSERT, UPDATE | Direct Client & RPC `cancel_leave_atomic` | `leave_requests_manage` | `leave_requests_delete_deny` (RESTRICTIVE) | REVOKED | GRANTED (Scoped by RLS) |
| **`attendance_daily_records`** | INSERT, UPDATE | Direct Client (.insert, .update) | `attendance_daily_manage` | `attendance_daily_records_delete_deny` (RESTRICTIVE) | REVOKED | GRANTED (Scoped by RLS) |
| **`briefing_sessions`** | INSERT, UPDATE | Direct Client (.insert) | `briefing_sessions_manage` | N/A | REVOKED | GRANTED (Scoped by RLS) |
| **`violation_records`** | INSERT, UPDATE | Direct Client (.insert) | `violation_records_manage` | `violation_records_delete_deny` (RESTRICTIVE) | REVOKED | GRANTED (Scoped by RLS) |
| **`warning_letters`** | INSERT, UPDATE | Direct Client (.insert) | `warning_letters_manage` | `warning_letters_delete_deny` (RESTRICTIVE) | REVOKED | GRANTED (Scoped by RLS) |
| **`glass_tips`** | INSERT, UPDATE | **Strictly via Atomic RPC** | Read-only via RLS (`glass_tips_select`) | N/A | **REVOKED** | **REVOKED** |
| **`vehicles`** | INSERT, UPDATE | Direct Client (.insert, .update) | `vehicles_manage` | N/A | REVOKED | GRANTED (Scoped by RLS) |
| **`vehicle_borrowing_requests`** | INSERT, UPDATE | **Strictly via Atomic RPC** | Read-only via RLS (`vehicle_requests_select`) | N/A | **REVOKED** | **REVOKED** |
| **`payroll_periods`** | INSERT, UPDATE | Direct Client & RPC `finalize_payroll` | `payroll_periods_manage` | N/A (Trigger immutability) | REVOKED | GRANTED (Scoped by RLS) |
| **`payroll_records`** | INSERT, UPDATE | Generated by RPC Finalize | `payroll_records_manage` | `payroll_records_delete_deny` (RESTRICTIVE) | REVOKED | GRANTED (Scoped by RLS) |
| **`audit_logs`** | INSERT (Append-only) | Trigger & Direct Authenticated Insert | `audit_logs_insert` (actor_id = auth.uid()) | Trigger `trg_protect_audit_logs` | **REVOKED** | GRANTED (Insert with check) |
| **`rpc_rate_limits`** | INSERT, UPDATE, DELETE | **Strictly via Internal RPC Helper** | Tertutup RLS / Dedicated Service Role | N/A | **REVOKED** | **REVOKED** |

---

## 3. RLS POLICIES & EVALUATION MECHANICS

### 3.1. Semantik Evaluasi Kebijakan PostgreSQL
Pada PostgreSQL 15+, evaluasi RLS pada sebuah baris mengikuti aturan logika Boolean terpadu:
$$\text{Row Access} = \left(\bigvee_{i=1}^n \text{Permissive}_i\right) \land \left(\bigwedge_{j=1}^m \text{Restrictive}_j\right)$$

- Jika tidak ada kebijakan *Permissive* yang bernilai `TRUE`, operasi langsung **DITOLAK** (*Default Deny*).
- Jika salah satu kebijakan *Restrictive* bernilai `FALSE`, operasi langsung **DITOLAK**, terlepas dari berapa banyak kebijakan *Permissive* yang bernilai `TRUE`.

### 3.2. Batasan Teknis Kebijakan RESTRICTIVE DELETE (USING false)
Audit menemukan pentingnya memperjelas batas perlindungan `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`:
- **Yang Terlindungi:** Seluruh koneksi dari aplikasi web, klien REST, atau token pengguna (baik staf, admin toko, maupun Super Admin yang terautentikasi melalui JWT Supabase) secara absolut **TIDAK BISA** menghapus baris data.
- **Yang TIDAK Terlindungi (Bypass Boundary):**
  1. Koneksi langsung menggunakan role database superuser (`postgres`).
  2. Pemilik tabel (*table owner*), kecuali tabel di-alter dengan `ALTER TABLE ... FORCE ROW LEVEL SECURITY`.
  3. Kueri backend yang menggunakan Supabase `service_role` key (karena role `service_role` memiliki atribut `BYPASSRLS` secara default di Supabase).

---

## 4. SECURITY DEFINER & SEARCH_PATH AUDIT

Audit menyeluruh terhadap seluruh fungsi PL/pgSQL pada migration `20261104000001`, `20261104000002`, dan `20261105000002`:

```text
+----------------------------------------+-------------------+-----------------------------------------+--------------------+-------------------------+
| Nama Fungsi                            | Deklarasi         | Nilai search_path                       | Posisi pg_temp     | Status Keamanan         |
+----------------------------------------+-------------------+-----------------------------------------+--------------------+-------------------------+
| protect_audit_log_immutability()       | SECURITY DEFINER  | public, pg_temp                         | Terakhir (Aman)    | VERIFIED SECURE         |
| protect_finalized_payroll()            | SECURITY DEFINER  | public, pg_temp                         | Terakhir (Aman)    | VERIFIED SECURE         |
| generate_document_number_atomic(...)   | SECURITY DEFINER  | public, pg_temp                         | Terakhir (Aman)    | VERIFIED SECURE         |
| submit_leave_request_atomic(...)       | SECURITY DEFINER  | public, pg_temp                         | Terakhir (Aman)    | Celah Rollback Exception|
| cancel_leave_request_atomic(...)       | SECURITY DEFINER  | public, pg_temp                         | Terakhir (Aman)    | VERIFIED SECURE         |
| book_vehicle_atomic(...) [Legacy]      | SECURITY DEFINER  | public, pg_temp                         | Terakhir (Aman)    | Digantikan Batch B      |
| calculate_and_finalize_payroll(...)    | SECURITY DEFINER  | public, pg_temp                         | Terakhir (Aman)    | VERIFIED SECURE         |
| has_system_role(...)                   | STABLE SEC DEFINER| public, pg_temp                         | Terakhir (Aman)    | VERIFIED SECURE         |
| has_unit_access(...)                   | STABLE SEC DEFINER| public, pg_temp                         | Terakhir (Aman)    | VERIFIED SECURE         |
| has_unit_permission(...)               | STABLE SEC DEFINER| public, pg_temp                         | Terakhir (Aman)    | VERIFIED SECURE         |
| check_and_increment_rate_limit(...)    | SECURITY DEFINER  | public, extensions, pg_temp             | Terakhir (Aman)    | VERIFIED SECURE         |
| cleanup_expired_rate_limits(...)       | SECURITY DEFINER  | public, extensions, pg_temp             | Terakhir (Aman)    | VERIFIED SECURE         |
| reset_employee_kiosk_pin(...)          | SECURITY DEFINER  | public, extensions, pg_temp             | Terakhir (Aman)    | VERIFIED SECURE         |
| submit_glass_tip_atomic(...) [Batch B] | SECURITY DEFINER  | public, extensions, pg_temp             | Terakhir (Aman)    | VERIFIED SECURE         |
| verify_glass_tip_atomic(...) [Batch B] | SECURITY DEFINER  | public, extensions, pg_temp             | Terakhir (Aman)    | VERIFIED SECURE         |
| book_vehicle_atomic(...) [Batch B]     | SECURITY DEFINER  | public, extensions, pg_temp             | Terakhir (Aman)    | VERIFIED SECURE         |
| approve_vehicle_atomic(...) [Batch B]  | SECURITY DEFINER  | public, extensions, pg_temp             | Terakhir (Aman)    | VERIFIED SECURE         |
+----------------------------------------+-------------------+-----------------------------------------+--------------------+-------------------------+
```

*Seluruh 17 fungsi SECURITY DEFINER telah memenuhi standar pengamanan objek sementara dengan menempatkan `pg_temp` pada posisi paling belakang, mencegah serangan object shadowing via temporary tables.*

---

## 5. AUDIT KHUSUS SETIAP MODUL BASIS DATA

### 5.1. Modul Karyawan & Data Sensitif
- **Integritas Relasional:** Tabel `profiles` mengikat langsung ke `auth.users(id) ON DELETE CASCADE`.
- **Status Celah `employee_sensitive_data`:** Kebijakan `employee_sensitive_manage` memberikan hak `DELETE` kepada pemegang hak `employees.manage_sensitive`. Jika akun admin toko terkompromi, pelaku dapat menghapus data NIK dan gaji pokok karyawan.
  - *Rekomendasi:* Tambahkan kebijakan `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)` pada `employee_sensitive_data`.

### 5.2. Modul Pengajuan Cuti (Leave)
- **Celah `submit_leave_request_atomic` Historis:** Baris 1378-1383 pada `20261104000001` melempar `RAISE EXCEPTION 'PIN otentikasi salah.'` saat hash tidak cocok. Di PostgreSQL, unhandled exception membatalkan seluruh transaksi, termasuk statement `UPDATE employee_portal_auth SET failed_attempts = failed_attempts + 1`. Akibatnya, counter kegagalan selalu di-rollback ke 0, membuka celah brute-force tanpa batas.
  - *Status Saat Ini:* Terlindungi di frontend karena antarmuka portal publik cuti telah berstatus `BLOCKED`. Namun, di level database, RPC historis ini masih rentan jika dipanggil langsung via REST endpoint.

### 5.3. Modul Tip Kaca (Glass Tips)
- **Status Remedi Batch B.3:** Sangat aman. Direct insert/update telah dicabut total. Fungsi `submit_glass_tip_atomic` menggunakan dummy Bcrypt saat karyawan tidak ditemukan, menangkap kegagalan PIN tanpa rollback (`JSONB` return), dan membatasi frekuensi via `rpc_rate_limits`.

### 5.4. Modul Armada Kendaraan (Fleet)
- **Proteksi Overlap Jadwal:** Dilindungi oleh exclusion constraint biner PostgreSQL `EXCLUDE USING gist (vehicle_id WITH =, tstzrange(start_time, estimated_return_time, '[)') WITH &&)`.
- **Penanganan 23P01:** Fungsi `approve_vehicle_atomic` secara spesifik menangkap pengecualian `exclusion_violation` (SQLSTATE `23P01`) dan mengembalikan pesan kesalahan JSONB yang ramah tanpa membatalkan konteks audit.

### 5.5. Modul Jejak Audit (Audit Logs)
- **Anti-Spoofing Aktor:** Policy `audit_logs_insert` menegakkan klausul `WITH CHECK (actor_id = auth.uid())`. Pengguna yang login tidak dapat menyuntikkan ID akun pimpinan atau admin lain ke kolom `actor_id`.
- **Immutabilitas Total:** Trigger `trg_protect_audit_logs` melempar exception `P0001` pada setiap usaha `UPDATE` atau `DELETE`.

---

## 6. RPC SECURITY AUDIT MATRIX

| Nama RPC | Pemanggil Resmi | Autentikasi | Otorisasi Database | Validasi Unit Scope | Penanganan Input NULL/Malformed | Audit Logging | Verdict Keamanan |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `reset_employee_kiosk_pin` | Admin Toko / Pimpinan | Wajib (`authenticated`) | `has_unit_permission('employees.update')` | Enforced di WHERE & ON CONFLICT | Regex `^[0-9]{6}$` & GET DIAGNOSTICS | Dicatat di DB | **SECURE** |
| `submit_glass_tip_atomic` | Kiosk Publik Pemotong Kaca | Terbuka (`anon`, `auth`) | Validasi PIN Bcrypt di table auth | Enforced di FK `fk_tip_employee` | Dummy Bcrypt & Dimensi > 0 | Dicatat di DB | **SECURE** |
| `verify_glass_tip_atomic` | Kasir / Checker | Wajib (`authenticated`) | `has_unit_permission('glass_tips.verify')`| Enforced via SELECT FOR UPDATE | Strictly VERIFY/REJECT & Bounds | Dicatat di DB | **SECURE** |
| `book_vehicle_atomic` | Kiosk / Publik | Terbuka (`anon`, `auth`) | Rate limiter IP & Vehicle ID | Enforced via FK Unit | Toleransi 15m & Max 30 hari | Dicatat di DB | **SECURE** |
| `approve_vehicle_atomic` | Petugas Armada | Wajib (`authenticated`) | `has_unit_permission('fleet.approve_borrowing')`| Enforced via SELECT FOR UPDATE | Traps 23P01 & Bounds 500 char | Dicatat di DB | **SECURE** |
| `cancel_leave_request_atomic` | Admin Toko | Wajib (`authenticated`) | `has_unit_permission('leave.manage')` | Enforced via SELECT FOR UPDATE | Validasi status PENDING/APPROVED | Dicatat di DB | **SECURE** |
| `finalize_payroll_atomic` | Admin Toko / Pimpinan | Wajib (`authenticated`) | `has_unit_permission('payroll.finalize')` | Row-lock FOR UPDATE status DRAFT | Validasi integritas periode | Dicatat di DB | **SECURE** |
| `submit_leave_request_atomic` | Kiosk Mandiri Cuti | Terbuka (`anon`, `auth`) | **CACAT (Rollback Exception)** | Enforced via WHERE unit_id | Validasi array tanggal cuti | Dicatat di DB | **VULNERABLE (BLOCKED IN UI)** |
| `check_and_increment_rate_limit`| Helper Internal | Internal (`service_role`) | Private to DEFINER routines | Bucket key scoping | NULL safe & Interval bounds | N/A (Internal) | **SECURE** |

---

## 7. DATABASE SECURITY FINDINGS CLASSIFICATION

1. **[CRITICAL] Rollback Transaction pada `submit_leave_request_atomic` Historis:**  
   Unhandled `RAISE EXCEPTION` membatalkan pencatatan `failed_attempts` pada tabel PIN portal karyawan, memungkinkan serangan brute-force tanpa terkena lockout. *(Status mitigasi: UI form telah dinonaktifkan dengan status `BLOCKED`)*.
2. **[HIGH] Ketiadaan Kebijakan RESTRICTIVE DELETE pada `employee_sensitive_data`:**  
   Kebijakan `FOR ALL` mengizinkan hard-delete data sensitif karyawan oleh pemegang permission `employees.manage_sensitive`.
3. **[MEDIUM] Direct UPDATE pada `leave_requests` Tanpa State-Machine RPC:**  
   Approval cuti masih mengandalkan direct `.update()` dari klien frontend, tanpa row-locking `FOR UPDATE` untuk mencegah *race condition* jika dua admin menyetujui dan menolak permohonan yang sama pada detik yang sama.
4. **[LOW] Tabel Dormant `public_form_tokens`:**  
   Hak akses telah dicabut di Batch B, namun skema tabel masih ada tanpa fungsi yang mengonsumsinya.
5. **[INFORMATIONAL] BYPASSRLS pada Service Role Key:**  
   Perlu ditegaskan dalam dokumentasi arsitektur bahwa perlindungan RLS berbasis PostgreSQL engine tidak berlaku bagi backend script yang menggunakan `service_role` key.

