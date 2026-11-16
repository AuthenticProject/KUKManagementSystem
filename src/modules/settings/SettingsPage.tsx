import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { systemService, isPreviewModeActive, setPreviewModeActive } from '@/services/dataService';
import { userAccountStore, StoredStaffUser } from '@/services/userAccountStore';
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
  AlertCircle,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  Search,
  KeyRound,
  UserCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui';

export const SettingsPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'USERS' | 'RBAC' | 'UNITS' | 'PREVIEW'>('USERS');
  const [staffUsers, setStaffUsers] = useState<StoredStaffUser[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);
  const [previewActive, setPreviewActive] = useState<boolean>(isPreviewModeActive());
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<'ALL' | 'bangunan' | 'palen'>('ALL');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Account Modal (Create / Edit)
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [formId, setFormId] = useState('');
  const [formNamaLengkap, setFormNamaLengkap] = useState('');
  const [formJabatan, setFormJabatan] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formShowPassword, setFormShowPassword] = useState(false);
  const [formToko, setFormToko] = useState<'bangunan' | 'palen'>('bangunan');
  const [formRole, setFormRole] = useState<UserRole>('SUPERVISOR');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');

  // Delete Confirm Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<StoredStaffUser | null>(null);

  // Legacy Edit Role modal (preserved)
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('KASIR');
  const [savingRole, setSavingRole] = useState(false);

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

  const loadData = async () => {
    setLoading(true);
    setError(null);

    // 1. Load staff accounts from UserAccountStore
    const sUsers = userAccountStore.getUsers();
    setStaffUsers(sUsers);

    // 2. Load system services
    const [uRes, bUnits] = await Promise.all([
      systemService.getUsers(),
      systemService.getUnits(),
    ]);

    if (!uRes.success && uRes.error) {
      setError(uRes.error);
    }

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

  // Toggle visible password in table
  const toggleRowPassword = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Open Create Account Modal
  const handleOpenCreateAccount = () => {
    setModalMode('CREATE');
    setFormId('');
    setFormNamaLengkap('');
    setFormJabatan('Staf Operasional');
    setFormUsername('');
    setFormPassword('12345');
    setFormShowPassword(false);
    setFormToko('bangunan');
    setFormRole('SUPERVISOR');
    setFormIsActive(true);
    setFormEmail('');
    setFormPhone('');
    setAccountModalOpen(true);
  };

  // Open Edit Account Modal
  const handleOpenEditAccount = (user: StoredStaffUser) => {
    setModalMode('EDIT');
    setFormId(user.id);
    setFormNamaLengkap(user.namaLengkap);
    setFormJabatan(user.jabatan);
    setFormUsername(user.username);
    setFormPassword(user.password);
    setFormShowPassword(false);
    setFormToko(user.toko === 'palen' ? 'palen' : 'bangunan');
    setFormRole(user.role);
    setFormIsActive(user.is_active);
    setFormEmail(user.email || '');
    setFormPhone(user.phone || '');
    setAccountModalOpen(true);
  };

  // Save Account (Create / Edit)
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaLengkap.trim()) {
      showToast('Nama lengkap staf wajib diisi.');
      return;
    }
    if (!formUsername.trim()) {
      showToast('Username wajib diisi.');
      return;
    }
    if (!formPassword.trim()) {
      showToast('Kata sandi wajib diisi.');
      return;
    }

    const payload: Partial<StoredStaffUser> & { username: string; namaLengkap: string } = {
      id: formId || undefined,
      username: formUsername.trim().toLowerCase(),
      namaLengkap: formNamaLengkap.trim(),
      jabatan: formJabatan.trim() || 'Staf Operasional',
      password: formPassword.trim(),
      toko: formToko,
      role: formRole,
      is_active: formIsActive,
      email: formEmail.trim() || `${formUsername.trim().toLowerCase()}@kuk.co.id`,
      phone: formPhone.trim() || '081234567890',
    };

    const res = userAccountStore.saveUser(payload);
    showToast(res.message);
    if (res.success) {
      setAccountModalOpen(false);
      loadData();
    }
  };

  // Toggle user active status directly
  const handleToggleStatus = (user: StoredStaffUser) => {
    const updated = { ...user, is_active: !user.is_active };
    userAccountStore.saveUser(updated);
    showToast(`Status "${user.namaLengkap}" diubah menjadi ${updated.is_active ? 'AKTIF' : 'NON-AKTIF'}.`);
    loadData();
  };

  // Delete User
  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    const res = userAccountStore.deleteUser(userToDelete.id);
    showToast(res.message);
    setDeleteModalOpen(false);
    setUserToDelete(null);
    if (res.success) {
      loadData();
    }
  };

  // Reset to default accounts
  const handleResetDefaults = () => {
    if (window.confirm('Kembalikan semua akun ke data bawaan resmi KUK Bangunan & KUK Palen?')) {
      const res = userAccountStore.resetToDefaults();
      showToast(res.message);
      loadData();
    }
  };

  // Legacy Role Modal handler
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
    // Also sync to UserAccountStore if matching user exists
    const matchingStaff = userAccountStore.getUserById(selectedUser.id);
    if (matchingStaff) {
      userAccountStore.saveUser({ ...matchingStaff, role: targetRole });
    }
    setSavingRole(false);
    showToast(res.message);
    if (res.success) {
      setRoleModalOpen(false);
      loadData();
    }
  };

  // Filtered staff users
  const filteredStaffUsers = staffUsers.filter((u) => {
    const matchesSearch =
      u.namaLengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.jabatan.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUnit =
      selectedUnitFilter === 'ALL' || u.toko === selectedUnitFilter;
    return matchesSearch && matchesUnit;
  });

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

      {/* Header Halaman */}
      <PageHeader
        title="Pengaturan Sistem & Hak Akses"
        subtitle="Kelola akun pengguna, nama, jabatan, kata sandi, matriks RBAC, dan unit usaha secara mandiri."
        icon={<Settings className="w-6 h-6 text-kuk-maroon" />}
        breadcrumbs={[{ label: 'Beranda', href: '/dashboard' }, { label: 'Pengaturan Sistem' }]}
      />

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'USERS'
              ? 'bg-kuk-maroon text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Pengguna & Akun Staf ({staffUsers.length})</span>
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
          {previewActive && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
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

      {/* Main Tab Content: USERS */}
      {activeTab === 'USERS' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Action & Filter Toolbar */}
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
            <div>
              <h2 className="font-bold text-sm text-gray-800">Daftar Akun Staf Manajemen KUK</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Semua nama, jabatan, username, dan kata sandi bersifat editable dan tersinkronisasi langsung ke login portal.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-all shadow-2xs"
                title="Kembalikan ke akun staf bawaan resmi KUK"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                <span>Reset Default</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreateAccount}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-kuk-maroon hover:bg-[#3B0000] rounded-xl transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-kuk-gold" />
                <span>Tambah Akun Baru</span>
              </button>
            </div>
          </div>

          {/* Search & Unit Filter Controls */}
          <div className="p-3 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama, jabatan, username..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kuk-maroon/20 focus:border-kuk-maroon"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Filter Toko:</span>
              <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSelectedUnitFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    selectedUnitFilter === 'ALL'
                      ? 'bg-white text-kuk-maroon shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Semua ({staffUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUnitFilter('bangunan')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    selectedUnitFilter === 'bangunan'
                      ? 'bg-white text-kuk-maroon shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🏢 La Tansa ({staffUsers.filter((u) => u.toko === 'bangunan').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUnitFilter('palen')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    selectedUnitFilter === 'palen'
                      ? 'bg-white text-kuk-maroon shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🏬 Palen ({staffUsers.filter((u) => u.toko === 'palen').length})
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Memuat data pengguna...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Nama Lengkap & Akun</th>
                    <th className="px-4 py-3">Jabatan Resmi</th>
                    <th className="px-4 py-3">Kata Sandi (PW)</th>
                    <th className="px-4 py-3">Unit / Toko</th>
                    <th className="px-4 py-3">Peran (Role)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStaffUsers.map((u) => {
                    const isPalen = u.toko === 'palen';
                    const isVisiblePass = showPasswordMap[u.id];

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#540000] to-[#800000] text-[#FFCC00] font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {u.namaLengkap ? u.namaLengkap[0].toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                                <span>{u.namaLengkap}</span>
                                {u.username.toLowerCase() === 'fariz' && (
                                  <span className="text-[9px] bg-kuk-gold/20 text-[#996414] px-1.5 py-0.2 rounded font-bold">
                                    Owner
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-400 font-mono text-[11px]">
                                @{u.username} · {u.email || `${u.username}@kuk.co.id`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Jabatan (Editable) */}
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 inline-block">
                            {u.jabatan || 'Staf Operasional'}
                          </span>
                        </td>

                        {/* Kata Sandi (Editable & Peekable) */}
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 border border-gray-200">
                            <KeyRound className="w-3 h-3 text-gray-400" />
                            <span className="font-mono text-xs font-bold text-gray-700 min-w-12">
                              {isVisiblePass ? u.password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRowPassword(u.id)}
                              className="text-gray-400 hover:text-gray-700 p-0.5 rounded transition-colors"
                              title={isVisiblePass ? 'Sembunyikan password' : 'Lihat password'}
                            >
                              {isVisiblePass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>

                        {/* Toko / Unit */}
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isPalen
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {isPalen ? '🏬 KUK PALEN' : '🏢 TB KUK LA TANSA'}
                          </span>
                        </td>

                        {/* Peran Sistem */}
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-kuk-maroon-50 text-kuk-maroon border border-kuk-maroon/20">
                            {u.role}
                          </span>
                        </td>

                        {/* Status (Clickable to Toggle) */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                              u.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            }`}
                            title="Klik untuk mengubah status aktif"
                          >
                            {u.is_active ? 'AKTIF' : 'NON-AKTIF'}
                          </button>
                        </td>

                        {/* Aksi: Edit & Hapus */}
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenEditRole({
                                  id: u.id,
                                  email: u.email || `${u.username}@kuk.co.id`,
                                  full_name: u.namaLengkap,
                                  system_role: u.role === 'PIMPINAN' ? 'super_admin' : 'staff',
                                  status: u.is_active ? 'ACTIVE' : 'INACTIVE',
                                  is_active: u.is_active,
                                  assigned_units: [],
                                  created_at: '',
                                  role: u.role,
                                  unit_name: u.toko === 'palen' ? 'KUK Palen' : 'TB KUK La Tansa',
                                })
                              }
                              className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg font-medium inline-flex items-center gap-1 transition-colors"
                              title="Ubah peran RBAC pengguna"
                            >
                              <Shield className="w-3 h-3 text-kuk-maroon" />
                              <span>Ubah Peran</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditAccount(u)}
                              className="px-2 py-1 text-xs text-kuk-maroon hover:bg-kuk-maroon-50 border border-kuk-maroon/20 rounded-lg font-medium inline-flex items-center gap-1 transition-colors"
                              title="Edit nama, jabatan, password, role"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>

                            {u.username.toLowerCase() !== 'fariz' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setUserToDelete(u);
                                  setDeleteModalOpen(true);
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Hapus akun staf"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredStaffUsers.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-xs">
                  Tidak ada akun staf yang cocok dengan kriteria pencarian & filter.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: RBAC Matrix */}
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

      {/* Tab: Business Units */}
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

      {/* Tab: Preview & Data Source */}
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
                    showToast(next ? 'Mode Preview diaktifkan.' : 'Mode Preview dinonaktifkan.');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    previewActive
                      ? 'bg-kuk-maroon text-white hover:bg-kuk-maroon-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {previewActive ? 'Aktif' : 'Non-Aktif'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL EDIT / CREATE AKUN STAF (FULL EDITABILITY) */}
      {/* ============================================================== */}
      {accountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#540000] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#FFCC00]" />
                <h2 className="font-bold text-sm">
                  {modalMode === 'CREATE' ? 'Tambah Akun Staf Baru' : 'Edit Akun Staf Manajemen'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nama Lengkap Staf <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNamaLengkap}
                  onChange={(e) => setFormNamaLengkap(e.target.value)}
                  placeholder="Contoh: Fariz Ridwani, S.I.Kom"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>

              {/* Jabatan Resmi */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Jabatan Resmi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formJabatan}
                  onChange={(e) => setFormJabatan(e.target.value)}
                  placeholder="Contoh: Koordinator, Kepala Toko, HRD, Bendahara 1, Kasir"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Username */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Username Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="Contoh: fariz, andika"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl font-mono focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                  />
                </div>

                {/* Kata Sandi (Password) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Kata Sandi (Password) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={formShowPassword ? 'text' : 'password'}
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full pl-3 pr-8 py-2 text-xs border border-gray-200 rounded-xl font-mono focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                    />
                    <button
                      type="button"
                      onClick={() => setFormShowPassword(!formShowPassword)}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                    >
                      {formShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Toko / Unit Kerja */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Toko / Unit Kerja</label>
                  <select
                    value={formToko}
                    onChange={(e) => setFormToko(e.target.value as 'bangunan' | 'palen')}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                  >
                    <option value="bangunan">🏢 TB KUK La Tansa (Bangunan)</option>
                    <option value="palen">🏬 KUK Palen</option>
                  </select>
                </div>

                {/* Peran Sistem (Role RBAC) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Peran Akses (Role RBAC)</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                  >
                    <option value="PIMPINAN">PIMPINAN (Direksi / Koordinator)</option>
                    <option value="MANAGER">MANAGER (Kepala Toko / HRD)</option>
                    <option value="SUPERVISOR">SUPERVISOR (Pengawas / Inventaris)</option>
                    <option value="KASIR">KASIR (Kasir Toko)</option>
                    <option value="CHECKER">CHECKER (Pemeriksa Gudang)</option>
                    <option value="CUTTER">CUTTER (Tukang Potong Kaca)</option>
                    <option value="DRIVER">DRIVER (Sopir Armada)</option>
                  </select>
                </div>
              </div>

              {/* Status Aktif */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-[#540000] focus:ring-[#FFCC00] w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800">
                    Akun Aktif (Dapat Login ke Sistem)
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#540000] hover:bg-[#3B0000] rounded-xl shadow-xs transition-all"
                >
                  {modalMode === 'CREATE' ? 'Simpan Akun Baru' : 'Perbarui Akun Staf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL KONFIRMASI HAPUS AKUN */}
      {/* ============================================================== */}
      {deleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center">
              <h3 className="text-sm font-bold text-gray-900">Konfirmasi Hapus Akun</h3>
              <p className="text-xs text-gray-500 mt-1">
                Apakah Anda yakin ingin menghapus akun staf <strong>{userToDelete.namaLengkap}</strong> (@{userToDelete.username})? Tindakan ini dapat dipulihkan melalui menu Reset Default.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
              >
                Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Modal Ubah Peran (Preserved for tests) */}
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
