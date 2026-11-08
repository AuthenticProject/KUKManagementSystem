import React, { useState, useEffect } from 'react';
import { fleetService, systemService } from '@/services/dataService';
import type { Vehicle } from '@/types/models';
import {
  Truck,
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
} from 'lucide-react';

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
      setErrorMsg('Waktu selesai kembali harus lebih lama dari waktu mulai peminjaman.');
      return;
    }

    const selectedVeh = vehicles.find((v) => v.id === vehicleId);

    setSubmitting(true);
    const res = await fleetService.bookVehicle(selectedUnitId, {
      vehicle_id: vehicleId,
      borrower_name: borrowerName.trim(),
      borrower_institution: institution.trim() || undefined,
      borrower_phone: borrowerPhone.trim(),
      responsible_person: responsiblePerson.trim(),
      start_time: start.toISOString(),
      estimated_return_time: end.toISOString(),
      destination: destination.trim(),
      purpose: purpose.trim(),
    });
    setSubmitting(false);

    if (res.success) {
      setReceipt({
        bookingCode: res.booking_code || `VB-${Date.now().toString().slice(-6)}`,
        vehiclePlate: selectedVeh?.license_plate || '-',
        vehicleName: `${selectedVeh?.brand || ''} ${selectedVeh?.model || ''}`,
        borrowerName: borrowerName.trim(),
        startTime: start.toLocaleString('id-ID'),
        returnTime: end.toLocaleString('id-ID'),
        destination: destination.trim(),
        submittedAt: new Date().toLocaleString('id-ID'),
      });
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleReset = () => {
    setReceipt(null);
    setBorrowerName('');
    setBorrowerPhone('');
    setDestination('');
    setPurpose('');
    setStartTime('');
    setReturnTime('');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      {/* Top Bar */}
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-kuk-maroon text-white flex items-center justify-center font-bold text-lg shadow-md border border-kuk-gold/30">
            <Truck className="w-5 h-5 text-kuk-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Formulir Peminjaman Armada</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-kuk-maroon-900/60 text-kuk-gold border border-kuk-gold/40">
                KUK v3.1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pengajuan sewa & penggunaan armada operasional toko</p>
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
      <div className="max-w-3xl w-full mx-auto my-6 flex-1 flex flex-col justify-center">
        {receipt ? (
          /* Receipt Screen */
          <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">Pengajuan Armada Berhasil Diterima!</h2>
              <p className="text-xs text-slate-400">
                Peminjaman kendaraan berstatus <strong>PENDING</strong> menunggu verifikasi dan persetujuan pengelola armada.
              </p>
            </div>

            <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700 text-center space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kode Booking Armada</span>
              <div className="text-3xl font-mono font-black text-kuk-gold tracking-widest">{receipt.bookingCode}</div>
              <div className="text-[11px] text-slate-500">Waktu Pengajuan: {receipt.submittedAt}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                <div className="text-slate-400">Kendaraan & Plat</div>
                <div className="text-sm font-bold text-white">{receipt.vehicleName}</div>
                <div className="font-mono text-kuk-gold font-semibold">{receipt.vehiclePlate}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                <div className="text-slate-400">Nama Peminjam / Sopir</div>
                <div className="text-sm font-bold text-white">{receipt.borrowerName}</div>
                <div className="text-slate-400">Tujuan: {receipt.destination}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 sm:col-span-2">
                <div className="text-slate-400">Rentang Waktu Peminjaman</div>
                <div className="text-xs font-mono font-semibold text-white mt-1">
                  {receipt.startTime} s.d. {receipt.returnTime}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-kuk-maroon hover:bg-kuk-maroon-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Buat Pengajuan Baru</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Pilih Armada Kendaraan *</label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.license_plate}) - {v.status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Nama Peminjam / Sopir *</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pak Budi Santoso"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>No. WhatsApp Aktif *</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="08123456789"
                  value={borrowerPhone}
                  onChange={(e) => setBorrowerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Instansi / Divisi</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Penanggung Jawab Kendaraan *</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama atasan / koordinator toko"
                  value={responsiblePerson}
                  onChange={(e) => setResponsiblePerson(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Waktu Mulai Pinjam *</span>
                  </span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Estimasi Kembali *</span>
                  </span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Lokasi Tujuan Perjalanan *</span>
                </span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Pengantaran material semen ke Proyek Perumahan Griya Serang"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Keperluan & Keterangan Pengiriman *</label>
              <textarea
                required
                rows={2}
                placeholder="Rincian muatan atau kebutuhan armada..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-kuk-gold/50"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-xl bg-kuk-maroon hover:bg-kuk-maroon-800 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-kuk-maroon/30 disabled:opacity-50"
              >
                {submitting ? (
                  <span>Memeriksa Ketersediaan Jadwal...</span>
                ) : (
                  <>
                    <span>Ajukan Permohonan Armada</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-3xl w-full mx-auto text-center text-xs text-slate-500 pt-6 border-t border-slate-800">
        © 2026 TB KUK La Tansa & KUK Palen — Sistem Manajemen Operasional Terpadu (v3.1.0)
      </div>
    </div>
  );
};