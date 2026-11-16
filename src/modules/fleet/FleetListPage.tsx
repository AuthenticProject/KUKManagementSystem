import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { fleetService, financeService } from '@/services/dataService';
import type { Vehicle, VehicleBorrowingRequest, VehicleStatus, VehicleFuelLevel } from '@/types/models';
import {
  Truck,
  Calendar,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink,
  FileSpreadsheet,
  Settings2,
  Send,
  RotateCcw,
  Gauge,
  Fuel,
  Sparkles,
  ClipboardCheck,
  Printer,
  QrCode,
  Camera,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PrintHeader } from '@/components/common/PrintHeader';
import { exportToCSV } from '@/utils/exportUtils';
import { PageHeader } from '@/components/ui';

export const FleetListPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { user, hasPermission } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<VehicleBorrowingRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'vehicles' | 'requests'>('vehicles');
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  // Vehicle form modal state
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vPlate, setVPlate] = useState('');
  const [vBrand, setVBrand] = useState('Mitsubishi');
  const [vModel, setVModel] = useState('');
  const [vYear, setVYear] = useState(new Date().getFullYear());
  const [vType, setVType] = useState('PICKUP');
  const [vStatus, setVStatus] = useState<VehicleStatus>('AVAILABLE');
  const [vSaving, setVSaving] = useState(false);

  // Internal Booking modal state (Sesuai Referensi Web)
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bVehicleId, setBVehicleId] = useState('');
  const [bBorrowerName, setBBorrowerName] = useState(user?.email?.split('@')[0] || '');
  const [bInstitution, setBInstitution] = useState(activeUnit?.name || 'TB KUK La Tansa');
  const [bPhone, setBPhone] = useState('0812');
  const [bResponsible, setBResponsible] = useState(user?.email?.split('@')[0] || '');
  const [bStartTime, setBStartTime] = useState('');
  const [bEndTime, setBEndTime] = useState('');
  const [bDestination, setBDestination] = useState('');
  const [bPurpose, setBPurpose] = useState('');
  const [bSimImage, setBSimImage] = useState<string | null>(null);
  const [sopOpen, setSopOpen] = useState(false);
  const [bSaving, setBSaving] = useState(false);

  // MyPertamina QR Modal state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedQrVehicle, setSelectedQrVehicle] = useState<Vehicle | null>(null);

  // Catat BBM SPBU Modal state (Sesuai Referensi Web)
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [bbmVehicleId, setBbmVehicleId] = useState('');
  const [bbmRupiah, setBbmRupiah] = useState<number>(200000);
  const [bbmLiter, setBbmLiter] = useState<number>(29.5);
  const [bbmJenis, setBbmJenis] = useState('Biosolar Subsidi');
  const [bbmKm, setBbmKm] = useState<number>(145000);
  const [bbmSpbu, setBbmSpbu] = useState('SPBU Siman / Ponorogo');
  const [bbmStrukImage, setBbmStrukImage] = useState<string | null>(null);
  const [bbmCatatan, setBbmCatatan] = useState('');
  const [bbmSaving, setBbmSaving] = useState(false);

  // Status edit modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedVehicleForStatus, setSelectedVehicleForStatus] = useState<Vehicle | null>(null);
  const [newStatus, setNewStatus] = useState<VehicleStatus>('AVAILABLE');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedReqForReject, setSelectedReqForReject] = useState<VehicleBorrowingRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Return & Inspection modal state
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedReqForReturn, setSelectedReqForReturn] = useState<VehicleBorrowingRequest | null>(null);
  const [retOdometer, setRetOdometer] = useState<number>(10000);
  const [retFuel, setRetFuel] = useState<VehicleFuelLevel>('FULL');
  const [retCleanliness, setRetCleanliness] = useState<number>(5);
  const [retNotes, setRetNotes] = useState('');
  const [retInspector, setRetInspector] = useState(user?.email?.split('@')[0] || 'Staff Operasional');
  const [retReadiness, setRetReadiness] = useState<'FIT' | 'NEEDS_MAINTENANCE'>('FIT');
  const [retTime, setRetTime] = useState(new Date().toISOString().slice(0, 16));
  const [returning, setReturning] = useState(false);
  const [suratJalanModalOpen, setSuratJalanModalOpen] = useState(false);
  const [selectedReqForSuratJalan, setSelectedReqForSuratJalan] = useState<VehicleBorrowingRequest | null>(null);

  const canManageFleet = hasPermission('fleet.manage', activeUnitId);
  const canApproveBorrowing = hasPermission('fleet.approve_borrowing', activeUnitId);

  const loadData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    setError(null);
    const [vRes, rRes] = await Promise.all([
      fleetService.getVehiclesByUnit(activeUnitId),
      fleetService.getBorrowingRequests(activeUnitId),
    ]);
    setVehicles(vRes.data);
    setRequests(rRes.data);
    if (vRes.data.length > 0 && !bVehicleId) {
      setBVehicleId(vRes.data[0].id);
    }
    setIsFixture(vRes.isFixture || rRes.isFixture);
    if (!vRes.success && vRes.error) {
      setError(vRes.error);
    } else if (!rRes.success && rRes.error) {
      setError(rRes.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId]);

  const showToast = (msg: string, isError = false) => {
    setToast({ text: msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !vPlate.trim() || !vModel.trim()) return;

    setVSaving(true);
    const res = await fleetService.saveVehicle(activeUnitId, {
      license_plate: vPlate.trim().toUpperCase(),
      brand: vBrand.trim(),
      model: vModel.trim(),
      year: Number(vYear),
      type: vType,
      status: vStatus,
      is_active: true,
    });
    setVSaving(false);
    showToast(res.message, !res.success);
    if (res.success) {
      setVehicleModalOpen(false);
      setVPlate('');
      setVModel('');
      loadData();
    }
  };

  const selectedVehicleObj = vehicles.find((v) => v.id === bVehicleId);
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

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !bVehicleId || !bStartTime || !bEndTime) {
      showToast('Lengkapi seluruh field wajib peminjaman armada.', true);
      return;
    }
    setBSaving(true);
    const res = await fleetService.bookVehicle(activeUnitId, {
      vehicle_id: bVehicleId,
      borrower_name: bBorrowerName.trim(),
      borrower_institution: bInstitution.trim() || undefined,
      borrower_phone: bPhone.trim(),
      responsible_person: bResponsible.trim(),
      start_time: new Date(bStartTime).toISOString(),
      estimated_return_time: new Date(bEndTime).toISOString(),
      destination: bDestination.trim(),
      purpose: bPurpose.trim(),
    });
    setBSaving(false);
    showToast(res.message, !res.success);
    if (res.success) {
      setBookingModalOpen(false);
      setBDestination('');
      setBPurpose('');
      setBSimImage(null);
      loadData();

      // Sinkronisasi WhatsApp sesuai referensi web
      try {
        const veh = vehicles.find((v) => v.id === bVehicleId);
        const waText = encodeURIComponent(
          `*PENGAJUAN PEMINJAMAN KENDARAAN TB. KUK*\n\n` +
          `• *Peminjam:* ${bBorrowerName}\n` +
          `• *Kamar/Instansi:* ${bInstitution}\n` +
          `• *No. HP:* ${bPhone}\n` +
          `• *Kendaraan:* ${veh?.brand || ''} ${veh?.model || ''} (${veh?.license_plate || ''})\n` +
          `• *Waktu Mulai:* ${bStartTime}\n` +
          `• *Rencana Kembali:* ${bEndTime}\n` +
          `• *Tujuan:* ${bDestination}\n` +
          `• *Keperluan:* ${bPurpose}\n\n` +
          `_Mohon persetujuan dari Koordinator/Staff Pengelola Kendaraan KUK. Terima kasih._`
        );
        window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
      } catch {}
    }
  };

  const handleSimpanLogBbm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !bbmVehicleId) {
      showToast('Pilih armada kendaraan terlebih dahulu.', true);
      return;
    }
    setBbmSaving(true);
    const veh = vehicles.find((v) => v.id === bbmVehicleId);
    try {
      await financeService.recordExpense(activeUnitId, {
        category: 'OPERATIONAL',
        amount: bbmRupiah,
        recipient_name: `SPBU (${bbmSpbu || 'Pengisian BBM'})`,
        description: `Pengisian BBM ${bbmJenis} (${bbmLiter}L) - ${veh?.brand || ''} ${veh?.model || ''} (${veh?.license_plate || ''}) Odometer: ${bbmKm || '-'} KM. ${bbmCatatan || ''}`,
        expense_date: new Date().toISOString().split('T')[0],
      });
      showToast('✓ Log pengisian BBM & struk SPBU berhasil dicatat!');
      setFuelModalOpen(false);

      // Kirim WhatsApp
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
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan log BBM.', true);
    } finally {
      setBbmSaving(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !selectedVehicleForStatus) return;
    setUpdatingStatus(true);
    const res = await fleetService.updateVehicleStatus(activeUnitId, selectedVehicleForStatus.id, newStatus);
    setUpdatingStatus(false);
    showToast(res.message, !res.success);
    if (res.success) {
      setStatusModalOpen(false);
      loadData();
    }
  };

  const handleApproveBorrowing = async (requestId: string) => {
    if (!activeUnitId) return;
    if (!user?.id) {
      showToast('Gagal: Sesi pengguna tidak ditemukan. Silakan login kembali.', true);
      return;
    }
    const res = await fleetService.approveBorrowing(
      activeUnitId,
      requestId,
      user.id,
      'APPROVE'
    );
    showToast(res.message, !res.success);
    if (res.success) {
      loadData();
    }
  };

  const handleOpenRejectModal = (req: VehicleBorrowingRequest) => {
    setSelectedReqForReject(req);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !selectedReqForReject) return;
    if (!user?.id) {
      showToast('Gagal: Sesi pengguna tidak ditemukan. Silakan login kembali.', true);
      return;
    }
    if (!rejectReason.trim()) {
      showToast('Gagal: Alasan penolakan peminjaman armada wajib diisi.', true);
      return;
    }
    setRejecting(true);
    const res = await fleetService.approveBorrowing(
      activeUnitId,
      selectedReqForReject.id,
      user.id,
      'REJECT',
      rejectReason.trim()
    );
    setRejecting(false);
    showToast(res.message, !res.success);
    if (res.success) {
      setRejectModalOpen(false);
      setSelectedReqForReject(null);
      loadData();
    }
  };

  const handleOpenReturnModal = (req: VehicleBorrowingRequest) => {
    setSelectedReqForReturn(req);
    setRetOdometer(12500);
    setRetFuel('FULL');
    setRetCleanliness(5);
    setRetReadiness('FIT');
    setRetNotes('Kendaraan dalam kondisi bersih, mesin dan fungsi operasional prima.');
    setRetInspector(user?.email?.split('@')[0] || 'Staff Operasional');
    setRetTime(new Date().toISOString().slice(0, 16));
    setReturnModalOpen(true);
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !selectedReqForReturn) return;
    setReturning(true);
    const res = await fleetService.returnVehicle(activeUnitId, {
      requestId: selectedReqForReturn.id,
      vehicleId: selectedReqForReturn.vehicle_id,
      odometer_km: Number(retOdometer) || 0,
      fuel_level: retFuel,
      cleanliness_score: Number(retCleanliness) || 5,
      operational_readiness: retReadiness,
      condition_notes: retNotes.trim(),
      inspector_name: retInspector.trim(),
      actual_return_time: new Date(retTime).toISOString(),
    });
    setReturning(false);
    showToast(res.message, !res.success);
    if (res.success) {
      setReturnModalOpen(false);
      setSelectedReqForReturn(null);
      loadData();
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Kode Booking',
      'Peminjam',
      'Instansi',
      'Telepon',
      'Penanggung Jawab',
      'Armada',
      'Plat',
      'Waktu Mulai',
      'Waktu Selesai',
      'Tujuan',
      'Keperluan',
      'Status',
    ];
    const rows = requests.map((r) => [
      r.booking_code,
      r.borrower_name,
      r.borrower_institution || '-',
      r.borrower_phone,
      r.responsible_person,
      `${r.vehicle?.brand || ''} ${r.vehicle?.model || ''}`,
      r.vehicle?.license_plate || '',
      r.start_time,
      r.estimated_return_time,
      r.destination,
      r.purpose,
      r.status,
    ]);
    exportToCSV(`Peminjaman_Armada_${activeUnit?.code || 'KUK'}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm animate-in slide-in-from-bottom duration-200 ${
          toast.isError ? 'bg-red-900 border border-red-700' : 'bg-gray-900'
        }`}>
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
        title="Armada & Peminjaman Kendaraan"
        subtitle={`Inventaris armada & jadwal peminjaman unit ${activeUnit?.name || 'Unit Aktif'}`}
        icon={<Truck className="w-6 h-6 text-kuk-maroon" />}
        breadcrumbs={[{ label: 'Beranda', href: '/dashboard' }, { label: 'Armada & Kendaraan' }]}
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
              onClick={() => setBookingModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-kuk-maroon text-white rounded-xl text-xs font-semibold hover:bg-kuk-maroon-dark transition-colors shadow-xs"
            >
              <Send className="w-4 h-4 text-kuk-gold" />
              <span>Ajukan Pinjam Armada</span>
            </button>

            <button
              onClick={() => {
                if (vehicles.length > 0 && !bbmVehicleId) setBbmVehicleId(vehicles[0].id);
                setFuelModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
              title="Catat Pengisian BBM & Struk SPBU"
            >
              <Fuel className="w-3.5 h-3.5 text-kuk-maroon" />
              <span>Catat BBM SPBU</span>
            </button>

            {canManageFleet && (
              <button
                onClick={() => setVehicleModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
              >
                <Plus className="w-4 h-4 text-kuk-maroon" />
                <span>Daftar Armada Baru</span>
              </button>
            )}

            <a
              href="/kiosk/fleet-booking"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
            >
              <ExternalLink className="w-4 h-4 text-kuk-maroon" />
              <span>Kiosk Booking Publik</span>
            </a>
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
            onClick={loadData}
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'vehicles'
              ? 'border-kuk-maroon text-kuk-maroon'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Inventaris Kendaraan ({vehicles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'requests'
              ? 'border-kuk-maroon text-kuk-maroon'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Pengajuan Peminjaman ({requests.length})</span>
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat data armada...</div>
        ) : activeTab === 'vehicles' ? (
          vehicles.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">Belum ada armada terdaftar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {vehicles.map((veh) => (
                <div key={veh.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-gray-900 bg-white px-2.5 py-1 rounded border border-gray-200">
                      {veh.license_plate}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          veh.status === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : veh.status === 'MAINTENANCE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {veh.status}
                      </span>
                      {canManageFleet && (
                        <button
                          onClick={() => {
                            setSelectedVehicleForStatus(veh);
                            setNewStatus(veh.status);
                            setStatusModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-kuk-maroon rounded hover:bg-gray-200 transition-colors"
                          title="Ubah Status Armada"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-gray-900 text-sm">{veh.brand} {veh.model}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Tipe: {veh.type} • Tahun: {veh.year}</div>
                  </div>

                  {(veh.model.toLowerCase().includes('l300') ||
                    veh.license_plate.toLowerCase().includes('l300') ||
                    veh.model.toLowerCase().includes('engkel') ||
                    veh.license_plate.toLowerCase().includes('engkel') ||
                    veh.type === 'TRUCK') && (
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQrVehicle(veh);
                          setQrModalOpen(true);
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                      >
                        <QrCode className="w-3.5 h-3.5 text-amber-700" />
                        <span>MyPertamina QR Solar Pass</span>
                      </button>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <span>Exclusion GiST Anti-Tabrakan</span>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Belum ada pengajuan peminjaman</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((r) => (
              <div key={r.id} className="p-5 hover:bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900">{r.borrower_name}</span>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{r.booking_code}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        r.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.status === 'RETURNED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : r.status === 'IN_USE'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : r.status === 'REJECTED'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {r.status === 'APPROVED' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : r.status === 'RETURNED' ? (
                        <ClipboardCheck className="w-3 h-3 text-blue-600" />
                      ) : r.status === 'IN_USE' ? (
                        <Truck className="w-3 h-3 text-indigo-600" />
                      ) : r.status === 'REJECTED' ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{r.status}</span>
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    Kendaraan: <span className="font-semibold text-gray-700">{r.vehicle?.brand} {r.vehicle?.model} ({r.vehicle?.license_plate})</span>
                    <span className="mx-2">•</span>
                    Waktu: <span className="font-mono text-gray-700">{new Date(r.start_time).toLocaleString('id-ID')} s.d. {new Date(r.estimated_return_time).toLocaleString('id-ID')}</span>
                    {r.actual_return_time && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="text-emerald-700 font-medium">Dikembalikan: {new Date(r.actual_return_time).toLocaleString('id-ID')}</span>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 mt-2">
                    <span className="font-semibold text-gray-700">Tujuan & Keperluan: </span>
                    {r.destination} — {r.purpose}
                  </p>

                  {r.cancellation_reason && (
                    <p className="text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-200 mt-1">
                      <span className="font-semibold">Alasan Penolakan/Pembatalan: </span>{r.cancellation_reason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedReqForSuratJalan(r);
                      setSuratJalanModalOpen(true);
                    }}
                    className="p-1.5 text-gray-500 hover:text-kuk-maroon hover:bg-kuk-maroon-50 rounded-lg transition-colors"
                    title="Cetak Surat Jalan Peminjaman Armada"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {canApproveBorrowing && r.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleApproveBorrowing(r.id)}
                        className="px-3 py-1.5 bg-kuk-maroon text-white rounded-lg text-xs font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
                      >
                        Setujui
                      </button>
                      <button
                        onClick={() => handleOpenRejectModal(r)}
                        className="px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors shadow-2xs"
                      >
                        Tolak
                      </button>
                    </>
                  )}

                  {(canManageFleet || canApproveBorrowing) && (r.status === 'APPROVED' || r.status === 'IN_USE') && (
                    <button
                      onClick={() => handleOpenReturnModal(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-kuk-gold text-kuk-maroon-900 border border-kuk-gold-light hover:bg-kuk-gold-light rounded-lg text-xs font-bold transition-colors shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-kuk-maroon" />
                      <span>Kembalikan Armada</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Pengajuan Peminjaman Armada Internal */}
      {bookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Ajukan Peminjaman Armada</h2>
              </div>
              <button onClick={() => setBookingModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateBooking} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Kendaraan *</label>
                <select
                  required
                  value={bVehicleId}
                  onChange={(e) => setBVehicleId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                >
                  <option value="">-- Pilih Armada --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.license_plate}) - Status: {v.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Peminjam / Driver *</label>
                  <input
                    type="text"
                    required
                    value={bBorrowerName}
                    onChange={(e) => setBBorrowerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">No. WhatsApp / HP *</label>
                  <input
                    type="text"
                    required
                    value={bPhone}
                    onChange={(e) => setBPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Instansi / Unit / Rayon *</label>
                  <input
                    type="text"
                    required
                    list="instansi-list"
                    placeholder="Pilih kamar / instansi..."
                    value={bInstitution}
                    onChange={(e) => setBInstitution(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                  <datalist id="instansi-list">
                    <option value="TB KUK La Tansa" />
                    <option value="TB KUK Palen" />
                    <option value="Rayon Al-Azhar" />
                    <option value="Rayon Syanggit" />
                    <option value="Rayon Cairo" />
                    <option value="Rayon Damaskus" />
                    <option value="Rayon Mekkah" />
                    <option value="Rayon Madinah" />
                    <option value="Rayon Tunis" />
                    <option value="Rayon Sudan" />
                    <option value="Rayon Tripoli" />
                    <option value="Bagian Dapur Pondok" />
                    <option value="Panitia / Bagian Pondok" />
                    <option value="Pengasuhan Santri" />
                    <option value="KMI Gontor" />
                    <option value="Umum / Eksternal" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Penanggung Jawab *</label>
                  <input
                    type="text"
                    required
                    value={bResponsible}
                    onChange={(e) => setBResponsible(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Waktu Mulai Pinjam *</label>
                  <input
                    type="datetime-local"
                    required
                    value={bStartTime}
                    onChange={(e) => setBStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Estimasi Waktu Kembali *</label>
                  <input
                    type="datetime-local"
                    required
                    value={bEndTime}
                    onChange={(e) => setBEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tujuan Perjalanan *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pengiriman material keramik ke Cilegon"
                  value={bDestination}
                  onChange={(e) => setBDestination(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Keperluan Lengkap *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Keterangan muatan / surat jalan pengiriman..."
                  value={bPurpose}
                  onChange={(e) => setBPurpose(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              {/* Upload Foto SIM Pengemudi */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-kuk-maroon" />
                    <span>
                      Foto Kartu SIM Pengemudi{' '}
                      {isSimRequired ? (
                        <span className="text-red-500 font-bold">* (Wajib SIM A / B1)</span>
                      ) : (
                        <span className="text-gray-400 font-normal">(Opsional)</span>
                      )}
                    </span>
                  </label>
                  {bSimImage && (
                    <button
                      type="button"
                      onClick={() => setBSimImage(null)}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  )}
                </div>

                {bSimImage ? (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 max-h-40 bg-black flex items-center justify-center">
                    <img src={bSimImage} alt="SIM Preview" className="max-h-40 object-contain" />
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-kuk-maroon rounded-lg p-3 cursor-pointer bg-white transition-colors">
                    <Camera className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-600 font-medium">Klik untuk Unggah Foto SIM Pengemudi</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">Maksimal 5MB (JPG / PNG)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setBSimImage(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
                <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1">
                  <span>📂 Atau arsip folder:</span>
                  <a
                    href="https://drive.google.com/drive/folders/1gmv0TIJvTJcCyKD8rs7ichW4LANGFtyZ?usp=sharing"
                    target="_blank"
                    rel="noreferrer"
                    className="text-kuk-maroon hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Google Drive Kendaraan KUK</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Ketentuan & SOP Peminjaman Kendaraan */}
              <div className="border border-amber-200 bg-amber-50/60 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSopOpen(!sopOpen)}
                  className="w-full px-3.5 py-2 flex items-center justify-between text-left text-xs font-bold text-amber-900 hover:bg-amber-100/50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Ketentuan & SOP Peminjaman Kendaraan TB. KUK</span>
                  </span>
                  {sopOpen ? <ChevronUp className="w-4 h-4 text-amber-700" /> : <ChevronDown className="w-4 h-4 text-amber-700" />}
                </button>
                {sopOpen && (
                  <div className="px-3.5 py-2.5 pt-1 text-[11px] text-amber-900/90 space-y-1 border-t border-amber-200/50">
                    <p>1. <strong>Pengajuan:</strong> Wajib diajukan selambatnya H-1 sebelum pemakaian armada.</p>
                    <p>2. <strong>Kualifikasi Pengemudi:</strong> Pengemudi wajib memiliki SIM A / B1 yang sah dan masih berlaku.</p>
                    <p>3. <strong>Kondisi Kendaraan:</strong> Kendaraan harus dikembalikan dalam kondisi bersih & bahan bakar sama saat awal serah terima.</p>
                    <p>4. <strong>BBM & SPBU:</strong> Gunakan MyPertamina QR Pass armada untuk BioSolar Subsidi dan lampirkan struk resmi SPBU.</p>
                    <p>5. <strong>Tanggung Jawab:</strong> Segala tilang, kerusakan fisik akibat kelalaian, dan insiden menjadi tanggung jawab peminjam sepenuhnya.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={bSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-kuk-gold" />
                  <span>{bSaving ? 'Menyimpan...' : '💾 Simpan & Kirim WhatsApp'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Status Kendaraan */}
      {statusModalOpen && selectedVehicleForStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Status {selectedVehicleForStatus.license_plate}</h2>
              </div>
              <button onClick={() => setStatusModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Status Operasional</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as VehicleStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                >
                  <option value="AVAILABLE">AVAILABLE (Tersedia / Siap Jalan)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Servis / Bengkel)</option>
                  <option value="IN_USE">IN_USE (Sedang Bertugas)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {updatingStatus ? 'Menyimpan...' : 'Perbarui Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Kendaraan */}
      {vehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Pendaftaran Armada Kendaraan</h2>
              </div>
              <button onClick={() => setVehicleModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateVehicle} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor Polisi / Plat *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: B 9123 KUK"
                  value={vPlate}
                  onChange={(e) => setVPlate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Merk / Brand *</label>
                  <input
                    type="text"
                    required
                    value={vBrand}
                    onChange={(e) => setVBrand(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Model / Varian *</label>
                  <input
                    type="text"
                    required
                    placeholder="Colt L300 / Gran Max"
                    value={vModel}
                    onChange={(e) => setVModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tahun Perakitan</label>
                  <input
                    type="number"
                    value={vYear}
                    onChange={(e) => setVYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tipe Kendaraan</label>
                  <select
                    value={vType}
                    onChange={(e) => setVType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  >
                    <option value="PICKUP">Pick Up (Bak Terbuka)</option>
                    <option value="BOX">Truk Box (Tertutup)</option>
                    <option value="MPV">MPV (Operasional Dinas)</option>
                    <option value="MOTOR">Sepeda Motor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Status Awal</label>
                <select
                  value={vStatus}
                  onChange={(e) => setVStatus(e.target.value as VehicleStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                >
                  <option value="AVAILABLE">AVAILABLE (Siap Pakai)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Dalam Perawatan)</option>
                  <option value="IN_USE">IN_USE (Sedang Digunakan)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setVehicleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={vSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {vSaving ? 'Mendaftarkan...' : 'Daftarkan Armada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Penolakan Peminjaman Armada */}
      {rejectModalOpen && selectedReqForReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-200" />
                <h2 className="font-bold text-sm">Penolakan Peminjaman ({selectedReqForReject.booking_code})</h2>
              </div>
              <button onClick={() => setRejectModalOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                <div><span className="text-gray-500">Peminjam:</span> <strong>{selectedReqForReject.borrower_name}</strong></div>
                <div><span className="text-gray-500">Tujuan:</span> {selectedReqForReject.destination}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Alasan Penolakan Resmi *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Contoh: Kendaraan sedang dalam jadwal servis bengkel rutin..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={rejecting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {rejecting ? 'Memproses...' : 'Tolak Peminjaman'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pengembalian & Inspeksi Armada */}
      {returnModalOpen && selectedReqForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Pengembalian & Inspeksi Armada ({selectedReqForReturn.booking_code})</h2>
              </div>
              <button onClick={() => setReturnModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReturn} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Armada:</span>
                  <span className="font-bold text-gray-800 font-mono">
                    {selectedReqForReturn.vehicle?.brand} {selectedReqForReturn.vehicle?.model} ({selectedReqForReturn.vehicle?.license_plate})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Peminjam / Driver:</span>
                  <span className="font-semibold text-gray-800">{selectedReqForReturn.borrower_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Tujuan:</span>
                  <span className="text-gray-700">{selectedReqForReturn.destination}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-kuk-maroon" />
                    <span>Odometer Kembali (KM) *</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={retOdometer}
                    onChange={(e) => setRetOdometer(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-kuk-maroon" />
                    <span>Level Bahan Bakar *</span>
                  </label>
                  <select
                    value={retFuel}
                    onChange={(e) => setRetFuel(e.target.value as VehicleFuelLevel)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  >
                    <option value="FULL">Penuh (100% / Full)</option>
                    <option value="THREE_QUARTERS">3/4 Tangki</option>
                    <option value="HALF">1/2 Tangki (Setengah)</option>
                    <option value="QUARTER">1/4 Tangki</option>
                    <option value="EMPTY">Hampir Habis (Empty)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-kuk-gold" />
                    <span>Kebersihan Armada (1-5) *</span>
                  </label>
                  <select
                    value={retCleanliness}
                    onChange={(e) => setRetCleanliness(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  >
                    <option value={5}>5 - Sangat Bersih & Rapi</option>
                    <option value={4}>4 - Bersih Standar</option>
                    <option value={3}>3 - Cukup (Perlu Dicuci)</option>
                    <option value={2}>2 - Kotor (Ada Sampah/Noda)</option>
                    <option value={1}>1 - Sangat Kotor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Waktu Kembali *</label>
                  <input
                    type="datetime-local"
                    required
                    value={retTime}
                    onChange={(e) => setRetTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Petugas Pemeriksa *</label>
                  <input
                    type="text"
                    required
                    value={retInspector}
                    onChange={(e) => setRetInspector(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Kelaikan Operasional *</span>
                    <span className="text-[10px] text-kuk-maroon font-normal">Otoritas Petugas</span>
                  </label>
                  <select
                    value={retReadiness}
                    onChange={(e) => setRetReadiness(e.target.value as 'FIT' | 'NEEDS_MAINTENANCE')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white font-medium focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  >
                    <option value="FIT">FIT (Layak Operasi &rarr; AVAILABLE)</option>
                    <option value="NEEDS_MAINTENANCE">NEEDS_MAINTENANCE (Servis &rarr; MAINTENANCE)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan Kondisi Fisik & Kelengkapan</label>
                <textarea
                  rows={2}
                  value={retNotes}
                  onChange={(e) => setRetNotes(e.target.value)}
                  placeholder="Catatan baret, ban serep, dongkrak, atau kondisi mesin..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900">
                <span className="font-semibold text-amber-950">Protokol Kelaikan Armada: </span>
                <span>
                  Status ketersediaan armada ditentukan secara langsung oleh <strong>Penilaian Kelaikan Petugas</strong>. Jika petugas menetapkan <em>NEEDS_MAINTENANCE</em>, sistem seketika memblokir peminjaman baru sampai armada diservis. Tidak ada asumsi skor kebersihan atau kata kunci otomatis yang membatalkan putusan petugas.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={returning}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  <ClipboardCheck className="w-4 h-4 text-kuk-gold" />
                  <span>{returning ? 'Menyimpan...' : 'Simpan & Selesaikan Pengembalian'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cetak Surat Jalan Peminjaman Armada */}
      {suratJalanModalOpen && selectedReqForSuratJalan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-3.5 bg-gray-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-kuk-gold" />
                <span className="font-bold text-sm">Surat Jalan Armada — {selectedReqForSuratJalan.booking_code}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-kuk-maroon text-white hover:bg-kuk-maroon-700 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Dokumen</span>
                </button>
                <button
                  onClick={() => setSuratJalanModalOpen(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 text-xs bg-white text-gray-800">
              <PrintHeader
                title="SURAT JALAN & IZIN OPERASIONAL ARMADA"
                documentNumber={selectedReqForSuratJalan.booking_code}
                unitName={activeUnit?.name}
                unitCode={activeUnit?.code}
              />

              <div className="grid grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                <div className="space-y-1">
                  <div className="text-gray-500 text-[11px]">Identitas Peminjam:</div>
                  <div className="font-bold text-gray-900 text-sm">{selectedReqForSuratJalan.borrower_name}</div>
                  <div className="text-gray-600 font-medium">{selectedReqForSuratJalan.borrower_institution || 'Internal KUK'} • {selectedReqForSuratJalan.borrower_phone}</div>
                  <div className="text-gray-500 text-[11px]">Penanggung Jawab: {selectedReqForSuratJalan.responsible_person}</div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-gray-500 text-[11px]">Armada yang Dipinjam:</div>
                  <div className="font-bold text-gray-900 text-sm">{selectedReqForSuratJalan.vehicle?.brand} {selectedReqForSuratJalan.vehicle?.model}</div>
                  <div className="font-mono font-bold text-kuk-maroon text-xs">{selectedReqForSuratJalan.vehicle?.license_plate}</div>
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedReqForSuratJalan.status === 'APPROVED' || selectedReqForSuratJalan.status === 'IN_USE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedReqForSuratJalan.status === 'RETURNED'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      STATUS: {selectedReqForSuratJalan.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                <div className="text-gray-500 text-[11px] uppercase font-bold tracking-wider">Jadwal & Tujuan Perjalanan:</div>
                <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div>
                    <span className="text-gray-500">Waktu Berangkat:</span>
                    <div className="font-semibold text-gray-900 mt-0.5">{new Date(selectedReqForSuratJalan.start_time).toLocaleString('id-ID')}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Estimasi Kembali:</span>
                    <div className="font-semibold text-gray-900 mt-0.5">{new Date(selectedReqForSuratJalan.estimated_return_time).toLocaleString('id-ID')}</div>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-gray-200/60">
                    <span className="text-gray-500">Tujuan & Keperluan:</span>
                    <div className="font-bold text-gray-900 mt-0.5">{selectedReqForSuratJalan.destination} — {selectedReqForSuratJalan.purpose}</div>
                  </div>
                </div>
              </div>

              {/* Checklist Serah Terima Fisik */}
              <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-2">
                <div className="text-gray-500 text-[11px] uppercase font-bold tracking-wider">Lembar Cek Fisik & Kondisi Armada:</div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-gray-400 text-[10px]">Odometer Awal</div>
                    <div className="font-mono font-bold text-gray-800 mt-1">______ KM</div>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-gray-400 text-[10px]">Bahan Bakar Awal</div>
                    <div className="font-bold text-gray-800 mt-1">[ ] 1/4 [ ] 1/2 [ ] Full</div>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-gray-400 text-[10px]">Kondisi Fisik</div>
                    <div className="font-bold text-gray-800 mt-1">[ ] Baik & Bersih</div>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200 text-center">
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Peminjam / Pengemudi:</div>
                  <div className="border-b border-gray-300 w-28 mx-auto"></div>
                  <div className="font-bold text-gray-800">({selectedReqForSuratJalan.borrower_name})</div>
                </div>
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Petugas Logistik Toko:</div>
                  <div className="border-b border-gray-300 w-28 mx-auto"></div>
                  <div className="font-bold text-gray-800">(Petugas Armada)</div>
                </div>
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Kepala Toko / Menyetujui:</div>
                  <div className="border-b border-gray-300 w-28 mx-auto"></div>
                  <div className="font-bold text-gray-800">(Manajer Unit)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal MyPertamina QR Solar Pass */}
      {qrModalOpen && selectedQrVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-white" />
                <h2 className="font-bold text-sm">
                  MyPertamina Solar Pass: {selectedQrVehicle.brand} {selectedQrVehicle.model} ({selectedQrVehicle.license_plate})
                </h2>
              </div>
              <button onClick={() => setQrModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 text-center space-y-4">
              <p className="text-xs text-gray-600">
                Tunjukkan barcode QR resmi di bawah ini kepada petugas SPBU Pertamina saat melakukan pengisian BioSolar Subsidi armada TB KUK.
              </p>

              <div className="bg-white p-3 rounded-2xl border-2 border-dashed border-amber-300 inline-block shadow-inner mx-auto">
                <img
                  src={
                    selectedQrVehicle.model.toLowerCase().includes('l300') ||
                    selectedQrVehicle.license_plate.toLowerCase().includes('l300')
                      ? '/fleet/QR-L300.jpeg'
                      : '/fleet/qr-engkel.png'
                  }
                  alt={`QR Pertamina ${selectedQrVehicle.license_plate}`}
                  className="max-h-72 w-auto object-contain mx-auto rounded-lg"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 text-left space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Subsidi BioSolar Tepat Sasaran TB KUK</span>
                </div>
                <div>Armada: <strong>{selectedQrVehicle.brand} {selectedQrVehicle.model}</strong></div>
                <div>Plat Nomor: <span className="font-mono font-bold bg-amber-100 px-1.5 py-0.5 rounded">{selectedQrVehicle.license_plate}</span></div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <a
                  href={
                    selectedQrVehicle.model.toLowerCase().includes('l300') ||
                    selectedQrVehicle.license_plate.toLowerCase().includes('l300')
                      ? '/fleet/QR-L300.jpeg'
                      : '/fleet/qr-engkel.png'
                  }
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Gambar Asli</span>
                </a>
                <button
                  type="button"
                  onClick={() => setQrModalOpen(false)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Catat Pengisian BBM SPBU */}
      {fuelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fuel className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Catat Pengisian BBM & Struk SPBU</h2>
              </div>
              <button onClick={() => setFuelModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSimpanLogBbm} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Armada Kendaraan *</label>
                <select
                  required
                  value={bbmVehicleId}
                  onChange={(e) => setBbmVehicleId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                >
                  <option value="">-- Pilih Kendaraan --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.license_plate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Total Biaya (Rp) *</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    required
                    value={bbmRupiah}
                    onChange={(e) => setBbmRupiah(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono font-bold focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jumlah Liter *</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    required
                    value={bbmLiter}
                    onChange={(e) => setBbmLiter(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jenis Bahan Bakar *</label>
                  <select
                    value={bbmJenis}
                    onChange={(e) => setBbmJenis(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  >
                    <option value="Biosolar Subsidi">Biosolar Subsidi</option>
                    <option value="Dexlite">Dexlite</option>
                    <option value="Pertamina Dex">Pertamina Dex</option>
                    <option value="Pertalite">Pertalite</option>
                    <option value="Pertamax">Pertamax</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">KM Odometer Terakhir</label>
                  <input
                    type="number"
                    value={bbmKm || ''}
                    onChange={(e) => setBbmKm(Number(e.target.value))}
                    placeholder="Contoh: 145200"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Lokasi SPBU / Pom Bensin</label>
                <input
                  type="text"
                  placeholder="Contoh: SPBU Siman / Ponorogo"
                  value={bbmSpbu}
                  onChange={(e) => setBbmSpbu(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              {/* Upload Foto Struk */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-kuk-maroon" />
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
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 max-h-36 bg-black flex items-center justify-center">
                    <img src={bbmStrukImage} alt="Struk SPBU Preview" className="max-h-36 object-contain" />
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-kuk-maroon rounded-lg p-2.5 cursor-pointer bg-white transition-colors">
                    <Camera className="w-5 h-5 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-600 font-medium">Klik untuk Ambil/Unggah Foto Struk</span>
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  placeholder="Keterangan pengantaran / pengisian..."
                  value={bbmCatatan}
                  onChange={(e) => setBbmCatatan(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setFuelModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={bbmSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-kuk-gold" />
                  <span>{bbmSaving ? 'Menyimpan...' : '💾 Simpan & Kirim WhatsApp'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};