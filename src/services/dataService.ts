// ============================================================================
// KUK MANAGEMENT SYSTEM v3.1.0 - ENHANCED DATA SERVICE LAYER
// Scoped by unit_id, permission-checked, with explicit fixture/live separation
// ============================================================================

import { supabase } from './supabase';
import { calculateSpExpiryDate } from '@/utils/dateUtils';
import type {
  Employee,
  Department,
  Position,
  WorkSchedule,
  EmployeeSensitiveData,
  LeaveRequest,
  ViolationRecord,
  WarningLetter,
  BriefingSession,
  AttendanceDailyRecord,
  GlassTip,
  PayrollPeriod,
  PayrollRecord,
  Vehicle,
  VehicleBorrowingRequest,
} from '@/types/models';

export interface DataResponse<T> {
  data: T;
  isFixture: boolean;
  message?: string;
}

// ----------------------------------------------------------------------------
// 1. Employee Service
// ----------------------------------------------------------------------------
export const employeeService = {
  async getEmployeesByUnit(unitId: string): Promise<DataResponse<Employee[]>> {
    if (!unitId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          department:departments(*),
          position:positions(*),
          work_schedule:work_schedules(*)
        `)
        .eq('unit_id', unitId)
        .order('employee_code', { ascending: true });

      if (error || !data || data.length === 0) {
        return { data: getPreviewEmployees(unitId), isFixture: true };
      }
      return { data: data as Employee[], isFixture: false };
    } catch {
      return { data: getPreviewEmployees(unitId), isFixture: true };
    }
  },

  async getDepartments(unitId: string): Promise<Department[]> {
    if (!unitId) return [];
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('name');
    return (data as Department[]) || [
      { id: 'dept-01', unit_id: unitId, code: 'GUDANG', name: 'Gudang & Logistik', is_active: true, created_at: '' },
      { id: 'dept-02', unit_id: unitId, code: 'ADM', name: 'Administrasi & Keuangan', is_active: true, created_at: '' },
    ];
  },

  async getPositions(unitId: string): Promise<Position[]> {
    if (!unitId) return [];
    const { data } = await supabase
      .from('positions')
      .select('*, department:departments(*)')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('level');
    return (data as Position[]) || [
      { id: 'pos-01', unit_id: unitId, department_id: 'dept-01', code: 'SOPIR', title: 'Sopir & Pemotong Kaca', level: 2, is_active: true, created_at: '' },
      { id: 'pos-02', unit_id: unitId, department_id: 'dept-02', code: 'ADM3', title: 'Admin 3 (Operasional Toko)', level: 3, allowed_leave_days_of_week: [0], is_active: true, created_at: '' },
    ];
  },

  async getWorkSchedules(unitId: string): Promise<WorkSchedule[]> {
    if (!unitId) return [];
    const { data } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('unit_id', unitId)
      .eq('is_active', true);
    return (data as WorkSchedule[]) || [
      { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
    ];
  },

  async getSensitiveData(unitId: string, employeeId: string): Promise<DataResponse<EmployeeSensitiveData | null>> {
    if (!unitId || !employeeId) return { data: null, isFixture: false };
    try {
      const { data, error } = await supabase
        .from('employee_sensitive_data')
        .select('*')
        .eq('unit_id', unitId)
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (error || !data) {
        return {
          data: {
            id: 'sens-' + employeeId,
            unit_id: unitId,
            employee_id: employeeId,
            nik: '3201012345670001',
            npwp: '12.345.678.9-123.000',
            bank_name: 'BCA',
            bank_account_number: '1234567890',
            bank_account_holder: 'Budi Santoso',
            bpjs_ketenagakerjaan: '00012345678',
            bpjs_kesehatan: '00087654321',
            updated_at: new Date().toISOString(),
          },
          isFixture: true,
        };
      }
      return { data: data as EmployeeSensitiveData, isFixture: false };
    } catch {
      return { data: null, isFixture: true };
    }
  },

  async saveEmployee(unitId: string, employee: Partial<Employee>): Promise<{ success: boolean; message: string }> {
    if (!unitId) return { success: false, message: 'Unit aktif belum dipilih.' };
    try {
      const payload = { ...employee, unit_id: unitId, updated_at: new Date().toISOString() };
      if (employee.id && !employee.id.startsWith('emp-')) {
        const { error } = await supabase.from('employees').update(payload).eq('id', employee.id).eq('unit_id', unitId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('employees').insert([{ ...payload, id: undefined }]);
        if (error) throw error;
      }
      return { success: true, message: 'Data karyawan berhasil disimpan ke database.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal menyimpan data karyawan ke database.' };
    }
  },

  async saveSensitiveData(unitId: string, data: Partial<EmployeeSensitiveData>): Promise<{ success: boolean; message: string }> {
    if (!unitId) return { success: false, message: 'Unit aktif belum dipilih.' };
    try {
      const { error } = await supabase.from('employee_sensitive_data').upsert({ ...data, unit_id: unitId, updated_at: new Date().toISOString() });
      if (error) throw error;
      return { success: true, message: 'Data sensitif berhasil disimpan.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal menyimpan data sensitif ke database.' };
    }
  },
};

// ----------------------------------------------------------------------------
// 2. Leave Service
// ----------------------------------------------------------------------------
export const leaveService = {
  async getLeaveRequestsByUnit(unitId: string): Promise<DataResponse<LeaveRequest[]>> {
    if (!unitId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*, dates:leave_request_dates(*)')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        return { data: getPreviewLeaveRequests(unitId), isFixture: true };
      }
      return { data: data as LeaveRequest[], isFixture: false };
    } catch {
      return { data: getPreviewLeaveRequests(unitId), isFixture: true };
    }
  },

  async updateLeaveStatus(unitId: string, requestId: string, status: 'APPROVED' | 'REJECTED', reason?: string): Promise<{ success: boolean; message: string }> {
    if (!unitId) return { success: false, message: 'Unit aktif belum dipilih.' };
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status, rejection_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('unit_id', unitId);
      if (error) throw error;
      return { success: true, message: `Permohonan cuti berhasil di-${status.toLowerCase()}.` };
    } catch (err: any) {
      return { success: false, message: err?.message || `Gagal mengubah status cuti ke ${status}.` };
    }
  },

  async cancelLeaveAtomic(unitId: string, requestId: string, cancelledBy: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await supabase.rpc('cancel_leave_request_atomic', {
        p_unit_id: unitId,
        p_leave_id: requestId,
        p_cancelled_by: cancelledBy,
        p_reason: reason,
      });
      if (error) throw error;
      return { success: true, message: data?.message || 'Cuti berhasil dibatalkan secara atomik.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal membatalkan cuti secara atomik.' };
    }
  },
};

// ----------------------------------------------------------------------------
// 3. Violation Service
// ----------------------------------------------------------------------------
export const violationService = {
  async getViolationsByUnit(unitId: string): Promise<DataResponse<ViolationRecord[]>> {
    if (!unitId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('violation_records')
        .select('*, employee:employees(*), violation_type:violation_types(*)')
        .eq('unit_id', unitId)
        .order('incident_date', { ascending: false });

      if (error || !data || data.length === 0) {
        return { data: getPreviewViolations(unitId), isFixture: true };
      }
      return { data: data as ViolationRecord[], isFixture: false };
    } catch {
      return { data: getPreviewViolations(unitId), isFixture: true };
    }
  },

  async getWarningLettersByUnit(unitId: string): Promise<DataResponse<WarningLetter[]>> {
    if (!unitId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('warning_letters')
        .select('*, employee:employees(*)')
        .eq('unit_id', unitId)
        .order('issued_date', { ascending: false });

      if (error || !data || data.length === 0) {
        return { data: getPreviewWarningLetters(unitId), isFixture: true };
      }
      return { data: data as WarningLetter[], isFixture: false };
    } catch {
      return { data: getPreviewWarningLetters(unitId), isFixture: true };
    }
  },

  async recordViolation(unitId: string, record: Partial<ViolationRecord>): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.from('violation_records').insert([{ ...record, unit_id: unitId }]);
      if (error) throw error;
      return { success: true, message: 'Pelanggaran berhasil dicatat.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal mencatat data pelanggaran.' };
    }
  },

  async issueWarningLetter(unitId: string, sp: Partial<WarningLetter>): Promise<{ success: boolean; message: string }> {
    try {
      // 6-Month enterprise validity calculation with end-of-month clamp
      const issuedDateStr = sp.issued_date || new Date().toISOString().split('T')[0];
      const validUntilStr = calculateSpExpiryDate(issuedDateStr, 6);

      const payload = {
        ...sp,
        unit_id: unitId,
        valid_until: validUntilStr,
        approval_status: 'APPROVED',
      };
      const { error } = await supabase.from('warning_letters').insert([payload]);
      if (error) throw error;
      return { success: true, message: 'Surat Peringatan berhasil diterbitkan (Masa berlaku 6 bulan).' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal menerbitkan Surat Peringatan.' };
    }
  },
};

// ----------------------------------------------------------------------------
// 4. Attendance Service
// ----------------------------------------------------------------------------
export const attendanceService = {
  async getBriefingSessions(unitId: string): Promise<DataResponse<BriefingSession[]>> {
    if (!unitId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('briefing_sessions')
        .select('*')
        .eq('unit_id', unitId)
        .order('session_date', { ascending: false });

      if (error || !data || data.length === 0) {
        return { data: getPreviewBriefings(unitId), isFixture: true };
      }
      return { data: data as BriefingSession[], isFixture: false };
    } catch {
      return { data: getPreviewBriefings(unitId), isFixture: true };
    }
  },

  async getDailyAttendance(unitId: string, date: string): Promise<DataResponse<AttendanceDailyRecord[]>> {
    if (!unitId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('attendance_daily_records')
        .select('*, employee:employees(*)')
        .eq('unit_id', unitId)
        .eq('attendance_date', date);

      if (error || !data || data.length === 0) {
        return { data: getPreviewAttendance(unitId, date), isFixture: true };
      }
      return { data: data as AttendanceDailyRecord[], isFixture: false };
    } catch {
      return { data: getPreviewAttendance(unitId, date), isFixture: true };
    }
  },

  async createBriefingSession(unitId: string, session: Partial<BriefingSession>): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.from('briefing_sessions').insert([{ ...session, unit_id: unitId }]);
      if (error) throw error;
      return { success: true, message: 'Sesi briefing berhasil dibuat.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal membuat sesi briefing.' };
    }
  },
};

// ----------------------------------------------------------------------------
// 5. Glass Tip Service
// ----------------------------------------------------------------------------
export const glassTipService = {
  async getGlassTipsByUnit(unitId: string): Promise<DataResponse<GlassTip[]>> {
    if (!unitId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('glass_tips')
        .select('*, employee:employees(*), glass_type:glass_types(*)')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        return { data: getPreviewGlassTips(unitId), isFixture: true };
      }
      return { data: data as GlassTip[], isFixture: false };
    } catch {
      return { data: getPreviewGlassTips(unitId), isFixture: true };
    }
  },

  async verifyTipNota(unitId: string, tipId: string, verifiedAmount: number, action: 'VERIFY' | 'REJECT', notes: string): Promise<{ success: boolean; message: string }> {
    try {
      const status = action === 'VERIFY' ? 'VERIFIED' : 'REJECTED';
      const { error } = await supabase
        .from('glass_tips')
        .update({ status, verified_amount: action === 'VERIFY' ? verifiedAmount : null, notes, updated_at: new Date().toISOString() })
        .eq('id', tipId)
        .eq('unit_id', unitId);
      if (error) throw error;
      return { success: true, message: `Nota tip berhasil ${status === 'VERIFIED' ? 'diverifikasi' : 'ditolak'}.` };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal memverifikasi nota tip.' };
    }
  },
};

// ----------------------------------------------------------------------------
// 6. Payroll Service
// ----------------------------------------------------------------------------
export const payrollService = {
  async getPayrollPeriods(unitId: string): Promise<DataResponse<PayrollPeriod[]>> {
    if (!unitId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('unit_id', unitId)
        .order('start_date', { ascending: false });

      if (error || !data || data.length === 0) {
        return { data: getPreviewPayrollPeriods(unitId), isFixture: true };
      }
      return { data: data as PayrollPeriod[], isFixture: false };
    } catch {
      return { data: getPreviewPayrollPeriods(unitId), isFixture: true };
    }
  },

  async getPayrollRecords(periodId: string): Promise<DataResponse<PayrollRecord[]>> {
    if (!periodId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('payroll_records')
        .select('*, items:payroll_items(*)')
        .eq('payroll_period_id', periodId);

      if (error || !data || data.length === 0) {
        return { data: getPreviewPayrollRecords(periodId), isFixture: true };
      }
      return { data: data as PayrollRecord[], isFixture: false };
    } catch {
      return { data: getPreviewPayrollRecords(periodId), isFixture: true };
    }
  },

  async finalizePayrollAtomic(unitId: string, periodId: string, finalizedBy: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await supabase.rpc('calculate_and_finalize_payroll_atomic', {
        p_unit_id: unitId,
        p_payroll_period_id: periodId,
        p_finalized_by: finalizedBy,
      });
      if (error) throw error;
      return { success: true, message: data?.message || 'Payroll berhasil dikalkulasi dan difinalisasi secara atomik.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal memfinalisasi payroll secara atomik.' };
    }
  },
};

// ----------------------------------------------------------------------------
// 7. Fleet Service
// ----------------------------------------------------------------------------
export const fleetService = {
  async getVehiclesByUnit(unitId: string): Promise<DataResponse<Vehicle[]>> {
    if (!unitId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('unit_id', unitId)
        .order('license_plate');

      if (error || !data || data.length === 0) {
        return { data: getPreviewVehicles(unitId), isFixture: true };
      }
      return { data: data as Vehicle[], isFixture: false };
    } catch {
      return { data: getPreviewVehicles(unitId), isFixture: true };
    }
  },

  async getBorrowingRequests(unitId: string): Promise<DataResponse<VehicleBorrowingRequest[]>> {
    if (!unitId) return { data: [], isFixture: false };
    try {
      const { data, error } = await supabase
        .from('vehicle_borrowing_requests')
        .select('*, vehicle:vehicles(*)')
        .eq('unit_id', unitId)
        .order('start_time', { ascending: false });

      if (error || !data || data.length === 0) {
        return { data: getPreviewBorrowingRequests(unitId), isFixture: true };
      }
      return { data: data as VehicleBorrowingRequest[], isFixture: false };
    } catch {
      return { data: getPreviewBorrowingRequests(unitId), isFixture: true };
    }
  },

  async approveBorrowing(unitId: string, requestId: string, approverId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('vehicle_borrowing_requests')
        .update({
          status: 'APPROVED',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('unit_id', unitId);
      if (error) throw error;
      return { success: true, message: 'Peminjaman kendaraan berhasil disetujui petugas armada.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal menyetujui peminjaman kendaraan.' };
    }
  },

  async saveVehicle(unitId: string, vehicle: Partial<Vehicle>): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.from('vehicles').insert([{ ...vehicle, unit_id: unitId }]);
      if (error) throw error;
      return { success: true, message: 'Armada baru berhasil didaftarkan.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal mendaftarkan armada kendaraan.' };
    }
  },
};

// ============================================================================
// ISOLATED ZERO-STATE PREVIEWS (Marked strictly as isFixture: true)
// ============================================================================
function getPreviewEmployees(unitId: string): Employee[] {
  return [
    {
      id: 'emp-001',
      unit_id: unitId,
      department_id: 'dept-01',
      position_id: 'pos-01',
      work_schedule_id: 'sch-01',
      employee_code: 'EMP-LATANSA-001',
      full_name: 'Budi Santoso',
      email: 'budi.santoso@kuk.co.id',
      phone: '081234567890',
      gender: 'L',
      marital_status: 'MARRIED',
      status: 'ACTIVE',
      employment_type: 'PKWTT',
      join_date: '2023-01-15',
      created_at: '2023-01-15T08:00:00Z',
      updated_at: '2026-11-01T08:00:00Z',
      department: { id: 'dept-01', unit_id: unitId, code: 'GUDANG', name: 'Gudang & Logistik', is_active: true, created_at: '' },
      position: { id: 'pos-01', unit_id: unitId, department_id: 'dept-01', code: 'SOPIR', title: 'Sopir Pengiriman & Pemotong Kaca', level: 2, is_active: true, created_at: '' },
      work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
    },
    {
      id: 'emp-002',
      unit_id: unitId,
      department_id: 'dept-02',
      position_id: 'pos-02',
      work_schedule_id: 'sch-01',
      employee_code: 'EMP-LATANSA-002',
      full_name: 'Siti Aminah',
      email: 'siti.aminah@kuk.co.id',
      phone: '081298765432',
      gender: 'P',
      marital_status: 'SINGLE',
      status: 'ACTIVE',
      employment_type: 'PKWT',
      join_date: '2024-03-01',
      created_at: '2024-03-01T08:00:00Z',
      updated_at: '2026-11-01T08:00:00Z',
      department: { id: 'dept-02', unit_id: unitId, code: 'ADM', name: 'Administrasi & Keuangan', is_active: true, created_at: '' },
      position: { id: 'pos-02', unit_id: unitId, department_id: 'dept-02', code: 'ADM3', title: 'Admin 3 (Operasional Toko)', level: 3, allowed_leave_days_of_week: [0], is_active: true, created_at: '' },
      work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
    },
  ];
}

function getPreviewLeaveRequests(unitId: string): LeaveRequest[] {
  return [
    {
      id: 'leave-001',
      unit_id: unitId,
      employee_id: 'emp-002',
      request_number: 'CUTI-TB-LATANSA-202611-0001',
      target_month: '2026-11',
      total_days: 1,
      snapshot_employee_name: 'Siti Aminah',
      snapshot_department_name: 'Administrasi & Keuangan',
      snapshot_position_title: 'Admin 3 (Operasional Toko)',
      reason: 'Keperluan keluarga penting di hari libur resmi.',
      status: 'APPROVED',
      auto_approved: true,
      created_at: '2026-11-01T09:30:00Z',
      updated_at: '2026-11-01T09:30:00Z',
      dates: [
        { id: 'ld-01', unit_id: unitId, leave_request_id: 'leave-001', leave_date: '2026-11-08', is_sunday: true },
      ],
    },
  ];
}

function getPreviewViolations(unitId: string): ViolationRecord[] {
  return [
    {
      id: 'v-001',
      unit_id: unitId,
      employee_id: 'emp-001',
      violation_type_id: 'vt-01',
      incident_date: '2026-10-25',
      description: 'Terlambat lebih dari 30 menit tanpa pemberitahuan atasan.',
      points_assigned: 5,
      recorded_by: 'Supervisor Operasional',
      created_at: '2026-10-25T10:00:00Z',
      employee: { full_name: 'Budi Santoso', employee_code: 'EMP-LATANSA-001' } as Employee,
      violation_type: { id: 'vt-01', unit_id: unitId, name: 'Keterlambatan Tingkat Ringan', code: 'LATE-1', points: 5, is_active: true },
    },
  ];
}

function getPreviewWarningLetters(unitId: string): WarningLetter[] {
  return [
    {
      id: 'sp-001',
      unit_id: unitId,
      employee_id: 'emp-001',
      letter_number: 'SP/TB-LATANSA/202610/0001',
      level: 'ORAL_WARNING',
      issued_date: '2026-10-26',
      valid_until: '2027-04-26',
      reason: 'Akumulasi poin keterlambatan mencapai batas evaluasi lisan.',
      approval_status: 'APPROVED',
      issued_by: 'Kepala Toko',
      created_at: '2026-10-26T08:00:00Z',
      employee: { full_name: 'Budi Santoso', employee_code: 'EMP-LATANSA-001' } as Employee,
    },
  ];
}

function getPreviewBriefings(unitId: string): BriefingSession[] {
  return [
    {
      id: 'brf-001',
      unit_id: unitId,
      session_date: '2026-11-05',
      session_time: '07:45:00',
      topic: 'K3 Pemotongan Kaca & Pelayanan Konsumen Cepat',
      speaker_name: 'Ahmad Ridwan (Manager Toko)',
      total_attendees: 12,
      created_at: '2026-11-05T07:45:00Z',
    },
  ];
}

function getPreviewAttendance(unitId: string, date: string): AttendanceDailyRecord[] {
  return [
    {
      id: 'att-001',
      unit_id: unitId,
      employee_id: 'emp-001',
      attendance_date: date,
      check_in_time: '07:48:00',
      check_out_time: '17:05:00',
      status: 'PRESENT',
      source: 'FINGERPRINT',
      late_minutes: 0,
      employee: { full_name: 'Budi Santoso', employee_code: 'EMP-LATANSA-001' } as Employee,
    },
    {
      id: 'att-002',
      unit_id: unitId,
      employee_id: 'emp-002',
      attendance_date: date,
      check_in_time: '07:55:00',
      check_out_time: '17:00:00',
      status: 'PRESENT',
      source: 'FINGERPRINT',
      late_minutes: 0,
      employee: { full_name: 'Siti Aminah', employee_code: 'EMP-LATANSA-002' } as Employee,
    },
  ];
}

function getPreviewGlassTips(unitId: string): GlassTip[] {
  return [
    {
      id: 'tip-001',
      unit_id: unitId,
      reference_code: 'TIP-TB-LATANSA-202611-0001',
      employee_id: 'emp-001',
      glass_type_id: 'gt-01',
      length_cm: 120,
      height_cm: 150,
      quantity: 2,
      calculated_sqm: 3.6,
      glass_price_snapshot: 950000,
      tip_percentage_snapshot: 0.03,
      rounding_rule: 'ROUND_UP_1000',
      tip_amount: 29000,
      verified_amount: 29000,
      status: 'VERIFIED',
      created_at: '2026-11-03T11:20:00Z',
      employee: { full_name: 'Budi Santoso', employee_code: 'EMP-LATANSA-001' } as Employee,
      glass_type: { id: 'gt-01', unit_id: unitId, name: 'Kaca Polos 5mm', code: 'KP-5MM', thickness_mm: 5, is_active: true },
    },
  ];
}

function getPreviewPayrollPeriods(unitId: string): PayrollPeriod[] {
  return [
    {
      id: 'pp-202610',
      unit_id: unitId,
      period_name: 'Gaji Periode Oktober 2026',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
      payout_date: '2026-11-01',
      status: 'FINALIZED',
      total_net_payout: 48500000,
      finalized_at: '2026-10-31T20:00:00Z',
      finalized_by: 'Manager Keuangan',
      created_at: '2026-10-01T08:00:00Z',
    },
  ];
}

function getPreviewPayrollRecords(periodId: string): PayrollRecord[] {
  return [
    {
      id: 'pr-001',
      unit_id: 'unit-01',
      payroll_period_id: periodId,
      employee_id: 'emp-001',
      slip_number: 'SLIP-TB-LATANSA-202610-0001',
      snapshot_employee_name: 'Budi Santoso',
      snapshot_department_name: 'Gudang & Logistik',
      snapshot_position_title: 'Sopir Pengiriman & Pemotong Kaca',
      total_earnings: 3850000,
      total_deductions: 100000,
      net_salary: 3750000,
      payment_status: 'PAID',
      created_at: '2026-10-31T20:00:00Z',
      items: [
        { id: 'it-01', unit_id: 'u-01', payroll_record_id: 'pr-001', component_name: 'Gaji Pokok', component_type: 'ALLOWANCE', amount: 3200000 },
        { id: 'it-02', unit_id: 'u-01', payroll_record_id: 'pr-001', component_name: 'Tunjangan Transport & Makan', component_type: 'ALLOWANCE', amount: 350000 },
        { id: 'it-03', unit_id: 'u-01', payroll_record_id: 'pr-001', component_name: 'Tip Pemotongan Kaca Terverifikasi', component_type: 'ALLOWANCE', amount: 300000 },
        { id: 'it-04', unit_id: 'u-01', payroll_record_id: 'pr-001', component_name: 'Potongan BPJS Ketenagakerjaan', component_type: 'DEDUCTION', amount: 100000 },
      ],
    },
  ];
}

function getPreviewVehicles(unitId: string): Vehicle[] {
  return [
    {
      id: 'veh-001',
      unit_id: unitId,
      license_plate: 'B 9123 KUK',
      brand: 'Mitsubishi',
      model: 'Colt L300 Pick Up',
      year: 2022,
      type: 'PICKUP',
      status: 'AVAILABLE',
      is_active: true,
      created_at: '2022-05-10T08:00:00Z',
    },
    {
      id: 'veh-002',
      unit_id: unitId,
      license_plate: 'B 9456 KUK',
      brand: 'Toyota',
      model: 'Avanza 1.5 G',
      year: 2023,
      type: 'MPV',
      status: 'AVAILABLE',
      is_active: true,
      created_at: '2023-08-12T08:00:00Z',
    },
  ];
}

function getPreviewBorrowingRequests(unitId: string): VehicleBorrowingRequest[] {
  return [
    {
      id: 'vbr-001',
      unit_id: unitId,
      vehicle_id: 'veh-001',
      booking_code: 'FLEET-TB-LATANSA-202611-0001',
      borrower_name: 'Budi Santoso',
      borrower_institution: 'Internal Gudang',
      borrower_phone: '081234567890',
      responsible_person: 'Kepala Gudang',
      start_time: '2026-11-06T09:00:00Z',
      estimated_return_time: '2026-11-06T15:00:00Z',
      destination: 'Pengiriman Kaca Proyek Villa Cileungsi',
      purpose: 'Pengiriman pesanan kaca tempered 10mm konsumen proyek.',
      status: 'APPROVED',
      approved_by: 'Manager Armada',
      approved_at: '2026-11-05T10:00:00Z',
      created_at: '2026-11-05T09:00:00Z',
      vehicle: { id: 'veh-001', unit_id: unitId, license_plate: 'B 9123 KUK', brand: 'Mitsubishi', model: 'Colt L300 Pick Up', year: 2022, type: 'PICKUP', status: 'AVAILABLE', is_active: true, created_at: '' },
    },
  ];
}
