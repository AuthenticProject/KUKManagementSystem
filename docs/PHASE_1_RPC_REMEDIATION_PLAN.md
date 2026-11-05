# PHASE 1 — RPC SECURITY REMEDIATION PLAN
## KUK MANAGEMENT SYSTEM v3.1.0

**Tanggal Dokumen:** 2026-11-04  
**Auditor:** Antigravity Autonomous Agent  
**Target Environment:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`)  
**PostgreSQL Engine:** v17.11.0.011  
**Status Dokumen:** RANCANGAN PERBAIKAN ARSITEKTUR KEAMANAN (PRE-EXECUTION PLAN)  
**Batasan Operasional:** Tidak ada perintah migrasi, DDL/DML, perubahan GRANT/REVOKE, maupun manipulasi data yang dieksekusi ke Supabase Production pada fase ini.

---

## 1. LATAR BELAKANG & TUJUAN REMEDIASI

Audit keamanan mendalam terhadap 10 fungsi PostgreSQL dan Stored Procedures pada skema kanonikal v3.1.0 (`supabase/migrations/20261104000001_core_schema_v3_1_0.sql`) mengidentifikasi beberapa kerentanan signifikan:

1. **Parameter Spoofing & Identity Mismatch:** Parameter audit identitas seperti `p_finalized_by` dan `p_cancelled_by` saat ini diterima mentah dari input pengguna tanpa divalidasi silang terhadap identitas sesi autentikasi (`auth.uid()`).
2. **Ketiadaan Validasi Otorisasi di Body RPC:** Fungsi sensitif `calculate_and_finalize_payroll_atomic` dan `cancel_leave_request_atomic` berjalan dengan wewenang `SECURITY DEFINER` (privilese pemilik tabel `postgres`), namun tidak memverifikasi apakah pemanggil memiliki izin unit (`payroll.manage`, `leave.manage`). Pengguna terautentikasi dari Unit A secara teoritis dapat memfinalisasi payroll atau membatalkan cuti di Unit B jika mengetahui UUID-nya.
3. **Privilege Over-Granting (`PUBLIC:EXECUTE`):** Default privilege PostgreSQL secara otomatis memberikan hak `EXECUTE` kepada pseudo-role `PUBLIC`, sehingga endpoint PostgREST untuk RPC sensitif dapat dipicu langsung oleh pengguna anonim (`anon`).

Dokumen ini menyusun rancangan remediasi kode PL/pgSQL, validasi multi-layer, dan strategi hak akses tanpa merusak alur aplikasi yang sah.

---

## 2. AUDIT & REMEDIASI PAYROLL RPC (`calculate_and_finalize_payroll_atomic`)

### A. Analisis Kerentanan Aktual
Fungsi `calculate_and_finalize_payroll_atomic(p_unit_id UUID, p_payroll_period_id UUID, p_finalized_by UUID)` memiliki kelemahan kritis:
- **Zero Authentication Check:** Tidak ada validasi `IF auth.uid() IS NULL`.
- **Identity Forgery:** `p_finalized_by` tidak diverifikasi terhadap `auth.uid()`. Pengguna biasa dapat memalsukan ID eksekutor menjadi UUID Super Admin di log audit.
- **Cross-Unit Attack Vector:** Tidak ada pemeriksaan apakah pemanggil memiliki izin di `p_unit_id`. Staf dari unit lain yang berhasil login dapat mengeksekusi kalkulasi dan finalisasi slip gaji pada unit kompetitor dalam organisasi yang sama.
- **Exposure:** Terbuka untuk `anon` via REST API akibat default privilege `PUBLIC:EXECUTE`.

### B. Rancangan Validasi Multi-Layer Baru (Wajib Diimplementasikan)
Di dalam body PL/pgSQL, blok validasi otorisasi berikut **wajib ditambahkan pada baris pertama fungsi**:

```sql
-- 1. Validasi Autentikasi Sesi Aktif
IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses Ditolak: Operasi finalisasi payroll memerlukan sesi autentikasi aktif.'
        USING ERRCODE = '42501';
END IF;

-- 2. Validasi Integritas Identitas Eksekutor (Anti-Spoofing)
IF p_finalized_by IS NULL OR p_finalized_by != auth.uid() THEN
    RAISE EXCEPTION 'Akses Ditolak: ID eksekutor (p_finalized_by) tidak sesuai dengan identitas pengguna yang terautentikasi.'
        USING ERRCODE = '42501';
END IF;

-- 3. Validasi Otorisasi Multi-Unit & Wewenang Payroll
IF NOT (has_system_role('super_admin') OR has_unit_permission(p_unit_id, 'payroll.manage')) THEN
    RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang (payroll.manage) untuk mengelola atau memfinalisasi payroll pada unit ini.'
        USING ERRCODE = '42501';
END IF;
```

---

## 3. AUDIT & REMEDIASI CANCEL LEAVE RPC (`cancel_leave_request_atomic`)

### A. Analisis Kerentanan Aktual
Fungsi `cancel_leave_request_atomic(p_unit_id UUID, p_leave_id UUID, p_cancelled_by UUID, p_reason TEXT)` saat ini hanya memeriksa apakah status cuti `APPROVED` dan apakah baris cuti cocok dengan `p_unit_id`.
- **Kelemahan:** Siapa pun yang memiliki ID cuti (termasuk pihak anonim atau staf tanpa izin) dapat memanggil RPC ini untuk membatalkan cuti karyawan lain dan membebaskan slot konflik cuti.

### B. Rancangan Kebijakan Otorisasi Pembatalan
Terdapat dua alur pembatalan yang sah secara proses bisnis:
1. **Alur Administrator / HRD Unit:** Pengguna login yang memiliki izin `leave.manage` pada `p_unit_id` atau Super Admin.
2. **Alur Pegawai Mandiri (Self-Cancellation):** Jika pegawai membatalkan cutinya sendiri melalui Kiosk/Portal, verifikasi PIN (`p_auth_pin`) wajib disertakan.

Untuk Phase 1, pembatalan melalui RPC internal difokuskan pada pengamanan Alur Administrator Terautentikasi:

```sql
-- 1. Validasi Autentikasi Sesi
IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses Ditolak: Pembatalan permohonan cuti memerlukan sesi autentikasi login.'
        USING ERRCODE = '42501';
END IF;

-- 2. Validasi Anti-Spoofing
IF p_cancelled_by IS NULL OR p_cancelled_by != auth.uid() THEN
    RAISE EXCEPTION 'Akses Ditolak: ID pembatal tidak sesuai dengan sesi pengguna aktif.'
        USING ERRCODE = '42501';
END IF;

-- 3. Validasi Wewenang Unit
IF NOT (has_system_role('super_admin') OR has_unit_permission(p_unit_id, 'leave.manage') OR has_unit_permission(p_unit_id, 'leave.approve')) THEN
    RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang untuk membatalkan pengajuan cuti pada unit ini.'
        USING ERRCODE = '42501';
END IF;
```

---

## 4. AUDIT IMPLEMENTASI SELURUH 10 FUNGSI

| No | Fungsi | Mode Eksekusi | Search Path | Validasi Identitas | Validasi Wewenang Unit | Rekomendasi Remediasi |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| 1 | `generate_document_number_atomic` | `SECURITY DEFINER` | `public, pg_temp` | Cek Unit ID aktif | Tidak ada (Internal Counter) | **Revoke dari `anon` & `PUBLIC`.** Hanya dieksekusi via `authenticated` atau secara internal oleh fungsi lain. |
| 2 | `submit_leave_request_atomic` | `SECURITY DEFINER` | `public, pg_temp` | Bcrypt PIN Hash + Lockout | Validasi Karyawan `ACTIVE` di `p_unit_id` | **Pertahankan akses `anon`.** Implementasi sudah aman dengan rate-limit dan mitigasi brute-force. |
| 3 | `cancel_leave_request_atomic` | `SECURITY DEFINER` | `public, pg_temp` | **LEMAH (Hanya parameter)** | **LEMAH (Tidak ada cek izin)** | **Revoke dari `anon` & `PUBLIC`.** Tambahkan validasi `auth.uid()` dan `leave.manage`. |
| 4 | `book_vehicle_atomic` | `SECURITY DEFINER` | `public, pg_temp` | Input data peminjam | Validasi Armada `AVAILABLE` di `p_unit_id` | **Pertahankan akses `anon`.** Kebutuhan formulir publik. Status default `PENDING` (tidak langsung disetujui). |
| 5 | `calculate_and_finalize_payroll_atomic` | `SECURITY DEFINER` | `public, pg_temp` | **TIDAK ADA** | **TIDAK ADA** | **KRITIS.** Revoke dari `anon` & `PUBLIC`. Wajib tambahkan validasi `auth.uid()` dan `payroll.manage`. |
| 6 | `has_system_role` | `STABLE SECURITY DEFINER` | `public, pg_temp` | Menggunakan `auth.uid()` | Sistem Global | **Aman.** Mengembalikan `FALSE` jika anon. |
| 7 | `has_unit_access` | `STABLE SECURITY DEFINER` | `public, pg_temp` | Menggunakan `auth.uid()` | Cek penugasan `user_unit_roles` | **Aman.** Mengembalikan `FALSE` jika anon. |
| 8 | `has_unit_permission` | `STABLE SECURITY DEFINER` | `public, pg_temp` | Menggunakan `auth.uid()` | Cek granular permission `role_permissions` | **Aman.** Mengembalikan `FALSE` jika anon. |
| 9 | `protect_audit_log_immutability` | `SECURITY DEFINER` | `public, pg_temp` | Trigger Event Level | Proteksi Immutability mutlak | **Aman.** Trigger function tidak dapat dipanggil via REST RPC. |
| 10 | `protect_finalized_payroll` | `SECURITY DEFINER` | `public, pg_temp` | Trigger Event Level | Proteksi payroll FINALIZED | **Aman.** Trigger function tidak dapat dipanggil via REST RPC. |

---

## 5. MEKANISME KETERGANTUNGAN ANTAR-RPC PASCA-REVOKE

Pertanyaan arsitektur penting:  
*Jika hak akses `generate_document_number_atomic` dicabut dari `anon`, apakah pemanggilan publik dari `submit_leave_request_atomic` dan `book_vehicle_atomic` akan gagal?*

**Analisis Standar PostgreSQL:**  
- Fungsi `submit_leave_request_atomic` dan `book_vehicle_atomic` dikompilasi dengan klausul `SECURITY DEFINER`.
- Dalam PostgreSQL, saat sebuah fungsi `SECURITY DEFINER` mengeksekusi fungsi lain di dalamnya, hak akses yang digunakan untuk memanggil fungsi bawahan adalah **hak akses pemilik fungsi (`postgres`)**, bukan hak akses pengguna pemanggil awal (`anon`).
- Karena pemilik fungsi (`postgres`) adalah superuser/tabel owner, `postgres` selalu memiliki hak eksekusi penuh atas `generate_document_number_atomic`.
- **Hasil:** Pencabutan izin `anon` pada fungsi nomor seri internal **tidak akan mengganggu** pengajuan cuti atau peminjaman armada publik.

---

## 6. DRAFT SKRIP MIGRASI REMEDIASI (PRE-EXECUTION)

> **STATUS: DRAFT HANYA. TIDAK DIEKSEKUSI PADA FASE INI.**

```sql
-- DRAFT MIGRATION: 20261104000002_harden_rpc_security.sql

-- 1. Perbarui calculate_and_finalize_payroll_atomic dengan validasi otorisasi ketat
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
    -- Validasi 1: Wajib memiliki sesi login aktif
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Akses Ditolak: Operasi finalisasi payroll memerlukan sesi login aktif.'
            USING ERRCODE = '42501';
    END IF;

    -- Validasi 2: Mencegah pemalsuan identitas eksekutor
    IF p_finalized_by IS NULL OR p_finalized_by != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: ID eksekutor tidak sesuai dengan sesi autentikasi pengguna.'
            USING ERRCODE = '42501';
    END IF;

    -- Validasi 3: Wajib memiliki izin payroll.manage di unit terkait atau Super Admin
    IF NOT (has_system_role('super_admin') OR has_unit_permission(p_unit_id, 'payroll.manage')) THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang (payroll.manage) pada unit ini.'
            USING ERRCODE = '42501';
    END IF;

    -- Validasi 4: Keberadaan periode payroll di unit
    SELECT * INTO v_period FROM payroll_periods WHERE unit_id = p_unit_id AND id = p_payroll_period_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Periode payroll tidak ditemukan pada unit ini.';
    END IF;

    IF v_period.status = 'FINALIZED' THEN
        RAISE EXCEPTION 'Periode payroll ini sudah berstatus FINALIZED dan tidak boleh difinalisasi ulang.';
    END IF;

    v_period_key := to_char(v_period.end_date, 'YYYYMM');

    -- Iterasi kalkulasi (kode bisnis dipertahankan 100% konsisten)
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
        v_slip_num := generate_document_number_atomic(p_unit_id, 'SLIP', v_period_key);

        INSERT INTO payroll_records (
            unit_id, payroll_period_id, employee_id, slip_number,
            snapshot_employee_name, snapshot_department_name, snapshot_position_title,
            total_earnings, total_deductions, net_salary, payment_status
        ) VALUES (
            p_unit_id, p_payroll_period_id, v_emp.id, v_slip_num,
            v_emp.full_name, v_emp.dept_name, v_emp.pos_title,
            0.00, 0.00, 0.00, 'PENDING_PAYMENT'
        ) RETURNING id INTO v_slip_id;

        INSERT INTO payroll_items (unit_id, payroll_record_id, component_name, component_type, amount)
        VALUES (p_unit_id, v_slip_id, 'Gaji Pokok', 'ALLOWANCE', v_emp.base_salary);

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

        SELECT COALESCE(SUM(verified_amount), 0.00) INTO v_tip_amount
        FROM glass_tips
        WHERE unit_id = p_unit_id AND employee_id = v_emp.id AND status = 'VERIFIED' AND payroll_period_id IS NULL;

        IF v_tip_amount > 0 THEN
            v_earnings := v_earnings + v_tip_amount;
            INSERT INTO payroll_items (unit_id, payroll_record_id, component_name, component_type, amount)
            VALUES (p_unit_id, v_slip_id, 'Tip Pemotongan Kaca Terverifikasi', 'ALLOWANCE', v_tip_amount);

            UPDATE glass_tips
            SET payroll_period_id = p_payroll_period_id, updated_at = now()
            WHERE unit_id = p_unit_id AND employee_id = v_emp.id AND status = 'VERIFIED' AND payroll_period_id IS NULL;
        END IF;

        v_net := v_earnings - v_deductions;
        v_total_payroll := v_total_payroll + v_net;

        UPDATE payroll_records
        SET total_earnings = v_earnings,
            total_deductions = v_deductions,
            net_salary = v_net,
            updated_at = now()
        WHERE id = v_slip_id;
    END LOOP;

    UPDATE payroll_periods
    SET status = 'FINALIZED',
        total_net_payout = v_total_payroll,
        finalized_at = now(),
        finalized_by = p_finalized_by,
        updated_at = now()
    WHERE id = p_payroll_period_id;

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

-- 2. Perbarui cancel_leave_request_atomic dengan validasi otorisasi
CREATE OR REPLACE FUNCTION cancel_leave_request_atomic(
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
    -- Validasi 1: Sesi login aktif
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Akses Ditolak: Pembatalan cuti memerlukan sesi login aktif.'
            USING ERRCODE = '42501';
    END IF;

    -- Validasi 2: Mencegah pemalsuan identitas pembatal
    IF p_cancelled_by IS NULL OR p_cancelled_by != auth.uid() THEN
        RAISE EXCEPTION 'Akses Ditolak: ID pembatal tidak sesuai dengan sesi autentikasi pengguna.'
            USING ERRCODE = '42501';
    END IF;

    -- Validasi 3: Izin pembatalan cuti unit
    IF NOT (has_system_role('super_admin') OR has_unit_permission(p_unit_id, 'leave.manage') OR has_unit_permission(p_unit_id, 'leave.approve')) THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang untuk membatalkan pengajuan cuti pada unit ini.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_req FROM leave_requests WHERE unit_id = p_unit_id AND id = p_leave_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Permohonan cuti tidak ditemukan pada unit ini.';
    END IF;

    IF v_req.status != 'APPROVED' THEN
        RAISE EXCEPTION 'Hanya cuti berstatus APPROVED yang dapat dibatalkan.';
    END IF;

    UPDATE leave_conflict_slots
    SET is_active = FALSE,
        released_at = now()
    WHERE unit_id = p_unit_id AND leave_request_id = p_leave_id;

    UPDATE leave_requests
    SET status = 'CANCELLED',
        cancelled_at = now(),
        cancellation_reason = p_reason,
        cancelled_by = p_cancelled_by,
        updated_at = now()
    WHERE id = p_leave_id;

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

-- 3. Penataan Hak Akses Eksekusi (Privilege Hardening)
REVOKE EXECUTE ON FUNCTION calculate_and_finalize_payroll_atomic(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION calculate_and_finalize_payroll_atomic(UUID, UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION cancel_leave_request_atomic(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_leave_request_atomic(UUID, UUID, UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION generate_document_number_atomic(UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_document_number_atomic(UUID, VARCHAR, VARCHAR) TO authenticated;

-- Pastikan RPC publik Kiosk tetap dapat diakses anonim
GRANT EXECUTE ON FUNCTION submit_leave_request_atomic TO anon, authenticated;
GRANT EXECUTE ON FUNCTION book_vehicle_atomic TO anon, authenticated;
```

