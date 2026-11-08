# PHASE 1A — LOCAL IMPLEMENTATION PROGRESS
## Database RPC, RLS Remediation & Migration Draft

**Tanggal:** 2026-11-05 14:24:00 +07:00  
**Baseline Git:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Status Fase 1:** **`OPEN`**  
**Lingkungan:** Local Development Draft (Strictly Zero Mutation to Supabase Production)  

---

## 1. STATUS BATCH IMPLEMENTASI

```text
+---------------------------------------------------------------------------------------------------------------------+
| Batch Pelaksanaan              | Status             | Tanggal Selesai    | Catatan / Artefak Utama                  |
+---------------------------------------------------------------------------------------------------------------------+
| BATCH A: Pre-Implementation    | STATICALLY         | 2026-11-05 14:20   | Inspeksi Git, schema kanonikal, kontrak  |
|          Inspection            | VERIFIED           |                    | DDL, dependensi frontend, & rekonsiliasi |
|                                |                    |                    |                                          |
| BATCH B: Security Migration    | IMPLEMENTED        | 2026-11-05 14:24   | 20261105000002_security_rpc_and_         |
|          Drafts                | (LOCAL DRAFT)      |                    | remediation.sql (10 RLS policies, 5 RPCs,|
|                                |                    |                    | 10/10 automated assertions passed)       |
|                                |                    |                    |                                          |
| BATCH C: Testing Lokal         | PENDING            | Menunggu Review B  | Penambahan assertion kontrak parameter   |
|                                |                    |                    | pada test suite runner & linter          |
|                                |                    |                    |                                          |
| BATCH D: Quality Gate          | PENDING            | Menunggu Batch C   | Typecheck, build, git diff, secret scan  |
+---------------------------------------------------------------------------------------------------------------------+
```

---

## 2. DETAIL HASIL BATCH B (SECURITY MIGRATION DRAFTS)

### 2.1. Berkas Migrasi Baru
- **Path:** `supabase/migrations/20261105000002_security_rpc_and_remediation.sql`
- **Integritas Transaksi:** Dikelilingi blok `BEGIN; ... COMMIT;`.
- **Delimiters:** 10 pasangan `$$` (seimbang, 100% valid).
- **Hasil Linting:** `node scripts/validate_batch_b_migration.cjs` $\rightarrow$ **ALL 10 ASSERTIONS PASSED**.

### 2.2. Rekapitulasi RLS Policies yang Diterapkan (10 Policies)
1. `glass_tips_insert_anon`: INSERT to anon `WITH CHECK (status = 'PENDING' AND verified_amount IS NULL AND payroll_period_id IS NULL)`.
2. `vehicle_borrowing_requests_insert_anon`: INSERT to anon `WITH CHECK (status = 'PENDING' AND approved_by IS NULL AND approved_at IS NULL AND cancellation_reason IS NULL)`.
3. `audit_logs_insert`: INSERT to authenticated `WITH CHECK (actor_id = auth.uid())`.
4. `leave_requests_delete_deny`: `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`.
5. `warning_letters_delete_deny`: `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`.
6. `violation_records_delete_deny`: `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`.
7. `attendance_daily_records_delete_deny`: `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`.
8. `public_form_tokens`: `REVOKE INSERT ON TABLE public.public_form_tokens FROM anon`.
9. `employee_job_history_read/insert`: Memperbaiki kolom `unit_id` menjadi `to_unit_id` dan `from_unit_id`.
10. `system_notifications_read_recipient`: Memperbaiki kolom `recipient_profile_id` menjadi `recipient_user_id`.

### 2.3. Rekapitulasi 5 Stored Procedures Baru
1. `public.reset_employee_kiosk_pin(p_unit_id, p_employee_id, p_new_pin)`
   - *Mode:* `SECURITY DEFINER`, `search_path = public, extensions, pg_temp`.
   - *Izin:* `employees.manage_sensitive` (Authenticated).
   - *Fungsi:* Reset PIN 6-digit Bcrypt, membersihkan lockout, dan mencatat audit log.
2. `public.submit_glass_tip_atomic(...)`
   - *Mode:* `SECURITY DEFINER`, `search_path = public, extensions, pg_temp`.
   - *Izin:* `anon`, `authenticated`, `service_role`.
   - *Fungsi:* Validasi dimensi fisik ($5-600\text{ cm}$, $1-500\text{ lembar}$), anti-timing dummy Bcrypt saat karyawan tidak ditemukan, kalkulasi $m^2$ server-side, pembacaan tarif master range, status terkunci `PENDING`, dan penomoran seri `TIP`.
3. `public.verify_glass_tip_atomic(p_unit_id, p_tip_id, p_action, p_verified_amount, p_notes)`
   - *Mode:* `SECURITY DEFINER`, `search_path = public, extensions, pg_temp`.
   - *Izin:* `glass_tips.verify` (Authenticated).
   - *Fungsi:* Lock `FOR UPDATE`, validasi status `PENDING`, tolak modifikasi tip yang sudah diserap payroll (`payroll_period_id IS NOT NULL`), transisi ke `VERIFIED`/`REJECTED`, dan mencatat audit log.
4. `public.book_vehicle_atomic(...)`
   - *Mode:* `SECURITY DEFINER`, `search_path = public, extensions, pg_temp`.
   - *Izin:* `anon`, `authenticated`, `service_role`.
   - *Fungsi:* Validasi waktu peminjaman (tidak di masa lampau, durasi $\le 30$ hari), deteksi awal jadwal bertabrakan, status terkunci `PENDING`, dan penomoran seri `FLEET`.
5. `public.approve_vehicle_atomic(p_unit_id, p_request_id, p_action, p_rejection_reason)`
   - *Mode:* `SECURITY DEFINER`, `search_path = public, extensions, pg_temp`.
   - *Izin:* `fleet.approve_borrowing` (Authenticated).
   - *Fungsi:* Lock `FOR UPDATE`, penanganan spesifik `SQLSTATE 23P01 (exclusion_violation)` saat terjadi tabrakan jadwal bersamaan, transisi ke `APPROVED`/`REJECTED`, dan mencatat audit log.

---

## 3. PEMETAAN DEPENDENSI FRONTEND UNTUK BATCH BERIKUTNYA

Kode frontend pada `src/` sengaja **TIDAK DIUBAH** pada batch ini sesuai batasan ketat. Dua fungsi berikut telah ditandai sebagai dependensi yang harus dialihkan pada batch frontend mendatang:
1. `glassTipService.verifyTipNota` $\rightarrow$ dialihkan dari direct `.update()` ke `supabase.rpc('verify_glass_tip_atomic', { ... })`.
2. `fleetService.approveBorrowing` $\rightarrow$ dialihkan dari direct `.update()` ke `supabase.rpc('approve_vehicle_atomic', { ... })`.

---

## 4. STATUS KESIAPAN
- [x] Berkas migrasi `20261105000002_security_rpc_and_remediation.sql` selesai dan tervalidasi linter.
- [x] Seluruh 10 assertion keamanan lulus uji statis (`scripts/validate_batch_b_migration.cjs`).
- [x] Zero changes to frontend code.
- [x] Zero changes to historical applied migrations (`20261104000001` & `20261104000002`).
- [x] Zero SQL executed against Supabase Production.

**Status Saat Ini:** **BATCH B COMPLETED — AWAITING REVIEW TO PROCEED TO BATCH C**.
