import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fleetService, systemService, financeService } from '@/services/dataService';
import { DAFTAR_KAMAR, cloudSyncService } from '@/services/cloudSyncService';
import type { Vehicle, VehicleBorrowingRequest } from '@/types/models';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Phone,
  User,
  MapPin,
  Clock,
  RotateCcw,
  Building2,
  ShieldCheck,
  ArrowLeft,
  Camera,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  QrCode,
  Fuel,
  Send,
} from 'lucide-react';

export const PublicFleetBookingPage: React.FC = () => {
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [recentRequests, setRecentRequests] = useState<VehicleBorrowingRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'form' | 'qr' | 'bbm' | 'history'>('form');

  // Form Fields
  const [vehicleId, setVehicleId] = useState<string>('');
  const [borrowerName, setBorrowerName] = useState<string>('');
  const [borrowerPhone, setBorrowerPhone] = useState<string>('');
  const [institution, setInstitution] = useState<string>('TB KUK La Tansa');
  const [responsiblePerson, setResponsiblePerson] = useState<string>('Koordinator Kendaraan');
  const [startTime, setStartTime] = useState<string>('');
  const [returnTime, setReturnTime] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [simImage, setSimImage] = useState<string | null>(null);
  const [sopOpen, setSopOpen] = useState<boolean>(false);

  // Catat BBM SPBU State
  const [bbmVehicleId, setBbmVehicleId] = useState<string>('');
  const [bbmRupiah, setBbmRupiah] = useState<number>(200000);
  const [bbmLiter, setBbmLiter] = useState<number>(29.5);
  const [bbmJenis, setBbmJenis] = useState<string>('Biosolar Subsidi');
  const [bbmKm, setBbmKm] = useState<number>(145000);
  const [bbmSpbu, setBbmSpbu] = useState<string>('SPBU Siman / Ponorogo');
  const [bbmStrukImage, setBbmStrukImage] = useState<string | null>(null);
  const [bbmCatatan, setBbmCatatan] = useState<string>('');
  const [bbmSaving, setBbmSaving] = useState<boolean>(false);

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    bookingCode: string;
    vehiclePlate: string;
    vehicleName: string;
    borrowerName: string;
    startTime: string;
    returnTime: string;
    destination: string;
    purpose: string;
    submittedAt: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const loadData = async () => {
    const uList = await systemService.getUnits();
    const targetUnitId = uList.length > 0 ? uList[0].id : '00000000-0000-0000-0000-000000000001';
    setSelectedUnitId(targetUnitId);

    const [vRes, rRes] = await Promise.all([
      fleetService.getVehiclesByUnit(targetUnitId),
      fleetService.getBorrowingRequests(targetUnitId),
    ]);
    setVehicles(vRes.data);
    setRecentRequests(rRes.data || []);
    if (vRes.data.length > 0) {
      setVehicleId(vRes.data[0].id);
      setBbmVehicleId(vRes.data[0].id);
    }

    // Sinkronisasi data cloud online dari Google Apps Script
    try {
      const cloudData = await cloudSyncService.fetchCloudData();
      if (cloudData && cloudData.peminjaman && cloudData.peminjaman.length > 0) {
        // Map to requests
        const mapped: VehicleBorrowingRequest[] = cloudData.peminjaman.map((p, idx) => ({
          id: p.id || `cloud-${idx}`,
          unit_id: targetUnitId,
          vehicle_id: p.kendaraanId || 'v-01',
          borrower_name: p.namaPeminjam || 'Peminjam',
          borrower_phone: p.kontak || '',
          borrower_institution: p.kamar || p.divisi || 'TB KUK La Tansa',
          responsible_person: 'Staff Logistik',
          start_time: p.waktuMulai ? new Date(p.waktuMulai).toISOString() : new Date().toISOString(),
          estimated_return_time: p.waktuRencanaKembali ? new Date(p.waktuRencanaKembali).toISOString() : new Date().toISOString(),
          destination: p.keperluan || 'Toko Bangunan KUK',
          purpose: p.keperluan || 'Operasional',
          status: p.status === 'Selesai' ? 'RETURNED' : 'IN_USE',
          booking_code: p.id || `PINJAM-${idx}`,
          created_at: p.createdAt || new Date().toISOString(),
          vehicle: {
            id: p.kendaraanId || 'v-01',
            unit_id: targetUnitId,
            license_plate: p.platKendaraan || 'L300',
            brand: 'Mitsubishi',
            model: p.namaKendaraan || 'L300',
            year: 2023,
            type: 'PICKUP',
            status: 'AVAILABLE',
            is_active: true,
            created_at: '',
          },
        }));
        setRecentRequests((prev) => {
          const ids = new Set(prev.map((r) => r.id));
          const newItems = mapped.filter((m) => !ids.has(m.id));
          return [...prev, ...newItems];
        });
      }
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedVehicleObj = vehicles.find((v) => v.id === vehicleId);
  const isSimRequired = Boolean(
    selectedVehicleObj &&
      (selectedVehicleObj.brand.toLowerCase().includes('l300') ||
        selectedVehicleObj.model.toLowerCase().includes('l300') ||
        selectedVehicleObj.license_plate.toLowerCase().includes('l300') ||
        selectedVehicleObj.model.toLowerCase().includes('engkel') ||
        selectedVehicleObj.license_plate.toLowerCase().includes('engkel') ||
        selectedVehicleObj.type === 'TRUCK' ||
        selectedVehicleObj.type === 'PICKUP')
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!vehicleId || !borrowerName.trim() || !borrowerPhone.trim() || !startTime || !returnTime || !destination.trim() || !purpose.trim()) {
      setErrorMsg('Semua field wajib formulir peminjaman harus diisi.');
      return;
    }

    const start = new Date(startTime);
    const end = new Date(returnTime);
    if (end <= start) {
      setErrorMsg('Waktu perkiraan kembali harus lebih besar dari waktu keberangkatan.');
      return;
    }

    setSubmitting(true);
    const targetUnit = selectedUnitId || '00000000-0000-0000-0000-000000000001';
    const v = vehicles.find((x) => x.id === vehicleId);

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

      const res = await fleetService.bookVehicle(targetUnit, payload);

      // Sinkronisasi ke Cloud Database Google Apps Script agar tersimpan online di semua device
      const cloudRecord = {
        id: res.booking_code || `PINJAM-${Date.now()}`,
        namaPeminjam: borrowerName.trim(),
        kamar: institution.trim(),
        divisi: institution.trim(),
        kontak: borrowerPhone.trim(),
        kendaraanId: vehicleId,
        namaKendaraan: v ? `${v.brand} ${v.model}` : 'Kendaraan KUK',
        platKendaraan: v ? v.license_plate : 'L300',
        waktuMulai: start.toString(),
        waktuRencanaKembali: end.toString(),
        keperluan: purpose.trim(),
        status: 'Aktif/Dipinjam',
        simImage: simImage || '',
        createdAt: new Date().toISOString(),
      };
      await cloudSyncService.savePeminjamanToCloud(cloudRecord);

      const bookingCodeResult = res.booking_code || `PINJAM-${Date.now().toString().slice(-6)}`;
      setReceipt({
        bookingCode: bookingCodeResult,
        vehiclePlate: v ? v.license_plate : 'Armada KUK',
        vehicleName: v ? `${v.brand} ${v.model}` : 'Armada Operasional',
        borrowerName: borrowerName.trim(),
        startTime: start.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
        returnTime: end.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
        destination: destination.trim(),
        purpose: purpose.trim(),
        submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });

      showToast('✓ Formulir peminjaman kendaraan berhasil disimpan online!');

      // WhatsApp format matching reference peminjaman.html
      const waText = encodeURIComponent(
        `*PENGAJUAN PEMINJAMAN KENDARAAN TB. KUK*\n\n` +
        `• *Peminjam:* ${borrowerName.trim()}\n` +
        `• *Kamar/Instansi:* ${institution.trim()}\n` +
        `• *No. HP:* ${borrowerPhone.trim()}\n` +
        `• *Kendaraan:* ${v ? `${v.brand} ${v.model} (${v.license_plate})` : '-'}\n` +
        `• *Waktu Mulai:* ${start.toLocaleString('id-ID')}\n` +
        `• *Rencana Kembali:* ${end.toLocaleString('id-ID')}\n` +
        `• *Tujuan:* ${destination.trim()}\n` +
        `• *Keperluan:* ${purpose.trim()}\n\n` +
        `_Mohon persetujuan dari Koordinator/Staff Pengelola Kendaraan KUK. Terima kasih._`
      );
      window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi gangguan saat menyimpan peminjaman.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimpanLogBbm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bbmVehicleId) {
      alert('Pilih armada kendaraan terlebih dahulu.');
      return;
    }
    setBbmSaving(true);
    const targetUnit = selectedUnitId || '00000000-0000-0000-0000-000000000001';
    const veh = vehicles.find((v) => v.id === bbmVehicleId);
    try {
      await financeService.recordExpense(targetUnit, {
        category: 'OPERATIONAL',
        amount: bbmRupiah,
        recipient_name: `SPBU (${bbmSpbu || 'Pengisian BBM'})`,
        description: `Pengisian BBM ${bbmJenis} (${bbmLiter}L) - ${veh?.brand || ''} ${veh?.model || ''} (${veh?.license_plate || ''}) Odometer: ${bbmKm || '-'} KM. ${bbmCatatan || ''}`,
        expense_date: new Date().toISOString().split('T')[0],
      });
      showToast('✓ Log pengisian BBM & struk SPBU berhasil dicatat!');

      const waText = encodeURIComponent(
        `*LOG PENGISIAN BBM & STRUK SPBU TB. KUK*\n\n` +
        `• *Kendaraan:* ${veh?.brand || ''} ${veh?.model || ''} (${veh?.license_plate || ''})\n` +
        `• *Total Rupiah:* Rp ${bbmRupiah.toLocaleString('id-ID')}\n` +
        `• *Jumlah Liter:* ${bbmLiter} L (${bbmJenis})\n` +
        `• *KM Odometer:* ${bbmKm || '-'}\n` +
        `• *Lokasi SPBU:* ${bbmSpbu || '-'}\n` +
        `• *Catatan:* ${bbmCatatan || '-'}\n\n` +
        `_Tercatat otomatis di Sistem Operasional TB KUK._`
      );
      window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
      setActiveTab('form');
    } catch {
      alert('Gagal mencatat log BBM.');
    } finally {
      setBbmSaving(false);
    }
  };

  const handleReset = () => {
    setBorrowerName('');
    setBorrowerPhone('');
    setDestination('');
    setPurpose('');
    setSimImage(null);
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
                Peminjaman Kendaraan TB KUK
              </div>
              <div className="text-[10px] text-gray-500 font-semibold">
                L300 · Truk Engkel · Viar Roda 3 · Forklift
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'form' ? 'bg-white text-[#540000] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Formulir
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'qr' ? 'bg-white text-[#540000] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              QR Solar Pass
            </button>
            <button
              onClick={() => setActiveTab('bbm')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'bbm' ? 'bg-white text-[#540000] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Catat BBM
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'history' ? 'bg-white text-[#540000] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Riwayat
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-10 w-full flex-1 flex flex-col justify-center">
        {/* TAB 1: FORMULIR PEMINJAMAN */}
        {activeTab === 'form' && (
          receipt ? (
            /* Struk Bukti Pengajuan Kiosk */
            <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-10 shadow-brand animate-in zoom-in-95 duration-200 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-[#FFCC00]" />

              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs border border-emerald-200">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 font-display">
                  Peminjaman Kendaraan Berhasil Diajukan!
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  Data peminjaman telah disimpan online dan terkirim ke WhatsApp koordinator armada TB KUK.
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
                  <div className="text-gray-500 font-medium">Kendaraan</div>
                  <div className="text-sm font-bold text-gray-900">{receipt.vehicleName}</div>
                  <div className="font-mono text-[#540000] font-bold">{receipt.vehiclePlate}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] space-y-1">
                  <div className="text-gray-500 font-medium">Peminjam</div>
                  <div className="text-sm font-bold text-gray-900">{receipt.borrowerName}</div>
                  <div className="text-gray-500">Tujuan: {receipt.destination}</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFF9D6] border border-[#FFE066] sm:col-span-2">
                  <div className="text-[#996414] font-bold">Jadwal Operasional Armada</div>
                  <div className="text-xs font-mono font-bold text-gray-900 mt-1">
                    {receipt.startTime} s.d. {receipt.returnTime}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto flex-1 py-3 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <RotateCcw className="w-4 h-4 text-[#FFCC00]" />
                  <span>Buat Pengajuan Baru</span>
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
                    Formulir Peminjaman Kendaraan
                  </h2>
                  <p className="text-xs text-gray-500">
                    Isi data lengkap sesuai SOP peminjaman armada CV Karya Utama Kreasi.
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

              {/* Pilih Kendaraan Card Grid */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Pilih Armada Kendaraan *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {vehicles.map((v) => {
                    const isSelected = v.id === vehicleId;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => {
                          setVehicleId(v.id);
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'border-[#540000] bg-[#FDF2F2] ring-2 ring-[#540000]/20 shadow-xs'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xl mb-1">
                          {v.model.toLowerCase().includes('l300') ? '🚚' : v.model.toLowerCase().includes('engkel') ? '🚛' : v.model.toLowerCase().includes('viar') ? '🛺' : '🏗️'}
                        </div>
                        <div className="text-xs font-bold text-gray-900 line-clamp-1">{v.model}</div>
                        <div className="text-[10px] font-mono font-bold text-[#540000]">{v.license_plate}</div>
                        <div className="mt-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded inline-block">
                          {v.status}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Data Peminjam */}
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
                    placeholder="Contoh: Budi Santoso"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
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
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                  />
                </div>
              </div>

              {/* Instansi Combobox from 105 DAFTAR_KAMAR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span>Kamar / Instansi / Rayon *</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    list="daftar-kamar-list"
                    placeholder="Pilih atau ketik kamar / instansi..."
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                  />
                  <datalist id="daftar-kamar-list">
                    {DAFTAR_KAMAR.map((k, i) => (
                      <option key={i} value={k} />
                    ))}
                  </datalist>
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
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                  />
                </div>
              </div>

              {/* Waktu Mulai & Rencana Kembali */}
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
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>Estimasi Waktu Kembali *</span>
                    </span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                  />
                </div>
              </div>

              {/* Tujuan & Keperluan */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span>Tujuan Perjalanan *</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pengiriman material bata ringan ke Mantingan"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Keperluan Lengkap *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Keterangan muatan / keperluan resmi operasional..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>

              {/* Upload Foto Kartu SIM */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-[#540000]" />
                    <span>
                      Foto Kartu SIM Pengemudi{' '}
                      {isSimRequired ? (
                        <span className="text-red-500 font-bold">* (Wajib SIM A/B1 untuk L300 & Engkel)</span>
                      ) : (
                        <span className="text-gray-400 font-normal">(Opsional)</span>
                      )}
                    </span>
                  </label>
                  {simImage && (
                    <button
                      type="button"
                      onClick={() => setSimImage(null)}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  )}
                </div>

                {simImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 max-h-40 bg-black flex items-center justify-center">
                    <img src={simImage} alt="SIM Preview" className="max-h-40 object-contain" />
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-[#540000] rounded-xl p-3.5 cursor-pointer bg-white transition-colors">
                    <Camera className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-600 font-semibold">Klik untuk Ambil / Unggah Foto SIM Pengemudi</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">Maksimal 5MB (JPG/PNG)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setSimImage(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
                <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1">
                  <span>📂 Atau arsip folder cloud:</span>
                  <a
                    href="https://drive.google.com/drive/folders/1gmv0TIJvTJcCyKD8rs7ichW4LANGFtyZ?usp=sharing"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#540000] hover:underline font-bold flex items-center gap-1"
                  >
                    <span>Google Drive Kendaraan KUK</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Accordion SOP */}
              <div className="border border-amber-200 bg-amber-50/60 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSopOpen(!sopOpen)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-bold text-amber-900 hover:bg-amber-100/50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Ketentuan & SOP Peminjaman Kendaraan TB. KUK</span>
                  </span>
                  {sopOpen ? <ChevronUp className="w-4 h-4 text-amber-700" /> : <ChevronDown className="w-4 h-4 text-amber-700" />}
                </button>
                {sopOpen && (
                  <div className="px-4 py-3 pt-1 text-[11px] text-amber-900/90 space-y-1.5 border-t border-amber-200/50">
                    <p>1. <strong>Pengajuan:</strong> Wajib diajukan selambatnya H-1 sebelum pemakaian armada.</p>
                    <p>2. <strong>Kualifikasi Pengemudi:</strong> Pengemudi wajib memiliki SIM A / B1 yang sah dan masih berlaku.</p>
                    <p>3. <strong>Kondisi Kendaraan:</strong> Kendaraan harus dikembalikan dalam kondisi bersih & bahan bakar sama saat awal serah terima.</p>
                    <p>4. <strong>BBM & SPBU:</strong> Gunakan MyPertamina QR Pass armada untuk BioSolar Subsidi dan lampirkan struk resmi SPBU.</p>
                    <p>5. <strong>Tanggung Jawab:</strong> Segala tilang, kerusakan fisik akibat kelalaian, dan insiden menjadi tanggung jawab peminjam sepenuhnya.</p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 select-none active:scale-[0.99]"
                >
                  <Send className="w-4 h-4 text-[#FFCC00]" />
                  <span>{submitting ? 'Menyimpan ke Cloud...' : '💾 Simpan & Kirim WhatsApp'}</span>
                </button>
              </div>
            </form>
          )
        )}

        {/* TAB 2: MYPERTAMINA QR SOLAR PASS */}
        {activeTab === 'qr' && (
          <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-10 shadow-brand space-y-6">
            <div className="text-center space-y-1">
              <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-amber-700" />
                <span>MyPertamina BioSolar Subsidi</span>
              </span>
              <h2 className="text-xl font-extrabold text-gray-900 font-display">
                Barcode QR Solar Pass TB KUK
              </h2>
              <p className="text-xs text-gray-500">
                Tunjukkan barcode QR resmi di bawah ini kepada operator SPBU Pertamina saat melakukan pengisian armada.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              {/* Card L300 */}
              <div className="bg-[#F8F9FA] border border-amber-200 rounded-3xl p-6 text-center space-y-4 shadow-sm">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-amber-800">Mitsubishi L300</div>
                  <div className="text-xl font-black font-mono text-[#540000]">L300</div>
                  <div className="text-[10px] text-gray-500">BioSolar Subsidi Tepat Sasaran</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border-2 border-dashed border-amber-300 inline-block shadow-inner mx-auto">
                  <img
                    src="/fleet/QR-L300.jpeg"
                    alt="QR Pertamina L300"
                    className="max-h-60 w-auto object-contain mx-auto rounded-lg"
                  />
                </div>
                <div>
                  <a
                    href="/fleet/QR-L300.jpeg"
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka / Unduh Barcode Asli</span>
                  </a>
                </div>
              </div>

              {/* Card Truk Engkel */}
              <div className="bg-[#F8F9FA] border border-amber-200 rounded-3xl p-6 text-center space-y-4 shadow-sm">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-amber-800">Truk Engkel Kargo</div>
                  <div className="text-xl font-black font-mono text-[#540000]">Engkel</div>
                  <div className="text-[10px] text-gray-500">BioSolar Subsidi Tepat Sasaran</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border-2 border-dashed border-amber-300 inline-block shadow-inner mx-auto">
                  <img
                    src="/fleet/qr-engkel.png"
                    alt="QR Pertamina Truk Engkel"
                    className="max-h-60 w-auto object-contain mx-auto rounded-lg"
                  />
                </div>
                <div>
                  <a
                    href="/fleet/qr-engkel.png"
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka / Unduh Barcode Asli</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CATAT BBM SPBU */}
        {activeTab === 'bbm' && (
          <form
            onSubmit={handleSimpanLogBbm}
            className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-10 shadow-brand space-y-5"
          >
            <div className="border-b border-gray-100 pb-3">
              <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-[10px] font-bold uppercase inline-flex items-center gap-1">
                <Fuel className="w-3 h-3 text-amber-700" />
                <span>Buku Kas Operasional Armada</span>
              </span>
              <h2 className="text-lg font-black text-gray-900 font-display mt-2">
                Catat Pengisian BBM & Struk SPBU
              </h2>
              <p className="text-xs text-gray-500">
                Catat pembelian bahan bakar armada untuk rekonsiliasi kas dan riwayat konsumsi BBM.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Pilih Armada Kendaraan *</label>
              <select
                required
                value={bbmVehicleId}
                onChange={(e) => setBbmVehicleId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} ({v.license_plate})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Total Biaya BBM (Rp) *</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  required
                  value={bbmRupiah}
                  onChange={(e) => setBbmRupiah(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Jumlah Liter *</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  required
                  value={bbmLiter}
                  onChange={(e) => setBbmLiter(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Jenis Bahan Bakar *</label>
                <select
                  value={bbmJenis}
                  onChange={(e) => setBbmJenis(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                >
                  <option value="Biosolar Subsidi">Biosolar Subsidi</option>
                  <option value="Dexlite">Dexlite</option>
                  <option value="Pertamina Dex">Pertamina Dex</option>
                  <option value="Pertalite">Pertalite</option>
                  <option value="Pertamax">Pertamax</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">KM Odometer Terakhir</label>
                <input
                  type="number"
                  placeholder="Contoh: 145200"
                  value={bbmKm || ''}
                  onChange={(e) => setBbmKm(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Lokasi SPBU / Pom Bensin</label>
              <input
                type="text"
                placeholder="Contoh: SPBU Siman / Ponorogo"
                value={bbmSpbu}
                onChange={(e) => setBbmSpbu(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
              />
            </div>

            {/* Foto Struk */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#540000]" />
                  <span>Foto Struk Kasir SPBU (Opsional)</span>
                </label>
                {bbmStrukImage && (
                  <button
                    type="button"
                    onClick={() => setBbmStrukImage(null)}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                )}
              </div>

              {bbmStrukImage ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 max-h-36 bg-black flex items-center justify-center">
                  <img src={bbmStrukImage} alt="Struk Preview" className="max-h-36 object-contain" />
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-[#540000] rounded-xl p-3 cursor-pointer bg-white transition-colors">
                  <Camera className="w-5 h-5 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-600 font-semibold">Ambil / Unggah Foto Struk SPBU</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setBbmStrukImage(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Catatan Tambahan</label>
              <input
                type="text"
                placeholder="Keterangan pengantaran..."
                value={bbmCatatan}
                onChange={(e) => setBbmCatatan(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-[#E5E5E5] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={bbmSaving}
                className="w-full py-4 px-6 rounded-2xl bg-[#540000] hover:bg-[#3B0000] text-white font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-[#FFCC00]" />
                <span>{bbmSaving ? 'Menyimpan...' : '💾 Simpan & Kirim WhatsApp'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: RIWAYAT PEMINJAMAN TERKINI */}
        {activeTab === 'history' && (
          <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 shadow-brand space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-lg font-black text-gray-900 font-display">
                  Riwayat Peminjaman Armada Terkini
                </h2>
                <p className="text-xs text-gray-500">
                  Data peminjaman aktif & riwayat terdaftar di cloud database TB KUK.
                </p>
              </div>
              <button
                onClick={loadData}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
              >
                Muat Ulang
              </button>
            </div>

            {recentRequests.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                Belum ada data peminjaman kendaraan yang tercatat.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentRequests.slice(0, 10).map((r) => (
                  <div key={r.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900">{r.borrower_name}</span>
                        <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                          {r.booking_code || r.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'APPROVED' || r.status === 'IN_USE'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : r.status === 'RETURNED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-gray-50 text-gray-600'
                          }`}
                        >
                          {r.status === 'RETURNED' ? 'Selesai' : 'Sedang Dipinjam'}
                        </span>
                      </div>
                      <div className="text-gray-500">
                        {r.vehicle?.brand} {r.vehicle?.model} ({r.vehicle?.license_plate}) • {r.borrower_institution || 'Instansi KUK'}
                      </div>
                      <div className="text-gray-400 text-[11px]">
                        Keperluan: {r.purpose || r.destination}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-gray-500 font-mono">
                      {new Date(r.start_time).toLocaleDateString('id-ID')}
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
          © 2026 CV Karya Utama Kreasi · Sistem Peminjaman Kendaraan Operasional Online
        </div>
      </footer>
    </div>
  );
};
