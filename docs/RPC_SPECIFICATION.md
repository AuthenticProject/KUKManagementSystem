# STORED PROCEDURES & RPC SPECIFICATION — KUK MANAGEMENT SYSTEM
## Atomic Database Transactions, Identity Verification & Integrity Rules (v3.1.0)
**Versi:** 3.1.0  
**Tanggal:** 2026-11-04  
**Target:** PostgreSQL 15+ (Supabase PL/pgSQL Engine)  

---

## 1. Standar Keamanan & Aturan Eksekusi RPC

Seluruh Stored Procedures / RPCs pada KUK Management System wajib mematuhi standar keamanan:
1. **Search Path Pinning**:
   Setiap fungsi `SECURITY DEFINER` wajib menyertakan klausa `SET search_path = public, pg_temp` untuk memitigasi serangan *search path hijacking*.
2. **Verifikasi Identitas Nyata (Identity Verification)**:
   Fungsi yang dipanggil dari portal publik (pengajuan cuti, pinjam kendaraan) **dilarang mempercayai `employee_id` atau nama kiriman browser sebagai bukti identitas**. Pemohon wajib menyertakan PIN hash validasi (`auth_pin`) atau token sesi yang tervalidasi.
3. **Pemberian Hak Eksekusi Terbatas (Privilege Hardening)**:
   Hak `EXECUTE` pada fungsi administratif internal dicabut dari peran `PUBLIC` dan `anon`, hanya diberikan kepada peran `authenticated` atau perantara RPC resmi.
4. **Zona Waktu Terstandarisasi**:
   Semua komputasi tanggal kalender operasional menggunakan `(now() AT TIME ZONE 'Asia/Jakarta')::date`.
5. **Penomoran Dokumen Deterministik**:
   Nomor dokumen surat, slip gaji, dan cuti dihasilkan menggunakan kunci sekuensial tabel `document_sequences` dengan *row lock* (`SELECT ... FOR UPDATE`), bukan menggunakan angka acak (*random math*).

---

## 2. Spesifikasi Fungsi RPC Kritis

### 2.1 `generate_document_number_atomic()`
Menghasilkan nomor urut dokumen resmi secara atomik, unik, dan berurutan tanpa risiko *race-condition*.

```sql
CREATE OR REPLACE FUNCTION generate_document_number_atomic(
    p_unit_id UUID,
    p_doc_type VARCHAR(50),                     -- 'CUTI', 'TIP', 'FLEET', 'SLIP', 'SP'
    p_period_key VARCHAR(10)                    -- '202611'
)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_unit_code VARCHAR(30);
    v_seq_val INT;
    v_template VARCHAR(100);
    v_result VARCHAR(50);
BEGIN
    -- Ambil kode unit
    SELECT code INTO v_unit_code FROM units WHERE id = p_unit_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unit ID tidak valid.';
    END IF;

    -- Kunci baris sekuensial secara atomik menggunakan FOR UPDATE
    INSERT INTO document_sequences (unit_id, doc_type, period_key, current_value, format_template)
    VALUES (p_unit_id, p_doc_type, p_period_key, 1, '{DOC}-{UNIT}-{PERIOD}-{SEQ:4}')
    ON CONFLICT (unit_id, doc_type, period_key)
    DO UPDATE SET 
        current_value = document_sequences.current_value + 1,
        updated_at = now()
    RETURNING current_value, format_template INTO v_seq_val, v_template;

    -- Format penomoran dokumen: contoh 'CUTI-TB-LATANSA-202611-0001'
    v_result := replace(v_template, '{DOC}', p_doc_type);
    v_result := replace(v_result, '{UNIT}', v_unit_code);
    v_result := replace(v_result, '{PERIOD}', p_period_key);
    v_result := replace(v_result, '{SEQ:4}', LPAD(v_seq_val::text, 4, '0'));

    RETURN v_result;
END;
$$;
```

---

### 2.2 `submit_leave_request_atomic()`
Menangani seluruh pengajuan cuti secara atomik dengan verifikasi PIN otentikasi, pengecekan jendela waktu, penegakan kuota, pencegahan bentrok departemen & kelompok bentrok, serta penguncian slot dinamis.

```sql
CREATE OR REPLACE FUNCTION submit_leave_request_atomic(
    p_unit_id UUID,
    p_employee_id UUID,
    p_auth_pin VARCHAR(255),                     -- Wajib untuk membuktikan identitas pemohon
    p_target_month VARCHAR(7),                   -- '2026-11'
    p_leave_dates DATE[],                        -- Array tanggal cuti
    p_reason TEXT,
    p_client_ip VARCHAR(45),
    p_user_agent TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_emp RECORD;
    v_auth RECORD;
    v_policy RECORD;
    v_leave_id UUID;
    v_date DATE;
    v_now_jkt DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date;
    v_curr_year INT := EXTRACT(YEAR FROM v_now_jkt);
    v_curr_month INT := EXTRACT(MONTH FROM v_now_jkt);
    v_curr_day INT := EXTRACT(DAY FROM v_now_jkt);
    v_target_year INT;
    v_target_month INT;
    v_days_count INT;
    v_approved_days INT;
    v_conflict_group_id UUID;
    v_doc_num VARCHAR(50);
    v_period_key VARCHAR(10);
BEGIN
    -- 1. Validasi Keberadaan & Status Karyawan di Unit
    SELECT e.id, e.unit_id, e.department_id, e.position_id, e.full_name,
           d.name as dept_name, pos.title as pos_title, pos.code as pos_code,
           pos.allowed_leave_days_of_week
    INTO v_emp
    FROM employees e
    JOIN departments d ON e.unit_id = d.unit_id AND e.department_id = d.id
    JOIN positions pos ON e.unit_id = pos.unit_id AND e.position_id = pos.id
    WHERE e.unit_id = p_unit_id AND e.id = p_employee_id AND e.status = 'ACTIVE';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Karyawan tidak ditemukan atau status tidak aktif pada unit ini.';
    END IF;

    -- 2. Verifikasi Autentikasi Mandiri (PIN Portal Karyawan)
    SELECT * INTO v_auth FROM employee_portal_auth WHERE unit_id = p_unit_id AND employee_id = p_employee_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Akun portal mandiri karyawan belum dikonfigurasi. Hubungi HRD.';
    END IF;

    IF v_auth.locked_until IS NOT NULL AND v_auth.locked_until > now() THEN
        RAISE EXCEPTION 'Akun terkunci sementara karena percobaan gagal berulang. Coba lagi nanti.';
    END IF;

    -- Verifikasi hash bcrypt
    IF v_auth.pin_hash != crypt(p_auth_pin, v_auth.pin_hash) THEN
        UPDATE employee_portal_auth 
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + INTERVAL '30 minutes' ELSE NULL END
        WHERE employee_id = p_employee_id;
        RAISE EXCEPTION 'PIN otentikasi salah.';
    ELSE
        -- Reset failed attempts saat berhasil
        UPDATE employee_portal_auth SET failed_attempts = 0, last_login_at = now() WHERE employee_id = p_employee_id;
    END IF;

    -- 3. Validasi Format & Integritas Array Tanggal Cuti
    v_days_count := array_length(p_leave_dates, 1);
    IF v_days_count IS NULL OR v_days_count < 1 OR v_days_count > 3 THEN
        RAISE EXCEPTION 'Pengajuan cuti harus antara 1 sampai 3 hari kerja.';
    END IF;

    -- Ekstrak target year & month
    v_target_year := SUBSTRING(p_target_month, 1, 4)::INT;
    v_target_month := SUBSTRING(p_target_month, 6, 2)::INT;

    -- Pastikan seluruh tanggal berada pada bulan target & tidak ada tanggal duplikat
    FOREACH v_date IN ARRAY p_leave_dates
    LOOP
        IF EXTRACT(YEAR FROM v_date) != v_target_year OR EXTRACT(MONTH FROM v_date) != v_target_month THEN
            RAISE EXCEPTION 'Tanggal cuti % tidak berada pada bulan target %.', v_date, p_target_month;
        END IF;
    END LOOP;

    -- Cek duplikasi tanggal dalam permohonan yang sama
    IF (SELECT count(DISTINCT d) FROM unnest(p_leave_dates) d) != v_days_count THEN
        RAISE EXCEPTION 'Terdapat tanggal duplikat dalam pengajuan cuti Anda.';
    END IF;

    -- 4. Validasi Jendela Waktu Pengajuan Cuti
    -- Aturan: Dibuka tgl 1 pada bulan M-1, ditutup tgl 3 pada bulan M
    SELECT * INTO v_policy FROM leave_policies WHERE unit_id = p_unit_id AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Kebijakan cuti unit belum dikonfigurasi.';
    END IF;

    -- Validasi jendela waktu operasional
    -- Hitung selisih bulan: (target_year*12 + target_month) - (curr_year*12 + curr_month)
    IF ((v_target_year * 12 + v_target_month) - (v_curr_year * 12 + v_curr_month)) = 1 THEN
        -- Sedang berada di bulan M-1: pengajuan sah jika tanggal hari ini >= submission_open_day (tgl 1)
        IF v_curr_day < v_policy.submission_open_day THEN
            RAISE EXCEPTION 'Pengajuan cuti untuk bulan % belum dibuka.', p_target_month;
        END IF;
    ELSIF ((v_target_year * 12 + v_target_month) - (v_curr_year * 12 + v_curr_month)) = 0 THEN
        -- Sedang berada di bulan M: pengajuan sah jika tanggal hari ini <= submission_close_day (tgl 3)
        IF v_curr_day > v_policy.submission_close_day THEN
            RAISE EXCEPTION 'Periode pengajuan cuti untuk bulan % telah ditutup pada tanggal %.', p_target_month, v_policy.submission_close_day;
        END IF;
    ELSE
        RAISE EXCEPTION 'Pengajuan cuti untuk bulan % berada di luar jendela waktu yang diizinkan.', p_target_month;
    END IF;

    -- 5. Evaluasi Batasan Hari Cuti Jabatan / Aturan Khusus Admin 3 (CONFIRMED)
    -- Jabatan Admin 3 dikonfigurasi stabil via data master positions.allowed_leave_days_of_week = '{0}' (Hanya hari Minggu)
    IF v_emp.allowed_leave_days_of_week IS NOT NULL AND array_length(v_emp.allowed_leave_days_of_week, 1) > 0 THEN
        FOREACH v_date IN ARRAY p_leave_dates
        LOOP
            IF NOT (EXTRACT(DOW FROM v_date)::INT = ANY(v_emp.allowed_leave_days_of_week)) THEN
                RAISE EXCEPTION 'Pengajuan cuti ditolak: Karyawan dengan jabatan % hanya diizinkan mengambil cuti pada hari yang ditetapkan (Hari Minggu). Tanggal % tidak memenuhi aturan.', v_emp.pos_title, v_date;
            END IF;
        END LOOP;
    END IF;

    -- 6. Atomic Advisory Lock: Mengunci transaksi karyawan untuk target bulan tertentu
    PERFORM pg_advisory_xact_lock(hashtext(p_employee_id::text || p_target_month));

    -- Periksa kuota cuti aktif yang sudah diambil bulan ini
    SELECT COALESCE(SUM(total_days), 0) INTO v_approved_days
    FROM leave_requests
    WHERE unit_id = p_unit_id AND employee_id = p_employee_id AND target_month = p_target_month AND status = 'APPROVED';

    IF (v_approved_days + v_days_count) > v_policy.max_days_per_month THEN
        RAISE EXCEPTION 'Pengajuan melebihi kuota maksimal cuti (% hari) untuk bulan %.', v_policy.max_days_per_month, p_target_month;
    END IF;

    -- 7. Evaluasi Kelompok Bentrok Antar Bagian (Conflict Group)
    SELECT conflict_group_id INTO v_conflict_group_id
    FROM leave_conflict_departments
    WHERE unit_id = p_unit_id AND department_id = v_emp.department_id
    LIMIT 1;

    -- 8. Generate Nomor Dokumen Berurut Unik
    v_period_key := to_char(v_now_jkt, 'YYYYMM');
    v_doc_num := generate_document_number_atomic(p_unit_id, 'CUTI', v_period_key);

    -- 9. Simpan Transaksi Master Permohonan Cuti
    INSERT INTO leave_requests (
        unit_id, employee_id, request_number, target_month, total_days,
        snapshot_employee_name, snapshot_department_name, snapshot_position_title,
        reason, status, auto_approved, client_ip, user_agent
    ) VALUES (
        p_unit_id, p_employee_id, v_doc_num, p_target_month, v_days_count,
        v_emp.full_name, v_emp.dept_name, v_emp.pos_title,
        p_reason, 'APPROVED', TRUE, p_client_ip, p_user_agent
    ) RETURNING id INTO v_leave_id;

    -- 10. Simpan Rincian Tanggal & Kunci Slot Konflik Dinamis
    FOREACH v_date IN ARRAY p_leave_dates
    LOOP
        INSERT INTO leave_request_dates (unit_id, leave_request_id, leave_date)
        VALUES (p_unit_id, v_leave_id, v_date);

        -- Mengunci slot konflik (Akan gagal dan melempar Exception jika Partial Unique Index mendeteksi bentrok aktif)
        INSERT INTO leave_conflict_slots (
            unit_id, leave_request_id, department_id, conflict_group_id, leave_date, is_active
        ) VALUES (
            p_unit_id, v_leave_id, v_emp.department_id, v_conflict_group_id, v_date, TRUE
        );
    END LOOP;

    -- 11. Catat Audit Log
    INSERT INTO audit_logs (unit_id, action, table_name, record_id, new_data, ip_address, user_agent)
    VALUES (
        p_unit_id, 'INSERT', 'leave_requests', v_leave_id::text,
        jsonb_build_object('request_number', v_doc_num, 'employee_id', p_employee_id, 'days', v_days_count),
        p_client_ip, p_user_agent
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'leave_id', v_leave_id,
        'request_number', v_doc_num,
        'status', 'APPROVED',
        'message', 'Pengajuan cuti berhasil disetujui otomatis.'
    );
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Pengajuan gagal: Tanggal yang dipilih bertabrakan dengan jadwal cuti rekan pada bagian/kelompok bagian Anda.';
END;
$$;
```

---

### 2.3 `cancel_leave_request_atomic()`
Membatalkan pengajuan cuti secara sah, melepaskan slot konflik secara bersih (`is_active = FALSE`), memulihkan kuota karyawan, dan mencatat jejak audit.

```sql
CREATE OR REPLACE FUNCTION cancel_leave_request_atomic(
    p_unit_id UUID,
    p_leave_id UUID,
    p_cancelled_by UUID,                        -- ID Profile staf yang membatalkan
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
    SELECT * INTO v_req FROM leave_requests WHERE unit_id = p_unit_id AND id = p_leave_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Permohonan cuti tidak ditemukan pada unit ini.';
    END IF;

    IF v_req.status != 'APPROVED' THEN
        RAISE EXCEPTION 'Hanya cuti berstatus APPROVED yang dapat dibatalkan.';
    END IF;

    -- 1. Nonaktifkan slot konflik sehingga slot dan kuota tanggal tersebut bebas kembali
    UPDATE leave_conflict_slots
    SET is_active = FALSE,
        released_at = now()
    WHERE unit_id = p_unit_id AND leave_request_id = p_leave_id;

    -- 2. Update status master permohonan cuti
    UPDATE leave_requests
    SET status = 'CANCELLED',
        cancelled_at = now(),
        cancellation_reason = p_reason,
        cancelled_by = p_cancelled_by,
        updated_at = now()
    WHERE id = p_leave_id;

    -- 3. Catat ke Audit Log
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
```

---

### 2.4 `book_vehicle_atomic()`
Mendaftarkan peminjaman kendaraan dengan jaminan bebas bentrok jadwal (*conflict-free exclusion protection*).

```sql
CREATE OR REPLACE FUNCTION book_vehicle_atomic(
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_veh RECORD;
    v_booking_id UUID;
    v_code VARCHAR(50);
    v_period_key VARCHAR(10);
BEGIN
    -- 1. Validasi Kendaraan di Unit
    SELECT * INTO v_veh FROM vehicles WHERE unit_id = p_unit_id AND id = p_vehicle_id AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Armada kendaraan tidak ditemukan pada unit ini.';
    END IF;

    IF v_veh.status = 'DECOMMISSIONED' THEN
        RAISE EXCEPTION 'Kendaraan telah dinonaktifkan dari operasional.';
    END IF;

    -- 2. Validasi Waktu
    IF p_estimated_return_time <= p_start_time THEN
        RAISE EXCEPTION 'Perkiraan waktu kembali harus lebih besar dari waktu keluar kendaraan.';
    END IF;

    -- 3. Generate Kode Booking Berurut
    v_period_key := to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYYMM');
    v_code := generate_document_number_atomic(p_unit_id, 'FLEET', v_period_key);

    -- 4. Simpan Transaksi Peminjaman (Exclusion constraint mencegah tabrakan jadwal aktif)
    INSERT INTO vehicle_borrowing_requests (
        unit_id, vehicle_id, booking_code, borrower_name, borrower_institution,
        borrower_phone, responsible_person, start_time, estimated_return_time,
        destination, purpose, status
    ) VALUES (
        p_unit_id, p_vehicle_id, v_code, p_borrower_name, p_borrower_institution,
        p_borrower_phone, p_responsible_person, p_start_time, p_estimated_return_time,
        p_destination, p_purpose, 'PENDING'
    ) RETURNING id INTO v_booking_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'booking_id', v_booking_id,
        'booking_code', v_code,
        'status', 'PENDING',
        'message', 'Pengajuan peminjaman kendaraan berhasil diajukan dan menunggu persetujuan petugas.'
    );
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE EXCEPTION 'Jadwal yang dipilih bertabrakan dengan jadwal peminjaman armada yang telah disetujui sebelumnya.';
END;
$$;
```

---

### 2.5 `calculate_and_finalize_payroll_atomic()`
Menjalankan kalkulasi penggajian bulanan, menarik tip terverifikasi, membekukan snapshot komprehensif, dan mengunci periode payroll secara permanen.

```sql
CREATE OR REPLACE FUNCTION calculate_and_finalize_payroll_atomic(
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
    -- 1. Validasi Periode Payroll
    SELECT * INTO v_period FROM payroll_periods WHERE unit_id = p_unit_id AND id = p_payroll_period_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Periode payroll tidak ditemukan pada unit ini.';
    END IF;

    IF v_period.status = 'FINALIZED' THEN
        RAISE EXCEPTION 'Periode payroll ini sudah berstatus FINALIZED dan tidak boleh difinalisasi ulang.';
    END IF;

    v_period_key := to_char(v_period.end_date, 'YYYYMM');

    -- 2. Iterasi Karyawan Aktif yang Memiliki Struktur Gaji di Unit
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

        -- Generate nomor slip unik
        v_slip_num := generate_document_number_atomic(p_unit_id, 'SLIP', v_period_key);

        -- Buat baris master slip gaji
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

        -- Update nilai akhir slip gaji
        UPDATE payroll_records
        SET total_earnings = v_earnings,
            total_deductions = v_deductions,
            net_salary = v_net,
            updated_at = now()
        WHERE id = v_slip_id;
    END LOOP;

    -- 3. Kunci Status Periode Payroll menjadi FINALIZED
    UPDATE payroll_periods
    SET status = 'FINALIZED',
        total_net_payout = v_total_payroll,
        finalized_at = now(),
        finalized_by = p_finalized_by,
        updated_at = now()
    WHERE id = p_payroll_period_id;

    -- 4. Catat Audit Log
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
```

