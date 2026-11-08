import React, { useState } from 'react';
import type { Employee } from '@/types/models';
import { employeeService } from '@/services/dataService';
import { KeyRound, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ResetPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  unitId: string;
  onSuccess: (msg: string) => void;
}

export const ResetPinModal: React.FC<ResetPinModalProps> = ({
  isOpen,
  onClose,
  employee,
  unitId,
  onSuccess,
}) => {
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPin.length !== 6 || !/^[0-9]{6}$/.test(newPin)) {
      setErrorMsg('PIN Kiosk wajib terdiri dari tepat 6 digit angka numerik.');
      return;
    }

    if (newPin !== confirmPin) {
      setErrorMsg('Konfirmasi PIN tidak cocok dengan PIN baru.');
      return;
    }

    setLoading(true);
    const res = await employeeService.resetKioskPin(unitId, employee.id, newPin);
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
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-kuk-gold" />
            <h2 className="font-bold text-sm">Reset PIN Kiosk Karyawan</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
            <div className="text-gray-500">Nama Karyawan:</div>
            <div className="font-bold text-gray-900 text-sm">{employee.full_name}</div>
            <div className="text-gray-500">
              Kode: <span className="font-mono font-semibold text-kuk-maroon">{employee.employee_code}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              PIN Baru (6 Digit Numerik) *
            </label>
            <input
              type="password"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              placeholder="Contoh: 123456"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono tracking-widest text-center text-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Konfirmasi PIN Baru *
            </label>
            <input
              type="password"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              placeholder="Ulangi 6 digit PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono tracking-widest text-center text-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
            />
          </div>

          <p className="text-2xs text-gray-500 leading-relaxed">
            Mereset PIN akan menghapus status lockout karyawan dan mereset failed login attempts ke 0. PIN ini digunakan untuk Kiosk Tip Potong Kaca dan Portal Cuti Mandiri.
          </p>

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
              <span>{loading ? 'Menyimpan...' : 'Simpan PIN Baru'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

