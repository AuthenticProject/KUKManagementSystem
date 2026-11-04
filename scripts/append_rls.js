import fs from 'fs';

const rlsSql = `
-- ======================================================================
-- SECTION 13: RLS SECURITY HELPER FUNCTIONS
-- ======================================================================

CREATE OR REPLACE FUNCTION has_system_role(p_role_code VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_system_roles usr
        JOIN roles r ON usr.role_id = r.id
        WHERE usr.user_id = auth.uid()
          AND r.code = p_role_code
    );
$$;

CREATE OR REPLACE FUNCTION has_unit_access(p_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT has_system_role('super_admin') OR has_system_role('admin_pusat') OR EXISTS (
        SELECT 1
        FROM user_unit_roles uur
        WHERE uur.user_id = auth.uid()
          AND uur.unit_id = p_unit_id
    );
$$;

CREATE OR REPLACE FUNCTION has_unit_permission(p_unit_id UUID, p_permission_code VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT has_system_role('super_admin') OR EXISTS (
        SELECT 1
        FROM user_unit_roles uur
        JOIN role_permissions rp ON uur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE uur.user_id = auth.uid()
          AND uur.unit_id = p_unit_id
          AND p.code = p_permission_code
    ) OR EXISTS (
        SELECT 1
        FROM user_system_roles usr
        JOIN role_permissions rp ON usr.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE usr.user_id = auth.uid()
          AND p.code = p_permission_code
    );
$$;

-- ======================================================================
-- SECTION 14: ROW LEVEL SECURITY (RLS) POLICIES
-- ======================================================================

-- 1. Organizations & Units
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizations_read_authenticated" ON organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "organizations_manage_super_admin" ON organizations FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units_read_accessible" ON units FOR SELECT TO authenticated USING (has_unit_access(id));
CREATE POLICY "units_manage_super_admin" ON units FOR ALL TO authenticated USING (has_system_role('super_admin'));

-- 2. Profiles & RBAC
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_authenticated" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_manage_super_admin" ON profiles FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read_authenticated" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_manage_super_admin" ON roles FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_read_authenticated" ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_manage_super_admin" ON permissions FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_read_authenticated" ON role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_manage_super_admin" ON role_permissions FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE user_system_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_system_roles_read_own" ON user_system_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_system_role('super_admin'));
CREATE POLICY "user_system_roles_manage_super_admin" ON user_system_roles FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE user_unit_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_unit_roles_read_own" ON user_unit_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_system_role('super_admin'));
CREATE POLICY "user_unit_roles_manage_super_admin" ON user_unit_roles FOR ALL TO authenticated USING (has_system_role('super_admin'));

-- 3. Master Data SDM & Isolasi Unit
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments_read_unit" ON departments FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "departments_manage_unit" ON departments FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'units.manage'));

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_read_unit" ON positions FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "positions_manage_unit" ON positions FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'units.manage'));

ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_schedules_read_unit" ON work_schedules FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "work_schedules_manage_unit" ON work_schedules FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'units.manage'));

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_read_unit" ON employees FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'employees.view'));
CREATE POLICY "employees_insert_unit" ON employees FOR INSERT TO authenticated WITH CHECK (has_unit_permission(unit_id, 'employees.create'));
CREATE POLICY "employees_update_unit" ON employees FOR UPDATE TO authenticated USING (has_unit_permission(unit_id, 'employees.update'));
CREATE POLICY "employees_delete_deny" ON employees FOR DELETE TO authenticated USING (false);

ALTER TABLE employee_sensitive_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_sensitive_read" ON employee_sensitive_data FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'employees.view_sensitive'));
CREATE POLICY "employee_sensitive_manage" ON employee_sensitive_data FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'employees.manage_sensitive'));

ALTER TABLE employee_portal_auth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_portal_auth_deny_all" ON employee_portal_auth FOR ALL TO authenticated USING (false);

ALTER TABLE employee_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_status_history_read" ON employee_status_history FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'employees.view'));
CREATE POLICY "employee_status_history_insert" ON employee_status_history FOR INSERT TO authenticated WITH CHECK (has_unit_permission(unit_id, 'employees.update'));

ALTER TABLE employee_job_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_job_history_read" ON employee_job_history FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'employees.view'));
CREATE POLICY "employee_job_history_insert" ON employee_job_history FOR INSERT TO authenticated WITH CHECK (has_unit_permission(unit_id, 'employees.update'));

-- 4. Cuti Karyawan
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_policies_read" ON leave_policies FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "leave_policies_manage" ON leave_policies FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'leave.manage'));

ALTER TABLE leave_conflict_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_conflict_groups_read" ON leave_conflict_groups FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "leave_conflict_groups_manage" ON leave_conflict_groups FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'leave.manage'));

ALTER TABLE leave_conflict_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_conflict_departments_read" ON leave_conflict_departments FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "leave_conflict_departments_manage" ON leave_conflict_departments FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'leave.manage'));

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_requests_read" ON leave_requests FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'leave.view'));
CREATE POLICY "leave_requests_manage" ON leave_requests FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'leave.manage'));

ALTER TABLE leave_request_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_request_dates_read" ON leave_request_dates FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'leave.view'));

ALTER TABLE leave_conflict_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_conflict_slots_read" ON leave_conflict_slots FOR SELECT TO authenticated USING (has_unit_access(unit_id));

-- 5. Tip Potong Kaca
ALTER TABLE glass_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_types_read" ON glass_types FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "glass_types_manage" ON glass_types FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.manage_rates'));

ALTER TABLE glass_tip_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_tip_rates_read" ON glass_tip_rates FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "glass_tip_rates_manage" ON glass_tip_rates FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.manage_rates'));

ALTER TABLE glass_tip_rate_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_tip_rate_ranges_read" ON glass_tip_rate_ranges FOR SELECT TO authenticated USING (has_unit_access(unit_id));

ALTER TABLE glass_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_tips_read" ON glass_tips FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.view'));
CREATE POLICY "glass_tips_update" ON glass_tips FOR UPDATE TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.verify'));
CREATE POLICY "glass_tips_insert_anon" ON glass_tips FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE glass_tip_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_tip_verifications_read" ON glass_tip_verifications FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'glass_tips.view'));
CREATE POLICY "glass_tip_verifications_insert" ON glass_tip_verifications FOR INSERT TO authenticated WITH CHECK (has_unit_permission(unit_id, 'glass_tips.verify'));

-- 6. Pelanggaran & Sanksi
ALTER TABLE violation_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "violation_types_read" ON violation_types FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "violation_types_manage" ON violation_types FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'violations.manage'));

ALTER TABLE violation_point_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "violation_point_rules_read" ON violation_point_rules FOR SELECT TO authenticated USING (has_unit_access(unit_id));

ALTER TABLE warning_letter_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warning_letter_templates_read" ON warning_letter_templates FOR SELECT TO authenticated USING (has_unit_access(unit_id));

ALTER TABLE violation_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "violation_records_read" ON violation_records FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'violations.view'));
CREATE POLICY "violation_records_manage" ON violation_records FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'violations.manage'));

ALTER TABLE warning_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warning_letters_read" ON warning_letters FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'violations.view'));
CREATE POLICY "warning_letters_manage" ON warning_letters FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'violations.issue_sp'));

ALTER TABLE warning_letter_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warning_letter_approvals_read" ON warning_letter_approvals FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'violations.view'));

-- 7. Presensi & Fingerprint
ALTER TABLE briefing_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefing_sessions_read" ON briefing_sessions FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.view'));
CREATE POLICY "briefing_sessions_manage" ON briefing_sessions FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'attendance.manage_briefing'));

ALTER TABLE briefing_attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefing_attendances_read" ON briefing_attendances FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.view'));
CREATE POLICY "briefing_attendances_manage" ON briefing_attendances FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'attendance.manage_briefing'));

ALTER TABLE fingerprint_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fingerprint_devices_read" ON fingerprint_devices FOR SELECT TO authenticated USING (has_unit_access(unit_id));

ALTER TABLE employee_fingerprint_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_fingerprint_ids_read" ON employee_fingerprint_ids FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.view'));

ALTER TABLE fingerprint_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fingerprint_import_batches_read" ON fingerprint_import_batches FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.import_fingerprint'));

ALTER TABLE fingerprint_raw_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fingerprint_raw_logs_read" ON fingerprint_raw_logs FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.import_fingerprint'));
CREATE POLICY "fingerprint_raw_logs_insert" ON fingerprint_raw_logs FOR INSERT TO authenticated WITH CHECK (has_unit_permission(unit_id, 'attendance.import_fingerprint'));

ALTER TABLE attendance_daily_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_daily_records_read" ON attendance_daily_records FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.view'));
CREATE POLICY "attendance_daily_records_manage" ON attendance_daily_records FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'attendance.adjust'));

ALTER TABLE attendance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_adjustments_read" ON attendance_adjustments FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'attendance.view'));

-- 8. Penggajian / Payroll (PROTEKSI KETAT GAJI)
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salary_components_read" ON salary_components FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));
CREATE POLICY "salary_components_manage" ON salary_components FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'payroll.manage'));

ALTER TABLE employee_salary_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_salary_structures_read" ON employee_salary_structures FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));
CREATE POLICY "employee_salary_structures_manage" ON employee_salary_structures FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'payroll.manage'));

ALTER TABLE employee_salary_component_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_salary_component_items_read" ON employee_salary_component_items FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));

ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_periods_read" ON payroll_periods FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));
CREATE POLICY "payroll_periods_manage" ON payroll_periods FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'payroll.manage'));

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_records_read" ON payroll_records FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));
CREATE POLICY "payroll_records_manage" ON payroll_records FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'payroll.manage'));

ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_items_read" ON payroll_items FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));

ALTER TABLE payroll_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_revisions_read" ON payroll_revisions FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'payroll.view'));

-- 9. Armada Kendaraan
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_read_unit" ON vehicles FOR SELECT TO authenticated USING (has_unit_access(unit_id));
CREATE POLICY "vehicles_read_anon" ON vehicles FOR SELECT TO anon USING (status = 'AVAILABLE' AND is_active = true);
CREATE POLICY "vehicles_manage_unit" ON vehicles FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'fleet.manage'));

ALTER TABLE vehicle_borrowing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_borrowing_requests_read" ON vehicle_borrowing_requests FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'fleet.view'));
CREATE POLICY "vehicle_borrowing_requests_update" ON vehicle_borrowing_requests FOR UPDATE TO authenticated USING (has_unit_permission(unit_id, 'fleet.approve_borrowing'));
CREATE POLICY "vehicle_borrowing_requests_insert_anon" ON vehicle_borrowing_requests FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE vehicle_condition_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_condition_inspections_read" ON vehicle_condition_inspections FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'fleet.view'));

ALTER TABLE vehicle_damages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_damages_read" ON vehicle_damages FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'fleet.view'));

ALTER TABLE vehicle_fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_fuel_logs_read" ON vehicle_fuel_logs FOR SELECT TO authenticated USING (has_unit_permission(unit_id, 'fleet.view'));

-- 10. Audit, Logging & Utilitas Sistem
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_read" ON audit_logs FOR SELECT TO authenticated USING (has_system_role('super_admin') OR has_unit_permission(unit_id, 'audit_logs.view'));
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_logs_deny_update" ON audit_logs FOR UPDATE TO PUBLIC USING (false);
CREATE POLICY "audit_logs_deny_delete" ON audit_logs FOR DELETE TO PUBLIC USING (false);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs_read" ON activity_logs FOR SELECT TO authenticated USING (has_system_role('super_admin') OR (unit_id IS NOT NULL AND has_unit_access(unit_id)));

ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_sequences_read" ON document_sequences FOR SELECT TO authenticated USING (has_unit_access(unit_id));

ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_notifications_read_recipient" ON system_notifications FOR SELECT TO authenticated USING (recipient_profile_id = auth.uid() OR recipient_profile_id IS NULL);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_settings_read" ON system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_settings_manage" ON system_settings FOR ALL TO authenticated USING (has_system_role('super_admin'));

ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "file_attachments_read" ON file_attachments FOR SELECT TO authenticated USING (unit_id IS NULL OR has_unit_access(unit_id));

ALTER TABLE public_form_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_form_tokens_anon_insert" ON public_form_tokens FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "public_form_tokens_read_manage" ON public_form_tokens FOR ALL TO authenticated USING (has_system_role('super_admin'));
`;

let existing = fs.readFileSync('supabase/migrations/20261104000001_core_schema_v3_1_0.sql', 'utf8');
if (!existing.includes('SECTION 13: RLS SECURITY HELPER FUNCTIONS')) {
  existing += '\n\n' + rlsSql.trim() + '\n';
  fs.writeFileSync('supabase/migrations/20261104000001_core_schema_v3_1_0.sql', existing);
  console.log('Appended RLS policies. Total size:', existing.length, 'bytes');
} else {
  console.log('RLS already present.');
}

