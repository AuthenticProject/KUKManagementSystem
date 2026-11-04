# ENTITY RELATIONSHIP DIAGRAM (ERD) — KUK MANAGEMENT SYSTEM
## Visual Domain Model & Comprehensive Relational Topology (v3.1.0)
**Versi:** 3.1.0  
**Tanggal:** 2026-11-04  
**Format Visualisasi:** Mermaid ER-Diagrams (Github-Flavored Markdown Compatible)  

---

## 1. Domain Inti: Organisasi, Multi-Unit & RBAC Multi-Role

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ UNITS : "owns / operates"
    ORGANIZATIONS {
        uuid id PK
        varchar code UK
        varchar name
        text headquarters_address
    }

    UNITS ||--o{ DEPARTMENTS : "contains"
    UNITS ||--o{ POSITIONS : "defines"
    UNITS ||--o{ WORK_SCHEDULES : "regulates"
    UNITS ||--o{ EMPLOYEES : "employs"
    UNITS ||--o{ USER_UNIT_ROLES : "assigned in"
    UNITS ||--o{ VEHICLES : "maintains"
    UNITS {
        uuid id PK
        uuid organization_id FK
        varchar code UK
        varchar name
        boolean is_active
    }

    PROFILES ||--o{ USER_SYSTEM_ROLES : "holds system role"
    PROFILES ||--o{ USER_UNIT_ROLES : "assigned unit roles"
    PROFILES ||--o{ AUDIT_LOGS : "acts in"
    PROFILES ||--o{ ACTIVITY_LOGS : "generates"
    PROFILES ||--o{ SYSTEM_NOTIFICATIONS : "receives"
    PROFILES {
        uuid id PK
        varchar email UK
        varchar full_name
        boolean is_active
    }

    ROLES ||--o{ ROLE_PERMISSIONS : "contains"
    ROLES ||--o{ USER_SYSTEM_ROLES : "granted to user"
    ROLES ||--o{ USER_UNIT_ROLES : "assigned per unit"
    ROLES {
        uuid id PK
        varchar code UK
        varchar name
        boolean is_system_role
    }

    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "grouped in"
    PERMISSIONS {
        uuid id PK
        varchar code UK
        varchar module
        varchar name
    }

    ROLE_PERMISSIONS {
        uuid role_id PK,FK
        uuid permission_id PK,FK
    }

    USER_SYSTEM_ROLES {
        uuid user_id PK,FK
        uuid role_id PK,FK
        timestamptz granted_at
    }

    USER_UNIT_ROLES {
        uuid id PK
        uuid user_id FK
        uuid unit_id FK
        uuid role_id FK
        boolean is_default_unit
    }
```

---

## 2. Domain SDM: Master Karyawan, Keamanan Data & Riwayat Mutasi

```mermaid
erDiagram
    UNITS ||--o{ DEPARTMENTS : "partitions"
    UNITS ||--o{ POSITIONS : "partitions"
    UNITS ||--o{ WORK_SCHEDULES : "partitions"
    UNITS ||--o{ EMPLOYEES : "partitions"

    DEPARTMENTS ||--o{ EMPLOYEES : "categorizes (unit-locked)"
    DEPARTMENTS {
        uuid id PK
        uuid unit_id FK
        varchar code
        varchar name
        boolean is_active
    }

    POSITIONS ||--o{ EMPLOYEES : "designates (unit-locked)"
    POSITIONS {
        uuid id PK
        uuid unit_id FK
        varchar code
        varchar title
        numeric base_salary_allowance
        int_array allowed_leave_days_of_week
    }

    WORK_SCHEDULES ||--o{ EMPLOYEES : "assigns shift (unit-locked)"
    WORK_SCHEDULES {
        uuid id PK
        uuid unit_id FK
        varchar code
        time start_time
        time end_time
    }

    EMPLOYEES ||--|| EMPLOYEE_SENSITIVE_DATA : "has private data"
    EMPLOYEES ||--|| EMPLOYEE_PORTAL_AUTH : "has portal auth"
    EMPLOYEES ||--o{ EMPLOYEE_STATUS_HISTORY : "tracks status"
    EMPLOYEES ||--o{ EMPLOYEE_JOB_HISTORY : "tracks transfer"
    EMPLOYEES ||--o{ EMPLOYEE_FINGERPRINT_IDS : "enrolled in devices"
    EMPLOYEES {
        uuid id PK
        uuid unit_id FK
        varchar employee_code UK
        varchar full_name
        uuid department_id FK
        uuid position_id FK
        uuid work_schedule_id FK
        varchar status
        date join_date
        varchar phone_number
    }

    EMPLOYEE_SENSITIVE_DATA {
        uuid employee_id PK,FK
        uuid unit_id PK,FK
        varchar national_id
        varchar bank_name
        varchar bank_account_number
    }

    EMPLOYEE_PORTAL_AUTH {
        uuid employee_id PK,FK
        uuid unit_id FK
        varchar pin_hash
        int failed_attempts
        timestamptz locked_until
    }

    EMPLOYEE_STATUS_HISTORY {
        uuid id PK
        uuid unit_id FK
        uuid employee_id FK
        varchar previous_status
        varchar new_status
        date effective_date
        text reason
    }

    EMPLOYEE_JOB_HISTORY {
        uuid id PK
        uuid employee_id FK
        uuid to_unit_id FK
        uuid to_department_id FK
        uuid to_position_id FK
        date effective_date
    }
```

---

## 3. Domain Cuti: Dynamic Conflict Slots & Anti-Bentrok

```mermaid
erDiagram
    UNITS ||--o{ LEAVE_POLICIES : "configures"
    UNITS ||--o{ LEAVE_CONFLICT_GROUPS : "defines"
    UNITS ||--o{ LEAVE_REQUESTS : "manages"

    LEAVE_POLICIES {
        uuid id PK
        uuid unit_id FK,UK
        int max_days_per_month
        int submission_open_day
        int submission_close_day
    }

    LEAVE_CONFLICT_GROUPS ||--o{ LEAVE_CONFLICT_DEPARTMENTS : "groups"
    LEAVE_CONFLICT_GROUPS {
        uuid id PK
        uuid unit_id FK
        varchar code
        varchar group_name
    }

    DEPARTMENTS ||--o{ LEAVE_CONFLICT_DEPARTMENTS : "joined in"
    LEAVE_CONFLICT_DEPARTMENTS {
        uuid conflict_group_id PK,FK
        uuid department_id PK,FK
        uuid unit_id FK
    }

    EMPLOYEES ||--o{ LEAVE_REQUESTS : "applies"
    LEAVE_REQUESTS ||--o{ LEAVE_REQUEST_DATES : "details dates"
    LEAVE_REQUESTS ||--o{ LEAVE_CONFLICT_SLOTS : "locks slots"
    LEAVE_REQUESTS {
        uuid id PK
        uuid unit_id FK
        uuid employee_id FK
        varchar request_number UK
        varchar target_month
        int total_days
        varchar status
        boolean auto_approved
    }

    LEAVE_REQUEST_DATES {
        uuid id PK
        uuid unit_id FK
        uuid leave_request_id FK
        date leave_date
    }

    LEAVE_CONFLICT_SLOTS {
        uuid id PK
        uuid unit_id FK
        uuid leave_request_id FK
        uuid department_id FK
        uuid conflict_group_id FK
        date leave_date
        boolean is_active
    }
```

---

## 4. Domain Tip Pemotongan Kaca: Tip 3% Harga Kaca (CONFIRMED) & Snapshot

```mermaid
erDiagram
    UNITS ||--o{ GLASS_TYPES : "stocks"
    UNITS ||--o{ GLASS_TIP_RATES : "regulates"
    UNITS ||--o{ GLASS_TIPS : "records"

    GLASS_TYPES ||--o{ GLASS_TIP_RATES : "priced by"
    GLASS_TYPES ||--o{ GLASS_TIPS : "cut from"
    GLASS_TYPES {
        uuid id PK
        uuid unit_id FK
        varchar code
        varchar name
        numeric thickness_mm
        numeric selling_price_per_sqm
    }

    GLASS_TIP_RATES ||--o{ GLASS_TIP_RATE_RANGES : "has tiered rates"
    GLASS_TIP_RATES ||--o{ GLASS_TIPS : "applies to"
    GLASS_TIP_RATES {
        uuid id PK
        uuid unit_id FK
        uuid glass_type_id FK
        varchar calculation_method
        numeric base_rate
        numeric min_tip_amount
        daterange effective_range
    }

    GLASS_TIP_RATE_RANGES {
        uuid id PK
        uuid unit_id FK
        uuid rate_id FK
        numeric min_area_sqm
        numeric max_area_sqm
        numeric rate_amount
    }

    EMPLOYEES ||--o{ GLASS_TIPS : "earns tip"
    GLASS_TIPS ||--o{ GLASS_TIP_VERIFICATIONS : "reviewed via"
    GLASS_TIPS {
        uuid id PK
        uuid unit_id FK
        varchar reference_code UK
        uuid employee_id FK
        uuid glass_type_id FK
        numeric length_cm
        numeric height_cm
        int quantity
        numeric calculated_sqm
        numeric glass_price_snapshot
        numeric tip_percentage_snapshot
        numeric tip_amount
        numeric verified_amount
        varchar rounding_rule
        varchar status
        uuid payroll_period_id FK
    }

    GLASS_TIP_VERIFICATIONS {
        uuid id PK
        uuid unit_id FK
        uuid glass_tip_id FK
        uuid verified_by FK
        varchar action
        numeric approved_amount
        timestamptz verified_at
    }
```

---

## 5. Domain Pelanggaran & Sanksi Kerja (Configurable Policy)

```mermaid
erDiagram
    UNITS ||--o{ VIOLATION_TYPES : "classifies"
    UNITS ||--o{ VIOLATION_POINT_RULES : "configures thresholds"
    UNITS ||--o{ WARNING_LETTER_TEMPLATES : "defines templates"
    UNITS ||--o{ VIOLATION_RECORDS : "records incidents"
    UNITS ||--o{ WARNING_LETTERS : "issues"

    VIOLATION_TYPES ||--o{ VIOLATION_RECORDS : "assigned to"
    VIOLATION_TYPES {
        uuid id PK
        uuid unit_id FK
        varchar code
        varchar name
        int default_points
    }

    VIOLATION_POINT_RULES {
        uuid id PK
        uuid unit_id FK,UK
        int sp1_min_points
        int sp2_min_points
        int sp3_min_points
        int termination_min_points
        int point_validity_days
    }

    WARNING_LETTER_TEMPLATES ||--o{ WARNING_LETTERS : "formats"
    WARNING_LETTER_TEMPLATES {
        uuid id PK
        uuid unit_id FK
        varchar code
        varchar warning_level
        text template_body
    }

    EMPLOYEES ||--o{ VIOLATION_RECORDS : "commits"
    VIOLATION_RECORDS {
        uuid id PK
        uuid unit_id FK
        uuid employee_id FK
        uuid violation_type_id FK
        varchar record_number UK
        date incident_date
        int points_assigned
    }

    EMPLOYEES ||--o{ WARNING_LETTERS : "disciplined by"
    WARNING_LETTERS ||--o{ WARNING_LETTER_APPROVALS : "authorized by"
    WARNING_LETTERS {
        uuid id PK
        uuid unit_id FK
        uuid employee_id FK
        uuid template_id FK
        varchar letter_number UK
        varchar warning_level
        int accumulated_points
        varchar approval_status
    }

    WARNING_LETTER_APPROVALS {
        uuid id PK
        uuid unit_id FK
        uuid warning_letter_id FK
        uuid approver_id FK
        varchar status
        timestamptz action_at
    }
```

---

## 6. Domain Presensi: Briefing & Rekonsiliasi Fingerprint

```mermaid
erDiagram
    UNITS ||--o{ BRIEFING_SESSIONS : "holds"
    UNITS ||--o{ FINGERPRINT_DEVICES : "deploys"
    UNITS ||--o{ FINGERPRINT_IMPORT_BATCHES : "receives"
    UNITS ||--o{ ATTENDANCE_DAILY_RECORDS : "tracks"

    BRIEFING_SESSIONS ||--o{ BRIEFING_ATTENDANCES : "records"
    BRIEFING_SESSIONS {
        uuid id PK
        uuid unit_id FK
        date session_date
        time started_at
        varchar leader_name
    }

    EMPLOYEES ||--o{ BRIEFING_ATTENDANCES : "attends"
    BRIEFING_ATTENDANCES {
        uuid id PK
        uuid unit_id FK
        uuid session_id FK
        uuid employee_id FK
        varchar status
    }

    FINGERPRINT_DEVICES ||--o{ EMPLOYEE_FINGERPRINT_IDS : "registers"
    FINGERPRINT_DEVICES ||--o{ FINGERPRINT_RAW_LOGS : "captures"
    FINGERPRINT_DEVICES {
        uuid id PK
        uuid unit_id FK
        varchar device_code UK
        varchar device_name
        varchar serial_number
    }

    EMPLOYEES ||--o{ EMPLOYEE_FINGERPRINT_IDS : "enrolled"
    EMPLOYEE_FINGERPRINT_IDS {
        uuid id PK
        uuid unit_id FK
        uuid employee_id FK
        uuid device_id FK
        int enrollment_id
    }

    FINGERPRINT_IMPORT_BATCHES ||--o{ FINGERPRINT_RAW_LOGS : "batches"
    FINGERPRINT_IMPORT_BATCHES {
        uuid id PK
        uuid unit_id FK
        varchar batch_number UK
        varchar file_sha256_hash UK
        int imported_row_count
    }

    FINGERPRINT_RAW_LOGS {
        uuid id PK
        uuid unit_id FK
        uuid batch_id FK
        uuid device_id FK
        int device_enrollment_id
        timestamptz log_timestamp
        jsonb raw_payload
    }

    EMPLOYEES ||--o{ ATTENDANCE_DAILY_RECORDS : "daily log"
    WORK_SCHEDULES ||--o{ ATTENDANCE_DAILY_RECORDS : "benchmarks"
    ATTENDANCE_DAILY_RECORDS ||--o{ ATTENDANCE_ADJUSTMENTS : "audited via"
    ATTENDANCE_DAILY_RECORDS {
        uuid id PK
        uuid unit_id FK
        uuid employee_id FK
        uuid work_schedule_id FK
        date work_date
        timestamptz clock_in
        timestamptz clock_out
        int late_minutes
        varchar status
        boolean is_manually_adjusted
    }

    ATTENDANCE_ADJUSTMENTS {
        uuid id PK
        uuid unit_id FK
        uuid attendance_record_id FK
        uuid adjusted_by FK
        varchar previous_status
        varchar new_status
        text reason
    }
```

---

## 7. Domain Penggajian: Struktur Gaji, Kalkulasi & Snapshot Final

```mermaid
erDiagram
    UNITS ||--o{ SALARY_COMPONENTS : "defines"
    UNITS ||--o{ PAYROLL_PERIODS : "schedules"
    UNITS ||--o{ PAYROLL_RECORDS : "issues"

    SALARY_COMPONENTS ||--o{ EMPLOYEE_SALARY_COMPONENT_ITEMS : "configured in"
    SALARY_COMPONENTS {
        uuid id PK
        uuid unit_id FK
        varchar code
        varchar name
        varchar component_type
    }

    EMPLOYEES ||--o{ EMPLOYEE_SALARY_STRUCTURES : "receives structure"
    EMPLOYEE_SALARY_STRUCTURES ||--o{ EMPLOYEE_SALARY_COMPONENT_ITEMS : "details"
    EMPLOYEE_SALARY_STRUCTURES {
        uuid id PK
        uuid unit_id FK
        uuid employee_id FK
        numeric base_salary
        date effective_start_date
    }

    EMPLOYEE_SALARY_COMPONENT_ITEMS {
        uuid id PK
        uuid unit_id FK
        uuid structure_id FK
        uuid component_id FK
        numeric amount
    }

    PAYROLL_PERIODS ||--o{ PAYROLL_RECORDS : "contains slips"
    PAYROLL_PERIODS ||--o{ PAYROLL_REVISIONS : "tracks revisions"
    PAYROLL_PERIODS {
        uuid id PK
        uuid unit_id FK
        varchar period_code UK
        date start_date
        date end_date
        date payout_date
        varchar status
        numeric total_net_payout
    }

    EMPLOYEES ||--o{ PAYROLL_RECORDS : "paid"
    PAYROLL_RECORDS ||--o{ PAYROLL_ITEMS : "details items"
    PAYROLL_RECORDS {
        uuid id PK
        uuid unit_id FK
        uuid payroll_period_id FK
        uuid employee_id FK
        varchar slip_number UK
        numeric total_earnings
        numeric total_deductions
        numeric net_salary
        varchar payment_status
    }

    PAYROLL_ITEMS {
        uuid id PK
        uuid unit_id FK
        uuid payroll_record_id FK
        varchar component_name
        varchar component_type
        numeric amount
        uuid source_reference_id
    }

    PAYROLL_REVISIONS {
        uuid id PK
        uuid unit_id FK
        uuid payroll_period_id FK
        uuid authorized_by FK
        text reason
        jsonb snapshot_before_revision
    }
```

---

## 8. Domain Armada: Peminjaman Bebas Double-Booking & Inspeksi

```mermaid
erDiagram
    UNITS ||--o{ VEHICLES : "owns"
    UNITS ||--o{ VEHICLE_BORROWING_REQUESTS : "approves"

    VEHICLES ||--o{ VEHICLE_BORROWING_REQUESTS : "booked for (EXCLUSION LOCK)"
    VEHICLES ||--o{ VEHICLE_CONDITION_INSPECTIONS : "inspected"
    VEHICLES ||--o{ VEHICLE_DAMAGES : "damaged"
    VEHICLES ||--o{ VEHICLE_FUEL_LOGS : "refueled"
    VEHICLES {
        uuid id PK
        uuid unit_id FK
        varchar name
        varchar vehicle_type
        varchar license_plate UK
        int current_odometer
        varchar status
    }

    VEHICLE_BORROWING_REQUESTS ||--o{ VEHICLE_CONDITION_INSPECTIONS : "accompanied by"
    VEHICLE_BORROWING_REQUESTS ||--o{ VEHICLE_DAMAGES : "incident in"
    VEHICLE_BORROWING_REQUESTS {
        uuid id PK
        uuid unit_id FK
        uuid vehicle_id FK
        varchar booking_code UK
        varchar borrower_name
        varchar borrower_phone
        timestamptz start_time
        timestamptz estimated_return_time
        timestamptz actual_return_time
        varchar status
    }

    VEHICLE_CONDITION_INSPECTIONS {
        uuid id PK
        uuid unit_id FK
        uuid borrowing_request_id FK
        uuid vehicle_id FK
        varchar inspection_type
        int odometer_km
        varchar fuel_level
        uuid inspector_id FK
    }

    VEHICLE_DAMAGES {
        uuid id PK
        uuid unit_id FK
        uuid borrowing_request_id FK
        uuid vehicle_id FK
        text damage_description
        numeric estimated_compensation
        boolean is_settled
    }

    VEHICLE_FUEL_LOGS {
        uuid id PK
        uuid unit_id FK
        uuid vehicle_id FK
        uuid borrowing_request_id FK
        date fill_date
        numeric liters
        numeric total_cost
    }
```

---

## 9. Domain Sistem: Observability, Notifikasi, Token & Dokumen

```mermaid
erDiagram
    UNITS ||--o{ AUDIT_LOGS : "audits"
    UNITS ||--o{ ACTIVITY_LOGS : "logs activity"
    UNITS ||--o{ DOCUMENT_SEQUENCES : "sequences"
    UNITS ||--o{ SYSTEM_NOTIFICATIONS : "alerts"
    UNITS ||--o{ SYSTEM_SETTINGS : "configures"
    UNITS ||--o{ FILE_ATTACHMENTS : "stores"
    UNITS ||--o{ PUBLIC_FORM_TOKENS : "verifies token"

    AUDIT_LOGS {
        bigserial id PK
        uuid unit_id FK
        uuid actor_id FK
        varchar action
        varchar table_name
        varchar record_id
        jsonb old_data
        jsonb new_data
        timestamptz created_at
    }

    DOCUMENT_SEQUENCES {
        uuid id PK
        uuid unit_id FK
        varchar doc_type
        varchar period_key
        int current_value
        varchar format_template
    }

    SYSTEM_NOTIFICATIONS {
        uuid id PK
        uuid unit_id FK
        uuid recipient_user_id FK
        varchar title
        text message
        boolean is_read
    }

    PUBLIC_FORM_TOKENS {
        uuid id PK
        uuid unit_id FK
        varchar form_type
        varchar token_hash UK
        timestamptz expires_at
        boolean is_consumed
    }

    FILE_ATTACHMENTS {
        uuid id PK
        uuid unit_id FK
        varchar bucket_name
        text storage_path
        varchar original_filename
        boolean is_private
    }
```

---

## 10. Matriks Kardinalitas & Kepatuhan Integritas v3.1.0

| Pasangan Relasi | Kardinalitas | Foreign Key di Schema | Proteksi Integritas Multi-Unit |
|---|:---:|---|---|
| `organizations` -> `units` | 1 to N | `departments.unit_id -> units.id` | Partisi departemen berbasis unit. |
| `units` -> `departments` | 1 to N | `departments.unit_id -> units.id` | Partisi departemen berbasis unit. |
| `units` -> `positions` | 1 to N | `positions.unit_id -> units.id` | Partisi jabatan berbasis unit. |
| `units` -> `work_schedules` | 1 to N | `work_schedules.unit_id -> units.id` | Shift kerja berbasis unit. |
| `departments` -> `employees` | 1 to N | `employees(unit_id, department_id) -> departments(unit_id, id)` | **Composite FK**: Karyawan terkunci di departemen unitnya. |
| `positions` -> `employees` | 1 to N | `employees(unit_id, position_id) -> positions(unit_id, id)` | **Composite FK**: Karyawan terkunci di jabatan unitnya. |
| `work_schedules` -> `employees` | 1 to N | `employees(unit_id, work_schedule_id) -> work_schedules(unit_id, id)` | **Composite FK**: Jadwal kerja karyawan sesuai unitnya. |
| `employees` -> `employee_sensitive_data` | 1 to 1 | `employee_sensitive_data(unit_id, employee_id) -> employees(unit_id, id)` | Pemisahan data NIK & Bank dari tabel publik. |
| `employees` -> `employee_portal_auth` | 1 to 1 | `employee_portal_auth(unit_id, employee_id) -> employees(unit_id, id)` | Pemisahan PIN mandiri dengan proteksi brute-force. |
| `employees` -> `leave_requests` | 1 to N | `leave_requests(unit_id, employee_id) -> employees(unit_id, id)` | **Composite FK**: Cuti terikat karyawan dan unitnya. |
| `leave_requests` -> `leave_conflict_slots` | 1 to N | `leave_conflict_slots(unit_id, leave_request_id) -> leave_requests(unit_id, id)` | Dynamic Slot Lock dengan partial unique index. |
| `glass_types` -> `glass_tips` | 1 to N | `glass_tips(unit_id, glass_type_id) -> glass_types(unit_id, id)` | **Composite FK**: Kaca terpotong sesuai stok unit. |
| `glass_tips` -> `payroll_periods` | N to 1 | `glass_tips(unit_id, payroll_period_id) -> payroll_periods(unit_id, id)` | **Composite FK**: Pengikatan tip ke periode payroll final. |
| `vehicles` -> `vehicle_borrowing_requests` | 1 to N | `vehicle_borrowing_requests(unit_id, vehicle_id) -> vehicles(unit_id, id)` | **Exclusion Constraint**: Anti-Double Booking mutlak. |
| `vehicle_borrowing_requests` -> `vehicle_fuel_logs` | 1 to N | `vehicle_fuel_logs(unit_id, borrowing_request_id) -> vehicle_borrowing_requests(unit_id, id)` | **Composite FK**: Asosiasi konsumsi BBM dengan booking. |
| `payroll_periods` -> `payroll_records` | 1 to N | `payroll_records(unit_id, payroll_period_id) -> payroll_periods(unit_id, id)` | **Composite FK** & Trigger pengunci status FINALIZED. |
| `payroll_records` -> `payroll_items` | 1 to N | `payroll_items(unit_id, payroll_record_id) -> payroll_records(unit_id, id)` | Rincian komponen gaji dalam slip terfinalisasi. |
