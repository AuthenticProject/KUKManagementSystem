import React, { useState, useEffect } from 'react';
import { glassTipService, systemService } from '@/services/dataService';
import type { GlassType, GlassTipRate } from '@/types/models';
import {
  Scissors,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  User,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

interface UnitOption {
  id: string;
  code: string;
  name: string;
  type?: string;
}

export const PublicGlassTipPage: React.FC = () => {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [glassTypes, setGlassTypes] = useState<GlassType[]>([]);
  const [glassRates, setGlassRates] = useState<GlassTipRate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form Fields
  const [employeeCode, setEmployeeCode] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [glassTypeId, setGlassTypeId] = useState<string>('');
  const [lengthCm, setLengthCm] = useState<number>(100);
  const [heightCm, setHeightCm] = useState<number>(50);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    referenceCode: string;
    calculatedSqm: number;
    estimatedTip: number;
    glassPrice: number;
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

  useEffect(() => {
    if (!selectedUnitId) return;
    const fetchRates = async () => {
      const [types, rates] = await Promise.all([
        glassTipService.getGlassTypes(selectedUnitId),
        glassTipService.getGlassTipRates(selectedUnitId),
      ]);
      setGlassTypes(types);
      setGlassRates(rates);
      if (types.length > 0) {
        setGlassTypeId(types[0].id);
      }
    };
    fetchRates();
  }, [selectedUnitId]);

  // Real-time dimensional calculations based on configured rates
  const selectedRate = glassRates.find((r) => r.glass_type_id === glassTypeId) || glassRates[0];
  const pricePerSqm: number = selectedRate?.price_per_sqm ?? 120000;
  const tipRatePct: number = selectedRate?.default_percentage ?? 0.03;
  const calculatedSqm = Number(((lengthCm * heightCm * quantity) / 10000).toFixed(4));
  const glassPrice = Math.round(calculatedSqm * pricePerSqm);
  // Tip calculated from active unit rate configuration
  const estimatedTip = Math.ceil((glassPrice * tipRatePct) / 1000) * 1000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUnitId || !employeeCode.trim() || !pin.trim() || !glassTypeId) {
      setErrorMsg('Semua data identitas & spesifikasi kaca wajib diisi.');
      return;
    }

    if (pin.length !== 6 || !/^[0-9]{6}$/.test(pin)) {
      setErrorMsg('PIN Karyawan wajib terdiri dari 6 digit angka.');
      return;
    }

    if (lengthCm <= 0 || heightCm <= 0 || quantity <= 0) {
      setErrorMsg('Dimensi kaca dan jumlah lembar harus lebih dari 0.');
      return;
    }

    setSubmitting(true);
    const res = await glassTipService.submitGlassTip(selectedUnitId, {
      employee_code: employeeCode.trim().toUpperCase(),
      auth_pin: pin,
      glass_type_id: glassTypeId,
      length_cm: lengthCm,
      height_cm: heightCm,
      quantity: quantity,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (res.success) {
      setReceipt({
        referenceCode: res.reference_code || `GT-${Date.now().toString().slice(-6)}`,
        calculatedSqm: res.calculated_sqm || calculatedSqm,
        estimatedTip: res.estimated_tip || estimatedTip,
        glassPrice: glassPrice,
        submittedAt: new Date().toLocaleString('id-ID'),
      });
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleReset = () => {
    setReceipt(null);
    setPin('');
    setNotes('');
    setLengthCm(100);
    setHeightCm(50);
    setQuantity(1);
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      {/* Top Bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-kuk-maroon text-white flex items-center justify-center font-bold text-lg shadow-md border border-kuk-gold/30">
            <Scissors className="w-5 h-5 text-kuk-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Kiosk Mandiri Potong Kaca</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-kuk-maroon-900/60 text-kuk-gold border border-kuk-gold/40">
                KUK v3.1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pengajuan nota tip pemotongan kaca berdasarkan konfigurasi tarif unit</p>
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
      <div className="max-w-4xl w-full mx-auto my-6 flex-1 flex flex-col justify-center">
        {receipt ? (
          /* Digital Submission Receipt */
          <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">Nota Potong Kaca Berhasil Diajukan!</h2>
              <p className="text-xs text-slate-400">
                Tunjukkan kode nota di bawah ini kepada kasir/checker untuk verifikasi fisik kaca.
              </p>
            </div>

            <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700 text-center space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nomor Referensi Nota</span>
              <div className="text-3xl font-mono font-black text-kuk-gold tracking-widest">{receipt.referenceCode}</div>
              <div className="text-[11px] text-slate-500">Waktu Submit: {receipt.submittedAt}</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="text-slate-400">Total Luas Kaca</div>
                <div className="text-base font-bold text-white font-mono mt-0.5">{receipt.calculatedSqm} m²</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="text-slate-400">Estimasi Nilai Jual</div>
                <div className="text-base font-bold text-white mt-0.5">{formatRupiah(receipt.glassPrice)}</div>
              </div>
              <div className="p-3 rounded-xl bg-kuk-maroon/30 border border-kuk-gold/30 col-span-2 sm:col-span-1">
                <div className="text-kuk-gold text-[11px] font-semibold">Estimasi Tip Terkalkulasi</div>
                <div className="text-lg font-bold text-kuk-gold mt-0.5">{formatRupiah(receipt.estimatedTip)}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-kuk-maroon hover:bg-kuk-maroon-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ajukan Nota Potongan Baru</span>
              </button>
            </div>
          </div>
        ) : (
          /* Form Input Kiosk */
          <form onSubmit={handleSubmit} className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
            {errorMsg && (
              <div className="p-4 bg-rose-950/60 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-3 animate-in shake duration-200">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Bagian 1: Identitas Unit & Pemotong */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-kuk-gold text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>1. Autentikasi Pemotong Kaca</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Unit Usaha *</label>
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-hidden focus:ring-2 focus:ring-kuk-gold/50"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
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
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white uppercase font-mono focus:outline-hidden focus:ring-2 focus:ring-kuk-gold/50"
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
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white text-center font-mono tracking-widest text-sm focus:outline-hidden focus:ring-2 focus:ring-kuk-gold/50"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 2: Spesifikasi & Dimensi Kaca */}
            <div className="space-y-4 pt-2 border-t border-slate-700/60">
              <div className="flex items-center gap-2 text-kuk-gold text-xs font-bold uppercase tracking-wider">
                <Calculator className="w-4 h-4" />
                <span>2. Spesifikasi Pemotongan Fisik</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Jenis & Tebal Kaca *</label>
                  <select
                    value={glassTypeId}
                    onChange={(e) => setGlassTypeId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-hidden focus:ring-2 focus:ring-kuk-gold/50"
                  >
                    {glassTypes.map((gt) => (
                      <option key={gt.id} value={gt.id}>
                        {gt.name} ({gt.thickness_mm} mm)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Panjang (cm) *</label>
                  <input
                    type="number"
                    min="5"
                    max="600"
                    required
                    value={lengthCm}
                    onChange={(e) => setLengthCm(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-kuk-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tinggi / Lebar (cm) *</label>
                  <input
                    type="number"
                    min="5"
                    max="600"
                    required
                    value={heightCm}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-kuk-gold/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Jumlah (Lembar) *</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-kuk-gold/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Catatan Pemotongan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Kaca bevel / potongan sisa pesanan Bu Sari"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-hidden focus:ring-2 focus:ring-kuk-gold/50"
                />
              </div>
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Kalkulasi Otomatis Berdasarkan Tarif Terdaftar
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  {lengthCm} × {heightCm} cm × {quantity} lbr = <strong className="text-white">{calculatedSqm} m²</strong> (Tarif: {formatRupiah(pricePerSqm)}/m²)
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Estimasi Tip ({Math.round(tipRatePct * 100)}%)</div>
                  <div className="text-base font-bold text-kuk-gold font-mono">{formatRupiah(estimatedTip)}</div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-xl bg-kuk-maroon hover:bg-kuk-maroon-800 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-kuk-maroon/30 disabled:opacity-50"
              >
                {submitting ? (
                  <span>Mengirim Pengajuan Nota...</span>
                ) : (
                  <>
                    <span>Kirim Pengajuan Nota Potong Kaca</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-4xl w-full mx-auto text-center text-xs text-slate-500 pt-6 border-t border-slate-800">
        © 2026 TB KUK La Tansa & KUK Palen — Sistem Manajemen Operasional Terpadu (v3.1.0)
      </div>
    </div>
  );
};