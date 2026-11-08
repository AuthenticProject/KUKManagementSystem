import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { leaveService } from '@/services/dataService';
import type { LeaveRequest } from '@/types/models';
import { CreateLeaveModal } from './CreateLeaveModal';
import { CalendarDays, CheckCircle, Clock, XCircle, AlertCircle, Ban, CheckCircle2, UserCheck, Plus, FileSpreadsheet, Users, Sparkles } from 'lucide-react';

export const LeaveListPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { user, hasPermission } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [toast, setToast] = useState<string | null>(null);

  // Tab: Requests vs Monthly HR Recap
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'RECAP'>('REQUESTS');
  const [recapMonth, setRecapMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [recapData, setRecapData] = useState<any[]>([]);
  const [recapLoading, setRecapLoading] = useState<boolean>(false);

  // Create Leave Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Cancellation Modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReqForCancel, setSelectedReqForCancel] = useState<LeaveRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    setError(null);
    const res = await leaveService.getLeaveRequestsByUnit(activeUnitId);
    setRequests(res.data);
    setIsFixture(res.isFixture);
    if (!res.success && res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  const loadRecap = async () => {
    if (!activeUnitId) return;
    setRecapLoading(true);
    const res = await leaveService.getLeaveRecapByUnit(activeUnitId, recapMonth);
    setRecapData(res.data || []);
    setRecapLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId]);

  useEffect(() => {
    if (activeTab === 'RECAP') {
      loadRecap();
    }
  }, [activeUnitId, recapMonth, activeTab]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleExportRecapCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Bulan,Kode Karyawan,Nama Karyawan,Bagian,Jabatan,Kuota Bulanan,Hari Digunakan,Sisa Kuota,Status Kuota,Tanggal Terjadwal\n';
    recapData.forEach((r) => {
      const datesStr = (r.recorded_dates || []).join('; ');
      csvContent += `"${r.target_month}","${r.employee_code}","${r.employee_name}","${r.department_name}","${r.position_title}","${r.quota_monthly}","${r.days_used}","${r.days_remaining}","${r.quota_status}","${datesStr}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Cuti_HR_${activeUnit?.code || 'KUK'}_${recapMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-amber-50 text-amber-800 border border-amber-200 px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Aturan Jendela: Pengajuan dibuka tgl 1 (M-1) s.d. tgl 3 (M). Admin 3: Hanya Hari Minggu.</span>
          </div>
          {hasPermission('leave.manage') && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-3.5 py-1.5 bg-kuk-maroon hover:bg-kuk-maroon-800 text-white font-medium text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Ajukan Cuti Staf</span>
            </button>
          )}
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
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Zero-State Preview Mode:</strong> Mode simulasi aktif. Data di bawah ini adalah sampel pratinjau terisolasi dan tidak tersimpan di database Production.
            </span>
          </div>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setActiveTab('REQUESTS')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'REQUESTS'
              ? 'border-kuk-maroon text-kuk-maroon'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Daftar Permohonan Cuti</span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{requests.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('RECAP')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'RECAP'
              ? 'border-kuk-maroon text-kuk-maroon'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Rekap Kuota Bulanan HR</span>
          <span className="text-xs bg-kuk-maroon-50 text-kuk-maroon px-2 py-0.5 rounded-full font-bold">Maks 3 Hari</span>
        </button>
      </div>

      {activeTab === 'RECAP' ? (
        /* REKAP KUOTA BULANAN HR */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Rekapitulasi Kuota Cuti Karyawan per Bulan</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Monitoring kuota cuti (Maksimal 3 hari kalender per bulan) unit {activeUnit?.name || ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="month"
                value={recapMonth}
                onChange={(e) => setRecapMonth(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon font-semibold text-gray-700"
              />
              <button
                onClick={handleExportRecapCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ekspor CSV</span>
              </button>
            </div>
          </div>

          {recapLoading ? (
            <div className="text-center py-8 text-xs text-gray-400">Memuat rekap kuota cuti...</div>
          ) : recapData.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">Tidak ada data karyawan aktif ditemukan</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Karyawan & Kode</th>
                    <th className="px-4 py-2.5">Bagian</th>
                    <th className="px-4 py-2.5 text-center">Kuota Bulanan</th>
                    <th className="px-4 py-2.5 text-center">Terpakai</th>
                    <th className="px-4 py-2.5 text-center">Sisa Kuota</th>
                    <th className="px-4 py-2.5">Status Kuota</th>
                    <th className="px-4 py-2.5">Tanggal Cuti Terjadwal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recapData.map((r) => (
                    <tr key={r.employee_id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{r.employee_name}</div>
                        <div className="font-mono text-[10px] text-gray-400">{r.employee_code}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.department_name}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-700">3 Hari</td>
                      <td className="px-4 py-3 text-center font-bold text-kuk-maroon">{r.days_used} Hari</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">{r.days_remaining} Hari</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            r.quota_status === 'EXHAUSTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : r.days_used > 0
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {r.quota_status === 'EXHAUSTED' ? 'Kuota Habis' : r.days_used > 0 ? 'Sebagian Terpakai' : 'Utuh Tersedia'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.recorded_dates && r.recorded_dates.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.recorded_dates.map((d: string) => (
                              <span key={d} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px]">
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">- Belum ada cuti -</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* DAFTAR PERMOHONAN CUTI */
        <>
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
                        {req.auto_approved && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-kuk-gold/15 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>Auto-Approved</span>
                          </span>
                        )}
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
        </>
      )}

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

      {/* Create Leave Modal */}
      {createModalOpen && activeUnitId && (
        <CreateLeaveModal
          isOpen={createModalOpen}
          unitId={activeUnitId}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={(msg?: string) => {
            showToast(msg || 'Pengajuan cuti staf berhasil disimpan.');
            loadData();
          }}
        />
      )}
    </div>
  );
};
