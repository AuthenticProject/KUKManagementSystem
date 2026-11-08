import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import { Building2, ChevronDown, Check, LogOut, User as UserIcon, Shield, Menu, Sparkles } from 'lucide-react';
import { DEMO_IDENTITIES, DemoIdentityKey } from '@/services/demoAuth';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { profile, isSuperAdmin, isAdminPusat, signOut, isDemoMode, activeDemoKey, loginAsDemo } = useAuth();
  const { activeUnit, activeUnitId, availableUnits, isPusatView, setActiveUnitId } = useUnit();

  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const unitMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (unitMenuRef.current && !unitMenuRef.current.contains(event.target as Node)) {
        setUnitMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {isDemoMode && (
        <div className="bg-amber-400 text-amber-950 px-4 py-1 text-xs font-semibold flex flex-wrap items-center justify-between border-b border-amber-500 shadow-xs z-40 sticky top-0">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-amber-900 text-amber-100 text-[10px] uppercase tracking-wider font-extrabold">
              DEMO / UAT
            </span>
            <span>
              Mode Pengujian Lokal: <strong>{profile?.full_name}</strong>
              {activeUnit && <span className="ml-1 text-amber-950">({activeUnit.name})</span>}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-amber-900 hidden sm:inline">
              (Simulasi Offline · Tanpa Database Production)
            </span>
            <button
              onClick={() => signOut()}
              className="px-2 py-0.5 rounded bg-amber-950/15 hover:bg-amber-950/25 text-xs font-bold text-amber-950 transition-colors"
            >
              Keluar Demo
            </button>
          </div>
        </div>
      )}

      <header className={`h-16 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between z-30 shadow-xs ${isDemoMode ? 'sticky top-7' : 'sticky top-0'}`}>
        {/* Brand & Active Unit Badge */}
        <div className="flex items-center gap-3 sm:gap-4">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
            aria-label="Buka menu navigasi"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-kuk-maroon flex items-center justify-center text-white font-bold text-lg shadow-sm">
            K
          </div>
          <span className="font-bold text-gray-900 tracking-tight hidden sm:inline-block">
            KUK <span className="text-kuk-gold font-semibold text-xs ml-1 px-1.5 py-0.5 rounded bg-kuk-maroon-50 border border-kuk-maroon-100">V3</span>
          </span>
        </div>

        {/* Unit Selector Dropdown */}
        <div className="relative" ref={unitMenuRef}>
          <button
            onClick={() => setUnitMenuOpen(!unitMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-kuk-maroon-200 bg-gray-50 hover:bg-kuk-maroon-50/50 transition-colors text-sm font-medium text-gray-800"
          >
            <Building2 className="w-4 h-4 text-kuk-maroon shrink-0" />
            <span className="max-w-[130px] sm:max-w-[220px] truncate">
              {isPusatView ? (
                <span className="text-kuk-maroon font-semibold">Semua Unit (Pusat)</span>
              ) : activeUnit ? (
                activeUnit.name
              ) : (
                'Pilih Unit'
              )}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
          </button>

          {unitMenuOpen && (
            <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1">
                Pilih Konteks Unit Kerja
              </div>

              {/* Opsi Agregat Pusat jika memiliki hak akses pusat */}
              {isAdminPusat && (
                <button
                  onClick={() => {
                    setActiveUnitId(null);
                    setUnitMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-kuk-maroon-50/60 transition-colors ${
                    isPusatView ? 'bg-kuk-maroon-50 text-kuk-maroon font-semibold' : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-kuk-gold" />
                    <div>
                      <div className="font-medium">Dashboard Pusat (Agregat)</div>
                      <div className="text-xs text-gray-500">Lintas Seluruh Unit Bisnis</div>
                    </div>
                  </div>
                  {isPusatView && <Check className="w-4 h-4 text-kuk-maroon" />}
                </button>
              )}

              {/* Daftar Unit */}
              {availableUnits.map((unit) => {
                const isSelected = activeUnitId === unit.id;
                return (
                  <button
                    key={unit.id}
                    onClick={() => {
                      setActiveUnitId(unit.id);
                      setUnitMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-kuk-maroon-50/60 transition-colors ${
                      isSelected ? 'bg-kuk-maroon-50 text-kuk-maroon font-semibold' : 'text-gray-700'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{unit.name}</div>
                      <div className="text-xs text-gray-500">
                        Kode: {unit.code} · {unit.business_type}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-kuk-maroon" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* User Profile & Actions */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-kuk-maroon-100 text-kuk-maroon flex items-center justify-center font-semibold text-sm">
              {profile?.full_name?.charAt(0) || <UserIcon className="w-4 h-4" />}
            </div>
            <div className="hidden md:block text-left text-xs">
              <div className="font-semibold text-gray-800 leading-tight">
                {profile?.full_name || 'Staf KUK'}
              </div>
              <div className="text-gray-500">
                {isSuperAdmin ? 'Super Admin' : isAdminPusat ? 'Admin Pusat' : 'Staf Operasional'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden md:block" />
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 truncate">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
                {isDemoMode && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Akun UAT Offline
                  </span>
                )}
              </div>

              {isDemoMode && (
                <div className="px-3 py-2 border-b border-gray-100 bg-amber-50/70">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Ganti Peran UAT</span>
                  </div>
                  <div className="space-y-1">
                    {(Object.keys(DEMO_IDENTITIES) as DemoIdentityKey[]).map((key) => {
                      const item = DEMO_IDENTITIES[key];
                      const isCurrent = activeDemoKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            loginAsDemo(key);
                            setProfileMenuOpen(false);
                          }}
                          className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between transition-colors ${
                            isCurrent
                              ? 'bg-amber-200 text-amber-950 font-bold'
                              : 'hover:bg-amber-100/70 text-gray-700'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {isCurrent && <Check className="w-3 h-3 text-amber-950 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-1">
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    signOut();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  {isDemoMode ? 'Keluar dari Demo' : 'Keluar Sistem'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  </>
);
};
