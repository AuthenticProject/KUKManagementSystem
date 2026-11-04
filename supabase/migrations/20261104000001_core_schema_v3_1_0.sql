-- ======================================================================

-- KUK MANAGEMENT SYSTEM v3.1.0 — CANONICAL CORE SCHEMA MIGRATION

-- Target Engine: PostgreSQL 15+ (Supabase Managed PostgreSQL)

-- Scope: All 35 Production Tables, Enums, Composite Constraints, Triggers & Atomic RPCs

-- ATTENTION: Dilarang dieksekusi langsung pada database produksi.

-- ======================================================================


-- SECTION 1: EXTENSIONS & ENUMS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Status Entitas Organisasi & Staf
CREATE TYPE employee_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'RESIGNED', 'RETIRED');
CREATE TYPE employment_type_enum AS ENUM ('PKWT', 'PKWTT', 'PROBATION', 'INTERN');
CREATE TYPE gender_enum AS ENUM ('L', 'P');
CREATE TYPE marital_status_enum AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- Status Transaksi Cuti
CREATE TYPE leave_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- Metode & Status Tip Kaca
CREATE TYPE tip_calculation_method_enum AS ENUM ('PER_SQM', 'PER_PIECE', 'SIZE_RANGE', 'HYBRID');
CREATE TYPE tip_rounding_rule_enum AS ENUM ('EXACT', 'ROUND_UP_100', 'ROUND_UP_500', 'ROUND_UP_1000');
CREATE TYPE glass_tip_status_enum AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'CANCELLED');

-- Status Armada Kendaraan & Peminjaman
CREATE TYPE vehicle_status_enum AS ENUM ('AVAILABLE', 'BORROWED', 'MAINTENANCE', 'DECOMMISSIONED');
CREATE TYPE borrowing_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IN_USE', 'RETURNED', 'CANCELLED');
CREATE TYPE vehicle_fuel_level_enum AS ENUM ('EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL');

-- Status Presensi
CREATE TYPE attendance_status_enum AS ENUM ('PRESENT', 'PERMIT', 'SICK', 'LATE', 'ABSENT');
CREATE TYPE attendance_source_enum AS ENUM ('FINGERPRINT', 'BRIEFING', 'MANUAL_ADJUSTMENT');

-- Status Pelanggaran & Sanksi
CREATE TYPE warning_level_enum AS ENUM ('NONE', 'ORAL_WARNING', 'SP1', 'SP2', 'SP3', 'TERMINATION_EVALUATION');
CREATE TYPE warning_approval_status_enum AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- Status Payroll & Pembayaran
CREATE TYPE payroll_status_enum AS ENUM ('DRAFT', 'CALCULATED', 'FINALIZED', 'PAID', 'CANCELLED');
CREATE TYPE salary_component_type_enum AS ENUM ('ALLOWANCE', 'DEDUCTION', 'BENEFIT', 'BONUS');
CREATE TYPE payment_status_enum AS ENUM ('PENDING_PAYMENT', 'PROCESSED', 'PAID');


-- SECTION 2: CORE RBAC & ORGANIZATIONAL TABLES

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    legal_name VARCHAR(200),
    tax_id VARCHAR(50),
    headquarters_address TEXT,
    phone VARCHAR(30),
    email VARCHAR(100),
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL UNIQUE,           -- 'TB-LATANSA', 'KUK-PALEN'
    name VARCHAR(150) NOT NULL,                  -- 'TB KUK La Tansa', 'KUK Palen'
    business_type VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    configurations JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_units_code ON units(code);
CREATE INDEX idx_units_active ON units(is_active);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_email ON profiles(email);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,           -- 'super_admin', 'admin_pusat', 'hrd_manager', dll
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,          -- 'employees.view', 'payroll.finalize', dll
    module VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Role tingkat sistem global (misal: super_admin, admin_pusat)
CREATE TABLE user_system_roles (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

-- Role spesifik unit (many-to-many: satu user dapat memiliki >1 role pada satu unit)
CREATE TABLE user_unit_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_default_unit BOOLEAN NOT NULL DEFAULT FALSE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    UNIQUE (user_id, unit_id, role_id)
);
CREATE INDEX idx_user_unit_roles_lookup ON user_unit_roles(user_id, unit_id);


-- SECTION 3: HUMAN RESOURCES & MASTER DATA

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, code),
    UNIQUE (unit_id, name)
);
CREATE INDEX idx_departments_unit ON departments(unit_id);

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL,
    title VARCHAR(100) NOT NULL,
    level_order INT NOT NULL DEFAULT 1,
    base_salary_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    allowed_leave_days_of_week INT[] DEFAULT NULL, -- NULL = Bebas; Contoh [0] = Khusus hari Minggu saja
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, code),
    UNIQUE (unit_id, title)
);
CREATE INDEX idx_positions_unit ON positions(unit_id);

CREATE TABLE work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,                  -- 'Reguler Operasional Toko', 'Shift Gudang'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    late_grace_minutes INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, code)
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    employee_code VARCHAR(30) NOT NULL,          -- Unik dalam lingkup unit
    full_name VARCHAR(150) NOT NULL,
    department_id UUID NOT NULL,
    position_id UUID NOT NULL,
    work_schedule_id UUID NOT NULL,
    employment_type employment_type_enum NOT NULL DEFAULT 'PKWT',
    status employee_status_enum NOT NULL DEFAULT 'ACTIVE',
    join_date DATE NOT NULL,
    end_date DATE,
    phone_number VARCHAR(30) NOT NULL,
    address TEXT,
    gender gender_enum,                          -- Dikosongkan bila belum dicatat (tanpa default)
    marital_status marital_status_enum,          -- Dikosongkan bila belum dicatat (tanpa default)
    dependents_count INT NOT NULL DEFAULT 0,
    avatar_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Composite Unique untuk referensi tabel anak
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, employee_code),

    -- Composite Foreign Keys: Memastikan departemen, jabatan, dan jadwal berasal dari unit karyawan
    CONSTRAINT fk_emp_department
        FOREIGN KEY (unit_id, department_id)
        REFERENCES departments (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_emp_position
        FOREIGN KEY (unit_id, position_id)
        REFERENCES positions (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_emp_schedule
        FOREIGN KEY (unit_id, work_schedule_id)
        REFERENCES work_schedules (unit_id, id)
        ON DELETE RESTRICT
);
CREATE INDEX idx_employees_unit_status ON employees(unit_id, status);
CREATE INDEX idx_employees_department ON employees(unit_id, department_id);

CREATE TABLE employee_sensitive_data (
    unit_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    national_id VARCHAR(30),                     -- NIK KTP
    bank_name VARCHAR(50),
    bank_account_number VARCHAR(50),
    bank_account_holder VARCHAR(150),
    tax_id_number VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (unit_id, employee_id),

    CONSTRAINT fk_emp_sensitive_employee
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE CASCADE
);

CREATE TABLE employee_portal_auth (
    employee_id UUID PRIMARY KEY,
    unit_id UUID NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_emp_auth_employee
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE CASCADE
);

CREATE TABLE employee_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    previous_status employee_status_enum NOT NULL,
    new_status employee_status_enum NOT NULL,
    effective_date DATE NOT NULL,
    reason TEXT NOT NULL,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_emp_status_hist
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE employee_job_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    from_unit_id UUID REFERENCES units(id),
    to_unit_id UUID NOT NULL REFERENCES units(id),
    from_department_id UUID,
    to_department_id UUID NOT NULL,
    from_position_id UUID,
    to_position_id UUID NOT NULL,
    effective_date DATE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_job_hist_to_dept
        FOREIGN KEY (to_unit_id, to_department_id)
        REFERENCES departments (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_job_hist_to_pos
        FOREIGN KEY (to_unit_id, to_position_id)
        REFERENCES positions (unit_id, id)
        ON DELETE RESTRICT
);


-- SECTION 4: LEAVE MANAGEMENT & CONFLICT SLOTS

CREATE TABLE leave_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    max_days_per_month INT NOT NULL DEFAULT 3,
    submission_open_day INT NOT NULL DEFAULT 1,  -- Tgl 1 bulan M-1
    submission_close_day INT NOT NULL DEFAULT 3, -- Tgl 3 bulan M
    allow_same_dept_simultaneous BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id)
);

CREATE TABLE leave_conflict_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, code)
);

CREATE TABLE leave_conflict_departments (
    unit_id UUID NOT NULL,
    conflict_group_id UUID NOT NULL,
    department_id UUID NOT NULL,
    PRIMARY KEY (conflict_group_id, department_id),

    CONSTRAINT fk_conf_dept_group
        FOREIGN KEY (unit_id, conflict_group_id)
        REFERENCES leave_conflict_groups (unit_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_conf_dept_department
        FOREIGN KEY (unit_id, department_id)
        REFERENCES departments (unit_id, id)
        ON DELETE CASCADE
);

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    request_number VARCHAR(50) NOT NULL UNIQUE,
    target_month VARCHAR(7) NOT NULL,            -- Format 'YYYY-MM'
    total_days INT NOT NULL,

    -- Snapshot data kepegawaian saat pengajuan
    snapshot_employee_name VARCHAR(150) NOT NULL,
    snapshot_department_name VARCHAR(100) NOT NULL,
    snapshot_position_title VARCHAR(100) NOT NULL,

    reason TEXT NOT NULL,
    status leave_status_enum NOT NULL DEFAULT 'APPROVED',
    auto_approved BOOLEAN NOT NULL DEFAULT TRUE,
    client_ip VARCHAR(45),
    user_agent TEXT,

    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (unit_id, id),

    CONSTRAINT fk_leave_req_employee
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_leave_target_month
        CHECK (target_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE INDEX idx_leave_requests_unit_month ON leave_requests(unit_id, target_month);

CREATE TABLE leave_request_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    leave_request_id UUID NOT NULL,
    leave_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_leave_dates_request
        FOREIGN KEY (unit_id, leave_request_id)
        REFERENCES leave_requests (unit_id, id)
        ON DELETE CASCADE,

    UNIQUE (leave_request_id, leave_date)
);

-- Slot konflik aktif. Pembatalan permohonan menonaktifkan is_active = FALSE
CREATE TABLE leave_conflict_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    leave_request_id UUID NOT NULL,
    department_id UUID NOT NULL,
    conflict_group_id UUID,                      -- Nullable jika bentrok se-departemen murni
    leave_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_slot_request
        FOREIGN KEY (unit_id, leave_request_id)
        REFERENCES leave_requests (unit_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_slot_department
        FOREIGN KEY (unit_id, department_id)
        REFERENCES departments (unit_id, id)
        ON DELETE RESTRICT
);

-- Partial Unique Index: Hanya mengunci slot pada transaksi yang AKTIF
CREATE UNIQUE INDEX uq_active_dept_leave_slot
ON leave_conflict_slots (unit_id, department_id, leave_date)
WHERE (is_active = TRUE);

CREATE UNIQUE INDEX uq_active_group_leave_slot
ON leave_conflict_slots (unit_id, conflict_group_id, leave_date)
WHERE (is_active = TRUE AND conflict_group_id IS NOT NULL);


-- SECTION 5: GLASS TIP CALCULATION & VERIFICATION

CREATE TABLE glass_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,                  -- 'Bening 5mm', 'Ribben 5mm', 'Cermin 5mm'
    thickness_mm NUMERIC(4, 1) NOT NULL,
    selling_price_per_sqm NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Harga jual acuan per m2
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, code),
    UNIQUE (unit_id, name)
);

CREATE TABLE glass_tip_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    glass_type_id UUID NOT NULL,
    calculation_method tip_calculation_method_enum NOT NULL DEFAULT 'PER_SQM',
    base_rate NUMERIC(12, 2) NOT NULL,           -- Tarif per m2 atau per potong
    min_tip_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    rounding_rule tip_rounding_rule_enum NOT NULL DEFAULT 'ROUND_UP_1000',
    effective_range DATERANGE NOT NULL,          -- Rentang tanggal berlaku [mulai, selesai)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (unit_id, id),

    CONSTRAINT fk_tip_rate_glass_type
        FOREIGN KEY (unit_id, glass_type_id)
        REFERENCES glass_types (unit_id, id)
        ON DELETE RESTRICT,

    -- Mencegah tumpang tindih periode tarif untuk tipe kaca yang sama
    CONSTRAINT uq_tip_rates_no_overlap
        EXCLUDE USING gist (
            unit_id WITH =,
            glass_type_id WITH =,
            effective_range WITH &&
        ) WHERE (is_active = TRUE)
);

CREATE TABLE glass_tip_rate_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    rate_id UUID NOT NULL,
    min_area_sqm NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    max_area_sqm NUMERIC(10, 4) NOT NULL,
    rate_amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_tip_range_rate
        FOREIGN KEY (unit_id, rate_id)
        REFERENCES glass_tip_rates (unit_id, id)
        ON DELETE CASCADE
);

CREATE TABLE glass_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    employee_id UUID NOT NULL,
    glass_type_id UUID NOT NULL,
    rate_id UUID,                                -- Nullable jika menggunakan tarif persentase harga kaca murni

    length_cm NUMERIC(8, 2) NOT NULL,
    height_cm NUMERIC(8, 2) NOT NULL,
    quantity INT NOT NULL,
    calculated_sqm NUMERIC(10, 4) NOT NULL,

    -- Snapshot harga, persentase tip, dan formula yang diterapkan saat transaksi
    glass_price_snapshot NUMERIC(12, 2) NOT NULL, -- Total harga jual kaca yang dipotong
    tip_percentage_snapshot NUMERIC(5, 4) NOT NULL DEFAULT 0.0300, -- Persentase 3% (0.0300)
    rounding_rule tip_rounding_rule_enum NOT NULL DEFAULT 'ROUND_UP_1000',
    tip_amount NUMERIC(12, 2) NOT NULL,          -- Nominal tip terhitung (glass_price × 0.03)
    verified_amount NUMERIC(12, 2),              -- Nominal final setelah diverifikasi staf

    status glass_tip_status_enum NOT NULL DEFAULT 'PENDING',
    payroll_period_id UUID,                      -- FK ke payroll_periods saat finalisasi
    notes TEXT,
    client_token_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (unit_id, id),

    CONSTRAINT fk_tip_employee
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_tip_glass_type
        FOREIGN KEY (unit_id, glass_type_id)
        REFERENCES glass_types (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_tip_rate_config
        FOREIGN KEY (unit_id, rate_id)
        REFERENCES glass_tip_rates (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_dimensions_positive
        CHECK (length_cm > 0 AND height_cm > 0 AND quantity > 0),

    CONSTRAINT chk_glass_price_positive
        CHECK (glass_price_snapshot >= 0 AND tip_amount >= 0)
);
CREATE INDEX idx_glass_tips_lookup ON glass_tips(unit_id, status, payroll_period_id);

CREATE TABLE glass_tip_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    glass_tip_id UUID NOT NULL,
    verified_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    action VARCHAR(20) NOT NULL,                 -- 'VERIFY', 'ADJUST', 'REJECT'
    previous_amount NUMERIC(12, 2) NOT NULL,
    approved_amount NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_tip_verif_tip
        FOREIGN KEY (unit_id, glass_tip_id)
        REFERENCES glass_tips (unit_id, id)
        ON DELETE CASCADE
);


-- SECTION 6: VIOLATIONS & DISCIPLINARY ACTIONS

CREATE TABLE violation_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL,
    category VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    default_points INT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, code)
);

CREATE TABLE violation_point_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    sp1_min_points INT NOT NULL,
    sp2_min_points INT NOT NULL,
    sp3_min_points INT NOT NULL,
    termination_min_points INT NOT NULL,
    point_validity_days INT NOT NULL,            -- Masa berlaku poin dalam hitungan hari kalender
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id)
);

CREATE TABLE warning_letter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    warning_level warning_level_enum NOT NULL,
    title VARCHAR(150) NOT NULL,
    template_body TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, code)
);

CREATE TABLE violation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    violation_type_id UUID NOT NULL,
    record_number VARCHAR(50) NOT NULL UNIQUE,
    incident_date DATE NOT NULL,
    points_assigned INT NOT NULL,
    description TEXT NOT NULL,
    evidence_file_urls TEXT[] DEFAULT '{}',
    recorded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (unit_id, id),

    CONSTRAINT fk_vio_rec_employee
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_vio_rec_type
        FOREIGN KEY (unit_id, violation_type_id)
        REFERENCES violation_types (unit_id, id)
        ON DELETE RESTRICT
);
CREATE INDEX idx_violation_records_emp ON violation_records(unit_id, employee_id);

CREATE TABLE warning_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    template_id UUID NOT NULL,
    letter_number VARCHAR(100) NOT NULL UNIQUE,
    warning_level warning_level_enum NOT NULL,
    accumulated_points INT NOT NULL,
    issuance_date DATE NOT NULL,
    valid_until_date DATE NOT NULL,
    pdf_document_url TEXT,
    approval_status warning_approval_status_enum NOT NULL DEFAULT 'PENDING_APPROVAL',
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (unit_id, id),

    CONSTRAINT fk_sp_employee
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sp_template
        FOREIGN KEY (unit_id, template_id)
        REFERENCES warning_letter_templates (unit_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE warning_letter_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    warning_letter_id UUID NOT NULL,
    approver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    status warning_approval_status_enum NOT NULL,
    notes TEXT,
    action_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_sp_approval_letter
        FOREIGN KEY (unit_id, warning_letter_id)
        REFERENCES warning_letters (unit_id, id)
        ON DELETE CASCADE
);


-- SECTION 7: ATTENDANCE, BRIEFING & FINGERPRINT LOGS

CREATE TABLE briefing_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    session_date DATE NOT NULL,
    started_at TIME NOT NULL,
    leader_name VARCHAR(100),
    topic_notes TEXT,
    recorded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, session_date)
);

CREATE TABLE briefing_attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    session_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    status attendance_status_enum NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (session_id, employee_id),

    CONSTRAINT fk_briefing_att_session
        FOREIGN KEY (unit_id, session_id)
        REFERENCES briefing_sessions (unit_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_briefing_att_employee
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE fingerprint_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    device_code VARCHAR(50) NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    ip_address VARCHAR(45),
    location_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, device_code)
);

CREATE TABLE employee_fingerprint_ids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    device_id UUID NOT NULL,
    enrollment_id INT NOT NULL,                  -- ID pin/user pada mesin fisik
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (device_id, enrollment_id),

    CONSTRAINT fk_fp_id_employee
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_fp_id_device
        FOREIGN KEY (unit_id, device_id)
        REFERENCES fingerprint_devices (unit_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE fingerprint_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    device_id UUID REFERENCES fingerprint_devices(id) ON DELETE SET NULL,
    batch_number VARCHAR(50) NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    file_sha256_hash VARCHAR(64) NOT NULL,       -- Mencegah impor berkas duplikat
    imported_row_count INT NOT NULL DEFAULT 0,
    success_row_count INT NOT NULL DEFAULT 0,
    error_row_count INT NOT NULL DEFAULT 0,
    imported_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, file_sha256_hash)
);

-- Tabel data mentah mesin sidik jari: Mutlak Append-Only & Immutable
CREATE TABLE fingerprint_raw_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES fingerprint_import_batches(id) ON DELETE RESTRICT,
    device_id UUID REFERENCES fingerprint_devices(id) ON DELETE SET NULL,
    device_enrollment_id INT NOT NULL,
    log_timestamp TIMESTAMPTZ NOT NULL,
    verify_type INT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Mencegah duplikasi baris tap mesin
    UNIQUE (unit_id, device_enrollment_id, log_timestamp)
);
CREATE INDEX idx_raw_logs_lookup ON fingerprint_raw_logs(unit_id, device_enrollment_id, log_timestamp);

CREATE TABLE attendance_daily_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    work_schedule_id UUID NOT NULL,
    work_date DATE NOT NULL,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    late_minutes INT NOT NULL DEFAULT 0,
    early_leave_minutes INT NOT NULL DEFAULT 0,
    overtime_minutes INT NOT NULL DEFAULT 0,
    status attendance_status_enum NOT NULL,
    primary_source attendance_source_enum NOT NULL,
    is_manually_adjusted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (unit_id, id),
    UNIQUE (unit_id, employee_id, work_date),

    CONSTRAINT fk_att_daily_employee
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_att_daily_schedule
        FOREIGN KEY (unit_id, work_schedule_id)
        REFERENCES work_schedules (unit_id, id)
        ON DELETE RESTRICT
);
CREATE INDEX idx_attendance_daily_filter ON attendance_daily_records(unit_id, work_date, status);

CREATE TABLE attendance_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    attendance_record_id UUID NOT NULL,
    adjusted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    previous_clock_in TIMESTAMPTZ,
    new_clock_in TIMESTAMPTZ,
    previous_clock_out TIMESTAMPTZ,
    new_clock_out TIMESTAMPTZ,
    previous_status attendance_status_enum NOT NULL,
    new_status attendance_status_enum NOT NULL,
    reason TEXT NOT NULL,
    adjusted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_att_adj_record
        FOREIGN KEY (unit_id, attendance_record_id)
        REFERENCES attendance_daily_records (unit_id, id)
        ON DELETE RESTRICT
);


-- SECTION 8: PAYROLL ENGINE & SALARY STRUCTURES

CREATE TABLE salary_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    component_type salary_component_type_enum NOT NULL,
    default_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_taxable BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, code)
);

CREATE TABLE employee_salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    base_salary NUMERIC(12, 2) NOT NULL,
    effective_start_date DATE NOT NULL,
    effective_end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (unit_id, id),

    CONSTRAINT fk_sal_struct_emp
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE employee_salary_component_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    structure_id UUID NOT NULL,
    component_id UUID NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (structure_id, component_id),

    CONSTRAINT fk_sal_item_struct
        FOREIGN KEY (unit_id, structure_id)
        REFERENCES employee_salary_structures (unit_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sal_item_comp
        FOREIGN KEY (unit_id, component_id)
        REFERENCES salary_components (unit_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    period_code VARCHAR(30) NOT NULL,            -- 'PAY-LAT-2026-06'
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    payout_date DATE NOT NULL,
    status payroll_status_enum NOT NULL DEFAULT 'DRAFT',
    total_net_payout NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    finalized_at TIMESTAMPTZ,
    finalized_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id),
    UNIQUE (unit_id, period_code)
);

-- Relasi komposit fk_tip_payroll_period ditambahkan setelah payroll_periods dibuat untuk menjamin urutan dependensi
ALTER TABLE glass_tips
    ADD CONSTRAINT fk_tip_payroll_period
    FOREIGN KEY (unit_id, payroll_period_id)
    REFERENCES payroll_periods (unit_id, id)
    ON DELETE RESTRICT;

CREATE TABLE payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    payroll_period_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    slip_number VARCHAR(50) NOT NULL UNIQUE,

    -- Snapshot data kepegawaian saat slip difinalisasi
    snapshot_employee_name VARCHAR(150) NOT NULL,
    snapshot_department_name VARCHAR(100) NOT NULL,
    snapshot_position_title VARCHAR(100) NOT NULL,

    total_earnings NUMERIC(12, 2) NOT NULL,
    total_deductions NUMERIC(12, 2) NOT NULL,
    net_salary NUMERIC(12, 2) NOT NULL,

    payment_status payment_status_enum NOT NULL DEFAULT 'PENDING_PAYMENT',
    payment_date DATE,
    payment_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (unit_id, id),
    UNIQUE (unit_id, payroll_period_id, employee_id), -- Satu karyawan satu slip per periode

    CONSTRAINT fk_pay_rec_period
        FOREIGN KEY (unit_id, payroll_period_id)
        REFERENCES payroll_periods (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_pay_rec_emp
        FOREIGN KEY (unit_id, employee_id)
        REFERENCES employees (unit_id, id)
        ON DELETE RESTRICT
);
CREATE INDEX idx_payroll_records_search ON payroll_records(unit_id, payroll_period_id, payment_status);

CREATE TABLE payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    payroll_record_id UUID NOT NULL,
    component_name VARCHAR(100) NOT NULL,
    component_type salary_component_type_enum NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    source_reference_id UUID,                    -- ID glass_tips jika berasal dari tip kaca
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_pay_items_rec
        FOREIGN KEY (unit_id, payroll_record_id)
        REFERENCES payroll_records (unit_id, id)
        ON DELETE CASCADE
);

CREATE TABLE payroll_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    payroll_period_id UUID NOT NULL,
    authorized_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    snapshot_before_revision JSONB NOT NULL,
    revised_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_pay_rev_period
        FOREIGN KEY (unit_id, payroll_period_id)
        REFERENCES payroll_periods (unit_id, id)
        ON DELETE RESTRICT
);


-- SECTION 9: FLEET MANAGEMENT & EXCLUSION DOUBLE-BOOKING

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    license_plate VARCHAR(20) NOT NULL UNIQUE,
    pertamina_barcode_id VARCHAR(50),
    current_odometer INT NOT NULL DEFAULT 0,
    status vehicle_status_enum NOT NULL DEFAULT 'AVAILABLE',
    tax_due_date DATE,
    stnk_due_date DATE,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, id)
);
CREATE INDEX idx_vehicles_unit ON vehicles(unit_id);

CREATE TABLE vehicle_borrowing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    booking_code VARCHAR(50) NOT NULL UNIQUE,
    borrower_name VARCHAR(150) NOT NULL,
    borrower_institution VARCHAR(150),
    borrower_phone VARCHAR(30) NOT NULL,
    responsible_person VARCHAR(150) NOT NULL,

    start_time TIMESTAMPTZ NOT NULL,
    estimated_return_time TIMESTAMPTZ NOT NULL,
    actual_return_time TIMESTAMPTZ,

    destination TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status borrowing_status_enum NOT NULL DEFAULT 'PENDING',

    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (unit_id, id),

    CONSTRAINT fk_fleet_req_vehicle
        FOREIGN KEY (unit_id, vehicle_id)
        REFERENCES vehicles (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_booking_time_valid
        CHECK (estimated_return_time > start_time),

    -- Mencegah tabrakan jadwal peminjaman secara mutlak di tingkat database kernel
    CONSTRAINT uq_vehicle_no_double_booking
        EXCLUDE USING gist (
            vehicle_id WITH =,
            tstzrange(start_time, estimated_return_time, '[)') WITH &&
        ) WHERE (status IN ('APPROVED', 'IN_USE'))
);
CREATE INDEX idx_fleet_requests_search ON vehicle_borrowing_requests(unit_id, vehicle_id, status);

CREATE TABLE vehicle_condition_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    borrowing_request_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    inspection_type VARCHAR(10) NOT NULL,        -- 'CHECK_OUT' / 'CHECK_IN'
    odometer_km INT NOT NULL,
    fuel_level vehicle_fuel_level_enum NOT NULL,
    cleanliness_score INT NOT NULL DEFAULT 5,
    inspector_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    condition_notes TEXT,
    inspection_photos TEXT[] DEFAULT '{}',
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_insp_request
        FOREIGN KEY (unit_id, borrowing_request_id)
        REFERENCES vehicle_borrowing_requests (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_insp_vehicle
        FOREIGN KEY (unit_id, vehicle_id)
        REFERENCES vehicles (unit_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE vehicle_damages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    borrowing_request_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    damage_description TEXT NOT NULL,
    estimated_compensation NUMERIC(12, 2) DEFAULT 0.00,
    formal_letter_number VARCHAR(100),
    authorized_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_dmg_request
        FOREIGN KEY (unit_id, borrowing_request_id)
        REFERENCES vehicle_borrowing_requests (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_dmg_vehicle
        FOREIGN KEY (unit_id, vehicle_id)
        REFERENCES vehicles (unit_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE vehicle_fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    borrowing_request_id UUID,
    fill_date DATE NOT NULL,
    liters NUMERIC(8, 2) NOT NULL,
    total_cost NUMERIC(12, 2) NOT NULL,
    fuel_receipt_photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_fuel_vehicle
        FOREIGN KEY (unit_id, vehicle_id)
        REFERENCES vehicles (unit_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_fuel_borrowing_req
        FOREIGN KEY (unit_id, borrowing_request_id)
        REFERENCES vehicle_borrowing_requests (unit_id, id)
        ON DELETE RESTRICT
);


-- SECTION 10: AUDIT, LOGGING & SYSTEM UTILITIES

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);

CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    details JSONB,
    client_ip VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);

CREATE TABLE document_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    doc_type VARCHAR(50) NOT NULL,               -- 'LEAVE', 'TIP', 'FLEET', 'SLIP', 'SP'
    period_key VARCHAR(10) NOT NULL,             -- '202611'
    current_value INT NOT NULL DEFAULT 0,
    format_template VARCHAR(100) NOT NULL,       -- '{DOC}-{UNIT}-{PERIOD}-{SEQ:4}'
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, doc_type, period_key)
);

CREATE TABLE system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    recipient_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,      -- 'LEAVE_REQUEST', 'TIP_VERIFICATION', 'STNK_EXPIRING'
    link_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON system_notifications(recipient_user_id, is_read);

CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE, -- NULL untuk pengaturan global organisasi
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, setting_key)
);

CREATE TABLE file_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    bucket_name VARCHAR(100) NOT NULL,           -- 'payroll-slips', 'violation-evidence'
    storage_path TEXT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_lookup ON file_attachments(unit_id, bucket_name);

CREATE TABLE public_form_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    form_type VARCHAR(50) NOT NULL,              -- 'LEAVE_FORM', 'GLASS_TIP_FORM', 'FLEET_FORM'
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_form_tokens_validity ON public_form_tokens(token_hash, expires_at, is_consumed);


-- SECTION 11: SECURITY & IMMUTABILITY TRIGGERS

CREATE OR REPLACE FUNCTION protect_audit_log_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs bersifat Append-Only mutlak dan tidak boleh diubah atau dihapus.';
END;
$$;

CREATE TRIGGER trg_protect_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION protect_audit_log_immutability();

CREATE OR REPLACE FUNCTION protect_finalized_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status payroll_status_enum;
BEGIN
    SELECT status INTO v_status FROM payroll_periods WHERE id = OLD.payroll_period_id;
    IF v_status = 'FINALIZED' THEN
        RAISE EXCEPTION 'Slip gaji pada periode payroll yang telah FINALIZED tidak boleh dimodifikasi atau dihapus secara langsung.';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_protect_payroll_records
BEFORE UPDATE OR DELETE ON payroll_records
FOR EACH ROW EXECUTE FUNCTION protect_finalized_payroll();


-- SECTION 12: ATOMIC RPC STORED PROCEDURES

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

-- ======================================================================
-- SECTION 13: RLS SECURITY HELPER FUNCTIONS
-- ======================================================================

CREATE OR REPLACE FUNCTION has_system_role(p_role_code VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_system_roles usr
        JOIN roles r ON usr.role_id = r.id
        WHERE usr.user_id = auth.uid()
          AND r.code = p_role_code
    );
$$;

CREATE OR REPLACE FUNCTION has_unit_access(p_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT has_system_role('super_admin') OR has_system_role('admin_pusat') OR EXISTS (
        SELECT 1
        FROM user_unit_roles uur
        WHERE uur.user_id = auth.uid()
          AND uur.unit_id = p_unit_id
    );
$$;

CREATE OR REPLACE FUNCTION has_unit_permission(p_unit_id UUID, p_permission_code VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT has_system_role('super_admin') OR EXISTS (
        SELECT 1
        FROM user_unit_roles uur
        JOIN role_permissions rp ON uur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE uur.user_id = auth.uid()
          AND uur.unit_id = p_unit_id
          AND p.code = p_permission_code
    ) OR EXISTS (
        SELECT 1
        FROM user_system_roles usr
        JOIN role_permissions rp ON usr.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE usr.user_id = auth.uid()
          AND p.code = p_permission_code
    );
$$;

-- ======================================================================
-- SECTION 14: ROW LEVEL SECURITY (RLS) POLICIES
-- ======================================================================

-- 1. Organizations & Units
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizations_read_authenticated" ON organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "organizations_manage_super_admin" ON organizations FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units_read_accessible" ON units FOR SELECT TO authenticated USING (has_unit_access(id));
CREATE POLICY "units_manage_super_admin" ON units FOR ALL TO authenticated USING (has_system_role('super_admin'));

-- 2. Profiles & RBAC
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_authenticated" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_manage_super_admin" ON profiles FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read_authenticated" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_manage_super_admin" ON roles FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_read_authenticated" ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_manage_super_admin" ON permissions FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_read_authenticated" ON role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_manage_super_admin" ON role_permissions FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE user_system_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_system_roles_read_own" ON user_system_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_system_role('super_admin'));
CREATE POLICY "user_system_roles_manage_super_admin" ON user_system_roles FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE user_unit_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_unit_roles_read_own" ON user_unit_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_system_role('super_admin'));
CREATE POLICY "user_unit_roles_manage_super_admin" ON user_unit_roles FOR ALL TO authenticated USING (has_system_role('super_admin'));

-- 3. Master Data SDM & Isolasi Unit
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments_read_unit" ON departments FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "departments_manage_unit" ON departments FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'units.manage'));

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_read_unit" ON positions FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "positions_manage_unit" ON positions FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'units.manage'));

ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_schedules_read_unit" ON work_schedules FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "work_schedules_manage_unit" ON work_schedules FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'units.manage'));

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_read_unit" ON employees FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'employees.view'));
CREATE POLICY "employees_insert_unit" ON employees FOR INSERT TO authenticated WITH CHECK (has_unit_permission(unit_id, 'employees.create'));
CREATE POLICY "employees_update_unit" ON employees FOR UPDATE TO authenticated USING (has_unit_permission(unit_id, 'employees.update'));
CREATE POLICY "employees_delete_deny" ON employees FOR DELETE TO authenticated USING (false);

ALTER TABLE employee_sensitive_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_sensitive_read" ON employee_sensitive_data FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'employees.view_sensitive'));
CREATE POLICY "employee_sensitive_manage" ON employee_sensitive_data FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'employees.manage_sensitive'));

ALTER TABLE employee_portal_auth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_portal_auth_deny_all" ON employee_portal_auth FOR ALL TO authenticated USING (false);

ALTER TABLE employee_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_status_history_read" ON employee_status_history FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'employees.view'));
CREATE POLICY "employee_status_history_insert" ON employee_status_history FOR INSERT TO authenticated WITH CHECK (has_unit_permission(unit_id, 'employees.update'));

ALTER TABLE employee_job_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_job_history_read" ON employee_job_history FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'employees.view'));
CREATE POLICY "employee_job_history_insert" ON employee_job_history FOR INSERT TO authenticated WITH CHECK (has_unit_permission(unit_id, 'employees.update'));

-- 4. Cuti Karyawan
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_policies_read" ON leave_policies FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "leave_policies_manage" ON leave_policies FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'leave.manage'));

ALTER TABLE leave_conflict_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_conflict_groups_read" ON leave_conflict_groups FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "leave_conflict_groups_manage" ON leave_conflict_groups FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'leave.manage'));

ALTER TABLE leave_conflict_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_conflict_departments_read" ON leave_conflict_departments FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "leave_conflict_departments_manage" ON leave_conflict_departments FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'leave.manage'));

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_requests_read" ON leave_requests FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'leave.view'));
CREATE POLICY "leave_requests_manage" ON leave_requests FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'leave.manage'));

ALTER TABLE leave_request_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_request_dates_read" ON leave_request_dates FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'leave.view'));

ALTER TABLE leave_conflict_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_conflict_slots_read" ON leave_conflict_slots FOR SELECT TO authenticated USING (has_unit_access(unit_id));

-- 5. Tip Potong Kaca
ALTER TABLE glass_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_types_read" ON glass_types FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "glass_types_manage" ON glass_types FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.manage_rates'));

ALTER TABLE glass_tip_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_tip_rates_read" ON glass_tip_rates FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "glass_tip_rates_manage" ON glass_tip_rates FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.manage_rates'));

ALTER TABLE glass_tip_rate_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_tip_rate_ranges_read" ON glass_tip_rate_ranges FOR SELECT TO authenticated USING (has_unit_access(unit_id));

ALTER TABLE glass_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_tips_read" ON glass_tips FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.view'));
CREATE POLICY "glass_tips_update" ON glass_tips FOR UPDATE TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.verify'));
CREATE POLICY "glass_tips_insert_anon" ON glass_tips FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE glass_tip_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_tip_verifications_read" ON glass_tip_verifications FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.view'));
CREATE POLICY "glass_tip_verifications_insert" ON glass_tip_verifications FOR INSERT TO authenticated WITH CHECK (has_unit_permission(unit_id, 'glass_tips.verify'));

-- 6. Pelanggaran & Sanksi
ALTER TABLE violation_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "violation_types_read" ON violation_types FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "violation_types_manage" ON violation_types FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'violations.manage'));

ALTER TABLE violation_point_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "violation_point_rules_read" ON violation_point_rules FOR SELECT TO authenticated USING (has_unit_access(unit_id));

ALTER TABLE warning_letter_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warning_letter_templates_read" ON warning_letter_templates FOR SELECT TO authenticated USING (has_unit_access(unit_id));

ALTER TABLE violation_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "violation_records_read" ON violation_records FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'violations.view'));
CREATE POLICY "violation_records_manage" ON violation_records FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'violations.manage'));

ALTER TABLE warning_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warning_letters_read" ON warning_letters FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'violations.view'));
CREATE POLICY "warning_letters_manage" ON warning_letters FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'violations.issue_sp'));

ALTER TABLE warning_letter_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warning_letter_approvals_read" ON warning_letter_approvals FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'violations.view'));

-- 7. Presensi & Fingerprint
ALTER TABLE briefing_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefing_sessions_read" ON briefing_sessions FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.view'));
CREATE POLICY "briefing_sessions_manage" ON briefing_sessions FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'attendance.manage_briefing'));

ALTER TABLE briefing_attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefing_attendances_read" ON briefing_attendances FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.view'));
CREATE POLICY "briefing_attendances_manage" ON briefing_attendances FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'attendance.manage_briefing'));

ALTER TABLE fingerprint_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fingerprint_devices_read" ON fingerprint_devices FOR SELECT TO authenticated USING (has_unit_access(unit_id));

ALTER TABLE employee_fingerprint_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_fingerprint_ids_read" ON employee_fingerprint_ids FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.view'));

ALTER TABLE fingerprint_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fingerprint_import_batches_read" ON fingerprint_import_batches FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.import_fingerprint'));

ALTER TABLE fingerprint_raw_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fingerprint_raw_logs_read" ON fingerprint_raw_logs FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.import_fingerprint'));
CREATE POLICY "fingerprint_raw_logs_insert" ON fingerprint_raw_logs FOR INSERT TO authenticated WITH CHECK (has_unit_permission(unit_id, 'attendance.import_fingerprint'));

ALTER TABLE attendance_daily_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_daily_records_read" ON attendance_daily_records FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.view'));
CREATE POLICY "attendance_daily_records_manage" ON attendance_daily_records FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'attendance.adjust'));

ALTER TABLE attendance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_adjustments_read" ON attendance_adjustments FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.view'));

-- 8. Penggajian / Payroll (PROTEKSI KETAT GAJI)
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salary_components_read" ON salary_components FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));
CREATE POLICY "salary_components_manage" ON salary_components FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'payroll.manage'));

ALTER TABLE employee_salary_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_salary_structures_read" ON employee_salary_structures FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));
CREATE POLICY "employee_salary_structures_manage" ON employee_salary_structures FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'payroll.manage'));

ALTER TABLE employee_salary_component_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_salary_component_items_read" ON employee_salary_component_items FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));

ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_periods_read" ON payroll_periods FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));
CREATE POLICY "payroll_periods_manage" ON payroll_periods FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'payroll.manage'));

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_records_read" ON payroll_records FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));
CREATE POLICY "payroll_records_manage" ON payroll_records FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'payroll.manage'));

ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_items_read" ON payroll_items FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));

ALTER TABLE payroll_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_revisions_read" ON payroll_revisions FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));

-- 9. Armada Kendaraan
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_read_unit" ON vehicles FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "vehicles_read_anon" ON vehicles FOR SELECT TO anon USING (status = 'AVAILABLE' AND is_active = true);
CREATE POLICY "vehicles_manage_unit" ON vehicles FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'fleet.manage'));

ALTER TABLE vehicle_borrowing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_borrowing_requests_read" ON vehicle_borrowing_requests FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'fleet.view'));
CREATE POLICY "vehicle_borrowing_requests_update" ON vehicle_borrowing_requests FOR UPDATE TO authenticated USING (has_unit_permission(unit_id, 'fleet.approve_borrowing'));
CREATE POLICY "vehicle_borrowing_requests_insert_anon" ON vehicle_borrowing_requests FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE vehicle_condition_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_condition_inspections_read" ON vehicle_condition_inspections FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'fleet.view'));

ALTER TABLE vehicle_damages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_damages_read" ON vehicle_damages FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'fleet.view'));

ALTER TABLE vehicle_fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_fuel_logs_read" ON vehicle_fuel_logs FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'fleet.view'));

-- 10. Audit, Logging & Utilitas Sistem
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_read" ON audit_logs FOR SELECT TO authenticated USING (has_system_role('super_admin') OR has_unit_permission(unit_id, 'audit_logs.view'));
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_logs_deny_update" ON audit_logs FOR UPDATE TO PUBLIC USING (false);
CREATE POLICY "audit_logs_deny_delete" ON audit_logs FOR DELETE TO PUBLIC USING (false);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs_read" ON activity_logs FOR SELECT TO authenticated USING (has_system_role('super_admin') OR (unit_id IS NOT NULL AND has_unit_access(unit_id)));

ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_sequences_read" ON document_sequences FOR SELECT TO authenticated USING (has_unit_access(unit_id));

ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_notifications_read_recipient" ON system_notifications FOR SELECT TO authenticated USING (recipient_profile_id = auth.uid() OR recipient_profile_id IS NULL);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_settings_read" ON system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_settings_manage" ON system_settings FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "file_attachments_read" ON file_attachments FOR SELECT TO authenticated USING (unit_id IS NULL OR has_unit_access(unit_id));

ALTER TABLE public_form_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_form_tokens_anon_insert" ON public_form_tokens FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "public_form_tokens_read_manage" ON public_form_tokens FOR ALL TO authenticated USING (has_system_role('super_admin'));
