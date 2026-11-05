import React, { useState, useEffect } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService } from '@/services/dataService';
import type { Employee, EmployeeSensitiveData } from '@/types/models';
import { X, ShieldCheck, Lock, Save, AlertCircle, Info } from 'lucide-react';

interface EmployeeSensitiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  onSuccess: (msg: string) => void;
}

export const EmployeeSensitiveModal: React.FC<EmployeeSensitiveModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSuccess,
}) => {
  const { activeUnitId } = useUnit();
  const { hasPermission } = useAuth();
  const [data, setData] = useState<EmployeeSensitiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = hasPermission('employees.manage_sensitive', activeUnitId);

  // Editable fields
  const [nik, setNik] = useState('');
  const [npwp, setNpwp] = useState('');
  const [bankName, setBankName] = useState('BCA');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bpjsTk, setBpjsTk] = useState('');
  const [bpjsKes, setBpjsKes] = useState('');

  useEffect(() => {
    if (!isOpen || !activeUnitId || !employee) return;
    const currentUnitId = activeUnitId;
    async function loadData() {
      setLoading(true);
      setError(null);
      const res = await employeeService.getSensitiveData(currentUnitId, employee.id);
      setData(res.data);
      if (res.data) {
        setNik(res.data.nik || '');
        setNpwp(res.data.npwp || '');
        setBankName(res.data.bank_name || 'BCA');
        setBankAccountNumber(res.data.bank_account_number || '');
        setBankAccountHolder(res.data.bank_account_holder || employee.full_name);
        setBpjsTk(res.data.bpjs_ketenagakerjaan || '');
        setBpjsKes(res.data.bpjs_kesehatan || '');
      }
      setLoading(false);
    }
    loadData();
  }, [isOpen, activeUnitId, employee]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !activeUnitId) return;

    if (!nik.trim() || !bankAccountNumber.trim()) {
      setError('NIK dan Nomor Rekening Bank wajib diisi.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload: Partial<EmployeeSensitiveData> = {
      id: data?.id,
      employee_id: employee.id,
      nik: nik.trim(),
      npwp: npwp.trim() || null,
      bank_name: bankName.trim(),
      bank_account_number: bankAccountNumber.trim(),
      bank_account_holder: bankAccountHolder.trim() || employee.full_name,
      bpjs_ketenagakerjaan: bpjsTk.trim() || null,
      bpjs_kesehatan: bpjsKes.trim() || null,
    };

    const res = await employeeService.saveSensitiveData(activeUnitId, payload);
    setSaving(false);

    if (res.success) {
      onSuccess(res.message);
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="font-bold text-sm">Data Sensitif & Penggajian Karyawan</h2>
              <p className="text-[11px] text-gray-400">{employee.full_name} ({employee.employee_code})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!canManage ? (
            <div className="p-3 mb-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
              <div>
                <span className="font-semibold">Mode Baca (Read-Only): </span>
                Anda memiliki izin <code className="bg-blue-100 px-1 rounded">employees.view_sensitive</code>. Untuk menyunting informasi ini diperlukan izin <code className="bg-blue-100 px-1 rounded">employees.manage_sensitive</code>.
              </div>
            </div>
          ) : (
            <div className="p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Data ini dilindungi oleh RLS policy terpisah dan diisolasi dari tabel profil umum.</span>
            </div>
          )}

          {error && (
            <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-xs text-gray-400">Memuat data sensitif...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor Induk Kependudukan (NIK) *</label>
                  <input
                    type="text"
                    disabled={!canManage}
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    placeholder="16 Digit NIK KTP"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono disabled:bg-gray-50 disabled:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor Pokok Wajib Pajak (NPWP)</label>
                  <input
                    type="text"
                    disabled={!canManage}
                    value={npwp}
                    onChange={(e) => setNpwp(e.target.value)}
                    placeholder="00.000.000.0-000.000"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono disabled:bg-gray-50 disabled:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Bank Penyalur Gaji</label>
                  <select
                    disabled={!canManage}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white disabled:bg-gray-50 disabled:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  >
                    <option value="BCA">Bank Central Asia (BCA)</option>
                    <option value="MANDIRI">Bank Mandiri</option>
                    <option value="BRI">Bank Rakyat Indonesia (BRI)</option>
                    <option value="BNI">Bank Negara Indonesia (BNI)</option>
                    <option value="BSI">Bank Syariah Indonesia (BSI)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor Rekening Bank *</label>
                  <input
                    type="text"
                    disabled={!canManage}
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="Nomor rekening"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono disabled:bg-gray-50 disabled:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Pemilik Rekening</label>
                  <input
                    type="text"
                    disabled={!canManage}
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg disabled:bg-gray-50 disabled:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">No. BPJS Ketenagakerjaan</label>
                  <input
                    type="text"
                    disabled={!canManage}
                    value={bpjsTk}
                    onChange={(e) => setBpjsTk(e.target.value)}
                    placeholder="No. Kartu BPJSTK"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono disabled:bg-gray-50 disabled:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">No. BPJS Kesehatan</label>
                  <input
                    type="text"
                    disabled={!canManage}
                    value={bpjsKes}
                    onChange={(e) => setBpjsKes(e.target.value)}
                    placeholder="No. Kartu BPJS Kes"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono disabled:bg-gray-50 disabled:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Tutup
                </button>
                {canManage && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Menyimpan...' : 'Simpan Data Sensitif'}</span>
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
