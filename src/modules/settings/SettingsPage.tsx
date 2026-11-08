import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { systemService, isPreviewModeActive, setPreviewModeActive } from '@/services/dataService';
import type { UserAccount, BusinessUnit, UserRole } from '@/types/models';
import {
  Settings,
  Users,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Shield,
  Check,
  X,
  Database,
  Sliders,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'USERS' | 'RBAC' | 'UNITS' | 'PREVIEW'>('USERS');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);
  const [previewActive, setPreviewActive] = useState<boolean>(isPreviewModeActive());
  const [error, setError] = useState<string | null>(null);
  const [isFixture, setIsFixture] = useState<boolean>(false);

  const isProduction =
    typeof import.meta !== 'undefined' &&
    ((import.meta as any)?.env?.PROD === true ||
      (import.meta as any)?.env?.VITE_APP_ENV === 'production' ||
      (import.meta as any)?.env?.MODE === 'production');
  const allowInProd =
    typeof import.meta !== 'undefined' &&
    (import.meta as any)?.env?.VITE_ENABLE_PREVIEW_MODE === 'true';
  const isPreviewBlocked = isProduction && !allowInProd;
  const canTogglePreview = isSuperAdmin && !isPreviewBlocked;

  // Edit Role modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('KASIR');
  const [savingRole, setSavingRole] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [uRes, bUnits] = await Promise.all([
      systemService.getUsers(),
      systemService.getUnits(),
    ]);

    setIsFixture(uRes.isFixture);
    if (!uRes.success && uRes.error) {
      setError(uRes.error);
    }

    const mappedUsers = (uRes.data || []).map((u) => {
      const assignedName =
        u.assigned_units && u.assigned_units.length > 0
          ? bUnits.find((b) => b.id === u.assigned_units[0])?.name || 'Unit Terdaftar'
          : 'Semua Unit';

      const defaultRole: UserRole =
        u.system_role === 'super_admin'
          ? 'PIMPINAN'
          : u.system_role === 'central_admin'
          ? 'MANAGER'
          : 'SUPERVISOR';

      return {
        ...u,
        role: u.role || defaultRole,
        unit_name: u.unit_name || assignedName,
        is_active: u.status === 'ACTIVE',
      };
    });

    setUsers(mappedUsers);
    setUnits(bUnits as unknown as BusinessUnit[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenEditRole = (u: UserAccount) => {
    setSelectedUser(u);
    setTargetRole((u.role as UserRole) || 'KASIR');
    setRoleModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSavingRole(true);
    const res = await systemService.saveUserRole(
      selectedUser.id,
      targetRole,
      selectedUser.assigned_units || []
    );
    setSavingRole(false);
    showToast(res.message);
    if (res.success) {
      setRoleModalOpen(false);
      loadData();
    }
  };

  // Matrix Definition
  const permissionsList = [
    { key: 'employees.view', label: 'Lihat Data Karyawan' },
    { key: 'employees.manage', label: 'Kelola Master Karyawan' },
    { key: 'leave.view', label: 'Lihat Pengajuan Cuti' },
    { key: 'leave.manage', label: 'Persetujuan / Pembatalan Cuti' },
    { key: 'glass_tips.view', label: 'Lihat Nota Pemotongan Kaca' },
    { key: 'glass_tips.verify', label: 'Verifikasi Fisik & Nominal Tip' },
    { key: 'attendance.view', label: 'Lihat Presensi Harian' },
    { key: 'attendance.manage', label: 'Koreksi Presensi Manual' },
    { key: 'fleet.view', label: 'Lihat Armada & Jadwal' },
    { key: 'fleet.manage', label: 'Kelola Inventaris Armada' },
    { key: 'fleet.approve_borrowing', label: 'Persetujuan Peminjaman Armada' },
    { key: 'payroll.view', label: 'Lihat Periode & Slip Gaji' },
    { key: 'payroll.manage', label: 'Finalisasi Payroll Atomik' },
    { key: 'audit_logs.view', label: 'Lihat Rekam Jejak Audit' },
    { key: 'settings.manage', label: 'Konfigurasi Sistem & Hak Akses' },
  ];

  const rolePermissionMap: Record<UserRole, string[]> = {
    PIMPINAN: permissionsList.map((p) => p.key),
    MANAGER: permissionsList.map((p) => p.key),
    SUPERVISOR: [
      'employees.view',
      'leave.view',
      'leave.manage',
      'glass_tips.view',
      'glass_tips.verify',
      'attendance.view',
      'attendance.manage',
      'fleet.view',
      'fleet.approve_borrowing',
      'payroll.view',
      'audit_logs.view',
    ],
    KASIR: ['glass_tips.view', 'glass_tips.verify', 'attendance.view', 'fleet.view'],
    CHECKER: ['glass_tips.view', 'glass_tips.verify', 'attendance.view', 'fleet.view'],
    CUTTER: ['glass_tips.view'],
    DRIVER: ['fleet.view'],
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
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Pengaturan Sistem & Hak Akses</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manajemen pengguna sistem, matriks role-based access control (RBAC), dan parameter multi-unit.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'USERS'
              ? 'bg-kuk-maroon text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Pengguna & Akun ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('RBAC')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'RBAC'
              ? 'bg-kuk-maroon text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Matriks Kewenangan RBAC</span>
        </button>

        <button
          onClick={() => setActiveTab('UNITS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'UNITS'
              ? 'bg-kuk-maroon text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Unit Usaha Terdaftar ({units.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PREVIEW')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'PREVIEW'
              ? 'bg-kuk-maroon text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Sumber Data & Pratinjau</span>
          {previewActive && (
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          )}
        </button>
      </div>

      {/* Error Alert Banner */}
      {error && !loading && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Gagal Memuat Pengguna:</strong> {error}
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
            <strong>Zero-State Preview Mode:</strong> Mode simulasi aktif. Pengguna sistem di bawah ini adalah sampel preview lokal terisolasi.
          </span>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'USERS' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-sm text-gray-800">Daftar Akun Pengguna Sistem</h2>
            <span className="text-xs text-gray-400">Total {users.length} akun</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Memuat data pengguna...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="px-5 py-3">Nama Lengkap & Email</th>
                    <th className="px-5 py-3">Peran (Role)</th>
                    <th className="px-5 py-3">Penugasan Unit</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-gray-900">{u.full_name}</div>
                        <div className="text-gray-400 font-mono text-[11px]">{u.email}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-kuk-maroon-50 text-kuk-maroon border border-kuk-maroon/20">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700 font-medium">
                        {u.unit_name}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {u.is_active ? 'AKTIF' : 'NON-AKTIF'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleOpenEditRole(u)}
                          className="px-2.5 py-1 text-xs text-kuk-maroon hover:bg-kuk-maroon-50 border border-kuk-maroon/20 rounded-lg font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          <Shield className="w-3 h-3" />
                          <span>Ubah Peran</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'RBAC' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-sm text-gray-800">Matriks Hak Akses Kewenangan (Role Permission Matrix)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Distribusi kewenangan operasional per peran pengguna sesuai arsitektur KUK Management System v3.1.0.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-gray-50">Modul & Kewenangan</th>
                  <th className="px-3 py-3 text-center">Pimpinan</th>
                  <th className="px-3 py-3 text-center">Manager</th>
                  <th className="px-3 py-3 text-center">Supervisor</th>
                  <th className="px-3 py-3 text-center">Kasir</th>
                  <th className="px-3 py-3 text-center">Checker</th>
                  <th className="px-3 py-3 text-center">Cutter</th>
                  <th className="px-3 py-3 text-center">Driver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {permissionsList.map((perm) => (
                  <tr key={perm.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 sticky left-0 bg-white font-medium text-gray-900 border-r border-gray-100">
                      <div>{perm.label}</div>
                      <div className="text-[10px] font-mono text-gray-400">{perm.key}</div>
                    </td>
                    {(['PIMPINAN', 'MANAGER', 'SUPERVISOR', 'KASIR', 'CHECKER', 'CUTTER', 'DRIVER'] as UserRole[]).map((r) => {
                      const has = rolePermissionMap[r]?.includes(perm.key);
                      return (
                        <td key={r} className="px-3 py-3 text-center">
                          {has ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                              <Check className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-300">
                              <X className="w-3 h-3" />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'UNITS' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {units.map((u) => (
            <div key={u.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-kuk-maroon-50 text-kuk-maroon border border-kuk-maroon/20">
                  {u.code}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  AKTIF
                </span>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 text-base">{u.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{u.address || 'Alamat operasional unit terdaftar'}</p>
              </div>

              <div className="pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
                <span>Multi-tenant RLS Protected</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Data Source & Environment Configuration */}
      {activeTab === 'PREVIEW' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-6">
          <div className="flex items-start justify-between border-b border-gray-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-kuk-maroon" />
                <h2 className="font-bold text-gray-900 text-base">Konfigurasi Sumber Data & Preview Mode</h2>
              </div>
              <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                Kontrol perilaku pengambilan data aplikasi. Mengatur apakah aplikasi memuat data riil Supabase Cloud secara langsung, atau menggunakan fallback data simulasi lokal (Zero-State Preview).
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                previewActive
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {previewActive ? 'PREVIEW MODE: AKTIF' : 'LIVE SUPABASE: AKTIF'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Status & Toggle */}
            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Zero-State Preview Mode</h3>
                  <p className="text-2xs text-gray-500 mt-0.5">Key: localStorage[&apos;KUK_PREVIEW_MODE&apos;]</p>
                </div>
                <button
                  disabled={!canTogglePreview}
                  onClick={() => {
                    if (!canTogglePreview) return;
                    const next = !previewActive;
                    const ok = setPreviewModeActive(next);
                    if (!ok) {
                      showToast('Aksi ditolak: Mode preview dinonaktifkan permanen pada environment Production.');
                      return;
                    }
                    setPreviewActive(next);
                    showToast(
                      next
                        ? 'Mode Preview diaktifkan. Data simulasi lokal akan ditampilkan.'
                        : 'Mode Preview dinonaktifkan. Menggunakan koneksi riil ke Supabase.'
                    );
                    loadData();
                  }}
                  title={
                    isPreviewBlocked
                      ? 'Dinonaktifkan permanen di Production demi integritas data.'
                      : !isSuperAdmin
                      ? 'Hanya Super Administrator yang berwenang mengubah sumber data.'
                      : 'Klik untuk mengubah mode pratinjau data'
                  }
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    !canTogglePreview
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                      : previewActive
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  {previewActive ? (
                    <>
                      <ToggleRight className="w-4 h-4" />
                      <span>Mode Pratinjau Aktif</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-gray-500" />
                      <span>Mode Pratinjau Nonaktif</span>
                    </>
                  )}
                </button>
              </div>

              {/* Security Advisory Badges */}
              {isPreviewBlocked ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-2xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Keamanan Production Aktif:</strong> Mode pratinjau dinonaktifkan secara permanen pada lingkungan Production untuk mencegah pencemaran atau pemalsuan data operasional.
                  </span>
                </div>
              ) : !isSuperAdmin ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-2xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Akses Terbatas:</strong> Hanya pengguna dengan peran Super Administrator yang memiliki kewenangan mengubah sumber data pratinjau.
                  </span>
                </div>
              ) : null}

              <div className="text-xs text-gray-600 space-y-1.5 pt-2 border-t border-gray-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Sumber Data Aktif:</span>
                  <span className="font-semibold text-gray-900 font-mono">
                    {previewActive ? 'MOCK FIXTURES (Local)' : 'LIVE POSTGRESQL (Supabase)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Perilaku Database Kosong:</span>
                  <span className="font-semibold text-gray-900">
                    {previewActive ? 'Menampilkan data sampel preview' : 'Menampilkan empty state (0 baris)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Perilaku Error Jaringan/RLS:</span>
                  <span className="font-semibold text-gray-900">
                    {previewActive ? 'Fallback ke sampel preview' : 'Tampilkan pesan error transparan'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Environment Information */}
            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-kuk-maroon" />
                <span>Prinsip Keamanan & Integritas Data (Phase 3.2)</span>
              </h3>
              <ul className="text-xs text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong className="text-gray-800">Tanpa Masking Otomatis:</strong> Error koneksi atau penolakan RLS tidak lagi disamarkan sebagai preview lokal saat mode preview nonaktif.
                </li>
                <li>
                  <strong className="text-gray-800">Data Response Seragam:</strong> Semua service mengembalikan kontrak standar <code className="text-2xs bg-gray-100 px-1 py-0.5 rounded font-mono">DataResponse&lt;T&gt;</code> dengan indikator <code className="text-2xs bg-gray-100 px-1 py-0.5 rounded font-mono">source: &apos;LIVE&apos; | &apos;MOCK&apos;</code>.
                </li>
                <li>
                  <strong className="text-gray-800">Isolasi Mutasi:</strong> Pengajuan transaksi kiosk memvalidasi error secara ketat dan tidak mengembalikan referensi fiktif jika server menolak.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ubah Peran */}
      {roleModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-kuk-gold" />
                <h2 className="font-bold text-sm">Ubah Peran Pengguna</h2>
              </div>
              <button onClick={() => setRoleModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                <div className="font-bold text-gray-900">{selectedUser.full_name}</div>
                <div className="text-gray-500 font-mono">{selectedUser.email}</div>
                <div className="text-gray-500">Unit: {selectedUser.unit_name}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Peran Sistem (Role)</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
                >
                  <option value="PIMPINAN">PIMPINAN (Direksi / Owner)</option>
                  <option value="MANAGER">MANAGER (Kepala Toko / Operasional)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Pengawas Toko)</option>
                  <option value="KASIR">KASIR (Kasir Toko)</option>
                  <option value="CHECKER">CHECKER (Pemeriksa Barang & Gudang)</option>
                  <option value="CUTTER">CUTTER (Tukang Potong Kaca)</option>
                  <option value="DRIVER">DRIVER (Sopir Pengiriman)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingRole}
                  className="px-4 py-2 text-xs font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-700 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
                >
                  {savingRole ? 'Menyimpan...' : 'Simpan Peran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};