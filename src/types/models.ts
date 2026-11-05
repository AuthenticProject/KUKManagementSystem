// ============================================================================
// KUK MANAGEMENT SYSTEM v3.1.0 - CORE DOMAIN MODELS
// Aligned strictly with PostgreSQL schema: 20261104000001_core_schema_v3_1_0.sql
// ============================================================================

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'RESIGNED' | 'RETIRED';
export type EmploymentType = 'PKWT' | 'PKWTT' | 'PROBATION' | 'INTERN';
export type Gender = 'L' | 'P';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type WarningLevel = 'NONE' | 'ORAL_WARNING' | 'SP1' | 'SP2' | 'SP3' | 'TERMINATION_EVALUATION';
export type WarningApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type AttendanceStatus = 'PRESENT' | 'PERMIT' | 'SICK' | 'LATE' | 'ABSENT';
export type AttendanceSource = 'FINGERPRINT' | 'BRIEFING' | 'MANUAL_ADJUSTMENT';

export type GlassTipStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'CANCELLED';
export type TipRoundingRule = 'EXACT' | 'ROUND_UP_100' | 'ROUND_UP_500' | 'ROUND_UP_1000';
export type TipCalculationMethod = 'PER_SQM' | 'PER_PIECE' | 'SIZE_RANGE' | 'HYBRID';

export type PayrollStatus = 'DRAFT' | 'CALCULATED' | 'FINALIZED' | 'PAID' | 'CANCELLED';
export type SalaryComponentType = 'ALLOWANCE' | 'DEDUCTION' | 'BENEFIT' | 'BONUS';
export type PaymentStatus = 'PENDING_PAYMENT' | 'PROCESSED' | 'PAID';

export type VehicleStatus = 'AVAILABLE' | 'BORROWED' | 'MAINTENANCE' | 'DECOMMISSIONED';
export type BorrowingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_USE' | 'RETURNED' | 'CANCELLED';
export type VehicleFuelLevel = 'EMPTY' | 'QUARTER' | 'HALF' | 'THREE_QUARTERS' | 'FULL';

// ----------------------------------------------------------------------------
// 1. Employee Master Models
// ----------------------------------------------------------------------------
export interface Department {
  id: string;
  unit_id: string;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Position {
  id: string;
  unit_id: string;
  department_id: string;
  code: string;
  title: string;
  level: number;
  allowed_leave_days_of_week?: number[] | null;
  is_active: boolean;
  created_at: string;
  department?: Department;
}

export interface WorkSchedule {
  id: string;
  unit_id: string;
  name: string;
  start_time: string;
  end_time: string;
  late_tolerance_minutes: number;
  is_active: boolean;
}

export interface Employee {
  id: string;
  unit_id: string;
  department_id: string;
  position_id: string;
  work_schedule_id: string;
  employee_code: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  gender: Gender;
  marital_status: MaritalStatus;
  status: EmployeeStatus;
  employment_type: EmploymentType;
  join_date: string;
  resign_date?: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
  position?: Position;
  work_schedule?: WorkSchedule;
}

export interface EmployeeSensitiveData {
  id: string;
  unit_id: string;
  employee_id: string;
  nik: string;
  npwp?: string | null;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  bpjs_ketenagakerjaan?: string | null;
  bpjs_kesehatan?: string | null;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// 2. Leave Management Models
// ----------------------------------------------------------------------------
export interface LeavePolicy {
  id: string;
  unit_id: string;
  max_days_per_month: number;
  submission_open_day: number;
  submission_close_day: number;
  is_active: boolean;
}

export interface LeaveRequest {
  id: string;
  unit_id: string;
  employee_id: string;
  request_number: string;
  target_month: string;
  total_days: number;
  snapshot_employee_name: string;
  snapshot_department_name: string;
  snapshot_position_title: string;
  reason: string;
  status: LeaveStatus;
  auto_approved: boolean;
  approved_by?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  dates?: LeaveRequestDate[];
}

export interface LeaveRequestDate {
  id: string;
  unit_id: string;
  leave_request_id: string;
  leave_date: string;
  is_sunday: boolean;
}

// ----------------------------------------------------------------------------
// 3. Violation & Warning Letter Models
// ----------------------------------------------------------------------------
export interface ViolationType {
  id: string;
  unit_id: string;
  code: string;
  name: string;
  points: number;
  description?: string | null;
  is_active: boolean;
}

export interface ViolationRecord {
  id: string;
  unit_id: string;
  employee_id: string;
  violation_type_id: string;
  incident_date: string;
  description: string;
  points_assigned: number;
  recorded_by: string;
  created_at: string;
  employee?: Employee;
  violation_type?: ViolationType;
}

export interface WarningLetter {
  id: string;
  unit_id: string;
  employee_id: string;
  letter_number: string;
  level: WarningLevel;
  issued_date: string;
  valid_until: string;
  reason: string;
  approval_status: WarningApprovalStatus;
  issued_by: string;
  created_at: string;
  employee?: Employee;
}

// ----------------------------------------------------------------------------
// 4. Attendance & Briefing Models
// ----------------------------------------------------------------------------
export interface BriefingSession {
  id: string;
  unit_id: string;
  session_date: string;
  session_time: string;
  topic: string;
  speaker_name: string;
  total_attendees: number;
  created_at: string;
}

export interface BriefingAttendance {
  id: string;
  unit_id: string;
  briefing_session_id: string;
  employee_id: string;
  attended_at: string;
  notes?: string | null;
  employee?: Employee;
}

export interface AttendanceDailyRecord {
  id: string;
  unit_id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  status: AttendanceStatus;
  source: AttendanceSource;
  late_minutes: number;
  notes?: string | null;
  employee?: Employee;
}

// ----------------------------------------------------------------------------
// 5. Glass Tip Models
// ----------------------------------------------------------------------------
export interface GlassType {
  id: string;
  unit_id: string;
  code: string;
  name: string;
  thickness_mm: number;
  is_active: boolean;
}

export interface GlassTipRate {
  id: string;
  unit_id: string;
  name: string;
  calculation_method: TipCalculationMethod;
  default_percentage: number;
  rounding_rule: TipRoundingRule;
  is_active: boolean;
}

export interface GlassTip {
  id: string;
  unit_id: string;
  reference_code: string;
  employee_id: string;
  glass_type_id: string;
  rate_id?: string | null;
  length_cm: number;
  height_cm: number;
  quantity: number;
  calculated_sqm: number;
  glass_price_snapshot: number;
  tip_percentage_snapshot: number;
  rounding_rule: TipRoundingRule;
  tip_amount: number;
  verified_amount?: number | null;
  status: GlassTipStatus;
  payroll_period_id?: string | null;
  notes?: string | null;
  created_at: string;
  employee?: Employee;
  glass_type?: GlassType;
}

// ----------------------------------------------------------------------------
// 6. Payroll Models
// ----------------------------------------------------------------------------
export interface SalaryComponent {
  id: string;
  unit_id: string;
  code: string;
  name: string;
  component_type: SalaryComponentType;
  is_taxable: boolean;
  is_active: boolean;
}

export interface EmployeeSalaryStructure {
  id: string;
  unit_id: string;
  employee_id: string;
  base_salary: number;
  effective_date: string;
  is_active: boolean;
  employee?: Employee;
}

export interface PayrollPeriod {
  id: string;
  unit_id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  payout_date: string;
  status: PayrollStatus;
  total_net_payout: number;
  finalized_at?: string | null;
  finalized_by?: string | null;
  created_at: string;
}

export interface PayrollRecord {
  id: string;
  unit_id: string;
  payroll_period_id: string;
  employee_id: string;
  slip_number: string;
  snapshot_employee_name: string;
  snapshot_department_name: string;
  snapshot_position_title: string;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  payment_status: PaymentStatus;
  created_at: string;
  items?: PayrollItem[];
}

export interface PayrollItem {
  id: string;
  unit_id: string;
  payroll_record_id: string;
  component_name: string;
  component_type: SalaryComponentType;
  amount: number;
}

// ----------------------------------------------------------------------------
// 7. Fleet Management Models
// ----------------------------------------------------------------------------
export interface Vehicle {
  id: string;
  unit_id: string;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  type: string;
  status: VehicleStatus;
  is_active: boolean;
  created_at: string;
}

export interface VehicleBorrowingRequest {
  id: string;
  unit_id: string;
  vehicle_id: string;
  booking_code: string;
  borrower_name: string;
  borrower_institution?: string | null;
  borrower_phone: string;
  responsible_person: string;
  start_time: string;
  estimated_return_time: string;
  actual_return_time?: string | null;
  destination: string;
  purpose: string;
  status: BorrowingStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  vehicle?: Vehicle;
}

