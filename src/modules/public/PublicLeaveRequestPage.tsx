import React, { useState, useEffect, useCallback } from 'react';
import { leaveService, systemService } from '@/services/dataService';
import { useKioskSession } from '@/hooks/useKioskSession';
import {
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  User,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { getUnitBrandInfo } from '@/utils/brandAssets';

interface UnitOption {
  id: string;
  code: string;
  name: string;
  type?: string;
}

export const PublicLeaveRequestPage: React.FC = () => {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Form Fields
  const [employeeCode, setEmployeeCode] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [dates, setDates] = useState<string[]>([new Date().toISOString().substring(0, 10)]);
  const [reason, setReason] = useState<string>('');

  // Submission State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    employeeCode: string;
    targetMonth: string;
    totalDays: number;
    dates: string[];
    submittedAt: string;
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const uList = await systemService.getUnits();
      setUnits(uList);
      if (uList.length > 0) {
        setSelectedUnitId(uList[0].id);
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleAddDate = () => {
    if (dates.length >= 3) {
      setErrorMsg('Batas pengajuan cuti adalah maksimal 3 hari per bulan (SOP KUK).');
      return;
    }
    const lastDate = dates[dates.length - 1];
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 1);
    setDates([...dates, nextDate.toISOString().substring(0, 10)]);
  };

  const handleRemoveDate = (index: number) => {
    if (dates.length <= 1) return;
    setDates(dates.filter((_, i) => i !== index));
  };

  const handleDateChange = (index: number, val: string) => {
    const updated = [...dates];
    updated[index] = val;
    setDates(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUnitId || !employeeCode.trim() || !pin.trim() || !reason.trim()) {
      setErrorMsg('Semua data wajib permohonan cuti harus diisi.');
      return;
    }

    if (pin.length !== 6 || !/^[0-9]{6}$/.test(pin)) {
      setErrorMsg('PIN Karyawan wajib 6 digit angka.');
      return;
    }

    if (dates.length === 0 || dates.length > 3) {
      setErrorMsg('Jumlah cuti harus antara 1 sampai 3 hari.');
      return;
    }

    const uniqueDates = Array.from(new Set(dates));
    if (uniqueDates.length !== dates.length) {
      setErrorMsg('Tanggal cuti yang dipilih tidak boleh duplikat.');
      return;
    }

    try {
      const res = await leaveService.submitLeaveRequestWithPin(
        selectedUnitId,
        employeeCode.trim(),
        pin.trim(),
        {
          target_month: targetMonth,
          total_days: dates.length,
          reason: reason.trim(),
          dates: dates,
        }
      );

      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setReceipt({
          employeeCode: employeeCode.trim(),
          targetMonth: targetMonth,
          totalDays: dates.length,
          dates: dates,
          submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi gangguan jaringan saat memproses permohonan cuti.');
    }
  };

  const handleReset = useCallback(() => {
    setEmployeeCode('');
    setPin('');
    setReason('');
    setDates([new Date().toISOString().substring(0, 10)]);
    setReceipt(null);
    setErrorMsg(null);
  }, []);

  // Kiosk Inactivity auto-reset (60 seconds rule BR-20)
  const { remainingSeconds, timedOut, dismissBanner } = useKioskSession({
    timeoutSeconds: 60,
    onTimeout: handleReset,
  });

  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const brand = getUnitBrandInfo(selectedUnit);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between select-none relative overflow-x-hidden">
      {/* Decorative Brand Top Banner */}
      <div className="h-2 bg-gradient-to-r from-[#540000] via-[#FFCC00] to-[#540000]" />

      {/* Auto Reset Alert Banner */}
      {timedOut && (
        <div className="bg-[#FFF9D6] border-b border-[#FFE066] text-[#996414] px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in sticky top-2 z-50">
          <Clock className="w-4 h-4 text-[#996414]" />
          <span>Sesi kiosk telah di-reset otomatis karena tidak ada aktivitas selama 60 detik (SOP KUK).</span>
          <button
            onClick={dismissBanner}
            className="ml-3 px-2 py-0.5 rounded bg-[#996414]/15 hover:bg-[#996414]/25 text-[10px] font-extrabold uppercase transition-colors"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header Kiosk */}
      <header className="bg-white border-b border-[#E5E5E5] px-4 sm:px-8 py-3.5 shadow-xs sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={brand.logoHorizontal}
              alt={brand.name}
              className="h-9 sm:h-11 w-auto object-contain select-none"
            />
            <div className="hidden sm:block border-l border-gray-200 pl-3">
              <div className="text-xs font-black text-[#540000] uppercase tracking-wider font-display">
                Kiosk Pengajuan Cuti
              </div>
              <div className="text-[10px] text-gray-500 font-semibold">
                Maksimal 3 Hari / Bulan · Khusus Admin 3: Hari Minggu
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                remainingSeconds <= 15
                  ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                  : 'bg-[#F8F9FA] text-gray-600 border-[#E5E5E5]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-[#996414]" />
              <span>Reset Sesi: <strong>{remainingSeconds}s</strong></span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Kiosk Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 w-full flex-1 flex flex-col justify-center">
        {receipt ? (
          /* Struk Bukti Pengajuan Kiosk */
          <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-10 shadow-brand animate-in zoom-in-95 duration-200 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-[#FFCC00]" />

            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs border border-emerald-200">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 font-display">
                Permohonan Cuti Berhasil Diajukan!
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Permohonan cuti telah tercatat dan berstatus <strong className="text-[#996414]">PENDING</strong> menunggu verifikasi atasan unit.
              </p>
            </div>

            <div className="bg-[#F8F9FA] p-6 rounded-2xl border border-[#E5E5E5] text-center space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                Kode Karyawan Pemohon
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-black text-[#540000] tracking-widest">
                {receipt.employeeCode}
              </div>
              <div className="text-[11px] text-gray-400 font-medium">Waktu Submit: {receipt.submittedAt} WIB</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5]">
                <div className="text-gray-500 font-medium">Bulan Periode Cuti</div>
                <div className="text-base font-bold text-gray-900 mt-0.5">{receipt.targetMonth}</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#FFF9D6] border border-[#FFE066]">
                <div className="text-[#996414] font-bold">Total Hari Diajukan</div>
                <div className="text-base font-extrabold text-[#996414] mt-0.5">{receipt.totalDays} Hari Kerja</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] sm:col-span-2">
                <div className="text-gray-500 font-medium mb-1.5">Rincian Tanggal Cuti:</div>
                <div className="flex flex-wrap gap-2">
                  {receipt.dates.map((d) => (
                    <span key={d} className="px-3 py-1 rounded-xl bg-white text-[#540000] font-mono text-xs font-bold border border-[#E5E5E5] shadow-2xs">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
              >
                <RotateCcw className="w-4 h-4 text-[#FFCC00]" />
                <span>Ajukan Cuti Baru</span>
              </button>
            </div>
          </div>
        ) : (
          /* Form Input */
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-10 shadow-brand space-y-5 relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1.5 bg-[#FFCC00]" />

            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-3 animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-[#FF0000]" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Security Notice: BLOCKED Backend RPC Contract */}
            <div className="p-4 bg-[#FFF9D6] border border-[#FFE066] rounded-2xl text-[#996414] text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-[#540000]">
                <ShieldAlert className="w-4 h-4 shrink-0 text-[#996414]" />
                <span>STATUS PORTAL: BLOCKED (Menunggu Phase 1C Backend RPC)</span>
              </div>
              <p className="text-[11px] text-[#996414] leading-relaxed">
                Skema database Supabase v3.1.0 saat ini belum menyediakan fungsi RPC atomik verifikasi PIN karyawan dan transaksi cuti (<code>submit_leave_request_atomic</code>). Sesuai standar keamanan, transaksi publik melalui direct table insert dilarang dan dinonaktifkan demi mencegah pemalsuan identitas atau bypass RLS.
              </p>
            </div>

            <div className="p-3.5 bg-[#F8F9FA] border border-[#E5E5E5] rounded-xl text-gray-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-[#996414] shrink-0" />
              <span>Aturan Jendela: Pengajuan tgl 1-3. Kuota maksimal 3 hari/bulan. Admin 3: hanya hari Minggu.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Unit Usaha *</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  disabled={loading}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Bulan Cuti *</label>
                <input
                  type="month"
                  required
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span>Kode Karyawan *</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: EMP-001"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 uppercase font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-gray-400" />
                    <span>PIN Kiosk (6 Digit) *</span>
                  </span>
                </label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 text-center font-mono tracking-widest text-base font-bold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-gray-800">
                    Pilih Tanggal Cuti (Maks. 3 Hari) *
                  </label>
                  <p className="text-[11px] text-gray-500">Pilih tanggal spesifik cuti yang diajukan.</p>
                </div>
                {dates.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddDate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#540000] hover:text-[#3B0000] bg-[#FCE7E7] border border-[#F7C5C5] rounded-xl transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#540000]" />
                    <span>Tambah Tanggal</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {dates.map((dateVal, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="date"
                      required
                      value={dateVal}
                      onChange={(e) => handleDateChange(idx, e.target.value)}
                      className="flex-1 px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                    />
                    {dates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDate(idx)}
                        className="p-2.5 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                        aria-label="Hapus tanggal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Alasan Cuti *</label>
              <textarea
                required
                rows={3}
                placeholder="Tuliskan keperluan cuti Anda secara singkat dan jelas..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={true}
                className="w-full py-4 px-6 rounded-2xl bg-gray-400 text-white font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-xs select-none cursor-not-allowed opacity-75"
              >
                <CalendarDays className="w-4 h-4 text-[#FFCC00]" />
                <span>Kirim Permohonan Cuti (STATUS PORTAL: BLOCKED)</span>
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Footer Kiosk */}
      <footer className="bg-white border-t border-[#E5E5E5] py-4 px-4 text-center">
        <div className="text-xs text-gray-500 font-medium">
          © 2026 CV Karya Utama Kreasi · Kiosk Layanan Mandiri Pengajuan Cuti
        </div>
      </footer>
    </div>
  );
};
