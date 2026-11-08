import React, { useEffect, useState } from 'react';
import type { Employee, EmployeeJobHistory } from '@/types/models';
import { employeeService } from '@/services/dataService';
import { History, X, Briefcase, Calendar, AlertCircle } from 'lucide-react';

interface JobHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  unitId: string;
}

export const JobHistoryModal: React.FC<JobHistoryModalProps> = ({
  isOpen,
  onClose,
  employee,
  unitId,
}) => {
  const [history, setHistory] = useState<EmployeeJobHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && employee && unitId) {
      setLoading(true);
      setError(null);
      employeeService.getEmployeeJobHistory(unitId, employee.id).then((res) => {
        setHistory(res.data);
        setIsFixture(res.isFixture);
        if (!res.success && res.error) {
          setError(res.error);
        }
        setLoading(false);
      });
    }
  }, [isOpen, employee, unitId]);

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-kuk-gold" />
            <h2 className="font-bold text-sm">Riwayat Jabatan & Unit Karyawan</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900 text-sm">{employee.full_name}</div>
              <div className="text-gray-500 font-mono">{employee.employee_code}</div>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-kuk-maroon-50 text-kuk-maroon border border-kuk-maroon-100">
                {employee.position?.title || 'Staf'}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {isFixture && !error && !loading && (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                <strong>Zero-State Preview:</strong> Riwayat di bawah ini adalah sampel simulasi lokal.
              </span>
            </div>
          )}

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-xs text-gray-500">Memuat riwayat jabatan...</div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">Belum ada riwayat mutasi/promosi untuk karyawan ini.</div>
            ) : (
              history.map((item, idx) => (
                <div key={item.id || idx} className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-900 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-kuk-maroon" />
                      <span>{item.to_position_title || 'Posisi Unit'}</span>
                    </span>
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {item.transition_type}
                    </span>
                  </div>

                  <div className="text-2xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span>Mulai Efektif: {item.effective_date}</span>
                    <span className="mx-1">•</span>
                    <span>Unit: {item.to_unit_name || 'Unit Operasional'}</span>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg text-2xs mt-1 border border-gray-100">
                      {item.notes}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

