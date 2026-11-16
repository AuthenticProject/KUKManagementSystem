/**
 * USER ACCOUNT STORE — KUK MANAGEMENT SYSTEM v3.1.0
 * Aligned with official KUK reference systems:
 * https://authenticproject.github.io/KUKLatansa/ & https://authenticproject.github.io/KUKRisingGiant/
 *
 * Implements:
 * 1. Default staff users from KUK Bangunan (La Tansa) and KUK Palen
 * 2. Full editability: Nama Lengkap, Jabatan, Username, Kata Sandi (Password), Role, Toko/Unit, Status
 * 3. Persistence via localStorage ('kuk_master_users') & sessionStorage ('kuk_user')
 * 4. Authentication logic matching reference sites
 */

import { UserRole } from '@/types/models';
import { CANONICAL_DEMO_UNITS, DEMO_IDENTITIES, DemoIdentity } from './demoAuth';

export interface StoredStaffUser {
  id: string;
  username: string;
  password: string; // Kata sandi
  namaLengkap: string;
  jabatan: string; // Jabatan resmi
  toko: 'bangunan' | 'palen' | 'pusat'; // Toko/Unit
  role: UserRole; // Sistem role RBAC
  permissions?: string[];
  foto?: string;
  is_active: boolean;
  email?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export const STORAGE_KEY_USERS = 'kuk_staff_master_v3_2';

export const DEFAULT_KUK_STAFF_USERS: StoredStaffUser[] = [
  // ==========================================
  // 🏢 KUK BANGUNAN (TB KUK LA TANSA) STAFF
  // ==========================================
  {
    id: 'USR-001',
    username: 'fariz',
    password: '12345',
    namaLengkap: 'Fariz Ridwani, S.I.Kom',
    jabatan: 'Koordinator',
    toko: 'bangunan',
    role: 'PIMPINAN',
    permissions: ['*'],
    foto: 'assets/foto_staf/fariz.jpg',
    is_active: true,
    email: 'fariz@kuk.co.id',
    phone: '081234567801',
  },
  {
    id: 'USR-002',
    username: 'andika',
    password: '12345',
    namaLengkap: 'Andika Rizaldi, S.Ag',
    jabatan: 'Kepala Toko',
    toko: 'bangunan',
    role: 'MANAGER',
    permissions: ['dashboard', 'absen', 'cuti', 'pelanggaran', 'tip', 'peminjaman', 'karyawan', 'payroll', 'finance', 'fleet'],
    foto: 'assets/foto_staf/andika.jpg',
    is_active: true,
    email: 'andika@kuk.co.id',
    phone: '081234567802',
  },
  {
    id: 'USR-003',
    username: 'irsyadil',
    password: '150904',
    namaLengkap: 'Muhammad Irsyadil Umam',
    jabatan: 'HRD',
    toko: 'bangunan',
    role: 'HRD' as any,
    permissions: ['*'],
    is_active: true,
    email: 'irsyadil@kuk.co.id',
    phone: '081234567803',
  },
  {
    id: 'USR-004',
    username: 'ari',
    password: '12345',
    namaLengkap: 'Ari Hermawan',
    jabatan: 'Bendahara 1',
    toko: 'bangunan',
    role: 'FINANCE' as any,
    permissions: ['dashboard', 'absen', 'cuti', 'pelanggaran', 'tip', 'peminjaman', 'karyawan', 'finance', 'payroll'],
    foto: 'assets/foto_staf/ari.jpg',
    is_active: true,
    email: 'ari@kuk.co.id',
    phone: '081234567804',
  },
  {
    id: 'USR-005',
    username: 'shuva',
    password: '12345',
    namaLengkap: 'Ahmad Shuva',
    jabatan: 'Inventaris & Armada',
    toko: 'bangunan',
    role: 'SUPERVISOR',
    permissions: ['dashboard', 'absen', 'cuti', 'pelanggaran', 'tip', 'peminjaman', 'karyawan', 'fleet'],
    foto: 'assets/foto_staf/shuva.jpg',
    is_active: true,
    email: 'shuva@kuk.co.id',
    phone: '081234567805',
  },
  {
    id: 'USR-006',
    username: 'aria',
    password: '12345',
    namaLengkap: 'Aria',
    jabatan: 'Inventaris',
    toko: 'bangunan',
    role: 'SUPERVISOR',
    permissions: ['dashboard', 'absen', 'cuti', 'pelanggaran', 'tip', 'peminjaman', 'karyawan', 'fleet'],
    foto: 'assets/foto_staf/aria.jpg',
    is_active: true,
    email: 'aria@kuk.co.id',
    phone: '081234567806',
  },
  {
    id: 'USR-007',
    username: 'zain',
    password: '12345',
    namaLengkap: 'Zainurrofiq',
    jabatan: 'Bendahara 2',
    toko: 'bangunan',
    role: 'FINANCE' as any,
    permissions: ['dashboard', 'absen', 'cuti', 'pelanggaran', 'tip', 'peminjaman', 'karyawan', 'finance'],
    foto: 'assets/foto_staf/zain.jpg',
    is_active: true,
    email: 'zain@kuk.co.id',
    phone: '081234567807',
  },

  // ==========================================
  // 🏬 KUK PALEN STAFF
  // ==========================================
  {
    id: 'USR-008',
    username: 'Raju',
    password: '54321',
    namaLengkap: 'Ahmad Syirajuddin Rabbani',
    jabatan: 'Kepala Toko',
    toko: 'palen',
    role: 'MANAGER',
    permissions: ['dashboard', 'absen', 'pelanggaran', 'karyawan', 'cuti', 'tip', 'peminjaman', 'payroll', 'finance', 'fleet'],
    foto: 'assets/foto_staf/raju.jpg',
    is_active: true,
    email: 'raju@kuk.co.id',
    phone: '081234567808',
  },
  {
    id: 'USR-009',
    username: 'Agheea',
    password: '54321',
    namaLengkap: 'Agheea Gheelwana Huda',
    jabatan: 'HRD',
    toko: 'palen',
    role: 'HRD' as any,
    permissions: ['dashboard', 'absen', 'pelanggaran'],
    foto: 'assets/foto_staf/agheea.jpg',
    is_active: true,
    email: 'agheea@kuk.co.id',
    phone: '081234567809',
  },
  {
    id: 'USR-010',
    username: 'Basith',
    password: '54321',
    namaLengkap: 'Basith Fawwaz',
    jabatan: 'Sekretaris',
    toko: 'palen',
    role: 'HRD' as any,
    permissions: ['dashboard', 'absen', 'pelanggaran'],
    foto: 'assets/foto_staf/basith.jpg',
    is_active: true,
    email: 'basith@kuk.co.id',
    phone: '081234567810',
  },
  {
    id: 'USR-011',
    username: 'Anshory',
    password: '54321',
    namaLengkap: 'Abdulhaq Al Anshory',
    jabatan: 'Bendahara 2',
    toko: 'palen',
    role: 'FINANCE' as any,
    permissions: ['dashboard', 'absen', 'pelanggaran', 'finance'],
    foto: 'assets/foto_staf/anshory.jpg',
    is_active: true,
    email: 'anshory@kuk.co.id',
    phone: '081234567811',
  },
  {
    id: 'USR-012',
    username: 'Lintang',
    password: '54321',
    namaLengkap: 'Lintang Abimanyu',
    jabatan: 'Bendahara 1',
    toko: 'palen',
    role: 'FINANCE' as any,
    permissions: ['dashboard', 'absen', 'pelanggaran', 'finance'],
    foto: 'assets/foto_staf/lintang.jpg',
    is_active: true,
    email: 'lintang@kuk.co.id',
    phone: '081234567812',
  },
];

class UserAccountStore {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  public getUsers(): StoredStaffUser[] {
    const storage = this.getStorage();
    if (!storage) return DEFAULT_KUK_STAFF_USERS;
    try {
      const raw = storage.getItem(STORAGE_KEY_USERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out any legacy non-management worker login roles
          return parsed.filter(
            (u: any) =>
              !['kasir.latansa', 'cutter.latansa', 'driver.latansa'].includes(
                (u.username || '').toLowerCase()
              ) && !['KASIR', 'CUTTER', 'DRIVER'].includes(u.role)
          );
        }
      }
    } catch (e) {
      console.warn('[UserAccountStore] Error reading users from storage:', e);
    }
    // Initialize default if not present
    this.saveAllUsers(DEFAULT_KUK_STAFF_USERS);
    return DEFAULT_KUK_STAFF_USERS;
  }

  public saveAllUsers(users: StoredStaffUser[]): void {
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      } catch (e) {
        console.warn('[UserAccountStore] Error saving users to storage:', e);
      }
    }
  }

  public getUserById(id: string): StoredStaffUser | null {
    const users = this.getUsers();
    return users.find((u) => u.id === id) || null;
  }

  public getUserByUsername(username: string): StoredStaffUser | null {
    const clean = (username || '').trim().toLowerCase();
    const users = this.getUsers();
    return (
      users.find(
        (u) =>
          u.username.toLowerCase() === clean ||
          (u.email && u.email.toLowerCase() === clean) ||
          u.namaLengkap.toLowerCase() === clean
      ) || null
    );
  }

  public saveUser(
    user: Partial<StoredStaffUser> & { username: string; namaLengkap: string }
  ): { success: boolean; message: string; user?: StoredStaffUser } {
    const users = [...this.getUsers()];
    const cleanUsername = user.username.trim();

    if (!cleanUsername) {
      return { success: false, message: 'Username tidak boleh kosong.' };
    }
    if (!user.namaLengkap.trim()) {
      return { success: false, message: 'Nama lengkap staf wajib diisi.' };
    }

    // Check duplicate username if adding new
    const existingIdx = users.findIndex(
      (u) =>
        (user.id && u.id === user.id) ||
        u.username.toLowerCase() === cleanUsername.toLowerCase()
    );

    if (existingIdx >= 0) {
      // Update existing
      const existing = users[existingIdx];
      const updated: StoredStaffUser = {
        ...existing,
        ...user,
        username: cleanUsername,
        namaLengkap: user.namaLengkap.trim(),
        jabatan: user.jabatan?.trim() || existing.jabatan,
        password: user.password !== undefined ? user.password : existing.password,
        toko: user.toko || existing.toko,
        role: user.role || existing.role,
        is_active: user.is_active !== undefined ? user.is_active : existing.is_active,
        email: user.email || `${cleanUsername.toLowerCase()}@kuk.co.id`,
        updated_at: new Date().toISOString(),
      };
      users[existingIdx] = updated;
      this.saveAllUsers(users);
      return {
        success: true,
        message: `Akun staf "${updated.namaLengkap}" berhasil diperbarui.`,
        user: updated,
      };
    } else {
      // Create new
      const newId = user.id || `USR-${String(users.length + 1).padStart(3, '0')}`;
      const newUser: StoredStaffUser = {
        id: newId,
        username: cleanUsername,
        password: user.password || '12345',
        namaLengkap: user.namaLengkap.trim(),
        jabatan: user.jabatan?.trim() || 'Staf Operasional',
        toko: user.toko || 'bangunan',
        role: user.role || 'SUPERVISOR',
        permissions: user.permissions || ['dashboard', 'absen'],
        is_active: user.is_active !== undefined ? user.is_active : true,
        email: user.email || `${cleanUsername.toLowerCase()}@kuk.co.id`,
        phone: user.phone || '081234567890',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      users.push(newUser);
      this.saveAllUsers(users);
      return {
        success: true,
        message: `Akun staf baru "${newUser.namaLengkap}" berhasil ditambahkan.`,
        user: newUser,
      };
    }
  }

  public deleteUser(id: string): { success: boolean; message: string } {
    let users = this.getUsers();
    const target = users.find((u) => u.id === id);
    if (!target) {
      return { success: false, message: 'Akun staf tidak ditemukan.' };
    }
    // Prevent deleting the main coordinator
    if (target.username.toLowerCase() === 'fariz') {
      return { success: false, message: 'Akun Koordinator Utama (fariz) dilindungi dan tidak dapat dihapus.' };
    }
    users = users.filter((u) => u.id !== id);
    this.saveAllUsers(users);
    return { success: true, message: `Akun "${target.namaLengkap}" berhasil dihapus.` };
  }

  public resetToDefaults(): { success: boolean; message: string } {
    this.saveAllUsers(DEFAULT_KUK_STAFF_USERS);
    return { success: true, message: 'Daftar akun staf berhasil dikembalikan ke data bawaan resmi KUK.' };
  }

  /**
   * Autentikasi Staf:
   * Validasi username (case-insensitive) dan password.
   */
  public authenticate(
    usernameInput: string,
    passwordInput: string
  ): { success: boolean; message: string; user?: StoredStaffUser } {
    const cleanUser = (usernameInput || '').trim().toLowerCase();
    const cleanPass = (passwordInput || '').trim();

    if (!cleanUser) {
      return { success: false, message: 'Harap pilih atau masukkan nama akun staf.' };
    }
    if (!cleanPass) {
      return { success: false, message: 'Harap masukkan Kata Sandi.' };
    }

    const user = this.getUserByUsername(cleanUser);
    if (!user) {
      return { success: false, message: `Akun staf "${usernameInput}" tidak ditemukan dalam sistem.` };
    }

    if (!user.is_active) {
      return { success: false, message: `Akun staf "${user.namaLengkap}" berstatus NON-AKTIF. Hubungi Administrator.` };
    }

    if (user.password !== cleanPass) {
      return { success: false, message: 'Kata Sandi salah untuk akun yang dipilih.' };
    }

    // Persist active session in sessionStorage just like the reference site: 'kuk_user'
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const sessionData = {
        id: user.id,
        username: user.username,
        role: user.role,
        namaLengkap: user.namaLengkap,
        jabatan: user.jabatan,
        toko: user.toko,
        email: user.email,
        loginAt: new Date().toISOString(),
      };
      window.sessionStorage.setItem('kuk_user', JSON.stringify(sessionData));
      window.localStorage.setItem('kuk_selected_unit', user.toko === 'palen' ? 'palen' : 'bangunan');
    }

    return { success: true, message: 'Login berhasil.', user };
  }

  /**
   * Convert StoredStaffUser to a DemoIdentity for AuthContext integration
   * Staf resmi KUK memiliki akses penuh tanpa pembagian role yang membatasi
   */
  public mapToDemoIdentity(user: StoredStaffUser): DemoIdentity {
    const unitId =
      user.toko === 'palen'
        ? CANONICAL_DEMO_UNITS.PALEN.id
        : CANONICAL_DEMO_UNITS.LATANSA.id;

    const pimpinanIdentity = DEMO_IDENTITIES.PIMPINAN;

    return {
      ...pimpinanIdentity,
      label: `${user.namaLengkap} (${user.jabatan})`,
      badge: user.jabatan,
      role: 'PIMPINAN',
      unitScope: 'ALL',
      defaultUnitId: unitId,
      profile: {
        id: user.id,
        email: user.email || `${user.username}@kuk.co.id`,
        full_name: user.namaLengkap,
        phone_number: user.phone || '081234567890',
        is_active: user.is_active,
      },
    };
  }
}

export const userAccountStore = new UserAccountStore();
