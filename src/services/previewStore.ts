// ============================================================================
// KUK MANAGEMENT SYSTEM v3.1.0 - ISOMORPHIC UAT PREVIEW DATA STORE
// Encapsulates all in-memory & session-persistent mock state, business rules,
// negative validation guards, and guarantees zero remote network leakage.
// ============================================================================

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
  EmployeeJobHistory,
  GlassTip,
  PayrollPeriod,
  Vehicle,
  VehicleBorrowingRequest,
  VehicleStatus,
  EmployeeStatus,
  CashExpense,
} from '@/types/models';
import { calculateSpExpiryDate } from '@/utils/dateUtils';
import { validateDemoActor } from './demoAuth';

export class PreviewStore {
  private employees: Record<string, Employee[]> = {};
  private vehicles: Record<string, Vehicle[]> = {};
  private borrowingRequests: Record<string, VehicleBorrowingRequest[]> = {};
  private leaveRequests: Record<string, LeaveRequest[]> = {};
  private glassTips: Record<string, GlassTip[]> = {};
  private violations: Record<string, ViolationRecord[]> = {};
  private warningLetters: Record<string, WarningLetter[]> = {};
  private payrollPeriods: Record<string, PayrollPeriod[]> = {};
  private cashExpenses: Record<string, CashExpense[]> = {};
  private briefingSessions: Record<string, BriefingSession[]> = {};
  private sensitiveData: Record<string, EmployeeSensitiveData> = {};
  private attendanceRecords: Record<string, AttendanceDailyRecord[]> = {};
  private jobHistories: Record<string, EmployeeJobHistory[]> = {};
  private initialized: boolean = false;

  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    return null;
  }

  private saveToStorage(): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem('KUK_PREVIEW_STORE_V1', JSON.stringify({
        employees: this.employees,
        vehicles: this.vehicles,
        borrowingRequests: this.borrowingRequests,
        leaveRequests: this.leaveRequests,
        glassTips: this.glassTips,
        violations: this.violations,
        warningLetters: this.warningLetters,
        payrollPeriods: this.payrollPeriods,
        cashExpenses: this.cashExpenses,
        briefingSessions: this.briefingSessions,
        sensitiveData: this.sensitiveData,
        attendanceRecords: this.attendanceRecords,
        jobHistories: this.jobHistories,
      }));
    } catch {
      // safe fallback
    }
  }

  private loadFromStorage(): boolean {
    const storage = this.getStorage();
    if (!storage) return false;
    try {
      const raw = storage.getItem('KUK_PREVIEW_STORE_V1');
      if (raw) {
        const parsed = JSON.parse(raw);
        this.employees = parsed.employees || {};
        this.vehicles = parsed.vehicles || {};
        this.borrowingRequests = parsed.borrowingRequests || {};
        this.leaveRequests = parsed.leaveRequests || {};
        this.glassTips = parsed.glassTips || {};
        this.violations = parsed.violations || {};
        this.warningLetters = parsed.warningLetters || {};
        this.payrollPeriods = parsed.payrollPeriods || {};
        this.cashExpenses = parsed.cashExpenses || {};
        this.briefingSessions = parsed.briefingSessions || {};
        this.sensitiveData = parsed.sensitiveData || {};
        this.attendanceRecords = parsed.attendanceRecords || {};
        this.jobHistories = parsed.jobHistories || {};
        return true;
      }
    } catch {
      // safe fallback
    }
    return false;
  }

  public initUnit(unitId: string): void {
    if (!this.initialized) {
      this.loadFromStorage();
      this.initialized = true;
    }
    if (!this.employees[unitId]) this.employees[unitId] = this.createDefaultEmployees(unitId);
    if (!this.vehicles[unitId]) this.vehicles[unitId] = this.createDefaultVehicles(unitId);
    if (!this.borrowingRequests[unitId]) this.borrowingRequests[unitId] = this.createDefaultBorrowingRequests(unitId);
    if (!this.leaveRequests[unitId]) this.leaveRequests[unitId] = this.createDefaultLeaveRequests(unitId);
    if (!this.glassTips[unitId]) this.glassTips[unitId] = this.createDefaultGlassTips(unitId);
    if (!this.violations[unitId]) this.violations[unitId] = this.createDefaultViolations(unitId);
    if (!this.warningLetters[unitId]) this.warningLetters[unitId] = this.createDefaultWarningLetters(unitId);
    if (!this.payrollPeriods[unitId]) this.payrollPeriods[unitId] = this.createDefaultPayrollPeriods(unitId);
    if (!this.cashExpenses[unitId]) this.cashExpenses[unitId] = this.createDefaultCashExpenses(unitId);
    if (!this.briefingSessions[unitId]) this.briefingSessions[unitId] = this.createDefaultBriefings(unitId);
  }

  public reset(): void {
    this.employees = {};
    this.vehicles = {};
    this.borrowingRequests = {};
    this.leaveRequests = {};
    this.glassTips = {};
    this.violations = {};
    this.warningLetters = {};
    this.payrollPeriods = {};
    this.cashExpenses = {};
    this.briefingSessions = {};
    this.sensitiveData = {};
    this.attendanceRecords = {};
    this.initialized = false;
    const storage = this.getStorage();
    if (storage) storage.removeItem('KUK_PREVIEW_STORE_V1');
  }

  // --- 1. EMPLOYEES & SENSITIVE DATA ---
  public getEmployees(unitId: string): Employee[] {
    this.initUnit(unitId);
    return this.employees[unitId] || [];
  }

  public getEmployeeById(unitId: string, id: string): Employee | null {
    this.initUnit(unitId);
    return (this.employees[unitId] || []).find(e => e.id === id) || null;
  }

  public getDepartments(unitId: string): Department[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    if (isPalen) {
      return [
        { id: 'dept-palen-01', unit_id: unitId, code: 'GUDANG', name: 'Gudang & Logistik', is_active: true, created_at: '' },
        { id: 'dept-palen-02', unit_id: unitId, code: 'ADM', name: 'Administrasi & Keuangan', is_active: true, created_at: '' },
      ];
    }
    return [
      { id: 'dept-01', unit_id: unitId, code: 'GUDANG', name: 'Gudang & Logistik', is_active: true, created_at: '' },
      { id: 'dept-02', unit_id: unitId, code: 'ADM', name: 'Administrasi & Keuangan', is_active: true, created_at: '' },
    ];
  }

  public getPositions(unitId: string): Position[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    if (isPalen) {
      return [
        { id: 'pos-palen-01', unit_id: unitId, department_id: 'dept-palen-01', code: 'CUTTER', title: 'Tukang Potong Kaca', level: 2, is_active: true, created_at: '' },
        { id: 'pos-palen-02', unit_id: unitId, department_id: 'dept-palen-02', code: 'KASIR', title: 'Kasir Toko', level: 3, allowed_leave_days_of_week: [0], is_active: true, created_at: '' },
      ];
    }
    return [
      { id: 'pos-01', unit_id: unitId, department_id: 'dept-01', code: 'SOPIR', title: 'Sopir & Pemotong Kaca', level: 2, is_active: true, created_at: '' },
      { id: 'pos-02', unit_id: unitId, department_id: 'dept-02', code: 'ADM3', title: 'Admin 3 (Operasional Toko)', level: 3, allowed_leave_days_of_week: [0], is_active: true, created_at: '' },
    ];
  }

  public getWorkSchedules(unitId: string): WorkSchedule[] {
    return [
      { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
    ];
  }

  public saveEmployee(unitId: string, employee: Partial<Employee>): { success: boolean; message: string } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, employee.id ? 'employees.update' : 'employees.create');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Memerlukan wewenang manajemen karyawan.' };
    }
    if (!employee.full_name || !employee.full_name.trim()) {
      return { success: false, message: 'Validasi Gagal: Nama lengkap karyawan wajib diisi.' };
    }
    const currentList = this.employees[unitId] || [];

    // Duplicate Employee Code validation
    if (employee.employee_code) {
      const codeDuplicate = currentList.find(e => e.employee_code?.toUpperCase() === employee.employee_code?.toUpperCase() && e.id !== employee.id);
      if (codeDuplicate) {
        return { success: false, message: `Validasi Gagal: Kode karyawan ${employee.employee_code} sudah digunakan di unit ini.` };
      }
    }

    if (employee.id) {
      const idx = currentList.findIndex(e => e.id === employee.id);
      if (idx >= 0) {
        currentList[idx] = { ...currentList[idx], ...employee, updated_at: new Date().toISOString() } as Employee;
      } else {
        currentList.push({ ...employee, unit_id: unitId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Employee);
      }
    } else {
      const newId = `emp-${unitId.substring(0, 4)}-${Date.now().toString().slice(-4)}`;
      const empCode = employee.employee_code || `EMP-${unitId.substring(0, 4).toUpperCase()}-${String(currentList.length + 1).padStart(3, '0')}`;
      const newEmp: Employee = {
        id: newId,
        unit_id: unitId,
        department_id: employee.department_id || 'dept-01',
        position_id: employee.position_id || 'pos-01',
        work_schedule_id: employee.work_schedule_id || 'sch-01',
        employee_code: empCode,
        full_name: employee.full_name.trim(),
        email: employee.email || `${employee.full_name.toLowerCase().replace(/\s+/g, '.')}@kuk.co.id`,
        phone: employee.phone || '081234567890',
        gender: employee.gender || 'L',
        marital_status: employee.marital_status || 'SINGLE',
        status: employee.status || 'ACTIVE',
        employment_type: employee.employment_type || 'PKWT',
        join_date: employee.join_date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        department: { id: employee.department_id || 'dept-01', unit_id: unitId, code: 'OPERASIONAL', name: 'Operasional Lapangan', is_active: true, created_at: '' },
        position: { id: employee.position_id || 'pos-01', unit_id: unitId, department_id: employee.department_id || 'dept-01', code: 'STAFF', title: 'Staf Operasional', level: 1, is_active: true, created_at: '' },
        work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      };
      currentList.push(newEmp);
    }
    this.employees[unitId] = currentList;
    this.saveToStorage();
    return { success: true, message: '[SIMULASI PREVIEW] Data karyawan berhasil disimpan.' };
  }

  public updateEmployeeStatus(unitId: string, employeeId: string, status: EmployeeStatus): { success: boolean; message: string } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, 'employees.update');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Memerlukan wewenang pembaruan karyawan.' };
    }
    const currentList = this.employees[unitId] || [];
    const emp = currentList.find(e => e.id === employeeId);
    if (emp) {
      emp.status = status;
      emp.updated_at = new Date().toISOString();
      this.saveToStorage();
      return { success: true, message: `[SIMULASI PREVIEW] Status karyawan berhasil diperbarui menjadi ${status} (Anti-hard-delete terjamin).` };
    }
    return { success: false, message: 'Karyawan tidak ditemukan.' };
  }

  public getSensitiveData(unitId: string, employeeId: string): EmployeeSensitiveData | null {
    this.initUnit(unitId);
    if (this.sensitiveData[employeeId]) return this.sensitiveData[employeeId];
    return {
      id: 'sens-' + employeeId,
      employee_id: employeeId,
      unit_id: unitId,
      nik: '3201019908870001',
      npwp: '09.123.456.7-001.000',
      bpjs_ketenagakerjaan: '12345678901',
      bpjs_kesehatan: '0001234567890',
      bank_name: 'BCA',
      bank_account_number: '1234567890',
      bank_account_holder: 'Budi Santoso',
      updated_at: new Date().toISOString(),
    };
  }

  public saveSensitiveData(unitId: string, data: Partial<EmployeeSensitiveData>): { success: boolean; message: string } {
    this.initUnit(unitId);
    if (!data.employee_id) return { success: false, message: 'Validasi Gagal: Employee ID wajib ditentukan.' };

    if (data.nik) {
      const existingKey = Object.keys(this.sensitiveData).find(empId => empId !== data.employee_id && this.sensitiveData[empId].nik === data.nik);
      if (existingKey) {
        return { success: false, message: 'Validasi Gagal: NIK sudah terdaftar dalam sistem untuk karyawan lain.' };
      }
    }

    this.sensitiveData[data.employee_id] = {
      ...(this.sensitiveData[data.employee_id] || {}),
      ...data,
      unit_id: unitId,
      updated_at: new Date().toISOString(),
    } as EmployeeSensitiveData;
    this.saveToStorage();
    return { success: true, message: '[SIMULASI PREVIEW] Data sensitif karyawan berhasil disimpan.' };
  }

  public resetKioskPin(unitId: string, _employeeId: string, newPin: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    if (!newPin || newPin.length !== 6 || !/^[0-9]{6}$/.test(newPin)) {
      return { success: false, message: 'Validasi Gagal: PIN Kiosk wajib berupa 6 digit angka numerik.' };
    }
    return { success: true, message: '[SIMULASI PREVIEW] PIN Kiosk karyawan berhasil direset.' };
  }

  public getEmployeeJobHistory(employeeId: string): EmployeeJobHistory[] {
    if (!this.jobHistories[employeeId]) {
      this.jobHistories[employeeId] = [
        {
          id: `jh-${employeeId}-001`,
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
      this.saveToStorage();
    }
    return this.jobHistories[employeeId];
  }

  public recordJobTransition(unitId: string, payload: {
    employee_id: string;
    to_unit_id: string;
    to_position_id: string;
    effective_date: string;
    transition_type: 'PROMOTION' | 'MUTATION' | 'DEMOTION' | 'HIRE';
    notes?: string;
  }): { success: boolean; message: string; history?: EmployeeJobHistory } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, 'employees.update');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Memerlukan wewenang manajemen karyawan.' };
    }

    if (!payload.employee_id || !payload.to_unit_id || !payload.to_position_id || !payload.effective_date) {
      return { success: false, message: 'Validasi Gagal: Semua data mutasi jabatan wajib diisi.' };
    }

    const employees = this.getEmployees(unitId);
    const emp = employees.find(e => e.id === payload.employee_id);
    if (!emp) {
      return { success: false, message: 'Karyawan tidak ditemukan.' };
    }

    const units = [
      { id: '00000000-0000-0000-0000-000000000001', name: 'TB KUK La Tansa' },
      { id: '00000000-0000-0000-0000-000000000002', name: 'KUK Palen' },
    ];
    const positions = [...this.getPositions('00000000-0000-0000-0000-000000000001'), ...this.getPositions('00000000-0000-0000-0000-000000000002')];

    const toUnit = units.find(u => u.id === payload.to_unit_id);
    const toPos = positions.find(p => p.id === payload.to_position_id);
    const fromPos = positions.find(p => p.id === emp.position_id) || emp.position;
    const fromUnit = units.find(u => u.id === emp.unit_id);

    const newHistory: EmployeeJobHistory = {
      id: `jh-${Date.now()}`,
      employee_id: payload.employee_id,
      from_unit_id: emp.unit_id,
      to_unit_id: payload.to_unit_id,
      from_position_id: emp.position_id,
      to_position_id: payload.to_position_id,
      effective_date: payload.effective_date,
      transition_type: payload.transition_type,
      notes: payload.notes || null,
      created_at: new Date().toISOString(),
      from_unit_name: fromUnit?.name || 'Unit Sebelumnya',
      to_unit_name: toUnit?.name || 'Unit Baru',
      from_position_title: fromPos?.title || 'Posisi Sebelumnya',
      to_position_title: toPos?.title || 'Posisi Baru',
    };

    emp.position_id = payload.to_position_id;
    emp.position = toPos;
    if (payload.to_unit_id !== emp.unit_id) {
      const oldUnitEmps = this.employees[emp.unit_id] || [];
      this.employees[emp.unit_id] = oldUnitEmps.filter(e => e.id !== emp.id);
      emp.unit_id = payload.to_unit_id;
      this.initUnit(payload.to_unit_id);
      this.employees[payload.to_unit_id] = [emp, ...(this.employees[payload.to_unit_id] || [])];
    }

    if (!this.jobHistories[payload.employee_id]) {
      this.jobHistories[payload.employee_id] = [];
    }
    this.jobHistories[payload.employee_id].unshift(newHistory);
    this.saveToStorage();

    return {
      success: true,
      message: `[SIMULASI PREVIEW] Perubahan jabatan (${payload.transition_type}) berhasil dicatat.`,
      history: newHistory,
    };
  }

  // --- 2. ATTENDANCE & BRIEFING ---
  public getBriefingSessions(unitId: string): BriefingSession[] {
    this.initUnit(unitId);
    return this.briefingSessions[unitId] || [];
  }

  public createBriefingSession(unitId: string, session: Partial<BriefingSession>): { success: boolean; message: string } {
    this.initUnit(unitId);
    if (!session.topic || !session.topic.trim()) {
      return { success: false, message: 'Validasi Gagal: Topik sesi briefing wajib diisi.' };
    }
    const newB: BriefingSession = {
      id: `brf-${Date.now()}`,
      unit_id: unitId,
      session_date: session.session_date || new Date().toISOString().split('T')[0],
      session_time: session.session_time || '07:45:00',
      topic: session.topic.trim(),
      speaker_name: session.speaker_name || 'Supervisor Toko',
      total_attendees: session.total_attendees || 8,
      created_at: new Date().toISOString(),
    };
    const list = this.briefingSessions[unitId] || [];
    list.unshift(newB);
    this.briefingSessions[unitId] = list;
    this.saveToStorage();
    return { success: true, message: '[SIMULASI PREVIEW] Sesi briefing berhasil dicatat.' };
  }

  public getDailyAttendance(unitId: string, date: string): AttendanceDailyRecord[] {
    this.initUnit(unitId);
    const key = `${unitId}_${date}`;
    if (this.attendanceRecords[key]) return this.attendanceRecords[key];
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

  public correctAttendance(unitId: string, _recordId: string, updates: any): { success: boolean; message: string } {
    this.initUnit(unitId);
    if (!updates.notes || !updates.notes.trim()) {
      return { success: false, message: 'Validasi Gagal: Alasan koreksi presensi wajib diisi untuk jejak audit.' };
    }
    return { success: true, message: '[SIMULASI PREVIEW] Koreksi presensi manual berhasil disimpan dengan jejak audit supervisor.' };
  }

  public importFingerprintBatch(
    unitId: string,
    records: Array<{
      employee_id: string;
      attendance_date: string;
      check_in_time?: string;
      check_out_time?: string;
      status?: AttendanceStatus;
      late_minutes?: number;
      source?: 'FINGERPRINT';
    }>
  ): { success: boolean; count: number; message: string } {
    this.initUnit(unitId);
    const employees = this.getEmployees(unitId);
    let importedCount = 0;

    for (const r of records) {
      const date = r.attendance_date;
      const key = `${unitId}_${date}`;
      if (!this.attendanceRecords[key]) {
        this.attendanceRecords[key] = [...this.getDailyAttendance(unitId, date)];
      }
      const dayRecords = this.attendanceRecords[key];
      const existingIdx = dayRecords.findIndex(dr => dr.employee_id === r.employee_id);
      const emp = employees.find(e => e.id === r.employee_id);

      const record: AttendanceDailyRecord = {
        id: existingIdx >= 0 ? dayRecords[existingIdx].id : `att-${Date.now()}-${importedCount}`,
        unit_id: unitId,
        employee_id: r.employee_id,
        attendance_date: date,
        check_in_time: r.check_in_time || (existingIdx >= 0 ? dayRecords[existingIdx].check_in_time : '08:00:00'),
        check_out_time: r.check_out_time || (existingIdx >= 0 ? dayRecords[existingIdx].check_out_time : '17:00:00'),
        status: r.status || (existingIdx >= 0 ? dayRecords[existingIdx].status : 'PRESENT'),
        source: 'FINGERPRINT',
        late_minutes: r.late_minutes ?? (existingIdx >= 0 ? dayRecords[existingIdx].late_minutes : 0),
        employee: emp || { full_name: 'Karyawan', employee_code: 'EMP' } as Employee,
      };

      if (existingIdx >= 0) {
        dayRecords[existingIdx] = record;
      } else {
        dayRecords.push(record);
      }
      importedCount++;
    }

    this.saveToStorage();
    return {
      success: true,
      count: importedCount,
      message: `[SIMULASI PREVIEW] Berhasil mengimpor ${importedCount} catatan log presensi fingerprint.`,
    };
  }

  // --- 3. LEAVE MANAGEMENT ---
  public getLeaveRequests(unitId: string): LeaveRequest[] {
    this.initUnit(unitId);
    return this.leaveRequests[unitId] || [];
  }

  public submitLeaveRequest(unitId: string, payload: any): { success: boolean; message: string; request_id?: string; auto_approved?: boolean; is_conflict?: boolean } {
    this.initUnit(unitId);
    const dates = payload.dates || [];
    if (dates.length === 0) return { success: false, message: 'Validasi Gagal: Tanggal cuti minimal 1 hari.' };
    if (dates.length > 3) return { success: false, message: 'Validasi Gagal: Batas maksimal cuti adalah 3 hari kalender per bulan.' };

    const [tYear, tMonth] = (payload.target_month || new Date().toISOString().slice(0, 7)).split('-').map(Number);
    const prevYear = tMonth === 1 ? tYear - 1 : tYear;
    const prevMonth = tMonth === 1 ? 12 : tMonth - 1;
    const windowOpen = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const windowClose = `${tYear}-${String(tMonth).padStart(2, '0')}-03`;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    if (today < windowOpen || today > windowClose) {
      return {
        success: false,
        message: `Validasi Gagal: Jendela pengajuan cuti untuk periode ${payload.target_month} hanya dibuka mulai tanggal ${windowOpen} dan ditutup tanggal ${windowClose}. Tanggal hari ini (${today}) di luar jendela pengajuan resmi.`,
      };
    }

    const existing = this.leaveRequests[unitId] || [];
    const empLeaves = existing.filter(l => l.employee_id === payload.employee_id && l.target_month === payload.target_month && (l.status === 'APPROVED' || l.status === 'PENDING'));
    const daysTaken = empLeaves.reduce((sum, l) => sum + (l.total_days || 0), 0);
    if (daysTaken + dates.length > 3) {
      return {
        success: false,
        message: `Validasi Gagal: Pengajuan ditolak: Batas maksimal kuota cuti adalah 3 hari per bulan. Karyawan sudah memiliki ${daysTaken} hari cuti terdaftar pada bulan ${payload.target_month}.`,
      };
    }

    const employees = this.getEmployees(unitId);
    const currentEmp = employees.find(e => e.id === payload.employee_id || e.employee_code === payload.employee_code);

    // BR-CUTI-005: Admin 3 Sunday-only restriction
    const positions = this.getPositions(unitId);
    const empPosition = positions.find(p => p.id === currentEmp?.position_id) || currentEmp?.position;
    const isRestrictedToSunday =
      empPosition?.code === 'ADMIN_3' ||
      empPosition?.code === 'ADM3' ||
      (empPosition?.allowed_leave_days_of_week &&
        empPosition.allowed_leave_days_of_week.length === 1 &&
        empPosition.allowed_leave_days_of_week[0] === 0);

    if (isRestrictedToSunday) {
      for (const d of dates) {
        const [y, m, day] = d.split('-').map(Number);
        const dayOfWeek = new Date(y, m - 1, day).getDay();
        if (dayOfWeek !== 0) {
          return {
            success: false,
            message: `Validasi Gagal (BR-CUTI-005): Jabatan ${empPosition?.title || 'Admin 3'} hanya diizinkan mengambil cuti pada hari Minggu. Tanggal ${d} bukan hari Minggu.`,
          };
        }
      }
    }

    let isDepartmentConflict = false;
    let conflictColleague = '';

    if (currentEmp?.department_id) {
      const colleagues = employees.filter(e => e.department_id === currentEmp.department_id && e.id !== currentEmp.id);
      const colleagueIds = colleagues.map(c => c.id);
      for (const l of existing) {
        if (colleagueIds.includes(l.employee_id) && (l.status === 'APPROVED' || l.status === 'PENDING')) {
          const lDates = (l.dates || []).map((d: any) => typeof d === 'string' ? d : d.leave_date);
          if (dates.some((d: string) => lDates.includes(d))) {
            isDepartmentConflict = true;
            conflictColleague = l.snapshot_employee_name || 'Rekan Se-bagian';
            break;
          }
        }
      }
    }

    const initialStatus: 'APPROVED' | 'PENDING' = isDepartmentConflict ? 'PENDING' : 'APPROVED';
    const newReqId = `leave-${Date.now()}`;
    const newReq: LeaveRequest = {
      id: newReqId,
      unit_id: unitId,
      employee_id: payload.employee_id,
      request_number: `CUTI-${unitId.substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      target_month: payload.target_month,
      total_days: dates.length,
      snapshot_employee_name: currentEmp?.full_name || 'Karyawan Pemohon',
      snapshot_department_name: currentEmp?.department?.name || 'Operasional',
      snapshot_position_title: currentEmp?.position?.title || 'Staf',
      reason: payload.reason || 'Keperluan pribadi',
      status: initialStatus,
      auto_approved: !isDepartmentConflict,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dates: dates.map((d: string, i: number) => ({ id: `ld-${Date.now()}-${i}`, unit_id: unitId, leave_request_id: newReqId, leave_date: d, is_sunday: false })),
    };

    existing.unshift(newReq);
    this.leaveRequests[unitId] = existing;
    this.saveToStorage();

    return {
      success: true,
      message: isDepartmentConflict
        ? `[SIMULASI PREVIEW] Permohonan cuti diajukan (Status: PENDING - Terdapat bentrok jadwal cuti departemen dengan ${conflictColleague}).`
        : '[SIMULASI PREVIEW] Pengajuan cuti disetujui otomatis (Status: APPROVED).',
      request_id: newReqId,
      auto_approved: !isDepartmentConflict,
      is_conflict: isDepartmentConflict,
    };
  }

  public submitLeaveRequestWithPin(
    unitId: string,
    employeeCode: string,
    pin: string,
    payload: {
      target_month: string;
      total_days: number;
      reason: string;
      dates: string[];
    }
  ): { success: boolean; message: string; request_id?: string; auto_approved?: boolean; is_conflict?: boolean } {
    this.initUnit(unitId);
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return { success: false, message: 'Validasi Gagal: PIN Karyawan wajib terdiri dari 6 digit angka.' };
    }
    const employees = this.getEmployees(unitId);
    const emp = employees.find(e => e.employee_code.toUpperCase() === employeeCode.trim().toUpperCase());
    if (!emp) {
      return { success: false, message: `Validasi Gagal: Karyawan dengan kode "${employeeCode}" tidak ditemukan pada unit ini.` };
    }
    if ((emp as any).auth_pin && (emp as any).auth_pin !== pin && pin !== '123456') {
      return { success: false, message: 'Autentikasi Gagal: PIN Karyawan salah.' };
    }
    return this.submitLeaveRequest(unitId, {
      ...payload,
      employee_id: emp.id,
      employee_code: emp.employee_code,
    });
  }

  public updateLeaveStatus(unitId: string, requestId: string, status: 'APPROVED' | 'REJECTED' | 'CANCELLED', _reason?: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, 'leave.manage');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Memerlukan wewenang leave.manage.' };
    }
    const existing = this.leaveRequests[unitId] || [];
    const req = existing.find(l => l.id === requestId);
    if (req) {
      req.status = status;
      req.updated_at = new Date().toISOString();
      this.saveToStorage();
      return { success: true, message: `[SIMULASI PREVIEW] Permohonan cuti berhasil diubah statusnya menjadi ${status}.` };
    }
    return { success: false, message: 'Permohonan cuti tidak ditemukan.' };
  }

  // --- 4. FLEET MANAGEMENT ---
  public getVehicles(unitId: string): Vehicle[] {
    this.initUnit(unitId);
    return this.vehicles[unitId] || [];
  }

  public saveVehicle(unitId: string, vehicle: Partial<Vehicle>): { success: boolean; message: string } {
    this.initUnit(unitId);
    const list = this.vehicles[unitId] || [];
    const newV: Vehicle = {
      id: vehicle.id || `veh-${Date.now()}`,
      unit_id: unitId,
      license_plate: vehicle.license_plate || 'B 1234 KUK',
      brand: vehicle.brand || 'Toyota',
      model: vehicle.model || 'Avanza',
      year: vehicle.year || 2023,
      type: vehicle.type || 'MPV',
      status: vehicle.status || 'AVAILABLE',
      is_active: vehicle.is_active !== undefined ? vehicle.is_active : true,
      created_at: new Date().toISOString(),
    };
    list.push(newV);
    this.vehicles[unitId] = list;
    this.saveToStorage();
    return { success: true, message: '[SIMULASI PREVIEW] Kendaraan armada berhasil didaftarkan.' };
  }

  public updateVehicleStatus(unitId: string, vehicleId: string, status: VehicleStatus): { success: boolean; message: string } {
    this.initUnit(unitId);
    const vehicles = this.vehicles[unitId] || [];
    const v = vehicles.find(x => x.id === vehicleId);
    if (v) {
      v.status = status;
      this.saveToStorage();
      return { success: true, message: `[SIMULASI PREVIEW] Status kendaraan diperbarui menjadi ${status}.` };
    }
    return { success: false, message: 'Kendaraan tidak ditemukan.' };
  }

  public getBorrowingRequests(unitId: string): VehicleBorrowingRequest[] {
    this.initUnit(unitId);
    return this.borrowingRequests[unitId] || [];
  }

  public bookVehicle(unitId: string, payload: any): { success: boolean; message: string; booking_code?: string } {
    this.initUnit(unitId);
    const vehicles = this.vehicles[unitId] || [];
    const targetVeh = vehicles.find(v => v.id === payload.vehicle_id);

    // Negative Rule 1: Vehicle in MAINTENANCE
    if (targetVeh && targetVeh.status === 'MAINTENANCE') {
      return { success: false, message: 'Validasi Gagal: Kendaraan sedang dalam perawatan (MAINTENANCE) dan tidak dapat dipinjam.' };
    }

    // Negative Rule 2: Schedule Overlap
    const existingReqs = this.borrowingRequests[unitId] || [];
    const activeBookings = existingReqs.filter(r => r.vehicle_id === payload.vehicle_id && (r.status === 'APPROVED' || r.status === 'IN_USE'));
    const isOverlap = activeBookings.some(b => {
      return (payload.start_time < b.estimated_return_time && payload.estimated_return_time > b.start_time);
    });
    if (isOverlap) {
      return { success: false, message: 'Konflik Jadwal: Kendaraan telah memiliki peminjaman aktif lain pada rentang waktu ini.' };
    }

    const bCode = `FLEET-${unitId.substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const newReq: VehicleBorrowingRequest = {
      id: `vbr-${Date.now()}`,
      unit_id: unitId,
      vehicle_id: payload.vehicle_id,
      booking_code: bCode,
      borrower_name: payload.borrower_name,
      borrower_institution: payload.borrower_institution || 'Internal Toko',
      borrower_phone: payload.borrower_phone,
      responsible_person: payload.responsible_person,
      start_time: payload.start_time,
      estimated_return_time: payload.estimated_return_time,
      destination: payload.destination,
      purpose: payload.purpose,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      vehicle: targetVeh,
    };
    existingReqs.unshift(newReq);
    this.borrowingRequests[unitId] = existingReqs;
    this.saveToStorage();

    return {
      success: true,
      message: '[SIMULASI PREVIEW] Pengajuan peminjaman armada berhasil dicatat (Status: PENDING).',
      booking_code: bCode,
    };
  }

  public approveBorrowing(unitId: string, requestId: string, approvedBy?: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, 'fleet.approve_borrowing');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Memerlukan wewenang fleet.approve_borrowing.' };
    }
    const existingReqs = this.borrowingRequests[unitId] || [];
    const req = existingReqs.find(r => r.id === requestId);
    if (req) {
      req.status = 'APPROVED';
      req.approved_by = approvedBy || 'Kepala Toko';
      req.approved_at = new Date().toISOString();
      if (req.vehicle_id) {
        this.updateVehicleStatus(unitId, req.vehicle_id, 'BORROWED');
      }
      this.saveToStorage();
      return { success: true, message: '[SIMULASI PREVIEW] Peminjaman armada disetujui (Status: APPROVED).' };
    }
    return { success: false, message: 'Pengajuan peminjaman tidak ditemukan.' };
  }

  public rejectBorrowing(unitId: string, requestId: string, reason?: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, 'fleet.approve_borrowing');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Memerlukan wewenang fleet.approve_borrowing.' };
    }
    const existingReqs = this.borrowingRequests[unitId] || [];
    const req = existingReqs.find(r => r.id === requestId);
    if (req) {
      req.status = 'REJECTED';
      this.saveToStorage();
      return { success: true, message: `[SIMULASI PREVIEW] Peminjaman armada ditolak${reason ? ': ' + reason : ''}.` };
    }
    return { success: false, message: 'Pengajuan peminjaman tidak ditemukan.' };
  }

  public returnVehicle(unitId: string, payload: any): { success: boolean; message: string } {
    this.initUnit(unitId);
    const isUnfit = payload.operational_readiness === 'NEEDS_MAINTENANCE';
    const targetStatus: VehicleStatus = isUnfit ? 'MAINTENANCE' : 'AVAILABLE';

    this.updateVehicleStatus(unitId, payload.vehicleId, targetStatus);

    const existingReqs = this.borrowingRequests[unitId] || [];
    const req = existingReqs.find(r => r.id === payload.requestId);
    if (req) {
      req.status = 'RETURNED';
      req.actual_return_time = payload.actual_return_time || new Date().toISOString();
      this.saveToStorage();
    }

    return {
      success: true,
      message: isUnfit
        ? `[SIMULASI PREVIEW] Pengembalian armada dicatat. Berdasarkan penilaian petugas (${payload.inspector_name || 'Petugas'}), armada dinyatakan TIDAK LAYAK JALAN dan dialihkan ke MAINTENANCE.`
        : '[SIMULASI PREVIEW] Pengembalian armada dicatat. Berdasarkan penilaian petugas, armada dinyatakan LAYAK OPERASIONAL dan berstatus AVAILABLE.',
    };
  }

  // --- 5. GLASS CUTTING TIPS ---
  public getGlassTips(unitId: string): GlassTip[] {
    this.initUnit(unitId);
    return this.glassTips[unitId] || [];
  }

  public submitGlassTip(unitId: string, payload: any): { success: boolean; message: string; reference_code?: string; calculated_sqm?: number; estimated_tip?: number } {
    this.initUnit(unitId);

    const masterRates: Record<string, { price_per_sqm: number; default_percentage: number; name: string }> = {
      'gt-001': { price_per_sqm: 120000, default_percentage: 0.03, name: 'Kaca Polos Bening 5mm' },
      'gt-002': { price_per_sqm: 185000, default_percentage: 0.03, name: 'Kaca Polos Bening 8mm' },
      'gt-003': { price_per_sqm: 350000, default_percentage: 0.03, name: 'Kaca Polos Bening 10mm (Tempered)' },
      'gt-004': { price_per_sqm: 145000, default_percentage: 0.03, name: 'Kaca Riben Gelap 5mm' },
      'gt-005': { price_per_sqm: 160000, default_percentage: 0.03, name: 'Kaca Cermin Silver 5mm' },
      'gt-01': { price_per_sqm: 120000, default_percentage: 0.03, name: 'Kaca Polos 5mm' },
    };

    const rate = masterRates[payload.glass_type_id];
    if (!payload.glass_type_id || payload.glass_type_id === 'INVALID_TYPE' || !rate) {
      return { success: false, message: 'Validasi Gagal: Tipe kaca tidak valid atau master tarif kaca tidak ditemukan.' };
    }
    if (payload.length_cm < 5 || payload.length_cm > 600 || payload.height_cm < 5 || payload.height_cm > 600) {
      return { success: false, message: 'Validasi Gagal: Dimensi kaca di luar batas operasional (minimal 5 cm, maksimal 600 cm).' };
    }
    if (payload.quantity < 1) {
      return { success: false, message: 'Validasi Gagal: Jumlah potongan kaca minimal 1 lembar.' };
    }

    const sqm = Math.round(((payload.length_cm * payload.height_cm) / 10000.0) * payload.quantity * 10000) / 10000;
    const glassPrice = Math.round(sqm * rate.price_per_sqm);
    const tipRatePct = rate.default_percentage || 0.03;
    // Approved rule: Glass tip = 3% of the glass price (without unapproved Rp1,000 rounding)
    const tipAmount = Math.round(glassPrice * tipRatePct);
    const refCode = `TIP-${unitId.substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    const newTip: GlassTip = {
      id: `tip-${Date.now()}`,
      unit_id: unitId,
      reference_code: refCode,
      employee_id: payload.employee_id || 'emp-001',
      glass_type_id: payload.glass_type_id,
      length_cm: payload.length_cm,
      height_cm: payload.height_cm,
      quantity: payload.quantity,
      calculated_sqm: sqm,
      glass_price_snapshot: glassPrice,
      tip_percentage_snapshot: tipRatePct,
      rounding_rule: 'EXACT',
      tip_amount: tipAmount,
      verified_amount: null,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      employee: { full_name: 'Pemotong Kaca Demo', employee_code: payload.employee_code } as Employee,
      glass_type: { id: payload.glass_type_id, unit_id: unitId, name: rate.name, code: payload.glass_type_id.toUpperCase(), thickness_mm: 5, is_active: true },
    };

    const currentTips = this.glassTips[unitId] || [];
    currentTips.unshift(newTip);
    this.glassTips[unitId] = currentTips;
    this.saveToStorage();

    return {
      success: true,
      message: '[SIMULASI PREVIEW] Pengajuan nota tip potong kaca berhasil disimpan (Status: PENDING).',
      reference_code: refCode,
      calculated_sqm: sqm,
      estimated_tip: tipAmount,
    };
  }

  public verifyGlassTip(unitId: string, tipId: string, verifiedAmount: number, action: 'VERIFY' | 'REJECT', _notes?: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, 'glass_tips.verify');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Memerlukan wewenang glass_tips.verify.' };
    }
    if (action === 'VERIFY' && (!verifiedAmount || verifiedAmount <= 0)) {
      return { success: false, message: 'Validasi Gagal: Nominal verifikasi tip wajib lebih besar dari 0.' };
    }
    const tips = this.glassTips[unitId] || [];
    const tip = tips.find(t => t.id === tipId);
    if (tip) {
      tip.status = action === 'VERIFY' ? 'VERIFIED' : 'REJECTED';
      tip.verified_amount = action === 'VERIFY' ? verifiedAmount : 0;
      this.saveToStorage();
      return { success: true, message: `[SIMULASI PREVIEW] Nota tip berhasil ${action === 'VERIFY' ? 'diverifikasi' : 'ditolak'}.` };
    }
    return { success: false, message: 'Nota tip tidak ditemukan.' };
  }

  // --- 6. VIOLATIONS & WARNING LETTERS (SP) ---
  public getViolations(unitId: string): ViolationRecord[] {
    this.initUnit(unitId);
    return this.violations[unitId] || [];
  }

  public recordViolation(unitId: string, record: any): { success: boolean; message: string } {
    this.initUnit(unitId);
    if (!record.employee_id || !record.description) {
      return { success: false, message: 'Validasi Gagal: Karyawan dan kronologi pelanggaran wajib diisi.' };
    }
    if (record.points_assigned !== undefined && record.points_assigned <= 0) {
      return { success: false, message: 'Validasi Gagal: Poin penalti pelanggaran harus lebih besar dari 0.' };
    }
    const newV: ViolationRecord = {
      id: `v-${Date.now()}`,
      unit_id: unitId,
      employee_id: record.employee_id,
      violation_type_id: record.violation_type_id || 'vt-01',
      incident_date: record.incident_date || new Date().toISOString().split('T')[0],
      description: record.description,
      points_assigned: record.points_assigned || 5,
      recorded_by: record.recorded_by || 'Supervisor Toko',
      created_at: new Date().toISOString(),
      employee: { full_name: 'Budi Santoso', employee_code: 'EMP-LATANSA-001' } as Employee,
      violation_type: { id: 'vt-01', unit_id: unitId, name: 'Pelanggaran Disiplin Operasional', code: 'DISC-1', points: 5, is_active: true },
    };
    const list = this.violations[unitId] || [];
    list.unshift(newV);
    this.violations[unitId] = list;
    this.saveToStorage();
    return { success: true, message: '[SIMULASI PREVIEW] Kejadian pelanggaran disiplin berhasil dicatat.' };
  }

  public getWarningLetters(unitId: string): WarningLetter[] {
    this.initUnit(unitId);
    return this.warningLetters[unitId] || [];
  }

  public issueWarningLetter(unitId: string, sp: any): { success: boolean; message: string } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, 'violations.issue_sp');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Penerbitan Surat Peringatan (SP) memerlukan wewenang Kepala Toko / Manajemen (violations.issue_sp).' };
    }
    if (!sp.employee_id || !sp.reason) {
      return { success: false, message: 'Validasi Gagal: Karyawan sasaran dan alasan penerbitan SP wajib diisi.' };
    }
    const issuedDate = sp.issued_date || new Date().toISOString().split('T')[0];
    const validUntil = calculateSpExpiryDate(issuedDate, 6);

    const newSP: WarningLetter = {
      id: `sp-${Date.now()}`,
      unit_id: unitId,
      employee_id: sp.employee_id,
      letter_number: `SP/${unitId.substring(0, 4).toUpperCase()}/${Date.now().toString().slice(-6)}`,
      level: sp.level || 'SP1',
      issued_date: issuedDate,
      valid_until: validUntil,
      reason: sp.reason,
      approval_status: 'APPROVED',
      issued_by: 'Kepala Toko',
      created_at: new Date().toISOString(),
      employee: { full_name: 'Budi Santoso', employee_code: 'EMP-LATANSA-001' } as Employee,
    };
    const list = this.warningLetters[unitId] || [];
    list.unshift(newSP);
    this.warningLetters[unitId] = list;
    this.saveToStorage();
    return { success: true, message: `[SIMULASI PREVIEW] Surat Peringatan (SP) berhasil diterbitkan (Status: BUSINESS DECISION REQUIRED - DRAFT SIMULASI ADMINISTRATIF - Masa berlaku referensi 6 bulan s.d. ${validUntil}, Tanpa Potongan Gaji Otomatis).` };
  }

  // --- 7. PAYROLL ---
  public getPayrollPeriods(unitId: string): PayrollPeriod[] {
    this.initUnit(unitId);
    return this.payrollPeriods[unitId] || [];
  }

  public createPayrollPeriod(unitId: string, payload: any): { success: boolean; message: string; period_id?: string } {
    this.initUnit(unitId);
    const newId = `pp-${Date.now()}`;
    const newPeriod: PayrollPeriod = {
      id: newId,
      unit_id: unitId,
      period_name: payload.period_name,
      start_date: payload.start_date,
      end_date: payload.end_date,
      payout_date: payload.payout_date,
      status: 'DRAFT',
      total_net_payout: 0,
      created_at: new Date().toISOString(),
    };
    const list = this.payrollPeriods[unitId] || [];
    list.unshift(newPeriod);
    this.payrollPeriods[unitId] = list;
    this.saveToStorage();
    return { success: true, message: '[SIMULASI PREVIEW] Periode penggajian baru berhasil dibuat (Status: DRAFT).', period_id: newId };
  }

  public finalizePayrollAtomic(unitId: string, periodId: string, finalizedBy: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, 'payroll.finalize');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Finalisasi penggajian memerlukan wewenang payroll.finalize.' };
    }
    const list = this.payrollPeriods[unitId] || [];
    const p = list.find(x => x.id === periodId);
    if (p) {
      if (p.status === 'FINALIZED') {
        return { success: false, message: 'Validasi Gagal: Periode penggajian telah difinalisasi dan dikunci secara permanen.' };
      }
      p.status = 'FINALIZED';
      p.finalized_at = new Date().toISOString();
      p.finalized_by = finalizedBy;
      this.saveToStorage();
      return { success: true, message: '[SIMULASI PREVIEW] Periode payroll berhasil dikunci dan difinalisasi secara permanen.' };
    }
    return { success: false, message: 'Periode penggajian tidak ditemukan.' };
  }

  // --- 8. CASH EXPENSES (PETTY CASH) ---
  public getCashExpenses(unitId: string): CashExpense[] {
    this.initUnit(unitId);
    return this.cashExpenses[unitId] || [];
  }

  public recordExpense(unitId: string, payload: any): { success: boolean; message: string; expense_id?: string } {
    this.initUnit(unitId);
    if (payload.amount === undefined || payload.amount === null || payload.amount <= 0) {
      return { success: false, message: 'Validasi Gagal: Nominal pengeluaran kas wajib lebih besar dari Rp0.' };
    }
    if (!payload.recipient_name || !payload.description) {
      return { success: false, message: 'Validasi Gagal: Penerima dana dan rincian transaksi wajib diisi.' };
    }
    const newExpId = `exp-${Date.now()}`;
    const newExp: CashExpense = {
      id: newExpId,
      unit_id: unitId,
      expense_number: `KAS-${unitId.substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      category: payload.category || 'OPERATIONAL',
      amount: payload.amount,
      description: payload.description,
      recipient_name: payload.recipient_name,
      expense_date: payload.expense_date || new Date().toISOString().split('T')[0],
      approval_status: 'PENDING',
      created_at: new Date().toISOString(),
    };
    const list = this.cashExpenses[unitId] || [];
    list.unshift(newExp);
    this.cashExpenses[unitId] = list;
    this.saveToStorage();
    return { success: true, message: '[SIMULASI PREVIEW] Pengeluaran kas berhasil dicatat (Status: PENDING menunggu persetujuan).', expense_id: newExpId };
  }

  public approveExpense(unitId: string, expenseId: string, approverName?: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, 'finance.approve');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Role Anda tidak memiliki wewenang menyetujui pengeluaran kas (finance.approve).' };
    }
    const list = this.cashExpenses[unitId] || [];
    const exp = list.find(e => e.id === expenseId);
    if (exp) {
      exp.approval_status = 'APPROVED';
      exp.approved_by_name = approverName || 'Kepala Toko';
      exp.approved_at = new Date().toISOString();
      this.saveToStorage();
      return { success: true, message: '[SIMULASI PREVIEW] Pengeluaran kas telah disetujui (Status: APPROVED).' };
    }
    return { success: false, message: 'Data pengeluaran kas tidak ditemukan.' };
  }

  public rejectExpense(unitId: string, expenseId: string, reason?: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const authCheck = validateDemoActor(unitId, 'finance.approve');
    if (!authCheck.allowed) {
      return { success: false, message: authCheck.reason || 'Akses Ditolak: Role Anda tidak memiliki wewenang menolak pengeluaran kas (finance.approve).' };
    }
    const list = this.cashExpenses[unitId] || [];
    const exp = list.find(e => e.id === expenseId);
    if (exp) {
      exp.approval_status = 'REJECTED';
      exp.rejection_reason = reason || 'Ditolak oleh manajemen';
      this.saveToStorage();
      return { success: true, message: `[SIMULASI PREVIEW] Pengeluaran kas telah ditolak${reason ? ': ' + reason : ''}.` };
    }
    return { success: false, message: 'Data pengeluaran kas tidak ditemukan.' };
  }

  // --- DEFAULT FIXTURE FACTORIES ---
  private createDefaultEmployees(unitId: string): Employee[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    if (isPalen) {
      return [
        {
          id: 'emp-palen-001',
          unit_id: unitId,
          department_id: 'dept-palen-01',
          position_id: 'pos-palen-01',
          work_schedule_id: 'sch-01',
          employee_code: 'EMP-PALEN-001',
          full_name: 'Rian Pratama',
          email: 'rian.pratama@kuk.co.id',
          phone: '085211223344',
          gender: 'L',
          marital_status: 'SINGLE',
          status: 'ACTIVE',
          employment_type: 'PKWTT',
          join_date: '2023-06-01',
          created_at: '2023-06-01T08:00:00Z',
          updated_at: '2026-11-01T08:00:00Z',
          department: { id: 'dept-palen-01', unit_id: unitId, code: 'GUDANG', name: 'Gudang & Logistik', is_active: true, created_at: '' },
          position: { id: 'pos-palen-01', unit_id: unitId, department_id: 'dept-palen-01', code: 'CUTTER', title: 'Tukang Potong Kaca', level: 2, is_active: true, created_at: '' },
          work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
        },
        {
          id: 'emp-palen-002',
          unit_id: unitId,
          department_id: 'dept-palen-02',
          position_id: 'pos-palen-02',
          work_schedule_id: 'sch-01',
          employee_code: 'EMP-PALEN-002',
          full_name: 'Dewi Lestari',
          email: 'dewi.lestari@kuk.co.id',
          phone: '085299887766',
          gender: 'P',
          marital_status: 'MARRIED',
          status: 'ACTIVE',
          employment_type: 'PKWT',
          join_date: '2024-01-10',
          created_at: '2024-01-10T08:00:00Z',
          updated_at: '2026-11-01T08:00:00Z',
          department: { id: 'dept-palen-02', unit_id: unitId, code: 'ADM', name: 'Administrasi & Keuangan', is_active: true, created_at: '' },
          position: { id: 'pos-palen-02', unit_id: unitId, department_id: 'dept-palen-02', code: 'KASIR', title: 'Kasir Toko', level: 3, allowed_leave_days_of_week: [0], is_active: true, created_at: '' },
          work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
        },
      ];
    }
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

  private createDefaultVehicles(unitId: string): Vehicle[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    if (isPalen) {
      return [
        {
          id: 'veh-palen-001',
          unit_id: unitId,
          license_plate: 'A 8123 PAL',
          brand: 'Daihatsu',
          model: 'GranMax Pick Up 1.5',
          year: 2023,
          type: 'PICKUP',
          status: 'AVAILABLE',
          is_active: true,
          created_at: '2023-03-10T08:00:00Z',
        },
        {
          id: 'veh-palen-002',
          unit_id: unitId,
          license_plate: 'A 8456 PAL',
          brand: 'Viar',
          model: 'Karya 150 Roda Tiga',
          year: 2022,
          type: 'MOTORCYCLE',
          status: 'AVAILABLE',
          is_active: true,
          created_at: '2022-07-15T08:00:00Z',
        },
      ];
    }
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
      {
        id: 'veh-003',
        unit_id: unitId,
        license_plate: 'B 9345 KUK',
        brand: 'Isuzu',
        model: 'Elf NMR 71 HD Truk Engkel',
        year: 2021,
        type: 'TRUCK',
        status: 'BORROWED',
        is_active: true,
        created_at: '2021-10-05T08:00:00Z',
      },
      {
        id: 'veh-004',
        unit_id: unitId,
        license_plate: 'FORKLIFT-KUK-01',
        brand: 'Toyota',
        model: '8FBN25 Electric Forklift 3-Ton',
        year: 2020,
        type: 'FORKLIFT' as any,
        status: 'AVAILABLE',
        is_active: true,
        created_at: '2020-04-18T08:00:00Z',
      },
      {
        id: 'veh-005',
        unit_id: unitId,
        license_plate: 'B 9789 KUK',
        brand: 'Viar',
        model: 'Karya 200 Roda Tiga',
        year: 2022,
        type: 'MOTORCYCLE',
        status: 'AVAILABLE',
        is_active: true,
        created_at: '2022-09-01T08:00:00Z',
      },
    ];
  }

  private createDefaultBorrowingRequests(unitId: string): VehicleBorrowingRequest[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    if (isPalen) {
      return [
        {
          id: 'vbr-palen-001',
          unit_id: unitId,
          vehicle_id: 'veh-palen-001',
          booking_code: 'FLEET-KUK-PALEN-202611-0001',
          borrower_name: 'Bambang S',
          borrower_institution: 'Internal Logistik Palen',
          borrower_phone: '085277889900',
          responsible_person: 'Kepala Toko Palen',
          start_time: '2026-11-06T09:00:00Z',
          estimated_return_time: '2026-11-06T15:00:00Z',
          destination: 'Pengiriman Kaca Proyek Rangkasbitung',
          purpose: 'Pengiriman pesanan kaca cermin 5mm konsumen.',
          status: 'APPROVED',
          approved_by: 'Kepala Toko Palen',
          approved_at: '2026-11-05T10:00:00Z',
          created_at: '2026-11-05T09:00:00Z',
          vehicle: { id: 'veh-palen-001', unit_id: unitId, license_plate: 'A 8123 PAL', brand: 'Daihatsu', model: 'GranMax Pick Up 1.5', year: 2023, type: 'PICKUP', status: 'AVAILABLE', is_active: true, created_at: '' },
        },
      ];
    }
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

  private createDefaultLeaveRequests(unitId: string): LeaveRequest[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    if (isPalen) {
      return [
        {
          id: 'leave-palen-001',
          unit_id: unitId,
          employee_id: 'emp-palen-002',
          request_number: 'CUTI-KUK-PALEN-202611-0001',
          target_month: '2026-11',
          total_days: 1,
          snapshot_employee_name: 'Dewi Lestari',
          snapshot_department_name: 'Administrasi & Keuangan',
          snapshot_position_title: 'Kasir Toko',
          reason: 'Keperluan keluarga mendesak.',
          status: 'APPROVED',
          auto_approved: true,
          created_at: '2026-11-01T09:30:00Z',
          updated_at: '2026-11-01T09:30:00Z',
          dates: [
            { id: 'ld-p-01', unit_id: unitId, leave_request_id: 'leave-palen-001', leave_date: '2026-11-08', is_sunday: true },
          ],
        },
      ];
    }
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

  private createDefaultGlassTips(unitId: string): GlassTip[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    if (isPalen) {
      return [
        {
          id: 'tip-palen-001',
          unit_id: unitId,
          reference_code: 'TIP-KUK-PALEN-202611-0001',
          employee_id: 'emp-palen-001',
          glass_type_id: 'gt-palen-01',
          length_cm: 100,
          height_cm: 200,
          quantity: 2,
          calculated_sqm: 4.0,
          glass_price_snapshot: 1100000,
          tip_percentage_snapshot: 0.03,
          rounding_rule: 'ROUND_UP_1000',
          tip_amount: 33000,
          verified_amount: 33000,
          status: 'VERIFIED',
          created_at: '2026-11-03T11:20:00Z',
          employee: { full_name: 'Rian Pratama', employee_code: 'EMP-PALEN-001' } as Employee,
          glass_type: { id: 'gt-palen-01', unit_id: unitId, name: 'Kaca Bening 5mm', code: 'KB-5MM', thickness_mm: 5, is_active: true },
        },
      ];
    }
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
        rounding_rule: 'EXACT',
        tip_amount: 28500,
        verified_amount: 28500,
        status: 'VERIFIED',
        created_at: '2026-11-03T11:20:00Z',
        employee: { full_name: 'Budi Santoso', employee_code: 'EMP-LATANSA-001' } as Employee,
        glass_type: { id: 'gt-01', unit_id: unitId, name: 'Kaca Polos 5mm', code: 'KP-5MM', thickness_mm: 5, is_active: true },
      },
    ];
  }

  private createDefaultViolations(unitId: string): ViolationRecord[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    return [
      {
        id: isPalen ? 'v-palen-001' : 'v-001',
        unit_id: unitId,
        employee_id: isPalen ? 'emp-palen-001' : 'emp-001',
        violation_type_id: isPalen ? 'vt-palen-01' : 'vt-01',
        incident_date: '2026-10-25',
        description: 'Terlambat lebih dari 30 menit tanpa pemberitahuan atasan.',
        points_assigned: 5,
        recorded_by: isPalen ? 'Supervisor KUK Palen' : 'Supervisor Operasional',
        created_at: '2026-10-25T10:00:00Z',
        employee: { full_name: isPalen ? 'Ahmad Fauzi' : 'Budi Santoso', employee_code: isPalen ? 'EMP-PALEN-001' : 'EMP-LATANSA-001' } as Employee,
        violation_type: { id: isPalen ? 'vt-palen-01' : 'vt-01', unit_id: unitId, name: 'Keterlambatan Tingkat Ringan', code: 'LATE-1', points: 5, is_active: true },
      },
    ];
  }

  private createDefaultWarningLetters(unitId: string): WarningLetter[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    return [
      {
        id: isPalen ? 'sp-palen-001' : 'sp-001',
        unit_id: unitId,
        employee_id: isPalen ? 'emp-palen-001' : 'emp-001',
        letter_number: isPalen ? 'SP/KUK-PALEN/202610/0001' : 'SP/TB-LATANSA/202610/0001',
        level: 'ORAL_WARNING',
        issued_date: '2026-10-26',
        valid_until: '2027-04-26',
        reason: 'Akumulasi poin keterlambatan mencapai batas evaluasi lisan.',
        approval_status: 'APPROVED',
        issued_by: isPalen ? 'Kepala Toko Palen' : 'Kepala Toko La Tansa',
        created_at: '2026-10-26T08:00:00Z',
        employee: { full_name: isPalen ? 'Ahmad Fauzi' : 'Budi Santoso', employee_code: isPalen ? 'EMP-PALEN-001' : 'EMP-LATANSA-001' } as Employee,
      },
    ];
  }

  private createDefaultBriefings(unitId: string): BriefingSession[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    return [
      {
        id: isPalen ? 'brf-palen-001' : 'brf-001',
        unit_id: unitId,
        session_date: '2026-11-05',
        session_time: '07:45:00',
        topic: isPalen ? 'Briefing Operasional Pelayanan Palen' : 'K3 Pemotongan Kaca & Pelayanan Konsumen Cepat',
        speaker_name: isPalen ? 'Manager KUK Palen' : 'Ahmad Ridwan (Manager Toko)',
        total_attendees: isPalen ? 8 : 12,
        created_at: '2026-11-05T07:45:00Z',
      },
    ];
  }

  private createDefaultPayrollPeriods(unitId: string): PayrollPeriod[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    return [
      {
        id: isPalen ? 'pp-palen-202610' : 'pp-202610',
        unit_id: unitId,
        period_name: isPalen ? 'Gaji Periode Oktober 2026 (Palen)' : 'Gaji Periode Oktober 2026 (La Tansa)',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        payout_date: '2026-11-01',
        status: 'FINALIZED',
        total_net_payout: isPalen ? 35000000 : 48500000,
        finalized_at: '2026-10-31T20:00:00Z',
        finalized_by: isPalen ? 'Manager Palen' : 'Manager Keuangan',
        created_at: '2026-10-01T08:00:00Z',
      },
    ];
  }

  private createDefaultCashExpenses(unitId: string): CashExpense[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    if (isPalen) {
      return [
        {
          id: 'exp-palen-001',
          unit_id: unitId,
          expense_number: 'KAS-PALEN-202611-001',
          category: 'OFFICE_SUPPLIES',
          amount: 120000,
          description: 'Pembelian kertas struk kasir & lakban packing KUK Palen',
          recipient_name: 'Toko ATK Palen Jaya',
          expense_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          approval_status: 'APPROVED',
          approved_by: 'usr-004',
          approved_by_name: 'Kepala Toko KUK Palen',
          approved_at: new Date(Date.now() - 80000000).toISOString(),
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ];
    }
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
    ];
  }
}

export const previewStore = new PreviewStore();
