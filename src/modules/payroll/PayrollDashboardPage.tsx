import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { payrollService } from '@/services/dataService';
import type { PayrollPeriod, PayrollRecord } from '@/types/models';
import {
  Banknote,
  Lock,
  FileSpreadsheet,
  Eye,
  Play,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
  RefreshCw,
  Printer,
  Calendar,
} from 'lucide-react';

export const PayrollDashboardPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { user, hasPermission } = useAuth();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  // Modals
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  // Create Period Modal
  const [createPeriodModalOpen, setCreatePeriodModalOpen] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('Gaji November 2026');
  const [newStartDate, setNewStartDate] = useState('2026-11-01');
  const [newEndDate, setNewEndDate] = useState('2026-11-30');
  const [newPayoutDate, setNewPayoutDate] = useState('2026-12-01');
  const [creatingPeriod, setCreatingPeriod] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const loadPeriods = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    setError(null);
    const pRes = await payrollService.getPayrollPeriods(activeUnitId);
    setPeriods(pRes.data);
    setIsFixture(pRes.isFixture);
    if (!pRes.success && pRes.error) {
      setError(pRes.error);
    }
    if (pRes.data.length > 0) {
      setSelectedPeriod(pRes.data[0]);
      const rRes = await payrollService.getPayrollRecords(pRes.data[0].id);
      setRecords(rRes.data);
      if (!rRes.success && rRes.error && !pRes.error) {
        setError(rRes.error);
      }
    } else {
      setSelectedPeriod(null);
      setRecords([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPeriods();
  }, [activeUnitId]);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId) return;
    if (!newPeriodName.trim() || !newStartDate || !newEndDate || !newPayoutDate) {
      showToast('Seluruh field periode penggajian wajib diisi.', true);
      return;
    }
    setCreatingPeriod(true);
    const res = await payrollService.createPayrollPeriod(activeUnitId, {
      period_name: newPeriodName.trim(),
      start_date: newStartDate,
      end_date: newEndDate,
      payout_date: newPayoutDate,
    });
    setCreatingPeriod(false);
    showToast(res.message, !res.success);
    if (res.success) {
      setCreatePeriodModalOpen(false);
      loadPeriods();
    }
  };

  const handleRecalculateDraft = async () => {
    if (!selectedPeriod || !activeUnitId) return;
    setRecalculating(true);
    const res = await payrollService.recalculateDraftPayroll(activeUnitId, selectedPeriod.id);
    setRecalculating(false);
    showToast(res.message, !res.success);
    if (res.success) {
      const rRes = await payrollService.getPayrollRecords(selectedPeriod.id);
      setRecords(rRes.data);
    }
  };

  const handleFinalize = async () => {
    if (!selectedPeriod || !activeUnitId) return;
    if (!user?.id) {
      showToast('Gagal: Sesi pengguna tidak ditemukan. Silakan login kembali.', true);
      return;
    }
    setFinalizing(true);
    const res = await payrollService.finalizePayrollAtomic(
      activeUnitId,
      selectedPeriod.id,
      user.id
    );
    setFinalizing(false);
    showToast(res.message, !res.success);
    setFinalizeModalOpen(false);
    loadPeriods();
  };

  const handlePrintSlip = () => {
    window.print();
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm animate-in slide-in-from-bottom duration-200 ${
            toast.isError ? 'bg-red-900 border border-red-700' : 'bg-gray-900'
          }`}
        >
          {toast.isError ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.text}</span>
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

        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('payroll.manage', activeUnitId) && (
            <button
              onClick={() => setCreatePeriodModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4 text-kuk-maroon" />
              <span>Buat Periode Baru</span>
            </button>
          )}

          {hasPermission('payroll.manage', activeUnitId) && selectedPeriod && selectedPeriod.status !== 'FINALIZED' && (
            <>
              <button
                onClick={handleRecalculateDraft}
                disabled={recalculating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
                <span>{recalculating ? 'Menghitung...' : 'Hitung Ulang Draft'}</span>
              </button>

              <button
                onClick={() => setFinalizeModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-kuk-maroon text-white rounded-xl text-xs font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Finalisasi Payroll ({selectedPeriod.period_name})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && !loading && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Gagal Memuat Data:</strong> {error}
            </span>
          </div>
          <button
            onClick={loadPeriods}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline ml-3 shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Fixture Alert Banner */}
      {isFixture && !error && !loading && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Zero-State Preview Mode:</strong> Mode simulasi aktif. Data di bawah ini adalah sampel preview lokal terisolasi dan tidak tersimpan di database Production.
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

      {/* Modal Buat Periode Penggajian Baru */}
      {createPeriodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Buat Periode Penggajian Baru</h2>
              </div>
              <button onClick={() => setCreatePeriodModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Periode Penggajian *</label>
                <input
                  type="text"
                  required
                  value={newPeriodName}
                  onChange={(e) => setNewPeriodName(e.target.value)}
                  placeholder="Contoh: Gaji November 2026"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Estimasi Tanggal Pembayaran / Payout *</label>
                <input
                  type="date"
                  required
                  value={newPayoutDate}
                  onChange={(e) => setNewPayoutDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                Periode baru akan berstatus <strong>DRAFT</strong>. Anda dapat menghitung ulang simulasi slip gaji sebelum menguncinya secara permanen.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCreatePeriodModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingPeriod}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {creatingPeriod ? 'Membuat...' : 'Buat Periode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail & Cetak Slip Gaji Resmi */}
      {slipModalOpen && selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Modal Actions Header */}
            <div className="px-6 py-3.5 bg-gray-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-kuk-gold" />
                <span className="font-bold text-sm">Slip Gaji Karyawan — {selectedSlip.snapshot_employee_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSlip}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-kuk-maroon text-white hover:bg-kuk-maroon-700 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Slip</span>
                </button>
                <button
                  onClick={() => setSlipModalOpen(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Slip Content */}
            <div className="p-8 space-y-6 text-xs bg-white text-gray-800">
              {/* KUK Official Letterhead */}
              <div className="border-b-2 border-kuk-maroon pb-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-kuk-maroon text-kuk-gold rounded-lg flex items-center justify-center font-bold text-sm shadow-xs">
                      K
                    </div>
                    <span className="text-lg font-black text-kuk-maroon tracking-tight">CV KARYA UTAMA KREASI</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Jl. Lingkar Luar No. 88, Banten • Unit: <span className="font-semibold text-gray-800">{activeUnit?.name || 'Unit Operasional'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-kuk-maroon-50 text-kuk-maroon font-bold text-xs uppercase rounded-md border border-kuk-maroon-200">
                    SLIP GAJI RESMI
                  </span>
                  <div className="font-mono text-[11px] text-gray-500 mt-1 font-semibold">{selectedSlip.slip_number}</div>
                </div>
              </div>

              {/* Employee & Period Metadata */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                <div className="space-y-1">
                  <div className="text-gray-500 text-[11px]">Nama Karyawan</div>
                  <div className="font-bold text-gray-900 text-sm">{selectedSlip.snapshot_employee_name}</div>
                  <div className="text-gray-600 font-medium">{selectedSlip.snapshot_department_name} • {selectedSlip.snapshot_position_title}</div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-gray-500 text-[11px]">Periode Penggajian</div>
                  <div className="font-bold text-gray-900 text-sm">{selectedPeriod?.period_name || 'Periode Berjalan'}</div>
                  <div className="text-emerald-700 font-semibold flex items-center justify-end gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Status: {selectedSlip.payment_status}</span>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Earnings */}
                <div className="border border-emerald-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-emerald-50/80 px-4 py-2 border-b border-emerald-100 flex items-center justify-between font-bold text-emerald-900">
                    <span>A. PENDAPATAN</span>
                    <span className="font-mono">{formatRupiah(selectedSlip.total_earnings)}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {selectedSlip.items && selectedSlip.items.filter((i) => i.component_type !== 'DEDUCTION').length > 0 ? (
                      selectedSlip.items
                        .filter((i) => i.component_type !== 'DEDUCTION')
                        .map((it) => (
                          <div key={it.id} className="flex justify-between items-center text-gray-700">
                            <span>{it.component_name}</span>
                            <span className="font-mono font-semibold text-gray-900">{formatRupiah(it.amount)}</span>
                          </div>
                        ))
                    ) : (
                      <div className="flex justify-between items-center text-gray-700">
                        <span>Gaji Pokok & Tunjangan Standar</span>
                        <span className="font-mono font-semibold text-gray-900">{formatRupiah(selectedSlip.total_earnings)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-rose-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-rose-50/80 px-4 py-2 border-b border-rose-100 flex items-center justify-between font-bold text-rose-900">
                    <span>B. POTONGAN</span>
                    <span className="font-mono">{formatRupiah(selectedSlip.total_deductions)}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {selectedSlip.items && selectedSlip.items.filter((i) => i.component_type === 'DEDUCTION').length > 0 ? (
                      selectedSlip.items
                        .filter((i) => i.component_type === 'DEDUCTION')
                        .map((it) => (
                          <div key={it.id} className="flex justify-between items-center text-rose-700">
                            <span>{it.component_name}</span>
                            <span className="font-mono font-semibold">- {formatRupiah(it.amount)}</span>
                          </div>
                        ))
                    ) : (
                      <div className="flex justify-between items-center text-gray-400 italic">
                        <span>Tidak ada potongan</span>
                        <span className="font-mono">Rp 0</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Net Payout Banner */}
              <div className="p-4 bg-kuk-maroon text-white rounded-xl flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-xs uppercase tracking-wider text-kuk-gold font-bold">Total Diterima Bersih (Take Home Pay)</div>
                  <div className="text-[11px] text-white/80 mt-0.5">(A. Total Pendapatan - B. Total Potongan)</div>
                </div>
                <div className="text-2xl font-black text-kuk-gold font-mono tracking-tight">
                  {formatRupiah(selectedSlip.net_salary)}
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-200 text-center">
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Karyawan Penerima,</div>
                  <div className="border-b border-gray-300 w-36 mx-auto"></div>
                  <div className="font-bold text-gray-800">({selectedSlip.snapshot_employee_name})</div>
                </div>
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Finance & HRD KUK,</div>
                  <div className="border-b border-gray-300 w-36 mx-auto"></div>
                  <div className="font-bold text-gray-800">(Management Unit)</div>
                </div>
              </div>

              {/* Print Note */}
              <div className="text-[10px] text-gray-400 text-center print:block hidden">
                Dokumen ini digenerate secara otomatis oleh KUK Management System v3.1.0 • Sah tanpa tanda tangan basah jika berstatus FINALIZED.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
