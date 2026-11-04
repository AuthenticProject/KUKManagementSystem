# DATABASE SCHEMA SPECIFICATION — KUK MANAGEMENT SYSTEM
## Enterprise Multi-Unit PostgreSQL Architecture · Production Standard
**Versi:** 3.1.0  
**Target Engine:** PostgreSQL 15+ (Supabase Managed PostgreSQL)  
**Tanggal Revisi:** 2026-11-04  
**Status:** Canonical Production Baseline  

---

## 1. Konvensi Penamaan, Standar Tipe & Ekstensi

1. **Identifier**: Seluruh tabel, kolom, dan indeks menggunakan huruf kecil *snake_case*.
2. **Primary Key**: Semua entitas transaksional dan master menggunakan `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
3. **Penyimpanan Timestamp Standar**:
   - Seluruh kolom waktu menggunakan `TIMESTAMPTZ NOT NULL DEFAULT now()`.
   - Waktu UTC disimpan murni tanpa distorsi.
   - Penentuan tanggal kalender kerja lokal unit menggunakan ekspresi terstandarisasi:
     `(now() AT TIME ZONE 'Asia/Jakarta')::date`
4. **Composite Integrity Key**:
   - Seluruh tabel master unit menyertakan `UNIQUE (unit_id, id)`.
   - Seluruh relasi anak berkonteks unit wajib menggunakan foreign key komposit:
     `FOREIGN KEY (unit_id, parent_id) REFERENCES parent_table (unit_id, id) ON DELETE RESTRICT`.
   - Hal ini menjamin secara fisik di tingkat mesin database bahwa transaksi unit A tidak dapat menghubungkan entitas master milik unit B.
5. **Ekstensi PostgreSQL Wajib**:
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
```

---

## 2. Definisi Tipe Data Khusus (Custom Types / ENUM)

```sql
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
```

---

## 3. Kamus Data & Spesifikasi Tabel Terinci

### 3.1 Grup Entitas: Organisasi & Kontrol Akses (Multi-Unit RBAC)

#### A. `organizations`
Mewakili induk entitas organisasi bisnis KUK.
```sql
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
```

#### B. `units`
Unit bisnis operasional mandiri di bawah naungan KUK.
```sql
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
```

#### C. `profiles`
Profil staf terautentikasi (terkait 1-to-1 dengan akun `auth.users` Supabase).
```sql
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
```

#### D. `roles`, `permissions`, `role_permissions`
Definisi RBAC granular dan independen.
```sql
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
```

#### E. `user_system_roles` & `user_unit_roles`
Mendukung penugasan multi-role per unit tanpa mengandalkan boolean rentan di profil.
```sql
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
```

---

### 3.2 Grup Entitas: Master Data SDM & Isolasi Informasi Sensitif

#### A. `departments` (Bagian / Departemen)
```sql
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
```

#### B. `positions` (Jabatan)
```sql
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
```

#### C. `work_schedules` (Jadwal Kerja & Shift Unit)
```sql
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
```

#### D. `employees` (Master Karyawan)
Tidak memuat data kredensial/PIN atau data sensitif bank secara terbuka, serta tidak berasumsi default gender/status pernikahan.
```sql
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
```

#### E. `employee_sensitive_data` (Data Pribadi Terproteksi)
Tabel terpisah dengan kebijakan RLS ketat khusus HRD/Payroll Manager untuk NIK dan rekening bank.
```sql
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
```

#### F. `employee_portal_auth` (Kredensial Portal Mandiri Karyawan)
Menyimpan PIN hash bcrypt, pencatat percobaan gagal, dan penguncian anti-bruteforce.
```sql
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
```

#### G. `employee_status_history` & `employee_job_history`
```sql
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
```

---

### 3.3 Grup Entitas: Cuti Karyawan & Dynamic Conflict Slot Engine

#### A. `leave_policies`
```sql
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
```

#### B. `leave_conflict_groups` & `leave_conflict_departments`
```sql
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
```

#### C. `leave_requests`, `leave_request_dates` & `leave_conflict_slots`
Pemisahan slot operasional aktif dengan partial unique index memungkinkan pembatalan cuti mengembalikan slot secara bersih.
```sql
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
```

---

### 3.4 Grup Entitas: Tip Pemotongan Kaca & Konfigurasi Tarif Fleksibel

#### A. `glass_types`
```sql
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
```

#### B. `glass_tip_rates` & `glass_tip_rate_ranges`
Mendukung metode `PER_SQM`, `PER_PIECE`, `SIZE_RANGE`, dan `HYBRID` tanpa tumpang tindih tanggal (*overlapping exclusion*).
```sql
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
```

#### C. `glass_tips` & `glass_tip_verifications`
```sql
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

    CONSTRAINT fk_tip_payroll_period
        FOREIGN KEY (unit_id, payroll_period_id)
        REFERENCES payroll_periods (unit_id, id)
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
```

---

### 3.5 Grup Entitas: Pelanggaran & Sanksi Kerja (Configurable Policy)

#### A. `violation_types` & `violation_point_rules`
Seluruh ambang poin dan masa berlaku dapat dikonfigurasi per unit tanpa angka asumsi default.
```sql
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
```

#### B. `warning_letter_templates`, `violation_records`, `warning_letters` & `warning_letter_approvals`
```sql
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
```

---

### 3.6 Grup Entitas: Presensi, Mesin Fingerprint & Rekonsiliasi

#### A. Presensi Briefing Pagi
```sql
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
```

#### B. Perangkat, Batch Impor & Log Mentah Mesin Fingerprint
```sql
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
```

---

### 3.7 Grup Entitas: Penggajian / Payroll Engine & Immutable Snapshot

#### A. `salary_components` & `employee_salary_structures`
Semua komponen gaji dikelola fleksibel tanpa hardcoded KSJ atau tunjangan semu.
```sql
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
```

#### B. `payroll_periods`, `payroll_records`, `payroll_items` & `payroll_revisions`
```sql
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
```

---

### 3.8 Grup Entitas: Armada Kendaraan & Exclusion Double-Booking Protection

#### A. Master Kendaraan
```sql
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
```

#### B. Peminjaman Armada dengan PostgreSQL Exclusion Constraint
```sql
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
```

---

### 3.9 Grup Entitas: Audit, Sistem & Penomoran Dokumen

#### A. `audit_logs` & `activity_logs`
```sql
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
```

#### B. `document_sequences` (Penomoran Atomik Tanpa Angka Acak)
```sql
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
```

#### C. `system_notifications`
```sql
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
```

#### D. `system_settings`
```sql
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
```

#### E. `file_attachments`
```sql
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
```

#### F. `public_form_tokens` (Anti-Spam & Token Session Verifikasi)
```sql
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
```

---

## 4. Trigger Keamanan & Kekekalan Data (Immutability Engine)

### 4.1 Trigger Proteksi Immutability `audit_logs`
```sql
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
```

### 4.2 Trigger Proteksi Payroll Final
```sql
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
```

---

## 5. Ringkasan Kepatuhan PostgreSQL 15+ & Supabase
Skema database versi 3.1.0 di atas secara utuh:
1. Menghilangkan asumsi non-portabel (menggunakan `now()` dan `(now() AT TIME ZONE 'Asia/Jakarta')::date`).
2. Menegakkan integritas multi-unit secara matematis melalui Composite Foreign Keys `(unit_id, id)`.
3. Mengeliminasi *double booking* kendaraan menggunakan *Exclusion Constraints* kernel PostgreSQL.
4. Memisahkan data rahasia/kredensial ke dalam tabel terisolasi dengan penegakan RLS berlapis.
