import React, { useState, useEffect } from 'react';
import type { Employee } from '@/types/models';
import { employeeService, leaveService } from '@/services/dataService';
import { CalendarDays, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CreateLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitId: string;
  onSuccess: (msg: string) => void;
}

export const CreateLeaveModal: React.FC<CreateLeaveModalProps> = ({
  isOpen,
  onClose,
  unitId,
  onSuccess,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [date1, setDate1] = useState<string>('');
  const [date2, setDate2] = useState<string>('');
  const [date3, setDate3] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && unitId) {
      employeeService.getEmployeesByUnit(unitId).then((res) => {
        const activeOnly = res.data.filter(e => e.status === 'ACTIVE');
        setEmployees(activeOnly);
        if (activeOnly.length > 0) {
          setSelectedEmpId(activeOnly[0].id);
        }
      });
    }
  }, [isOpen, unitId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedEmpId) {
      setErrorMsg('Karyawan wajib dipilih.');
      return;
    }

    const dates = [date1, date2, date3].filter(Boolean);
    if (dates.length === 0) {
      setErrorMsg('Pilih minimal 1 tanggal rencana cuti.');
      return;
    }

    // Check unique dates
    const uniqueDates = Array.from(new Set(dates));
    if (uniqueDates.length !== dates.length) {
      setErrorMsg('Tanggal cuti yang dipilih tidak boleh duplikat.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Alasan cuti wajib diisi.');
      return;
    }

    setLoading(true);
    const res = await leaveService.submitLeaveRequest(unitId, {
      employee_id: selectedEmpId,
      target_month: targetMonth,
      total_days: dates.length,
      reason: reason.trim(),
      dates,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-kuk-gold" />
            <h2 className="font-bold text-sm">Pengajuan Cuti Karyawan Baru</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Karyawan *</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              required
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code}) — {emp.position?.title || 'Staf'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Periode Bulan Cuti *</label>
            <input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              required
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Jendela Pengajuan: Dibuka tanggal 1 bulan sebelumnya dan ditutup tanggal 3 pada bulan cuti bersangkutan.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tanggal Cuti yang Diajukan (Maksimal 3 Hari / Bulan) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="date"
                value={date1}
                onChange={(e) => setDate1(e.target.value)}
                required
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              />
              <input
                type="date"
                value={date2}
                onChange={(e) => setDate2(e.target.value)}
                placeholder="Hari ke-2 (Opsional)"
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              />
              <input
                type="date"
                value={date3}
                onChange={(e) => setDate3(e.target.value)}
                placeholder="Hari ke-3 (Opsional)"
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              />
            </div>
            <p className="text-2xs text-gray-400 mt-1">Sesuai kebijakan unit KUK: Kuota cuti bulanan maksimal 3 hari.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Keperluan / Alasan Cuti *</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Keperluan keluarga mendesak di luar kota..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Mengajukan...' : 'Ajukan Permohonan Cuti'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

