# PHASE 1 DATABASE REPORT — KUK MANAGEMENT SYSTEM
## Canonical Core Schema Migration v3.1.0 Specification
**Tanggal:** 2026-11-04  
**Versi Skema:** 3.1.0  
**Lokasi File Migrasi:** `supabase/migrations/20261104000001_core_schema_v3_1_0.sql`  
**Ukuran File:** 66,143 bytes (1,769 baris SQL)  
**Target Engine:** PostgreSQL 15+ (Supabase Managed PostgreSQL)  
**Lingkungan Valid:** Local Supabase CLI / Staging Environment (**Strictly Forbidden on Production**)

---

## 1. Ringkasan Migrasi

File migrasi `20261104000001_core_schema_v3_1_0.sql` merupakan cetak biru tunggal (*Single Source of Truth*) skema database KUK Management System v3.1.0. Seluruh definisi tabel, tipe data kustom, indeks parsial, relasi komposit foreign key, fungsi kekekalan (*immutability*), dan 5 stored procedures atomik telah disatukan secara terurut berdasarkan ketergantungan relasional (*dependency order*).

---

## 2. Cakupan Komponen Database

### 2.1 Ekstensi PostgreSQL
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
```
- `pgcrypto`: Mendukung pembuatan UUID v4 (`gen_random_uuid()`) dan fungsi kriptografi.
- `btree_gist`: Diperlukan untuk mendukung **Exclusion Constraints** pada rentang waktu peminjaman kendaraan (`tsrange`) dan dynamic conflict slot cuti.

### 2.2 Tipe Data Kustom (ENUMs)
Sebanyak 15 ENUM kustom didefinisikan:
1. `employee_status_enum` ('ACTIVE', 'INACTIVE', 'RESIGNED', 'RETIRED')
2. `employment_type_enum` ('PKWT', 'PKWTT', 'PROBATION', 'INTERN')
3. `gender_enum` ('L', 'P')
4. `marital_status_enum` ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED')
5. `leave_status_enum` ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
6. `tip_calculation_method_enum` ('PER_SQM', 'PER_PIECE', 'SIZE_RANGE', 'HYBRID')
7. `tip_rounding_rule_enum` ('EXACT', 'ROUND_UP_100', 'ROUND_UP_500', 'ROUND_UP_1000')
8. `glass_tip_status_enum` ('PENDING', 'VERIFIED', 'REJECTED', 'CANCELLED')
9. `vehicle_status_enum` ('AVAILABLE', 'BORROWED', 'MAINTENANCE', 'DECOMMISSIONED')
10. `borrowing_status_enum` ('PENDING', 'APPROVED', 'REJECTED', 'IN_USE', 'RETURNED', 'CANCELLED')
11. `vehicle_fuel_level_enum` ('EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL')
12. `attendance_status_enum` ('PRESENT', 'PERMIT', 'SICK', 'LATE', 'ABSENT')
13. `attendance_source_enum` ('FINGERPRINT', 'BRIEFING', 'MANUAL_ADJUSTMENT')
14. `warning_level_enum` ('NONE', 'ORAL_WARNING', 'SP1', 'SP2', 'SP3', 'TERMINATION_EVALUATION')
15. `warning_approval_status_enum` ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')
16. `payroll_status_enum` ('DRAFT', 'CALCULATED', 'FINALIZED', 'PAID', 'CANCELLED')
17. `salary_component_type_enum` ('ALLOWANCE', 'DEDUCTION', 'BENEFIT', 'BONUS')
18. `payment_status_enum` ('PENDING_PAYMENT', 'PROCESSED', 'PAID')

### 2.3 Daftar Tabel (60 Tabel Lengkap)
Tabel disusun dalam 10 grup domain arsitektur:
1. **RBAC & Organisasi**: `organizations`, `units`, `profiles`, `roles`, `permissions`, `role_permissions`, `user_system_roles`, `user_unit_roles`.
2. **Master Data SDM**: `departments`, `positions`, `work_schedules`, `employees`, `employee_sensitive_data`, `employee_portal_auth`, `employee_status_history`, `employee_job_history`.
3. **Cuti & Dynamic Conflict Slots**: `leave_policies`, `leave_conflict_groups`, `leave_conflict_departments`, `leave_requests`, `leave_request_dates`, `leave_conflict_slots`.
4. **Tip Potong Kaca**: `glass_types`, `glass_tip_rates`, `glass_tip_rate_ranges`, `glass_tips`, `glass_tip_verifications`.
5. **Pelanggaran & Sanksi**: `violation_types`, `violation_point_rules`, `warning_letter_templates`, `violation_records`, `warning_letters`, `warning_letter_approvals`.
6. **Presensi & Fingerprint**: `briefing_sessions`, `briefing_attendances`, `fingerprint_devices`, `employee_fingerprint_ids`, `fingerprint_import_batches`, `fingerprint_raw_logs`, `attendance_daily_records`, `attendance_adjustments`.
7. **Penggajian (Payroll)**: `salary_components`, `employee_salary_structures`, `employee_salary_component_items`, `payroll_periods`, `payroll_records`, `payroll_items`, `payroll_revisions`.
8. **Armada Kendaraan**: `vehicles`, `vehicle_borrowing_requests`, `vehicle_condition_inspections`, `vehicle_damages`, `vehicle_fuel_logs`.
9. **Audit & Log Mutasi**: `audit_logs`, `activity_logs`.
10. **Sistem & Integrasi**: `document_sequences`, `system_notifications`, `system_settings`, `file_attachments`, `public_form_tokens`.

---

## 3. Penegakan Integritas & Keputusan Arsitektur Kritis

### 3.1 Penanganan GAP-02 & GAP-03 (Composite FK Protection)
Pada audit Phase 0.5, ditemukan bahwa sintaks `ON DELETE SET NULL` pada foreign key komposit `(unit_id, parent_id)` dapat berisiko menyebabkan kolom `unit_id` menjadi `NULL`, yang merusak isolasi multi-unit.
- **Keputusan Arsitektur**: Seluruh foreign key komposit menggunakan `ON DELETE RESTRICT`.
- Penghapusan data master induk diimplementasikan melalui mekanisme **soft-delete** (`is_active = false`), sehingga integritas transaksi masa lalu dan nilai `unit_id` dijamin tidak pernah berubah atau menjadi `NULL`.

### 3.2 Penegakan Aturan Cuti Admin 3
- Tabel `positions` menyertakan kolom `allowed_leave_days_of_week INT[]`.
- Karyawan dengan posisi Admin 3 dikonfigurasi dengan nilai array `'{0}'` (Minggu saja, sesuai konvensi PostgreSQL `EXTRACT(DOW)`: 0 = Minggu).
- Fungsi RPC `submit_leave_request_atomic()` memvalidasi setiap tanggal cuti yang diajukan terhadap array hari kerja yang diizinkan tersebut.

### 3.3 Penegakan Aturan Tip Potong Kaca 3%
- Tabel `glass_tips` menyimpan snapshot lengkap:
  - `glass_price_snapshot NUMERIC(12, 2)`
  - `tip_percentage_snapshot NUMERIC(5, 4)` bernilai default `0.0300` (3%)
  - `tip_amount NUMERIC(12, 2)` hasil kalkulasi atomik
- Menjamin perubahan harga master kaca di masa depan tidak mengubah nilai komisi historis karyawan.

### 3.4 Fungsi Kekekalan (*Immutability Engines*)
1. `protect_audit_log_immutability()`: Mencegah operasi `UPDATE` atau `DELETE` pada tabel `audit_logs`.
2. `protect_finalized_payroll()`: Mencegah perubahan data pada `payroll_records` yang telah berstatus `FINALIZED` atau `PAID`.

### 3.5 Lima Fungsi RPC Atomik
1. `generate_document_number_atomic()`: Penomoran dokumen formal tanpa nomor lompat atau acak.
2. `submit_leave_request_atomic()`: Pengajuan cuti dengan validasi kuota slot konflik per departemen secara atomik (`SELECT FOR UPDATE`).
3. `cancel_leave_request_atomic()`: Pembatalan cuti dengan pengembalian kuota slot konflik secara aman.
4. `book_vehicle_atomic()`: Peminjaman armada kendaraan dengan validasi tumpang tindih waktu dan pengecualian status kendaraan.
5. `calculate_and_finalize_payroll_atomic()`: Rekonsiliasi penggajian, perhitungan tunjangan/potongan, dan pembekuan status finalized secara transaksional.

---

## 4. Panduan Eksekusi di Lingkungan Local Staging

Untuk menguji migrasi ini di mesin lokal pengembang menggunakan Supabase CLI:

```bash
# 1. Pastikan Docker Desktop telah berjalan di mesin lokal
docker ps

# 2. Inisialisasi Supabase lokal (jika belum pernah)
npx.cmd supabase start

# 3. Jalankan migrasi skema v3.1.0
npx.cmd supabase db reset

# 4. Verifikasi status tabel yang terbentuk
npx.cmd supabase db diff
```

> **PERINGATAN KERAS**:  
> Jangan menjalankan `supabase db push` atau mengeksekusi skrip ini ke proyek Supabase produksi sebelum seluruh tahapan verifikasi pengujian modul operasional (Phase 2–6) disetujui secara tertulis.

