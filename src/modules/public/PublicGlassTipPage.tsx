import React, { useState, useEffect, useCallback } from 'react';
import { glassTipService, systemService } from '@/services/dataService';
import type { GlassType, GlassTipRate } from '@/types/models';
import { useKioskSession } from '@/hooks/useKioskSession';
import {
  Calculator,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  User,
  ArrowRight,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { getUnitBrandInfo } from '@/utils/brandAssets';

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
  const selectedRate = glassRates.find((r) => r.glass_type_id === glassTypeId);
  const isRateConfigured = !!selectedRate && typeof selectedRate.price_per_sqm === 'number' && selectedRate.price_per_sqm > 0;
  const pricePerSqm: number = isRateConfigured ? selectedRate.price_per_sqm! : 0;
  const tipRatePct: number = isRateConfigured ? (selectedRate.default_percentage ?? 0.03) : 0.03;
  const calculatedSqm = Number(((lengthCm * heightCm * quantity) / 10000).toFixed(4));
  const glassPrice = isRateConfigured ? Math.round(calculatedSqm * pricePerSqm) : 0;
  // Approved business rule: Glass tip = 3% of the glass price (without rounding to Rp1,000)
  const estimatedTip = isRateConfigured ? Math.round(glassPrice * tipRatePct) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUnitId || !employeeCode.trim() || !pin.trim() || !glassTypeId) {
      setErrorMsg('Semua data identitas & spesifikasi kaca wajib diisi.');
      return;
    }

    if (!isRateConfigured) {
      setErrorMsg('Validasi Gagal: Tipe kaca ini belum memiliki tarif master aktif di unit yang dipilih. Pengajuan tidak dapat diproses.');
      return;
    }

    if (lengthCm < 5 || lengthCm > 600 || heightCm < 5 || heightCm > 600) {
      setErrorMsg('Dimensi kaca di luar batas wajar operasional (Panjang & Tinggi: 5 cm s/d 600 cm).');
      return;
    }

    if (quantity < 1) {
      setErrorMsg('Jumlah potongan kaca minimal 1 lembar.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await glassTipService.submitGlassTip(selectedUnitId, {
        employee_code: employeeCode.trim(),
        auth_pin: pin.trim(),
        glass_type_id: glassTypeId,
        length_cm: lengthCm,
        height_cm: heightCm,
        quantity: quantity,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setReceipt({
          referenceCode: res.reference_code || `TIP-${Date.now().toString().slice(-6)}`,
          calculatedSqm: res.calculated_sqm ?? calculatedSqm,
          estimatedTip: res.estimated_tip ?? estimatedTip,
          glassPrice: glassPrice,
          submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi gangguan jaringan saat memproses nota.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = useCallback(() => {
    setEmployeeCode('');
    setPin('');
    setNotes('');
    setReceipt(null);
    setErrorMsg(null);
    setLengthCm(100);
    setHeightCm(50);
    setQuantity(1);
  }, []);

  // Kiosk Inactivity auto-reset (60 seconds rule BR-20)
  const { remainingSeconds, timedOut, dismissBanner } = useKioskSession({
    timeoutSeconds: 60,
    onTimeout: handleReset,
  });

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

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
                Kiosk Pemotongan Kaca
              </div>
              <div className="text-[10px] text-gray-500 font-semibold">
                Formula Resmi: 3% dari Nilai Dasar Kaca
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
                Nota Potong Kaca Berhasil Diajukan!
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Tunjukkan kode nota di bawah ini kepada kasir/checker untuk verifikasi fisik kaca.
              </p>
            </div>

            <div className="bg-[#F8F9FA] p-6 rounded-2xl border border-[#E5E5E5] text-center space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                Nomor Referensi Nota
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-black text-[#540000] tracking-widest">
                {receipt.referenceCode}
              </div>
              <div className="text-[11px] text-gray-400 font-medium">Waktu Submit: {receipt.submittedAt} WIB</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5]">
                <div className="text-gray-500 font-medium">Total Luas Kaca</div>
                <div className="text-lg font-bold text-gray-900 font-mono mt-0.5">{receipt.calculatedSqm} m²</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5]">
                <div className="text-gray-500 font-medium">Estimasi Nilai Jual</div>
                <div className="text-lg font-bold text-gray-900 mt-0.5">{formatRupiah(receipt.glassPrice)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#FFF9D6] border border-[#FFE066] col-span-2 sm:col-span-1">
                <div className="text-[#996414] text-[11px] font-bold">Estimasi Tip Terkalkulasi (3%)</div>
                <div className="text-lg font-extrabold text-[#996414] mt-0.5">{formatRupiah(receipt.estimatedTip)}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
              >
                <RotateCcw className="w-4 h-4 text-[#FFCC00]" />
                <span>Ajukan Nota Potongan Baru</span>
              </button>
            </div>
          </div>
        ) : (
          /* Form Input Kiosk */
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-10 shadow-brand space-y-6 relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1.5 bg-[#FFCC00]" />

            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-3 animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-[#FF0000]" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Bagian 1: Identitas Unit & Pemotong */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#540000] text-xs font-extrabold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-[#996414]" />
                <span>1. Autentikasi Pemotong Kaca</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Unit Toko *</label>
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
            </div>

            {/* Bagian 2: Spesifikasi & Dimensi Kaca */}
            <div className="space-y-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 text-[#540000] text-xs font-extrabold uppercase tracking-wider">
                <Calculator className="w-4 h-4 text-[#996414]" />
                <span>2. Spesifikasi Pemotongan Fisik</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Jenis & Tebal Kaca *</label>
                  <select
                    value={glassTypeId}
                    onChange={(e) => setGlassTypeId(e.target.value)}
                    className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                  >
                    {glassTypes.map((gt) => (
                      <option key={gt.id} value={gt.id}>
                        {gt.name} ({gt.thickness_mm} mm)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Panjang (cm) *</label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    required
                    value={lengthCm}
                    onChange={(e) => setLengthCm(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Tinggi (cm) *</label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    required
                    value={heightCm}
                    onChange={(e) => setHeightCm(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Jumlah (lbr) *</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 3: Rangkuman & Estimasi Kalkulasi 3% */}
            <div className="p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                <span>Estimasi Kalkulasi Real-Time</span>
                <span className="text-[10px] text-[#540000] font-extrabold bg-[#FCE7E7] px-2 py-0.5 rounded-md border border-[#F7C5C5]">
                  Formula Baku 3%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">Tarif Master:</span>
                  <div className="font-bold text-gray-900 mt-0.5">
                    {isRateConfigured ? `${formatRupiah(pricePerSqm)} / m²` : 'Belum Dikonfigurasi'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Luas Total:</span>
                  <div className="font-bold text-gray-900 font-mono mt-0.5">{calculatedSqm} m²</div>
                </div>
                <div>
                  <span className="text-gray-500">Nilai Dasar Kaca:</span>
                  <div className="font-bold text-gray-900 mt-0.5">{formatRupiah(glassPrice)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FFF9D6] border border-[#FFE066]">
                  <span className="text-[#996414] font-bold text-[11px]">Estimasi Tip (3%):</span>
                  <div className="text-base font-extrabold text-[#996414] mt-0.5 font-mono">
                    {formatRupiah(estimatedTip)}
                  </div>
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting || !isRateConfigured}
                className="w-full py-4 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 select-none active:scale-[0.99]"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menerbitkan Nota...</span>
                  </div>
                ) : (
                  <>
                    <span>Terbitkan Nota Tip Potong Kaca</span>
                    <ArrowRight className="w-4 h-4 text-[#FFCC00]" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Footer Kiosk */}
      <footer className="bg-white border-t border-[#E5E5E5] py-4 px-4 text-center">
        <div className="text-xs text-gray-500 font-medium">
          © 2026 CV Karya Utama Kreasi · Kiosk Layanan Mandiri Pemotongan Kaca
        </div>
      </footer>
    </div>
  );
};
