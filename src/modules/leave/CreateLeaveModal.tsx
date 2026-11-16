import React, { useState, useEffect, useMemo } from 'react';
import type { Employee, LeaveRequest } from '@/types/models';
import { employeeService, leaveService } from '@/services/dataService';
import {
  CalendarDays,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar as CalendarIcon,
} from 'lucide-react';

interface CreateLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitId: string;
  onSuccess: (msg: string) => void;
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const CreateLeaveModal: React.FC<CreateLeaveModalProps> = ({
  isOpen,
  onClose,
  unitId,
  onSuccess,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [existingLeaves, setExistingLeaves] = useState<LeaveRequest[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');

  // Default target month: current month or next month depending on date
  const [targetMonth, setTargetMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Load employees and existing leave requests
  useEffect(() => {
    if (isOpen && unitId) {
      Promise.all([
        employeeService.getEmployeesByUnit(unitId),
        leaveService.getLeaveRequestsByUnit(unitId),
      ]).then(([empRes, leaveRes]) => {
        const activeOnly = empRes.data.filter((e) => e.status === 'ACTIVE');
        setEmployees(activeOnly);
        setExistingLeaves(leaveRes.data);
        if (activeOnly.length > 0 && !selectedEmpId) {
          setSelectedEmpId(activeOnly[0].id);
        }
      });
    }
  }, [isOpen, unitId]);

  // Selected Employee object
  const activeEmp = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Check if active employee is Admin 3 (or code ADM3)
  const isAdmin3 = useMemo(() => {
    if (!activeEmp) return false;
    const posCode = String(activeEmp.position?.code || '').toUpperCase();
    const posTitle = String(activeEmp.position?.title || '').toLowerCase();
    const empName = String(activeEmp.full_name || '').toLowerCase();
    return (
      posCode.includes('ADM3') ||
      posTitle.includes('admin 3') ||
      empName.includes('irvan') ||
      activeEmp.employee_code === 'K-011'
    );
  }, [activeEmp]);

  // Check Cuti Window status
  const windowStatus = useMemo(() => {
    const [tY, tM] = targetMonth.split('-').map(Number);
    const prevY = tM === 1 ? tY - 1 : tY;
    const prevM = tM === 1 ? 12 : tM - 1;

    // Window opened: 1st of prev month (or last day of prev month)
    const windowOpen = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
    // Window closed: 3rd of target month
    const windowClose = `${tY}-${String(tM).padStart(2, '0')}-03`;

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const isOpenWindow = todayStr >= windowOpen && todayStr <= windowClose;

    return {
      isOpen: isOpenWindow,
      windowOpen,
      windowClose,
      todayStr,
      monthLabel: `${MONTH_NAMES[tM - 1]} ${tY}`,
    };
  }, [targetMonth]);

  // Department Booked Dates by other colleagues in the same department
  const bookedDatesByDept = useMemo(() => {
    if (!activeEmp) return new Set<string>();
    const deptId = activeEmp.department_id || activeEmp.department?.id;
    const booked = new Set<string>();

    existingLeaves.forEach((leave) => {
      // Must not be the same employee
      if (leave.employee_id === activeEmp.id) return;
      // Must be approved or pending
      if (leave.status !== 'APPROVED' && leave.status !== 'PENDING') return;

      // Check if employee is in the same department
      const colleague = employees.find((e) => e.id === leave.employee_id);
      const colDeptId = colleague?.department_id || colleague?.department?.id;

      if (colDeptId && colDeptId === deptId) {
        if (Array.isArray(leave.dates)) {
          leave.dates.forEach((d) => {
            const dateVal = typeof d === 'string' ? d : (d as any).leave_date;
            if (dateVal && dateVal.startsWith(targetMonth)) {
              booked.add(dateVal);
            }
          });
        }
      }
    });

    return booked;
  }, [activeEmp, existingLeaves, employees, targetMonth]);

  // Calendar Calculation for targetMonth
  const calendarDays = useMemo(() => {
    const [y, m] = targetMonth.split('-').map(Number);
    const firstDayIndex = new Date(y, m - 1, 1).getDay(); // 0 = Sunday
    const totalDaysInMonth = new Date(y, m, 0).getDate();

    const days: Array<{
      dayNum: number;
      dateKey: string;
      isSunday: boolean;
      isSelected: boolean;
      isBooked: boolean;
      dateObj: Date;
    } | null> = [];

    // Empty lead cells
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    // Days in month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(y, m - 1, d);
      const isSunday = dateObj.getDay() === 0;
      const isSelected = selectedDates.includes(dateKey);
      const isBooked = bookedDatesByDept.has(dateKey);

      days.push({
        dayNum: d,
        dateKey,
        isSunday,
        isSelected,
        isBooked,
        dateObj,
      });
    }

    return days;
  }, [targetMonth, selectedDates, bookedDatesByDept]);

  // Handle Date Toggle in Calendar
  const handleToggleDate = (dateKey: string, isSunday: boolean, isBooked: boolean) => {
    setErrorMsg(null);
    setInfoMsg(null);

    // If date already selected, unselect it
    if (selectedDates.includes(dateKey)) {
      setSelectedDates((prev) => prev.filter((d) => d !== dateKey));
      return;
    }

    // Admin 3 Rule: Sunday only!
    if (isAdmin3 && !isSunday) {
      setErrorMsg(
        'Aturan Khusus Admin 3 (Irvan): Pengajuan cuti HANYA diperbolehkan pada hari MINGGU.'
      );
      return;
    }

    // Department conflict check
    if (isBooked) {
      setErrorMsg(
        `Tanggal ${dateKey} sudah diambil oleh rekan satu bagian/divisi di unit yang sama!`
      );
      return;
    }

    // Max 3 days quota check
    if (selectedDates.length >= 3) {
      setErrorMsg(
        `Batas maksimal pengajuan cuti adalah 3 hari untuk periode ${windowStatus.monthLabel}!`
      );
      return;
    }

    setSelectedDates((prev) => [...prev, dateKey].sort());
  };

  // Target month navigation
  const handlePrevMonth = () => {
    const [y, m] = targetMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setTargetMonth(
      `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    );
    setSelectedDates([]);
    setErrorMsg(null);
  };

  const handleNextMonth = () => {
    const [y, m] = targetMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setTargetMonth(
      `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    );
    setSelectedDates([]);
    setErrorMsg(null);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedEmpId) {
      setErrorMsg('Karyawan pemohon wajib dipilih.');
      return;
    }

    if (selectedDates.length === 0) {
      setErrorMsg('Pilih minimal 1 tanggal pada kalender rencana cuti.');
      return;
    }

    if (selectedDates.length > 3) {
      setErrorMsg('SOP KUK: Batas maksimal cuti adalah 3 hari kalender per bulan.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Alasan keperluan cuti wajib diisi.');
      return;
    }

    setLoading(true);
    const res = await leaveService.submitLeaveRequest(unitId, {
      employee_id: selectedEmpId,
      target_month: targetMonth,
      total_days: selectedDates.length,
      reason: reason.trim(),
      dates: selectedDates,
    });
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      onSuccess(res.message);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#540000] via-[#730000] to-[#540000] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-kuk-gold" />
            <div>
              <h2 className="font-bold text-sm">Formulir Pengajuan Cuti Staf</h2>
              <p className="text-[11px] text-gray-200">
                SOP KUK: Maksimal 3 hari kalender per bulan per karyawan.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Error & Info Banners */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-blue-600" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Employee Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Pilih Karyawan Pemohon *</label>
            <select
              value={selectedEmpId}
              onChange={(e) => {
                setSelectedEmpId(e.target.value);
                setSelectedDates([]);
                setErrorMsg(null);
              }}
              className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              required
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code}) — {emp.position?.title || emp.department?.name || 'Staf'}
                </option>
              ))}
            </select>
            {isAdmin3 && (
              <div className="mt-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Aturan Khusus Admin 3 (Irvan): Pengajuan cuti HANYA dapat diambil pada hari Minggu.</span>
              </div>
            )}
          </div>

          {/* Month Selector Bar with Navigation */}
          <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-kuk-maroon" />
                <span className="font-bold text-gray-800 text-xs">Periode Bulan Kalender:</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                  title="Bulan sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-extrabold text-gray-900 px-2 min-w-[120px] text-center text-xs">
                  {windowStatus.monthLabel}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                  title="Bulan berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Window Status Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-gray-200/60">
              <span className="text-gray-500">
                Batas pengajuan: {windowStatus.windowOpen} s/d {windowStatus.windowClose}
              </span>
              {windowStatus.isOpen ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>🟢 Jendela Resmi Terbuka</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 text-[10px]">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>🔒 Di Luar Jendela (Dispensasi HRD)</span>
                </span>
              )}
            </div>
          </div>

          {/* Interactive Calendar Date Picker */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold text-gray-700">
                Pilih Tanggal di Kalender (Klik untuk Menentukan Jadwal):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDates[0] || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setSelectedDates((prev) => {
                        if (!prev.includes(val)) {
                          return [...prev, val].slice(0, 3);
                        }
                        return prev;
                      });
                    }
                  }}
                  className="px-2 py-1 text-[11px] border border-gray-200 rounded-lg focus:ring-1 focus:ring-kuk-maroon"
                  title="Pilih tanggal langsung"
                />
                <span
                  className={`font-extrabold text-[11px] px-2 py-1 rounded-lg border whitespace-nowrap ${
                    selectedDates.length === 3
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-kuk-gold/20 text-kuk-maroon border-kuk-gold/40'
                  }`}
                >
                  Kuota: {selectedDates.length} / 3 Hari
                </span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              {/* Day Headers (Minggu in Red) */}
              <div className="grid grid-cols-7 bg-gray-100/90 text-center text-[11px] font-bold py-2 border-b border-gray-200">
                <span className="text-rose-600">Min</span>
                <span>Sen</span>
                <span>Sel</span>
                <span>Rab</span>
                <span>Kam</span>
                <span>Jum</span>
                <span>Sab</span>
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1 p-2 bg-gray-50/50">
                {calendarDays.map((cell, idx) => {
                  if (!cell) {
                    return <div key={`empty-${idx}`} className="h-10 rounded-lg bg-transparent" />;
                  }

                  const { dayNum, dateKey, isSunday, isSelected, isBooked } = cell;

                  // Disabled if Admin 3 and not Sunday
                  const isBlockedByAdmin3 = isAdmin3 && !isSunday;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      disabled={isBooked || isBlockedByAdmin3}
                      onClick={() => handleToggleDate(dateKey, isSunday, isBooked)}
                      title={
                        isBooked
                          ? 'Sudah diambil oleh rekan satu bagian'
                          : isBlockedByAdmin3
                          ? 'Admin 3 hanya boleh hari Minggu'
                          : `Pilih tanggal ${dayNum}`
                      }
                      className={`h-10 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center relative ${
                        isSelected
                          ? 'bg-kuk-maroon text-kuk-gold shadow-md scale-102 ring-2 ring-kuk-gold font-black'
                          : isBooked
                          ? 'bg-rose-50 text-rose-300 cursor-not-allowed border border-rose-100'
                          : isBlockedByAdmin3
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          : isSunday
                          ? 'bg-white text-rose-600 hover:bg-rose-50 border border-rose-100'
                          : 'bg-white text-gray-700 hover:bg-kuk-gold/20 border border-gray-200/80 hover:border-kuk-gold'
                      }`}
                    >
                      <span>{dayNum}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-kuk-gold mt-0.5" />
                      )}
                      {isBooked && (
                        <span className="text-[8px] text-rose-400 font-normal scale-90">Bentrok</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Dates Chip List */}
            {selectedDates.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-gray-500 font-semibold text-[11px]">Tanggal Terpilih:</span>
                {selectedDates.map((dateStr) => (
                  <span
                    key={dateStr}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-kuk-maroon text-kuk-gold rounded-lg font-bold text-xs shadow-2xs"
                  >
                    <span>{dateStr}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDates((prev) => prev.filter((d) => d !== dateStr))}
                      className="text-white hover:text-rose-300 ml-1 p-0.5"
                      title="Hapus tanggal"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Keperluan / Alasan Rencana Cuti *
            </label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Keperluan keluarga mendesak di luar kota..."
              className="w-full px-3 py-2 text-xs font-medium border border-gray-200 rounded-xl focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || selectedDates.length === 0}
              className="px-5 py-2.5 text-xs font-bold text-white bg-kuk-maroon hover:bg-kuk-maroon-dark rounded-xl disabled:opacity-50 transition-all shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-kuk-gold" />
              <span>{loading ? 'Mengajukan...' : 'Ajukan Permohonan Cuti'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
