import React, { useEffect, useState, useMemo } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { leaveService, employeeService } from '@/services/dataService';
import type { LeaveRequest, Employee } from '@/types/models';
import { CreateLeaveModal } from './CreateLeaveModal';
import { PrintHeader } from '@/components/common/PrintHeader';
import { exportToCSV } from '@/utils/exportUtils';
import { exportToExcel } from '@/utils/excelUtils';
import { PageHeader } from '@/components/ui';
import {
  CalendarDays,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Ban,
  CheckCircle2,
  Plus,
  FileSpreadsheet,
  Users,
  Sparkles,
  Printer,
  Download,
  X,
  Calendar,
  Grid,
} from 'lucide-react';

export const LeaveListPage: React.FC = () => {
  const { activeUnit, activeUnitId, availableUnits } = useUnit();
  const { user, hasPermission } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [toast, setToast] = useState<string | null>(null);

  // Tab: Requests vs Matrix Calendar vs Monthly HR Recap
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'MATRIX' | 'RECAP'>('REQUESTS');
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

  // Printable Leave Form Modal state
  const [leaveFormModalOpen, setLeaveFormModalOpen] = useState(false);
  const [selectedReqForPrint, setSelectedReqForPrint] = useState<LeaveRequest | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!activeUnitId) {
        // Mode Dua Toko (Pusat / Semua Toko): Muat data cuti & karyawan dari kedua unit secara paralel
        const targetUnits =
          availableUnits.length > 0
            ? availableUnits
            : [
                { id: '00000000-0000-0000-0000-000000000001', name: 'TB KUK La Tansa' },
                { id: '00000000-0000-0000-0000-000000000002', name: 'KUK Palen' },
              ];

        const [leaveResList, empResList] = await Promise.all([
          Promise.all(targetUnits.map((u) => leaveService.getLeaveRequestsByUnit(u.id))),
          Promise.all(targetUnits.map((u) => employeeService.getEmployeesByUnit(u.id))),
        ]);

        const combinedRequests = leaveResList.flatMap((r) => r.data || []);
        const uniqueRequests = Array.from(new Map(combinedRequests.map((r) => [r.id, r])).values());
        setRequests(uniqueRequests);

        const combinedEmps = empResList.flatMap((r) => r.data || []);
        const uniqueEmps = Array.from(new Map(combinedEmps.map((e) => [e.id, e])).values());
        setEmployees(uniqueEmps.filter((e) => e.status === 'ACTIVE'));
        setIsFixture(leaveResList.some((r) => r.isFixture) || empResList.some((r) => r.isFixture));
      } else {
        const [res, empRes] = await Promise.all([
          leaveService.getLeaveRequestsByUnit(activeUnitId),
          employeeService.getEmployeesByUnit(activeUnitId),
        ]);
        setRequests(res.data || []);
        setEmployees(empRes.data.filter((e) => e.status === 'ACTIVE'));
        setIsFixture(res.isFixture || empRes.isFixture);
        if (!res.success && res.error) {
          setError(res.error);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data cuti.');
    } finally {
      setLoading(false);
    }
  };

  const loadRecap = async () => {
    setRecapLoading(true);
    try {
      if (!activeUnitId) {
        const targetUnits =
          availableUnits.length > 0
            ? availableUnits
            : [
                { id: '00000000-0000-0000-0000-000000000001', name: 'TB KUK La Tansa' },
                { id: '00000000-0000-0000-0000-000000000002', name: 'KUK Palen' },
              ];
        const recapResList = await Promise.all(
          targetUnits.map((u) => leaveService.getLeaveRecapByUnit(u.id, recapMonth))
        );
        const combinedRecap = recapResList.flatMap((r) => r.data || []);
        setRecapData(combinedRecap);
      } else {
        const res = await leaveService.getLeaveRecapByUnit(activeUnitId, recapMonth);
        setRecapData(res.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load recap:', err);
    } finally {
      setRecapLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeUnitId, availableUnits]);

  useEffect(() => {
    if (activeTab === 'RECAP') {
      loadRecap();
    }
  }, [activeUnitId, availableUnits, recapMonth, activeTab]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Matrix calculation: Days in recapMonth
  const matrixDays = useMemo(() => {
    const [y, m] = recapMonth.split('-').map(Number);
    const totalDays = new Date(y, m, 0).getDate();
    const days: Array<{ dayNum: number; dateKey: string; isSunday: boolean; dayName: string }> = [];

    const dayShortNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dObj = new Date(y, m - 1, d);
      days.push({
        dayNum: d,
        dateKey,
        isSunday: dObj.getDay() === 0,
        dayName: dayShortNames[dObj.getDay()],
      });
    }
    return days;
  }, [recapMonth]);

  // Lookup map: [employee_id] -> Set of approved dates & Set of pending dates
  const leaveMatrixMap = useMemo(() => {
    const approvedMap: Record<string, Set<string>> = {};
    const pendingMap: Record<string, Set<string>> = {};

    requests.forEach((req) => {
      const empId = req.employee_id;
      if (!approvedMap[empId]) approvedMap[empId] = new Set();
      if (!pendingMap[empId]) pendingMap[empId] = new Set();

      if (Array.isArray(req.dates)) {
        req.dates.forEach((d) => {
          const dateStr = typeof d === 'string' ? d : d.leave_date;
          if (dateStr && dateStr.startsWith(recapMonth)) {
            if (req.status === 'APPROVED') {
              approvedMap[empId].add(dateStr);
            } else if (req.status === 'PENDING') {
              pendingMap[empId].add(dateStr);
            }
          }
        });
      }
    });

    return { approvedMap, pendingMap };
  }, [requests, recapMonth]);

  // Daily totals for matrix bottom row
  const matrixDailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    matrixDays.forEach((day) => {
      let count = 0;
      employees.forEach((emp) => {
        if (leaveMatrixMap.approvedMap[emp.id]?.has(day.dateKey)) {
          count++;
        }
      });
      totals[day.dateKey] = count;
    });
    return totals;
  }, [matrixDays, employees, leaveMatrixMap]);

  const handleExportRecapCSV = () => {
    const headers = [
      'Bulan',
      'Kode Karyawan',
      'Nama Karyawan',
      'Bagian',
      'Jabatan',
      'Kuota Bulanan',
      'Hari Digunakan',
      'Sisa Kuota',
      'Status Kuota',
      'Tanggal Terjadwal',
    ];
    const rows = recapData.map((r) => [
      r.target_month,
      r.employee_code,
      r.employee_name,
      r.department_name,
      r.position_title,
      r.quota_monthly,
      r.days_used,
      r.days_remaining,
      r.quota_status,
      (r.recorded_dates || []).join('; '),
    ]);
    exportToCSV(`Rekap_Cuti_HR_${activeUnit?.code || 'KUK'}_${recapMonth}`, headers, rows);
  };

  const handleExportRecapExcel = () => {
    const headers = [
      'Bulan',
      'Kode Karyawan',
      'Nama Karyawan',
      'Bagian',
      'Jabatan',
      'Kuota Bulanan',
      'Hari Digunakan',
      'Sisa Kuota',
      'Status Kuota',
      'Tanggal Terjadwal',
    ];
    const rows = recapData.map((r) => [
      r.target_month,
      r.employee_code,
      r.employee_name,
      r.department_name,
      r.position_title,
      r.quota_monthly,
      r.days_used,
      r.days_remaining,
      r.quota_status,
      (r.recorded_dates || []).join('; '),
    ]);
    exportToExcel(`Rekap_Cuti_HR_${activeUnit?.code || 'KUK'}_${recapMonth}`, 'Rekap Kuota Cuti', headers, rows);
    showToast(`Berhasil mengekspor rekap kuota cuti (${recapData.length} data) ke Excel.`);
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

  const handleExportCSV = () => {
    const headers = [
      'Kode Permohonan',
      'Nama Karyawan',
      'Departemen',
      'Jabatan',
      'Target Bulan',
      'Jumlah Hari',
      'Tanggal Cuti',
      'Alasan',
      'Status',
    ];
    const rows = filtered.map((r) => [
      r.id,
      r.snapshot_employee_name,
      r.snapshot_department_name,
      r.snapshot_position_title,
      r.target_month,
      r.total_days,
      r.dates?.map((d) => (typeof d === 'string' ? d : d.leave_date)).join('; ') || '-',
      r.reason || '-',
      r.status,
    ]);
    exportToCSV(`Rekap_Cuti_${activeUnit?.code || 'KUK'}_${recapMonth}`, headers, rows);
    showToast(`Berhasil mengekspor ${filtered.length} permohonan cuti.`);
  };

  const handleExportExcel = () => {
    const headers = [
      'Kode Permohonan',
      'Nama Karyawan',
      'Departemen',
      'Jabatan',
      'Target Bulan',
      'Jumlah Hari',
      'Tanggal Cuti',
      'Alasan',
      'Status',
    ];
    const rows = filtered.map((r) => [
      r.id,
      r.snapshot_employee_name,
      r.snapshot_department_name,
      r.snapshot_position_title,
      r.target_month,
      r.total_days,
      r.dates?.map((d) => (typeof d === 'string' ? d : d.leave_date)).join(', ') || '-',
      r.reason || '-',
      r.status,
    ]);
    exportToExcel(`Rekap_Cuti_${activeUnit?.code || 'KUK'}_${recapMonth}`, 'Permohonan Cuti', headers, rows);
    showToast(`Berhasil mengekspor ${filtered.length} permohonan cuti ke Excel.`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header Halaman */}
      <PageHeader
        title="Manajemen Cuti Karyawan"
        subtitle={`Permohonan cuti bulanan & kuota operasional unit ${activeUnit?.name || 'Unit Aktif'}`}
        icon={<CalendarDays className="w-6 h-6 text-kuk-maroon" />}
        breadcrumbs={[{ label: 'Beranda', href: '/dashboard' }, { label: 'Manajemen Cuti' }]}
        unitBadge={activeUnit?.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              title="Ekspor ke Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Ekspor Excel</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              title="Ekspor ke CSV"
            >
              <Download className="w-3.5 h-3.5 text-kuk-maroon" />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </button>

            {hasPermission('leave.manage') && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 bg-kuk-maroon hover:bg-kuk-maroon-dark text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Ajukan Cuti Staf</span>
              </button>
            )}
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
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Zero-State Preview Mode:</strong> Mode simulasi aktif. Data permohonan cuti tersimpan di penyimpanan preview lokal terisolasi.
            </span>
          </div>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex border-b border-gray-200 gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('REQUESTS')}
          className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
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
          onClick={() => setActiveTab('MATRIX')}
          className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
            activeTab === 'MATRIX'
              ? 'border-kuk-maroon text-kuk-maroon'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Matriks Jadwal Cuti (1–31 Hari)</span>
          <span className="text-xs bg-kuk-gold/20 text-kuk-maroon px-2 py-0.5 rounded-full font-bold">
            Kalender Tim
          </span>
        </button>

        <button
          onClick={() => setActiveTab('RECAP')}
          className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
            activeTab === 'RECAP'
              ? 'border-kuk-maroon text-kuk-maroon'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Rekap Kuota Bulanan HR</span>
          <span className="text-xs bg-kuk-maroon-50 text-kuk-maroon px-2 py-0.5 rounded-full font-bold">
            Maks 3 Hari
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB: MATRIKS JADWAL CUTI SELURUH KARYAWAN (1–31 HARI)                    */}
      {/* ========================================================================= */}
      {activeTab === 'MATRIX' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4 animate-in fade-in duration-200">
          {/* Header Controls & Legend */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-kuk-maroon" />
                <span>Matriks Distribusi Cuti Karyawan — Bulan {recapMonth}</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Peta jadwal libur seluruh staf unit {activeUnit?.name || ''} untuk memantau kecukupan operasional toko.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="month"
                value={recapMonth}
                onChange={(e) => setRecapMonth(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon font-bold text-gray-800 bg-white shadow-2xs"
              />

              {/* Legend Badges */}
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="px-2 py-1 bg-emerald-600 text-white rounded-md shadow-2xs">
                  🟢 Disetujui
                </span>
                <span className="px-2 py-1 bg-amber-500 text-white rounded-md shadow-2xs">
                  🟡 Menunggu
                </span>
                <span className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
                  Min = Libur / Admin 3
                </span>
              </div>
            </div>
          </div>

          {/* Matrix Table */}
          {employees.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              Tidak ada data karyawan aktif pada unit ini.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-2xs">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="bg-gray-100/80 text-gray-700 uppercase font-bold text-[11px] border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left sticky left-0 bg-gray-100 z-10 min-w-[200px] border-r border-gray-200 shadow-xs">
                      Karyawan & Bagian
                    </th>
                    {matrixDays.map((d) => (
                      <th
                        key={d.dateKey}
                        className={`px-1.5 py-2.5 min-w-[34px] border-r border-gray-200 text-center ${
                          d.isSunday ? 'bg-rose-50 text-rose-700' : ''
                        }`}
                      >
                        <div className="text-[10px] opacity-70 font-semibold">{d.dayName}</div>
                        <div className="text-xs font-black">{d.dayNum}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp) => {
                    const approvedSet = leaveMatrixMap.approvedMap[emp.id] || new Set();
                    const pendingSet = leaveMatrixMap.pendingMap[emp.id] || new Set();

                    return (
                      <tr key={emp.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* Sticky Employee Name Column */}
                        <td className="px-4 py-2.5 text-left sticky left-0 bg-white hover:bg-gray-50 z-10 border-r border-gray-200 shadow-xs">
                          <div className="font-bold text-gray-900">{emp.full_name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {emp.employee_code} • {emp.position?.title || emp.department?.name || 'Staf'}
                          </div>
                        </td>

                        {/* Day Columns */}
                        {matrixDays.map((d) => {
                          const isApproved = approvedSet.has(d.dateKey);
                          const isPending = pendingSet.has(d.dateKey);

                          return (
                            <td
                              key={d.dateKey}
                              className={`p-1 border-r border-gray-100 text-center ${
                                d.isSunday ? 'bg-rose-50/30' : ''
                              }`}
                            >
                              {isApproved ? (
                                <span
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600 text-white font-extrabold text-[10px] shadow-xs cursor-default"
                                  title={`Cuti Disetujui: ${emp.full_name} (${d.dateKey})`}
                                >
                                  C
                                </span>
                              ) : isPending ? (
                                <span
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500 text-white font-extrabold text-[10px] shadow-xs cursor-default"
                                  title={`Menunggu Review: ${emp.full_name} (${d.dateKey})`}
                                >
                                  ?
                                </span>
                              ) : (
                                <span className="text-gray-300 select-none">·</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Bottom Total Row */}
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold text-xs">
                  <tr>
                    <td className="px-4 py-2.5 text-left sticky left-0 bg-gray-50 z-10 border-r border-gray-200 text-gray-800">
                      Total Personel Cuti / Hari
                    </td>
                    {matrixDays.map((d) => {
                      const totalOnDate = matrixDailyTotals[d.dateKey] || 0;
                      return (
                        <td
                          key={`total-${d.dateKey}`}
                          className={`px-1 py-2 text-center border-r border-gray-200 ${
                            totalOnDate >= 2
                              ? 'bg-amber-100 text-amber-900 font-black'
                              : totalOnDate > 0
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'text-gray-400'
                          }`}
                        >
                          {totalOnDate > 0 ? totalOnDate : '-'}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: REKAP KUOTA BULANAN HR                                              */}
      {/* ========================================================================= */}
      {activeTab === 'RECAP' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4 animate-in fade-in duration-200">
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
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon font-semibold text-gray-700 bg-white"
              />
              <button
                onClick={handleExportRecapExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                title="Ekspor ke Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ekspor Excel</span>
              </button>
              <button
                onClick={handleExportRecapCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold transition-colors"
              >
                <Download className="w-4 h-4 text-kuk-maroon" />
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
                          {r.quota_status === 'EXHAUSTED'
                            ? 'Kuota Habis'
                            : r.days_used > 0
                            ? 'Sebagian Terpakai'
                            : 'Utuh Tersedia'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.recorded_dates && r.recorded_dates.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.recorded_dates.map((d: string) => (
                              <span
                                key={d}
                                className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px]"
                              >
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
      )}

      {/* ========================================================================= */}
      {/* TAB: DAFTAR PERMOHONAN CUTI                                              */}
      {/* ========================================================================= */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  statusFilter === st ? 'bg-kuk-maroon text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {st === 'ALL' ? 'Semua Status' : st}
              </button>
            ))}
          </div>

          {/* Request List */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
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
                  <div
                    key={req.id}
                    className="p-5 hover:bg-gray-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
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
                        {req.snapshot_department_name} • {req.snapshot_position_title} • Target Bulan:{' '}
                        <span className="font-semibold text-gray-700">{req.target_month}</span> ({req.total_days}{' '}
                        Hari)
                      </div>

                      {req.dates && req.dates.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {req.dates.map((d) => (
                            <span
                              key={d.id}
                              className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                                d.is_sunday ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
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
                      <button
                        onClick={() => {
                          setSelectedReqForPrint(req);
                          setLeaveFormModalOpen(true);
                        }}
                        className="p-2 text-gray-500 hover:text-kuk-maroon hover:bg-gray-100 rounded-lg transition-colors"
                        title="Cetak Formulir Cuti Resmi"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {hasPermission('leave.manage') && req.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(req.id, 'APPROVED')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                          >
                            Setujui
                          </button>
                          <button
                            onClick={() => handleStatusChange(req.id, 'REJECTED')}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                          >
                            Tolak
                          </button>
                        </>
                      )}

                      {hasPermission('leave.manage') && req.status === 'APPROVED' && (
                        <button
                          onClick={() => {
                            setSelectedReqForCancel(req);
                            setCancelModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-rose-50 text-gray-600 hover:text-rose-700 border border-gray-200 rounded-lg text-xs font-semibold transition-colors"
                          title="Batalkan cuti yang telah disetujui"
                        >
                          Batalkan Cuti
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Pembatalan Cuti Atomik */}
      {cancelModalOpen && selectedReqForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Batalkan Cuti Resmi</h2>
              </div>
              <button
                onClick={() => setCancelModalOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelAtomic} className="p-6 space-y-4">
              <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 text-xs text-rose-800 space-y-1">
                <div>
                  <strong>Karyawan:</strong> {selectedReqForCancel.snapshot_employee_name}
                </div>
                <div>
                  <strong>Periode Cuti:</strong> Bulan {selectedReqForCancel.target_month} (
                  {selectedReqForCancel.total_days} Hari)
                </div>
                <div className="text-[11px] text-rose-700 pt-1 border-t border-rose-200 mt-1">
                  Pembatalan ini akan memulihkan kuota cuti karyawan dan membatalkan reservasi jadwal di sistem.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Alasan Pembatalan Resmi *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Contoh: Karyawan membatalkan rencana perjalanan dinas/keluarga karena ada agenda toko..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {cancelling ? 'Memproses...' : 'Konfirmasi Batalkan Cuti'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Leave Modal */}
      {createModalOpen && (
        <CreateLeaveModal
          isOpen={createModalOpen}
          unitId={activeUnitId || '00000000-0000-0000-0000-000000000001'}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={(msg?: string) => {
            showToast(msg || 'Pengajuan cuti staf berhasil disimpan.');
            loadData();
          }}
        />
      )}

      {/* Modal Cetak Formulir Permohonan Cuti Resmi */}
      {leaveFormModalOpen && selectedReqForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-3.5 bg-gray-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-kuk-gold" />
                <span className="font-bold text-sm">Formulir Cuti — {selectedReqForPrint.snapshot_employee_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-kuk-maroon text-white hover:bg-kuk-maroon-700 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Formulir</span>
                </button>
                <button
                  onClick={() => setLeaveFormModalOpen(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 text-xs bg-white text-gray-800">
              <PrintHeader
                title="SURAT PERMOHONAN CUTI RESMI"
                documentNumber={`CUTI/${selectedReqForPrint.target_month}/${selectedReqForPrint.id.substring(0, 8)}`}
                unitName={activeUnit?.name}
                unitCode={activeUnit?.code}
              />

              <div className="grid grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                <div className="space-y-1">
                  <div className="text-gray-500 text-[11px]">Nama Pemohon (Karyawan):</div>
                  <div className="font-bold text-gray-900 text-sm">{selectedReqForPrint.snapshot_employee_name}</div>
                  <div className="text-gray-600 font-medium">
                    {selectedReqForPrint.snapshot_department_name} • {selectedReqForPrint.snapshot_position_title}
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-gray-500 text-[11px]">Target Periode Cuti:</div>
                  <div className="font-bold text-gray-900 text-sm">Bulan {selectedReqForPrint.target_month}</div>
                  <div>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedReqForPrint.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : selectedReqForPrint.status === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : selectedReqForPrint.status === 'CANCELLED'
                          ? 'bg-gray-100 text-gray-700 border border-gray-300'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      STATUS: {selectedReqForPrint.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail Hari Cuti & Alasan */}
              <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 text-[11px] uppercase font-bold tracking-wider">
                    Tanggal Pengambilan Cuti:
                  </span>
                  <span className="font-bold text-kuk-maroon">{selectedReqForPrint.total_days} Hari Kerja</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedReqForPrint.dates &&
                    selectedReqForPrint.dates.map((d) => (
                      <span
                        key={d.id}
                        className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded font-mono text-xs font-semibold"
                      >
                        {d.leave_date} {d.is_sunday ? '(Hari Minggu)' : ''}
                      </span>
                    ))}
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-1">
                  <span className="text-gray-500 text-[11px] uppercase font-bold tracking-wider">
                    Alasan Permohonan:
                  </span>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-gray-800 text-xs leading-relaxed">
                    {selectedReqForPrint.reason}
                  </div>
                </div>
              </div>

              {/* Note / Disclaimer */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900 text-[11px] space-y-0.5">
                <div className="font-bold">Ketentuan Cuti Perusahaan:</div>
                <div>1. Maksimal hak cuti bulanan yang dapat diajukan adalah 3 (tiga) hari kerja.</div>
                <div>
                  2. Cuti harus diajukan dalam jendela resmi (tanggal 1 bulan sebelumnya s.d. tanggal 3 bulan berjalan).
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200 text-center">
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Pemohon / Karyawan:</div>
                  <div className="border-b border-gray-300 w-28 mx-auto"></div>
                  <div className="font-bold text-gray-800">({selectedReqForPrint.snapshot_employee_name})</div>
                </div>
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Atasan / Supervisor:</div>
                  <div className="border-b border-gray-300 w-28 mx-auto"></div>
                  <div className="font-bold text-gray-800">(Supervisor Unit)</div>
                </div>
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Kepala Toko / HRD:</div>
                  <div className="border-b border-gray-300 w-28 mx-auto"></div>
                  <div className="font-bold text-gray-800">(Manajer Unit)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
