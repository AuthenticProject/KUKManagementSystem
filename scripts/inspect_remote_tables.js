import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ckzciuybedefbsdfsexh.supabase.co';
const supabaseKey = 'sb_publishable_Q8N64Hiqq7hYAG69F6Fs5g_hveDpB7N';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectExistingTables() {
  console.log('=== CHECKING EXISTING TABLES & RECORD COUNTS ON REMOTE ===');
  const allTables = [
    'organizations', 'units', 'profiles', 'roles', 'permissions', 'role_permissions',
    'user_system_roles', 'user_unit_roles', 'departments', 'positions', 'work_schedules',
    'employees', 'employee_sensitive_data', 'employee_portal_auth', 'employee_status_history',
    'employee_job_history', 'leave_policies', 'leave_conflict_groups', 'leave_conflict_departments',
    'leave_requests', 'leave_request_dates', 'leave_conflict_slots', 'glass_types',
    'glass_tip_rates', 'glass_tip_rate_ranges', 'glass_tips', 'glass_tip_verifications',
    'violation_types', 'violation_point_rules', 'warning_letter_templates', 'violation_records',
    'warning_letters', 'warning_letter_approvals', 'briefing_sessions', 'briefing_attendances',
    'fingerprint_devices', 'employee_fingerprint_ids', 'fingerprint_import_batches',
    'fingerprint_raw_logs', 'attendance_daily_records', 'attendance_adjustments',
    'salary_components', 'employee_salary_structures', 'employee_salary_component_items',
    'payroll_periods', 'payroll_records', 'payroll_items', 'payroll_revisions',
    'vehicles', 'vehicle_borrowing_requests', 'vehicle_condition_inspections', 'vehicle_damages',
    'vehicle_fuel_logs', 'audit_logs', 'activity_logs', 'document_sequences',
    'system_notifications', 'system_settings', 'file_attachments', 'public_form_tokens'
  ];

  const existing = [];
  const missing = [];
  const withData = [];

  for (const t of allTables) {
    const { data, count, error, status } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (status === 200) {
      existing.push(t);
      if (count && count > 0) {
        withData.push({ table: t, count });
      }
    } else {
      missing.push(t);
    }
  }

  console.log(`Total Existing Tables: ${existing.length}/${allTables.length}`);
  console.log('Existing tables:', existing.join(', '));
  console.log(`\nTotal Missing Tables: ${missing.length}`);
  if (missing.length > 0) {
    console.log('Missing tables:', missing.join(', '));
  }
  console.log('\nTables containing records:', withData.length > 0 ? withData : 'ZERO RECORDS FOUND (ALL TABLES EMPTY)');
}

inspectExistingTables();

