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
  Wallet,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { getUnitBrandInfo } from '@/utils/brandAssets';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, isSuperAdmin, isAdminPusat, hasPermission } = useAuth();
  const { activeUnit, activeUnitId, isPusatView } = useUnit();

  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<any>(null);

  const brand = getUnitBrandInfo(activeUnit, isPusatView);

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
      {/* Top Banner / Executive Context Card */}
      <div className="bg-white rounded-3xl border border-[#E5E5E5] p-6 sm:p-7 shadow-brand-card flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle gold line on top of card */}
        <div className="absolute top-0 inset-x-0 h-1 bg-[#FFCC00]" />

        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#FCE7E7] text-[#540000] border border-[#F7C5C5] flex items-center gap-1.5 shadow-2xs">
              {isPusatView ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#996414]" />
                  <span>Konteks: Dashboard Pusat (Seluruh Unit Bisnis)</span>
                </>
              ) : (
                <>
                  <Building2 className="w-3.5 h-3.5 text-[#540000]" />
                  <span>Konteks Unit: {activeUnit?.name || 'Unit Belum Dipilih'}</span>
                </>
              )}
            </span>

            {summary?.isFixture && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#FFF9D6] text-[#996414] border border-[#FFE066]">
                Mode Pratinjau Terisolasi
              </span>
            )}

            {summary?.pendingActions > 0 && (
              <span
                data-testid="dashboard-pending-actions"
                className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-red-50 text-[#FF0000] border border-red-200 animate-pulse flex items-center gap-1"
              >
                <span>{summary.pendingActions} Aksi Menunggu</span>
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
            Selamat Datang, {profile?.full_name || 'Staf'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">
            {isPusatView
              ? 'Tampilan agregat eksekutif lintas seluruh unit bisnis KUK (TB KUK La Tansa & KUK Palen).'
              : `Operasional aktif untuk unit ${activeUnit?.name || ''} (${activeUnit?.code || ''}) · ${brand.subtitle}.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadSummary}
            disabled={loading}
            className="p-3 text-gray-500 hover:text-[#540000] hover:bg-[#FDF2F2] rounded-2xl transition-all border border-[#E5E5E5] shadow-2xs active:scale-95"
            title="Muat Ulang Ringkasan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#540000]' : ''}`} />
          </button>
          <div className="bg-[#F8F9FA] rounded-2xl p-3.5 border border-[#E5E5E5] text-xs text-gray-600 sm:text-right shrink-0">
            <div className="font-extrabold text-[#540000]">
              {isSuperAdmin ? 'Super Administrator' : isAdminPusat ? 'Admin Pusat' : 'Staf Unit'}
            </div>
            <div className="text-[10px] text-gray-500 font-medium">KUK Management System v3.1.0</div>
          </div>
        </div>
      </div>

      {/* Error Alert Banner */}
      {summary?.error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#FF0000] shrink-0" />
            <span>
              <strong>Perhatian:</strong> {summary.error}
            </span>
          </div>
          <button
            onClick={loadSummary}
            className="text-xs font-bold text-red-700 hover:text-red-900 underline ml-3 shrink-0"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Metric Cards Grid - Role-Aware Information Architecture */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* 1. Karyawan */}
        {hasPermission('employees.view', activeUnitId) && (
          <div
            onClick={() => navigate('/employees')}
            className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E5E5E5] shadow-brand-card transition-all hover:border-[#540000] hover:shadow-brand cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Karyawan Aktif</span>
              <div className="p-2.5 bg-[#FCE7E7] rounded-xl text-[#540000] group-hover:bg-[#540000] group-hover:text-white transition-colors">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
              {loading ? '...' : `${summary?.employees?.active || 0} Staf`}
            </div>
            <div className="text-xs text-gray-500 mt-2 flex items-center justify-between pt-2 border-t border-gray-100">
              <span>Total: {summary?.employees?.total || 0} Terdaftar</span>
              <span className="text-emerald-700 font-bold">{summary?.employees?.active || 0} Aktif</span>
            </div>
          </div>
        )}

        {/* 2. Presensi Hari Ini */}
        {hasPermission('attendance.view', activeUnitId) && (
          <div
            onClick={() => navigate('/attendance')}
            className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E5E5E5] shadow-brand-card transition-all hover:border-[#540000] hover:shadow-brand cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Presensi Hari Ini</span>
              <div className="p-2.5 bg-[#FFF9D6] rounded-xl text-[#996414] group-hover:bg-[#996414] group-hover:text-white transition-colors">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
              {loading ? '...' : `${summary?.attendance?.present || 0} Hadir`}
            </div>
            <div className="text-xs text-gray-500 mt-2 flex items-center gap-2 pt-2 border-t border-gray-100">
              {summary?.attendance?.late > 0 && (
                <span className="text-amber-700 font-bold">{summary?.attendance?.late} Terlambat</span>
              )}
              {summary?.attendance?.absent > 0 && (
                <span className="text-[#FF0000] font-bold">{summary?.attendance?.absent} Mangkir</span>
              )}
              {summary?.attendance?.late === 0 && summary?.attendance?.absent === 0 && (
                <span className="text-emerald-700 font-bold">Tepat Waktu</span>
              )}
            </div>
          </div>
        )}

        {/* 3. Permohonan Cuti */}
        {hasPermission('leave.view', activeUnitId) && (
          <div
            onClick={() => navigate('/leave')}
            className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E5E5E5] shadow-brand-card transition-all hover:border-[#540000] hover:shadow-brand cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Permohonan Cuti</span>
              <div className="p-2.5 bg-[#FCE7E7] rounded-xl text-[#540000] group-hover:bg-[#540000] group-hover:text-white transition-colors">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
              {loading ? '...' : `${summary?.leaves?.pending || 0} Menunggu`}
            </div>
            <div className="text-xs text-gray-500 mt-2 flex items-center justify-between pt-2 border-t border-gray-100">
              <span>Disetujui: {summary?.leaves?.approved || 0}</span>
              <span className="text-[#540000] font-bold">Maks 3 Hari/Bulan</span>
            </div>
          </div>
        )}

        {/* 4. Tip Potong Kaca Pending */}
        {hasPermission('glass_tips.view', activeUnitId) && (
          <div
            onClick={() => navigate('/glass-tips')}
            className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E5E5E5] shadow-brand-card transition-all hover:border-[#FFCC00] hover:shadow-brand cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Tip Kaca Pending</span>
              <div className="p-2.5 bg-[#FFF9D6] rounded-xl text-[#996414] group-hover:bg-[#FFCC00] group-hover:text-[#540000] transition-colors">
                <Scissors className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
              {loading ? '...' : `${summary?.glassTips?.pending || 0} Nota`}
            </div>
            <div className="text-xs text-gray-500 mt-2 flex items-center justify-between pt-2 border-t border-gray-100">
              <span>Terverifikasi: {summary?.glassTips?.verifiedCount || 0}</span>
              <span className="font-extrabold text-[#540000]">{formatRupiah(summary?.glassTips?.totalAmount || 0)}</span>
            </div>
          </div>
        )}

        {/* 5. Kas Kecil (Petty Cash) */}
        {hasPermission('finance.view', activeUnitId) && (
          <div
            onClick={() => navigate('/finance')}
            className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E5E5E5] shadow-brand-card transition-all hover:border-[#540000] hover:shadow-brand cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Kas Kecil (Petty Cash)</span>
              <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
              {loading ? '...' : `${summary?.finance?.pending || 0} Menunggu`}
            </div>
            <div className="text-xs text-gray-500 mt-2 flex items-center justify-between pt-2 border-t border-gray-100">
              <span>Total Disetujui:</span>
              <span className="font-extrabold text-emerald-700">{formatRupiah(summary?.finance?.totalApprovedAmount || 0)}</span>
            </div>
          </div>
        )}

        {/* 6. Armada Kendaraan */}
        {hasPermission('fleet.view', activeUnitId) && !hasPermission('employees.view', activeUnitId) && (
          <div
            onClick={() => navigate('/fleet')}
            className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E5E5E5] shadow-brand-card transition-all hover:border-[#540000] hover:shadow-brand cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Operasional Armada</span>
              <div className="p-2.5 bg-[#FCE7E7] rounded-xl text-[#540000] group-hover:bg-[#540000] group-hover:text-white transition-colors">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
              {loading ? '...' : `${summary?.fleet?.pending || 0} Pengajuan`}
            </div>
            <div className="text-xs text-gray-500 mt-2 flex items-center justify-between pt-2 border-t border-gray-100">
              <span>Disetujui: {summary?.fleet?.approved || 0}</span>
              <span className="text-[#540000] font-bold">Siap Operasi</span>
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Operational Status & Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Operational Status */}
          <div className="bg-white rounded-3xl border border-[#E5E5E5] p-6 sm:p-7 shadow-brand-card">
            <h3 className="font-extrabold text-gray-900 text-base mb-4 flex items-center gap-2 font-display">
              <CheckCircle2 className="w-5 h-5 text-[#540000]" />
              <span>Status Operasional Unit Terkini</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Fleet status */}
              {hasPermission('fleet.view', activeUnitId) && (
                <div
                  onClick={() => navigate('/fleet')}
                  className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] hover:bg-[#FDF2F2] hover:border-[#540000]/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1">
                    <Truck className="w-4 h-4 text-[#540000]" />
                    <span>Peminjaman Armada</span>
                  </div>
                  <div className="text-xl font-extrabold text-gray-900 mt-1 font-display">
                    {loading ? '...' : `${summary?.fleet?.pending || 0} Pengajuan`}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 flex items-center justify-between">
                    <span>Disetujui: {summary?.fleet?.approved || 0}</span>
                    <span className="text-emerald-700 font-bold">{summary?.fleet?.available || 0} Siap Jalan</span>
                  </div>
                </div>
              )}

              {/* Violations status */}
              {hasPermission('violations.view', activeUnitId) && (
                <div
                  onClick={() => navigate('/violations')}
                  className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] hover:bg-[#FDF2F2] hover:border-[#540000]/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1">
                    <AlertTriangle className="w-4 h-4 text-[#FF0000]" />
                    <span>Pelanggaran & SP</span>
                  </div>
                  <div className="text-xl font-extrabold text-gray-900 mt-1 font-display">
                    {loading ? '...' : `${summary?.violations?.total || 0} Kasus`}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 flex items-center justify-between">
                    <span>Kepatuhan SOP</span>
                    <span className="text-red-700 font-bold">{summary?.violations?.warningLettersCount || 0} Terbit SP</span>
                  </div>
                </div>
              )}

              {/* Payroll status */}
              {hasPermission('payroll.view', activeUnitId) && (
                <div
                  onClick={() => navigate('/payroll')}
                  className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] hover:bg-[#FDF2F2] hover:border-[#540000]/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1">
                    <Banknote className="w-4 h-4 text-[#996414]" />
                    <span>Periode Penggajian</span>
                  </div>
                  <div className="text-sm font-extrabold text-gray-900 truncate mt-1">
                    {loading ? '...' : summary?.payroll?.currentPeriod}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    Status: <span className="font-bold text-[#540000]">{summary?.payroll?.status}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white rounded-3xl border border-[#E5E5E5] p-6 sm:p-7 shadow-brand-card">
            <h3 className="font-extrabold text-gray-900 text-sm mb-4 font-display">
              Pintasan Menu Cepat Operasional
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {hasPermission('glass_tips.verify', activeUnitId) && (
                <button
                  onClick={() => navigate('/glass-tips')}
                  className="p-3.5 bg-[#F8F9FA] hover:bg-[#FDF2F2] hover:text-[#540000] rounded-2xl border border-[#E5E5E5] text-left transition-all text-xs font-bold flex flex-col justify-between h-20 active:scale-95"
                >
                  <Scissors className="w-4 h-4 text-[#996414] mb-1" />
                  <span>Verifikasi Nota Tip</span>
                </button>
              )}
              {hasPermission('finance.view', activeUnitId) && (
                <button
                  onClick={() => navigate('/finance')}
                  className="p-3.5 bg-[#F8F9FA] hover:bg-emerald-50 hover:text-emerald-800 rounded-2xl border border-[#E5E5E5] text-left transition-all text-xs font-bold flex flex-col justify-between h-20 active:scale-95"
                >
                  <Wallet className="w-4 h-4 text-emerald-600 mb-1" />
                  <span>Kelola Kas Kecil</span>
                </button>
              )}
              {(hasPermission('leave.manage', activeUnitId) || hasPermission('leave.approve', activeUnitId)) && (
                <button
                  onClick={() => navigate('/leave')}
                  className="p-3.5 bg-[#F8F9FA] hover:bg-[#FFF9D6] hover:text-[#996414] rounded-2xl border border-[#E5E5E5] text-left transition-all text-xs font-bold flex flex-col justify-between h-20 active:scale-95"
                >
                  <Calendar className="w-4 h-4 text-[#996414] mb-1" />
                  <span>Persetujuan Cuti</span>
                </button>
              )}
              {hasPermission('fleet.approve_borrowing', activeUnitId) && (
                <button
                  onClick={() => navigate('/fleet')}
                  className="p-3.5 bg-[#F8F9FA] hover:bg-[#FDF2F2] hover:text-[#540000] rounded-2xl border border-[#E5E5E5] text-left transition-all text-xs font-bold flex flex-col justify-between h-20 active:scale-95"
                >
                  <Truck className="w-4 h-4 text-[#540000] mb-1" />
                  <span>Persetujuan Armada</span>
                </button>
              )}
              {(hasPermission('attendance.manage_briefing', activeUnitId) || hasPermission('attendance.manage', activeUnitId)) && (
                <button
                  onClick={() => navigate('/attendance')}
                  className="p-3.5 bg-[#F8F9FA] hover:bg-[#FDF2F2] hover:text-[#540000] rounded-2xl border border-[#E5E5E5] text-left transition-all text-xs font-bold flex flex-col justify-between h-20 active:scale-95"
                >
                  <Clock className="w-4 h-4 text-[#540000] mb-1" />
                  <span>Kelola Presensi</span>
                </button>
              )}
              {hasPermission('employees.create', activeUnitId) && (
                <button
                  onClick={() => navigate('/employees')}
                  className="p-3.5 bg-[#F8F9FA] hover:bg-[#FDF2F2] hover:text-[#540000] rounded-2xl border border-[#E5E5E5] text-left transition-all text-xs font-bold flex flex-col justify-between h-20 active:scale-95"
                >
                  <Users className="w-4 h-4 text-[#540000] mb-1" />
                  <span>Master Karyawan</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Public Kiosk / Form Shortcuts Card */}
        <div className="space-y-4">
          <div className="bg-[#540000] text-white rounded-3xl p-6 sm:p-7 shadow-brand relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none opacity-5 bg-repeat"
              style={{ backgroundImage: 'url(/brand/patterns/pattern-dark.png)' }}
            />
            <div className="relative z-10">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFCC00] bg-white/10 px-2 py-0.5 rounded-md border border-[#FFCC00]/30">
                Akses Kiosk Mandiri
              </span>
              <h3 className="font-extrabold text-lg mt-2 mb-1 font-display">Portal Mandiri & Kiosk</h3>
              <p className="text-xs text-white/80 mb-5 leading-relaxed">
                Tautan langsung formulir publik mandiri untuk pemotongan kaca, armada, dan cuti.
              </p>

              <div className="space-y-3">
                <a
                  href="/public/glass-tip"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-xs font-bold text-white border border-white/15 active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <Scissors className="w-4 h-4 text-[#FFCC00]" />
                    <span>Kiosk Tip Potong Kaca</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                </a>

                <a
                  href="/public/fleet-booking"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-xs font-bold text-white border border-white/15 active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-[#FFCC00]" />
                    <span>Form Reservasi Armada</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                </a>

                <a
                  href="/public/leave-request"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-xs font-bold text-white border border-white/15 active:scale-98"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-[#FFCC00]" />
                    <span>Portal Cuti Mandiri (PIN)</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
