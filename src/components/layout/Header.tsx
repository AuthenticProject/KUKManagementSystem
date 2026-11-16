import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import { Building2, ChevronDown, Check, LogOut, Menu, ShieldCheck } from 'lucide-react';
import { getUnitBrandInfo } from '@/utils/brandAssets';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { profile, isAdminPusat, signOut, isDemoMode } = useAuth();
  const { activeUnit, activeUnitId, availableUnits, isPusatView, setActiveUnitId } = useUnit();

  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const unitMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Active brand info based on current unit
  const brand = getUnitBrandInfo(activeUnit, isPusatView);

  // Close dropdowns on outside click
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
      {/* Demo / UAT Safeguard Banner */}
      {isDemoMode && (
        <div className="bg-[#FFCC00] text-[#540000] px-4 py-1.5 text-xs font-semibold flex flex-wrap items-center justify-between border-b border-[#996414]/30 shadow-xs z-40 sticky top-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#540000] text-[#FFCC00] text-[10px] uppercase tracking-wider font-extrabold shadow-2xs">
              LOCAL DEMO / UAT
            </span>
            <span>
              Simulasi Offline: <strong className="font-bold">{profile?.full_name}</strong>
              {activeUnit && <span className="ml-1 text-[#540000]/80">({activeUnit.name})</span>}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#540000]/80 hidden sm:inline">
              (Terisolasi Penuh · 0 Panggilan Remote Production)
            </span>
            <button
              onClick={() => signOut()}
              className="px-2.5 py-0.5 rounded-md bg-[#540000]/10 hover:bg-[#540000]/20 text-xs font-bold text-[#540000] transition-colors"
            >
              Keluar Demo
            </button>
          </div>
        </div>
      )}

      {/* Main Top Header */}
      <header
        className={`h-16 bg-white border-b border-[#E5E5E5] px-4 sm:px-6 flex items-center justify-between z-30 shadow-xs ${
          isDemoMode ? 'sticky top-7' : 'sticky top-0'
        }`}
      >
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <img
              src={brand.logoHorizontal}
              alt={brand.name}
              className="h-9 sm:h-10 w-auto object-contain select-none"
            />
            <div className="hidden lg:flex flex-col ml-1 pl-3 border-l border-gray-200">
              <span className="text-xs font-extrabold text-[#540000] tracking-tight uppercase font-display">
                {brand.name}
              </span>
              <span className="text-[10px] text-gray-500 font-medium">
                {brand.subtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right: Unit Selector & Profile */}
        <div className="flex items-center gap-3">
          {/* Unit Selector Dropdown */}
          <div className="relative" ref={unitMenuRef}>
            <button
              onClick={() => setUnitMenuOpen(!unitMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E5E5E5] hover:border-[#540000]/30 bg-[#F8F9FA] hover:bg-white transition-all text-xs sm:text-sm font-semibold text-gray-800 shadow-2xs"
            >
              <div className="w-5 h-5 rounded-md bg-[#540000]/5 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 text-[#540000]" />
              </div>
              <span className="max-w-[120px] sm:max-w-[200px] truncate">
                {isPusatView ? (
                  <span className="text-[#540000] font-bold">Semua Unit (Pusat)</span>
                ) : activeUnit ? (
                  activeUnit.name
                ) : (
                  'Pilih Unit'
                )}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </button>

            {unitMenuOpen && (
              <div className="absolute right-0 sm:left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#E5E5E5] py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1 flex items-center justify-between">
                  <span>Pilih Konteks Unit Kerja</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#996414]" />
                </div>

                {/* Central / All Units Option for Executive */}
                {isAdminPusat && (
                  <button
                    onClick={() => {
                      setActiveUnitId(null);
                      setUnitMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between hover:bg-[#FDF2F2] transition-colors ${
                      isPusatView ? 'bg-[#FDF2F2] text-[#540000] font-bold' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#540000] text-white flex items-center justify-center font-bold text-xs">
                        K
                      </div>
                      <div>
                        <div className="font-bold text-[#540000]">Pusat Operasional (Agregat)</div>
                        <div className="text-[10px] text-gray-500">Konsolidasi seluruh unit bisnis</div>
                      </div>
                    </div>
                    {isPusatView && <Check className="w-4 h-4 text-[#540000]" />}
                  </button>
                )}

                {/* Individual Units */}
                <div className="py-1">
                  {availableUnits.map((unit) => {
                    const isSelected = !isPusatView && activeUnitId === unit.id;
                    const unitBrand = getUnitBrandInfo(unit);
                    return (
                      <button
                        key={unit.id}
                        onClick={() => {
                          setActiveUnitId(unit.id);
                          setUnitMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between hover:bg-[#FDF2F2] transition-colors ${
                          isSelected ? 'bg-[#FDF2F2] text-[#540000] font-bold' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={unitBrand.logoEmblem}
                            alt=""
                            className="w-7 h-7 object-contain rounded-md bg-gray-50 p-0.5 border border-gray-100"
                          />
                          <div>
                            <div className="font-semibold text-gray-900">{unit.name}</div>
                            <div className="text-[10px] text-gray-500">{unit.code} · {unitBrand.subtitle}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#540000]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Actions */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none"
              aria-label="Menu pengguna"
            >
              <div className="w-8 h-8 rounded-xl bg-[#540000] text-[#FFCC00] flex items-center justify-center font-bold text-xs shadow-xs">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-gray-900 max-w-[120px] truncate leading-tight">
                  {profile?.full_name || 'Staf KUK'}
                </span>
                <span className="text-[10px] text-gray-500 font-medium">
                  {isPusatView ? 'Pimpinan Pusat' : activeUnit?.code || 'Unit Staf'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#E5E5E5] py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="font-bold text-sm text-gray-900">{profile?.full_name}</div>
                  <div className="text-xs text-gray-500 truncate">{profile?.email}</div>
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FCE7E7] text-[#540000] border border-[#F7C5C5]">
                    {isPusatView ? 'Pimpinan / Executive' : activeUnit?.name || 'Staf Operasional'}
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false);
                      signOut();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-semibold"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar dari Sesi</span>
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
