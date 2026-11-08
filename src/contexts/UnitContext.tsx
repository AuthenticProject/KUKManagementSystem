import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { Unit } from '@/types/auth';
import { supabase } from '@/services/supabase';
import { CANONICAL_DEMO_UNITS } from '@/services/demoAuth';

interface UnitContextType {
  activeUnit: Unit | null;
  activeUnitId: string | null;
  availableUnits: Unit[];
  isPusatView: boolean;
  setActiveUnitId: (unitId: string | null) => void;
  loading: boolean;
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { unitRoles, isAdminPusat, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [activeUnitId, setActiveUnitIdState] = useState<string | null>(null);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Muat seluruh unit jika memiliki hak akses pusat
  useEffect(() => {
    if (authLoading) return;

    if (isAdminPusat) {
      supabase
        .from('units')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => {
          if (data) {
            setAllUnits(data);
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [isAdminPusat, authLoading]);

  // Daftar unit yang dapat diakses oleh pengguna
  const availableUnits = useMemo(() => {
    if (isAdminPusat) {
      if (allUnits.length > 0) return allUnits;
      return [CANONICAL_DEMO_UNITS.LATANSA, CANONICAL_DEMO_UNITS.PALEN];
    }
    // Ekstrak unit unik dari penugasan unit_roles
    const unitMap = new Map<string, Unit>();
    unitRoles.forEach((ur) => {
      if (ur.unit && ur.unit.is_active) {
        unitMap.set(ur.unit.id, ur.unit);
      }
    });
    return Array.from(unitMap.values());
  }, [isAdminPusat, allUnits, unitRoles]);

  // Inisialisasi atau reset unit aktif saat login/ganti role
  useEffect(() => {
    if (loading || authLoading) return;

    // Jika activeUnitId saat ini tidak berada di daftar availableUnits, sinkronkan ulang
    if (activeUnitId !== null && !availableUnits.some((u) => u.id === activeUnitId)) {
      if (availableUnits.length === 1) {
        setActiveUnitIdState(availableUnits[0].id);
        return;
      } else if (isAdminPusat) {
        setActiveUnitIdState(null);
        return;
      }
    }

    // Jika belum memilih unit aktif
    if (!activeUnitId) {
      // 1. Jika staf hanya memiliki akses ke 1 unit: langsung tetapkan unit tersebut
      if (availableUnits.length === 1) {
        setActiveUnitIdState(availableUnits[0].id);
      } else if (availableUnits.length > 1) {
        // Cek apakah ada unit default
        const defaultRole = unitRoles.find((ur) => ur.is_default_unit);
        if (defaultRole) {
          setActiveUnitIdState(defaultRole.unit_id);
        } else if (isAdminPusat) {
          // Admin Pusat default ke tampilan agregat (null = PUSAT)
          setActiveUnitIdState(null);
        } else {
          setActiveUnitIdState(availableUnits[0].id);
        }
      }
    }
  }, [availableUnits, activeUnitId, unitRoles, isAdminPusat, loading, authLoading]);

  // Handler pergantian unit dengan validasi hak akses dan pembersihan cache total
  const setActiveUnitId = (newUnitId: string | null) => {
    if (newUnitId === activeUnitId) return;

    // 1. Validasi hak akses: Pengguna tidak dapat memilih unit di luar daftar hak aksesnya
    if (newUnitId !== null) {
      const isAllowed = availableUnits.some((u) => u.id === newUnitId);
      if (!isAllowed) {
        console.warn(`[UnitContext Security] Percobaan akses unit tidak sah: ${newUnitId}`);
        return;
      }
    } else {
      // 2. Mode agregat Pusat (null) hanya boleh diakses oleh Super Admin atau Admin Pusat
      if (!isAdminPusat) {
        console.warn('[UnitContext Security] Mode agregat Pusat ditolak: tidak memiliki hak akses pusat.');
        return;
      }
    }

    setActiveUnitIdState(newUnitId);

    // 3. Bersihkan seluruh query cache untuk mencegah kebocoran data sisa antar unit
    queryClient.clear();
  };

  const activeUnit = useMemo(() => {
    if (!activeUnitId) return null;
    return availableUnits.find((u) => u.id === activeUnitId) ?? null;
  }, [activeUnitId, availableUnits]);

  const isPusatView = activeUnitId === null && isAdminPusat;

  return (
    <UnitContext.Provider
      value={{
        activeUnit,
        activeUnitId,
        availableUnits,
        isPusatView,
        setActiveUnitId,
        loading: loading || authLoading,
      }}
    >
      {children}
    </UnitContext.Provider>
  );
};

export const useUnit = () => {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error('useUnit must be used within a UnitProvider');
  }
  return context;
};
