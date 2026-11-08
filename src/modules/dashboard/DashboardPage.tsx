import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import { systemService } from '@/services/dataService';
import {
  Building2,
  Users,
  Calendar,
  Scissors,
  Truck,
  AlertTriangle,
  Clock,
  Banknote,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, isSuperAdmin, isAdminPusat, hasPermission } = useAuth();
  const { activeUnit, activeUnitId, isPusatView } = useUnit();

  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<any>(null);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await systemService.getDashboardSummary(activeUnitId || '');
      setSummary(data);
    } catch {
      // Handled cleanly
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [activeUnitId]);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

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
            {summary?.isFixture && (
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                Mode Pratinjau Terisolasi
              </span>
            )}
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

        <div className="flex items-center gap-3">
          <button
            onClick={loadSummary}
            disabled={loading}
            className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
            title="Muat Ulang Ringkasan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-kuk-maroon' : ''}`} />
          </button>
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/80 text-xs text-gray-600 sm:text-right shrink-0">
            <div className="font-semibold text-gray-900">
              {isSuperAdmin ? 'Super Administrator' : isAdminPusat ? 'Admin Pusat' : 'Staf Unit'}
            </div>
            <div className="text-gray-500">KUK Enterprise v3.1.0</div>
          </div>
        </div>
      </div>

      {/* Error Alert Banner */}
      {summary?.error && !loading && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Perhatian:</strong> {summary.error}
            </span>
          </div>
          <button
            onClick={loadSummary}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline ml-3 shrink-0"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Fixture Alert Banner */}
      {summary?.isFixture && !summary?.error && !loading && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Zero-State Preview Mode:</strong> Mode simulasi aktif. Seluruh metrik agregat di bawah ini dihitung dari data contoh lokal.
          </span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Karyawan */}
        <div
          onClick={() => hasPermission('employees.view', activeUnitId) && navigate('/employees')}
          className={`bg-white p-5 rounded-2xl border border-gray-200 shadow-xs transition-all ${
            hasPermission('employees.view', activeUnitId) ? 'hover:border-kuk-maroon/40 hover:shadow-md cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Karyawan Aktif</span>
            <div className="p-2 bg-kuk-maroon-50 rounded-lg text-kuk-maroon">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? '...' : `${summary?.employees?.active || 0} Staf`}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
            <span>Total: {summary?.employees?.total || 0} Terdaftar</span>
            <span className="text-emerald-700 font-semibold">{summary?.employees?.active || 0} Aktif</span>
          </div>
        </div>

        {/* 2. Presensi Hari Ini */}
        <div
          onClick={() => hasPermission('attendance.view', activeUnitId) && navigate('/attendance')}
          className={`bg-white p-5 rounded-2xl border border-gray-200 shadow-xs transition-all ${
            hasPermission('attendance.view', activeUnitId) ? 'hover:border-blue-400 hover:shadow-md cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Presensi Hari Ini</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? '...' : `${summary?.attendance?.present || 0} Hadir`}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            {summary?.attendance?.late > 0 && (
              <span className="text-amber-700 font-semibold">{summary?.attendance?.late} Terlambat</span>
            )}
            {summary?.attendance?.absent > 0 && (
              <span className="text-red-600 font-semibold">{summary?.attendance?.absent} Mangkir</span>
            )}
            {summary?.attendance?.late === 0 && summary?.attendance?.absent === 0 && (
              <span className="text-emerald-700 font-semibold">Tepat Waktu</span>
            )}
          </div>
        </div>

        {/* 3. Permohonan Cuti Pending */}
        <div
          onClick={() => hasPermission('leave.view', activeUnitId) && navigate('/leave')}
          className={`bg-white p-5 rounded-2xl border border-gray-200 shadow-xs transition-all ${
            hasPermission('leave.view', activeUnitId) ? 'hover:border-amber-400 hover:shadow-md cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Permohonan Cuti</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? '...' : `${summary?.leaves?.pending || 0} Menunggu`}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
            <span>Disetujui: {summary?.leaves?.approved || 0}</span>
            <span className="text-kuk-maroon font-semibold">Max 3 Hari/Bulan</span>
          </div>
        </div>

        {/* 4. Tip Potong Kaca Pending */}
        <div
          onClick={() => hasPermission('glass_tips.view', activeUnitId) && navigate('/glass-tips')}
          className={`bg-white p-5 rounded-2xl border border-gray-200 shadow-xs transition-all ${
            hasPermission('glass_tips.view', activeUnitId) ? 'hover:border-kuk-gold hover:shadow-md cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tip Kaca Pending</span>
            <div className="p-2 bg-kuk-gold/10 rounded-lg text-kuk-gold">
              <Scissors className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? '...' : `${summary?.glassTips?.pending || 0} Nota`}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
            <span>Terverifikasi: {summary?.glassTips?.verifiedCount || 0}</span>
            <span className="font-semibold text-kuk-maroon">{formatRupiah(summary?.glassTips?.totalAmount || 0)}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Fleet, Violations, Payroll & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operational Cards (2 Columns on Large Screens) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
            <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-kuk-maroon" />
              <span>Status Operasional Unit Terkini</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Fleet status */}
              <div
                onClick={() => hasPermission('fleet.view', activeUnitId) && navigate('/fleet')}
                className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 hover:bg-gray-100/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-1">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Peminjaman Armada</span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {loading ? '...' : `${summary?.fleet?.pending || 0} Pengajuan`}
                </div>
                <div className="text-2xs text-gray-500 mt-1">
                  Disetujui: {summary?.fleet?.approved || 0} Peminjaman
                </div>
              </div>

              {/* Violations status */}
              <div
                onClick={() => hasPermission('violations.view', activeUnitId) && navigate('/violations')}
                className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 hover:bg-gray-100/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Pelanggaran & SP</span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {loading ? '...' : `${summary?.violations?.total || 0} Kasus`}
                </div>
                <div className="text-2xs text-gray-500 mt-1">
                  Kepatuhan SOP Ketenagakerjaan
                </div>
              </div>

              {/* Payroll status */}
              <div
                onClick={() => hasPermission('payroll.view', activeUnitId) && navigate('/payroll')}
                className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 hover:bg-gray-100/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-1">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>Periode Penggajian</span>
                </div>
                <div className="text-sm font-bold text-gray-900 truncate">
                  {loading ? '...' : summary?.payroll?.currentPeriod}
                </div>
                <div className="text-2xs text-gray-500 mt-1">
                  Status: <span className="font-semibold text-kuk-maroon">{summary?.payroll?.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
            <h3 className="font-bold text-gray-900 text-sm mb-3">Pintasan Menu Cepat Operasional</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {hasPermission('glass_tips.verify', activeUnitId) && (
                <button
                  onClick={() => navigate('/glass-tips')}
                  className="p-3 bg-gray-50 hover:bg-kuk-maroon-50 hover:text-kuk-maroon rounded-xl border border-gray-200 text-left transition-colors text-xs font-semibold flex flex-col justify-between h-20"
                >
                  <Scissors className="w-4 h-4 text-kuk-maroon mb-1" />
                  <span>Verifikasi Nota Tip</span>
                </button>
              )}
              {hasPermission('leave.approve', activeUnitId) && (
                <button
                  onClick={() => navigate('/leave')}
                  className="p-3 bg-gray-50 hover:bg-amber-50 hover:text-amber-800 rounded-xl border border-gray-200 text-left transition-colors text-xs font-semibold flex flex-col justify-between h-20"
                >
                  <Calendar className="w-4 h-4 text-amber-600 mb-1" />
                  <span>Persetujuan Cuti</span>
                </button>
              )}
              {hasPermission('fleet.approve_borrowing', activeUnitId) && (
                <button
                  onClick={() => navigate('/fleet')}
                  className="p-3 bg-gray-50 hover:bg-blue-50 hover:text-blue-800 rounded-xl border border-gray-200 text-left transition-colors text-xs font-semibold flex flex-col justify-between h-20"
                >
                  <Truck className="w-4 h-4 text-blue-600 mb-1" />
                  <span>Persetujuan Armada</span>
                </button>
              )}
              {hasPermission('attendance.manage', activeUnitId) && (
                <button
                  onClick={() => navigate('/attendance')}
                  className="p-3 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl border border-gray-200 text-left transition-colors text-xs font-semibold flex flex-col justify-between h-20"
                >
                  <Clock className="w-4 h-4 text-emerald-600 mb-1" />
                  <span>Kelola Presensi</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Public Kiosk / Form Shortcuts */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-kuk-maroon to-kuk-maroon-900 text-white rounded-2xl p-6 shadow-md">
            <h3 className="font-bold text-base mb-1">Portal Mandiri & Kiosk</h3>
            <p className="text-xs text-white/80 mb-4 leading-relaxed">
              Tautan langsung formulir publik mandiri untuk karyawan dan peminjam armada (mobile-friendly).
            </p>

            <div className="space-y-2.5">
              <a
                href="/public/glass-tip"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-xs font-semibold text-white border border-white/10"
              >
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-kuk-gold" />
                  <span>Kiosk Tip Potong Kaca</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/70" />
              </a>

              <a
                href="/public/fleet-booking"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-xs font-semibold text-white border border-white/10"
              >
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-300" />
                  <span>Form Reservasi Armada</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/70" />
              </a>

              <a
                href="/public/leave-request"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-xs font-semibold text-white border border-white/10"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-300" />
                  <span>Portal Cuti Mandiri (PIN)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/70" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
