import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { fleetService } from '@/services/dataService';
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
} from 'lucide-react';

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

  // Internal Booking modal state
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
  const [bSaving, setBSaving] = useState(false);

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
      loadData();
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
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Kode Booking,Peminjam,Instansi,Telepon,Penanggung Jawab,Armada,Plat,Waktu Mulai,Waktu Selesai,Tujuan,Keperluan,Status\n';
    requests.forEach((r) => {
      csvContent += `"${r.booking_code}","${r.borrower_name}","${r.borrower_institution || '-'}","${r.borrower_phone}","${r.responsible_person}","${r.vehicle?.brand || ''} ${r.vehicle?.model || ''}","${r.vehicle?.license_plate || ''}","${r.start_time}","${r.estimated_return_time}","${r.destination}","${r.purpose}","${r.status}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Peminjaman_Armada_${activeUnit?.code || 'KUK'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-kuk-maroon-50 text-kuk-maroon rounded-lg">
              <Truck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Armada & Peminjaman Kendaraan</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Inventaris armada & jadwal peminjaman unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={() => setBookingModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-kuk-maroon text-white rounded-xl text-xs font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>Ajukan Pinjam Armada</span>
          </button>

          {canManageFleet && (
            <button
              onClick={() => setVehicleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Daftar Armada Baru</span>
            </button>
          )}

          <a
            href="/kiosk/fleet-booking"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-kuk-maroon" />
            <span>Kiosk Booking Publik</span>
          </a>
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Instansi / Unit Asal</label>
                  <input
                    type="text"
                    value={bInstitution}
                    onChange={(e) => setBInstitution(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                  />
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {bSaving ? 'Mengirim...' : 'Kirim Pengajuan'}
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
    </div>
  );
};