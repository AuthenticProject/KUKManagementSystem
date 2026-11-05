import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { fleetService } from '@/services/dataService';
import type { Vehicle, VehicleBorrowingRequest, VehicleStatus } from '@/types/models';
import { Truck, Calendar, Plus, CheckCircle, Clock, AlertCircle, CheckCircle2, X } from 'lucide-react';

export const FleetListPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { user, hasPermission } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<VehicleBorrowingRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'vehicles' | 'requests'>('vehicles');
  const [toast, setToast] = useState<string | null>(null);

  // Vehicle form modal state
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vPlate, setVPlate] = useState('');
  const [vBrand, setVBrand] = useState('Mitsubishi');
  const [vModel, setVModel] = useState('');
  const [vYear, setVYear] = useState(new Date().getFullYear());
  const [vType, setVType] = useState('PICKUP');
  const [vStatus, setVStatus] = useState<VehicleStatus>('AVAILABLE');
  const [vSaving, setVSaving] = useState(false);

  const canManageFleet = hasPermission('fleet.manage', activeUnitId);
  const canApproveBorrowing = hasPermission('fleet.approve_borrowing', activeUnitId);

  const loadData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    const [vRes, rRes] = await Promise.all([
      fleetService.getVehiclesByUnit(activeUnitId),
      fleetService.getBorrowingRequests(activeUnitId),
    ]);
    setVehicles(vRes.data);
    setRequests(rRes.data);
    setIsFixture(vRes.isFixture || rRes.isFixture);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId]);

  const showToast = (msg: string) => {
    setToast(msg);
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
    showToast(res.message);
    setVehicleModalOpen(false);
    setVPlate('');
    setVModel('');
    loadData();
  };

  const handleApproveBorrowing = async (requestId: string) => {
    if (!activeUnitId) return;
    if (!user?.id) {
      showToast('Gagal: Sesi pengguna tidak ditemukan. Silakan login kembali.');
      return;
    }
    const res = await fleetService.approveBorrowing(
      activeUnitId,
      requestId,
      user.id
    );
    showToast(res.message);
    loadData();
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
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
            Inventaris armada & jadwal sewa unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        {canManageFleet && (
          <button
            onClick={() => setVehicleModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-kuk-maroon text-white rounded-xl text-sm font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Armada Baru</span>
          </button>
        )}
      </div>

      {isFixture && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Zero-State Preview Mode:</strong> Belum ada armada kendaraan terdaftar di database Production. Data di bawah ini adalah sampel preview lokal.
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
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        veh.status === 'AVAILABLE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {veh.status}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-gray-900 text-sm">{veh.brand} {veh.model}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Tipe: {veh.type} • Tahun: {veh.year}</div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <span>Exclusion GiST Protection</span>
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
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {r.status === 'APPROVED' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      <span>{r.status}</span>
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    Kendaraan: <span className="font-semibold text-gray-700">{r.vehicle?.brand} {r.vehicle?.model} ({r.vehicle?.license_plate})</span>
                  </div>

                  <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 mt-2">
                    <span className="font-semibold text-gray-700">Tujuan & Keperluan: </span>
                    {r.destination} — {r.purpose}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canApproveBorrowing && r.status === 'PENDING' && (
                    <button
                      onClick={() => handleApproveBorrowing(r.id)}
                      className="px-3 py-1.5 bg-kuk-maroon text-white rounded-lg text-xs font-semibold hover:bg-kuk-maroon-700 transition-colors shadow-xs"
                    >
                      Setujui Peminjaman
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Tambah Kendaraan (Memerlukan fleet.manage) */}
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
    </div>
  );
};
