import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import { Building2, ChevronDown, Check, LogOut, User as UserIcon, Shield, Menu } from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { profile, isSuperAdmin, isAdminPusat, signOut } = useAuth();
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
    <header className="h-16 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
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
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900 truncate">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
              </div>

              <div className="p-1">
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    signOut();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar Sistem
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
