import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { glassTipService, employeeService } from '@/services/dataService';
import type { GlassTip, GlassType, GlassTipRate, Employee } from '@/types/models';
import {
  Scissors,
  CheckCircle,
  Clock,
  XCircle,
  Calculator,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  Layers,
  ExternalLink,
  FileSpreadsheet,
  Banknote,
  ShieldCheck,
  Printer,
  Plus,
} from 'lucide-react';
import { PrintHeader } from '@/components/common/PrintHeader';
import { exportToCSV } from '@/utils/exportUtils';
import { PageHeader } from '@/components/ui';

export const GlassTipListPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { hasPermission } = useAuth();
  const [tips, setTips] = useState<GlassTip[]>([]);
  const [glassTypes, setGlassTypes] = useState<GlassType[]>([]);
  const [glassRates, setGlassRates] = useState<GlassTipRate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  // Tab: Daftar Nota Transaksi vs Rekap Tip Payroll
  const [activeTab, setActiveTab] = useState<'TIPS' | 'PAYROLL_RECAP'>('TIPS');
  const [cutterRecap, setCutterRecap] = useState<any[]>([]);
  const [recapLoading, setRecapLoading] = useState<boolean>(false);

  // Verification modal state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedTip, setSelectedTip] = useState<GlassTip | null>(null);
  const [verifiedAmount, setVerifiedAmount] = useState<number>(0);
  const [verifyAction, setVerifyAction] = useState<'VERIFY' | 'REJECT'>('VERIFY');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Detail Modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [tipForDetail, setTipForDetail] = useState<GlassTip | null>(null);

  // Rates Modal state
  const [ratesModalOpen, setRatesModalOpen] = useState(false);
  const [printReceiptModalOpen, setPrintReceiptModalOpen] = useState(false);
  const [selectedTipForPrint, setSelectedTipForPrint] = useState<GlassTip | null>(null);

  // Modal Input Catat Tip Potong Kaca (Sesuai Referensi Web)
  const [inputModalOpen, setInputModalOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tEmpId, setTEmpId] = useState('');
  const [tGlassTypeId, setTGlassTypeId] = useState('');
  const [tInputMode, setTInputMode] = useState<'AREA' | 'DIMENSION'>('AREA');
  const [tAreaSqm, setTAreaSqm] = useState<number>(1.5);
  const [tLengthCm, setTLengthCm] = useState<number>(150);
  const [tHeightCm, setTHeightCm] = useState<number>(100);
  const [tDate, setTDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tNotes, setTNotes] = useState('');
  const [tSubmitting, setTSubmitting] = useState(false);

  const loadData = async () => {
    const targetUnitId = activeUnitId || '00000000-0000-0000-0000-000000000001';
    setLoading(true);
    setError(null);
    const [res, types, rates, empRes] = await Promise.all([
      glassTipService.getGlassTipsByUnit(targetUnitId),
      glassTipService.getGlassTypes(targetUnitId),
      glassTipService.getGlassTipRates(targetUnitId),
      employeeService.getEmployeesByUnit(targetUnitId),
    ]);
    setTips(res.data);
    setGlassTypes(types);
    setGlassRates(rates);
    const activeEmps = empRes.data.filter((e) => e.status === 'ACTIVE');
    setEmployees(activeEmps);
    if (activeEmps.length > 0 && !tEmpId) {
      setTEmpId(activeEmps[0].id);
    }
    if (types.length > 0 && !tGlassTypeId) {
      setTGlassTypeId(types[0].id);
    }
    if (!res.success && res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  const loadCutterRecap = async () => {
    const targetUnitId = activeUnitId || '00000000-0000-0000-0000-000000000001';
    setRecapLoading(true);
    const res = await glassTipService.getCutterTipPayrollRecap(targetUnitId);
    setCutterRecap(res.data || []);
    setRecapLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId]);

  useEffect(() => {
    if (activeTab === 'PAYROLL_RECAP') {
      loadCutterRecap();
    }
  }, [activeUnitId, activeTab]);

  const handleExportPayrollRecapCSV = () => {
    const headers = [
      'Kode Karyawan',
      'Nama Pemotong',
      'Bagian',
      'Nota Terverifikasi',
      'Total Luas (m2)',
      'Tip Terverifikasi (Rp)',
      'Nota Pending',
      'Estimasi Tip Pending (Rp)',
      'Status Payroll',
    ];
    const rows = cutterRecap.map((c) => [
      c.employee_code,
      c.employee_name,
      c.department_name,
      c.verified_nota_count,
      c.total_sqm,
      c.verified_tip_total,
      c.pending_nota_count,
      c.pending_tip_estimate,
      c.payroll_ready ? 'SIAP PAYROLL' : 'ADA PENDING',
    ]);
    exportToCSV(`Rekap_Tip_Payroll_${activeUnit?.code || 'KUK'}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId]);

  const showToast = (msg: string, isError = false) => {
    setToast({ text: msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenVerify = (tip: GlassTip) => {
    setSelectedTip(tip);
    setVerifiedAmount(tip.tip_amount);
    setVerifyAction('VERIFY');
    setVerifyNotes('');
    setVerifyModalOpen(true);
  };

  const handleOpenDetail = (tip: GlassTip) => {
    setTipForDetail(tip);
    setDetailModalOpen(true);
  };

  const handleProcessVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTip || !activeUnitId) return;

    setVerifying(true);
    const res = await glassTipService.verifyTipNota(
      activeUnitId,
      selectedTip.id,
      Number(verifiedAmount),
      verifyAction,
      verifyNotes.trim()
    );
    setVerifying(false);
    showToast(res.message, !res.success);

    if (res.success) {
      setVerifyModalOpen(false);
      setSelectedTip(null);
      loadData();
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const handleExportCSV = () => {
    const headers = [
      'Kode Nota',
      'Tanggal',
      'Pemotong',
      'Jenis Kaca',
      'Dimensi (cm)',
      'Lembar',
      'Luas (m2)',
      'Nilai Kaca (Rp)',
      'Tip Standar (Rp)',
      'Status',
      'Nominal Terverifikasi (Rp)',
      'Catatan',
    ];
    const rows = tips.map((t) => [
      t.reference_code,
      t.created_at,
      t.employee?.full_name || '',
      t.glass_type?.name || '',
      `${t.length_cm}x${t.height_cm}`,
      t.quantity,
      t.calculated_sqm,
      t.glass_price_snapshot,
      t.tip_amount,
      t.status,
      t.verified_amount || 0,
      t.notes || '',
    ]);
    exportToCSV(`Nota_Tip_Kaca_${activeUnit?.code || 'KUK'}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const filtered = tips.filter((t) => statusFilter === 'ALL' || t.status === statusFilter);

  const selectedRate = glassRates.find((r) => r.glass_type_id === tGlassTypeId) || null;
  const pricePerSqm = selectedRate?.price_per_sqm || 0;
  const calculatedSqm =
    tInputMode === 'DIMENSION'
      ? Math.round(((tLengthCm * tHeightCm) / 10000) * 100) / 100
      : tAreaSqm;
  const totalGlassPrice = Math.round(calculatedSqm * pricePerSqm);
  const tipAmount = Math.round(totalGlassPrice * 0.03);

  const handleSaveTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId) return;
    if (!tEmpId) {
      showToast('Pilih karyawan pemotong terlebih dahulu.', true);
      return;
    }
    if (!tGlassTypeId) {
      showToast('Pilih jenis kaca terlebih dahulu.', true);
      return;
    }
    if (calculatedSqm <= 0) {
      showToast('Luas kaca harus lebih besar dari 0 m².', true);
      return;
    }

    setTSubmitting(true);
    const emp = employees.find((e) => e.id === tEmpId);
    const res = await glassTipService.submitGlassTip(activeUnitId, {
      employee_id: tEmpId,
      glass_type_id: tGlassTypeId,
      length_cm: tInputMode === 'DIMENSION' ? tLengthCm : Math.round(Math.sqrt(calculatedSqm) * 100),
      height_cm: tInputMode === 'DIMENSION' ? tHeightCm : Math.round(Math.sqrt(calculatedSqm) * 100),
      quantity: 1,
      calculated_sqm: calculatedSqm,
      glass_price_snapshot: totalGlassPrice,
      tip_amount: tipAmount,
      notes: tNotes || `Pemotongan ${emp?.full_name || 'Karyawan'} (${tDate})`,
    });
    setTSubmitting(false);

    if (res.success) {
      showToast('✓ Data tip potong kaca 3% berhasil disimpan!');
      setInputModalOpen(false);
      setTNotes('');
      await loadData();
    } else {
      showToast(res.message || 'Gagal menyimpan data tip potong kaca.', true);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm animate-in slide-in-from-bottom duration-200 ${
          toast.isError ? 'bg-red-900 border border-red-700' : 'bg-gray-900'
        }`}>
          {toast.isError ? (
            <XCircle className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header Halaman */}
      <PageHeader
        title="Tip Pemotongan Kaca"
        subtitle={`Verifikasi fisik nota & klaim tip potongan kaca unit ${activeUnit?.name || 'Unit Aktif'}`}
        icon={<Scissors className="w-6 h-6 text-kuk-maroon" />}
        breadcrumbs={[{ label: 'Beranda', href: '/dashboard' }, { label: 'Tip Potong Kaca' }]}
        unitBadge={activeUnit?.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
              title="Ekspor CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-kuk-maroon" />
              <span>Ekspor CSV</span>
            </button>

            <button
              onClick={() => {
                if (employees.length > 0 && !tEmpId) setTEmpId(employees[0].id);
                if (glassTypes.length > 0 && !tGlassTypeId) setTGlassTypeId(glassTypes[0].id);
                setInputModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-kuk-maroon text-white hover:bg-kuk-maroon-dark rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4 text-kuk-gold" />
              <span>Catat Tip Potong Kaca</span>
            </button>

            <button
              onClick={() => setRatesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-kuk-maroon" />
              <span>Tarif Kaca ({glassTypes.length})</span>
            </button>

            <a
              href="/kiosk/glass-tip"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-kuk-maroon text-white hover:bg-kuk-maroon-dark rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              <ExternalLink className="w-4 h-4 text-kuk-gold" />
              <span>Kiosk Potong Kaca</span>
            </a>
          </div>
        }
      />

      {/* Notice Banner */}
      <div className="p-3 bg-amber-50/70 text-gray-800 border border-amber-200 rounded-xl text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-kuk-maroon shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] bg-kuk-gold text-kuk-maroon px-1.5 py-0.5 rounded font-mono mr-1.5">FORMULA RESMI</span>
            <span>Tip dihitung 3% dari harga dasar kaca sesuai tarif master aktif unit (tanpa pembulatan kelipatan Rp1.000). Nilai akhir mengikuti verifikasi fisik kasir/checker.</span>
          </div>
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
            onClick={loadData}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline ml-3 shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setActiveTab('TIPS')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'TIPS'
              ? 'border-kuk-maroon text-kuk-maroon'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>Daftar Nota Transaksi</span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tips.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('PAYROLL_RECAP')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'PAYROLL_RECAP'
              ? 'border-kuk-maroon text-kuk-maroon'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Banknote className="w-4 h-4" />
          <span>Rekap Distribusi Tip untuk Payroll</span>
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Terverifikasi</span>
        </button>
      </div>

      {activeTab === 'PAYROLL_RECAP' ? (
        /* REKAP DISTRIBUSI TIP UNTUK PAYROLL */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Rekapitulasi Tip Pemotong Siap Payroll</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Akumulasi nota tip potongan kaca yang telah terverifikasi oleh kasir/checker untuk unit {activeUnit?.name || ''}
              </p>
            </div>

            <button
              onClick={handleExportPayrollRecapCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor CSV Rekap</span>
            </button>
          </div>

          <div className="p-3 bg-purple-50 text-purple-900 border border-purple-200 rounded-xl text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
            <span>
              <strong>Integritas Payroll Terjamin:</strong> Hanya nota dengan status <strong>VERIFIED</strong> yang akan ditarik ke dalam perhitungan slip gaji final (melalui RPC <code>calculate_and_finalize_payroll_atomic</code>). Nota PENDING tidak diperhitungkan.
            </span>
          </div>

          {recapLoading ? (
            <div className="text-center py-8 text-xs text-gray-400">Memuat rekapitulasi tip payroll...</div>
          ) : cutterRecap.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">Tidak ada data pemotong kaca terdaftar</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Karyawan Pemotong</th>
                    <th className="px-4 py-2.5">Bagian</th>
                    <th className="px-4 py-2.5 text-center">Nota Terverifikasi</th>
                    <th className="px-4 py-2.5 text-center">Total Luas (m²)</th>
                    <th className="px-4 py-2.5">Tip Terverifikasi (Rp)</th>
                    <th className="px-4 py-2.5">Nota Pending</th>
                    <th className="px-4 py-2.5 text-right">Status Kesiapan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cutterRecap.map((c) => (
                    <tr key={c.employee_id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{c.employee_name}</div>
                        <div className="font-mono text-[10px] text-gray-400">{c.employee_code}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.department_name}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-700">{c.verified_nota_count} Nota</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-700">{c.total_sqm} m²</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">{formatRupiah(c.verified_tip_total)}</td>
                      <td className="px-4 py-3">
                        {c.pending_nota_count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>{c.pending_nota_count} nota belum verif ({formatRupiah(c.pending_tip_estimate)})</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">- Semua terverifikasi -</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.payroll_ready
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {c.payroll_ready ? 'Siap Payroll' : 'Ada Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* DAFTAR NOTA TRANSAKSI */
        <>
          {/* Filter Tabs */}
          <div className="flex gap-2 border-b border-gray-200 pb-2">
            {['ALL', 'PENDING', 'VERIFIED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  statusFilter === st
                    ? 'bg-kuk-maroon text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {st === 'ALL' ? 'Semua Nota' : st}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Memuat data nota tip...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Scissors className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-700">Belum ada nota pemotongan kaca</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                    <tr>
                      <th className="px-5 py-3.5">Kode Transaksi</th>
                      <th className="px-5 py-3.5">Pemotong / Sopir</th>
                      <th className="px-5 py-3.5">Dimensi Kaca</th>
                      <th className="px-5 py-3.5">Nilai Kaca</th>
                      <th className="px-5 py-3.5">Tip Standar</th>
                      <th className="px-5 py-3.5">Nominal Verifikasi</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/80">
                        <td className="px-5 py-4">
                          <div className="font-mono text-xs font-bold text-gray-800">{t.reference_code}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleDateString('id-ID')}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-gray-900">{t.employee?.full_name || 'Karyawan'}</div>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <div>{t.glass_type?.name || 'Kaca Standar'}</div>
                          <div className="text-gray-400 mt-0.5">
                            {t.length_cm} × {t.height_cm} cm ({t.quantity} lbr = {t.calculated_sqm} m²)
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-gray-700">
                          {formatRupiah(t.glass_price_snapshot)}
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-gray-900">
                          {formatRupiah(t.tip_amount)}
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-emerald-700">
                          {t.verified_amount ? formatRupiah(t.verified_amount) : '— Belum Verif —'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              t.status === 'VERIFIED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : t.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {t.status === 'VERIFIED' && <CheckCircle className="w-3 h-3" />}
                            {t.status === 'PENDING' && <Clock className="w-3 h-3" />}
                            {t.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                            <span>{t.status}</span>
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedTipForPrint(t);
                                setPrintReceiptModalOpen(true);
                              }}
                              className="p-1.5 text-gray-500 hover:text-kuk-maroon hover:bg-kuk-maroon-50 rounded-lg transition-colors"
                              title="Cetak Nota Verifikasi Tip"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDetail(t)}
                              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Lihat Rincian Perhitungan"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {hasPermission('glass_tips.verify', activeUnitId) && t.status === 'PENDING' && (
                              <button
                                onClick={() => handleOpenVerify(t)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-kuk-maroon text-white rounded-lg text-xs font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
                              >
                                <FileCheck2 className="w-3.5 h-3.5" />
                                <span>Verifikasi</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Detail Nota */}
      {detailModalOpen && tipForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Rincian Nota Pemotongan Kaca</h2>
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <div className="text-gray-400">Kode Transaksi</div>
                  <div className="font-mono font-bold text-gray-900">{tipForDetail.reference_code}</div>
                </div>
                <div>
                  <div className="text-gray-400">Tanggal & Waktu</div>
                  <div className="text-gray-800">{new Date(tipForDetail.created_at).toLocaleString('id-ID')}</div>
                </div>
                <div>
                  <div className="text-gray-400">Nama Pemotong / Karyawan</div>
                  <div className="font-bold text-gray-900">{tipForDetail.employee?.full_name}</div>
                </div>
                <div>
                  <div className="text-gray-400">Status Saat Ini</div>
                  <div className="font-semibold text-kuk-maroon">{tipForDetail.status}</div>
                </div>
              </div>

              <div className="p-4 border border-gray-200 rounded-xl space-y-2">
                <div className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-1">
                  Spesifikasi & Volume Potongan
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Jenis Kaca:</span>
                  <span className="font-semibold">{tipForDetail.glass_type?.name || 'Kaca Standar'} ({tipForDetail.glass_type?.thickness_mm || '-'} mm)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Dimensi Potongan:</span>
                  <span className="font-mono">{tipForDetail.length_cm} cm × {tipForDetail.height_cm} cm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Jumlah Lembar:</span>
                  <span className="font-mono">{tipForDetail.quantity} lembar</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Luas Terpotong (m²):</span>
                  <span className="font-mono font-bold text-kuk-maroon">{tipForDetail.calculated_sqm} m²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nilai Jual Kaca:</span>
                  <span className="font-semibold">{formatRupiah(tipForDetail.glass_price_snapshot)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold">
                  <span className="text-gray-800">Klaim Tip Standar:</span>
                  <span className="text-kuk-maroon">{formatRupiah(tipForDetail.tip_amount)}</span>
                </div>
                {tipForDetail.verified_amount !== null && tipForDetail.verified_amount !== undefined && (
                  <div className="flex justify-between border-t border-emerald-100 pt-2 text-sm font-bold text-emerald-800 bg-emerald-50/50 p-2 rounded">
                    <span>Nominal Terverifikasi:</span>
                    <span>{formatRupiah(tipForDetail.verified_amount)}</span>
                  </div>
                )}
              </div>

              {tipForDetail.notes && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-gray-400 font-medium">Catatan Pemotong:</div>
                  <div className="text-gray-800 mt-0.5">{tipForDetail.notes}</div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Daftar Tarif Kaca Aktif */}
      {ratesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Daftar Tarif & Jenis Kaca Terdaftar</h2>
              </div>
              <button onClick={() => setRatesModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-gray-500">
                Tarif harga jual kaca per meter persegi digunakan oleh kiosk untuk kalkulasi otomatis tip potongan 3%.
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Jenis Kaca</th>
                      <th className="px-4 py-2.5">Ketebalan</th>
                      <th className="px-4 py-2.5">Harga per m²</th>
                      <th className="px-4 py-2.5">Estimasi Tip/m²</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {glassTypes.map((gt) => {
                      const rate = glassRates.find((r) => r.glass_type_id === gt.id);
                      const priceSqm = rate?.price_per_sqm || 0;
                      const ratePct = rate?.default_percentage || 0.03;
                      const estTipSqm = Math.ceil((priceSqm * ratePct) / 1000) * 1000;
                      return (
                        <tr key={gt.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{gt.name}</td>
                          <td className="px-4 py-3 font-mono">{gt.thickness_mm} mm</td>
                          <td className="px-4 py-3 font-medium text-gray-700">{formatRupiah(priceSqm)}</td>
                          <td className="px-4 py-3 font-bold text-kuk-maroon">{formatRupiah(estTipSqm)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  onClick={() => setRatesModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Verifikasi Nota Fisik */}
      {verifyModalOpen && selectedTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Verifikasi Fisik Nota Tip ({selectedTip.reference_code})</h2>
              </div>
              <button onClick={() => setVerifyModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleProcessVerify} className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pemotong Kaca:</span>
                  <span className="font-bold text-gray-900">{selectedTip.employee?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dimensi & Volume:</span>
                  <span className="font-mono text-gray-800">{selectedTip.length_cm} × {selectedTip.height_cm} cm ({selectedTip.calculated_sqm} m²)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Nilai Kaca Terpotong:</span>
                  <span className="font-semibold text-gray-900">{formatRupiah(selectedTip.glass_price_snapshot)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-500">Klaim Tip Standar:</span>
                  <span className="font-bold text-kuk-maroon">{formatRupiah(selectedTip.tip_amount)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Keputusan Verifikasi *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifyAction('VERIFY')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-colors ${
                      verifyAction === 'VERIFY'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Setujui (VERIFY)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyAction('REJECT')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-colors ${
                      verifyAction === 'REJECT'
                        ? 'border-rose-600 bg-rose-50 text-rose-800'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Tolak (REJECT)
                  </button>
                </div>
              </div>

              {verifyAction === 'VERIFY' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal Tip Disetujui (Rp) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000"
                    value={verifiedAmount}
                    onChange={(e) => setVerifiedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-bold text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Staf dapat mengoreksi nominal jika terdapat cacat nota atau toleransi limbah kaca.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan Verifikasi</label>
                <textarea
                  rows={2}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Catatan fisik nota, nomor surat jalan delivery, dll..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setVerifyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {verifying ? 'Memproses...' : 'Simpan Verifikasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cetak Nota Verifikasi Tip Kaca */}
      {printReceiptModalOpen && selectedTipForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-3.5 bg-gray-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-kuk-gold" />
                <span className="font-bold text-sm">Nota Tip Kaca — {selectedTipForPrint.reference_code}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-kuk-maroon text-white hover:bg-kuk-maroon-700 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Nota</span>
                </button>
                <button
                  onClick={() => setPrintReceiptModalOpen(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 text-xs bg-white text-gray-800">
              <PrintHeader
                title="TANDA TERIMA VERIFIKASI TIP POTONG KACA"
                documentNumber={selectedTipForPrint.reference_code}
                unitName={activeUnit?.name}
                unitCode={activeUnit?.code}
              />

              <div className="grid grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                <div className="space-y-1">
                  <div className="text-gray-500 text-[11px]">Karyawan Pemotong Kaca (Cutter):</div>
                  <div className="font-bold text-gray-900 text-sm">{selectedTipForPrint.employee?.full_name || 'Karyawan Unit'}</div>
                  <div className="text-gray-600 font-medium">NIP: {selectedTipForPrint.employee?.employee_code || '-'}</div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-gray-500 text-[11px]">Status Verifikasi:</div>
                  <div className="font-bold text-sm">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      selectedTipForPrint.status === 'VERIFIED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedTipForPrint.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {selectedTipForPrint.status}
                    </span>
                  </div>
                  {selectedTipForPrint.created_at && (
                    <div className="text-[10px] text-gray-500">Tgl: {new Date(selectedTipForPrint.created_at).toLocaleString('id-ID')}</div>
                  )}
                </div>
              </div>

              {/* Rincian Pemotongan */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-bold text-gray-800">
                  Rincian Pemotongan & Spesifikasi Kaca
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-500">Tipe Kaca:</span>
                    <div className="font-semibold text-gray-900 mt-0.5">{selectedTipForPrint.glass_type?.name || 'Kaca Standar'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Dimensi & Lembar:</span>
                    <div className="font-semibold text-gray-900 mt-0.5">
                      {selectedTipForPrint.length_cm} × {selectedTipForPrint.height_cm} cm ({selectedTipForPrint.quantity} Lembar)
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Luas Total (m²):</span>
                    <div className="font-mono font-bold text-gray-900 mt-0.5">{selectedTipForPrint.calculated_sqm} m²</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Harga Dasar Kaca:</span>
                    <div className="font-mono font-bold text-gray-900 mt-0.5">{formatRupiah(selectedTipForPrint.glass_price_snapshot)}</div>
                  </div>
                </div>
              </div>

              {/* Nilai Tip */}
              <div className="p-4 bg-kuk-maroon text-white rounded-xl flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-xs uppercase tracking-wider text-kuk-gold font-bold">Total Nilai Tip Terverifikasi</div>
                  <div className="text-[11px] text-white/80 mt-0.5">Formula Komisi Baku 3% dari Harga Kaca (SOP KUK)</div>
                </div>
                <div className="text-2xl font-black text-kuk-gold font-mono tracking-tight">
                  {formatRupiah(selectedTipForPrint.verified_amount || selectedTipForPrint.tip_amount)}
                </div>
              </div>

              {selectedTipForPrint.notes && (
                <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <strong>Catatan Verifikator:</strong> {selectedTipForPrint.notes}
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200 text-center">
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Karyawan Pemotong:</div>
                  <div className="border-b border-gray-300 w-28 mx-auto"></div>
                  <div className="font-bold text-gray-800">({selectedTipForPrint.employee?.full_name || 'Cutter'})</div>
                </div>
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Kasir / Verifikator:</div>
                  <div className="border-b border-gray-300 w-28 mx-auto"></div>
                  <div className="font-bold text-gray-800">(Kasir Unit)</div>
                </div>
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Kepala Toko / Manajer:</div>
                  <div className="border-b border-gray-300 w-28 mx-auto"></div>
                  <div className="font-bold text-gray-800">(Manajer Unit)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Catat Tip Potong Kaca 3% (Sesuai Referensi Web KUK) */}
      {inputModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-kuk-gold" />
                <div>
                  <h2 className="font-bold text-sm">Catat Tip Potong Kaca 3%</h2>
                  <p className="text-[11px] text-gray-200">
                    Kalkulasi komisi tip potong kaca unit {activeUnit?.name || ''} otomatis.
                  </p>
                </div>
              </div>
              <button onClick={() => setInputModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTip} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Pilih Karyawan Pemotong *</label>
                <select
                  required
                  value={tEmpId}
                  onChange={(e) => setTEmpId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                >
                  <option value="" disabled>-- Pilih Karyawan --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code}) — {emp.position?.title || emp.department?.name || 'Operasional'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Jenis Kaca & Tarif Dasar *</label>
                <select
                  required
                  value={tGlassTypeId}
                  onChange={(e) => setTGlassTypeId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                >
                  <option value="" disabled>-- Pilih Jenis Kaca --</option>
                  {glassTypes.map((gt) => {
                    const r = glassRates.find((rate) => rate.glass_type_id === gt.id);
                    const p = r?.price_per_sqm || 0;
                    return (
                      <option key={gt.id} value={gt.id}>
                        {gt.name} ({gt.thickness_mm}mm) — {formatRupiah(p)}/m²
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 text-xs">Mode Input Dimensi / Luas:</span>
                  <div className="flex bg-gray-200 p-0.5 rounded-lg text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setTInputMode('AREA')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        tInputMode === 'AREA' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
                      }`}
                    >
                      Luas Langsung (m²)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTInputMode('DIMENSION')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        tInputMode === 'DIMENSION' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
                      }`}
                    >
                      Panjang × Tinggi (cm)
                    </button>
                  </div>
                </div>

                {tInputMode === 'AREA' ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Luas Kaca (m²)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0.01}
                      required
                      value={tAreaSqm}
                      onChange={(e) => setTAreaSqm(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-sm font-bold border border-gray-200 rounded-xl bg-white"
                      placeholder="Contoh: 1.5"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Panjang (cm)</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={tLengthCm}
                        onChange={(e) => setTLengthCm(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-xl bg-white"
                        placeholder="Contoh: 150"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Tinggi / Lebar (cm)</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={tHeightCm}
                        onChange={(e) => setTHeightCm(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-xl bg-white"
                        placeholder="Contoh: 100"
                      />
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-gray-500 font-medium">
                  Kalkulasi Luas Terhitung: <strong className="text-gray-900 font-mono">{calculatedSqm} m²</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 bg-kuk-maroon/5 border border-kuk-maroon/20 rounded-xl">
                <div>
                  <div className="text-[11px] text-gray-500 font-medium">Total Harga Kaca:</div>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">{formatRupiah(totalGlassPrice)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-kuk-maroon font-bold uppercase tracking-wider">Tip Karyawan (3%):</div>
                  <div className="text-base font-extrabold text-kuk-maroon mt-0.5">{formatRupiah(tipAmount)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Pemotongan</label>
                  <input
                    type="date"
                    required
                    value={tDate}
                    onChange={(e) => setTDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">No. Nota / Catatan (Opsional)</label>
                  <input
                    type="text"
                    value={tNotes}
                    onChange={(e) => setTNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                    placeholder="Contoh: Nota #K-1029"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setInputModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={tSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-dark rounded-xl disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <span>💾</span>
                  <span>{tSubmitting ? 'Menyimpan...' : 'Simpan Data Tip Kaca'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};