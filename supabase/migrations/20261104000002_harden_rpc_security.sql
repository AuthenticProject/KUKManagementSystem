-- ======================================================================
-- KUK MANAGEMENT SYSTEM v3.1.0 — RPC SECURITY HARDENING MIGRATION
-- Migration Version: 20261104000002
-- Scope: Multi-layer In-Body Authentication/Authorization & Privilege Hardening
-- Target Engine: PostgreSQL 15+ (Supabase Managed PostgreSQL)
-- Status: FINAL REVIEW COMPLETE — PENDING USER EXECUTION APPROVAL
-- ======================================================================

BEGIN;

-- ----------------------------------------------------------------------
-- 1. HARDEN calculate_and_finalize_payroll_atomic
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_and_finalize_payroll_atomic(
    p_unit_id UUID,
    p_payroll_period_id UUID,
    p_finalized_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period RECORD;
    v_emp RECORD;
    v_slip_id UUID;
    v_slip_num VARCHAR(50);
    v_period_key VARCHAR(10);
    v_earnings NUMERIC(12,2);
    v_deductions NUMERIC(12,2);
    v_net NUMERIC(12,2);
    v_tip_amount NUMERIC(12,2);
    v_comp RECORD;
    v_total_payroll NUMERIC(14,2) := 0.00;
BEGIN
    -- [SECURITY LAYER 1] Verifikasi Sesi Autentikasi Aktif
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Akses Ditolak: Operasi finalisasi payroll memerlukan sesi autentikasi aktif.'
            USING ERRCODE = '42501';
    END IF;

    -- [SECURITY LAYER 2] Verifikasi Anti-Spoofing Identitas Eksekutor
    IF p_finalized_by IS NULL OR p_finalized_by != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: ID eksekutor (p_finalized_by) tidak sesuai dengan identitas pengguna yang terautentikasi.'
            USING ERRCODE = '42501';
    END IF;

    -- [SECURITY LAYER 3] Verifikasi Otorisasi Wewenang Unit (RBAC Multi-Tenant)
    IF NOT (has_system_role('super_admin') OR has_unit_permission(p_unit_id, 'payroll.manage')) THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang (payroll.manage) untuk memfinalisasi payroll pada unit ini.'
            USING ERRCODE = '42501';
    END IF;

    -- [BUSINESS LAYER 1] Validasi Keberadaan & Kunci Baris Periode Payroll (Pencegahan Race Condition)
    SELECT * INTO v_period 
    FROM payroll_periods 
    WHERE unit_id = p_unit_id AND id = p_payroll_period_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Periode payroll tidak ditemukan pada unit ini.';
    END IF;

    -- Validasi status eksplisit dengan whitelist (hanya DRAFT atau CALCULATED yang dapat difinalisasi)
    IF v_period.status = 'FINALIZED' THEN
        RAISE EXCEPTION 'Periode payroll ini sudah berstatus FINALIZED dan tidak boleh difinalisasi ulang.';
    ELSIF v_period.status IS NULL OR v_period.status NOT IN ('DRAFT', 'CALCULATED') THEN
        RAISE EXCEPTION 'Periode payroll tidak dalam status yang dapat difinalisasi (status saat ini: %).', COALESCE(v_period.status::text, 'NULL');
    END IF;

    v_period_key := to_char(v_period.end_date, 'YYYYMM');

    -- [BUSINESS LAYER 2] Iterasi Karyawan Aktif yang Memiliki Struktur Gaji di Unit
    FOR v_emp IN
        SELECT e.id, e.full_name, d.name as dept_name, pos.title as pos_title,
               ss.id as struct_id, ss.base_salary
        FROM employees e
        JOIN departments d ON e.unit_id = d.unit_id AND e.department_id = d.id
        JOIN positions pos ON e.unit_id = pos.unit_id AND e.position_id = pos.id
        JOIN employee_salary_structures ss ON e.unit_id = ss.unit_id AND e.id = ss.employee_id
        WHERE e.unit_id = p_unit_id AND e.status = 'ACTIVE' AND ss.is_active = TRUE
    LOOP
        v_earnings := v_emp.base_salary;
        v_deductions := 0.00;

        -- Generate nomor slip unik melalui pemanggilan internal
        v_slip_num := generate_document_number_atomic(p_unit_id, 'SLIP', v_period_key);

        -- Buat baris master slip gaji (dilindungi composite unique constraint uq_pay_rec_emp)
        INSERT INTO payroll_records (
            unit_id, payroll_period_id, employee_id, slip_number,
            snapshot_employee_name, snapshot_department_name, snapshot_position_title,
            total_earnings, total_deductions, net_salary, payment_status
        ) VALUES (
            p_unit_id, p_payroll_period_id, v_emp.id, v_slip_num,
            v_emp.full_name, v_emp.dept_name, v_emp.pos_title,
            0.00, 0.00, 0.00, 'PENDING_PAYMENT'
        ) RETURNING id INTO v_slip_id;

        -- Tambahkan komponen Gaji Pokok
        INSERT INTO payroll_items (unit_id, payroll_record_id, component_name, component_type, amount)
        VALUES (p_unit_id, v_slip_id, 'Gaji Pokok', 'ALLOWANCE', v_emp.base_salary);

        -- Tambahkan komponen tunjangan & potongan terkonfigurasi
        FOR v_comp IN
            SELECT sc.name, sc.component_type, sci.amount
            FROM employee_salary_component_items sci
            JOIN salary_components sc ON sci.unit_id = sc.unit_id AND sci.component_id = sc.id
            WHERE sci.unit_id = p_unit_id AND sci.structure_id = v_emp.struct_id
        LOOP
            IF v_comp.component_type IN ('ALLOWANCE', 'BONUS', 'BENEFIT') THEN
                v_earnings := v_earnings + v_comp.amount;
            ELSE
                v_deductions := v_deductions + v_comp.amount;
            END IF;

            INSERT INTO payroll_items (unit_id, payroll_record_id, component_name, component_type, amount)
            VALUES (p_unit_id, v_slip_id, v_comp.name, v_comp.component_type, v_comp.amount);
        END LOOP;

        -- Tarik Tip Kaca Terverifikasi
        SELECT COALESCE(SUM(verified_amount), 0.00) INTO v_tip_amount
        FROM glass_tips
        WHERE unit_id = p_unit_id
          AND employee_id = v_emp.id
          AND status = 'VERIFIED'
          AND payroll_period_id IS NULL;

        IF v_tip_amount > 0 THEN
            v_earnings := v_earnings + v_tip_amount;

            INSERT INTO payroll_items (unit_id, payroll_record_id, component_name, component_type, amount)
            VALUES (p_unit_id, v_slip_id, 'Tip Pemotongan Kaca Terverifikasi', 'ALLOWANCE', v_tip_amount);

            -- Tandai tip agar tidak ditarik ganda di periode berikutnya
            UPDATE glass_tips
            SET payroll_period_id = p_payroll_period_id, updated_at = now()
            WHERE unit_id = p_unit_id AND employee_id = v_emp.id AND status = 'VERIFIED' AND payroll_period_id IS NULL;
        END IF;

        v_net := v_earnings - v_deductions;
        v_total_payroll := v_total_payroll + v_net;

        -- Update nilai akhir slip gaji dengan unit scope eksplisit
        UPDATE payroll_records
        SET total_earnings = v_earnings,
            total_deductions = v_deductions,
            net_salary = v_net,
            updated_at = now()
        WHERE id = v_slip_id AND unit_id = p_unit_id;
    END LOOP;

    -- [BUSINESS LAYER 3] Kunci Status Periode Payroll menjadi FINALIZED dengan unit scope eksplisit
    UPDATE payroll_periods
    SET status = 'FINALIZED',
        total_net_payout = v_total_payroll,
        finalized_at = now(),
        finalized_by = p_finalized_by,
        updated_at = now()
    WHERE id = p_payroll_period_id AND unit_id = p_unit_id;

    -- [BUSINESS LAYER 4] Catat Audit Log
    INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
    VALUES (
        p_unit_id, p_finalized_by, 'FINALIZATION', 'payroll_periods', p_payroll_period_id::text,
        jsonb_build_object('total_payout', v_total_payroll, 'status', 'FINALIZED')
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'payroll_period_id', p_payroll_period_id,
        'total_net_payout', v_total_payroll,
        'status', 'FINALIZED',
        'message', 'Payroll berhasil dikalkulasi dan difinalisasi secara permanen.'
    );
END;
$$;


-- ----------------------------------------------------------------------
-- 2. HARDEN cancel_leave_request_atomic
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_leave_request_atomic(
    p_unit_id UUID,
    p_leave_id UUID,
    p_cancelled_by UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
BEGIN
    -- [SECURITY LAYER 1] Verifikasi Sesi Autentikasi Aktif
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Akses Ditolak: Pembatalan permohonan cuti memerlukan sesi autentikasi aktif.'
            USING ERRCODE = '42501';
    END IF;

    -- [SECURITY LAYER 2] Verifikasi Anti-Spoofing Identitas Pembatal
    IF p_cancelled_by IS NULL OR p_cancelled_by != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: ID pembatal (p_cancelled_by) tidak sesuai dengan identitas sesi pengguna aktif.'
            USING ERRCODE = '42501';
    END IF;

    -- [SECURITY LAYER 3] Verifikasi Wewenang Unit (leave.manage / super_admin)
    IF NOT (has_system_role('super_admin') OR has_unit_permission(p_unit_id, 'leave.manage')) THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang (leave.manage) untuk membatalkan pengajuan cuti pada unit ini.'
            USING ERRCODE = '42501';
    END IF;

    -- [BUSINESS LAYER 1] Validasi Keberadaan & Kunci Baris Permohonan Cuti (Pencegahan Race Condition)
    SELECT * INTO v_req 
    FROM leave_requests 
    WHERE unit_id = p_unit_id AND id = p_leave_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Permohonan cuti tidak ditemukan pada unit ini.';
    END IF;

    IF v_req.status != 'APPROVED' THEN
        RAISE EXCEPTION 'Hanya cuti berstatus APPROVED yang dapat dibatalkan.';
    END IF;

    -- [BUSINESS LAYER 2] Bebaskan slot konflik jadwal
    UPDATE leave_conflict_slots
    SET is_active = FALSE,
        released_at = now()
    WHERE unit_id = p_unit_id AND leave_request_id = p_leave_id;

    -- [BUSINESS LAYER 3] Update status master permohonan cuti dengan unit scope eksplisit
    UPDATE leave_requests
    SET status = 'CANCELLED',
        cancelled_at = now(),
        cancellation_reason = p_reason,
        cancelled_by = p_cancelled_by,
        updated_at = now()
    WHERE id = p_leave_id AND unit_id = p_unit_id;

    -- [BUSINESS LAYER 4] Catat ke Audit Log
    INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
    VALUES (
        p_unit_id, p_cancelled_by, 'UPDATE_CANCEL', 'leave_requests', p_leave_id::text,
        jsonb_build_object('status', 'CANCELLED', 'reason', p_reason)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Pengajuan cuti berhasil dibatalkan dan slot tanggal telah dibebaskan kembali.'
    );
END;
$$;


-- ----------------------------------------------------------------------
-- 3. PRIVILEGE HARDENING & LEAST PRIVILEGE ENFORCEMENT
-- ----------------------------------------------------------------------

-- A. Cabut hak eksekusi PUBLIC, anon, dan service_role pada fungsi sensitif interaktif manusia
REVOKE EXECUTE ON FUNCTION public.calculate_and_finalize_payroll_atomic(UUID, UUID, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_and_finalize_payroll_atomic(UUID, UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_leave_request_atomic(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_leave_request_atomic(UUID, UUID, UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_document_number_atomic(UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_document_number_atomic(UUID, VARCHAR, VARCHAR) TO authenticated, service_role;

-- B. Tegaskan hak akses pada endpoint publik mandiri (Kiosk & Form Publik)
GRANT EXECUTE ON FUNCTION public.submit_leave_request_atomic(UUID, UUID, VARCHAR, VARCHAR, DATE[], TEXT, VARCHAR, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.book_vehicle_atomic(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO anon, authenticated, service_role;

-- C. Tegaskan hak akses pada Helper RLS
GRANT EXECUTE ON FUNCTION public.has_system_role(VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_unit_access(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_unit_permission(UUID, VARCHAR) TO anon, authenticated, service_role;

COMMIT;
