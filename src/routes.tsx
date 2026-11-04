import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from '@/components/guards/AuthGuard';
import { PermissionGuard } from '@/components/guards/PermissionGuard';
import { AppShell } from '@/components/layout/AppShell';
import { LandingPage } from '@/modules/landing/LandingPage';
import { LoginPage } from '@/modules/auth/LoginPage';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';

// Placeholder untuk rute modul yang dialokasikan pada fase selanjutnya
const ModulePlaceholder: React.FC<{ title: string; phase: string }> = ({ title, phase }) => (
  <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center max-w-xl mx-auto my-8 shadow-xs">
    <div className="w-12 h-12 bg-kuk-maroon-50 text-kuk-maroon rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-lg">
      KUK
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-1">{title}</h3>
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
      Jadwal Implementasi: {phase}
    </span>
    <p className="text-sm text-gray-500 mt-4 leading-relaxed">
      Modul ini telah didukung secara penuh pada skema database v3.1.0 dan akan dibangun antarmuka fungsionalnya pada tahap {phase} sesuai Roadmap.
    </p>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Rute Publik */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Rute Formulir Publik (Placeholders) */}
      <Route
        path="/public/fleet-booking"
        element={<ModulePlaceholder title="Formulir Publik Peminjaman Kendaraan" phase="Phase 3" />}
      />
      <Route
        path="/public/leave-request"
        element={<ModulePlaceholder title="Formulir Pengajuan Cuti Mandiri (PIN Auth)" phase="Phase 3" />}
      />
      <Route
        path="/public/glass-tip"
        element={<ModulePlaceholder title="Formulir Publik Tip Potong Kaca (3%)" phase="Phase 3" />}
      />

      {/* Rute Internal Staf (Terproteksi AuthGuard & AppShell) */}
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route
          path="/employees"
          element={
            <PermissionGuard permission="employees.view">
              <ModulePlaceholder title="Master Data Karyawan & Organisasi" phase="Phase 2" />
            </PermissionGuard>
          }
        />

        <Route
          path="/leave"
          element={
            <PermissionGuard permission="leave.view">
              <ModulePlaceholder title="Manajemen & Rekapitulasi Cuti" phase="Phase 3" />
            </PermissionGuard>
          }
        />

        <Route
          path="/glass-tips"
          element={
            <PermissionGuard permission="glass_tips.view">
              <ModulePlaceholder title="Verifikasi Tip Pemotongan Kaca (3%)" phase="Phase 3" />
            </PermissionGuard>
          }
        />

        <Route
          path="/violations"
          element={
            <PermissionGuard permission="violations.view">
              <ModulePlaceholder title="Catatan Pelanggaran & Surat Peringatan (SP)" phase="Phase 4" />
            </PermissionGuard>
          }
        />

        <Route
          path="/attendance"
          element={
            <PermissionGuard permission="attendance.view">
              <ModulePlaceholder title="Presensi Briefing & Impor Mesin Fingerprint" phase="Phase 4" />
            </PermissionGuard>
          }
        />

        <Route
          path="/payroll"
          element={
            <PermissionGuard permission="payroll.view">
              <ModulePlaceholder title="Penggajian & Penerbitan Slip Gaji" phase="Phase 5" />
            </PermissionGuard>
          }
        />

        <Route
          path="/fleet"
          element={
            <PermissionGuard permission="fleet.view">
              <ModulePlaceholder title="Manajemen Armada & Inspeksi Fisik" phase="Phase 3" />
            </PermissionGuard>
          }
        />

        <Route
          path="/audit-logs"
          element={
            <PermissionGuard permission="audit_logs.view">
              <ModulePlaceholder title="Audit Trail & Jejak Mutasi Data" phase="Phase 6" />
            </PermissionGuard>
          }
        />

        <Route
          path="/settings"
          element={
            <PermissionGuard permission="settings.manage">
              <ModulePlaceholder title="Pengaturan Sistem & Parameter Operasional" phase="Phase 6" />
            </PermissionGuard>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

