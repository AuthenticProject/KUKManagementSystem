import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { payrollService } from '@/services/dataService';
import type { PayrollPeriod, PayrollRecord } from '@/types/models';
import { Banknote, Lock, FileSpreadsheet, Eye, Play, AlertCircle, CheckCircle2, X } from 'lucide-react';

export const PayrollDashboardPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { user, hasPermission } = useAuth();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  const loadPeriods = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    const pRes = await payrollService.getPayrollPeriods(activeUnitId);
    setPeriods(pRes.data);
    setIsFixture(pRes.isFixture);
    if (pRes.data.length > 0) {
      setSelectedPeriod(pRes.data[0]);
      const rRes = await payrollService.getPayrollRecords(pRes.data[0].id);
      setRecords(rRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPeriods();
  }, [activeUnitId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleFinalize = async () => {
    if (!selectedPeriod || !activeUnitId) return;
    if (!user?.id) {
      showToast('Gagal: Sesi pengguna tidak ditemukan. Silakan login kembali.');
      return;
    }
    setFinalizing(true);
    const res = await payrollService.finalizePayrollAtomic(
      activeUnitId,
      selectedPeriod.id,
      user.id
    );
    setFinalizing(false);
    showToast(res.message);
    setFinalizeModalOpen(false);
    loadPeriods();
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-kuk-maroon-50 text-kuk-maroon rounded-lg">
              <Banknote className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Penggajian & Slip Gaji</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Kalkulasi atomic & penerbitan slip gaji unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        {hasPermission('payroll.manage', activeUnitId) && selectedPeriod && selectedPeriod.status !== 'FINALIZED' && (
          <button
            onClick={() => setFinalizeModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-kuk-maroon text-white rounded-xl text-sm font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Finalisasi Payroll ({selectedPeriod.period_name})</span>
          </button>
        )}
      </div>

      {isFixture && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Zero-State Preview Mode:</strong> Belum ada periode penggajian di database Production. Data di bawah ini adalah sampel preview lokal.
          </span>
        </div>
      )}

      {/* Grid: Periode Payroll & Slip Records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Daftar Periode */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <h2 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-3 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-kuk-maroon" />
            <span>Riwayat Periode Penggajian</span>
          </h2>

          {loading ? (
            <div className="text-center py-6 text-xs text-gray-400">Memuat periode penggajian...</div>
          ) : periods.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">Belum ada periode penggajian dibuat</div>
          ) : (
            <div className="space-y-2.5">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={async () => {
                    setSelectedPeriod(p);
                    const rRes = await payrollService.getPayrollRecords(p.id);
                    setRecords(rRes.data);
                  }}
                  className={`w-full text-left p-3.5 rounded-lg border transition-colors ${
                    selectedPeriod?.id === p.id
                      ? 'border-kuk-maroon bg-kuk-maroon-50/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-900 text-xs">{p.period_name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'FINALIZED'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {p.start_date} s.d. {p.end_date}
                  </div>
                  <div className="text-xs font-bold text-kuk-maroon mt-2">
                    {formatRupiah(p.total_net_payout)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Kolom Kanan: Detail Slip Gaji Periode Terpilih */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="font-bold text-gray-900 text-sm">
                Slip Gaji Karyawan — {selectedPeriod?.period_name || 'Pilih Periode'}
              </h2>
              {selectedPeriod?.status === 'FINALIZED' ? (
                <p className="text-[11px] text-purple-700 font-medium flex items-center gap-1 mt-0.5">
                  <Lock className="w-3 h-3" />
                  <span>Periode telah FINALIZED permanen. Immutabilitas dilindungi trigger trg_protect_payroll_records.</span>
                </p>
              ) : (
                <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                  Status DRAFT/CALCULATED — Siap diverifikasi sebelum difinalisasi atomik.
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-6 text-xs text-gray-400">Memuat slip gaji...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">Belum ada slip gaji di periode ini</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-2.5">No. Slip & Karyawan</th>
                    <th className="px-4 py-2.5">Bagian</th>
                    <th className="px-4 py-2.5">Total Pendapatan</th>
                    <th className="px-4 py-2.5">Potongan</th>
                    <th className="px-4 py-2.5">Gaji Bersih (Net)</th>
                    <th className="px-4 py-2.5 text-right">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{r.snapshot_employee_name}</div>
                        <div className="font-mono text-[10px] text-gray-400">{r.slip_number}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.snapshot_department_name}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{formatRupiah(r.total_earnings)}</td>
                      <td className="px-4 py-3 text-rose-600 font-semibold">{formatRupiah(r.total_deductions)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">{formatRupiah(r.net_salary)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedSlip(r);
                            setSlipModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-kuk-maroon hover:bg-kuk-maroon-50 rounded transition-colors"
                          title="Lihat Rincian Slip Gaji"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Finalisasi Payroll Atomik */}
      {finalizeModalOpen && selectedPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Konfirmasi Finalisasi Permanen</h2>
              </div>
              <button onClick={() => setFinalizeModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 space-y-1">
                <p className="font-bold">Perhatian Immutabilitas Database:</p>
                <p>
                  Setelah difinalisasi menggunakan RPC <code>calculate_and_finalize_payroll_atomic</code>, status periode akan terkunci menjadi <strong>FINALIZED</strong>. Seluruh slip gaji tidak dapat diubah atau dihapus secara langsung.
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Periode:</span>
                  <span className="font-bold text-gray-900">{selectedPeriod.period_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Estimasi Total Payout:</span>
                  <span className="font-bold text-kuk-maroon">{formatRupiah(selectedPeriod.total_net_payout)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setFinalizeModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="px-4 py-2 font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {finalizing ? 'Memfinalisasi...' : 'Kunci & Finalisasi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Slip Gaji */}
      {slipModalOpen && selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm">Rincian Slip Gaji Karyawan</h2>
                <p className="text-[11px] text-gray-400 font-mono">{selectedSlip.slip_number}</p>
              </div>
              <button onClick={() => setSlipModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 flex justify-between items-center">
                <div>
                  <div className="font-bold text-gray-900 text-sm">{selectedSlip.snapshot_employee_name}</div>
                  <div className="text-gray-500 mt-0.5">{selectedSlip.snapshot_department_name} • {selectedSlip.snapshot_position_title}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {selectedSlip.payment_status}
                </span>
              </div>

              {selectedSlip.items && (
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-700 text-xs border-b border-gray-100 pb-1">Rincian Komponen Pendapatan & Potongan:</h3>
                  <div className="divide-y divide-gray-100">
                    {selectedSlip.items.map((it) => (
                      <div key={it.id} className="py-2 flex justify-between items-center">
                        <span className="text-gray-700">{it.component_name}</span>
                        <span className={`font-mono font-semibold ${it.component_type === 'DEDUCTION' ? 'text-rose-600' : 'text-gray-900'}`}>
                          {it.component_type === 'DEDUCTION' ? `- ${formatRupiah(it.amount)}` : formatRupiah(it.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-kuk-maroon-50 border border-kuk-maroon-100 rounded-xl flex justify-between items-center text-sm font-bold text-kuk-maroon">
                <span>Gaji Bersih Diterima (Net):</span>
                <span>{formatRupiah(selectedSlip.net_salary)}</span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSlipModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
