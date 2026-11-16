import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Scissors,
  AlertTriangle,
  Clock,
  Banknote,
  Wallet,
  Truck,
  FileSearch,
  Settings,
  X,
  ExternalLink,
} from 'lucide-react';
import { getUnitBrandInfo } from '@/utils/brandAssets';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const { hasPermission } = useAuth();
  const { activeUnit, activeUnitId, isPusatView } = useUnit();

  const brand = getUnitBrandInfo(activeUnit, isPusatView);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const navGroups = [
    {
      groupTitle: 'UTAMA',
      items: [
        {
          to: '/dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          show: true,
        },
      ],
    },
    {
      groupTitle: 'OPERASIONAL & SDM',
      items: [
        {
          to: '/employees',
          label: 'Data Karyawan',
          icon: Users,
          show: hasPermission('employees.view', activeUnitId),
        },
        {
          to: '/attendance',
          label: 'Presensi & Briefing',
          icon: Clock,
          show: hasPermission('attendance.view', activeUnitId),
        },
        {
          to: '/leave',
          label: 'Pengajuan Cuti',
          icon: CalendarDays,
          show: hasPermission('leave.view', activeUnitId),
        },
        {
          to: '/glass-tips',
          label: 'Tip Potong Kaca',
          icon: Scissors,
          show: hasPermission('glass_tips.view', activeUnitId),
        },
        {
          to: '/fleet',
          label: 'Armada Kendaraan',
          icon: Truck,
          show: hasPermission('fleet.view', activeUnitId),
        },
        {
          to: '/violations',
          label: 'Pelanggaran & SP',
          icon: AlertTriangle,
          show: hasPermission('violations.view', activeUnitId),
        },
      ],
    },
    {
      groupTitle: 'KEUANGAN & PAYROLL',
      items: [
        {
          to: '/payroll',
          label: 'Penggajian / Payroll',
          icon: Banknote,
          show: hasPermission('payroll.view', activeUnitId),
        },
        {
          to: '/finance',
          label: 'Kas & Pengeluaran',
          icon: Wallet,
          show: hasPermission('payroll.view', activeUnitId) || hasPermission('finance.view', activeUnitId),
        },
      ],
    },
    {
      groupTitle: 'SISTEM & AUDIT',
      items: [
        {
          to: '/audit-logs',
          label: 'Audit & Jejak Mutasi',
          icon: FileSearch,
          show: hasPermission('audit_logs.view', activeUnitId),
        },
        {
          to: '/settings',
          label: 'Pengaturan Sistem',
          icon: Settings,
          show: hasPermission('settings.manage', activeUnitId),
        },
      ],
    },
  ];

  const navContent = (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Brand Header inside Sidebar */}
        <div className="px-4 py-4 mb-2 border-b border-[#3B0000] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={brand.logoEmblem}
              alt={brand.name}
              className="w-8 h-8 object-contain rounded-lg bg-white/10 p-0.5"
            />
            <div>
              <div className="text-xs font-black text-white tracking-wider uppercase font-display">
                {brand.badgeLabel}
              </div>
              <div className="text-[10px] text-[#FFCC00] font-semibold tracking-tight">
                {isPusatView ? 'KONSOLIDASI PUSAT' : activeUnit?.code || 'SISTEM OPERASIONAL'}
              </div>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              aria-label="Tutup navigasi"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <div className="space-y-4 px-2">
          {navGroups.map((group, gIdx) => {
            const visibleItems = group.items.filter((item) => item.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-extrabold text-[#FFCC00]/80 uppercase tracking-widest">
                  {group.groupTitle}
                </div>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => {
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all select-none ${
                          isActive
                            ? 'bg-[#3B0000] text-white shadow-xs border-l-4 border-[#FFCC00] pl-2 font-bold'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0 text-[#FFCC00]" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Information */}
      <div className="p-3 border-t border-[#3B0000] mt-4">
        <div className="p-2.5 rounded-xl bg-[#3B0000]/60 border border-[#996414]/30 text-white/90">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#FFCC00] mb-0.5">
            <span>Kiosk Mandiri</span>
            <ExternalLink className="w-3 h-3 text-[#FFCC00]" />
          </div>
          <p className="text-[10px] text-white/70 leading-relaxed">
            Formulir publik mandiri untuk pemotongan kaca, armada, dan cuti.
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <a
              href="/public/glass-tip"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 hover:bg-[#FFCC00] hover:text-[#540000] transition-colors"
            >
              Tip Kaca
            </a>
            <a
              href="/public/fleet-booking"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 hover:bg-[#FFCC00] hover:text-[#540000] transition-colors"
            >
              Armada
            </a>
            <a
              href="/public/leave-request"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 hover:bg-[#FFCC00] hover:text-[#540000] transition-colors"
            >
              Cuti
            </a>
          </div>
        </div>

        <div className="mt-2 text-center text-[10px] text-white/40 font-medium">
          KUK System v3.1.0 · Official Brand
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Deep Maroon #540000 with Geometric Pattern Overlay) */}
      <aside className="w-64 bg-[#540000] border-r border-[#3B0000] min-h-[calc(100vh-4rem)] flex flex-col justify-between hidden md:flex shrink-0 shadow-lg relative z-20">
        <div
          className="absolute inset-0 pointer-events-none opacity-5 bg-repeat"
          style={{ backgroundImage: 'url(/brand/patterns/pattern-dark.png)' }}
        />
        <div className="relative z-10 flex-1 flex flex-col justify-between">
          {navContent}
        </div>
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-[#540000] h-full flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div
              className="absolute inset-0 pointer-events-none opacity-5 bg-repeat"
              style={{ backgroundImage: 'url(/brand/patterns/pattern-dark.png)' }}
            />
            <div className="relative z-10 flex-1 flex flex-col justify-between p-2">
              {navContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
