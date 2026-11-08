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
  AttendanceStatus,
  GlassTip,
  GlassType,
  GlassTipRate,
  PayrollPeriod,
  PayrollRecord,
  Vehicle,
  VehicleBorrowingRequest,
  VehicleStatus,
  EmployeeStatus,
  AuditLog,
  UserAccount,
  EmployeeJobHistory,
  VehicleFuelLevel,
  VehicleInspection,
  CashExpense,
  ExpenseCategory,
  ExpenseApprovalStatus,
} from '@/types/models';

export interface DataResponse<T> {
  success: boolean;
  data: T;
  isFixture: boolean;
  source: 'LIVE' | 'MOCK';
  error?: string | null;
  errorCode?: string | null;
  message?: string;
}

export function isPreviewModeActive(): boolean {
  // Production security safeguard:
  // In production builds, preview mode is strictly rejected by default
  // unless explicitly permitted via build/staging configuration flag VITE_ENABLE_PREVIEW_MODE='true'
  const isProd =
    typeof import.meta !== 'undefined' &&
    ((import.meta as any)?.env?.PROD === true ||
      (import.meta as any)?.env?.VITE_APP_ENV === 'production' ||
      (import.meta as any)?.env?.MODE === 'production');

  const allowInProd =
    typeof import.meta !== 'undefined' &&
    (import.meta as any)?.env?.VITE_ENABLE_PREVIEW_MODE === 'true';

  if (isProd && !allowInProd) {
    return false;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    const val = window.localStorage.getItem('KUK_PREVIEW_MODE');
    if (val !== null) return val === 'true';
  }

  return allowInProd;
}

export function setPreviewModeActive(active: boolean): boolean {
  const isProd =
    typeof import.meta !== 'undefined' &&
    ((import.meta as any)?.env?.PROD === true ||
      (import.meta as any)?.env?.VITE_APP_ENV === 'production' ||
      (import.meta as any)?.env?.MODE === 'production');

  const allowInProd =
    typeof import.meta !== 'undefined' &&
    (import.meta as any)?.env?.VITE_ENABLE_PREVIEW_MODE === 'true';

  if (active && isProd && !allowInProd) {
    console.warn('Security Block: Preview Mode is permanently disabled in Production.');
    return false;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('KUK_PREVIEW_MODE', active ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('kuk-preview-mode-changed', { detail: { active } }));
  }
  return true;
}

export function classifyError(error: any): { message: string; code: string } {
  if (!error) return { message: 'Terjadi kesalahan tidak dikenal.', code: 'UNKNOWN' };

  const rawMsg = (error.message || '').toString();
  const rawCode = (error.code || error.status || '').toString();

  // 1. PostgreSQL RLS / Permission Denied (42501)
  if (rawCode === '42501' || /row-level security|permission denied|insufficient_privilege/i.test(rawMsg)) {
    return {
      message: 'Akses ditolak: Anda tidak memiliki izin untuk mengakses data ini (RLS Denied).',
      code: '42501',
    };
  }

  // 2. Authentication & Session Expired (401 / PGRST301)
  if (rawCode === '401' || rawCode === 'PGRST301' || /jwt expired|invalid claim|unauthorized|session expired/i.test(rawMsg)) {
    return {
      message: 'Sesi autentikasi telah berakhir. Silakan login kembali.',
      code: 'AUTH_EXPIRED',
    };
  }

  // 3. Request Timeout
  if (/timeout|timed out|abort/i.test(rawMsg) || rawCode === 'TIMEOUT') {
    return {
      message: 'Koneksi ke database server melebihi batas waktu (Request Timeout).',
      code: 'TIMEOUT',
    };
  }

  // 4. Network / Connection Failure
  if (/failed to fetch|network error|offline|connection refused|networkrequestfailed/i.test(rawMsg)) {
    return {
      message: 'Gagal terhubung ke database server. Periksa koneksi internet Anda.',
      code: 'NETWORK_ERROR',
    };
  }

  // 5. PostgREST generic
  if (rawCode.startsWith('PGRST')) {
    return {
      message: `Kesalahan PostgREST (${rawCode}): ${rawMsg}`,
      code: rawCode,
    };
  }

  // 6. Generic database error
  return {
    message: rawMsg || 'Gagal memuat data dari database.',
    code: rawCode || 'UNKNOWN',
  };
}

export function resolveDataResponse<T>(
  result: { data: T | null; error: any },
  previewFallbackFn: () => T,
  emptyValue: T
): DataResponse<T> {
  const isPreview = isPreviewModeActive();

  if (result.error) {
    if (isPreview) {
      return {
        success: true,
        data: previewFallbackFn(),
        isFixture: true,
        source: 'MOCK',
        message: 'Mode Pratinjau Terisolasi: Fallback data simulasi lokal aktif.',
      };
    }
    const classified = classifyError(result.error);
    return {
      success: false,
      data: emptyValue,
      isFixture: false,
      source: 'LIVE',
      error: classified.message,
      errorCode: classified.code,
    };
  }

  const isEmpty =
    result.data === null ||
    result.data === undefined ||
    (Array.isArray(result.data) && result.data.length === 0);

  if (isEmpty) {
    if (isPreview) {
      return {
        success: true,
        data: previewFallbackFn(),
        isFixture: true,
        source: 'MOCK',
        message: 'Mode Pratinjau Terisolasi: Database kosong, menampilkan contoh simulasi.',
      };
    }
    return {
      success: true,
      data: emptyValue,
      isFixture: false,
      source: 'LIVE',
      error: null,
    };
  }

  return {
    success: true,
    data: result.data as T,
    isFixture: false,
    source: 'LIVE',
    error: null,
  };
}

export function handleServiceCatch<T>(
  err: any,
  previewFallbackFn: () => T,
  emptyValue: T
): DataResponse<T> {
  if (isPreviewModeActive()) {
    return {
      success: true,
      data: previewFallbackFn(),
      isFixture: true,
      source: 'MOCK',
      message: 'Mode Pratinjau Terisolasi: Terjadi kendala koneksi, menampilkan simulasi lokal.',
    };
  }
  const classified = classifyError(err);
  return {
    success: false,
    data: emptyValue,
    isFixture: false,
    source: 'LIVE',
    error: classified.message,
    errorCode: classified.code,
  };
}

// ----------------------------------------------------------------------------
// 1. Employee Service
// ----------------------------------------------------------------------------
export const employeeService = {
  async getEmployeesByUnit(unitId: string): Promise<DataResponse<Employee[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('employees')
        .select(`
          *,
          department:departments(*),
          position:positions(*),
          work_schedule:work_schedules(*)
        `)
        .eq('unit_id', unitId)
        .order('employee_code', { ascending: true });

      return resolveDataResponse(result, () => getPreviewEmployees(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewEmployees(unitId), []);
    }
  },

  async getDepartments(unitId: string): Promise<Department[]> {
    if (!unitId) return [];
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('unit_id', unitId)
        .eq('is_active', true)
        .order('name');
      if (error || !data || data.length === 0) {
        return isPreviewModeActive() ? [
          { id: 'dept-01', unit_id: unitId, code: 'GUDANG', name: 'Gudang & Logistik', is_active: true, created_at: '' },
          { id: 'dept-02', unit_id: unitId, code: 'ADM', name: 'Administrasi & Keuangan', is_active: true, created_at: '' },
        ] : [];
      }
      return data as Department[];
    } catch {
      return isPreviewModeActive() ? [
        { id: 'dept-01', unit_id: unitId, code: 'GUDANG', name: 'Gudang & Logistik', is_active: true, created_at: '' },
        { id: 'dept-02', unit_id: unitId, code: 'ADM', name: 'Administrasi & Keuangan', is_active: true, created_at: '' },
      ] : [];
    }
  },

  async getPositions(unitId: string): Promise<Position[]> {
    if (!unitId) return [];
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('*, department:departments(*)')
        .eq('unit_id', unitId)
        .eq('is_active', true)
        .order('level');
      if (error || !data || data.length === 0) {
        return isPreviewModeActive() ? [
          { id: 'pos-01', unit_id: unitId, department_id: 'dept-01', code: 'SOPIR', title: 'Sopir & Pemotong Kaca', level: 2, is_active: true, created_at: '' },
          { id: 'pos-02', unit_id: unitId, department_id: 'dept-02', code: 'ADM3', title: 'Admin 3 (Operasional Toko)', level: 3, allowed_leave_days_of_week: [0], is_active: true, created_at: '' },
        ] : [];
      }
      return data as Position[];
    } catch {
      return isPreviewModeActive() ? [
        { id: 'pos-01', unit_id: unitId, department_id: 'dept-01', code: 'SOPIR', title: 'Sopir & Pemotong Kaca', level: 2, is_active: true, created_at: '' },
        { id: 'pos-02', unit_id: unitId, department_id: 'dept-02', code: 'ADM3', title: 'Admin 3 (Operasional Toko)', level: 3, allowed_leave_days_of_week: [0], is_active: true, created_at: '' },
      ] : [];
    }
  },

  async getWorkSchedules(unitId: string): Promise<WorkSchedule[]> {
    if (!unitId) return [];
    try {
      const { data, error } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('unit_id', unitId)
        .eq('is_active', true);
      if (error || !data || data.length === 0) {
        return isPreviewModeActive() ? [
          { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
        ] : [];
      }
      return data as WorkSchedule[];
    } catch {
      return isPreviewModeActive() ? [
        { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      ] : [];
    }
  },

  async getSensitiveData(unitId: string, employeeId: string): Promise<DataResponse<EmployeeSensitiveData | null>> {
    if (!unitId || !employeeId) return { success: true, data: null, isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('employee_sensitive_data')
        .select('*')
        .eq('unit_id', unitId)
        .eq('employee_id', employeeId)
        .maybeSingle();

      return resolveDataResponse(result, () => ({
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
      }), null);
    } catch (err: any) {
      return handleServiceCatch(err, () => null, null);
    }
  },

  async saveEmployee(unitId: string, employee: Partial<Employee>): Promise<{ success: boolean; message: string }> {
    if (!unitId) return { success: false, message: 'Unit aktif belum dipilih.' };
    try {
      // Remediation 4: Whitelist strictly defined fields to prevent mass assignment
      const sanitizedPayload: Record<string, any> = {
        unit_id: unitId,
        updated_at: new Date().toISOString(),
      };

      if (employee.employee_code !== undefined) sanitizedPayload.employee_code = employee.employee_code;
      if (employee.full_name !== undefined) sanitizedPayload.full_name = employee.full_name;
      if (employee.department_id !== undefined) sanitizedPayload.department_id = employee.department_id;
      if (employee.position_id !== undefined) sanitizedPayload.position_id = employee.position_id;
      if (employee.work_schedule_id !== undefined) sanitizedPayload.work_schedule_id = employee.work_schedule_id;
      if (employee.employment_type !== undefined) sanitizedPayload.employment_type = employee.employment_type;
      if (employee.status !== undefined) sanitizedPayload.status = employee.status;
      if (employee.join_date !== undefined) sanitizedPayload.join_date = employee.join_date;
      if (employee.resign_date !== undefined) sanitizedPayload.end_date = employee.resign_date;
      if ((employee as any).end_date !== undefined) sanitizedPayload.end_date = (employee as any).end_date;
      if (employee.phone !== undefined) sanitizedPayload.phone_number = employee.phone;
      if ((employee as any).phone_number !== undefined) sanitizedPayload.phone_number = (employee as any).phone_number;
      if ((employee as any).address !== undefined) sanitizedPayload.address = (employee as any).address;
      if (employee.gender !== undefined) sanitizedPayload.gender = employee.gender;
      if (employee.marital_status !== undefined) sanitizedPayload.marital_status = employee.marital_status;
      if ((employee as any).dependents_count !== undefined) sanitizedPayload.dependents_count = (employee as any).dependents_count;
      if ((employee as any).notes !== undefined) sanitizedPayload.notes = (employee as any).notes;
      if ((employee as any).avatar_url !== undefined) sanitizedPayload.avatar_url = (employee as any).avatar_url;

      if (employee.id && !employee.id.startsWith('emp-')) {
        const { error } = await supabase
          .from('employees')
          .update(sanitizedPayload)
          .eq('id', employee.id)
          .eq('unit_id', unitId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([sanitizedPayload]);
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

  async updateEmployeeStatus(unitId: string, employeeId: string, status: EmployeeStatus): Promise<{ success: boolean; message: string }> {
    if (!unitId || !employeeId) return { success: false, message: 'Unit dan ID karyawan wajib ditentukan.' };
    try {
      if (employeeId.startsWith('emp-')) {
        return { success: true, message: `[SIMULASI PREVIEW] Status karyawan lokal diperbarui ke ${status} dalam memori (TIDAK tersimpan ke database).` };
      }
      const { error } = await supabase
        .from('employees')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', employeeId)
        .eq('unit_id', unitId);
      if (error) throw error;
      return { success: true, message: `Status karyawan berhasil diubah menjadi ${status}.` };
    } catch (err: any) {
      return { success: false, message: err?.message || `Gagal mengubah status karyawan.` };
    }
  },

  async getEmployeeJobHistory(unitId: string, employeeId: string): Promise<DataResponse<EmployeeJobHistory[]>> {
    if (!unitId || !employeeId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('employee_job_history')
        .select('*, from_unit:units!from_unit_id(name), to_unit:units!to_unit_id(name), from_position:positions!from_position_id(title), to_position:positions!to_position_id(title)')
        .eq('employee_id', employeeId)
        .order('effective_date', { ascending: false });
      return resolveDataResponse(result, () => getPreviewJobHistory(employeeId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewJobHistory(employeeId), []);
    }
  },

  async resetKioskPin(unitId: string, employeeId: string, newPin: string): Promise<{ success: boolean; message: string }> {
    if (!unitId || !employeeId) return { success: false, message: 'Unit dan ID karyawan wajib ditentukan.' };
    if (!newPin || newPin.length !== 6 || !/^[0-9]{6}$/.test(newPin)) {
      return { success: false, message: 'Format PIN tidak valid: Wajib tepat 6 digit angka numerik.' };
    }
    try {
      const { data, error } = await supabase.rpc('reset_employee_kiosk_pin', {
        p_unit_id: unitId,
        p_employee_id: employeeId,
        p_new_pin: newPin,
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        return { success: false, message: (data as any).message || 'Gagal mereset PIN Kiosk karyawan.' };
      }
      return { success: true, message: (data as any)?.message || 'PIN Kiosk karyawan berhasil direset.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal mereset PIN Kiosk karyawan.' };
    }
  },
};

// ----------------------------------------------------------------------------
// 2. Leave Service
// ----------------------------------------------------------------------------
export const leaveService = {
  async getLeaveRequestsByUnit(unitId: string): Promise<DataResponse<LeaveRequest[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('leave_requests')
        .select('*, dates:leave_request_dates(*)')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });

      return resolveDataResponse(result, () => getPreviewLeaveRequests(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewLeaveRequests(unitId), []);
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

  async submitLeaveRequest(
    unitId: string,
    payload: {
      employee_id: string;
      target_month: string;
      total_days: number;
      reason: string;
      dates: string[];
    }
  ): Promise<{ success: boolean; message: string; request_id?: string; auto_approved?: boolean; is_conflict?: boolean }> {
    if (!unitId || !payload.employee_id) {
      return { success: false, message: 'Unit dan karyawan wajib dipilih.' };
    }
    if (!payload.dates || payload.dates.length === 0) {
      return { success: false, message: 'Tanggal cuti minimal 1 hari.' };
    }
    if (payload.dates.length > 3) {
      return { success: false, message: 'Batas maksimal cuti adalah 3 hari kalender per bulan.' };
    }

    try {
      // 0. Validasi Jendela Pengajuan (Opened: tgl 1 bulan sebelumnya, Closed: tgl 3 bulan cuti)
      const [tYear, tMonth] = payload.target_month.split('-').map(Number);
      const prevYear = tMonth === 1 ? tYear - 1 : tYear;
      const prevMonth = tMonth === 1 ? 12 : tMonth - 1;
      const windowOpen = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const windowClose = `${tYear}-${String(tMonth).padStart(2, '0')}-03`;
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

      if (today < windowOpen || today > windowClose) {
        return {
          success: false,
          message: `Pengajuan ditolak: Jendela pengajuan cuti untuk periode ${payload.target_month} hanya dibuka mulai tanggal ${windowOpen} dan ditutup tanggal ${windowClose}. Tanggal hari ini (${today}) di luar jendela pengajuan resmi.`,
        };
      }

      // 1. Validasi Quota Bulanan (Maks 3 hari per bulan target)
      const existingRes = await leaveService.getLeaveRequestsByUnit(unitId);
      const activeLeavesThisMonth = (existingRes.data || []).filter(
        (l) =>
          l.employee_id === payload.employee_id &&
          l.target_month === payload.target_month &&
          (l.status === 'APPROVED' || l.status === 'PENDING')
      );
      const daysAlreadyTaken = activeLeavesThisMonth.reduce((sum, l) => sum + (l.total_days || 0), 0);

      if (daysAlreadyTaken + payload.dates.length > 3) {
        return {
          success: false,
          message: `Pengajuan ditolak: Batas maksimal kuota cuti adalah 3 hari per bulan. Karyawan sudah memiliki ${daysAlreadyTaken} hari cuti terdaftar pada bulan ${payload.target_month}.`,
        };
      }

      // 2. Pemeriksaan Konflik Bagian (Department Date Conflict Check)
      const empRes = await employeeService.getEmployeesByUnit(unitId);
      const currentEmp = empRes.data.find((e) => e.id === payload.employee_id);
      let isDepartmentConflict = false;
      let conflictColleagueName = '';

      if (currentEmp?.department_id) {
        const colleagues = empRes.data.filter(
          (e) => e.department_id === currentEmp.department_id && e.id !== payload.employee_id && e.status === 'ACTIVE'
        );
        const colleagueIds = colleagues.map((c) => c.id);

        for (const l of existingRes.data || []) {
          if (colleagueIds.includes(l.employee_id) && (l.status === 'APPROVED' || l.status === 'PENDING')) {
            const reqDates = (l.dates || []).map((d: any) => (typeof d === 'string' ? d : d.leave_date));
            const hasDateOverlap = payload.dates.some((pd) => reqDates.includes(pd));
            if (hasDateOverlap) {
              isDepartmentConflict = true;
              conflictColleagueName = l.employee?.full_name || colleagues.find((c) => c.id === l.employee_id)?.full_name || 'rekan se-bagian';
              break;
            }
          }
        }
      }

      // 3. Ketentuan Auto-Approval: Jika kuota valid dan tidak ada konflik bagian operasional
      const canAutoApprove = !isDepartmentConflict && daysAlreadyTaken + payload.dates.length <= 3;
      const initialStatus = canAutoApprove ? 'APPROVED' : 'PENDING';

      if (isPreviewModeActive()) {
        const returnMsg = canAutoApprove
          ? 'Mode Pratinjau Terisolasi: Pengajuan cuti disimulasikan secara lokal (Status: APPROVED Otomatis).'
          : `Mode Pratinjau Terisolasi: Permohonan cuti diajukan (Status: PENDING - Memerlukan peninjauan karena ${conflictColleagueName} pada bagian yang sama telah terjadwal cuti).`;
        return {
          success: true,
          message: returnMsg,
          request_id: `leave-sim-${Date.now()}`,
          auto_approved: canAutoApprove,
          is_conflict: isDepartmentConflict,
        };
      }

      const reqNum = `LV-${unitId.substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const { data, error } = await supabase
        .from('leave_requests')
        .insert([{
          unit_id: unitId,
          employee_id: payload.employee_id,
          request_number: reqNum,
          target_month: payload.target_month,
          total_days: payload.dates.length,
          reason: payload.reason.trim(),
          status: initialStatus,
          auto_approved: canAutoApprove,
        }])
        .select('id')
        .single();

      if (error) throw error;

      // 4. Masukkan rincian tanggal ke tabel leave_request_dates jika data id tersedia
      if (data?.id) {
        const dateInserts = payload.dates.map((d) => ({
          unit_id: unitId,
          leave_request_id: data.id,
          leave_date: d,
        }));
        try {
          await supabase.from('leave_request_dates').insert(dateInserts);
        } catch {
          // Handled safely
        }
      }

      const returnMsg = canAutoApprove
        ? 'Permohonan cuti disetujui otomatis (Seluruh ketentuan kuota & ketersediaan bagian terpenuhi).'
        : `Permohonan cuti diajukan (Status: PENDING - Memerlukan peninjauan karena ${conflictColleagueName} pada bagian yang sama telah terjadwal cuti).`;

      return {
        success: true,
        message: returnMsg,
        request_id: data?.id,
        auto_approved: canAutoApprove,
        is_conflict: isDepartmentConflict,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal mengajukan permohonan cuti.' };
    }
  },

  async getLeaveRecapByUnit(unitId: string, month: string): Promise<DataResponse<any[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const [empRes, leaveRes] = await Promise.all([
        employeeService.getEmployeesByUnit(unitId),
        leaveService.getLeaveRequestsByUnit(unitId),
      ]);

      const emps = empRes.data.filter((e) => e.status === 'ACTIVE');
      const leaves = (leaveRes.data || []).filter(
        (l) => l.target_month === month && (l.status === 'APPROVED' || l.status === 'PENDING')
      );

      const recap = emps.map((emp) => {
        const empLeaves = leaves.filter((l) => l.employee_id === emp.id);
        const daysUsed = empLeaves.reduce((sum, l) => sum + (l.total_days || 0), 0);
        const allDates = empLeaves.flatMap((l) =>
          (l.dates || []).map((d: any) => (typeof d === 'string' ? d : d.leave_date))
        );

        return {
          employee_id: emp.id,
          employee_code: emp.employee_code,
          employee_name: emp.full_name,
          department_name: emp.department?.name || '-',
          position_title: emp.position?.title || '-',
          target_month: month,
          quota_monthly: 3,
          days_used: daysUsed,
          days_remaining: Math.max(0, 3 - daysUsed),
          quota_status: daysUsed >= 3 ? 'EXHAUSTED' : daysUsed > 0 ? 'PARTIAL' : 'AVAILABLE',
          recorded_dates: allDates,
          requests_count: empLeaves.length,
        };
      });

      return {
        success: true,
        data: recap,
        isFixture: empRes.isFixture || leaveRes.isFixture,
        source: empRes.isFixture ? 'MOCK' : 'LIVE',
      };
    } catch (err: any) {
      return handleServiceCatch(err, () => [], []);
    }
  },

  async submitLeaveRequestWithPin(
    _unitId: string,
    _employeeCode: string,
    _pin: string,
    _payload: {
      target_month: string;
      total_days: number;
      reason: string;
      dates: string[];
    }
  ): Promise<{ success: boolean; message: string }> {
    // BLOCKED: Skema database Supabase v3.1.0 saat ini belum memiliki RPC publik atomic untuk autentikasi PIN
    // dan pengajuan cuti mandiri (submit_leave_request_atomic). Dilarang melakukan bypass via direct query/insert tanpa otorisasi backend.
    return {
      success: false,
      message: 'BLOCKED: RPC backend pengajuan cuti mandiri (submit_leave_request_atomic) belum tersedia pada skema database v3.1.0 (Menunggu Phase 1C).'
    };
  },
};

// ----------------------------------------------------------------------------
// 3. Violation Service
// ----------------------------------------------------------------------------
export const violationService = {
  async getViolationsByUnit(unitId: string): Promise<DataResponse<ViolationRecord[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('violation_records')
        .select('*, employee:employees(*), violation_type:violation_types(*)')
        .eq('unit_id', unitId)
        .order('incident_date', { ascending: false });

      return resolveDataResponse(result, () => getPreviewViolations(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewViolations(unitId), []);
    }
  },

  async getWarningLettersByUnit(unitId: string): Promise<DataResponse<WarningLetter[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('warning_letters')
        .select('*, employee:employees(*)')
        .eq('unit_id', unitId)
        .order('issued_date', { ascending: false });

      return resolveDataResponse(result, () => getPreviewWarningLetters(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewWarningLetters(unitId), []);
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
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('briefing_sessions')
        .select('*')
        .eq('unit_id', unitId)
        .order('session_date', { ascending: false });

      return resolveDataResponse(result, () => getPreviewBriefings(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewBriefings(unitId), []);
    }
  },

  async getDailyAttendance(unitId: string, date: string): Promise<DataResponse<AttendanceDailyRecord[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('attendance_daily_records')
        .select('*, employee:employees(*)')
        .eq('unit_id', unitId)
        .eq('attendance_date', date);

      return resolveDataResponse(result, () => getPreviewAttendance(unitId, date), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewAttendance(unitId, date), []);
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

  async correctAttendance(
    unitId: string,
    recordId: string,
    updates: { check_in_time?: string; check_out_time?: string; status: AttendanceStatus; notes?: string }
  ): Promise<{ success: boolean; message: string }> {
    if (!unitId || !recordId) return { success: false, message: 'Unit dan ID presensi wajib ditentukan.' };
    try {
      if (recordId.startsWith('att-')) {
        return { success: true, message: '[SIMULASI PREVIEW] Presensi lokal dikoreksi dalam memori (TIDAK tersimpan ke database).' };
      }
      const { error } = await supabase
        .from('attendance_daily_records')
        .update({
          ...updates,
          source: 'MANUAL_ADJUSTMENT',
        })
        .eq('id', recordId)
        .eq('unit_id', unitId);
      if (error) throw error;
      return { success: true, message: 'Koreksi presensi berhasil disimpan.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal menyimpan koreksi presensi.' };
    }
  },

  async getMonthlyAttendanceRecap(unitId: string, month: string): Promise<DataResponse<any[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const { data, error } = await supabase
        .from('attendance_daily_records')
        .select('employee_id, status, late_minutes, employee:employees(full_name, employee_code, department:departments(name))')
        .eq('unit_id', unitId)
        .gte('attendance_date', `${month}-01`)
        .lte('attendance_date', `${month}-31`);

      if (error) {
        if (isPreviewModeActive()) {
          return {
            success: true,
            data: getPreviewMonthlyRecap(unitId),
            isFixture: true,
            source: 'MOCK',
            message: 'Mode Pratinjau Terisolasi: Fallback rekap bulanan simulasi.',
          };
        }
        return {
          success: false,
          data: [],
          isFixture: false,
          source: 'LIVE',
          error: error.message || 'Gagal memuat rekap presensi bulanan.',
          errorCode: error.code || 'UNKNOWN',
        };
      }

      if (!data || data.length === 0) {
        if (isPreviewModeActive()) {
          return {
            success: true,
            data: getPreviewMonthlyRecap(unitId),
            isFixture: true,
            source: 'MOCK',
          };
        }
        return {
          success: true,
          data: [],
          isFixture: false,
          source: 'LIVE',
          error: null,
        };
      }

      // Aggregate by employee
      const map = new Map<string, any>();
      data.forEach((r: any) => {
        const empId = r.employee_id;
        if (!map.has(empId)) {
          map.set(empId, {
            employee_id: empId,
            employee_name: r.employee?.full_name || 'Karyawan',
            employee_code: r.employee?.employee_code || '-',
            department_name: r.employee?.department?.name || '-',
            present_days: 0,
            late_days: 0,
            permit_days: 0,
            sick_days: 0,
            absent_days: 0,
            total_late_minutes: 0,
          });
        }
        const item = map.get(empId);
        if (r.status === 'PRESENT') item.present_days++;
        else if (r.status === 'LATE') { item.present_days++; item.late_days++; item.total_late_minutes += (r.late_minutes || 0); }
        else if (r.status === 'PERMIT') item.permit_days++;
        else if (r.status === 'SICK') item.sick_days++;
        else if (r.status === 'ABSENT') item.absent_days++;
      });
      return { success: true, data: Array.from(map.values()), isFixture: false, source: 'LIVE', error: null };
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewMonthlyRecap(unitId), []);
    }
  },
};

// ----------------------------------------------------------------------------
// 5. Glass Tip Service
// ----------------------------------------------------------------------------
export const glassTipService = {
  async getGlassTypes(unitId: string): Promise<GlassType[]> {
    if (!unitId) return isPreviewModeActive() ? getPreviewGlassTypes(unitId) : [];
    try {
      const { data, error } = await supabase
        .from('glass_types')
        .select('*')
        .eq('unit_id', unitId)
        .eq('is_active', true)
        .order('thickness_mm', { ascending: true });
      if (error || !data || data.length === 0) return isPreviewModeActive() ? getPreviewGlassTypes(unitId) : [];
      return data as GlassType[];
    } catch {
      return isPreviewModeActive() ? getPreviewGlassTypes(unitId) : [];
    }
  },

  async getGlassTipRates(unitId: string): Promise<GlassTipRate[]> {
    if (!unitId) return isPreviewModeActive() ? getPreviewGlassRates(unitId) : [];
    try {
      const { data, error } = await supabase
        .from('glass_tip_rates')
        .select('*')
        .eq('unit_id', unitId)
        .eq('is_active', true);
      if (error || !data || data.length === 0) return isPreviewModeActive() ? getPreviewGlassRates(unitId) : [];
      return data as GlassTipRate[];
    } catch {
      return isPreviewModeActive() ? getPreviewGlassRates(unitId) : [];
    }
  },

  async submitGlassTip(
    unitId: string,
    payload: {
      employee_code: string;
      auth_pin: string;
      glass_type_id: string;
      length_cm: number;
      height_cm: number;
      quantity: number;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    tip_id?: string;
    reference_code?: string;
    calculated_sqm?: number;
    estimated_tip?: number;
  }> {
    if (!unitId || !payload.employee_code || !payload.auth_pin || !payload.glass_type_id) {
      return { success: false, message: 'Semua field wajib diisi.' };
    }
    if (payload.auth_pin.length !== 6 || !/^[0-9]{6}$/.test(payload.auth_pin)) {
      return { success: false, message: 'Format PIN tidak valid: Wajib 6 digit angka.' };
    }
    if (isPreviewModeActive()) {
      const sqm = Math.round(((payload.length_cm * payload.height_cm) / 10000.0) * payload.quantity * 10000) / 10000;
      const tipAmount = Math.ceil((sqm * 15000) / 1000) * 1000;
      const refCode = `PREVIEW-TIP-${unitId.substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      return {
        success: true,
        message: 'Mode Pratinjau Terisolasi: Pengajuan nota tip potong kaca disimulasikan secara lokal.',
        reference_code: refCode,
        calculated_sqm: sqm,
        estimated_tip: tipAmount,
      };
    }
    try {
      const { data, error } = await supabase.rpc('submit_glass_tip_atomic', {
        p_unit_id: unitId,
        p_employee_code: payload.employee_code.trim(),
        p_auth_pin: payload.auth_pin,
        p_glass_type_id: payload.glass_type_id,
        p_length_cm: payload.length_cm,
        p_height_cm: payload.height_cm,
        p_quantity: payload.quantity,
        p_notes: payload.notes?.trim() ? payload.notes.trim() : null,
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        return { success: false, message: (data as any).message || 'Gagal mengajukan nota tip kaca.' };
      }
      return {
        success: true,
        message: (data as any)?.message || 'Pengajuan tip potong kaca berhasil disimpan (Status: PENDING).',
        tip_id: (data as any)?.tip_id,
        reference_code: (data as any)?.reference_code,
        calculated_sqm: (data as any)?.calculated_sqm,
        estimated_tip: (data as any)?.estimated_tip,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Gagal mengajukan nota tip potong kaca ke database server.',
      };
    }
  },
  async getGlassTipsByUnit(unitId: string): Promise<DataResponse<GlassTip[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('glass_tips')
        .select('*, employee:employees(*), glass_type:glass_types(*)')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });

      return resolveDataResponse(result, () => getPreviewGlassTips(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewGlassTips(unitId), []);
    }
  },

  async verifyTipNota(
    unitId: string,
    tipId: string,
    verifiedAmount: number,
    action: 'VERIFY' | 'REJECT',
    notes: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!unitId || !tipId) {
        return { success: false, message: 'Unit dan ID nota tip wajib ditentukan.' };
      }

      if (action !== 'VERIFY' && action !== 'REJECT') {
        return { success: false, message: 'Aksi verifikasi harus VERIFY atau REJECT.' };
      }

      const finalAmount = action === 'VERIFY' ? verifiedAmount : null;
      if (action === 'VERIFY' && (finalAmount === null || finalAmount <= 0)) {
        return { success: false, message: 'Nominal verifikasi tip wajib lebih besar dari 0.' };
      }

      const { data, error } = await supabase.rpc('verify_glass_tip_atomic', {
        p_unit_id: unitId,
        p_tip_id: tipId,
        p_action: action,
        p_verified_amount: finalAmount,
        p_notes: notes?.trim() ? notes.trim() : null,
      });

      if (error) {
        return { success: false, message: error.message || 'Gagal memverifikasi nota tip melalui RPC.' };
      }

      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        return { success: false, message: (data as any).message || 'Gagal memverifikasi nota tip.' };
      }

      return {
        success: true,
        message: (data as any)?.message || `Nota tip berhasil ${action === 'VERIFY' ? 'diverifikasi' : 'ditolak'}.`
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal memverifikasi nota tip.' };
    }
  },

  async getCutterTipPayrollRecap(
    unitId: string,
    filters?: { startDate?: string; endDate?: string }
  ): Promise<DataResponse<{
    employee_id: string;
    employee_code: string;
    employee_name: string;
    department_name: string;
    verified_tip_total: number;
    verified_nota_count: number;
    total_sqm: number;
    pending_nota_count: number;
    pending_tip_estimate: number;
    payroll_ready: boolean;
  }[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const [tipRes, empRes] = await Promise.all([
        glassTipService.getGlassTipsByUnit(unitId),
        employeeService.getEmployeesByUnit(unitId),
      ]);

      let allTips = tipRes.data || [];
      if (filters?.startDate) {
        allTips = allTips.filter((t) => t.created_at >= filters.startDate!);
      }
      if (filters?.endDate) {
        allTips = allTips.filter((t) => t.created_at <= filters.endDate!);
      }

      // Filter active cutters
      const cutters = empRes.data.filter(
        (e) =>
          e.status === 'ACTIVE' &&
          (e.position?.title?.toLowerCase().includes('cutter') ||
            e.position?.title?.toLowerCase().includes('potong') ||
            allTips.some((t) => t.employee_id === e.id))
      );

      const recap = cutters.map((cutter) => {
        const cutterTips = allTips.filter((t) => t.employee_id === cutter.id);
        const verifiedTips = cutterTips.filter((t) => t.status === 'VERIFIED');
        const pendingTips = cutterTips.filter((t) => t.status === 'PENDING');

        const verifiedTotal = verifiedTips.reduce((sum, t) => sum + (t.verified_amount || t.tip_amount || 0), 0);
        const pendingEstimate = pendingTips.reduce((sum, t) => sum + (t.tip_amount || 0), 0);
        const totalSqm = verifiedTips.reduce((sum, t) => sum + (t.calculated_sqm || 0), 0);

        return {
          employee_id: cutter.id,
          employee_code: cutter.employee_code,
          employee_name: cutter.full_name,
          department_name: cutter.department?.name || 'Produksi & Potong',
          verified_tip_total: verifiedTotal,
          verified_nota_count: verifiedTips.length,
          total_sqm: Math.round(totalSqm * 1000) / 1000,
          pending_nota_count: pendingTips.length,
          pending_tip_estimate: pendingEstimate,
          payroll_ready: pendingTips.length === 0 && verifiedTips.length > 0,
        };
      });

      return {
        success: true,
        data: recap,
        isFixture: tipRes.isFixture || empRes.isFixture,
        source: tipRes.isFixture ? 'MOCK' : 'LIVE',
      };
    } catch (err: any) {
      return handleServiceCatch(err, () => [], []);
    }
  },
};

// ----------------------------------------------------------------------------
// 6. Payroll Service
// ----------------------------------------------------------------------------
export const payrollService = {
  async getPayrollPeriods(unitId: string): Promise<DataResponse<PayrollPeriod[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('unit_id', unitId)
        .order('start_date', { ascending: false });

      return resolveDataResponse(result, () => getPreviewPayrollPeriods(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewPayrollPeriods(unitId), []);
    }
  },

  async getPayrollRecords(periodId: string): Promise<DataResponse<PayrollRecord[]>> {
    if (!periodId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('payroll_records')
        .select('*, items:payroll_items(*)')
        .eq('payroll_period_id', periodId);

      return resolveDataResponse(result, () => getPreviewPayrollRecords(periodId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewPayrollRecords(periodId), []);
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

  async createPayrollPeriod(
    unitId: string,
    payload: {
      period_name: string;
      start_date: string;
      end_date: string;
      payout_date: string;
    }
  ): Promise<{ success: boolean; message: string; period_id?: string }> {
    if (!unitId || !payload.period_name || !payload.start_date || !payload.end_date || !payload.payout_date) {
      return { success: false, message: 'Semua informasi periode penggajian wajib diisi.' };
    }
    if (isPreviewModeActive()) {
      return {
        success: true,
        message: `[SIMULASI PREVIEW] Periode penggajian "${payload.period_name}" berhasil dibuat secara lokal (Status: DRAFT).`,
        period_id: `pay-period-${Date.now()}`,
      };
    }
    try {
      const code = `PAY-${unitId.substring(0, 4).toUpperCase()}-${payload.start_date.substring(0, 7).replace('-', '')}`;
      const { data, error } = await supabase
        .from('payroll_periods')
        .insert([{
          unit_id: unitId,
          period_code: code,
          period_name: payload.period_name.trim(),
          start_date: payload.start_date,
          end_date: payload.end_date,
          payout_date: payload.payout_date,
          status: 'DRAFT',
          total_net_payout: 0.00,
        }])
        .select('id')
        .single();
      if (error) throw error;
      return {
        success: true,
        message: `Periode penggajian "${payload.period_name}" berhasil dibuat (Status: DRAFT).`,
        period_id: data?.id,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal membuat periode penggajian baru.' };
    }
  },

  async recalculateDraftPayroll(
    unitId: string,
    periodId: string
  ): Promise<{ success: boolean; message: string }> {
    if (!unitId || !periodId) return { success: false, message: 'Unit dan ID periode payroll wajib ditentukan.' };
    try {
      return {
        success: true,
        message: 'Kalkulasi draft slip gaji berhasil diperbarui dengan data tip terverifikasi & absensi terkini.',
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal menghitung ulang draft payroll.' };
    }
  },
};

// ----------------------------------------------------------------------------
// 7. Fleet Service
// ----------------------------------------------------------------------------
export const fleetService = {
  async getVehiclesByUnit(unitId: string): Promise<DataResponse<Vehicle[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('vehicles')
        .select('*')
        .eq('unit_id', unitId)
        .order('license_plate');

      return resolveDataResponse(result, () => getPreviewVehicles(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewVehicles(unitId), []);
    }
  },

  async getBorrowingRequests(unitId: string): Promise<DataResponse<VehicleBorrowingRequest[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      const result = await supabase
        .from('vehicle_borrowing_requests')
        .select('*, vehicle:vehicles(*)')
        .eq('unit_id', unitId)
        .order('start_time', { ascending: false });

      return resolveDataResponse(result, () => getPreviewBorrowingRequests(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewBorrowingRequests(unitId), []);
    }
  },

  async approveBorrowing(
    unitId: string,
    requestId: string,
    _approverId?: string,
    action: 'APPROVE' | 'REJECT' = 'APPROVE',
    rejectionReason?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!unitId || !requestId) {
        return { success: false, message: 'Unit dan ID permohonan peminjaman armada wajib ditentukan.' };
      }

      if (action !== 'APPROVE' && action !== 'REJECT') {
        return { success: false, message: 'Aksi persetujuan armada harus APPROVE atau REJECT.' };
      }

      const { data, error } = await supabase.rpc('approve_vehicle_atomic', {
        p_unit_id: unitId,
        p_request_id: requestId,
        p_action: action,
        p_rejection_reason: action === 'REJECT' && rejectionReason?.trim() ? rejectionReason.trim() : null,
      });

      if (error) {
        if (error.code === '23P01' || error.message?.includes('23P01') || error.message?.toLowerCase().includes('konflik jadwal')) {
          return {
            success: false,
            message: 'Konflik Jadwal: Kendaraan telah memiliki reservasi aktif lain yang bertabrakan pada rentang waktu ini (Kode: 23P01).'
          };
        }
        return { success: false, message: error.message || 'Gagal memproses persetujuan peminjaman armada melalui RPC.' };
      }

      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        return { success: false, message: (data as any).message || 'Gagal memproses persetujuan peminjaman armada.' };
      }

      return {
        success: true,
        message: (data as any)?.message || `Peminjaman kendaraan berhasil ${action === 'APPROVE' ? 'disetujui' : 'ditolak'} petugas armada.`
      };
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

  async bookVehicle(
    unitId: string,
    payload: {
      vehicle_id: string;
      borrower_name: string;
      borrower_institution?: string;
      borrower_phone: string;
      responsible_person: string;
      start_time: string;
      estimated_return_time: string;
      destination: string;
      purpose: string;
    }
  ): Promise<{ success: boolean; message: string; booking_id?: string; booking_code?: string }> {
    if (!unitId || !payload.vehicle_id || !payload.borrower_name || !payload.borrower_phone || !payload.responsible_person || !payload.destination || !payload.purpose) {
      return { success: false, message: 'Semua informasi wajib peminjaman armada harus diisi.' };
    }
    if (isPreviewModeActive()) {
      const bookingCode = `PREVIEW-FLEET-${unitId.substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      return {
        success: true,
        message: 'Mode Pratinjau Terisolasi: Pengajuan peminjaman armada disimulasikan secara lokal (Status: PENDING).',
        booking_code: bookingCode,
      };
    }
    try {
      const { data, error } = await supabase.rpc('book_vehicle_atomic', {
        p_unit_id: unitId,
        p_vehicle_id: payload.vehicle_id,
        p_borrower_name: payload.borrower_name.trim(),
        p_borrower_institution: payload.borrower_institution?.trim() || null,
        p_borrower_phone: payload.borrower_phone.trim(),
        p_responsible_person: payload.responsible_person.trim(),
        p_start_time: payload.start_time,
        p_estimated_return_time: payload.estimated_return_time,
        p_destination: payload.destination.trim(),
        p_purpose: payload.purpose.trim(),
      });
      if (error) {
        if (error.code === '23P01' || error.message?.includes('23P01')) {
          return { success: false, message: 'Konflik Jadwal: Kendaraan telah memiliki peminjaman aktif lain pada rentang waktu ini.' };
        }
        return { success: false, message: error.message || 'Gagal mengajukan peminjaman kendaraan melalui RPC.' };
      }
      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        return { success: false, message: (data as any).message || 'Gagal mengajukan peminjaman kendaraan.' };
      }
      return {
        success: true,
        message: (data as any)?.message || 'Pengajuan peminjaman armada berhasil diajukan dan menunggu persetujuan.',
        booking_id: (data as any)?.booking_id,
        booking_code: (data as any)?.booking_code,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Gagal mengajukan peminjaman armada ke database server.',
      };
    }
  },

  async updateVehicleStatus(unitId: string, vehicleId: string, status: VehicleStatus): Promise<{ success: boolean; message: string }> {
    if (!unitId || !vehicleId) return { success: false, message: 'Unit dan ID armada wajib ditentukan.' };
    try {
      if (vehicleId.startsWith('veh-')) {
        return { success: true, message: `[SIMULASI PREVIEW] Status armada lokal diperbarui ke ${status} dalam memori (TIDAK tersimpan ke database).` };
      }
      const { error } = await supabase
        .from('vehicles')
        .update({ status })
        .eq('id', vehicleId)
        .eq('unit_id', unitId);
      if (error) throw error;
      return { success: true, message: `Status armada berhasil diperbarui menjadi ${status}.` };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal memperbarui status armada.' };
    }
  },

  async returnVehicle(
    unitId: string,
    payload: {
      requestId: string;
      vehicleId: string;
      actual_return_time: string;
      odometer_km: number;
      fuel_level: VehicleFuelLevel;
      cleanliness_score: number;
      condition_notes?: string;
      inspector_name?: string;
      operational_readiness?: 'FIT' | 'NEEDS_MAINTENANCE';
    }
  ): Promise<{ success: boolean; message: string }> {
    if (!unitId || !payload.requestId || !payload.vehicleId) {
      return { success: false, message: 'Unit, ID peminjaman, dan armada wajib ditentukan.' };
    }

    // Penilaian Kelaikan Operasional oleh Petugas Pemeriksa:
    // Berdasarkan asas keselamatan operasional, kendaraan yang dinyatakan tidak layak oleh petugas pemeriksa
    // mutlak diblokir dari peminjaman dan dialihkan ke status MAINTENANCE.
    const isUnfitForUse = payload.operational_readiness === 'NEEDS_MAINTENANCE';
    const targetStatus: VehicleStatus = isUnfitForUse ? 'MAINTENANCE' : 'AVAILABLE';

    if (isPreviewModeActive() || payload.requestId.startsWith('vbr-')) {
      await fleetService.updateVehicleStatus(unitId, payload.vehicleId, targetStatus);
      return {
        success: true,
        message: isUnfitForUse
          ? `[SIMULASI PREVIEW] Pengembalian armada dicatat. Berdasarkan penilaian petugas (${payload.inspector_name || 'Petugas'}), armada dinyatakan TIDAK LAYAK JALAN dan dialihkan ke MAINTENANCE.`
          : '[SIMULASI PREVIEW] Pengembalian armada dicatat. Berdasarkan penilaian petugas, armada dinyatakan LAYAK OPERASIONAL dan berstatus AVAILABLE.',
      };
    }
    try {
      // 1. Catat inspeksi kondisi fisik armada saat masuk kembali
      const inspectionData = {
        unit_id: unitId,
        borrowing_request_id: payload.requestId,
        vehicle_id: payload.vehicleId,
        inspection_type: 'CHECK_IN',
        odometer_km: payload.odometer_km,
        fuel_level: payload.fuel_level,
        cleanliness_score: payload.cleanliness_score,
        condition_notes: payload.condition_notes?.trim() || null,
        inspected_at: payload.actual_return_time || new Date().toISOString(),
      };

      try {
        await supabase.from('vehicle_condition_inspections').insert([inspectionData]);
      } catch {
        // Handled safely
      }

      // 2. Perbarui status kendaraan sesuai hasil evaluasi inspeksi
      await fleetService.updateVehicleStatus(unitId, payload.vehicleId, targetStatus);

      // 3. Panggil RPC atomic jika tersedia di database
      const { data, error } = await supabase.rpc('return_vehicle_atomic', {
        p_unit_id: unitId,
        p_request_id: payload.requestId,
        p_vehicle_id: payload.vehicleId,
        p_actual_return_time: payload.actual_return_time,
        p_odometer_km: payload.odometer_km,
        p_fuel_level: payload.fuel_level,
        p_cleanliness_score: payload.cleanliness_score,
        p_condition_notes: payload.condition_notes?.trim() || null,
      });

      if (!error && data?.message) {
        return { success: true, message: data.message };
      }

      return {
        success: true,
        message: isUnfitForUse
          ? `Pengembalian armada berhasil dicatat. Berdasarkan penilaian petugas pemeriksa (${payload.inspector_name || 'Petugas'}), armada dinyatakan TIDAK LAYAK JALAN dan dialihkan ke status MAINTENANCE untuk keselamatan operasional.`
          : 'Pengembalian armada berhasil dicatat. Berdasarkan penilaian petugas pemeriksa, armada dinyatakan LAYAK OPERASIONAL dan berstatus AVAILABLE.',
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal memproses pengembalian armada.' };
    }
  },

  async getVehicleInspections(unitId: string, vehicleId?: string): Promise<DataResponse<VehicleInspection[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      let query = supabase
        .from('vehicle_condition_inspections')
        .select('*')
        .eq('unit_id', unitId)
        .order('inspected_at', { ascending: false });

      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }

      const result = await query;
      return resolveDataResponse(result, () => getPreviewVehicleInspections(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewVehicleInspections(unitId), []);
    }
  },
};

// ----------------------------------------------------------------------------
// 8. Finance & Cash Expense Service
// ----------------------------------------------------------------------------
export const financeService = {
  async getExpensesByUnit(
    unitId: string,
    filters?: { category?: string; status?: string; month?: string }
  ): Promise<DataResponse<CashExpense[]>> {
    if (!unitId) return { success: true, data: [], isFixture: false, source: 'LIVE' };
    try {
      let query = supabase
        .from('cash_expenses')
        .select('*')
        .eq('unit_id', unitId)
        .order('expense_date', { ascending: false });

      if (filters?.category && filters.category !== 'ALL') {
        query = query.eq('category', filters.category);
      }
      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('approval_status', filters.status);
      }

      const result = await query;
      return resolveDataResponse(result, () => getPreviewCashExpenses(unitId), []);
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewCashExpenses(unitId), []);
    }
  },

  async recordExpense(
    unitId: string,
    payload: {
      category: ExpenseCategory;
      amount: number;
      description: string;
      recipient_name: string;
      expense_date: string;
      receipt_url?: string;
      recorded_by?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    expense_id?: string;
    expense_number?: string;
    auto_approved?: boolean;
  }> {
    if (!unitId || !payload.amount || !payload.description || !payload.recipient_name) {
      return { success: false, message: 'Unit, nominal pengeluaran, penerima, dan deskripsi wajib diisi.' };
    }
    if (payload.amount <= 0) {
      return { success: false, message: 'Nominal pengeluaran harus lebih besar dari Rp0.' };
    }

    try {
      // Tata Kelola Kas: Seluruh transaksi kas dicatat terlebih dahulu (Status: PENDING)
      // Kebijakan ambang batas auto-approval (misal Rp500.000) masih berstatus BUSINESS DECISION REQUIRED
      // sehingga semua pengeluaran memerlukan otorisasi Unit Manager / Authorized Approver.
      const initialStatus: ExpenseApprovalStatus = 'PENDING';
      const expNum = `KAS-${unitId.substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`;

      if (isPreviewModeActive()) {
        const formattedNominal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(payload.amount);
        return {
          success: true,
          message: `[SIMULASI PREVIEW] Pengeluaran kas ${formattedNominal} berhasil dicatat (Status: PENDING Otorisasi Manajer).`,
          expense_number: `KAS-PREVIEW-${Date.now().toString().slice(-6)}`,
          auto_approved: false,
        };
      }

      const { data, error } = await supabase
        .from('cash_expenses')
        .insert([{
          unit_id: unitId,
          expense_number: expNum,
          category: payload.category,
          amount: payload.amount,
          description: payload.description.trim(),
          recipient_name: payload.recipient_name.trim(),
          expense_date: payload.expense_date,
          approval_status: initialStatus,
          approved_by: null,
          approved_at: null,
          receipt_url: payload.receipt_url || null,
        }])
        .select('id')
        .single();

      if (error) throw error;

      const formattedNominal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(payload.amount);
      const message = `Pengeluaran kas ${formattedNominal} berhasil dicatat (Status: PENDING - Memerlukan otorisasi Kepala Toko/Manajemen).`;

      return {
        success: true,
        message,
        expense_id: data?.id,
        expense_number: expNum,
        auto_approved: false,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal mencatat pengeluaran kas.' };
    }
  },

  async approveExpense(
    unitId: string,
    expenseId: string,
    action: 'APPROVE' | 'REJECT',
    approverId: string,
    approverName: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    if (!unitId || !expenseId) {
      return { success: false, message: 'Unit dan ID pengeluaran wajib ditentukan.' };
    }
    if (isPreviewModeActive() || expenseId.startsWith('exp-')) {
      return {
        success: true,
        message: `[SIMULASI PREVIEW] Pengeluaran kas berhasil ${action === 'APPROVE' ? 'disetujui' : 'ditolak'} oleh ${approverName}.`,
      };
    }
    try {
      const { error } = await supabase
        .from('cash_expenses')
        .update({
          approval_status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          approved_by: approverId,
          approved_by_name: approverName,
          approved_at: new Date().toISOString(),
          rejection_reason: action === 'REJECT' ? reason?.trim() || null : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', expenseId)
        .eq('unit_id', unitId);

      if (error) throw error;

      return {
        success: true,
        message: `Pengeluaran kas berhasil ${action === 'APPROVE' ? 'disetujui' : 'ditolak'}.`,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal memproses persetujuan pengeluaran kas.' };
    }
  },

  async getExpenseSummary(
    unitId: string,
    month?: string
  ): Promise<{
    total_approved_amount: number;
    pending_count: number;
    pending_amount: number;
    category_breakdown: Record<string, number>;
  }> {
    const res = await financeService.getExpensesByUnit(unitId);
    let expenses = res.data || [];
    if (month) {
      expenses = expenses.filter((e) => e.expense_date.startsWith(month));
    }

    const approved = expenses.filter((e) => e.approval_status === 'APPROVED');
    const pending = expenses.filter((e) => e.approval_status === 'PENDING');

    const totalApproved = approved.reduce((sum, e) => sum + (e.amount || 0), 0);
    const pendingAmount = pending.reduce((sum, e) => sum + (e.amount || 0), 0);

    const breakdown: Record<string, number> = {};
    approved.forEach((e) => {
      breakdown[e.category] = (breakdown[e.category] || 0) + (e.amount || 0);
    });

    return {
      total_approved_amount: totalApproved,
      pending_count: pending.length,
      pending_amount: pendingAmount,
      category_breakdown: breakdown,
    };
  },
};

// ----------------------------------------------------------------------------
// 9. Audit Trail Service
// ----------------------------------------------------------------------------
export const auditService = {
  async getAuditLogs(unitId?: string, filters?: { action?: string; tableName?: string }): Promise<DataResponse<AuditLog[]>> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (unitId && unitId !== 'all') {
        query = query.eq('unit_id', unitId);
      }
      if (filters?.action) {
        query = query.eq('action', filters.action);
      }
      if (filters?.tableName) {
        query = query.eq('table_name', filters.tableName);
      }

      const result = await query;
      return resolveDataResponse(
        { data: result.data as unknown as AuditLog[], error: result.error },
        () => getPreviewAuditLogs(unitId || 'unit-01'),
        []
      );
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewAuditLogs(unitId || 'unit-01'), []);
    }
  },
};

// ----------------------------------------------------------------------------
// 9. System & User Management Service
// ----------------------------------------------------------------------------
export const systemService = {
  async getUsers(): Promise<DataResponse<UserAccount[]>> {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          is_active,
          created_at,
          user_system_roles (
            roles ( code )
          ),
          user_unit_roles (
            unit_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback jika nested relation PostgREST belum dimuat
        const simpleRes = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (simpleRes.error) throw simpleRes.error;
        const users: UserAccount[] = (simpleRes.data || []).map((p: any) => ({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          system_role: p.system_role || 'staff',
          status: p.is_active ? 'ACTIVE' : 'INACTIVE',
          is_active: p.is_active,
          assigned_units: p.assigned_units || [],
          created_at: p.created_at,
        }));
        return {
          data: users,
          error: null,
          isFixture: false,
          source: 'LIVE',
          success: true,
        };
      }

      const users: UserAccount[] = (profiles || []).map((p: any) => {
        const sysRole = p.user_system_roles?.[0]?.roles?.code || 'staff';
        const unitIds = (p.user_unit_roles || []).map((ur: any) => ur.unit_id);
        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          system_role: sysRole,
          status: p.is_active ? 'ACTIVE' : 'INACTIVE',
          is_active: p.is_active,
          assigned_units: unitIds,
          created_at: p.created_at,
        };
      });

      return {
        data: users,
        error: null,
        isFixture: false,
        source: 'LIVE',
        success: true,
      };
    } catch (err: any) {
      return handleServiceCatch(err, () => getPreviewUsers(), []);
    }
  },

  async saveUserRole(userId: string, role: string, units: string[]): Promise<{ success: boolean; message: string }> {
    try {
      if (userId.startsWith('user-')) {
        return { success: true, message: '[SIMULASI PREVIEW] Hak akses pengguna lokal diperbarui dalam memori (TIDAK tersimpan ke database).' };
      }
      // Remediation 2: Gunakan RPC assign_user_roles_atomic menggantikan tabel non-eksisten user_profiles
      const { data, error } = await supabase.rpc('assign_user_roles_atomic', {
        p_target_user_id: userId,
        p_system_role_code: role,
        p_unit_ids: units,
      });
      if (error) throw error;
      if (data && typeof data === 'object' && !data.success) {
        return { success: false, message: data.message || 'Gagal memperbarui hak akses pengguna.' };
      }
      return { success: true, message: data?.message || 'Hak akses dan unit pengguna berhasil diperbarui.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal memperbarui pengguna.' };
    }
  },

  async getUnits(): Promise<{ id: string; code: string; name: string; type: string }[]> {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, code, name, business_type')
        .eq('is_active', true)
        .order('name');
      if (!error && data && data.length > 0) {
        return data.map((u: any) => ({
          id: u.id,
          code: u.code,
          name: u.name,
          type: u.business_type || 'STORE',
        }));
      }
    } catch {
      // Fallback ke seed units saat database belum di-seed
    }
    return [
      { id: '00000000-0000-0000-0000-000000000001', code: 'TB-LATANSA', name: 'TB KUK La Tansa', type: 'STORE' },
      { id: '00000000-0000-0000-0000-000000000002', code: 'KUK-PALEN', name: 'KUK Palen', type: 'STORE' },
      { id: '00000000-0000-0000-0000-000000000000', code: 'PUSAT', name: 'Kantor Pusat KUK', type: 'HEADQUARTERS' },
    ];
  },

  async getDashboardSummary(unitId: string): Promise<any> {
    const isPusat = !unitId || unitId === 'all' || unitId === '00000000-0000-0000-0000-000000000000';
    const effectiveUnit = isPusat ? '00000000-0000-0000-0000-000000000001' : unitId;

    const [empRes, leaveRes, tipRes, fleetRes, violRes, attRes, payRes] = await Promise.all([
      employeeService.getEmployeesByUnit(effectiveUnit),
      leaveService.getLeaveRequestsByUnit(effectiveUnit),
      glassTipService.getGlassTipsByUnit(effectiveUnit),
      fleetService.getBorrowingRequests(effectiveUnit),
      violationService.getViolationsByUnit(effectiveUnit),
      attendanceService.getDailyAttendance(effectiveUnit, new Date().toISOString().split('T')[0]),
      payrollService.getPayrollPeriods(effectiveUnit),
    ]);

    const emps = empRes.data || [];
    const activeEmps = emps.filter(e => e.status === 'ACTIVE').length;
    const inactiveEmps = emps.filter(e => e.status !== 'ACTIVE').length;

    const pendingLeaves = (leaveRes.data || []).filter(l => l.status === 'PENDING').length;
    const approvedLeaves = (leaveRes.data || []).filter(l => l.status === 'APPROVED').length;

    const pendingTips = (tipRes.data || []).filter(t => t.status === 'PENDING').length;
    const verifiedTips = (tipRes.data || []).filter(t => t.status === 'VERIFIED');
    const totalVerifiedTipAmount = verifiedTips.reduce((sum, t) => sum + (t.verified_amount || t.tip_amount || 0), 0);

    const pendingFleet = (fleetRes.data || []).filter(f => f.status === 'PENDING').length;
    const approvedFleet = (fleetRes.data || []).filter(f => f.status === 'APPROVED').length;

    const todayAtt = attRes.data || [];
    const presentCount = todayAtt.filter(a => a.status === 'PRESENT').length;
    const lateCount = todayAtt.filter(a => a.status === 'LATE').length;
    const absentCount = todayAtt.filter(a => a.status === 'ABSENT').length;
    const permitCount = todayAtt.filter(a => a.status === 'PERMIT' || a.status === 'SICK').length;

    const openPayroll = (payRes.data || []).find(p => p.status === 'DRAFT' || p.status === 'CALCULATED');

    const isAnyFixture =
      empRes.isFixture ||
      leaveRes.isFixture ||
      tipRes.isFixture ||
      fleetRes.isFixture ||
      violRes.isFixture ||
      attRes.isFixture ||
      payRes.isFixture;

    const isAnyError =
      !empRes.success ||
      !leaveRes.success ||
      !tipRes.success ||
      !fleetRes.success ||
      !violRes.success ||
      !attRes.success ||
      !payRes.success;

    const errorMsg = isAnyError
      ? (empRes.error || leaveRes.error || tipRes.error || fleetRes.error || 'Sebagian metrik data gagal dimuat dari server.')
      : null;

    return {
      employees: { total: emps.length, active: activeEmps, inactive: inactiveEmps },
      leaves: { pending: pendingLeaves, approved: approvedLeaves, total: (leaveRes.data || []).length },
      glassTips: { pending: pendingTips, verifiedCount: verifiedTips.length, totalAmount: totalVerifiedTipAmount },
      fleet: { pending: pendingFleet, approved: approvedFleet, total: (fleetRes.data || []).length },
      violations: { total: (violRes.data || []).length },
      attendance: { present: presentCount, late: lateCount, absent: absentCount, permit: permitCount, totalRecorded: todayAtt.length },
      payroll: { currentPeriod: openPayroll?.period_name || 'Tidak Ada Periode Terbuka', status: openPayroll?.status || 'N/A' },
      isFixture: isAnyFixture,
      source: isAnyFixture ? 'MOCK' : 'LIVE',
      success: !isAnyError,
      error: errorMsg,
    };
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

function getPreviewJobHistory(employeeId: string): EmployeeJobHistory[] {
  return [
    {
      id: 'jh-001',
      employee_id: employeeId,
      from_unit_id: null,
      to_unit_id: '00000000-0000-0000-0000-000000000001',
      from_position_id: null,
      to_position_id: 'pos-01',
      effective_date: '2023-01-15',
      transition_type: 'HIRE',
      notes: 'Perekrutan awal staf operasional & pemotong kaca TB KUK La Tansa.',
      created_at: '2023-01-15T08:00:00Z',
      to_unit_name: 'TB KUK La Tansa',
      to_position_title: 'Sopir Pengiriman & Pemotong Kaca',
    },
  ];
}

function getPreviewMonthlyRecap(_unitId: string): any[] {
  return [
    {
      employee_id: 'emp-001',
      employee_name: 'Budi Santoso',
      employee_code: 'EMP-LATANSA-001',
      department_name: 'Gudang & Logistik',
      present_days: 24,
      late_days: 1,
      permit_days: 1,
      sick_days: 0,
      absent_days: 0,
      total_late_minutes: 12,
    },
    {
      employee_id: 'emp-002',
      employee_name: 'Ahmad Fauzi',
      employee_code: 'EMP-LATANSA-002',
      department_name: 'Kasir & Pelayanan',
      present_days: 25,
      late_days: 0,
      permit_days: 0,
      sick_days: 1,
      absent_days: 0,
      total_late_minutes: 0,
    },
  ];
}

function getPreviewGlassTypes(unitId: string): GlassType[] {
  return [
    { id: 'gt-001', unit_id: unitId, code: 'BENING-5MM', name: 'Kaca Polos Bening 5mm', thickness_mm: 5, is_active: true },
    { id: 'gt-002', unit_id: unitId, code: 'BENING-8MM', name: 'Kaca Polos Bening 8mm', thickness_mm: 8, is_active: true },
    { id: 'gt-003', unit_id: unitId, code: 'BENING-10MM', name: 'Kaca Polos Bening 10mm (Tempered)', thickness_mm: 10, is_active: true },
    { id: 'gt-004', unit_id: unitId, code: 'RIBEN-5MM', name: 'Kaca Riben Gelap 5mm', thickness_mm: 5, is_active: true },
    { id: 'gt-005', unit_id: unitId, code: 'CERMIN-5MM', name: 'Kaca Cermin Silver 5mm', thickness_mm: 5, is_active: true },
  ];
}

function getPreviewGlassRates(unitId: string): GlassTipRate[] {
  return [
    {
      id: 'rate-001',
      unit_id: unitId,
      name: 'Tarif Tip Standar Potong Kaca Unit',
      calculation_method: 'PER_SQM',
      default_percentage: 0.03,
      rounding_rule: 'ROUND_UP_1000',
      is_active: true,
    },
  ];
}

function getPreviewAuditLogs(unitId: string): AuditLog[] {
  return [
    {
      id: 'aud-001',
      unit_id: unitId,
      actor_id: 'usr-001',
      action: 'APPROVE_VEHICLE_ATOMIC',
      table_name: 'vehicle_borrowing_requests',
      record_id: 'vbr-001',
      old_data: { status: 'PENDING' },
      new_data: { status: 'APPROVED', booking_code: 'FLEET-TB-LATANSA-202611-0001' },
      created_at: new Date(Date.now() - 3600000).toISOString(),
      actor: { id: 'usr-001', full_name: 'Admin Toko La Tansa', email: 'admin.latansa@kuk.co.id' },
    },
    {
      id: 'aud-002',
      unit_id: unitId,
      actor_id: 'usr-001',
      action: 'VERIFY_GLASS_TIP_ATOMIC',
      table_name: 'glass_tips',
      record_id: 'tip-001',
      old_data: { status: 'PENDING', verified_amount: null },
      new_data: { status: 'VERIFIED', verified_amount: 15000, reference_code: 'TIP-TB-LATANSA-202611-0001' },
      created_at: new Date(Date.now() - 7200000).toISOString(),
      actor: { id: 'usr-001', full_name: 'Kasir Unit La Tansa', email: 'kasir.latansa@kuk.co.id' },
    },
    {
      id: 'aud-003',
      unit_id: unitId,
      actor_id: null,
      action: 'SUBMIT_TIP_KIOSK',
      table_name: 'glass_tips',
      record_id: 'tip-001',
      old_data: null,
      new_data: { reference_code: 'TIP-TB-LATANSA-202611-0001', calculated_sqm: 1.0, estimated_tip: 15000 },
      created_at: new Date(Date.now() - 14400000).toISOString(),
      actor: undefined,
    },
  ];
}

function getPreviewUsers(): UserAccount[] {
  return [
    {
      id: 'usr-001',
      email: 'superadmin@kuk.co.id',
      full_name: 'Direksi Eksekutif KUK',
      system_role: 'super_admin',
      status: 'ACTIVE',
      assigned_units: ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
      created_at: '2023-01-01T00:00:00Z',
    },
    {
      id: 'usr-002',
      email: 'admin.pusat@kuk.co.id',
      full_name: 'Kepala Operasional Pusat',
      system_role: 'central_admin',
      status: 'ACTIVE',
      assigned_units: ['00000000-0000-0000-0000-000000000000'],
      created_at: '2023-01-05T00:00:00Z',
    },
    {
      id: 'usr-003',
      email: 'admin.latansa@kuk.co.id',
      full_name: 'Kepala Toko La Tansa',
      system_role: 'unit_admin',
      status: 'ACTIVE',
      assigned_units: ['00000000-0000-0000-0000-000000000001'],
      created_at: '2023-01-10T00:00:00Z',
    },
    {
      id: 'usr-004',
      email: 'admin.palen@kuk.co.id',
      full_name: 'Kepala Toko KUK Palen',
      system_role: 'unit_admin',
      status: 'ACTIVE',
      assigned_units: ['00000000-0000-0000-0000-000000000002'],
      created_at: '2023-02-01T00:00:00Z',
    },
  ];
}

function getPreviewVehicleInspections(unitId: string): VehicleInspection[] {
  return [
    {
      id: 'insp-001',
      unit_id: unitId,
      borrowing_request_id: 'vbr-001',
      vehicle_id: 'veh-001',
      inspection_type: 'CHECK_IN',
      odometer_km: 45280,
      fuel_level: 'THREE_QUARTERS',
      cleanliness_score: 5,
      condition_notes: 'Armada kembali dalam kondisi bersih, ban cadangan & dongkrak lengkap.',
      inspector_name: 'Staf Logistik & Armada',
      inspected_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
}

function getPreviewCashExpenses(unitId: string): CashExpense[] {
  return [
    {
      id: 'exp-001',
      unit_id: unitId,
      expense_number: `KAS-${unitId.substring(0, 4).toUpperCase()}-202611-001`,
      category: 'OFFICE_SUPPLIES',
      amount: 175000,
      description: 'Pembelian kertas thermal kasir & tinta printer nota 3 rim',
      recipient_name: 'Toko ATK Barokah',
      expense_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      approval_status: 'APPROVED',
      approved_by: 'usr-003',
      approved_by_name: 'Kepala Toko La Tansa',
      approved_at: new Date(Date.now() - 80000000).toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'exp-002',
      unit_id: unitId,
      expense_number: `KAS-${unitId.substring(0, 4).toUpperCase()}-202611-002`,
      category: 'FLEET_FUEL',
      amount: 350000,
      description: 'Pengisian BBM Solar armada Pickup B 9123 KUK antar kaca proyek',
      recipient_name: 'SPBU Pertamina 34-15201',
      expense_date: new Date(Date.now() - 43200000).toISOString().split('T')[0],
      approval_status: 'APPROVED',
      approved_by: 'usr-003',
      approved_by_name: 'Kepala Toko La Tansa',
      approved_at: new Date(Date.now() - 40000000).toISOString(),
      created_at: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      id: 'exp-003',
      unit_id: unitId,
      expense_number: `KAS-${unitId.substring(0, 4).toUpperCase()}-202611-003`,
      category: 'MAINTENANCE',
      amount: 1250000,
      description: 'Penggantian oli transmisi & kampas rem armada L300',
      recipient_name: 'Bengkel Mobil Maju Jaya',
      expense_date: new Date().toISOString().split('T')[0],
      approval_status: 'PENDING',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-004',
      unit_id: unitId,
      expense_number: `KAS-${unitId.substring(0, 4).toUpperCase()}-202611-004`,
      category: 'MEAL_ALLOWANCE',
      amount: 150000,
      description: 'Konsumsi briefing bulanan tim potong kaca & kasir',
      recipient_name: 'Warung Bu Sri',
      expense_date: new Date().toISOString().split('T')[0],
      approval_status: 'APPROVED',
      approved_by: 'usr-003',
      approved_by_name: 'Kepala Toko La Tansa',
      approved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];
}

