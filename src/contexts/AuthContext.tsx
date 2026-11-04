import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { Profile, UserUnitRole, UserSystemRole } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  systemRoles: UserSystemRole[];
  unitRoles: UserUnitRole[];
  isSuperAdmin: boolean;
  isAdminPusat: boolean;
  hasPermission: (permissionCode: string, unitId?: string | null) => boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [systemRoles, setSystemRoles] = useState<UserSystemRole[]>([]);
  const [unitRoles, setUnitRoles] = useState<UserUnitRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Muat data profil, roles, dan permissions pengguna
  const loadUserData = async (userId: string) => {
    try {
      // 1. Profil pengguna
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (prof) {
        setProfile(prof);
      }

      // 2. Role sistem global (misal: super_admin, admin_pusat)
      const { data: sysRoles } = await supabase
        .from('user_system_roles')
        .select('*, role:roles(*, permissions:role_permissions(permission:permissions(*)))')
        .eq('user_id', userId);

      if (sysRoles) {
        const formattedSysRoles: UserSystemRole[] = sysRoles.map((sr: any) => ({
          user_id: sr.user_id,
          role_id: sr.role_id,
          role: sr.role,
          permissions: sr.role?.permissions?.map((p: any) => p.permission) || [],
        }));
        setSystemRoles(formattedSysRoles);
      }

      // 3. Role per unit kerja
      const { data: uRoles } = await supabase
        .from('user_unit_roles')
        .select('*, unit:units(*), role:roles(*, permissions:role_permissions(permission:permissions(*)))')
        .eq('user_id', userId);

      if (uRoles) {
        const formattedUnitRoles: UserUnitRole[] = uRoles.map((ur: any) => ({
          id: ur.id,
          user_id: ur.user_id,
          unit_id: ur.unit_id,
          role_id: ur.role_id,
          is_default_unit: ur.is_default_unit,
          unit: ur.unit,
          role: ur.role,
          permissions: ur.role?.permissions?.map((p: any) => p.permission) || [],
        }));
        setUnitRoles(formattedUnitRoles);
      }
    } catch (err) {
      console.error('[AuthContext] Gagal memuat data otorisasi:', err);
    }
  };

  useEffect(() => {
    // Periksa sesi aktif saat inisialisasi
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listener perubahan state autentikasi (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setProfile(null);
        setSystemRoles([]);
        setUnitRoles([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isSuperAdmin = useMemo(() => {
    return systemRoles.some((sr) => sr.role.code === 'super_admin');
  }, [systemRoles]);

  const isAdminPusat = useMemo(() => {
    return isSuperAdmin || systemRoles.some((sr) => sr.role.code === 'admin_pusat');
  }, [isSuperAdmin, systemRoles]);

  // Evaluasi granular permission
  const hasPermission = (permissionCode: string, unitId?: string | null): boolean => {
    if (isSuperAdmin) return true;

    // Cek izin dari role sistem global
    const hasGlobalPerm = systemRoles.some((sr) =>
      sr.permissions.some((p) => p.code === permissionCode)
    );
    if (hasGlobalPerm) return true;

    if (!unitId) return false;

    // Cek izin dari penugasan unit tertentu
    return unitRoles.some(
      (ur) =>
        ur.unit_id === unitId &&
        ur.permissions.some((p) => p.code === permissionCode)
    );
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setSystemRoles([]);
    setUnitRoles([]);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        systemRoles,
        unitRoles,
        isSuperAdmin,
        isAdminPusat,
        hasPermission,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

