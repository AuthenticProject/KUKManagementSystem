import React, { useState, useEffect } from 'react';
import {
  systemService,
  employeeService,
  glassTipService,
} from '@/services/dataService';
import { userAccountStore, StoredStaffUser } from '@/services/userAccountStore';
import type { BusinessUnit, UserRole, Department, Position, WorkSchedule } from '@/types/models';
import {
  Settings,
  Users,
  ShieldCheck,
  Building2,
  CheckCircle2,
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
  Layers,
  Briefcase,
  Clock,
  Percent,
} from 'lucide-react';
import { PageHeader } from '@/components/ui';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'MASTER' | 'RBAC' | 'UNITS'>('USERS');
  const [staffUsers, setStaffUsers] = useState<StoredStaffUser[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<'ALL' | 'bangunan' | 'palen'>('ALL');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Master Data State
  const [masterUnit, setMasterUnit] = useState<string>('unit_bangunan_01');
  const [masterSubTab, setMasterSubTab] = useState<'TARIF_KACA' | 'DEPARTEMEN' | 'JABATAN' | 'JADWAL'>('TARIF_KACA');
  const [glassRates, setGlassRates] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);

  // Master Modals & Forms
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateForm, setRateForm] = useState<{ id?: string; name: string; thickness_mm: number; price_per_sqm: number; default_percentage: number; is_active: boolean }>({
    name: '',
    thickness_mm: 5,
    price_per_sqm: 100000,
    default_percentage: 3,
    is_active: true,
  });

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptForm, setDeptForm] = useState<{ id?: string; name: string; code: string; description: string }>({
    name: '',
    code: '',
    description: '',
  });

  const [posModalOpen, setPosModalOpen] = useState(false);
  const [posForm, setPosForm] = useState<{ id?: string; title: string; code: string; department_id: string; level: number; description: string }>({
    title: '',
    code: '',
    department_id: '',
    level: 1,
    description: '',
  });

  const [schModalOpen, setSchModalOpen] = useState(false);
  const [schForm, setSchForm] = useState<{ id?: string; name: string; start_time: string; end_time: string; late_tolerance_minutes: number; is_active: boolean }>({
    name: '',
    start_time: '08:00',
    end_time: '17:00',
    late_tolerance_minutes: 15,
    is_active: true,
  });

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


  const loadMasterData = async (unitId: string = masterUnit) => {
    try {
      const [gr, deptRes, posRes, sch] = await Promise.all([
        glassTipService.getGlassRates(unitId),
        employeeService.getDepartments(unitId),
        employeeService.getPositions(unitId),
        employeeService.getWorkSchedules(unitId),
      ]);
      setGlassRates(gr || []);
      setDepartments(Array.isArray(deptRes) ? deptRes : (deptRes as any)?.data || []);
      setPositions(Array.isArray(posRes) ? posRes : (posRes as any)?.data || []);
      setWorkSchedules(sch || []);
    } catch {
      // Ignored
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    // 1. Load staff accounts from UserAccountStore
    const sUsers = userAccountStore.getUsers();
    setStaffUsers(sUsers);

    // 2. Load system services & master data
    const [uRes, bUnits] = await Promise.all([
      systemService.getUsers(),
      systemService.getUnits(),
      loadMasterData(masterUnit),
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

  useEffect(() => {
    loadMasterData(masterUnit);
  }, [masterUnit]);

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


  // --- Master Data Handlers ---
  const handleSaveGlassRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await glassTipService.saveGlassRate(masterUnit, rateForm);
    showToast(res.message);
    if (res.success) {
      setRateModalOpen(false);
      loadMasterData(masterUnit);
    }
  };

  const handleDeleteGlassRate = async (id: string, name: string) => {
    if (window.confirm(`Hapus jenis kaca "${name}"?`)) {
      const res = await glassTipService.deleteGlassRate(masterUnit, id);
      showToast(res.message);
      loadMasterData(masterUnit);
    }
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await employeeService.saveDepartment(masterUnit, deptForm);
    showToast(res.message);
    if (res.success) {
      setDeptModalOpen(false);
      loadMasterData(masterUnit);
    }
  };

  const handleDeleteDepartment = async (id: string, name: string) => {
    if (window.confirm(`Hapus departemen "${name}"?`)) {
      const res = await employeeService.deleteDepartment(masterUnit, id);
      showToast(res.message);
      loadMasterData(masterUnit);
    }
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await employeeService.savePosition(masterUnit, posForm);
    showToast(res.message);
    if (res.success) {
      setPosModalOpen(false);
      loadMasterData(masterUnit);
    }
  };

  const handleDeletePosition = async (id: string, title: string) => {
    if (window.confirm(`Hapus jabatan "${title}"?`)) {
      const res = await employeeService.deletePosition(masterUnit, id);
      showToast(res.message);
      loadMasterData(masterUnit);
    }
  };

  const handleSaveWorkSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await employeeService.saveWorkSchedule(masterUnit, schForm);
    showToast(res.message);
    if (res.success) {
      setSchModalOpen(false);
      loadMasterData(masterUnit);
    }
  };

  const handleDeleteWorkSchedule = async (id: string, name: string) => {
    if (window.confirm(`Hapus jadwal kerja "${name}"?`)) {
      const res = await employeeService.deleteWorkSchedule(masterUnit, id);
      showToast(res.message);
      loadMasterData(masterUnit);
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
          onClick={() => setActiveTab('MASTER')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'MASTER'
              ? 'bg-kuk-maroon text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Database className="w-4 h-4 text-kuk-gold" />
          <span>Master Data Bisnis</span>
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

      {/* Tab: Master Data Bisnis */}
      {activeTab === 'MASTER' && (
        <div className="space-y-4">
          {/* Header Panel with Unit Selector and Master Categories */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-kuk-maroon" />
                <span>Pengelolaan Master Database Bisnis</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Kelola tarif kaca, rumus persentase tip pemotongan, struktur departemen, jabatan operasional, dan jadwal jam kerja.
              </p>
            </div>

            {/* Business Unit Switcher */}
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl self-start md:self-auto">
              <button
                type="button"
                onClick={() => setMasterUnit('unit_bangunan_01')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  masterUnit === 'unit_bangunan_01'
                    ? 'bg-kuk-maroon text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🏢 TB KUK La Tansa
              </button>
              <button
                type="button"
                onClick={() => setMasterUnit('unit_palen_01')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  masterUnit === 'unit_palen_01'
                    ? 'bg-kuk-maroon text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🏬 KUK Palen
              </button>
            </div>
          </div>

          {/* Master Sub Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setMasterSubTab('TARIF_KACA')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                masterSubTab === 'TARIF_KACA'
                  ? 'bg-kuk-maroon text-white border-kuk-maroon shadow-xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Percent className="w-3.5 h-3.5 text-kuk-gold" />
              <span>Tarif & Jenis Kaca ({glassRates.length})</span>
            </button>
            <button
              onClick={() => setMasterSubTab('DEPARTEMEN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                masterSubTab === 'DEPARTEMEN'
                  ? 'bg-kuk-maroon text-white border-kuk-maroon shadow-xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Departemen ({departments.length})</span>
            </button>
            <button
              onClick={() => setMasterSubTab('JABATAN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                masterSubTab === 'JABATAN'
                  ? 'bg-kuk-maroon text-white border-kuk-maroon shadow-xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Jabatan ({positions.length})</span>
            </button>
            <button
              onClick={() => setMasterSubTab('JADWAL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                masterSubTab === 'JADWAL'
                  ? 'bg-kuk-maroon text-white border-kuk-maroon shadow-xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Jadwal Kerja ({workSchedules.length})</span>
            </button>
          </div>

          {/* SubTab 1: TARIF & JENIS KACA */}
          {masterSubTab === 'TARIF_KACA' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-800">Master Tarif Kaca & Rumus Tip 3%</h3>
                  <p className="text-2xs text-gray-500 mt-0.5">
                    Dasar kalkulasi modul Tip Pemotongan Kaca: Estimasi Tip = Luas (m²) × Harga /m² × 3%.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRateForm({
                      name: '',
                      thickness_mm: 5,
                      price_per_sqm: 100000,
                      default_percentage: 3,
                      is_active: true,
                    });
                    setRateModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-kuk-maroon hover:bg-[#3B0000] rounded-xl shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-kuk-gold" />
                  <span>Tambah Jenis Kaca</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Nama Jenis Kaca</th>
                      <th className="px-4 py-3 text-center">Ketebalan</th>
                      <th className="px-4 py-3 text-right">Harga Dasar / m²</th>
                      <th className="px-4 py-3 text-center">Tarif Tip %</th>
                      <th className="px-4 py-3 text-right">Estimasi Tip / m²</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {glassRates.map((rate: any) => {
                      const tipPerSqm = (rate.price_per_sqm * (rate.default_percentage || 3)) / 100;
                      return (
                        <tr key={rate.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">{rate.name}</td>
                          <td className="px-4 py-3 text-center text-gray-600 font-mono">
                            {rate.thickness_mm ? `${rate.thickness_mm} mm` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-gray-800">
                            Rp {Number(rate.price_per_sqm || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 text-2xs">
                              {rate.default_percentage || 3}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                            Rp {tipPerSqm.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-2xs border ${
                                rate.is_active !== false
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200'
                              }`}
                            >
                              {rate.is_active !== false ? 'AKTIF' : 'NON-AKTIF'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setRateForm({
                                    id: rate.id,
                                    name: rate.name,
                                    thickness_mm: rate.thickness_mm || 5,
                                    price_per_sqm: rate.price_per_sqm || 0,
                                    default_percentage: rate.default_percentage || 3,
                                    is_active: rate.is_active !== false,
                                  });
                                  setRateModalOpen(true);
                                }}
                                className="px-2 py-1 text-xs text-kuk-maroon hover:bg-kuk-maroon-50 border border-kuk-maroon/20 rounded-lg font-medium inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteGlassRate(rate.id, rate.name)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {glassRates.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-xs">
                          Belum ada master tarif kaca terdaftar untuk unit ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SubTab 2: DEPARTEMEN */}
          {masterSubTab === 'DEPARTEMEN' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-800">Master Departemen Organisasi</h3>
                  <p className="text-2xs text-gray-500 mt-0.5">
                    Struktur divisi/bagian operasional untuk penempatan karyawan dan validasi izin cuti.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeptForm({ name: '', code: '', description: '' });
                    setDeptModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-kuk-maroon hover:bg-[#3B0000] rounded-xl shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-kuk-gold" />
                  <span>Tambah Departemen</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Kode</th>
                      <th className="px-4 py-3">Nama Departemen</th>
                      <th className="px-4 py-3">Deskripsi</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {departments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-kuk-maroon">{dept.code}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{dept.name}</td>
                        <td className="px-4 py-3 text-gray-600">{dept.description || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setDeptForm({
                                  id: dept.id,
                                  name: dept.name,
                                  code: dept.code,
                                  description: dept.description || '',
                                });
                                setDeptModalOpen(true);
                              }}
                              className="px-2 py-1 text-xs text-kuk-maroon hover:bg-kuk-maroon-50 border border-kuk-maroon/20 rounded-lg font-medium inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {departments.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-xs">
                          Belum ada departemen terdaftar untuk unit ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SubTab 3: JABATAN */}
          {masterSubTab === 'JABATAN' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-800">Master Posisi & Jabatan Karyawan</h3>
                  <p className="text-2xs text-gray-500 mt-0.5">
                    Klasifikasi jabatan, level hierarki wewenang, dan departemen penugasan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPosForm({
                      title: '',
                      code: '',
                      department_id: departments[0]?.id || '',
                      level: 1,
                      description: '',
                    });
                    setPosModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-kuk-maroon hover:bg-[#3B0000] rounded-xl shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-kuk-gold" />
                  <span>Tambah Jabatan</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Kode</th>
                      <th className="px-4 py-3">Nama Jabatan</th>
                      <th className="px-4 py-3">Departemen</th>
                      <th className="px-4 py-3 text-center">Level Hierarki</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {positions.map((pos) => {
                      const deptName = departments.find((d) => d.id === pos.department_id)?.name || 'Umum';
                      return (
                        <tr key={pos.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-kuk-maroon">{pos.code}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{pos.title}</td>
                          <td className="px-4 py-3 text-gray-600">{deptName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200 text-2xs">
                              Level {pos.level || 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPosForm({
                                    id: pos.id,
                                    title: pos.title,
                                    code: pos.code,
                                    department_id: pos.department_id || departments[0]?.id || '',
                                    level: pos.level || 1,
                                    description: (pos as any).description || '',
                                  });
                                  setPosModalOpen(true);
                                }}
                                className="px-2 py-1 text-xs text-kuk-maroon hover:bg-kuk-maroon-50 border border-kuk-maroon/20 rounded-lg font-medium inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePosition(pos.id, pos.title)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {positions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-xs">
                          Belum ada jabatan terdaftar untuk unit ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SubTab 4: JADWAL KERJA */}
          {masterSubTab === 'JADWAL' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-800">Master Jadwal Kerja & Shift</h3>
                  <p className="text-2xs text-gray-500 mt-0.5">
                    Pengaturan jam masuk, jam pulang, dan toleransi keterlambatan presensi harian.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSchForm({
                      name: '',
                      start_time: '08:00',
                      end_time: '17:00',
                      late_tolerance_minutes: 15,
                      is_active: true,
                    });
                    setSchModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-kuk-maroon hover:bg-[#3B0000] rounded-xl shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-kuk-gold" />
                  <span>Tambah Jadwal</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Nama Shift / Jadwal</th>
                      <th className="px-4 py-3 text-center">Jam Masuk</th>
                      <th className="px-4 py-3 text-center">Jam Pulang</th>
                      <th className="px-4 py-3 text-center">Toleransi Terlambat</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {workSchedules.map((sch) => (
                      <tr key={sch.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-gray-900">{sch.name}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-blue-700">{sch.start_time}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-purple-700">{sch.end_time}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 text-2xs">
                            {sch.late_tolerance_minutes} menit
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-2xs border ${
                              sch.is_active !== false
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}
                          >
                            {sch.is_active !== false ? 'AKTIF' : 'NON-AKTIF'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSchForm({
                                  id: sch.id,
                                  name: sch.name,
                                  start_time: sch.start_time,
                                  end_time: sch.end_time,
                                  late_tolerance_minutes: sch.late_tolerance_minutes || 15,
                                  is_active: sch.is_active !== false,
                                });
                                setSchModalOpen(true);
                              }}
                              className="px-2 py-1 text-xs text-kuk-maroon hover:bg-kuk-maroon-50 border border-kuk-maroon/20 rounded-lg font-medium inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWorkSchedule(sch.id, sch.name)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {workSchedules.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs">
                          Belum ada jadwal kerja terdaftar untuk unit ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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

              <div>
                {/* Toko / Unit Kerja */}
                <label className="block text-xs font-bold text-gray-700 mb-1">Toko / Unit Kerja *</label>
                <select
                  value={formToko}
                  onChange={(e) => setFormToko(e.target.value as 'bangunan' | 'palen')}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                >
                  <option value="bangunan">🏢 TB KUK La Tansa (Bangunan)</option>
                  <option value="palen">🏬 KUK Palen</option>
                </select>
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


      {/* ============================================================== */}
      {/* MODAL MASTER: TARIF JENIS KACA */}
      {/* ============================================================== */}
      {rateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#540000] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-[#FFCC00]" />
                <h2 className="font-bold text-sm">
                  {rateForm.id ? 'Edit Tarif Jenis Kaca' : 'Tambah Jenis Kaca Baru'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRateModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGlassRate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Nama Jenis Kaca <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={rateForm.name}
                  onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })}
                  placeholder="Contoh: Kaca Polos 5mm"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Ketebalan (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={rateForm.thickness_mm}
                    onChange={(e) => setRateForm({ ...rateForm, thickness_mm: Number(e.target.value) || 0 })}
                    placeholder="Contoh: 5"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Harga Dasar / m² (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="1000"
                    value={rateForm.price_per_sqm}
                    onChange={(e) => setRateForm({ ...rateForm, price_per_sqm: Number(e.target.value) || 0 })}
                    placeholder="Contoh: 110000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Tarif Tip (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="100"
                    value={rateForm.default_percentage}
                    onChange={(e) => setRateForm({ ...rateForm, default_percentage: Number(e.target.value) || 3 })}
                    placeholder="3"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Estimasi Tip / m²</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-emerald-700">
                    Rp {((rateForm.price_per_sqm * rateForm.default_percentage) / 100).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rateForm.is_active}
                    onChange={(e) => setRateForm({ ...rateForm, is_active: e.target.checked })}
                    className="rounded text-[#540000] focus:ring-[#FFCC00] w-4 h-4 cursor-pointer"
                  />
                  <span className="font-bold text-gray-800">Status Aktif (Tersedia untuk Nota Tip)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-[#540000] hover:bg-[#3B0000] rounded-xl shadow-xs"
                >
                  Simpan Tarif Kaca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL MASTER: DEPARTEMEN */}
      {/* ============================================================== */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#540000] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#FFCC00]" />
                <h2 className="font-bold text-sm">
                  {deptForm.id ? 'Edit Departemen' : 'Tambah Departemen Baru'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeptModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Nama Departemen <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="Contoh: Logistik & Gudang"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Kode Departemen</label>
                <input
                  type="text"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  placeholder="Contoh: LOG, OPS, KAS"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl uppercase font-mono focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Deskripsi Departemen</label>
                <textarea
                  rows={3}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Uraian tanggung jawab bagian"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-[#540000] hover:bg-[#3B0000] rounded-xl shadow-xs"
                >
                  Simpan Departemen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL MASTER: JABATAN */}
      {/* ============================================================== */}
      {posModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#540000] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#FFCC00]" />
                <h2 className="font-bold text-sm">
                  {posForm.id ? 'Edit Posisi Jabatan' : 'Tambah Jabatan Baru'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPosModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePosition} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Nama Jabatan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={posForm.title}
                  onChange={(e) => setPosForm({ ...posForm, title: e.target.value })}
                  placeholder="Contoh: Staff Penjualan & Kasir"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Kode Jabatan</label>
                  <input
                    type="text"
                    value={posForm.code}
                    onChange={(e) => setPosForm({ ...posForm, code: e.target.value })}
                    placeholder="Contoh: KSR, MGR"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl uppercase font-mono focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Level Hierarki</label>
                  <select
                    value={posForm.level}
                    onChange={(e) => setPosForm({ ...posForm, level: Number(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                  >
                    <option value={1}>Level 1 - Staff Pelaksana</option>
                    <option value={2}>Level 2 - Supervisor / Koordinator Lapangan</option>
                    <option value={3}>Level 3 - Manager / Kepala Toko</option>
                    <option value={4}>Level 4 - Direksi / Pimpinan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Departemen Penugasan</label>
                <select
                  value={posForm.department_id}
                  onChange={(e) => setPosForm({ ...posForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                  {departments.length === 0 && <option value="">Umum</option>}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setPosModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-[#540000] hover:bg-[#3B0000] rounded-xl shadow-xs"
                >
                  Simpan Jabatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL MASTER: JADWAL KERJA */}
      {/* ============================================================== */}
      {schModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#540000] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FFCC00]" />
                <h2 className="font-bold text-sm">
                  {schForm.id ? 'Edit Jadwal Kerja' : 'Tambah Jadwal Kerja Baru'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSchModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkSchedule} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Nama Shift / Jadwal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={schForm.name}
                  onChange={(e) => setSchForm({ ...schForm, name: e.target.value })}
                  placeholder="Contoh: Shift Pagi Operasional Toko"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Jam Masuk <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={schForm.start_time}
                    onChange={(e) => setSchForm({ ...schForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Jam Pulang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={schForm.end_time}
                    onChange={(e) => setSchForm({ ...schForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl font-mono focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Toleransi Keterlambatan (menit)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={schForm.late_tolerance_minutes}
                  onChange={(e) => setSchForm({ ...schForm, late_tolerance_minutes: Number(e.target.value) || 0 })}
                  placeholder="Contoh: 15"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414]"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schForm.is_active}
                    onChange={(e) => setSchForm({ ...schForm, is_active: e.target.checked })}
                    className="rounded text-[#540000] focus:ring-[#FFCC00] w-4 h-4 cursor-pointer"
                  />
                  <span className="font-bold text-gray-800">Status Aktif (Diterapkan untuk Presensi)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSchModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-[#540000] hover:bg-[#3B0000] rounded-xl shadow-xs"
                >
                  Simpan Jadwal Kerja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
