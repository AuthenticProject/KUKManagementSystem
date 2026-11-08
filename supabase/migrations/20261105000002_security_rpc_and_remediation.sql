-- ============================================================================
-- KUK MANAGEMENT SYSTEM v3.1.0
-- Migration: 20261105000002_security_rpc_and_remediation.sql
-- Description: Phase 1A Security Package: RLS Remediation & Hardened RPC Procedures
-- Target: PostgreSQL 17 (Supabase Architecture)
-- Status: LOCAL DRAFT — NOT APPLIED TO PRODUCTION
-- ============================================================================

BEGIN;

-- ============================================================================
-- SEKSI 1: RLS POLICY REMEDIATION & PRIVILEGE HARDENING
-- ============================================================================

-- 1.1. Penutupan Total Direct INSERT Anonim & Terautentikasi pada glass_tips
-- Transaksi pengajuan tip hanya diizinkan melalui prosedur atomik submit_glass_tip_atomic
DROP POLICY IF EXISTS "glass_tips_insert_anon" ON public.glass_tips;
REVOKE INSERT ON TABLE public.glass_tips FROM anon, authenticated, PUBLIC;

-- 1.2. Penutupan Total Direct INSERT Anonim & Terautentikasi pada vehicle_borrowing_requests
-- Transaksi reservasi kendaraan hanya diizinkan melalui prosedur atomik book_vehicle_atomic
DROP POLICY IF EXISTS "vehicle_borrowing_requests_insert_anon" ON public.vehicle_borrowing_requests;
REVOKE INSERT ON TABLE public.vehicle_borrowing_requests FROM anon, authenticated, PUBLIC;

-- 1.3. Penegakan Identitas Asli & Anti-Spoofing pada audit_logs
-- Authenticated user hanya dapat meng-insert log dengan actor_id = auth.uid()
-- Jalur anonim tidak memiliki izin INSERT langsung (RPC kiosk mencatat via SECURITY DEFINER)
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        actor_id = auth.uid()
    );
REVOKE INSERT ON TABLE public.audit_logs FROM anon, PUBLIC;

-- 1.4. Immutabilitas Data Kepatuhan Ketenagakerjaan: Cegah Hard-Delete
-- CATATAN TEKNIS: Wajib AS RESTRICTIVE agar (PERMISSIVE POLICIES) AND FALSE = FALSE.

DROP POLICY IF EXISTS "leave_requests_delete_deny" ON public.leave_requests;
CREATE POLICY "leave_requests_delete_deny" ON public.leave_requests
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (false);

DROP POLICY IF EXISTS "warning_letters_delete_deny" ON public.warning_letters;
CREATE POLICY "warning_letters_delete_deny" ON public.warning_letters
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (false);

DROP POLICY IF EXISTS "violation_records_delete_deny" ON public.violation_records;
CREATE POLICY "violation_records_delete_deny" ON public.violation_records
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (false);

DROP POLICY IF EXISTS "attendance_daily_records_delete_deny" ON public.attendance_daily_records;
CREATE POLICY "attendance_daily_records_delete_deny" ON public.attendance_daily_records
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (false);

-- 1.5. Penutupan Hak Akses Penuh pada Tabel Dormant public_form_tokens
DROP POLICY IF EXISTS "public_form_tokens_anon_insert" ON public.public_form_tokens;
REVOKE ALL ON TABLE public.public_form_tokens FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_form_tokens TO service_role;

-- 1.6. Koreksi Nama Kolom pada Policy Relasional Skema Lama
DROP POLICY IF EXISTS "employee_job_history_read" ON public.employee_job_history;
CREATE POLICY "employee_job_history_read" ON public.employee_job_history
    FOR SELECT TO authenticated
    USING (has_unit_permission(to_unit_id, 'employees.view') OR (from_unit_id IS NOT NULL AND has_unit_permission(from_unit_id, 'employees.view')));

DROP POLICY IF EXISTS "employee_job_history_insert" ON public.employee_job_history;
CREATE POLICY "employee_job_history_insert" ON public.employee_job_history
    FOR INSERT TO authenticated
    WITH CHECK (has_unit_permission(to_unit_id, 'employees.update'));

DROP POLICY IF EXISTS "system_notifications_read_recipient" ON public.system_notifications;
CREATE POLICY "system_notifications_read_recipient" ON public.system_notifications
    FOR SELECT TO authenticated
    USING (recipient_user_id = auth.uid() OR recipient_user_id IS NULL);

-- 1.7. Penutupan Total Direct UPDATE pada glass_tips & vehicle_borrowing_requests
-- Mutasi status hanya diizinkan melalui prosedur atomik terverifikasi (verify_glass_tip_atomic & approve_vehicle_atomic)
DROP POLICY IF EXISTS "glass_tips_update" ON public.glass_tips;
REVOKE UPDATE ON TABLE public.glass_tips FROM anon, authenticated, PUBLIC;

DROP POLICY IF EXISTS "vehicle_borrowing_requests_update" ON public.vehicle_borrowing_requests;
REVOKE UPDATE ON TABLE public.vehicle_borrowing_requests FROM anon, authenticated, PUBLIC;

-- 1.8. Infrastruktur Rate Limiting Sisi Database untuk Endpoint Transaksi Publik
-- Melindungi prosedur atomik publik dari brute-force, DOS per akun, dan distributed abuse
CREATE TABLE IF NOT EXISTS public.rpc_rate_limits (
    bucket_key VARCHAR(150) PRIMARY KEY,
    attempt_count INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rpc_rate_limits FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.rpc_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
    p_bucket_key VARCHAR(150),
    p_max_attempts INT,
    p_window_interval INTERVAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- Validasi Parameter Dasar (Anti-NULL dan Batas Nilai Masukan)
    IF p_bucket_key IS NULL OR TRIM(p_bucket_key) = '' OR length(TRIM(p_bucket_key)) > 150 THEN
        RETURN FALSE;
    END IF;

    IF p_max_attempts IS NULL OR p_max_attempts <= 0 THEN
        RETURN FALSE;
    END IF;

    IF p_window_interval IS NULL OR p_window_interval <= INTERVAL '0 second' THEN
        RETURN FALSE;
    END IF;

    -- Menjamin atomisitas tingkat tinggi di bawah konkurensi dengan loop transaksi
    LOOP
        SELECT * INTO v_rec
        FROM rpc_rate_limits
        WHERE bucket_key = TRIM(p_bucket_key)
        FOR UPDATE;

        IF FOUND THEN
            -- Reset jika jendela waktu telah kadaluarsa
            IF v_now - v_rec.window_start > p_window_interval THEN
                UPDATE rpc_rate_limits
                SET attempt_count = 1,
                    window_start = v_now,
                    last_attempt_at = v_now
                WHERE bucket_key = TRIM(p_bucket_key);
                RETURN TRUE;
            END IF;

            -- Jika masih dalam jendela dan melebihi batas, tolak
            IF v_rec.attempt_count >= p_max_attempts THEN
                UPDATE rpc_rate_limits
                SET last_attempt_at = v_now
                WHERE bucket_key = TRIM(p_bucket_key);
                RETURN FALSE;
            END IF;

            -- Tambah counter percobaan
            UPDATE rpc_rate_limits
            SET attempt_count = v_rec.attempt_count + 1,
                last_attempt_at = v_now
            WHERE bucket_key = TRIM(p_bucket_key);

            RETURN TRUE;
        ELSE
            -- Inisialisasi entri bucket jika belum ada
            BEGIN
                INSERT INTO rpc_rate_limits (bucket_key, attempt_count, window_start, last_attempt_at)
                VALUES (TRIM(p_bucket_key), 1, v_now, v_now);
                RETURN TRUE;
            EXCEPTION
                WHEN unique_violation THEN
                    -- Race condition tertangani: ulangi loop untuk SELECT FOR UPDATE
                    NULL;
            END;
        END IF;
    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(VARCHAR, INT, INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(VARCHAR, INT, INTERVAL) TO service_role;

-- Index & Prosedur Maintenance Pembersihan (Pruning) Tabel Rate Limits
CREATE INDEX IF NOT EXISTS idx_rpc_rate_limits_window_start ON public.rpc_rate_limits (window_start);

CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits(
    p_older_than INTERVAL DEFAULT INTERVAL '1 day'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.rpc_rate_limits
    WHERE window_start < (clock_timestamp() - p_older_than);

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_rate_limits(INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits(INTERVAL) TO service_role;

-- 1.9. Relaksasi Constraint tip_percentage_snapshot pada glass_tips
-- Menghilangkan fallback hardcoded 3% (0.0300) dan mengizinkan NULL saat metode tarif non-persentase (PER_SQM / PER_PIECE)
ALTER TABLE public.glass_tips ALTER COLUMN tip_percentage_snapshot DROP NOT NULL;
ALTER TABLE public.glass_tips ALTER COLUMN tip_percentage_snapshot DROP DEFAULT;


-- ============================================================================
-- SEKSI 2: EMPLOYEE KIOSK PIN & RESET PROCEDURE
-- ============================================================================

-- Prosedur administratif untuk reset PIN Kiosk oleh staf berwenang
CREATE OR REPLACE FUNCTION public.reset_employee_kiosk_pin(
    p_unit_id UUID,
    p_employee_id UUID,
    p_new_pin VARCHAR(10)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_emp RECORD;
    v_rows_affected INT;
BEGIN
    -- 1. Validasi Sesi Autentikasi Staf
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Akses Ditolak: Operasi reset PIN memerlukan sesi autentikasi aktif.';
    END IF;

    -- 2. Validasi Parameter Wajib
    IF p_unit_id IS NULL OR p_employee_id IS NULL THEN
        RAISE EXCEPTION 'Unit dan ID karyawan wajib ditentukan.';
    END IF;

    -- 3. Validasi Izin Otoritas Staf pada Unit Spesifik
    IF NOT has_unit_permission(p_unit_id, 'employees.manage_sensitive') THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang mengelola data sensitif/PIN karyawan pada unit ini.';
    END IF;

    -- 4. Validasi Format PIN (Tepat 6 Digit Numerik)
    IF p_new_pin IS NULL OR length(p_new_pin) != 6 OR p_new_pin !~ '^[0-9]{6}$' THEN
        RAISE EXCEPTION 'Format PIN tidak valid: PIN wajib terdiri dari tepat 6 digit angka numerik.';
    END IF;

    -- 5. Validasi Keberadaan & Status Karyawan (Terkunci pada unit yang sama - Anti-Cross-Unit)
    SELECT id, status INTO v_emp
    FROM employees
    WHERE unit_id = p_unit_id AND id = p_employee_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Karyawan tidak ditemukan pada unit bersangkutan.';
    END IF;

    IF v_emp.status IS DISTINCT FROM 'ACTIVE' THEN
        RAISE EXCEPTION 'Karyawan berstatus non-aktif (%). PIN tidak dapat direset.', COALESCE(v_emp.status, 'NULL');
    END IF;

    -- 6. Simpan Hash Bcrypt & Bersihkan Status Lockout
    INSERT INTO employee_portal_auth (
        employee_id, unit_id, pin_hash, failed_attempts, locked_until, updated_at
    ) VALUES (
        p_employee_id,
        p_unit_id,
        crypt(p_new_pin, gen_salt('bf', 10)),
        0,
        NULL,
        now()
    )
    ON CONFLICT (employee_id) DO UPDATE
    SET pin_hash = crypt(p_new_pin, gen_salt('bf', 10)),
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = now()
    WHERE employee_portal_auth.unit_id = p_unit_id;

    -- Verifikasi jumlah baris yang benar-benar termodifikasi
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    IF v_rows_affected = 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'code', 'NO_ROWS_MODIFIED',
            'message', 'Gagal memperbarui PIN Kiosk: Tidak ada baris otentikasi yang dimodifikasi. Pastikan data otentikasi sesuai unit.'
        );
    END IF;

    -- 7. Catat Jejak Audit dalam Transaksi yang Sama
    INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
    VALUES (
        p_unit_id,
        auth.uid(),
        'RESET_KIOSK_PIN',
        'employee_portal_auth',
        p_employee_id::text,
        jsonb_build_object('reset_by', auth.uid(), 'reset_at', now(), 'employee_id', p_employee_id)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'employee_id', p_employee_id,
        'message', 'PIN Kiosk karyawan berhasil diperbarui dan status lockout dibersihkan.'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_employee_kiosk_pin(UUID, UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_employee_kiosk_pin(UUID, UUID, VARCHAR) TO authenticated, service_role;


-- ============================================================================
-- SEKSI 3: TRANSAKSI GLASS TIPS (SUBMISSION & VERIFIKASI)
-- ============================================================================

-- 3.1. Pengajuan Nota Tip Kaca Mandiri via Terminal Kiosk Lapangan
CREATE OR REPLACE FUNCTION public.submit_glass_tip_atomic(
    p_unit_id UUID,
    p_employee_code VARCHAR(50),
    p_auth_pin VARCHAR(10),
    p_glass_type_id UUID,
    p_length_cm NUMERIC(10, 2),
    p_height_cm NUMERIC(10, 2),
    p_quantity INT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_emp RECORD;
    v_auth RECORD;
    v_glass_type RECORD;
    v_rate RECORD;
    v_sqm NUMERIC(10, 4);
    v_raw_tip NUMERIC(12, 2);
    v_tip_amount NUMERIC(12, 2);
    v_code VARCHAR(50);
    v_tip_id UUID;
    v_period_key VARCHAR(10);
    v_calculated_hash TEXT;
    v_new_attempts INT;
    v_new_locked TIMESTAMPTZ;
    v_client_ip TEXT;
BEGIN
    -- 0. Server-Side Atomic Rate Limiting (Proteksi DDoS & Brute-Force Akun Karyawan)
    BEGIN
        v_client_ip := TRIM(COALESCE(
            current_setting('request.headers', true)::json->>'cf-connecting-ip',
            current_setting('request.headers', true)::json->>'x-real-ip',
            split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
            inet_client_addr()::text,
            'unknown-client'
        ));
        IF v_client_ip = '' THEN
            v_client_ip := 'unknown-client';
        END IF;
        v_client_ip := SUBSTRING(v_client_ip, 1, 45);
    EXCEPTION
        WHEN OTHERS THEN
            v_client_ip := 'unknown-client';
    END;

    -- Batas 1: Rate limit per IP (Maksimal 30 request / 5 menit)
    IF NOT check_and_increment_rate_limit('tip_ip:' || v_client_ip, 30, INTERVAL '5 minutes') THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'RATE_LIMIT_EXCEEDED',
            'message', 'Batas frekuensi permintaan dari perangkat ini telah tercapai. Silakan coba kembali dalam 5 menit.'
        );
    END IF;

    -- Batas 2: Rate limit per target akun karyawan (Maksimal 10 percobaan / 10 menit untuk cegah lockout denial-of-service)
    IF p_employee_code IS NOT NULL AND TRIM(p_employee_code) != '' THEN
        IF NOT check_and_increment_rate_limit('tip_emp:' || p_unit_id::text || ':' || TRIM(p_employee_code), 10, INTERVAL '10 minutes') THEN
            PERFORM crypt(COALESCE(p_auth_pin, '000000'), '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
            RETURN jsonb_build_object(
                'success', false,
                'code', 'RATE_LIMIT_EXCEEDED',
                'message', 'Terlalu banyak percobaan pada kode karyawan ini. Silakan coba kembali dalam 10 menit.'
            );
        END IF;
    END IF;

    -- 1. Validasi Parameter Dasar Wajib
    IF p_unit_id IS NULL OR p_glass_type_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Unit dan tipe kaca wajib ditentukan.');
    END IF;

    IF p_employee_code IS NULL OR TRIM(p_employee_code) = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Kode karyawan wajib diisi.');
    END IF;

    IF p_notes IS NOT NULL AND length(p_notes) > 500 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Catatan melebihi batas maksimal 500 karakter.');
    END IF;

    -- 2. Validasi Format PIN (Wajib Tepat 6 Digit Numerik dan Non-NULL)
    -- Jika PIN tidak valid formatnya, jalankan dummy bcrypt untuk menyamarkan timing sebelum return failure
    IF p_auth_pin IS NULL OR length(p_auth_pin) != 6 OR p_auth_pin !~ '^[0-9]{6}$' THEN
        PERFORM crypt(COALESCE(p_auth_pin, '000000'), '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
        RETURN jsonb_build_object('success', false, 'code', 'AUTH_FAILED', 'message', 'Otentikasi Kiosk Gagal: Kredensial atau PIN salah.');
    END IF;

    -- 3. Validasi Batas Fisik Dimensi & Kuantitas
    IF p_length_cm IS NULL OR p_length_cm < 5.00 OR p_length_cm > 600.00 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_DIMENSION', 'message', 'Panjang potongan kaca di luar batas fisik yang diizinkan (5.0 s/d 600.0 cm).');
    END IF;
    IF p_height_cm IS NULL OR p_height_cm < 5.00 OR p_height_cm > 350.00 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_DIMENSION', 'message', 'Tinggi potongan kaca di luar batas fisik yang diizinkan (5.0 s/d 350.0 cm).');
    END IF;
    IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 500 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_QUANTITY', 'message', 'Kuantitas potongan kaca tidak valid (Wajib 1 s/d 500 lembar per nota).');
    END IF;

    -- 4. Cari Data Karyawan pada Unit
    SELECT e.id, e.unit_id, e.status INTO v_emp
    FROM employees e
    WHERE e.unit_id = p_unit_id AND e.employee_code = TRIM(p_employee_code);

    -- Anti-Timing Enumeration Guard: Jika karyawan tidak ada atau non-aktif, samarkan timing dengan Bcrypt dummy
    IF v_emp.id IS NULL OR v_emp.status IS DISTINCT FROM 'ACTIVE' THEN
        PERFORM crypt(p_auth_pin, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
        RETURN jsonb_build_object('success', false, 'code', 'AUTH_FAILED', 'message', 'Otentikasi Kiosk Gagal: Kredensial atau PIN salah.');
    END IF;

    -- 5. Kunci Baris Otentikasi Karyawan secara Eksklusif (FOR UPDATE)
    SELECT * INTO v_auth
    FROM employee_portal_auth
    WHERE employee_id = v_emp.id AND unit_id = p_unit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        PERFORM crypt(p_auth_pin, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
        RETURN jsonb_build_object('success', false, 'code', 'AUTH_FAILED', 'message', 'Otentikasi Kiosk Gagal: Kredensial atau PIN salah.');
    END IF;

    -- 6. Evaluasi Status Lockout
    IF v_auth.locked_until IS NOT NULL AND v_auth.locked_until > now() THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ACCOUNT_LOCKED',
            'message', 'Akun portal karyawan terkunci sementara hingga ' ||
                to_char(v_auth.locked_until AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS "WIB"') ||
                ' karena kegagalan autentikasi berulang.'
        );
    END IF;

    -- 7. Evaluasi Hash PIN Bcrypt (NULL-safe & Persistensi Lockout Tanpa Rollback)
    v_calculated_hash := crypt(p_auth_pin, COALESCE(v_auth.pin_hash, ''));

    IF v_auth.pin_hash IS NULL OR v_calculated_hash IS NULL OR (v_auth.pin_hash IS DISTINCT FROM v_calculated_hash) THEN
        v_new_attempts := COALESCE(v_auth.failed_attempts, 0) + 1;
        v_new_locked := CASE WHEN v_new_attempts >= 5 THEN now() + INTERVAL '30 minutes' ELSE NULL END;

        -- Simpan kenaikan kegagalan secara persisten
        UPDATE employee_portal_auth
        SET failed_attempts = v_new_attempts,
            locked_until = v_new_locked,
            updated_at = now()
        WHERE employee_id = v_emp.id;

        -- Catat audit log kegagalan autentikasi
        INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
        VALUES (
            p_unit_id,
            NULL,
            'KIOSK_PIN_FAILED',
            'employee_portal_auth',
            v_emp.id::text,
            jsonb_build_object(
                'employee_code', p_employee_code,
                'failed_attempts', v_new_attempts,
                'locked_until', v_new_locked
            )
        );

        IF v_new_attempts >= 5 THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'ACCOUNT_LOCKED',
                'message', 'Akun portal karyawan terkunci sementara selama 30 menit karena 5x kegagalan autentikasi.'
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'code', 'AUTH_FAILED',
                'message', 'Otentikasi Kiosk Gagal: Kredensial atau PIN salah.'
            );
        END IF;
    END IF;

    -- 8. Reset Failed Attempts Saat Sukses Autentikasi
    UPDATE employee_portal_auth
    SET failed_attempts = 0,
        locked_until = NULL,
        last_login_at = now(),
        updated_at = now()
    WHERE employee_id = v_emp.id;

    -- 9. Ambil Master Data Tipe Kaca & Tarif Aktif pada Tanggal Transaksi
    -- Sesuai skema kanonikal 20261104000001, kolom harga acuan adalah selling_price_per_sqm
    SELECT id, name, thickness_mm, selling_price_per_sqm INTO v_glass_type
    FROM glass_types
    WHERE id = p_glass_type_id AND unit_id = p_unit_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'GLASS_TYPE_NOT_FOUND', 'message', 'Tipe kaca tidak ditemukan pada unit bersangkutan.');
    END IF;

    -- Validasi Integritas Harga Master: Tolak jika harga jual acuan tidak ditentukan (NULL)
    IF v_glass_type.selling_price_per_sqm IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'INVALID_GLASS_PRICE',
            'message', 'Harga jual acuan tipe kaca belum ditentukan pada master data unit.'
        );
    END IF;

    SELECT id, calculation_method, base_rate, min_tip_amount, rounding_rule INTO v_rate
    FROM glass_tip_rates
    WHERE unit_id = p_unit_id
      AND glass_type_id = p_glass_type_id
      AND is_active = TRUE
      AND effective_range @> (now() AT TIME ZONE 'Asia/Jakarta')::date;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'RATE_NOT_FOUND', 'message', 'Konfigurasi tarif tip kaca belum tersedia untuk tipe kaca ini pada unit bersangkutan.');
    END IF;

    -- 10. Kalkulasi Luas m² dan Estimasi Tip Server-Side
    v_sqm := ROUND(((p_length_cm * p_height_cm) / 10000.0) * p_quantity, 4);

    IF v_rate.calculation_method = 'PER_SQM' THEN
        v_raw_tip := v_sqm * v_rate.base_rate;
    ELSIF v_rate.calculation_method = 'PER_PIECE' THEN
        v_raw_tip := p_quantity * v_rate.base_rate;
    ELSIF v_rate.calculation_method IN ('SIZE_RANGE', 'HYBRID') THEN
        -- Formula SIZE_RANGE dan HYBRID memerlukan persetujuan formula manajemen
        RETURN jsonb_build_object(
            'success', false,
            'code', 'METHOD_PENDING_APPROVAL',
            'message', 'Metode perhitungan ' || v_rate.calculation_method || ' masih menunggu persetujuan formula resmi manajemen (BUSINESS_RULE_PENDING_APPROVAL).'
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'code', 'UNSUPPORTED_METHOD',
            'message', 'Metode perhitungan tarif tip kaca tidak didukung.'
        );
    END IF;

    IF v_raw_tip < v_rate.min_tip_amount THEN
        v_raw_tip := v_rate.min_tip_amount;
    END IF;

    IF v_rate.rounding_rule = 'ROUND_UP_1000' THEN
        v_tip_amount := CEIL(v_raw_tip / 1000.0) * 1000.0;
    ELSIF v_rate.rounding_rule = 'ROUND_UP_500' THEN
        v_tip_amount := CEIL(v_raw_tip / 500.0) * 500.0;
    ELSIF v_rate.rounding_rule = 'ROUND_UP_100' THEN
        v_tip_amount := CEIL(v_raw_tip / 100.0) * 100.0;
    ELSE
        v_tip_amount := ROUND(v_raw_tip, 2);
    END IF;

    -- 11. Generate Nomor Nota Berurut Atomik
    v_period_key := to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYYMM');
    v_code := generate_document_number_atomic(p_unit_id, 'TIP', v_period_key);

    -- 12. Simpan Transaksi dengan Status Mutlak PENDING dan verified_amount NULL
    BEGIN
        INSERT INTO glass_tips (
            unit_id, reference_code, employee_id, glass_type_id, length_cm, height_cm,
            quantity, calculated_sqm, glass_price_snapshot, tip_percentage_snapshot,
            rounding_rule, tip_amount, verified_amount, status, notes
        ) VALUES (
            p_unit_id, v_code, v_emp.id, p_glass_type_id, p_length_cm, p_height_cm,
            p_quantity, v_sqm, COALESCE(v_glass_type.selling_price_per_sqm, 0.0),
            NULL,
            v_rate.rounding_rule, v_tip_amount, NULL, 'PENDING', p_notes
        ) RETURNING id INTO v_tip_id;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'INTERNAL_ERROR',
                'message', 'Terjadi kesalahan sistem saat menyimpan nota tip kaca.'
            );
    END;

    -- 13. Catat Audit Log
    INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
    VALUES (
        p_unit_id,
        NULL,
        'SUBMIT_TIP_KIOSK',
        'glass_tips',
        v_tip_id::text,
        jsonb_build_object(
            'reference_code', v_code,
            'employee_id', v_emp.id,
            'calculated_sqm', v_sqm,
            'estimated_tip', v_tip_amount
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'tip_id', v_tip_id,
        'reference_code', v_code,
        'calculated_sqm', v_sqm,
        'estimated_tip', v_tip_amount,
        'status', 'PENDING'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_glass_tip_atomic(UUID, VARCHAR, VARCHAR, UUID, NUMERIC, NUMERIC, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_glass_tip_atomic(UUID, VARCHAR, VARCHAR, UUID, NUMERIC, NUMERIC, INT, TEXT) TO anon, authenticated, service_role;


-- 3.2. Verifikasi / Penolakan Nota Tip oleh Petugas Kasir Terautentikasi
CREATE OR REPLACE FUNCTION public.verify_glass_tip_atomic(
    p_unit_id UUID,
    p_tip_id UUID,
    p_action VARCHAR(20),
    p_verified_amount NUMERIC(12, 2) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_tip RECORD;
    v_target_status glass_tip_status_enum;
    v_final_amount NUMERIC(12, 2);
BEGIN
    -- 1. Validasi Sesi Autentikasi
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Akses Ditolak: Operasi verifikasi tip memerlukan sesi autentikasi aktif.';
    END IF;

    -- 2. Validasi Parameter Wajib
    IF p_unit_id IS NULL OR p_tip_id IS NULL THEN
        RAISE EXCEPTION 'Unit dan ID nota tip wajib ditentukan.';
    END IF;

    IF p_action IS NULL OR p_action NOT IN ('VERIFY', 'REJECT') THEN
        RAISE EXCEPTION 'Aksi verifikasi tidak valid. Wajib VERIFY atau REJECT.';
    END IF;

    -- 3. Validasi Konsistensi Nominal terhadap Aksi
    IF p_action = 'VERIFY' AND (p_verified_amount IS NULL OR p_verified_amount <= 0) THEN
        RAISE EXCEPTION 'Nominal verifikasi tip wajib lebih besar dari 0.';
    END IF;

    IF p_action = 'REJECT' AND p_verified_amount IS NOT NULL THEN
        RAISE EXCEPTION 'Aksi REJECT tidak boleh menyertakan nominal verifikasi (verified_amount wajib NULL).';
    END IF;

    IF p_notes IS NOT NULL AND length(p_notes) > 500 THEN
        RAISE EXCEPTION 'Catatan verifikasi melebihi batas maksimal 500 karakter.';
    END IF;

    -- 4. Validasi Hak Izin Petugas pada Unit
    IF NOT has_unit_permission(p_unit_id, 'glass_tips.verify') THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang memverifikasi nota tip pada unit ini.';
    END IF;

    -- 5. Kunci Baris Sasaran Eksklusif (FOR UPDATE)
    SELECT * INTO v_tip
    FROM glass_tips
    WHERE id = p_tip_id AND unit_id = p_unit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nota tip kaca tidak ditemukan pada unit bersangkutan.';
    END IF;

    -- 6. Cegah Modifikasi Tip yang Sudah Masuk Penggajian
    IF v_tip.payroll_period_id IS NOT NULL THEN
        RAISE EXCEPTION 'Nota tip ini telah diserap ke dalam finalisasi gaji dan bersifat permanen (immutable).';
    END IF;

    -- 7. Validasi Transisi Status (Hanya Nota PENDING yang Boleh Diproses)
    IF v_tip.status != 'PENDING' THEN
        RAISE EXCEPTION 'Hanya nota tip berstatus PENDING yang dapat diverifikasi atau ditolak (Status saat ini: %).', v_tip.status;
    END IF;

    -- 8. Terapkan Transisi Status
    v_target_status := CASE WHEN p_action = 'VERIFY' THEN 'VERIFIED'::glass_tip_status_enum ELSE 'REJECTED'::glass_tip_status_enum END;
    v_final_amount := CASE WHEN p_action = 'VERIFY' THEN p_verified_amount ELSE NULL END;

    UPDATE glass_tips
    SET status = v_target_status,
        verified_amount = v_final_amount,
        notes = CASE WHEN p_notes IS NOT NULL THEN p_notes ELSE notes END,
        updated_at = now()
    WHERE id = p_tip_id AND unit_id = p_unit_id;

    -- 9. Catat Jejak Audit dalam Transaksi yang Sama
    INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
    VALUES (
        p_unit_id,
        auth.uid(),
        'VERIFY_TIP',
        'glass_tips',
        p_tip_id::text,
        jsonb_build_object(
            'action', p_action,
            'status', v_target_status,
            'verified_amount', v_final_amount,
            'verifier_id', auth.uid()
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'tip_id', p_tip_id,
        'status', v_target_status,
        'verified_amount', v_final_amount,
        'message', 'Nota tip berhasil ' || CASE WHEN p_action = 'VERIFY' THEN 'diverifikasi' ELSE 'ditolak' END || '.'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_glass_tip_atomic(UUID, UUID, VARCHAR, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_glass_tip_atomic(UUID, UUID, VARCHAR, NUMERIC, TEXT) TO authenticated, service_role;


-- ============================================================================
-- SEKSI 4: TRANSAKSI ARMADA (BOOKING ATOMIK & APPROVAL PETUGAS)
-- ============================================================================

-- 4.1. Hardened Booking Kendaraan
CREATE OR REPLACE FUNCTION public.book_vehicle_atomic(
    p_unit_id UUID,
    p_vehicle_id UUID,
    p_borrower_name VARCHAR(150),
    p_borrower_institution VARCHAR(150),
    p_borrower_phone VARCHAR(30),
    p_responsible_person VARCHAR(150),
    p_start_time TIMESTAMPTZ,
    p_estimated_return_time TIMESTAMPTZ,
    p_destination TEXT,
    p_purpose TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_veh RECORD;
    v_booking_id UUID;
    v_code VARCHAR(50);
    v_period_key VARCHAR(10);
    v_client_ip TEXT;
BEGIN
    -- 0. Server-Side Atomic Rate Limiting
    BEGIN
        v_client_ip := TRIM(COALESCE(
            current_setting('request.headers', true)::json->>'cf-connecting-ip',
            current_setting('request.headers', true)::json->>'x-real-ip',
            split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
            inet_client_addr()::text,
            'unknown-client'
        ));
        IF v_client_ip = '' THEN
            v_client_ip := 'unknown-client';
        END IF;
        v_client_ip := SUBSTRING(v_client_ip, 1, 45);
    EXCEPTION
        WHEN OTHERS THEN
            v_client_ip := 'unknown-client';
    END;

    -- Batas 1: Rate limit per IP (Maksimal 10 request / 10 menit)
    IF NOT check_and_increment_rate_limit('book_ip:' || v_client_ip, 10, INTERVAL '10 minutes') THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'RATE_LIMIT_EXCEEDED',
            'message', 'Batas frekuensi pengajuan kendaraan dari perangkat ini tercapai. Silakan coba kembali dalam 10 menit.'
        );
    END IF;

    -- Batas 2: Rate limit per armada spesifik (Maksimal 5 request / 10 menit untuk cegah flooding armada)
    IF p_vehicle_id IS NOT NULL THEN
        IF NOT check_and_increment_rate_limit('book_veh:' || p_vehicle_id::text, 5, INTERVAL '10 minutes') THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'RATE_LIMIT_EXCEEDED',
                'message', 'Terlalu banyak permohonan baru untuk armada ini dalam waktu singkat. Silakan tunggu beberapa menit.'
            );
        END IF;
    END IF;

    -- 1. Validasi Parameter Wajib Non-NULL & Non-Empty
    IF p_unit_id IS NULL OR p_vehicle_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Unit dan armada kendaraan wajib ditentukan.');
    END IF;

    IF p_borrower_name IS NULL OR TRIM(p_borrower_name) = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Nama peminjam wajib diisi.');
    END IF;

    IF p_borrower_phone IS NULL OR TRIM(p_borrower_phone) = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Nomor telepon peminjam wajib diisi.');
    END IF;

    IF p_responsible_person IS NULL OR TRIM(p_responsible_person) = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Penanggung jawab armada wajib diisi.');
    END IF;

    IF p_destination IS NULL OR TRIM(p_destination) = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Tujuan perjalanan wajib diisi.');
    END IF;

    IF p_purpose IS NULL OR TRIM(p_purpose) = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Keperluan peminjaman wajib diisi.');
    END IF;

    -- 2. Validasi Batas Maksimal Panjang Teks
    IF length(p_borrower_name) > 150 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Nama peminjam melebihi batas maksimal 150 karakter.');
    END IF;

    IF p_borrower_institution IS NOT NULL AND length(p_borrower_institution) > 150 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Institusi peminjam melebihi batas maksimal 150 karakter.');
    END IF;

    IF length(p_borrower_phone) > 30 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Nomor telepon peminjam melebihi batas maksimal 30 karakter.');
    END IF;

    IF length(p_responsible_person) > 150 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Penanggung jawab armada melebihi batas maksimal 150 karakter.');
    END IF;

    IF length(p_destination) > 500 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Tujuan perjalanan melebihi batas maksimal 500 karakter.');
    END IF;

    IF length(p_purpose) > 1000 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Keperluan peminjaman melebihi batas maksimal 1000 karakter.');
    END IF;

    -- 3. Validasi Kendaraan di Unit
    SELECT * INTO v_veh
    FROM vehicles
    WHERE unit_id = p_unit_id AND id = p_vehicle_id AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'VEHICLE_NOT_FOUND', 'message', 'Armada kendaraan tidak ditemukan atau tidak aktif pada unit ini.');
    END IF;

    IF v_veh.status IS NOT DISTINCT FROM 'DECOMMISSIONED' THEN
        RETURN jsonb_build_object('success', false, 'code', 'VEHICLE_DECOMMISSIONED', 'message', 'Kendaraan telah dinonaktifkan dari operasional.');
    END IF;

    -- 4. Validasi Rentang Waktu Ketat
    IF p_start_time IS NULL OR p_estimated_return_time IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_TIME_RANGE', 'message', 'Waktu mulai dan estimasi waktu kembali wajib diisi.');
    END IF;

    IF p_estimated_return_time <= p_start_time THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_TIME_RANGE', 'message', 'Perkiraan waktu kembali harus lebih besar dari waktu keluar kendaraan.');
    END IF;

    IF p_start_time < (clock_timestamp() - INTERVAL '15 minutes') THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_TIME_RANGE', 'message', 'Waktu mulai peminjaman tidak boleh berada di masa lampau.');
    END IF;

    IF p_estimated_return_time > (p_start_time + INTERVAL '30 days') THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_TIME_RANGE', 'message', 'Durasi peminjaman melebihi batas operasional maksimal (Maksimal 30 hari).');
    END IF;

    -- 5. Deteksi Awal Benturan Jadwal terhadap Reservasi Aktif
    IF EXISTS (
        SELECT 1 FROM vehicle_borrowing_requests
        WHERE vehicle_id = p_vehicle_id
          AND status IN ('APPROVED', 'IN_USE')
          AND tstzrange(start_time, estimated_return_time, '[)') && tstzrange(p_start_time, p_estimated_return_time, '[)')
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'SCHEDULE_CONFLICT', 'message', 'Kendaraan telah disetujui untuk peminjaman lain pada jadwal tersebut.');
    END IF;

    -- 6. Generate Nomor Dokumen Berurut
    v_period_key := to_char((clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYYMM');
    v_code := generate_document_number_atomic(p_unit_id, 'FLEET', v_period_key);

    -- 7. Simpan Permohonan Berstatus Terkunci PENDING
    BEGIN
        INSERT INTO vehicle_borrowing_requests (
            unit_id, vehicle_id, booking_code, borrower_name, borrower_institution,
            borrower_phone, responsible_person, start_time, estimated_return_time,
            destination, purpose, status, approved_by, approved_at, cancellation_reason
        ) VALUES (
            p_unit_id, p_vehicle_id, v_code, TRIM(p_borrower_name), TRIM(p_borrower_institution),
            TRIM(p_borrower_phone), TRIM(p_responsible_person), p_start_time, p_estimated_return_time,
            TRIM(p_destination), TRIM(p_purpose), 'PENDING', NULL, NULL, NULL
        ) RETURNING id INTO v_booking_id;
    EXCEPTION
        WHEN exclusion_violation THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'SCHEDULE_CONFLICT',
                'message', 'Jadwal peminjaman bertabrakan dengan reservasi kendaraan lain yang telah disetujui.'
            );
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'INTERNAL_ERROR',
                'message', 'Terjadi kesalahan sistem saat menyimpan permohonan peminjaman kendaraan.'
            );
    END;

    -- 8. Catat Audit Log Permohonan Publik
    INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
    VALUES (
        p_unit_id,
        NULL,
        'BOOK_VEHICLE_PUBLIC',
        'vehicle_borrowing_requests',
        v_booking_id::text,
        jsonb_build_object(
            'booking_code', v_code,
            'borrower_name', p_borrower_name,
            'vehicle_id', p_vehicle_id,
            'start_time', p_start_time,
            'estimated_return_time', p_estimated_return_time
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'booking_id', v_booking_id,
        'booking_code', v_code,
        'status', 'PENDING',
        'message', 'Pengajuan peminjaman kendaraan berhasil diajukan dan menunggu persetujuan petugas.'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_vehicle_atomic(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_vehicle_atomic(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO anon, authenticated, service_role;


-- 4.2. Persetujuan / Penolakan Peminjaman Armada oleh Petugas Berwenang
CREATE OR REPLACE FUNCTION public.approve_vehicle_atomic(
    p_unit_id UUID,
    p_request_id UUID,
    p_action VARCHAR(20),
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_target_status borrowing_status_enum;
BEGIN
    -- 1. Validasi Sesi Autentikasi Staf
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Akses Ditolak: Operasi persetujuan peminjaman memerlukan sesi autentikasi aktif.';
    END IF;

    -- 2. Validasi Parameter Wajib
    IF p_unit_id IS NULL OR p_request_id IS NULL THEN
        RAISE EXCEPTION 'Unit dan ID permohonan peminjaman armada wajib ditentukan.';
    END IF;

    IF p_action IS NULL OR p_action NOT IN ('APPROVE', 'REJECT') THEN
        RAISE EXCEPTION 'Aksi persetujuan tidak valid. Wajib APPROVE atau REJECT.';
    END IF;

    IF p_action = 'REJECT' AND p_rejection_reason IS NOT NULL AND length(p_rejection_reason) > 500 THEN
        RAISE EXCEPTION 'Alasan penolakan melebihi batas maksimal 500 karakter.';
    END IF;

    -- 3. Validasi Hak Izin Petugas pada Unit
    IF NOT has_unit_permission(p_unit_id, 'fleet.approve_borrowing') THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang menyetujui peminjaman armada pada unit ini.';
    END IF;

    -- 4. Kunci Baris Sasaran Eksklusif (FOR UPDATE)
    SELECT * INTO v_req
    FROM vehicle_borrowing_requests
    WHERE id = p_request_id AND unit_id = p_unit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Permohonan peminjaman armada tidak ditemukan pada unit bersangkutan.';
    END IF;

    -- 5. Validasi Transisi Status (Hanya Permohonan PENDING yang Boleh Diproses)
    IF v_req.status != 'PENDING' THEN
        RAISE EXCEPTION 'Hanya permohonan berstatus PENDING yang dapat disetujui atau ditolak (Status saat ini: %).', v_req.status;
    END IF;

    -- 6. Terapkan Transisi Status
    IF p_action = 'APPROVE' THEN
        v_target_status := 'APPROVED'::borrowing_status_enum;

        BEGIN
            UPDATE vehicle_borrowing_requests
            SET status = v_target_status,
                approved_by = auth.uid(),
                approved_at = now(),
                updated_at = now()
            WHERE id = p_request_id AND unit_id = p_unit_id;
        EXCEPTION
            WHEN exclusion_violation THEN
                -- Tangkap secara spesifik benturan jadwal tanpa menyamarkan error lain
                RAISE EXCEPTION 'Konflik Jadwal: Kendaraan ini telah memiliki reservasi aktif lain yang bertabrakan pada rentang waktu yang sama (Kode: 23P01).'
                    USING ERRCODE = '23P01';
        END;
    ELSE
        v_target_status := 'REJECTED'::borrowing_status_enum;

        UPDATE vehicle_borrowing_requests
        SET status = v_target_status,
            cancellation_reason = COALESCE(p_rejection_reason, 'Ditolak oleh petugas armada'),
            updated_at = now()
        WHERE id = p_request_id AND unit_id = p_unit_id;
    END IF;

    -- 7. Catat Jejak Audit
    INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
    VALUES (
        p_unit_id,
        auth.uid(),
        CASE WHEN p_action = 'APPROVE' THEN 'APPROVE_VEHICLE' ELSE 'REJECT_VEHICLE' END,
        'vehicle_borrowing_requests',
        p_request_id::text,
        jsonb_build_object(
            'action', p_action,
            'status', v_target_status,
            'approver_id', auth.uid()
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', p_request_id,
        'status', v_target_status,
        'message', 'Permohonan peminjaman armada berhasil ' || CASE WHEN p_action = 'APPROVE' THEN 'disetujui' ELSE 'ditolak' END || '.'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_vehicle_atomic(UUID, UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_vehicle_atomic(UUID, UUID, VARCHAR, TEXT) TO authenticated, service_role;

COMMIT;
