import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { leaveService } from '@/services/dataService';
import type { LeaveRequest } from '@/types/models';
import { CalendarDays, CheckCircle, Clock, XCircle, AlertCircle, Ban, CheckCircle2, UserCheck } from 'lucide-react';

export const LeaveListPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { user, hasPermission } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [toast, setToast] = useState<string | null>(null);

  // Cancellation Modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReqForCancel, setSelectedReqForCancel] = useState<LeaveRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    const res = await leaveService.getLeaveRequestsByUnit(activeUnitId);
    setRequests(res.data);
    setIsFixture(res.isFixture);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleStatusChange = async (reqId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!activeUnitId) return;
    const res = await leaveService.updateLeaveStatus(activeUnitId, reqId, status);
    showToast(res.message);
    loadData();
  };

  const handleCancelAtomic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqForCancel || !cancelReason.trim() || !activeUnitId) return;
    if (!user?.id) {
      showToast('Gagal: Sesi pengguna tidak ditemukan. Silakan login kembali.');
      return;
    }

    setCancelling(true);
    const res = await leaveService.cancelLeaveAtomic(
      activeUnitId,
      selectedReqForCancel.id,
      user.id,
      cancelReason.trim()
    );
    setCancelling(false);
    showToast(res.message);
    setCancelModalOpen(false);
    setSelectedReqForCancel(null);
    setCancelReason('');
    loadData();
  };

  const filtered = requests.filter((req) => statusFilter === 'ALL' || req.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
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
              <CalendarDays className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Manajemen Cuti Karyawan</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Permohonan cuti bulanan unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        <div className="bg-amber-50 text-amber-800 border border-amber-200 px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Aturan Jendela: Pengajuan dibuka tgl 1 (M-1) s.d. tgl 3 (M). Admin 3: Hanya Hari Minggu.</span>
        </div>
      </div>

      {/* Fixture Alert Banner */}
      {isFixture && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Zero-State Preview Mode:</strong> Belum ada permohonan cuti aktif di database Production. Data di bawah ini adalah sampel pratinjau terisolasi.
            </span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === st
                ? 'bg-kuk-maroon text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {st === 'ALL' ? 'Semua Status' : st}
          </button>
        ))}
      </div>

      {/* Request List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat permohonan cuti...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Tidak ada pengajuan cuti</p>
            <p className="text-xs text-gray-400 mt-1">Belum ada pengajuan cuti untuk filter ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((req) => (
              <div key={req.id} className="p-5 hover:bg-gray-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900">{req.snapshot_employee_name}</span>
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {req.request_number}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        req.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : req.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : req.status === 'CANCELLED'
                          ? 'bg-gray-100 text-gray-700 border border-gray-300'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {req.status === 'APPROVED' && <CheckCircle className="w-3 h-3" />}
                      {req.status === 'PENDING' && <Clock className="w-3 h-3" />}
                      {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                      {req.status === 'CANCELLED' && <Ban className="w-3 h-3" />}
                      <span>{req.status}</span>
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    {req.snapshot_department_name} • {req.snapshot_position_title} • Target Bulan: <span className="font-semibold text-gray-700">{req.target_month}</span> ({req.total_days} Hari)
                  </div>

                  {req.dates && req.dates.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {req.dates.map((d) => (
                        <span key={d.id} className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${d.is_sunday ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                          {d.leave_date} {d.is_sunday ? '(Minggu)' : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 mt-2 max-w-2xl">
                    <span className="font-semibold text-gray-700">Alasan: </span>
                    {req.reason}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasPermission('leave.manage', activeUnitId) && req.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(req.id, 'APPROVED')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Setujui</span>
                      </button>
                      <button
                        onClick={() => handleStatusChange(req.id, 'REJECTED')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Tolak</span>
                      </button>
                    </>
                  )}

                  {hasPermission('leave.manage', activeUnitId) && req.status === 'APPROVED' && (
                    <button
                      onClick={() => {
                        setSelectedReqForCancel(req);
                        setCancelModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-rose-50 hover:text-rose-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Batalkan Cuti (Atomic)</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Leave Atomic Modal */}
      {cancelModalOpen && selectedReqForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-white" />
                <h2 className="font-bold text-sm">Batalkan Cuti Resmi (Atomic RPC)</h2>
              </div>
              <button onClick={() => setCancelModalOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCancelAtomic} className="p-6 space-y-4">
              <p className="text-xs text-gray-600">
                Membatalkan cuti karyawan <strong>{selectedReqForCancel.snapshot_employee_name}</strong> (No: {selectedReqForCancel.request_number}). Slot kuota kelompok bentrok akan otomatis dilepaskan secara aman di tingkat database kernel.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Alasan Pembatalan Resmi *</label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Tuliskan alasan operasional pembatalan cuti..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {cancelling ? 'Memproses...' : 'Konfirmasi Pembatalan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
