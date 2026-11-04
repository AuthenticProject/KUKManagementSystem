import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import { Building2, Users, Calendar, Scissors, Truck, AlertCircle, ShieldCheck } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { profile, isSuperAdmin, isAdminPusat } = useAuth();
  const { activeUnit, isPusatView } = useUnit();

  return (
    <div className="space-y-6">
      {/* Top Banner / Context Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-kuk-maroon-50 text-kuk-maroon border border-kuk-maroon-100 flex items-center gap-1.5">
              {isPusatView ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-kuk-gold" />
                  Konteks: Dashboard Pusat (Seluruh Unit)
                </>
              ) : (
                <>
                  <Building2 className="w-3.5 h-3.5 text-kuk-maroon" />
                  Konteks Unit: {activeUnit?.name || 'Unit Belum Dipilih'}
                </>
              )}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Selamat Datang, {profile?.full_name || 'Staf'}
          </h2>
          <p className="text-sm text-gray-500">
            {isPusatView
              ? 'Tampilan agregat eksekutif lintas seluruh unit bisnis KUK (TB KUK La Tansa & KUK Palen).'
              : `Operasional aktif untuk unit ${activeUnit?.name || ''} (${activeUnit?.code || ''}).`}
          </p>
        </div>

        {/* Quick Context Indicator */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/80 text-xs text-gray-600 sm:text-right shrink-0">
          <div className="font-semibold text-gray-900">
            {isSuperAdmin ? 'Super Administrator' : isAdminPusat ? 'Admin Pusat' : 'Staf Unit'}
          </div>
          <div className="text-gray-500">KUK Enterprise v3.1.0</div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Karyawan Aktif</span>
            <Users className="w-4 h-4 text-kuk-maroon" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {isPusatView ? '11 Staf' : activeUnit?.code === 'TB-LATANSA' ? '9 Staf' : '2 Staf'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Master SDM Terverifikasi</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cuti Bulan Ini</span>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">Jendela Aktif</div>
          <div className="text-xs text-gray-500 mt-1">Kuota Max 3 Hari/Bulan</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tip Potong Kaca</span>
            <Scissors className="w-4 h-4 text-kuk-gold" />
          </div>
          <div className="text-2xl font-bold text-gray-900">Tarif 3%</div>
          <div className="text-xs text-gray-500 mt-1">Dari Harga Jual Kaca Valid</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Armada Operasional</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">Tersedia</div>
          <div className="text-xs text-gray-500 mt-1">Exclusion Double-Booking Lock</div>
        </div>
      </div>

      {/* Status Phase 1 Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-blue-900">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Fondasi Aplikasi Phase 1 Berjalan</h4>
            <p className="text-xs text-blue-700 mt-1">
              Unit context switcher, route guards berbasis RBAC, dan Supabase Auth terisolasi telah aktif. Sesuai batasan Phase 1, seluruh koneksi diarahkan ke environment staging/lokal tanpa menyentuh database produksi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

