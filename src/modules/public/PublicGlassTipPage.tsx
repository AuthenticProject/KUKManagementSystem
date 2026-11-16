import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { glassTipService, systemService, employeeService } from '@/services/dataService';
import { cloudSyncService, MASTER_GLASS_RATES, type MasterGlassRate } from '@/services/cloudSyncService';
import type { Employee, GlassTip } from '@/types/models';
import {
  CheckCircle2,
  AlertCircle,
  User,
  RotateCcw,
  ArrowLeft,
  Send,
  Calendar,
} from 'lucide-react';

export const PublicGlassTipPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [glassRateId, setGlassRateId] = useState<string>(MASTER_GLASS_RATES[0].id);
  const [inputMode, setInputMode] = useState<'SQM' | 'DIMENSION'>('SQM');
  const [areaSqm, setAreaSqm] = useState<number>(1.5);
  const [lengthCm, setLengthCm] = useState<number>(150);
  const [heightCm, setHeightCm] = useState<number>(100);
  const [cuttingDate, setCuttingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [recentTips, setRecentTips] = useState<GlassTip[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  const [receipt, setReceipt] = useState<{
    referenceCode: string;
    employeeName: string;
    glassName: string;
    calculatedSqm: number;
    glassPrice: number;
    tipAmount: number;
    cuttingDate: string;
    submittedAt: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const loadData = async () => {
    const uList = await systemService.getUnits();
    const unitId = uList.length > 0 ? uList[0].id : '00000000-0000-0000-0000-000000000001';

    const [empRes, tipRes] = await Promise.all([
      employeeService.getEmployeesByUnit(unitId),
      glassTipService.getGlassTipsByUnit(unitId),
    ]);
    const empList = empRes.data || [];
    setEmployees(empList);
    setRecentTips(tipRes.data || []);
    if (empList.length > 0 && !selectedEmpId) {
      setSelectedEmpId(empList[0].id);
    }

    // Sinkronisasi data cloud online dari Google Apps Script
    try {
      const cloudData = await cloudSyncService.fetchCloudData();
      if (cloudData && cloudData.karyawan && cloudData.karyawan.length > 0) {
        const cloudEmployees: Employee[] = cloudData.karyawan.map((k) => ({
          id: k.id,
          unit_id: unitId,
          department_id: 'dept-01',
          position_id: 'pos-01',
          work_schedule_id: 'sch-01',
          employee_code: k.id,
          full_name: k.nama,
          email: `${k.nama.toLowerCase().replace(/\s+/g, '')}@kuk.co.id`,
          phone: '08123456789',
          gender: 'L',
          marital_status: 'SINGLE',
          status: 'ACTIVE',
          employment_type: 'PKWT',
          join_date: '2023-01-01',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          department: { id: 'dept-01', unit_id: unitId, code: 'OPR', name: k.bagian || 'Operasional', is_active: true, created_at: '' },
          position: { id: 'pos-01', unit_id: unitId, department_id: 'dept-01', code: 'STAFF', title: k.bagian || 'Karyawan', level: 2, is_active: true, created_at: '' },
        }));

        setEmployees((prev) => {
          const names = new Set(prev.map((e) => e.full_name.toLowerCase()));
          const newEmps = cloudEmployees.filter((c) => !names.has(c.full_name.toLowerCase()));
          return [...prev, ...newEmps];
        });
      }

      if (cloudData && cloudData.tips && cloudData.tips.length > 0) {
        const mappedTips: GlassTip[] = cloudData.tips.map((t, idx) => ({
          id: t.id || `tip-cloud-${idx}`,
          unit_id: unitId,
          reference_code: t.id ? `TIP-${t.id}` : `TIP-${idx}`,
          employee_id: t.idKaryawan || 'emp-01',
          glass_type_id: 'gt-01',
          length_cm: 100,
          height_cm: 100,
          quantity: 1,
          calculated_sqm: t.luas || 1,
          glass_price_snapshot: t.totalHarga || 0,
          tip_percentage_snapshot: 0.03,
          rounding_rule: 'EXACT',
          tip_amount: t.tip || 0,
          verified_amount: t.tip || null,
          status: 'VERIFIED',
          created_at: t.tanggal || new Date().toISOString(),
          employee: {
            full_name: t.nama || 'Karyawan',
            employee_code: t.idKaryawan || 'EMP',
          } as Employee,
          glass_type: {
            id: 'gt-01',
            unit_id: unitId,
            name: t.jenisKaca || 'Kaca',
            code: 'KACA',
            thickness_mm: 5,
            is_active: true,
          },
        }));
        setRecentTips((prev) => {
          const ids = new Set(prev.map((x) => x.id));
          const newTips = mappedTips.filter((m) => !ids.has(m.id));
          return [...prev, ...newTips];
        });
      }
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedRate: MasterGlassRate =
    MASTER_GLASS_RATES.find((r) => r.id === glassRateId) || MASTER_GLASS_RATES[0];
  const calculatedSqm =
    inputMode === 'SQM'
      ? Number(areaSqm || 0)
      : Number(((lengthCm * heightCm) / 10000).toFixed(4));
  const totalGlassPrice = Math.round(calculatedSqm * selectedRate.pricePerSqm);
  // Formula resmi 3% tanpa pembulatan tidak sah
  const tipAmount = Math.round(totalGlassPrice * 0.03);

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedEmpId || !selectedEmp) {
      setErrorMsg('Pilih nama karyawan yang melakukan pemotongan kaca.');
      return;
    }
    if (calculatedSqm <= 0) {
      setErrorMsg('Luas kaca harus lebih besar dari 0 m².');
      return;
    }

    setSubmitting(true);
    const unitId = selectedEmp.unit_id || '00000000-0000-0000-0000-000000000001';

    try {
      // 1. Simpan ke database sistem
      const res = await glassTipService.submitGlassTip(unitId, {
        employee_id: selectedEmp.id,
        glass_type_id: selectedRate.id,
        length_cm: inputMode === 'DIMENSION' ? lengthCm : Math.round(Math.sqrt(calculatedSqm) * 100),
        height_cm: inputMode === 'DIMENSION' ? heightCm : Math.round(Math.sqrt(calculatedSqm) * 100),
        quantity: 1,
        calculated_sqm: calculatedSqm,
        glass_price_snapshot: totalGlassPrice,
        tip_amount: tipAmount,
        notes: notes || `Pemotongan ${selectedRate.name} (${cuttingDate})`,
      });

      // 2. Simpan ke Cloud Database Google Apps Script agar tersinkron online di semua device
      await cloudSyncService.saveTipToCloud({
        karyawan: selectedEmp.full_name,
        jenis: selectedRate.name,
        luas: calculatedSqm,
        totalHarga: totalGlassPrice,
        tip: tipAmount,
        waktu: cuttingDate,
      });

      const refCode = res.reference_code || `TIP-${Date.now().toString().slice(-6)}`;
      setReceipt({
        referenceCode: refCode,
        employeeName: selectedEmp.full_name,
        glassName: selectedRate.name,
        calculatedSqm: calculatedSqm,
        glassPrice: totalGlassPrice,
        tipAmount: tipAmount,
        cuttingDate: cuttingDate,
        submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });

      showToast('✓ Data tip potong kaca 3% berhasil disimpan online!');

      // WhatsApp format matching tip.html
      const waText = encodeURIComponent(
        `*CATATAN TIP POTONG KACA 3% TB. KUK*\n\n` +
        `• *Karyawan:* ${selectedEmp.full_name}\n` +
        `• *Jenis Kaca:* ${selectedRate.name}\n` +
        `• *Luas Kaca:* ${calculatedSqm} m²\n` +
        `• *Total Harga Kaca:* Rp ${totalGlassPrice.toLocaleString('id-ID')}\n` +
        `• *Komisi Tip 3%:* Rp ${tipAmount.toLocaleString('id-ID')}\n` +
        `• *Tanggal Pemotongan:* ${cuttingDate}\n` +
        `• *Keterangan:* ${notes || '-'}\n\n` +
        `_Tercatat otomatis di Sistem Operasional TB KUK._`
      );
      window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi gangguan saat menyimpan data tip kaca.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setAreaSqm(1.5);
    setNotes('');
    setReceipt(null);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between relative overflow-x-hidden">
      {/* Decorative Brand Top Banner */}
      <div className="h-2 bg-gradient-to-r from-[#540000] via-[#FFCC00] to-[#540000]" />

      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header Bar with prominent Back to Landing Page */}
      <header className="bg-white border-b border-[#E5E5E5] px-4 sm:px-8 py-3.5 shadow-xs sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-[#540000] text-gray-700 hover:text-white text-xs font-bold transition-all border border-gray-200 hover:border-transparent group"
              title="Kembali ke Beranda Landing Page"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#FFCC00] transition-colors" />
              <span>Kembali ke Beranda</span>
            </Link>
            <div className="hidden sm:block border-l border-gray-200 pl-3">
              <div className="text-xs font-black text-[#540000] uppercase tracking-wider font-display">
                Catat Tip Potong Kaca 3%
              </div>
              <div className="text-[10px] text-gray-500 font-semibold">
                Modul Khusus: KUK Bangunan (Potong Kaca) · Kalkulasi Komisi Otomatis
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'form' ? 'bg-white text-[#540000] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Formulir Tip
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'history' ? 'bg-white text-[#540000] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Riwayat Tip
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 w-full flex-1 flex flex-col justify-center">
        {activeTab === 'form' && (
          receipt ? (
            /* Struk Bukti Pengajuan Tip Kaca */
            <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-10 shadow-brand animate-in zoom-in-95 duration-200 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-[#FFCC00]" />

              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs border border-emerald-200">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 font-display">
                  Tip Potong Kaca Berhasil Disimpan!
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  Data komisi tip 3% telah tersimpan online dan disinkronkan ke rekap penggajian.
                </p>
              </div>

              <div className="bg-[#FFF9D6] border border-[#FFE066] p-6 rounded-2xl text-center space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#996414]">
                  Nominal Tip Karyawan (3%)
                </span>
                <div className="text-3xl sm:text-4xl font-mono font-black text-[#540000]">
                  Rp {receipt.tipAmount.toLocaleString('id-ID')}
                </div>
                <div className="text-xs font-bold text-gray-800 pt-1">
                  Untuk: {receipt.employeeName}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] space-y-1">
                  <div className="text-gray-500 font-medium">Jenis Kaca</div>
                  <div className="text-sm font-bold text-gray-900">{receipt.glassName}</div>
                  <div className="text-gray-500">Luas: {receipt.calculatedSqm} m²</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] space-y-1">
                  <div className="text-gray-500 font-medium">Total Harga Kaca</div>
                  <div className="text-sm font-bold text-gray-900">Rp {receipt.glassPrice.toLocaleString('id-ID')}</div>
                  <div className="text-gray-500">Tanggal: {receipt.cuttingDate}</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto flex-1 py-3 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <RotateCcw className="w-4 h-4 text-[#FFCC00]" />
                  <span>Catat Tip Lain</span>
                </button>
                <Link
                  to="/"
                  className="w-full sm:w-auto py-3 px-6 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm transition-colors text-center"
                >
                  Kembali ke Beranda
                </Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-10 shadow-brand space-y-5 relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-[#540000]" />

              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900 font-display">
                    Formulir Tip Potong Kaca 3%
                  </h2>
                  <p className="text-xs text-gray-500">
                    Kalkulasi komisi tip potong kaca untuk karyawan KUK Bangunan secara otomatis.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-[#FFF9D6] text-[#996414] border border-[#FFE066] text-[10px] font-bold rounded-lg uppercase">
                  Online Sync
                </span>
              </div>

              {errorMsg && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-3 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0 text-[#FF0000]" />
                  <span className="font-semibold">{errorMsg}</span>
                </div>
              )}

              {/* Identitas Karyawan Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span>Pilih Karyawan (KUK Bangunan) *</span>
                  </span>
                </label>
                <select
                  required
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                >
                  <option value="">-- Pilih Karyawan Pemotong --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.department?.name || 'Karyawan'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Jenis Kaca Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Jenis Kaca & Tarif Dasar *</label>
                <select
                  value={glassRateId}
                  onChange={(e) => setGlassRateId(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                >
                  {MASTER_GLASS_RATES.map((rate) => (
                    <option key={rate.id} value={rate.id}>
                      {rate.name} - Rp {rate.pricePerSqm.toLocaleString('id-ID')}/m²
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode Input Dimensi / Luas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-700">Dimensi & Luas Kaca *</label>
                  <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setInputMode('SQM')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        inputMode === 'SQM' ? 'bg-white text-[#540000] shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      Luas Langsung (m²)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('DIMENSION')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        inputMode === 'DIMENSION' ? 'bg-white text-[#540000] shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      P × L (cm)
                    </button>
                  </div>
                </div>

                {inputMode === 'SQM' ? (
                  <div>
                    <input
                      type="number"
                      step={0.01}
                      min={0.01}
                      required
                      placeholder="Contoh: 1.5"
                      value={areaSqm}
                      onChange={(e) => setAreaSqm(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-gray-500 font-semibold">Panjang (cm)</span>
                      <input
                        type="number"
                        min={1}
                        value={lengthCm}
                        onChange={(e) => setLengthCm(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] font-mono font-bold text-gray-900 mt-1"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 font-semibold">Tinggi / Lebar (cm)</span>
                      <input
                        type="number"
                        min={1}
                        value={heightCm}
                        onChange={(e) => setHeightCm(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] font-mono font-bold text-gray-900 mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Kalkulasi Otomatis Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#F8F9FA] border border-[#E5E5E5] rounded-2xl text-xs">
                <div>
                  <span className="text-gray-500 font-medium">Total Harga Kaca:</span>
                  <div className="text-base font-extrabold text-gray-900 mt-0.5 font-mono">
                    Rp {totalGlassPrice.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[10px] text-gray-400">Luas: {calculatedSqm} m²</div>
                </div>

                <div className="p-3 bg-[#FFF9D6] border border-[#FFE066] rounded-xl">
                  <span className="text-[#996414] font-bold">Komisi Tip Karyawan (3%):</span>
                  <div className="text-xl font-black text-[#540000] mt-0.5 font-mono">
                    Rp {tipAmount.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Tanggal Pemotongan & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>Tanggal Pemotongan *</span>
                    </span>
                  </label>
                  <input
                    type="date"
                    required
                    value={cuttingDate}
                    onChange={(e) => setCuttingDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Catatan Pemotongan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Kaca jendela pesanan Pak Ahmad"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 select-none active:scale-[0.99]"
                >
                  <Send className="w-4 h-4 text-[#FFCC00]" />
                  <span>{submitting ? 'Menyimpan ke Cloud...' : '💾 Simpan Data Tip Kaca & Kirim WhatsApp'}</span>
                </button>
              </div>
            </form>
          )
        )}

        {/* TAB 2: RIWAYAT TIP TERKINI */}
        {activeTab === 'history' && (
          <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 shadow-brand space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-lg font-black text-gray-900 font-display">
                  Riwayat Tip Potong Kaca
                </h2>
                <p className="text-xs text-gray-500">
                  Data komisi tip potong kaca yang terdaftar di cloud database TB KUK.
                </p>
              </div>
              <button
                onClick={loadData}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
              >
                Muat Ulang
              </button>
            </div>

            {recentTips.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                Belum ada data tip potong kaca yang tercatat.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentTips.slice(0, 10).map((t) => (
                  <div key={t.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900">{t.employee?.full_name || 'Karyawan'}</span>
                        <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                          {t.reference_code || t.id}
                        </span>
                      </div>
                      <div className="text-gray-500">
                        {t.glass_type?.name || 'Kaca'} • Luas: {t.calculated_sqm} m²
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-extrabold text-[#540000]">
                        Rp {(t.verified_amount || t.tip_amount || 0).toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {new Date(t.created_at).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E5E5E5] py-4 px-4 text-center">
        <div className="text-xs text-gray-500 font-medium">
          © 2026 CV Karya Utama Kreasi · Sistem Pencatatan Tip Karyawan Online
        </div>
      </footer>
    </div>
  );
};
