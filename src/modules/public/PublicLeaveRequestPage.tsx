import React, { useState, useEffect } from 'react';
import { leaveService, systemService } from '@/services/dataService';
import {
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  User,
  RotateCcw,
  Plus,
  Trash2,
} from 'lucide-react';

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
      setErrorMsg('Batas pengajuan cuti adalah maksimal 3 hari per bulan.');
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
      setErrorMsg('Tanggal cuti yang dipilih tidak boleh ada yang duplikat.');
      return;
    }

    const res = await leaveService.submitLeaveRequestWithPin(selectedUnitId, employeeCode.trim(), pin, {
      target_month: targetMonth,
      total_days: dates.length,
      reason: reason.trim(),
      dates: uniqueDates,
    });

    if (res.success) {
      setReceipt({
        employeeCode: employeeCode.trim().toUpperCase(),
        targetMonth: targetMonth,
        totalDays: dates.length,
        dates: uniqueDates,
        submittedAt: new Date().toLocaleString('id-ID'),
      });
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleReset = () => {
    setReceipt(null);
    setPin('');
    setReason('');
    setDates([new Date().toISOString().substring(0, 10)]);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      {/* Top Bar */}
      <div className="max-w-2xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-kuk-maroon text-white flex items-center justify-center font-bold text-lg shadow-md border border-kuk-gold/30">
            <CalendarDays className="w-5 h-5 text-kuk-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Portal Cuti Mandiri Karyawan</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-kuk-maroon-900/60 text-kuk-gold border border-kuk-gold/40">
                KUK v3.1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pengajuan cuti bulanan staf menggunakan PIN Kiosk</p>
          </div>
        </div>

        <a
          href="/login"
          className="text-xs text-slate-400 hover:text-white transition-colors bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
        >
          Masuk ke Portal Staf
        </a>
      </div>

      {/* Main Container */}
      <div className="max-w-2xl w-full mx-auto my-6 flex-1 flex flex-col justify-center">
        {receipt ? (
          /* Receipt Screen */
          <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">Permohonan Cuti Diterima!</h2>
              <p className="text-xs text-slate-400">
                Pengajuan cuti staf berstatus <strong>PENDING</strong> menunggu verifikasi atasan / admin unit.
              </p>
            </div>

            <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Kode Karyawan:</span>
                <span className="font-mono font-bold text-white">{receipt.employeeCode}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Bulan Periode Cuti:</span>
                <span className="font-semibold text-kuk-gold">{receipt.targetMonth}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Hari:</span>
                <span className="font-bold text-white">{receipt.totalDays} Hari</span>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <div className="text-[11px] text-slate-400 mb-1">Tanggal Cuti:</div>
                <div className="flex flex-wrap gap-1.5">
                  {receipt.dates.map((d) => (
                    <span key={d} className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono text-xs border border-slate-700">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-kuk-maroon hover:bg-kuk-maroon-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ajukan Cuti Baru</span>
              </button>
            </div>
          </div>
        ) : (
          /* Form Input */
          <form onSubmit={handleSubmit} className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-5">
            {errorMsg && (
              <div className="p-4 bg-rose-950/60 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-3 animate-in shake duration-200">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Security Notice: BLOCKED Backend RPC */}
            <div className="p-4 bg-amber-950/60 border border-amber-600/80 rounded-2xl text-amber-200 text-xs space-y-1.5 shadow-md">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>STATUS PORTAL: BLOCKED (Menunggu Phase 1C Backend RPC)</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Skema database Supabase v3.1.0 saat ini belum menyediakan fungsi RPC atomik verifikasi PIN karyawan dan transaksi cuti (<code>submit_leave_request_atomic</code>). Sesuai standar keamanan, transaksi publik melalui direct table insert dilarang dan dinonaktifkan demi mencegah pemalsuan identitas atau bypass RLS.
              </p>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-700/80 rounded-xl text-slate-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Aturan Jendela: Pengajuan tgl 1-3. Kuota maksimal 3 hari/bulan. Admin 3: hanya hari Minggu.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Unit Usaha *</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Bulan Cuti *</label>
                <input
                  type="month"
                  required
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Kode Karyawan *</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: EMP-001"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white uppercase font-mono focus:ring-2 focus:ring-kuk-gold/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
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
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white text-center font-mono tracking-widest text-sm focus:ring-2 focus:ring-kuk-gold/50"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-700/60">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">Pilih Tanggal Cuti (Maks. 3 Hari) *</label>
                  <p className="text-[11px] text-slate-500">Pilih tanggal spesifik cuti yang diajukan.</p>
                </div>
                {dates.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddDate}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-kuk-gold hover:text-amber-300 bg-slate-900 border border-slate-700 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
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
                      className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:ring-2 focus:ring-kuk-gold/50"
                    />
                    {dates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDate(idx)}
                        className="p-2 text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-slate-950 border border-slate-700 rounded-xl transition-colors"
                        title="Hapus Tanggal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Alasan Cuti *</label>
              <textarea
                required
                rows={3}
                placeholder="Tuliskan alasan keperluan cuti..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={true}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-700 text-slate-400 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2 border border-slate-600 shadow-none"
              >
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Pengajuan Mandiri Dinonaktifkan (Menunggu RPC Backend Phase 1C)</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-2xl w-full mx-auto text-center text-xs text-slate-500 pt-6 border-t border-slate-800">
        © 2026 TB KUK La Tansa & KUK Palen — Sistem Manajemen Operasional Terpadu (v3.1.0)
      </div>
    </div>
  );
};