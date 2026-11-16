import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { payrollService } from '@/services/dataService';
import type { PayrollPeriod, PayrollRecord } from '@/types/models';
import { exportToCSV } from '@/utils/exportUtils';
import { PageHeader } from '@/components/ui';
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
  Pencil,
} from 'lucide-react';

export const PayrollDashboardPage: React.FC = () => {
  const { activeUnit, activeUnitId, availableUnits } = useUnit();
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

  // Edit Slip Modal
  const [editSlipModalOpen, setEditSlipModalOpen] = useState(false);
  const [editingSlip, setEditingSlip] = useState<PayrollRecord | null>(null);
  const [savingSlip, setSavingSlip] = useState(false);
  const [eBaseSalary, setEBaseSalary] = useState<number>(0);
  const [eGajiBagian, setEGajiBagian] = useState<number>(0);
  const [eHadiahPondok, setEHadiahPondok] = useState<number>(0);
  const [eTipKaca, setETipKaca] = useState<number>(0);
  const [eTunjanganKeluarga, setETunjanganKeluarga] = useState<number>(0);
  const [eInsentifCuti, setEInsentifCuti] = useState<number>(0);
  const [eBonusIncentive, setEBonusIncentive] = useState<number>(0);
  const [eOtherDeductions, setEOtherDeductions] = useState<number>(0);
  const [eAbsentCount, setEAbsentCount] = useState<number>(0);

  // Create Period Modal
  const [createPeriodModalOpen, setCreatePeriodModalOpen] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('Gaji November 2026');
  const [newStartDate, setNewStartDate] = useState('2026-11-01');
  const [newEndDate, setNewEndDate] = useState('2026-11-30');
  const [newPayoutDate, setNewPayoutDate] = useState('2026-12-01');
  const [creatingPeriod, setCreatingPeriod] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const loadPeriods = async () => {
    setLoading(true);
    setError(null);
    try {
      const targetUnitId = activeUnitId || availableUnits[0]?.id || '00000000-0000-0000-0000-000000000001';
      const pRes = await payrollService.getPayrollPeriods(targetUnitId);
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
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data periode penggajian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriods();
  }, [activeUnitId]);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenEditSlip = (record: PayrollRecord) => {
    setEditingSlip(record);
    let base = 0;
    let bagian = 0;
    let hadiah = 0;
    let tip = 0;
    let tunjKeluarga = 0;
    let insCuti = 0;
    let bonus = 0;
    let kasbon = 0;
    let absent = 0;

    if (record.items && record.items.length > 0) {
      record.items.forEach((it) => {
        const name = (it.component_name || '').toLowerCase();
        if (name.includes('pokok')) base = it.amount;
        else if (name.includes('bagian')) bagian = it.amount;
        else if (name.includes('pondok')) hadiah = it.amount;
        else if (name.includes('tip') || name.includes('kaca')) tip = it.amount;
        else if (name.includes('keluarga') || name.includes('berkeluarga')) tunjKeluarga = it.amount;
        else if (name.includes('cuti')) insCuti = it.amount;
        else if (name.includes('bonus')) bonus = it.amount;
        else if (name.includes('alpa') || name.includes('tidak masuk')) {
          absent = Math.round(it.amount / 28500);
        } else if (it.component_type === 'DEDUCTION') {
          kasbon += it.amount;
        }
      });
    } else {
      base = record.total_earnings || 1000000;
      kasbon = record.total_deductions || 0;
    }

    setEBaseSalary(base);
    setEGajiBagian(bagian);
    setEHadiahPondok(hadiah);
    setETipKaca(tip);
    setETunjanganKeluarga(tunjKeluarga);
    setEInsentifCuti(insCuti);
    setEBonusIncentive(bonus);
    setEOtherDeductions(kasbon);
    setEAbsentCount(absent);
    setEditSlipModalOpen(true);
  };

  const handleSaveEditSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlip) return;
    setSavingSlip(true);
    const periodId = selectedPeriod?.id || editingSlip.payroll_period_id;
    const res = await payrollService.updatePayrollRecord(periodId, editingSlip.id, {
      baseSalary: Number(eBaseSalary) || 0,
      gajiBagian: Number(eGajiBagian) || 0,
      hadiahPondok: Number(eHadiahPondok) || 0,
      tipKaca: Number(eTipKaca) || 0,
      tunjanganKeluarga: Number(eTunjanganKeluarga) || 0,
      insentifCuti: Number(eInsentifCuti) || 0,
      bonusIncentive: Number(eBonusIncentive) || 0,
      otherDeductions: Number(eOtherDeductions) || 0,
      absentCount: Number(eAbsentCount) || 0,
    });
    setSavingSlip(false);
    showToast(res.message, !res.success);
    if (res.success && res.record) {
      setRecords((prev) => prev.map((r) => (r.id === res.record!.id ? res.record! : r)));
      if (selectedSlip && selectedSlip.id === res.record.id) {
        setSelectedSlip(res.record);
      }
      setEditSlipModalOpen(false);
      const targetUnitId = activeUnitId || availableUnits[0]?.id || '00000000-0000-0000-0000-000000000001';
      const pRes = await payrollService.getPayrollPeriods(targetUnitId);
      setPeriods(pRes.data);
      if (selectedPeriod) {
        const updatedP = pRes.data.find((p) => p.id === selectedPeriod.id);
        if (updatedP) setSelectedPeriod(updatedP);
      }
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUnitId = activeUnitId || availableUnits[0]?.id || '00000000-0000-0000-0000-000000000001';
    if (!newPeriodName.trim() || !newStartDate || !newEndDate || !newPayoutDate) {
      showToast('Seluruh field periode penggajian wajib diisi.', true);
      return;
    }
    setCreatingPeriod(true);
    const res = await payrollService.createPayrollPeriod(targetUnitId, {
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
    if (!selectedPeriod) return;
    const targetUnitId = activeUnitId || availableUnits[0]?.id || '00000000-0000-0000-0000-000000000001';
    setRecalculating(true);
    const res = await payrollService.recalculateDraftPayroll(targetUnitId, selectedPeriod.id);
    setRecalculating(false);
    showToast(res.message, !res.success);
    if (res.success) {
      const rRes = await payrollService.getPayrollRecords(selectedPeriod.id);
      setRecords(rRes.data);
    }
  };

  const handleFinalize = async () => {
    if (!selectedPeriod) return;
    const targetUnitId = activeUnitId || availableUnits[0]?.id || '00000000-0000-0000-0000-000000000001';
    if (!user?.id) {
      showToast('Gagal: Sesi pengguna tidak ditemukan. Silakan login kembali.', true);
      return;
    }
    setFinalizing(true);
    const res = await payrollService.finalizePayrollAtomic(
      targetUnitId,
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

  const handleExportPayrollCSV = () => {
    if (!selectedPeriod || records.length === 0) return;
    const headers = [
      'No. Slip',
      'ID Karyawan',
      'Nama Karyawan',
      'Bagian',
      'Jabatan',
      'Total Pendapatan (Rp)',
      'Total Potongan (Rp)',
      'Gaji Bersih / THP (Rp)',
      'Status Pembayaran',
      'Periode',
    ];
    const rows = records.map((r) => [
      r.slip_number,
      r.employee_id,
      r.snapshot_employee_name,
      r.snapshot_department_name,
      r.snapshot_position_title,
      r.total_earnings,
      r.total_deductions,
      r.net_salary,
      r.payment_status,
      selectedPeriod.period_name,
    ]);
    exportToCSV(`Slip_Gaji_${selectedPeriod.period_name.replace(/\s+/g, '_')}_${activeUnit?.code || 'KUK'}`, headers, rows);
    showToast(`Berhasil mengekspor ${records.length} slip gaji periode ini ke CSV.`);
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

      {/* Header Halaman */}
      <PageHeader
        title="Penggajian & Slip Gaji"
        subtitle={`Kalkulasi atomic & penerbitan slip gaji unit ${activeUnit?.name || 'Unit Aktif'}`}
        icon={<Banknote className="w-6 h-6 text-kuk-maroon" />}
        breadcrumbs={[{ label: 'Beranda', href: '/dashboard' }, { label: 'Penggajian & Slip Gaji' }]}
        unitBadge={activeUnit?.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission('payroll.manage', activeUnitId) && (
              <button
                onClick={() => setCreatePeriodModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-kuk-maroon ${recalculating ? 'animate-spin' : ''}`} />
                  <span>{recalculating ? 'Menghitung...' : 'Hitung Ulang Draft'}</span>
                </button>

                <button
                  onClick={() => setFinalizeModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-kuk-maroon text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-kuk-maroon-dark transition-colors shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-kuk-gold text-kuk-gold" />
                  <span>Finalisasi Payroll ({selectedPeriod.period_name})</span>
                </button>
              </>
            )}
          </div>
        }
      />

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

            {selectedPeriod && records.length > 0 && (
              <button
                onClick={handleExportPayrollCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors shadow-2xs"
                title="Ekspor rekap payroll periode ini ke CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Ekspor CSV</span>
              </button>
            )}
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
                    <th className="px-4 py-2.5 text-right">Rincian & Aksi</th>
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
                        <div className="flex items-center justify-end gap-1.5">
                          {selectedPeriod?.status !== 'FINALIZED' && (
                            <button
                              onClick={() => handleOpenEditSlip(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors shadow-2xs"
                              title="Edit rincian komponen pendapatan & potongan gaji"
                            >
                              <Pencil className="w-3 h-3 text-amber-600" />
                              <span>Edit Gaji</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedSlip(r);
                              setSlipModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-kuk-maroon hover:bg-kuk-maroon-50 rounded-lg transition-colors border border-gray-200"
                            title="Lihat Rincian & Cetak Slip Gaji"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Slip</span>
                          </button>
                        </div>
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

      {/* Modal Edit Gaji Karyawan Sesuai Web Referensi Resmi KUK */}
      {editSlipModalOpen && editingSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-kuk-gold/20 rounded-xl">
                  <Pencil className="w-5 h-5 text-kuk-gold" />
                </div>
                <div>
                  <h2 className="font-bold text-sm sm:text-base">
                    Edit Rincian Gaji — {editingSlip.snapshot_employee_name}
                  </h2>
                  <p className="text-[11px] text-white/80">
                    {editingSlip.snapshot_department_name} • {editingSlip.snapshot_position_title} • Slip No: {editingSlip.slip_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditSlipModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSlip} className="p-6 space-y-5 text-xs max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Kolom 1: Pendapatan */}
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                    <span className="font-bold text-xs uppercase tracking-wider text-emerald-900">
                      A. Komponen Pendapatan
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Earnings
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Gaji Pokok (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={eBaseSalary}
                      onChange={(e) => setEBaseSalary(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white font-mono font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Gaji Bagian (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={eGajiBagian}
                      onChange={(e) => setEGajiBagian(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white font-mono font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Hadiah Pondok (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={eHadiahPondok}
                      onChange={(e) => setEHadiahPondok(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white font-mono font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Tip Kaca 3% (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={eTipKaca}
                      onChange={(e) => setETipKaca(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white font-mono font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Tunjangan Berkeluarga (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={eTunjanganKeluarga}
                      onChange={(e) => setETunjanganKeluarga(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white font-mono font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Insentif Cuti (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={eInsentifCuti}
                      onChange={(e) => setEInsentifCuti(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white font-mono font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Bonus Tambahan (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={eBonusIncentive}
                      onChange={(e) => setEBonusIncentive(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white font-mono font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  {/* Subtotal Pendapatan */}
                  <div className="pt-2 border-t border-emerald-200 flex items-center justify-between font-bold text-emerald-900">
                    <span>Total Pendapatan (A):</span>
                    <span className="font-mono text-sm">
                      {formatRupiah(
                        (Number(eBaseSalary) || 0) +
                          (Number(eGajiBagian) || 0) +
                          (Number(eHadiahPondok) || 0) +
                          (Number(eTipKaca) || 0) +
                          (Number(eTunjanganKeluarga) || 0) +
                          (Number(eInsentifCuti) || 0) +
                          (Number(eBonusIncentive) || 0)
                      )}
                    </span>
                  </div>
                </div>

                {/* Kolom 2: Potongan */}
                <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                      <span className="font-bold text-xs uppercase tracking-wider text-rose-900">
                        B. Komponen Potongan
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                        Deductions
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Hari Tidak Masuk / Alpa (Hari)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={31}
                          value={eAbsentCount}
                          onChange={(e) => setEAbsentCount(Number(e.target.value) || 0)}
                          className="w-24 px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white font-mono font-semibold focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                        />
                        <span className="text-gray-500 text-xs">Hari</span>
                      </div>
                      <div className="text-[11px] text-rose-700 mt-1 font-medium">
                        Potongan: {eAbsentCount} × Rp28.500 ={' '}
                        <strong className="font-mono">{formatRupiah(eAbsentCount * 28500)}</strong>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Potongan Kasbon / Lainnya (Rp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={eOtherDeductions}
                        onChange={(e) => setEOtherDeductions(Number(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white font-mono font-semibold focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    {/* Subtotal Potongan */}
                    <div className="pt-2 border-t border-rose-200 flex items-center justify-between font-bold text-rose-900">
                      <span>Total Potongan (B):</span>
                      <span className="font-mono text-sm">
                        {formatRupiah((Number(eOtherDeductions) || 0) + (Number(eAbsentCount) || 0) * 28500)}
                      </span>
                    </div>

                    <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800">
                      Perhitungan gaji bersih langsung diperbarui dan tersimpan permanen pada database lokal & Supabase.
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Bersih Banner (THP) */}
              {(() => {
                const totalE =
                  (Number(eBaseSalary) || 0) +
                  (Number(eGajiBagian) || 0) +
                  (Number(eHadiahPondok) || 0) +
                  (Number(eTipKaca) || 0) +
                  (Number(eTunjanganKeluarga) || 0) +
                  (Number(eInsentifCuti) || 0) +
                  (Number(eBonusIncentive) || 0);
                const totalD = (Number(eOtherDeductions) || 0) + (Number(eAbsentCount) || 0) * 28500;
                const net = Math.max(0, totalE - totalD);

                return (
                  <div className="p-4 bg-kuk-maroon text-white rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-kuk-gold font-bold">
                        Gaji Bersih / Take Home Pay (A - B)
                      </div>
                      <div className="text-[10px] text-white/70">
                        Total Pendapatan ({formatRupiah(totalE)}) - Total Potongan ({formatRupiah(totalD)})
                      </div>
                    </div>
                    <div className="text-2xl font-black text-kuk-gold font-mono tracking-tight">
                      {formatRupiah(net)}
                    </div>
                  </div>
                );
              })()}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditSlipModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSlip}
                  className="px-5 py-2 text-xs font-bold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-xl disabled:opacity-50 transition-colors shadow-xs inline-flex items-center gap-1.5"
                >
                  {savingSlip ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-kuk-gold" />
                      <span>Simpan Perubahan Gaji</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
