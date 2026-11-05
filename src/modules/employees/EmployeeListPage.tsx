import React, { useEffect, useState } from 'react';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService } from '@/services/dataService';
import type { Employee } from '@/types/models';
import { EmployeeFormModal } from './EmployeeFormModal';
import { EmployeeSensitiveModal } from './EmployeeSensitiveModal';
import { Users, Search, Plus, Filter, ShieldCheck, Mail, Phone, Building2, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';

export const EmployeeListPage: React.FC = () => {
  const { activeUnit, activeUnitId } = useUnit();
  const { hasPermission } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFixture, setIsFixture] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [sensitiveModalOpen, setSensitiveModalOpen] = useState(false);
  const [selectedEmployeeForSensitive, setSelectedEmployeeForSensitive] = useState<Employee | null>(null);

  // Notifications
  const [toast, setToast] = useState<string | null>(null);

  const loadData = async () => {
    if (!activeUnitId) return;
    setLoading(true);
    const res = await employeeService.getEmployeesByUnit(activeUnitId);
    setEmployees(res.data);
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

  const filtered = employees.filter((emp) => {
    const matchSearch =
      emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      (emp.department?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || emp.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-kuk-maroon-50 text-kuk-maroon rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Master Data Karyawan</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Daftar karyawan operasional unit <span className="font-semibold text-kuk-maroon">{activeUnit?.name || 'Unit Aktif'}</span>
          </p>
        </div>

        {hasPermission('employees.create', activeUnitId) && (
          <button
            onClick={() => {
              setEmployeeToEdit(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-kuk-maroon text-white rounded-xl text-sm font-semibold hover:bg-kuk-maroon-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Karyawan</span>
          </button>
        )}
      </div>

      {/* Fixture Alert Banner */}
      {isFixture && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Zero-State Preview Mode:</strong> Database Production saat ini masih dalam kondisi bersih (0 baris karyawan). Data di bawah ini adalah sampel preview lokal dan tidak mencemari database Production.
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

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat data karyawan...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Tidak ada data karyawan ditemukan</p>
            <p className="text-xs text-gray-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-5 py-3.5">Karyawan</th>
                  <th className="px-5 py-3.5">Departemen & Jabatan</th>
                  <th className="px-5 py-3.5">Kontak</th>
                  <th className="px-5 py-3.5">Tipe & Bergabung</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{emp.full_name}</div>
                      <div className="text-xs font-mono text-gray-500 mt-0.5">{emp.employee_code}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-800">{emp.position?.title || 'Belum Ditentukan'}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-gray-400" />
                        <span>{emp.department?.name || 'Tanpa Bagian'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {emp.phone && (
                        <div className="text-xs text-gray-600 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{emp.phone}</span>
                        </div>
                      )}
                      {emp.email && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span>{emp.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                        {emp.employment_type}
                      </span>
                      <div className="text-gray-400 mt-1">Gabung: {emp.join_date}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('employees.update', activeUnitId) && (
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

                        {hasPermission('employees.view_sensitive', activeUnitId) && (
                          <button
                            onClick={() => {
                              setSelectedEmployeeForSensitive(emp);
                              setSensitiveModalOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Data Sensitif (NIK/Rekening)"
                          >
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
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
      </div>

      {/* Modals */}
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
    </div>
  );
};
