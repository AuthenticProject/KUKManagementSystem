import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from '@/components/guards/AuthGuard';
import { PermissionGuard } from '@/components/guards/PermissionGuard';
import { AppShell } from '@/components/layout/AppShell';
import { LandingPage } from '@/modules/landing/LandingPage';
import { LoginPage } from '@/modules/auth/LoginPage';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';

// Phase 2 Core Modules
import { EmployeeListPage } from '@/modules/employees/EmployeeListPage';
import { LeaveListPage } from '@/modules/leave/LeaveListPage';
import { ViolationListPage } from '@/modules/violations/ViolationListPage';
import { AttendanceDashboardPage } from '@/modules/attendance/AttendanceDashboardPage';
import { GlassTipListPage } from '@/modules/glass-tips/GlassTipListPage';
import { PayrollDashboardPage } from '@/modules/payroll/PayrollDashboardPage';
import { FleetListPage } from '@/modules/fleet/FleetListPage';
import { CashExpensePage } from '@/modules/finance/CashExpensePage';

// Phase 3 Public & Operational Modules
import { PublicGlassTipPage } from '@/modules/public/PublicGlassTipPage';
import { PublicFleetBookingPage } from '@/modules/public/PublicFleetBookingPage';
import { PublicLeaveRequestPage } from '@/modules/public/PublicLeaveRequestPage';
import { AuditLogPage } from '@/modules/audit/AuditLogPage';
import { SettingsPage } from '@/modules/settings/SettingsPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Rute Publik Landing & Login */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Rute Kiosk & Formulir Mandiri Publik */}
      <Route path="/public/glass-tip" element={<PublicGlassTipPage />} />
      <Route path="/kiosk/glass-tip" element={<PublicGlassTipPage />} />

      <Route path="/public/fleet-booking" element={<PublicFleetBookingPage />} />
      <Route path="/kiosk/fleet-booking" element={<PublicFleetBookingPage />} />

      <Route path="/public/leave-request" element={<PublicLeaveRequestPage />} />
      <Route path="/kiosk/leave-request" element={<PublicLeaveRequestPage />} />

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

        {/* 7. Kas & Pengeluaran Toko */}
        <Route
          path="/finance"
          element={
            <PermissionGuard permission="payroll.view">
              <CashExpensePage />
            </PermissionGuard>
          }
        />

        {/* 8. Armada Kendaraan */}
        <Route
          path="/fleet"
          element={
            <PermissionGuard permission="fleet.view">
              <FleetListPage />
            </PermissionGuard>
          }
        />

        {/* 9. Audit Trail & Jejak Mutasi Data */}
        <Route
          path="/audit-logs"
          element={
            <PermissionGuard permission="audit_logs.view">
              <AuditLogPage />
            </PermissionGuard>
          }
        />

        {/* 10. Pengaturan Sistem & RBAC */}
        <Route
          path="/settings"
          element={
            <PermissionGuard permission="settings.manage">
              <SettingsPage />
            </PermissionGuard>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};