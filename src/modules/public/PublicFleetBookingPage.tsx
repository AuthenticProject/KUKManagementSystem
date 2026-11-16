import React, { useState, useEffect, useCallback } from 'react';
import { fleetService, systemService } from '@/services/dataService';
import type { Vehicle } from '@/types/models';
import { useKioskSession } from '@/hooks/useKioskSession';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Phone,
  User,
  MapPin,
  Clock,
  ArrowRight,
  RotateCcw,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { getUnitBrandInfo } from '@/utils/brandAssets';

interface UnitOption {
  id: string;
  code: string;
  name: string;
  type?: string;
}

export const PublicFleetBookingPage: React.FC = () => {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form Fields
  const [vehicleId, setVehicleId] = useState<string>('');
  const [borrowerName, setBorrowerName] = useState<string>('');
  const [borrowerPhone, setBorrowerPhone] = useState<string>('');
  const [institution, setInstitution] = useState<string>('');
  const [responsiblePerson, setResponsiblePerson] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [returnTime, setReturnTime] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    bookingCode: string;
    vehiclePlate: string;
    vehicleName: string;
    borrowerName: string;
    startTime: string;
    returnTime: string;
    destination: string;
    submittedAt: string;
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const uList = await systemService.getUnits();
      setUnits(uList);
      if (uList.length > 0) {
        setSelectedUnitId(uList[0].id);
        setInstitution(uList[0].name);
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedUnitId) return;
    const fetchVehicles = async () => {
      const res = await fleetService.getVehiclesByUnit(selectedUnitId);
      setVehicles(res.data);
      if (res.data.length > 0) {
        setVehicleId(res.data[0].id);
      }
      const u = units.find((x) => x.id === selectedUnitId);
      if (u) setInstitution(u.name);
    };
    fetchVehicles();
  }, [selectedUnitId, units]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      !selectedUnitId ||
      !vehicleId ||
      !borrowerName.trim() ||
      !borrowerPhone.trim() ||
      !responsiblePerson.trim() ||
      !startTime ||
      !returnTime ||
      !destination.trim() ||
      !purpose.trim()
    ) {
      setErrorMsg('Semua data wajib permohonan armada harus diisi.');
      return;
    }

    const start = new Date(startTime);
    const end = new Date(returnTime);
    if (end <= start) {
      setErrorMsg('Waktu perkiraan kembali harus lebih besar dari waktu keberangkatan.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vehicle_id: vehicleId,
        borrower_name: borrowerName.trim(),
        borrower_phone: borrowerPhone.trim(),
        borrower_institution: institution.trim() || undefined,
        responsible_person: responsiblePerson.trim(),
        start_time: start.toISOString(),
        estimated_return_time: end.toISOString(),
        destination: destination.trim(),
        purpose: purpose.trim(),
      };

      const res = await fleetService.bookVehicle(selectedUnitId, payload);
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        const v = vehicles.find((x) => x.id === vehicleId);
        setReceipt({
          bookingCode: res.booking_code || res.booking_id || `FLEET-${Date.now().toString().slice(-6)}`,
          vehiclePlate: v ? v.license_plate : 'Armada Operasional',
          vehicleName: v ? `${v.brand} ${v.model}` : 'Kendaraan KUK',
          borrowerName: borrowerName.trim(),
          startTime: start.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
          returnTime: end.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
          destination: destination.trim(),
          submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem saat mengajukan peminjaman armada.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = useCallback(() => {
    setBorrowerName('');
    setBorrowerPhone('');
    setResponsiblePerson('');
    setStartTime('');
    setReturnTime('');
    setDestination('');
    setPurpose('');
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
                Kiosk Peminjaman Armada
              </div>
              <div className="text-[10px] text-gray-500 font-semibold">
                Pencatatan Surat Jalan & Inspeksi Kelaikan Fisik
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
                Pengajuan Armada Berhasil Diterima!
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Peminjaman kendaraan berstatus <strong className="text-[#996414]">PENDING</strong> menunggu verifikasi dan persetujuan pengelola armada.
              </p>
            </div>

            <div className="bg-[#F8F9FA] p-6 rounded-2xl border border-[#E5E5E5] text-center space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                Kode Booking Armada
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-black text-[#540000] tracking-widest">
                {receipt.bookingCode}
              </div>
              <div className="text-[11px] text-gray-400 font-medium">Waktu Pengajuan: {receipt.submittedAt} WIB</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] space-y-1">
                <div className="text-gray-500 font-medium">Kendaraan & Plat</div>
                <div className="text-sm font-bold text-gray-900">{receipt.vehicleName}</div>
                <div className="font-mono text-[#540000] font-bold">{receipt.vehiclePlate}</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] space-y-1">
                <div className="text-gray-500 font-medium">Nama Peminjam / Sopir</div>
                <div className="text-sm font-bold text-gray-900">{receipt.borrowerName}</div>
                <div className="text-gray-500">Tujuan: {receipt.destination}</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#FFF9D6] border border-[#FFE066] sm:col-span-2">
                <div className="text-[#996414] font-bold">Rentang Waktu Peminjaman</div>
                <div className="text-xs font-mono font-bold text-gray-900 mt-1">
                  {receipt.startTime} s.d. {receipt.returnTime}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
              >
                <RotateCcw className="w-4 h-4 text-[#FFCC00]" />
                <span>Buat Pengajuan Baru</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Unit Toko / Gudang *</label>
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
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Pilih Armada Kendaraan *</label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.license_plate}) - Status: {v.status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span>Nama Peminjam / Sopir *</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pak Budi Santoso"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>No. WhatsApp Aktif *</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="08123456789"
                  value={borrowerPhone}
                  onChange={(e) => setBorrowerPhone(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    <span>Instansi / Divisi Pemohon</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                    <span>Penanggung Jawab Kendaraan *</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Koordinator Logistik / Kepala Gudang"
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>Waktu Mulai Berangkat *</span>
                  </span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>Perkiraan Kembali *</span>
                  </span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span>Lokasi Tujuan Ekspedisi / Rute *</span>
                </span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Proyek Ruko Gandaria / Toko Cabang Palen"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Keperluan & Muatan Operasional *</label>
              <textarea
                required
                rows={3}
                placeholder="Jelaskan kebutuhan pengiriman material atau urusan operasional..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-3.5 py-3 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 select-none active:scale-[0.99]"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses Pengajuan...</span>
                  </div>
                ) : (
                  <>
                    <span>Kirim Pengajuan Peminjaman Armada</span>
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
          © 2026 CV Karya Utama Kreasi · Kiosk Layanan Mandiri Peminjaman Armada
        </div>
      </footer>
    </div>
  );
};
