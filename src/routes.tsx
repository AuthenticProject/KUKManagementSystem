import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from '@/components/guards/AuthGuard';
import { PermissionGuard } from '@/components/guards/PermissionGuard';
import { AppShell } from '@/components/layout/AppShell';
import { LandingPage } from '@/modules/landing/LandingPage';
import { LoginPage } from '@/modules/auth/LoginPage';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';

// Phase 2 Module Pages
import { EmployeeListPage } from '@/modules/employees/EmployeeListPage';
import { LeaveListPage } from '@/modules/leave/LeaveListPage';
import { ViolationListPage } from '@/modules/violations/ViolationListPage';
import { AttendanceDashboardPage } from '@/modules/attendance/AttendanceDashboardPage';
import { GlassTipListPage } from '@/modules/glass-tips/GlassTipListPage';
import { PayrollDashboardPage } from '@/modules/payroll/PayrollDashboardPage';
import { FleetListPage } from '@/modules/fleet/FleetListPage';

// Placeholder untuk rute modul yang dialokasikan pada fase selanjutnya (Phase 6)
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

        {/* 1. Master Data Karyawan */}
        <Route
          path="/employees"
          element={
            <PermissionGuard permission="employees.view">
              <EmployeeListPage />
            </PermissionGuard>
          }
        />

        {/* 2. Cuti Karyawan */}
        <Route
          path="/leave"
          element={
            <PermissionGuard permission="leave.view">
              <LeaveListPage />
            </PermissionGuard>
          }
        />

        {/* 3. Tip Potong Kaca */}
        <Route
          path="/glass-tips"
          element={
            <PermissionGuard permission="glass_tips.view">
              <GlassTipListPage />
            </PermissionGuard>
          }
        />

        {/* 4. Pelanggaran & Surat Peringatan */}
        <Route
          path="/violations"
          element={
            <PermissionGuard permission="violations.view">
              <ViolationListPage />
            </PermissionGuard>
          }
        />

        {/* 5. Presensi & Briefing */}
        <Route
          path="/attendance"
          element={
            <PermissionGuard permission="attendance.view">
              <AttendanceDashboardPage />
            </PermissionGuard>
          }
        />

        {/* 6. Penggajian / Payroll */}
        <Route
          path="/payroll"
          element={
            <PermissionGuard permission="payroll.view">
              <PayrollDashboardPage />
            </PermissionGuard>
          }
        />

        {/* 7. Armada Kendaraan */}
        <Route
          path="/fleet"
          element={
            <PermissionGuard permission="fleet.view">
              <FleetListPage />
            </PermissionGuard>
          }
        />

        {/* Modul Sistem Lanjutan (Phase 6) */}
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
