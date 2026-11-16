import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService } from '@/services/dataService';
import type { Employee } from '@/types/models';
import { EmployeeFormModal } from './EmployeeFormModal';
import { EmployeeSensitiveModal } from './EmployeeSensitiveModal';
import { ResetPinModal } from './ResetPinModal';
import { JobHistoryModal } from './JobHistoryModal';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { PrintHeader } from '@/components/common/PrintHeader';
import { exportToCSV } from '@/utils/exportUtils';
import { exportToExcel } from '@/utils/excelUtils';
import { ExcelImportModal } from '@/components/common/ExcelImportModal';
import { PageHeader } from '@/components/ui';
import {
  Users,
  Search,
  Plus,
  Filter,
  ShieldCheck,
  Mail,
  Phone,
  Building2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  History,
  Power,
  ChevronLeft,
  ChevronRight,
  Printer,
  Download,
  X,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';

export const EmployeeListPage: React.FC = () => {
  const { activeUnit, activeUnitId, availableUnits } = useUnit();
  const { hasPermission } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [sensitiveModalOpen, setSensitiveModalOpen] = useState(false);
  const [selectedEmployeeForSensitive, setSelectedEmployeeForSensitive] = useState<Employee | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [selectedEmployeeForPin, setSelectedEmployeeForPin] = useState<Employee | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<Employee | null>(null);

  // Status Change Confirmation Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetEmployeeForStatus, setTargetEmployeeForStatus] = useState<Employee | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Printable Employee Directory Modal
  const [directoryModalOpen, setDirectoryModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Notifications
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!activeUnitId) {
        // Mode Dua Toko (Pusat / Semua Toko): Muat data karyawan dari kedua unit secara paralel
        const targetUnits = availableUnits.length > 0
          ? availableUnits
          : [
              { id: '00000000-0000-0000-0000-000000000001', name: 'TB KUK La Tansa' },
              { id: '00000000-0000-0000-0000-000000000002', name: 'KUK Palen' },
            ];

        const results = await Promise.all(
          targetUnits.map((u) => employeeService.getEmployeesByUnit(u.id))
        );
        const combined = results.flatMap((r) => r.data || []);
        const uniqueEmps = Array.from(new Map(combined.map((e) => [e.id, e])).values());
        setEmployees(uniqueEmps);
        setIsFixture(results.some((r) => r.isFixture));
      } else {
        const res = await employeeService.getEmployeesByUnit(activeUnitId);
        setEmployees(res.data || []);
        setIsFixture(res.isFixture);
        if (!res.success && res.error) {
          setError(res.error);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data karyawan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setPage(1);
  }, [activeUnitId, availableUnits]);

  const showToast = (msg: string, isError = false) => {
    setToast({ text: msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenStatusModal = (emp: Employee) => {
    setTargetEmployeeForStatus(emp);
    setStatusModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!activeUnitId || !targetEmployeeForStatus) return;
    const newStatus = targetEmployeeForStatus.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setStatusUpdating(true);
    const res = await employeeService.updateEmployeeStatus(activeUnitId, targetEmployeeForStatus.id, newStatus);
    setStatusUpdating(false);
    setStatusModalOpen(false);
    setTargetEmployeeForStatus(null);
    showToast(res.message, !res.success);
    if (res.success) {
      loadData();
    }
  };

  const handleExportCSV = () => {
    const headers = ['Kode Karyawan', 'Nama Lengkap', 'Departemen', 'Jabatan', 'Email', 'Telepon', 'Status', 'Tanggal Bergabung'];
    const rows = filtered.map((emp) => [
      emp.employee_code,
      emp.full_name,
      emp.department?.name || '-',
      emp.position?.title || '-',
      emp.email || '-',
      emp.phone || '-',
      emp.status,
      emp.join_date || '-',
    ]);
    exportToCSV(`Master_Karyawan_${activeUnit?.code || 'KUK'}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    showToast(`Berhasil mengekspor ${filtered.length} data karyawan ke CSV.`);
  };

  const handleExportExcel = () => {
    const headers = [
      'Kode Karyawan',
      'Nama Lengkap',
      'Departemen',
      'Jabatan',
      'Email',
      'Telepon',
      'Status',
      'Tanggal Bergabung',
    ];
    const rows = filtered.map((emp) => [
      emp.employee_code,
      emp.full_name,
      emp.department?.name || '-',
      emp.position?.title || '-',
      emp.email || '-',
      emp.phone || '-',
      emp.status,
      emp.join_date || '-',
    ]);
    exportToExcel(
      `Master_Karyawan_${activeUnit?.code || 'KUK'}_${new Date().toISOString().slice(0, 10)}`,
      'Karyawan',
      headers,
      rows
    );
    showToast(`Berhasil mengekspor ${filtered.length} data karyawan ke Excel (.xlsx).`);
  };

  const handleImportEmployees = async (rows: Record<string, any>[]) => {
    const targetUnitId = activeUnitId || '00000000-0000-0000-0000-000000000001';
    let count = 0;

    for (const r of rows) {
      const getVal = (keys: string[]) => {
        for (const k of Object.keys(r)) {
          const lower = k.toLowerCase();
          if (keys.some((target) => lower.includes(target.toLowerCase()))) {
            return String(r[k] !== undefined && r[k] !== null ? r[k] : '').trim();
          }
        }
        return '';
      };

      const fullName = getVal(['nama', 'name']);
      if (!fullName) continue;

      const code = getVal(['kode', 'code', 'nik']) || `EMP-${Date.now().toString().slice(-4)}${count}`;
      const email = getVal(['email']) || `${code.toLowerCase()}@kuk.co.id`;
      const phone = getVal(['telepon', 'phone', 'hp', 'wa']) || '-';
      const statusRaw = getVal(['status']) || 'TETAP';
      const joinDate = getVal(['tanggal', 'join', 'masuk']) || new Date().toISOString().slice(0, 10);

      const status = statusRaw.toUpperCase().includes('KONTRAK')
        ? 'KONTRAK'
        : statusRaw.toUpperCase().includes('PROBATION')
        ? 'PROBATION'
        : 'TETAP';

      await employeeService.saveEmployee(targetUnitId, {
        employee_code: code,
        full_name: fullName,
        email,
        phone,
        status: status as any,
        join_date: joinDate,
      });
      count++;
    }

    await loadData();
    return {
      success: true,
      message: `Berhasil mengimpor ${count} data karyawan ke unit kerja.`,
      count,
    };
  };

  const filtered = employees.filter((emp) => {
    const matchSearch =
      emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      (emp.department?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || emp.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedEmployees = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm animate-in slide-in-from-bottom duration-200 ${
          toast.isError ? 'bg-red-900 border border-red-700' : 'bg-gray-900'
        }`}>
          {toast.isError ? <AlertCircle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header Halaman */}
      <PageHeader
        title="Master Data Karyawan"
        subtitle={`Daftar karyawan operasional unit kerja ${activeUnit?.name || 'Unit Aktif'}`}
        icon={<Users className="w-6 h-6 text-kuk-maroon" />}
        breadcrumbs={[{ label: 'Beranda', href: '/dashboard' }, { label: 'Karyawan' }]}
        unitBadge={activeUnit?.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              title="Ekspor data karyawan ke format Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Ekspor Excel</span>
            </button>

            {hasPermission('employees.create', activeUnitId) && (
              <button
                onClick={() => setImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
                title="Impor data karyawan massal dari file Excel (.xlsx / .csv)"
              >
                <Upload className="w-3.5 h-3.5 text-kuk-maroon" />
                <span>Import Excel</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              title="Ekspor ke format CSV"
            >
              <Download className="w-3.5 h-3.5 text-kuk-maroon" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              onClick={() => setDirectoryModalOpen(true)}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              title="Buka tampilan cetak daftar induk karyawan"
            >
              <Printer className="w-3.5 h-3.5 text-kuk-maroon" />
              <span className="hidden sm:inline">Cetak Rekap</span>
            </button>

            {hasPermission('employees.create', activeUnitId) && (
              <button
                onClick={() => {
                  setEmployeeToEdit(null);
                  setFormOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-kuk-maroon text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-kuk-maroon-dark shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Karyawan</span>
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
              <strong>Zero-State Preview Mode:</strong> Mode simulasi aktif. Data di bawah ini adalah sampel pratinjau terisolasi dan tidak tersimpan di database Production.
            </span>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama, NIP, atau departemen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif (ACTIVE)</option>
            <option value="INACTIVE">Non-Aktif (INACTIVE)</option>
            <option value="RESIGNED">Resigned</option>
          </select>
        </div>
      </div>

      {/* Table Data */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            <div className="animate-spin w-8 h-8 border-2 border-kuk-maroon border-t-transparent rounded-full mx-auto mb-3"></div>
            Memuat data karyawan...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Tidak ada data karyawan ditemukan</p>
            <p className="text-xs text-gray-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter status</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                <tr>
                  <th className="px-5 py-3">Karyawan</th>
                  <th className="px-5 py-3">Departemen & Jabatan</th>
                  <th className="px-5 py-3">Kontak</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-gray-900 text-sm">{emp.full_name}</div>
                      <div className="font-mono text-[11px] text-gray-400 mt-0.5">{emp.employee_code}</div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 font-medium text-gray-800">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        <span>{emp.department?.name || 'Umum'}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{emp.position?.title || 'Staf Operasional'}</div>
                    </td>

                    <td className="px-5 py-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Mail className="w-3 h-3 text-gray-400" />
                        <span className="truncate max-w-[150px]">{emp.email}</span>
                      </div>
                      {emp.phone && (
                        <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{emp.phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {emp.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        <span>{emp.status}</span>
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Info Umum */}
                        {(hasPermission('employees.update', activeUnitId) || hasPermission('employees.edit', activeUnitId)) && (
                          <button
                            onClick={() => {
                              setEmployeeToEdit(emp);
                              setFormOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-kuk-maroon hover:bg-kuk-maroon-50 rounded-lg transition-colors"
                            title="Edit Data Karyawan"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Reset PIN Kiosk */}
                        {(hasPermission('employees.update', activeUnitId) || hasPermission('employees.edit', activeUnitId)) && (
                          <button
                            onClick={() => {
                              setSelectedEmployeeForPin(emp);
                              setPinModalOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Reset PIN Mandiri"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}

                        {/* Riwayat Mutasi Jabatan */}
                        <button
                          onClick={() => {
                            setSelectedEmployeeForHistory(emp);
                            setHistoryModalOpen(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Riwayat Mutasi Jabatan"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        {/* Data Sensitif NIK & Bank (Super Admin) */}
                        {hasPermission('employees.view_sensitive', activeUnitId) && (
                          <button
                            onClick={() => {
                              setSelectedEmployeeForSensitive(emp);
                              setSensitiveModalOpen(true);
                            }}
                            className="p-1.5 text-kuk-gold hover:text-kuk-gold-dark hover:bg-amber-50 rounded-lg transition-colors"
                            title="Lihat Data Sensitif (NIK / Bank)"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}

                        {/* Toggle Status Aktif / Non-Aktif via ConfirmModal */}
                        {(hasPermission('employees.update', activeUnitId) || hasPermission('employees.edit', activeUnitId)) && (
                          <button
                            onClick={() => handleOpenStatusModal(emp)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              emp.status === 'ACTIVE'
                                ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={emp.status === 'ACTIVE' ? 'Nonaktifkan Karyawan' : 'Aktifkan Kembali Karyawan'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filtered.length > pageSize && (
          <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
            <div>
              Menampilkan {Math.min(filtered.length, (page - 1) * pageSize + 1)} - {Math.min(filtered.length, page * pageSize)} dari {filtered.length} karyawan
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold px-2 py-1">Halaman {page} dari {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Employee Status Toggle */}
      {targetEmployeeForStatus && (
        <ConfirmModal
          isOpen={statusModalOpen}
          title={
            targetEmployeeForStatus.status === 'ACTIVE'
              ? 'Konfirmasi Penonaktifan Karyawan'
              : 'Konfirmasi Pengaktifan Kembali'
          }
          message={`Apakah Anda yakin ingin ${
            targetEmployeeForStatus.status === 'ACTIVE' ? 'menonaktifkan' : 'mengaktifkan kembali'
          } karyawan "${targetEmployeeForStatus.full_name}" (${targetEmployeeForStatus.employee_code})? ${
            targetEmployeeForStatus.status === 'ACTIVE'
              ? 'Karyawan non-aktif tidak akan dapat melakukan presensi atau login ke portal, namun seluruh riwayat penggajian dan transaksi tetap tersimpan utuh.'
              : 'Karyawan akan kembali aktif dalam operasional unit kerja.'
          }`}
          confirmLabel={targetEmployeeForStatus.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
          cancelLabel="Batal"
          variant={targetEmployeeForStatus.status === 'ACTIVE' ? 'danger' : 'primary'}
          isLoading={statusUpdating}
          onConfirm={handleConfirmStatusChange}
          onCancel={() => {
            setStatusModalOpen(false);
            setTargetEmployeeForStatus(null);
          }}
        />
      )}

      {/* Modal Cetak Rekap Karyawan Unit */}
      {directoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-3.5 bg-gray-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-kuk-gold" />
                <span className="font-bold text-sm">Daftar Induk Karyawan — {activeUnit?.name || 'Unit Operasional'}</span>
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
                  onClick={() => setDirectoryModalOpen(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 text-xs bg-white text-gray-800">
              <PrintHeader
                title="DAFTAR INDUK KARYAWAN"
                documentNumber={`DIK/${activeUnit?.code || 'KUK'}/${new Date().getFullYear()}`}
                unitName={activeUnit?.name}
                unitCode={activeUnit?.code}
              />

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-bold uppercase border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2.5">No</th>
                      <th className="px-3 py-2.5">NIP</th>
                      <th className="px-3 py-2.5">Nama Lengkap</th>
                      <th className="px-3 py-2.5">Departemen</th>
                      <th className="px-3 py-2.5">Jabatan</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Tgl Masuk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((emp, idx) => (
                      <tr key={emp.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-500 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900">{emp.employee_code}</td>
                        <td className="px-3 py-2 font-semibold text-gray-900">{emp.full_name}</td>
                        <td className="px-3 py-2 text-gray-700">{emp.department?.name || 'Umum'}</td>
                        <td className="px-3 py-2 text-gray-600">{emp.position?.title || 'Staf Operasional'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            emp.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500">{emp.join_date || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-200 text-center">
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Dibuat & Diverifikasi Oleh:</div>
                  <div className="border-b border-gray-300 w-36 mx-auto"></div>
                  <div className="font-bold text-gray-800">Personalia / HRD Unit</div>
                </div>
                <div className="space-y-12">
                  <div className="text-gray-500 text-[11px]">Mengetahui & Menyetujui:</div>
                  <div className="border-b border-gray-300 w-36 mx-auto"></div>
                  <div className="font-bold text-gray-800">Kepala Toko / Manager</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Modals */}
      <EmployeeFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
          loadData();
        }}
        employeeToEdit={employeeToEdit}
      />

      {selectedEmployeeForSensitive && (
        <EmployeeSensitiveModal
          isOpen={sensitiveModalOpen}
          onClose={() => {
            setSensitiveModalOpen(false);
            setSelectedEmployeeForSensitive(null);
          }}
          employee={selectedEmployeeForSensitive}
          onSuccess={(msg) => {
            showToast(msg);
            loadData();
          }}
        />
      )}

      {selectedEmployeeForPin && (
        <ResetPinModal
          isOpen={pinModalOpen}
          onClose={() => {
            setPinModalOpen(false);
            setSelectedEmployeeForPin(null);
          }}
          employee={selectedEmployeeForPin}
          unitId={activeUnitId || ''}
          onSuccess={(msg) => {
            showToast(msg);
            loadData();
          }}
        />
      )}

      {selectedEmployeeForHistory && (
        <JobHistoryModal
          isOpen={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setSelectedEmployeeForHistory(null);
          }}
          employee={selectedEmployeeForHistory}
          unitId={activeUnitId || ''}
        />
      )}

      {/* Modal Import Excel Karyawan */}
      <ExcelImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Data Karyawan dari Excel"
        subtitle="Masukkan data karyawan massal ke unit kerja aktif menggunakan spreadsheet (.xlsx, .csv)."
        templateFilename={`Template_Import_Karyawan_${activeUnit?.code || 'KUK'}`}
        templateSheetName="MasterKaryawan"
        templateHeaders={[
          'Kode Karyawan',
          'Nama Lengkap',
          'Departemen',
          'Jabatan',
          'Email',
          'Telepon',
          'Status Kerja',
          'Tanggal Masuk',
        ]}
        templateSampleRows={[
          ['EMP-001', 'Ahmad Rizky Pratama', 'Operasional', 'Staf Kaca', 'rizky@kuk.co.id', '081234567891', 'TETAP', '2024-01-10'],
          ['EMP-002', 'Budi Santoso', 'Gudang', 'Checker', 'budi@kuk.co.id', '081234567892', 'KONTRAK', '2024-02-01'],
        ]}
        onImport={handleImportEmployees}
      />
    </div>
  );
};
