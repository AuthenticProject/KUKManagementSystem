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
  PayrollRecord,
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
  private payrollRecords: Record<string, PayrollRecord[]> = {};
  private cashExpenses: Record<string, CashExpense[]> = {};
  private briefingSessions: Record<string, BriefingSession[]> = {};
  private sensitiveData: Record<string, EmployeeSensitiveData> = {};
  private attendanceRecords: Record<string, AttendanceDailyRecord[]> = {};
  private jobHistories: Record<string, EmployeeJobHistory[]> = {};
  private departments: Record<string, Department[]> = {};
  private positions: Record<string, Position[]> = {};
  private glassRates: Record<string, any[]> = {};
  private workSchedules: Record<string, WorkSchedule[]> = {};
  private initialized: boolean = false;

  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    return null;
  }

  private saveToStorage(): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem('KUK_STORE_LIVE_V3_1', JSON.stringify({
        employees: this.employees,
        vehicles: this.vehicles,
        borrowingRequests: this.borrowingRequests,
        leaveRequests: this.leaveRequests,
        glassTips: this.glassTips,
        violations: this.violations,
        warningLetters: this.warningLetters,
        payrollPeriods: this.payrollPeriods,
        payrollRecords: this.payrollRecords,
        cashExpenses: this.cashExpenses,
        briefingSessions: this.briefingSessions,
        sensitiveData: this.sensitiveData,
        attendanceRecords: this.attendanceRecords,
        jobHistories: this.jobHistories,
        departments: this.departments,
        positions: this.positions,
        glassRates: this.glassRates,
        workSchedules: this.workSchedules,
      }));
    } catch {
      // safe fallback
    }
  }

  private loadFromStorage(): boolean {
    const storage = this.getStorage();
    if (!storage) return false;
    try {
      const raw = storage.getItem('KUK_STORE_LIVE_V3_1');
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
        this.payrollRecords = parsed.payrollRecords || {};
        this.cashExpenses = parsed.cashExpenses || {};
        this.briefingSessions = parsed.briefingSessions || {};
        this.sensitiveData = parsed.sensitiveData || {};
        this.attendanceRecords = parsed.attendanceRecords || {};
        this.jobHistories = parsed.jobHistories || {};
        this.departments = parsed.departments || {};
        this.positions = parsed.positions || {};
        this.glassRates = parsed.glassRates || {};
        this.workSchedules = parsed.workSchedules || {};
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
    if (!this.departments[unitId]) this.departments[unitId] = this.createDefaultDepartments(unitId);
    if (!this.positions[unitId]) this.positions[unitId] = this.createDefaultPositions(unitId);
    if (!this.glassRates[unitId]) this.glassRates[unitId] = this.createDefaultGlassRates(unitId);
    if (!this.workSchedules[unitId]) this.workSchedules[unitId] = this.createDefaultWorkSchedules(unitId);
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
    this.payrollRecords = {};
    this.cashExpenses = {};
    this.briefingSessions = {};
    this.sensitiveData = {};
    this.attendanceRecords = {};
    this.departments = {};
    this.positions = {};
    this.glassRates = {};
    this.workSchedules = {};
    this.initialized = false;
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem('KUK_STORE_LIVE_V3_1');
      storage.removeItem('KUK_PREVIEW_STORE_V1');
    }
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
    this.initUnit(unitId);
    return this.departments[unitId] || [];
  }

  public saveDepartment(unitId: string, dept: Partial<Department>): { success: boolean; message: string; department?: Department } {
    this.initUnit(unitId);
    const list = [...this.getDepartments(unitId)];
    if (!dept.name || !dept.name.trim()) return { success: false, message: 'Nama departemen wajib diisi.' };
    const id = dept.id || `dept-${Date.now()}`;
    const code = (dept.code || dept.name.toUpperCase().replace(/\s+/g, '_').slice(0, 10)).trim();
    const existingIdx = list.findIndex(d => d.id === id);
    const item: Department = {
      id,
      unit_id: unitId,
      code,
      name: dept.name.trim(),
      is_active: dept.is_active !== undefined ? dept.is_active : true,
      created_at: new Date().toISOString(),
    };
    if (existingIdx >= 0) list[existingIdx] = item;
    else list.push(item);
    this.departments[unitId] = list;
    this.saveToStorage();
    return { success: true, message: `Departemen "${item.name}" berhasil disimpan.`, department: item };
  }

  public deleteDepartment(unitId: string, deptId: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const list = this.getDepartments(unitId).filter(d => d.id !== deptId);
    this.departments[unitId] = list;
    this.saveToStorage();
    return { success: true, message: 'Departemen berhasil dihapus.' };
  }

  public getPositions(unitId: string): Position[] {
    this.initUnit(unitId);
    return this.positions[unitId] || [];
  }

  public savePosition(unitId: string, pos: Partial<Position>): { success: boolean; message: string; position?: Position } {
    this.initUnit(unitId);
    const list = [...this.getPositions(unitId)];
    if (!pos.title || !pos.title.trim()) return { success: false, message: 'Judul jabatan wajib diisi.' };
    const id = pos.id || `pos-${Date.now()}`;
    const code = (pos.code || pos.title.toUpperCase().replace(/\s+/g, '_').slice(0, 10)).trim();
    const existingIdx = list.findIndex(p => p.id === id);
    const item: Position = {
      id,
      unit_id: unitId,
      department_id: pos.department_id || 'dept-01',
      code,
      title: pos.title.trim(),
      level: pos.level || 2,
      is_active: pos.is_active !== undefined ? pos.is_active : true,
      allowed_leave_days_of_week: pos.allowed_leave_days_of_week,
      created_at: new Date().toISOString(),
    };
    if (existingIdx >= 0) list[existingIdx] = item;
    else list.push(item);
    this.positions[unitId] = list;
    this.saveToStorage();
    return { success: true, message: `Jabatan "${item.title}" berhasil disimpan.`, position: item };
  }

  public deletePosition(unitId: string, posId: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const list = this.getPositions(unitId).filter(p => p.id !== posId);
    this.positions[unitId] = list;
    this.saveToStorage();
    return { success: true, message: 'Jabatan berhasil dihapus.' };
  }

  public getGlassRates(unitId: string): any[] {
    this.initUnit(unitId);
    return this.glassRates[unitId] || [];
  }

  public saveGlassRate(unitId: string, rate: { id?: string; name: string; thickness_mm?: number; price_per_sqm: number; default_percentage?: number; is_active?: boolean }): { success: boolean; message: string; rate?: any } {
    this.initUnit(unitId);
    const list = [...this.getGlassRates(unitId)];
    if (!rate.name || !rate.name.trim()) return { success: false, message: 'Nama jenis kaca wajib diisi.' };
    if (!rate.price_per_sqm || rate.price_per_sqm <= 0) return { success: false, message: 'Harga dasar per m² wajib lebih dari 0.' };
    const id = rate.id || `gt-${Date.now()}`;
    const existingIdx = list.findIndex(r => r.id === id);
    const item = {
      id,
      unit_id: unitId,
      name: rate.name.trim(),
      thickness_mm: rate.thickness_mm || 5,
      price_per_sqm: Number(rate.price_per_sqm),
      default_percentage: rate.default_percentage !== undefined ? rate.default_percentage : 0.03,
      is_active: rate.is_active !== undefined ? rate.is_active : true,
    };
    if (existingIdx >= 0) list[existingIdx] = item;
    else list.push(item);
    this.glassRates[unitId] = list;
    this.saveToStorage();
    return { success: true, message: `Tarif kaca "${item.name}" berhasil disimpan.`, rate: item };
  }

  public deleteGlassRate(unitId: string, rateId: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const list = this.getGlassRates(unitId).filter(r => r.id !== rateId);
    this.glassRates[unitId] = list;
    this.saveToStorage();
    return { success: true, message: 'Jenis kaca berhasil dihapus.' };
  }

  public getWorkSchedules(unitId: string): WorkSchedule[] {
    this.initUnit(unitId);
    return this.workSchedules[unitId] || [];
  }

  public saveWorkSchedule(unitId: string, sch: Partial<WorkSchedule>): { success: boolean; message: string; schedule?: WorkSchedule } {
    this.initUnit(unitId);
    const list = [...this.getWorkSchedules(unitId)];
    if (!sch.name || !sch.name.trim()) return { success: false, message: 'Nama jadwal kerja wajib diisi.' };
    const id = sch.id || `sch-${Date.now()}`;
    const existingIdx = list.findIndex(s => s.id === id);
    const item: WorkSchedule = {
      id,
      unit_id: unitId,
      name: sch.name.trim(),
      start_time: sch.start_time || '08:00',
      end_time: sch.end_time || '17:00',
      late_tolerance_minutes: sch.late_tolerance_minutes !== undefined ? sch.late_tolerance_minutes : 15,
      is_active: sch.is_active !== undefined ? sch.is_active : true,
    };
    if (existingIdx >= 0) list[existingIdx] = item;
    else list.push(item);
    this.workSchedules[unitId] = list;
    this.saveToStorage();
    return { success: true, message: `Jadwal kerja "${item.name}" berhasil disimpan.`, schedule: item };
  }

  public deleteWorkSchedule(unitId: string, schId: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    const list = this.getWorkSchedules(unitId).filter(s => s.id !== schId);
    this.workSchedules[unitId] = list;
    this.saveToStorage();
    return { success: true, message: 'Jadwal kerja berhasil dihapus.' };
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

    const posObj = (this.positions[unitId] || []).find(p => p.id === employee.position_id);
    const deptObj = (this.departments[unitId] || []).find(d => d.id === employee.department_id);

    if (employee.id) {
      const idx = currentList.findIndex(e => e.id === employee.id);
      if (idx >= 0) {
        currentList[idx] = {
          ...currentList[idx],
          ...employee,
          position: posObj || currentList[idx].position,
          department: deptObj || currentList[idx].department,
          updated_at: new Date().toISOString()
        } as Employee;
      } else {
        currentList.push({
          ...employee,
          position: posObj,
          department: deptObj,
          unit_id: unitId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as Employee);
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
        department: deptObj || { id: employee.department_id || 'dept-01', unit_id: unitId, code: 'OPERASIONAL', name: 'Operasional Lapangan', is_active: true, created_at: '' },
        position: posObj || { id: employee.position_id || 'pos-01', unit_id: unitId, department_id: employee.department_id || 'dept-01', code: 'STAFF', title: 'Staf Operasional', level: 1, is_active: true, created_at: '' },
        work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      };
      currentList.push(newEmp);
    }
    this.employees[unitId] = currentList;
    this.saveToStorage();
    return { success: true, message: 'Data karyawan berhasil disimpan.' };
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
      return { success: true, message: `Status karyawan berhasil diperbarui menjadi ${status} (Anti-hard-delete terjamin).` };
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
    return { success: true, message: 'Data sensitif karyawan berhasil disimpan.' };
  }

  public resetKioskPin(unitId: string, _employeeId: string, newPin: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    if (!newPin || newPin.length !== 6 || !/^[0-9]{6}$/.test(newPin)) {
      return { success: false, message: 'Validasi Gagal: PIN Kiosk wajib berupa 6 digit angka numerik.' };
    }
    return { success: true, message: 'PIN Kiosk karyawan berhasil direset.' };
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
      message: `Perubahan jabatan (${payload.transition_type}) berhasil dicatat.`,
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
    return { success: true, message: 'Sesi briefing berhasil dicatat.' };
  }

  public recordDailyBriefingAttendance(unitId: string, payload: {
    session_date: string;
    session_time: string;
    speaker_name: string;
    topic: string;
    records: Array<{
      employee_id: string;
      status: AttendanceStatus;
      check_in_time?: string;
      notes?: string;
    }>;
  }): { success: boolean; message: string; session_id?: string } {
    this.initUnit(unitId);
    if (!payload.topic || !payload.topic.trim()) {
      return { success: false, message: 'Validasi Gagal: Topik pengarahan briefing wajib diisi.' };
    }
    const sessionId = `brf-${Date.now()}`;
    const newSession: BriefingSession = {
      id: sessionId,
      unit_id: unitId,
      session_date: payload.session_date,
      session_time: payload.session_time || '07:45:00',
      topic: payload.topic.trim(),
      speaker_name: payload.speaker_name || 'Kepala Toko / Supervisor',
      total_attendees: payload.records.filter(r => r.status === 'PRESENT').length,
      created_at: new Date().toISOString(),
    };

    // Update briefing sessions list
    const bList = this.briefingSessions[unitId] || [];
    const bIdx = bList.findIndex(b => b.session_date === payload.session_date);
    if (bIdx >= 0) {
      bList[bIdx] = newSession;
    } else {
      bList.unshift(newSession);
    }
    this.briefingSessions[unitId] = bList;

    // Update daily attendance records for this date
    const dateKey = `${unitId}_${payload.session_date}`;
    const employees = this.getEmployees(unitId);
    const existingDayRecords = this.attendanceRecords[dateKey] || [];

    const updatedRecords: AttendanceDailyRecord[] = payload.records.map((r, idx) => {
      const emp = employees.find(e => e.id === r.employee_id);
      const prev = existingDayRecords.find(dr => dr.employee_id === r.employee_id);
      return {
        id: prev?.id || `att-${Date.now()}-${idx}`,
        unit_id: unitId,
        employee_id: r.employee_id,
        attendance_date: payload.session_date,
        check_in_time: r.status === 'PRESENT' ? (r.check_in_time || '07:45:00') : (null as any),
        check_out_time: r.status === 'PRESENT' ? (prev?.check_out_time || '17:00:00') : (null as any),
        status: r.status,
        source: 'BRIEFING' as any,
        late_minutes: 0,
        notes: r.notes,
        employee: emp || ({ full_name: 'Karyawan KUK', employee_code: 'EMP' } as Employee),
      };
    });

    this.attendanceRecords[dateKey] = updatedRecords;
    this.saveToStorage();

    return {
      success: true,
      message: `Rekap presensi briefing tanggal ${payload.session_date} untuk ${updatedRecords.length} karyawan berhasil disimpan!`,
      session_id: sessionId,
    };
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
    return { success: true, message: 'Koreksi presensi manual berhasil disimpan dengan jejak audit supervisor.' };
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
      message: `Berhasil mengimpor ${importedCount} catatan log presensi fingerprint.`,
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

    if (!payload.bypass_window && (today < windowOpen || today > windowClose)) {
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
        ? `Permohonan cuti diajukan (Status: PENDING - Terdapat bentrok jadwal cuti departemen dengan ${conflictColleague}).`
        : 'Pengajuan cuti disetujui otomatis (Status: APPROVED).',
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
      return { success: true, message: `Permohonan cuti berhasil diubah statusnya menjadi ${status}.` };
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
    if (vehicle.id) {
      const idx = list.findIndex(x => x.id === vehicle.id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          ...vehicle,
          license_plate: vehicle.license_plate || list[idx].license_plate,
          brand: vehicle.brand || list[idx].brand,
          model: vehicle.model || list[idx].model,
          year: vehicle.year ?? list[idx].year,
          type: vehicle.type || list[idx].type,
          status: vehicle.status || list[idx].status,
        };
        this.vehicles[unitId] = list;
        this.saveToStorage();
        return { success: true, message: 'Data armada kendaraan berhasil diperbarui.' };
      }
    }
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
    return { success: true, message: 'Kendaraan armada berhasil didaftarkan.' };
  }

  public deleteVehicle(unitId: string, vehicleId: string): { success: boolean; message: string } {
    this.initUnit(unitId);
    this.vehicles[unitId] = (this.vehicles[unitId] || []).filter(x => x.id !== vehicleId);
    this.saveToStorage();
    return { success: true, message: 'Armada kendaraan berhasil dihapus.' };
  }

  public updateVehicleStatus(unitId: string, vehicleId: string, status: VehicleStatus): { success: boolean; message: string } {
    this.initUnit(unitId);
    const vehicles = this.vehicles[unitId] || [];
    const v = vehicles.find(x => x.id === vehicleId);
    if (v) {
      v.status = status;
      this.saveToStorage();
      return { success: true, message: `Status kendaraan diperbarui menjadi ${status}.` };
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
      message: 'Pengajuan peminjaman armada berhasil dicatat (Status: PENDING).',
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
      return { success: true, message: 'Peminjaman armada disetujui (Status: APPROVED).' };
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
      return { success: true, message: `Peminjaman armada ditolak${reason ? ': ' + reason : ''}.` };
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
        ? `Pengembalian armada dicatat. Berdasarkan penilaian petugas (${payload.inspector_name || 'Petugas'}), armada dinyatakan TIDAK LAYAK JALAN dan dialihkan ke MAINTENANCE.`
        : 'Pengembalian armada dicatat. Berdasarkan penilaian petugas, armada dinyatakan LAYAK OPERASIONAL dan berstatus AVAILABLE.',
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

    const ratesList = this.getGlassRates(unitId);
    const matchedFromStore = ratesList.find(r => r.id === payload.glass_type_id);
    const rate = matchedFromStore
      ? { price_per_sqm: matchedFromStore.price_per_sqm, default_percentage: matchedFromStore.default_percentage || 0.03, name: matchedFromStore.name }
      : masterRates[payload.glass_type_id];

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
      message: 'Pengajuan nota tip potong kaca berhasil disimpan (Status: PENDING).',
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
      return { success: true, message: `Nota tip berhasil ${action === 'VERIFY' ? 'diverifikasi' : 'ditolak'}.` };
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
    return { success: true, message: 'Kejadian pelanggaran disiplin berhasil dicatat.' };
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
    return { success: true, message: `Surat Peringatan (SP) berhasil diterbitkan (Status: BUSINESS DECISION REQUIRED - DRAFT SIMULASI ADMINISTRATIF - Masa berlaku referensi 6 bulan s.d. ${validUntil}, Tanpa Potongan Gaji Otomatis).` };
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
    return { success: true, message: 'Periode penggajian baru berhasil dibuat (Status: DRAFT).', period_id: newId };
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
      return { success: true, message: 'Periode payroll berhasil dikunci dan difinalisasi secara permanen.' };
    }
    return { success: false, message: 'Periode penggajian tidak ditemukan.' };
  }

  public getPayrollRecords(periodId: string, unitId: string = '00000000-0000-0000-0000-000000000001'): PayrollRecord[] {
    if (!this.payrollRecords[periodId] || this.payrollRecords[periodId].length === 0) {
      this.initUnit(unitId);
      const emps = this.employees[unitId] || [];
      if (emps.length === 0) {
        this.payrollRecords[periodId] = [
          {
            id: `pr-1-${periodId}`,
            unit_id: unitId,
            payroll_period_id: periodId,
            employee_id: 'emp-1',
            slip_number: `SLIP-${periodId.substring(0, 8)}-0001`,
            snapshot_employee_name: 'Budi Santoso',
            snapshot_department_name: 'Gudang & Logistik',
            snapshot_position_title: 'Sopir & Pemotong Kaca',
            total_earnings: 3850000,
            total_deductions: 100000,
            net_salary: 3750000,
            payment_status: 'PAID',
            created_at: new Date().toISOString(),
            items: [
              { id: `it-1-1`, unit_id: unitId, payroll_record_id: `pr-1-${periodId}`, component_name: 'Gaji Pokok', component_type: 'ALLOWANCE', amount: 3200000 },
              { id: `it-1-2`, unit_id: unitId, payroll_record_id: `pr-1-${periodId}`, component_name: 'Gaji Bagian', component_type: 'ALLOWANCE', amount: 350000 },
              { id: `it-1-3`, unit_id: unitId, payroll_record_id: `pr-1-${periodId}`, component_name: 'Tip Kaca (3%)', component_type: 'ALLOWANCE', amount: 300000 },
              { id: `it-1-4`, unit_id: unitId, payroll_record_id: `pr-1-${periodId}`, component_name: 'Potongan Lain / Kasbon', component_type: 'DEDUCTION', amount: 100000 },
            ],
          },
        ];
      } else {
        this.payrollRecords[periodId] = emps.map((emp, idx) => {
          const base = 2800000 + idx * 150000;
          const bagian = 350000;
          const hadiah = 200000;
          const tip = idx % 2 === 0 ? 300000 : 0;
          const tunjKel = emp.marital_status === 'MARRIED' ? 250000 : 0;
          const bonus = 100000;
          const totalEarn = base + bagian + hadiah + tip + tunjKel + bonus;
          const potongan = 50000;
          const net = totalEarn - potongan;
          return {
            id: `pr-${emp.id}-${periodId}`,
            unit_id: emp.unit_id || unitId,
            payroll_period_id: periodId,
            employee_id: emp.id,
            slip_number: `SLIP-${emp.employee_code || idx + 1}-${periodId.substring(0, 6)}`,
            snapshot_employee_name: emp.full_name,
            snapshot_department_name: emp.department?.name || 'Operasional',
            snapshot_position_title: emp.position?.title || 'Staf',
            total_earnings: totalEarn,
            total_deductions: potongan,
            net_salary: net,
            payment_status: 'PENDING_PAYMENT',
            created_at: new Date().toISOString(),
            items: [
              { id: `it-1-${emp.id}`, unit_id: emp.unit_id || unitId, payroll_record_id: `pr-${emp.id}-${periodId}`, component_name: 'Gaji Pokok', component_type: 'ALLOWANCE', amount: base },
              { id: `it-2-${emp.id}`, unit_id: emp.unit_id || unitId, payroll_record_id: `pr-${emp.id}-${periodId}`, component_name: 'Gaji Bagian', component_type: 'ALLOWANCE', amount: bagian },
              { id: `it-3-${emp.id}`, unit_id: emp.unit_id || unitId, payroll_record_id: `pr-${emp.id}-${periodId}`, component_name: 'Hadiah Pondok', component_type: 'ALLOWANCE', amount: hadiah },
              { id: `it-4-${emp.id}`, unit_id: emp.unit_id || unitId, payroll_record_id: `pr-${emp.id}-${periodId}`, component_name: 'Tip Kaca (3%)', component_type: 'ALLOWANCE', amount: tip },
              { id: `it-5-${emp.id}`, unit_id: emp.unit_id || unitId, payroll_record_id: `pr-${emp.id}-${periodId}`, component_name: 'Tunjangan Keluarga', component_type: 'ALLOWANCE', amount: tunjKel },
              { id: `it-6-${emp.id}`, unit_id: emp.unit_id || unitId, payroll_record_id: `pr-${emp.id}-${periodId}`, component_name: 'Bonus Tambahan', component_type: 'BONUS', amount: bonus },
              { id: `it-7-${emp.id}`, unit_id: emp.unit_id || unitId, payroll_record_id: `pr-${emp.id}-${periodId}`, component_name: 'Potongan Lain / Kasbon', component_type: 'DEDUCTION', amount: potongan },
            ],
          };
        });
      }
      this.saveToStorage();
    }
    return this.payrollRecords[periodId] || [];
  }

  public updatePayrollRecord(
    periodId: string,
    recordId: string,
    updates: {
      baseSalary: number;
      gajiBagian: number;
      hadiahPondok: number;
      tipKaca: number;
      tunjanganKeluarga: number;
      insentifCuti: number;
      bonusIncentive: number;
      otherDeductions: number;
      absentCount: number;
    }
  ): { success: boolean; message: string; record?: PayrollRecord } {
    const list = this.getPayrollRecords(periodId);
    const rec = list.find((r) => r.id === recordId);
    if (!rec) return { success: false, message: 'Slip gaji tidak ditemukan.' };

    const absentDeduction = updates.absentCount * 28500;
    const totalEarnings =
      Number(updates.baseSalary || 0) +
      Number(updates.gajiBagian || 0) +
      Number(updates.hadiahPondok || 0) +
      Number(updates.tipKaca || 0) +
      Number(updates.tunjanganKeluarga || 0) +
      Number(updates.insentifCuti || 0) +
      Number(updates.bonusIncentive || 0);
    const totalDeductions = Number(updates.otherDeductions || 0) + absentDeduction;
    const netSalary = totalEarnings - totalDeductions;

    rec.total_earnings = totalEarnings;
    rec.total_deductions = totalDeductions;
    rec.net_salary = netSalary;
    rec.items = [
      { id: `it-1-${recordId}`, unit_id: rec.unit_id, payroll_record_id: rec.id, component_name: 'Gaji Pokok', component_type: 'ALLOWANCE', amount: updates.baseSalary },
      { id: `it-2-${recordId}`, unit_id: rec.unit_id, payroll_record_id: rec.id, component_name: 'Gaji Bagian', component_type: 'ALLOWANCE', amount: updates.gajiBagian },
      { id: `it-3-${recordId}`, unit_id: rec.unit_id, payroll_record_id: rec.id, component_name: 'Hadiah Pondok', component_type: 'ALLOWANCE', amount: updates.hadiahPondok },
      { id: `it-4-${recordId}`, unit_id: rec.unit_id, payroll_record_id: rec.id, component_name: 'Tip Kaca (3%)', component_type: 'ALLOWANCE', amount: updates.tipKaca },
      { id: `it-5-${recordId}`, unit_id: rec.unit_id, payroll_record_id: rec.id, component_name: 'Tunjangan Keluarga', component_type: 'ALLOWANCE', amount: updates.tunjanganKeluarga },
      { id: `it-6-${recordId}`, unit_id: rec.unit_id, payroll_record_id: rec.id, component_name: 'Insentif Cuti', component_type: 'ALLOWANCE', amount: updates.insentifCuti },
      { id: `it-7-${recordId}`, unit_id: rec.unit_id, payroll_record_id: rec.id, component_name: 'Bonus Tambahan', component_type: 'BONUS', amount: updates.bonusIncentive },
      { id: `it-8-${recordId}`, unit_id: rec.unit_id, payroll_record_id: rec.id, component_name: 'Potongan Absensi / Alpa', component_type: 'DEDUCTION', amount: absentDeduction },
      { id: `it-9-${recordId}`, unit_id: rec.unit_id, payroll_record_id: rec.id, component_name: 'Potongan Lain / Kasbon', component_type: 'DEDUCTION', amount: updates.otherDeductions },
    ];

    // Update parent period total
    Object.keys(this.payrollPeriods).forEach((uId) => {
      const p = this.payrollPeriods[uId]?.find((x) => x.id === periodId);
      if (p) {
        p.total_net_payout = list.reduce((sum, item) => sum + item.net_salary, 0);
      }
    });

    this.saveToStorage();
    return { success: true, message: `Data gaji "${rec.snapshot_employee_name}" berhasil diperbarui!`, record: rec };
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
    return { success: true, message: 'Pengeluaran kas berhasil dicatat (Status: PENDING menunggu persetujuan).', expense_id: newExpId };
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
      return { success: true, message: 'Pengeluaran kas telah disetujui (Status: APPROVED).' };
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
      return { success: true, message: `Pengeluaran kas telah ditolak${reason ? ': ' + reason : ''}.` };
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
          full_name: 'Miftah',
          email: 'miftah@kuk.co.id',
          phone: '085202001301',
          gender: 'L',
          marital_status: 'SINGLE',
          status: 'ACTIVE',
          employment_type: 'PKWTT',
          join_date: '2023-10-15',
          created_at: '2023-10-15T08:00:00Z',
          updated_at: '2026-11-01T08:00:00Z',
          department: { id: 'dept-palen-01', unit_id: unitId, code: 'GUDANG', name: 'Kepala Gudang & Logistik', is_active: true, created_at: '' },
          position: { id: 'pos-palen-01', unit_id: unitId, department_id: 'dept-palen-01', code: 'KEPALA_GUDANG', title: 'Kepala Gudang', level: 2, is_active: true, created_at: '' },
          work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
        },
        {
          id: 'emp-palen-002',
          unit_id: unitId,
          department_id: 'dept-palen-02',
          position_id: 'pos-palen-02',
          work_schedule_id: 'sch-01',
          employee_code: 'EMP-PALEN-002',
          full_name: 'Nukul',
          email: 'nukul@kuk.co.id',
          phone: '085202001202',
          gender: 'L',
          marital_status: 'SINGLE',
          status: 'ACTIVE',
          employment_type: 'PKWT',
          join_date: '2023-10-01',
          created_at: '2023-10-01T08:00:00Z',
          updated_at: '2026-11-01T08:00:00Z',
          department: { id: 'dept-palen-02', unit_id: unitId, code: 'TOKO', name: 'Kepala Toko & Manajemen', is_active: true, created_at: '' },
          position: { id: 'pos-palen-02', unit_id: unitId, department_id: 'dept-palen-02', code: 'KEPALA_TOKO', title: 'Kepala Toko', level: 1, allowed_leave_days_of_week: [0, 1, 2, 3, 4, 5, 6], is_active: true, created_at: '' },
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
        full_name: 'Wiba Sepdioko',
        email: 'wiba@kuk.co.id',
        phone: '081234567890',
        gender: 'L',
        marital_status: 'MARRIED',
        status: 'ACTIVE',
        employment_type: 'PKWTT',
        join_date: '2023-01-01',
        created_at: '2023-01-01T08:00:00Z',
        updated_at: '2026-11-01T08:00:00Z',
        department: { id: 'dept-01', unit_id: unitId, code: 'GUDANG', name: 'Gudang & Logistik', is_active: true, created_at: '' },
        position: { id: 'pos-01', unit_id: unitId, department_id: 'dept-01', code: 'ADM2', title: 'Admin 2 (Operasional)', level: 2, is_active: true, created_at: '' },
        work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      },
      {
        id: 'emp-002',
        unit_id: unitId,
        department_id: 'dept-02',
        position_id: 'pos-02',
        work_schedule_id: 'sch-01',
        employee_code: 'EMP-LATANSA-002',
        full_name: 'Muhammad Irvan',
        email: 'irvan@kuk.co.id',
        phone: '081298765432',
        gender: 'L',
        marital_status: 'MARRIED',
        status: 'ACTIVE',
        employment_type: 'PKWT',
        join_date: '2023-09-01',
        created_at: '2023-09-01T08:00:00Z',
        updated_at: '2026-11-01T08:00:00Z',
        department: { id: 'dept-02', unit_id: unitId, code: 'ADM', name: 'Administrasi', is_active: true, created_at: '' },
        position: { id: 'pos-02', unit_id: unitId, department_id: 'dept-02', code: 'ADM3', title: 'Admin 3 (Operasional Toko)', level: 3, allowed_leave_days_of_week: [0], is_active: true, created_at: '' },
        work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      },
      {
        id: 'emp-latansa-003',
        unit_id: unitId,
        department_id: 'dept-03',
        position_id: 'pos-03',
        work_schedule_id: 'sch-01',
        employee_code: 'K-004',
        full_name: 'Irfan Ulinnuha (Ulin)',
        email: 'ulin@kuk.co.id',
        phone: '081235550004',
        gender: 'L',
        marital_status: 'MARRIED',
        status: 'ACTIVE',
        employment_type: 'PKWTT',
        join_date: '2022-05-10',
        created_at: '2022-05-10T08:00:00Z',
        updated_at: '2026-11-01T08:00:00Z',
        department: { id: 'dept-03', unit_id: unitId, code: 'TOKO', name: 'Kepala Toko', is_active: true, created_at: '' },
        position: { id: 'pos-03', unit_id: unitId, department_id: 'dept-03', code: 'KEPALA_TOKO', title: 'Kepala Toko La Tansa', level: 1, is_active: true, created_at: '' },
        work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      },
      {
        id: 'emp-latansa-004',
        unit_id: unitId,
        department_id: 'dept-04',
        position_id: 'pos-04',
        work_schedule_id: 'sch-01',
        employee_code: 'K-005',
        full_name: 'Syirojul Kahfi',
        email: 'kahfi@kuk.co.id',
        phone: '081235550005',
        gender: 'L',
        marital_status: 'SINGLE',
        status: 'ACTIVE',
        employment_type: 'PKWT',
        join_date: '2023-03-15',
        created_at: '2023-03-15T08:00:00Z',
        updated_at: '2026-11-01T08:00:00Z',
        department: { id: 'dept-04', unit_id: unitId, code: 'KASIR', name: 'Kasir', is_active: true, created_at: '' },
        position: { id: 'pos-04', unit_id: unitId, department_id: 'dept-04', code: 'KASIR', title: 'Kasir Toko', level: 3, is_active: true, created_at: '' },
        work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      },
      {
        id: 'emp-latansa-005',
        unit_id: unitId,
        department_id: 'dept-01',
        position_id: 'pos-05',
        work_schedule_id: 'sch-01',
        employee_code: 'K-006',
        full_name: 'Nur Hadi (Nur)',
        email: 'nurhadi@kuk.co.id',
        phone: '081235550006',
        gender: 'L',
        marital_status: 'MARRIED',
        status: 'ACTIVE',
        employment_type: 'PKWTT',
        join_date: '2021-08-20',
        created_at: '2021-08-20T08:00:00Z',
        updated_at: '2026-11-01T08:00:00Z',
        department: { id: 'dept-01', unit_id: unitId, code: 'GUDANG', name: 'Kepala Gudang', is_active: true, created_at: '' },
        position: { id: 'pos-05', unit_id: unitId, department_id: 'dept-01', code: 'KEPALA_GUDANG', title: 'Kepala Gudang La Tansa', level: 2, is_active: true, created_at: '' },
        work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      },
      {
        id: 'emp-latansa-006',
        unit_id: unitId,
        department_id: 'dept-05',
        position_id: 'pos-06',
        work_schedule_id: 'sch-01',
        employee_code: 'K-007',
        full_name: 'Alip Rejeki',
        email: 'alip@kuk.co.id',
        phone: '081235550007',
        gender: 'L',
        marital_status: 'SINGLE',
        status: 'ACTIVE',
        employment_type: 'PKWT',
        join_date: '2023-06-01',
        created_at: '2023-06-01T08:00:00Z',
        updated_at: '2026-11-01T08:00:00Z',
        department: { id: 'dept-05', unit_id: unitId, code: 'LOGISTIK', name: 'Pengiriman & Logistik', is_active: true, created_at: '' },
        position: { id: 'pos-06', unit_id: unitId, department_id: 'dept-05', code: 'DRIVER', title: 'Sopir Pengiriman Logistik', level: 3, is_active: true, created_at: '' },
        work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      },
      {
        id: 'emp-latansa-007',
        unit_id: unitId,
        department_id: 'dept-06',
        position_id: 'pos-07',
        work_schedule_id: 'sch-01',
        employee_code: 'K-008',
        full_name: 'Arriyan Muhammad (Riyan)',
        email: 'riyan@kuk.co.id',
        phone: '081235550008',
        gender: 'L',
        marital_status: 'SINGLE',
        status: 'ACTIVE',
        employment_type: 'PKWT',
        join_date: '2023-07-10',
        created_at: '2023-07-10T08:00:00Z',
        updated_at: '2026-11-01T08:00:00Z',
        department: { id: 'dept-06', unit_id: unitId, code: 'FRONTLINER', name: 'Frontliner & Kaca', is_active: true, created_at: '' },
        position: { id: 'pos-07', unit_id: unitId, department_id: 'dept-06', code: 'CUTTER', title: 'Pemotong Kaca & Frontliner', level: 3, is_active: true, created_at: '' },
        work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      },
      {
        id: 'emp-latansa-008',
        unit_id: unitId,
        department_id: 'dept-06',
        position_id: 'pos-08',
        work_schedule_id: 'sch-01',
        employee_code: 'K-009',
        full_name: 'Muhammad Hiba',
        email: 'hiba@kuk.co.id',
        phone: '081235550009',
        gender: 'L',
        marital_status: 'SINGLE',
        status: 'ACTIVE',
        employment_type: 'PKWT',
        join_date: '2023-07-15',
        created_at: '2023-07-15T08:00:00Z',
        updated_at: '2026-11-01T08:00:00Z',
        department: { id: 'dept-06', unit_id: unitId, code: 'FRONTLINER', name: 'Frontliner', is_active: true, created_at: '' },
        position: { id: 'pos-08', unit_id: unitId, department_id: 'dept-06', code: 'FRONTLINER', title: 'Frontliner', level: 3, is_active: true, created_at: '' },
        work_schedule: { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      },
      {
        id: 'emp-latansa-009',
        unit_id: unitId,
        department_id: 'dept-06',
        position_id: 'pos-09',
        work_schedule_id: 'sch-01',
        employee_code: 'K-010',
        full_name: 'Lailurrohman (Rohman)',
        email: 'rohman@kuk.co.id',
        phone: '081235550010',
        gender: 'L',
        marital_status: 'SINGLE',
        status: 'ACTIVE',
        employment_type: 'PKWT',
        join_date: '2023-08-01',
        created_at: '2023-08-01T08:00:00Z',
        updated_at: '2026-11-01T08:00:00Z',
        department: { id: 'dept-06', unit_id: unitId, code: 'FRONTLINER', name: 'Frontliner', is_active: true, created_at: '' },
        position: { id: 'pos-09', unit_id: unitId, department_id: 'dept-06', code: 'FRONTLINER', title: 'Frontliner', level: 3, is_active: true, created_at: '' },
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

  private createDefaultBorrowingRequests(_unitId: string): VehicleBorrowingRequest[] {
    return [];
  }

  private createDefaultLeaveRequests(_unitId: string): LeaveRequest[] {
    return [];
  }

  private createDefaultGlassTips(_unitId: string): GlassTip[] {
    return [];
  }

  private createDefaultViolations(_unitId: string): ViolationRecord[] {
    return [];
  }

  private createDefaultWarningLetters(_unitId: string): WarningLetter[] {
    return [];
  }

  private createDefaultBriefings(_unitId: string): BriefingSession[] {
    return [];
  }

  private createDefaultPayrollPeriods(_unitId: string): PayrollPeriod[] {
    return [];
  }

  private createDefaultCashExpenses(_unitId: string): CashExpense[] {
    return [];
  }

  private createDefaultDepartments(unitId: string): Department[] {
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
      { id: 'dept-03', unit_id: unitId, code: 'TOKO', name: 'Toko & Penjualan', is_active: true, created_at: '' },
      { id: 'dept-04', unit_id: unitId, code: 'KASIR', name: 'Kasir & Pelayanan', is_active: true, created_at: '' },
    ];
  }

  private createDefaultPositions(unitId: string): Position[] {
    const isPalen = unitId === '00000000-0000-0000-0000-000000000002' || /palen/i.test(unitId);
    if (isPalen) {
      return [
        { id: 'pos-palen-01', unit_id: unitId, department_id: 'dept-palen-01', code: 'CUTTER', title: 'Tukang Potong Kaca', level: 2, is_active: true, created_at: '' },
        { id: 'pos-palen-02', unit_id: unitId, department_id: 'dept-palen-02', code: 'KASIR', title: 'Kasir Toko', level: 3, allowed_leave_days_of_week: [0], is_active: true, created_at: '' },
      ];
    }
    return [
      { id: 'pos-01', unit_id: unitId, department_id: 'dept-01', code: 'SOPIR', title: 'Admin 2 (Operasional)', level: 2, is_active: true, created_at: '' },
      { id: 'pos-02', unit_id: unitId, department_id: 'dept-02', code: 'ADM3', title: 'Admin 3 (Operasional Toko)', level: 3, allowed_leave_days_of_week: [0], is_active: true, created_at: '' },
      { id: 'pos-03', unit_id: unitId, department_id: 'dept-03', code: 'KEPALA_TOKO', title: 'Kepala Toko', level: 1, is_active: true, created_at: '' },
      { id: 'pos-04', unit_id: unitId, department_id: 'dept-04', code: 'KASIR', title: 'Kasir Toko', level: 3, is_active: true, created_at: '' },
      { id: 'pos-05', unit_id: unitId, department_id: 'dept-01', code: 'GUDANG', title: 'Staf Gudang & Logistik', level: 2, is_active: true, created_at: '' },
      { id: 'pos-06', unit_id: unitId, department_id: 'dept-01', code: 'DRIVER', title: 'Sopir Pengiriman', level: 2, is_active: true, created_at: '' },
      { id: 'pos-07', unit_id: unitId, department_id: 'dept-01', code: 'CUTTER', title: 'Tukang Potong Kaca', level: 2, is_active: true, created_at: '' },
    ];
  }

  private createDefaultGlassRates(unitId: string): any[] {
    return [
      { id: 'gt-001', unit_id: unitId, name: 'Kaca Polos Bening 5mm', thickness_mm: 5, price_per_sqm: 120000, default_percentage: 0.03, is_active: true },
      { id: 'gt-002', unit_id: unitId, name: 'Kaca Polos Bening 8mm', thickness_mm: 8, price_per_sqm: 185000, default_percentage: 0.03, is_active: true },
      { id: 'gt-003', unit_id: unitId, name: 'Kaca Polos Bening 10mm (Tempered)', thickness_mm: 10, price_per_sqm: 350000, default_percentage: 0.03, is_active: true },
      { id: 'gt-004', unit_id: unitId, name: 'Kaca Riben Gelap 5mm', thickness_mm: 5, price_per_sqm: 145000, default_percentage: 0.03, is_active: true },
      { id: 'gt-005', unit_id: unitId, name: 'Kaca Cermin Silver 5mm', thickness_mm: 5, price_per_sqm: 160000, default_percentage: 0.03, is_active: true },
      { id: 'gt-01', unit_id: unitId, name: 'Kaca Polos 5mm', thickness_mm: 5, price_per_sqm: 120000, default_percentage: 0.03, is_active: true },
      { id: 'gt-006', unit_id: unitId, name: 'Kaca Bening 3mm', thickness_mm: 3, price_per_sqm: 90000, default_percentage: 0.03, is_active: true },
      { id: 'gt-007', unit_id: unitId, name: 'Kaca Polos 3mm', thickness_mm: 3, price_per_sqm: 85000, default_percentage: 0.03, is_active: true },
    ];
  }

  private createDefaultWorkSchedules(unitId: string): WorkSchedule[] {
    return [
      { id: 'sch-01', unit_id: unitId, name: 'Reguler Operasional 6 Hari', start_time: '08:00', end_time: '17:00', late_tolerance_minutes: 15, is_active: true },
      { id: 'sch-02', unit_id: unitId, name: 'Shift Pagi Operasional Toko', start_time: '07:30', end_time: '16:30', late_tolerance_minutes: 10, is_active: true },
    ];
  }
}

export const previewStore = new PreviewStore();
