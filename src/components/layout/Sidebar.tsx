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
  Truck,
  FileSearch,
  Settings,
  X,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const { hasPermission } = useAuth();
  const { activeUnitId } = useUnit();

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      to: '/employees',
      label: 'Master Karyawan',
      icon: Users,
      show: hasPermission('employees.view', activeUnitId),
    },
    {
      to: '/leave',
      label: 'Cuti Karyawan',
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
      to: '/violations',
      label: 'Pelanggaran & SP',
      icon: AlertTriangle,
      show: hasPermission('violations.view', activeUnitId),
    },
    {
      to: '/attendance',
      label: 'Presensi & Briefing',
      icon: Clock,
      show: hasPermission('attendance.view', activeUnitId),
    },
    {
      to: '/payroll',
      label: 'Penggajian / Payroll',
      icon: Banknote,
      show: hasPermission('payroll.view', activeUnitId),
    },
    {
      to: '/fleet',
      label: 'Armada Kendaraan',
      icon: Truck,
      show: hasPermission('fleet.view', activeUnitId),
    },
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
  ];

  const filteredNavItems = navItems.filter((item) => item.show);

  const navContent = (
    <>
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>Menu Operasional</span>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              aria-label="Tutup navigasi"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-kuk-maroon text-white shadow-xs'
                    : 'text-gray-700 hover:bg-kuk-maroon-50 hover:text-kuk-maroon'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
        KUK System v3.1.0 · Clean Rebuild
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between hidden md:flex shrink-0">
        {navContent}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer content */}
          <div className="relative w-72 max-w-[80vw] bg-white h-full p-4 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
