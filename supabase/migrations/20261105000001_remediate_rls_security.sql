-- ============================================================================
-- KUK MANAGEMENT SYSTEM v3.1.0
-- Migration: 20261105000001_remediate_rls_security.sql
-- Description: Phase 1 Database Security Remediation & RLS Hardening
-- Status: LOCAL DRAFT — NOT APPLIED TO PRODUCTION
-- ============================================================================

-- 1. Remediasi glass_tips: Batasi insert anonim hanya untuk status PENDING dan nominal kosong
DROP POLICY IF EXISTS "glass_tips_insert_anon" ON public.glass_tips;
CREATE POLICY "glass_tips_insert_anon" ON public.glass_tips
    FOR INSERT TO anon
    WITH CHECK (
        status = 'PENDING'
        AND verified_amount IS NULL
        AND payroll_period_id IS NULL
    );

-- 2. Remediasi vehicle_borrowing_requests: Batasi insert anonim hanya untuk status PENDING tanpa approval buatan
DROP POLICY IF EXISTS "vehicle_borrowing_requests_insert_anon" ON public.vehicle_borrowing_requests;
CREATE POLICY "vehicle_borrowing_requests_insert_anon" ON public.vehicle_borrowing_requests
    FOR INSERT TO anon
    WITH CHECK (
        status = 'PENDING'
        AND approved_by IS NULL
        AND approved_at IS NULL
        AND cancellation_reason IS NULL
    );

-- 3. Remediasi audit_logs: Kunci actor_id agar wajib sesuai dengan akun auth pengguna yang sedang login
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        actor_id = auth.uid()
    );

-- 4. Remediasi Immutabilitas Data Transaksional Kepatuhan: Cegah Hard-Delete oleh Pengelola Unit
-- CATATAN TEKNIS: Wajib menggunakan AS RESTRICTIVE.
-- Dalam PostgreSQL RLS, policy default adalah AS PERMISSIVE (dievaluasi dengan OR).
-- Jika terdapat policy permissive FOR ALL (misal: leave_requests_manage_unit), policy permissive
-- dengan USING (false) tidak akan berpengaruh karena (TRUE OR FALSE) = TRUE.
-- Kebijakan AS RESTRICTIVE dievaluasi dengan AND: (PERMISSIVE_POLICIES) AND FALSE = FALSE,
-- sehingga secara mutlak menolak DELETE bagi role authenticated tanpa mempengaruhi SELECT/INSERT/UPDATE.

-- 4.1. Riwayat Pengajuan Cuti (leave_requests)
DROP POLICY IF EXISTS "leave_requests_delete_deny" ON public.leave_requests;
CREATE POLICY "leave_requests_delete_deny" ON public.leave_requests
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (false);

-- 4.2. Surat Peringatan / SP (warning_letters)
DROP POLICY IF EXISTS "warning_letters_delete_deny" ON public.warning_letters;
CREATE POLICY "warning_letters_delete_deny" ON public.warning_letters
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (false);

-- 4.3. Catatan Pelanggaran Disiplin (violation_records)
DROP POLICY IF EXISTS "violation_records_delete_deny" ON public.violation_records;
CREATE POLICY "violation_records_delete_deny" ON public.violation_records
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (false);

-- 4.4. Rekapitulasi Presensi Harian (attendance_daily_records)
DROP POLICY IF EXISTS "attendance_daily_records_delete_deny" ON public.attendance_daily_records;
CREATE POLICY "attendance_daily_records_delete_deny" ON public.attendance_daily_records
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (false);

-- 5. Remediasi public_form_tokens: Cabut hak INSERT anonim dan hapus policy pada tabel dormant
DROP POLICY IF EXISTS "public_form_tokens_anon_insert" ON public.public_form_tokens;
REVOKE INSERT ON TABLE public.public_form_tokens FROM anon;

-- 6. Remediasi Penyelarasan Kolom pada Policy Relasional Lama
-- 6.1. employee_job_history (menggunakan to_unit_id & from_unit_id, bukan unit_id)
DROP POLICY IF EXISTS "employee_job_history_read" ON public.employee_job_history;
CREATE POLICY "employee_job_history_read" ON public.employee_job_history
    FOR SELECT TO authenticated
    USING (has_unit_permission(to_unit_id, 'employees.view') OR (from_unit_id IS NOT NULL AND has_unit_permission(from_unit_id, 'employees.view')));

DROP POLICY IF EXISTS "employee_job_history_insert" ON public.employee_job_history;
CREATE POLICY "employee_job_history_insert" ON public.employee_job_history
    FOR INSERT TO authenticated
    WITH CHECK (has_unit_permission(to_unit_id, 'employees.update'));

-- 6.2. system_notifications (menggunakan recipient_user_id, bukan recipient_profile_id)
DROP POLICY IF EXISTS "system_notifications_read_recipient" ON public.system_notifications;
CREATE POLICY "system_notifications_read_recipient" ON public.system_notifications
    FOR SELECT TO authenticated
    USING (recipient_user_id = auth.uid() OR recipient_user_id IS NULL);
