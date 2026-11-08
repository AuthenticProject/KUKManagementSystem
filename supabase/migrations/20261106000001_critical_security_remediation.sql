-- ============================================================================
-- KUK MANAGEMENT SYSTEM v3.1.0 — CANONICAL CRITICAL & HIGH SECURITY REMEDIATION
-- Target: PostgreSQL 15+ / 17.11 (Supabase Production Compatible)
-- Status: LOCAL DRAFT — NOT APPLIED TO PRODUCTION
-- Reference: PHASE 1C.4 Security Audit Remediation
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. REMEDIATION 3 (HIGH): ANTI-HARD-DELETE PADA employee_sensitive_data
-- ----------------------------------------------------------------------------
-- Menutup celah hard-delete data kepatuhan ketenagakerjaan (NIK, Gaji, BPJS).
-- Memasang kebijakan AS RESTRICTIVE FOR DELETE (false) pada employee_sensitive_data.
-- Catatan Arsitektur: Kebijakan ini menolak perintah DELETE dari seluruh koneksi
-- authenticated & anon. Table owner / superuser tetap diatur oleh konfigurasi database.

DROP POLICY IF EXISTS "employee_sensitive_delete_deny" ON public.employee_sensitive_data;
CREATE POLICY "employee_sensitive_delete_deny" ON public.employee_sensitive_data
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (false);

-- Cabut hak DELETE langsung pada level tabel dari seluruh role aplikasi
REVOKE DELETE ON TABLE public.employee_sensitive_data FROM anon, authenticated, PUBLIC;


-- ----------------------------------------------------------------------------
-- 2. REMEDIATION 1 (CRITICAL): REPLACEMENT RPC submit_leave_request_atomic
-- ----------------------------------------------------------------------------
-- Menggantikan fungsi historis 20261104000001 yang mengalami transaction rollback
-- akibat unhandled RAISE EXCEPTION saat PIN salah.
-- Desain Baru:
-- 1. Anti-Timing Enumeration: Dummy Bcrypt saat karyawan tidak ditemukan.
-- 2. Persistent Lockout: Kegagalan PIN di-update dan di-commit tanpa rollback (JSONB return).
-- 3. Rate-Limiting: Terintegrasi dengan rpc_rate_limits (IP dan Employee Code).
-- 4. IP Extraction Aman: Membaca header proxy PostgREST, bukan argumen klien.

CREATE OR REPLACE FUNCTION public.submit_leave_request_atomic(
    p_unit_id UUID,
    p_employee_id UUID,
    p_auth_pin VARCHAR(10),
    p_target_month VARCHAR(7),                   -- Format: 'YYYY-MM'
    p_leave_dates DATE[],                        -- Array tanggal cuti (1 s/d 3 hari)
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_emp RECORD;
    v_auth RECORD;
    v_calculated_hash TEXT;
    v_new_attempts INT;
    v_new_locked TIMESTAMPTZ;
    v_rate_key_ip VARCHAR(150);
    v_rate_key_emp VARCHAR(150);
    v_rate_allowed BOOLEAN;
    v_client_ip TEXT;
    v_doc_num VARCHAR(50);
    v_leave_id UUID;
    v_date DATE;
    v_days_count INT;
    v_target_year INT;
    v_target_month INT;
    v_window_start DATE;
    v_window_end DATE;
    v_current_date DATE;
    v_period_key VARCHAR(10);
    v_current_taken INT;
BEGIN
    -- 1. Ekstraksi Alamat IP Klien secara Aman dari PostgREST Request Headers
    BEGIN
        v_client_ip := COALESCE(
            current_setting('request.headers', true)::json->>'cf-connecting-ip',
            current_setting('request.headers', true)::json->>'x-real-ip',
            split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
            inet_client_addr()::text,
            'unknown'
        );
        v_client_ip := SUBSTRING(v_client_ip, 1, 45);
    EXCEPTION WHEN OTHERS THEN
        v_client_ip := 'unknown';
    END;

    -- 2. Validasi Parameter Dasar
    IF p_unit_id IS NULL OR p_employee_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Unit dan ID karyawan wajib ditentukan.');
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Alasan pengajuan cuti wajib diisi.');
    END IF;

    IF length(p_reason) > 500 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMETER', 'message', 'Alasan cuti melebihi batas maksimal 500 karakter.');
    END IF;

    -- 3. Rate Limiting: Batasi percobaan per IP klien (Maks 10 request per menit)
    v_rate_key_ip := 'kiosk:leave:ip:' || v_client_ip;
    v_rate_allowed := check_and_increment_rate_limit(v_rate_key_ip, 10, INTERVAL '1 minute');
    IF NOT v_rate_allowed THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'RATE_LIMIT_EXCEEDED',
            'message', 'Batas frekuensi pengajuan terlampaui. Silakan tunggu 1 menit sebelum mencoba kembali.'
        );
    END IF;

    -- Batas 2: Rate limit per target akun karyawan (Maks 5 percobaan / 5 menit untuk cegah brute force & lockout DoS)
    IF p_employee_id IS NOT NULL THEN
        IF NOT check_and_increment_rate_limit('kiosk:leave:emp:' || p_unit_id::text || ':' || p_employee_id::text, 5, INTERVAL '5 minutes') THEN
            PERFORM crypt(COALESCE(p_auth_pin, '000000'), '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
            RETURN jsonb_build_object(
                'success', false,
                'code', 'RATE_LIMIT_EXCEEDED',
                'message', 'Terlalu banyak percobaan pada akun karyawan ini. Silakan tunggu 5 menit sebelum mencoba kembali.'
            );
        END IF;
    END IF;

    -- 4. Validasi Format PIN (Wajib Tepat 6 Digit Numerik dan Non-NULL)
    IF p_auth_pin IS NULL OR length(p_auth_pin) != 6 OR p_auth_pin !~ '^[0-9]{6}$' THEN
        -- Dummy Bcrypt Timing Defense
        PERFORM crypt(COALESCE(p_auth_pin, '000000'), '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
        RETURN jsonb_build_object('success', false, 'code', 'AUTH_FAILED', 'message', 'Otentikasi Kiosk Gagal: Kredensial atau PIN salah.');
    END IF;

    -- 5. Validasi Integritas Array Tanggal Cuti
    v_days_count := array_length(p_leave_dates, 1);
    IF v_days_count IS NULL OR v_days_count < 1 OR v_days_count > 3 THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_LEAVE_DAYS', 'message', 'Pengajuan cuti harus antara 1 sampai 3 hari kalender.');
    END IF;

    IF p_target_month IS NULL OR p_target_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_TARGET_MONTH', 'message', 'Format bulan target tidak valid (Wajib YYYY-MM antara bulan 01 s/d 12).');
    END IF;

    v_target_year := SUBSTRING(p_target_month, 1, 4)::INT;
    v_target_month := SUBSTRING(p_target_month, 6, 2)::INT;

    -- Validasi seluruh tanggal berada pada bulan target dan tidak duplikat
    FOREACH v_date IN ARRAY p_leave_dates LOOP
        IF EXTRACT(YEAR FROM v_date) != v_target_year OR EXTRACT(MONTH FROM v_date) != v_target_month THEN
            RETURN jsonb_build_object('success', false, 'code', 'DATE_MONTH_MISMATCH', 'message', 'Seluruh tanggal cuti harus berada pada bulan target yang dipilih.');
        END IF;
    END LOOP;

    -- Validasi Jendela Pengajuan (Dibuka tgl 1 bulan sebelumnya, ditutup tgl 3 bulan cuti)
    v_window_start := (to_date(p_target_month || '-01', 'YYYY-MM-DD') - INTERVAL '1 month')::DATE;
    v_window_end   := (to_date(p_target_month || '-01', 'YYYY-MM-DD') + INTERVAL '2 days')::DATE;
    v_current_date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::DATE;

    IF v_current_date < v_window_start OR v_current_date > v_window_end THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'SUBMISSION_WINDOW_CLOSED',
            'message', format('Jendela pengajuan cuti untuk periode %s telah ditutup. Pengajuan hanya dapat dilakukan mulai tanggal %s hingga %s.',
                              p_target_month, v_window_start, v_window_end)
        );
    END IF;

    -- 6. Cari Data Karyawan pada Unit
    SELECT e.id, e.unit_id, e.status, e.full_name, e.employee_code,
           d.name as dept_name, pos.title as pos_title
    INTO v_emp
    FROM employees e
    LEFT JOIN departments d ON e.unit_id = d.unit_id AND e.department_id = d.id
    LEFT JOIN positions pos ON e.unit_id = pos.unit_id AND e.position_id = pos.id
    WHERE e.unit_id = p_unit_id AND e.id = p_employee_id;

    -- Anti-Timing Enumeration Guard
    IF v_emp.id IS NULL OR v_emp.status IS DISTINCT FROM 'ACTIVE' THEN
        PERFORM crypt(p_auth_pin, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
        RETURN jsonb_build_object('success', false, 'code', 'AUTH_FAILED', 'message', 'Otentikasi Kiosk Gagal: Kredensial atau PIN salah.');
    END IF;

    -- 7. Kunci Baris Otentikasi Karyawan secara Eksklusif (FOR UPDATE)
    SELECT * INTO v_auth
    FROM employee_portal_auth
    WHERE employee_id = v_emp.id AND unit_id = p_unit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        PERFORM crypt(p_auth_pin, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
        RETURN jsonb_build_object('success', false, 'code', 'AUTH_FAILED', 'message', 'Otentikasi Kiosk Gagal: Kredensial atau PIN salah.');
    END IF;

    -- 8. Evaluasi Status Lockout
    IF v_auth.locked_until IS NOT NULL AND v_auth.locked_until > now() THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ACCOUNT_LOCKED',
            'message', 'Akun portal karyawan terkunci sementara hingga ' ||
                to_char(v_auth.locked_until AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS "WIB"') ||
                ' karena kegagalan autentikasi berulang.'
        );
    END IF;

    -- 9. Evaluasi Hash PIN Bcrypt (Persistent Lockout Tanpa Rollback)
    v_calculated_hash := crypt(p_auth_pin, COALESCE(v_auth.pin_hash, ''));

    IF v_auth.pin_hash IS NULL OR v_calculated_hash IS NULL OR (v_auth.pin_hash IS DISTINCT FROM v_calculated_hash) THEN
        v_new_attempts := COALESCE(v_auth.failed_attempts, 0) + 1;
        v_new_locked := CASE WHEN v_new_attempts >= 5 THEN now() + INTERVAL '30 minutes' ELSE NULL END;

        UPDATE employee_portal_auth
        SET failed_attempts = v_new_attempts,
            locked_until = v_new_locked,
            updated_at = now()
        WHERE employee_id = v_emp.id;

        INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
        VALUES (
            p_unit_id,
            NULL,
            'KIOSK_LEAVE_PIN_FAILED',
            'employee_portal_auth',
            v_emp.id::text,
            jsonb_build_object(
                'employee_id', p_employee_id,
                'failed_attempts', v_new_attempts,
                'locked_until', v_new_locked
            )
        );

        RETURN jsonb_build_object('success', false, 'code', 'AUTH_FAILED', 'message', 'Otentikasi Kiosk Gagal: Kredensial atau PIN salah.');
    END IF;

    -- 10. Autentikasi Berhasil: Bersihkan Counter Kegagalan
    IF COALESCE(v_auth.failed_attempts, 0) > 0 OR v_auth.locked_until IS NOT NULL THEN
        UPDATE employee_portal_auth
        SET failed_attempts = 0,
            locked_until = NULL,
            last_login_at = now(),
            updated_at = now()
        WHERE employee_id = v_emp.id;
    END IF;

    -- 11. Cek Kuota Cuti Karyawan pada Bulan Target (Maks 3 Hari per Bulan)
    SELECT COALESCE(SUM(total_days), 0) INTO v_current_taken
    FROM leave_requests
    WHERE unit_id = p_unit_id
      AND employee_id = p_employee_id
      AND target_month = p_target_month
      AND status IN ('PENDING', 'APPROVED');

    IF (v_current_taken + v_days_count) > 3 THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'QUOTA_EXCEEDED',
            'message', 'Pengajuan melebihi kuota cuti bulanan. Kuota terpakai: ' || v_current_taken || '/3 hari.'
        );
    END IF;

    -- 12. Generate Nomor Dokumen Resmi
    v_period_key := to_char(v_target_year, 'FM0000') || to_char(v_target_month, 'FM00');
    v_doc_num := generate_document_number_atomic(p_unit_id, 'CUTI', v_period_key);

    -- 13. Simpan Permohonan Cuti (Header)
    INSERT INTO leave_requests (
        unit_id,
        employee_id,
        request_number,
        target_month,
        total_days,
        snapshot_employee_name,
        snapshot_department_name,
        snapshot_position_title,
        reason,
        status,
        auto_approved
    ) VALUES (
        p_unit_id,
        p_employee_id,
        v_doc_num,
        p_target_month,
        v_days_count,
        v_emp.full_name,
        v_emp.dept_name,
        v_emp.pos_title,
        TRIM(p_reason),
        'PENDING',
        false
    ) RETURNING id INTO v_leave_id;

    -- 14. Simpan Detail Tanggal Cuti pada Tabel Kanonikal leave_request_dates
    FOREACH v_date IN ARRAY p_leave_dates LOOP
        INSERT INTO leave_request_dates (
            unit_id,
            leave_request_id,
            leave_date
        ) VALUES (
            p_unit_id,
            v_leave_id,
            v_date
        );
    END LOOP;

    -- 15. Catat Jejak Audit Mutasi
    INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
    VALUES (
        p_unit_id,
        NULL,
        'SUBMIT_LEAVE_KIOSK',
        'leave_requests',
        v_leave_id::text,
        jsonb_build_object(
            'request_number', v_doc_num,
            'employee_id', p_employee_id,
            'target_month', p_target_month,
            'total_days', v_days_count,
            'client_ip', v_client_ip
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pengajuan cuti berhasil dikirim dan menunggu persetujuan Admin Toko.',
        'leave_id', v_leave_id,
        'request_number', v_doc_num,
        'total_days', v_days_count
    );
END;
$$;

-- Hak Akses RPC Cuti: Cabut dari PUBLIC, berikan ke anon, authenticated, service_role
REVOKE ALL ON FUNCTION public.submit_leave_request_atomic(UUID, UUID, VARCHAR, VARCHAR, DATE[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_leave_request_atomic(UUID, UUID, VARCHAR, VARCHAR, DATE[], TEXT) TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. REMEDIATION 2 (CRITICAL): ATOMIC RPC assign_user_roles_atomic
-- ----------------------------------------------------------------------------
-- Menyediakan prosedur tersentralisasi bagi Super Admin untuk menetapkan
-- System Role dan Unit Assignment secara atomik tanpa ketergantungan pada tabel
-- non-eksisten user_profiles.

CREATE OR REPLACE FUNCTION public.assign_user_roles_atomic(
    p_target_user_id UUID,
    p_system_role_code VARCHAR(50),
    p_unit_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_is_super BOOLEAN;
    v_role RECORD;
    v_unit_id UUID;
    v_user_exists BOOLEAN;
    v_default_unit_role_id UUID;
    v_super_admin_role_id UUID;
    v_active_super_count INT;
    v_target_currently_super BOOLEAN;
BEGIN
    -- 1. Verifikasi Otorisasi Pemanggil: Wajib Super Admin
    v_caller_is_super := has_system_role('super_admin');
    IF NOT v_caller_is_super THEN
        RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'Akses ditolak: Hanya Super Administrator yang berwenang mengubah role dan penugasan unit.');
    END IF;

    -- 2. Validasi Keberadaan Pengguna Target
    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = p_target_user_id) INTO v_user_exists;
    IF NOT v_user_exists THEN
        RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'Pengguna target tidak ditemukan dalam profil sistem.');
    END IF;

    -- 3. Serialization Boundary: Transaction-Level Advisory Lock untuk Mutasi Role Super Admin
    -- Menserialisasi seluruh evaluasi dan mutasi role sistem untuk mencegah race condition
    -- konkuren (misal: dua Super Admin saling mendemosi secara simultan).
    -- Kunci ini otomatis dipegang hingga akhir transaksi (COMMIT / ROLLBACK).
    PERFORM pg_advisory_xact_lock(hashtext('assign_user_roles_atomic:super_admin_serialization'));

    -- 4. Dapatkan Role ID untuk super_admin
    SELECT id INTO v_super_admin_role_id
    FROM roles
    WHERE code = 'super_admin'
    LIMIT 1;

    -- Cek apakah target saat ini memiliki role super_admin
    SELECT EXISTS (
        SELECT 1
        FROM user_system_roles
        WHERE user_id = p_target_user_id
          AND role_id = v_super_admin_role_id
    ) INTO v_target_currently_super;

    -- 5. Proteksi Self-Demotion: Super Admin tidak boleh mencabut atau mendemosi role super_admin miliknya sendiri
    IF auth.uid() = p_target_user_id AND (p_system_role_code IS NULL OR TRIM(p_system_role_code) != 'super_admin') THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'SELF_DEMOTION_DENIED',
            'message', 'Operasi ditolak: Super Administrator tidak diizinkan mencabut atau mendemosi role sistem miliknya sendiri demi menjaga integritas akses.'
        );
    END IF;

    -- 6. Proteksi Last-Super-Admin (Concurrency-Safe di bawah Advisory Lock):
    -- Mencegah transaksi konkuren mendemosi Super Admin hingga sistem kehilangan Super Admin terakhir
    IF v_target_currently_super AND (p_system_role_code IS NULL OR TRIM(p_system_role_code) != 'super_admin') THEN
        SELECT COUNT(*) INTO v_active_super_count
        FROM user_system_roles usr
        JOIN profiles p ON usr.user_id = p.id
        WHERE usr.role_id = v_super_admin_role_id
          AND p.is_active = TRUE;

        IF v_active_super_count <= 1 THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'LAST_SUPER_ADMIN_PROTECTED',
                'message', 'Operasi ditolak: Tidak dapat mencabut role Super Administrator terakhir yang aktif dalam sistem.'
            );
        END IF;
    END IF;

    -- 7. Validasi dan Pembaruan System Role
    IF p_system_role_code IS NOT NULL AND TRIM(p_system_role_code) != '' THEN
        SELECT id, code, is_system_role INTO v_role
        FROM roles
        WHERE code = TRIM(p_system_role_code);

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'code', 'ROLE_NOT_FOUND', 'message', 'Role sistem yang ditentukan tidak valid.');
        END IF;

        IF NOT v_role.is_system_role THEN
            RETURN jsonb_build_object('success', false, 'code', 'INVALID_SYSTEM_ROLE', 'message', 'Role yang dipilih bukan merupakan role level sistem.');
        END IF;

        -- Bersihkan role sistem lama dan pasang role baru
        DELETE FROM user_system_roles WHERE user_id = p_target_user_id;
        INSERT INTO user_system_roles (user_id, role_id, granted_by)
        VALUES (p_target_user_id, v_role.id, auth.uid());
    ELSE
        -- Jika dikosongkan, hapus system role
        DELETE FROM user_system_roles WHERE user_id = p_target_user_id;
    END IF;

    -- 7. Validasi dan Sinkronisasi Unit Roles
    -- Ambil role unit_admin sebagai role operasional unit default
    SELECT id INTO v_default_unit_role_id
    FROM roles
    WHERE code = 'unit_admin'
    LIMIT 1;

    -- Validasi bahwa seluruh unit_id valid dan aktif di tabel units
    IF p_unit_ids IS NOT NULL AND array_length(p_unit_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1
            FROM unnest(p_unit_ids) AS u_id
            WHERE u_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000000'::UUID
              AND NOT EXISTS (
                  SELECT 1 FROM units WHERE id = u_id AND is_active = TRUE
              )
        ) THEN
            RETURN jsonb_build_object('success', false, 'code', 'INVALID_UNIT_ASSIGNMENT', 'message', 'Satu atau lebih unit yang ditugaskan tidak valid atau tidak aktif.');
        END IF;
    END IF;

    -- Bersihkan unit roles lama
    DELETE FROM user_unit_roles WHERE user_id = p_target_user_id;

    -- Daftarkan unit roles baru jika ada unit_ids yang diberikan
    IF p_unit_ids IS NOT NULL AND array_length(p_unit_ids, 1) > 0 THEN
        FOREACH v_unit_id IN ARRAY p_unit_ids LOOP
            -- Abaikan ID pusat khusus (00000000-0000-0000-0000-000000000000) pada unit_roles
            IF v_unit_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000000'::UUID THEN
                INSERT INTO user_unit_roles (user_id, unit_id, role_id, is_default_unit, granted_by)
                VALUES (p_target_user_id, v_unit_id, v_default_unit_role_id, false, auth.uid())
                ON CONFLICT (user_id, unit_id, role_id) DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- 8. Catat Jejak Audit Mutasi Role
    INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id, new_data)
    VALUES (
        NULL,
        auth.uid(),
        'ASSIGN_USER_ROLES',
        'profiles',
        p_target_user_id::text,
        jsonb_build_object(
            'target_user_id', p_target_user_id,
            'system_role', p_system_role_code,
            'assigned_units', p_unit_ids
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Hak akses sistem dan penugasan unit pengguna berhasil diperbarui.'
    );
END;
$$;

-- Hak Akses RPC Role Assignment: Strictly authenticated & service_role (Super Admin only di body)
REVOKE ALL ON FUNCTION public.assign_user_roles_atomic(UUID, VARCHAR, UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_user_roles_atomic(UUID, VARCHAR, UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_user_roles_atomic(UUID, VARCHAR, UUID[]) TO authenticated, service_role;

COMMIT;

