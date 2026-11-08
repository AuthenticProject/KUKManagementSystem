/**
 * PHASE 1C.2 — ENHANCED SQL STATIC VALIDATION SUITE
 * KUK Management System v3.1.0
 * 
 * Verifies SQL structure, function signatures, SECURITY DEFINER search_paths,
 * EXECUTE grants/revokes, RLS policies (permissive vs restrictive), direct table grants,
 * exclusion constraints, rate limits, and audit triggers.
 * 
 * Mode: Local Static Analysis (Zero Remote Connection)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const MIGRATION_DIR = path.join(ROOT_DIR, 'supabase', 'migrations');

const defaultFiles = {
  core: path.join(MIGRATION_DIR, '20261104000001_core_schema_v3_1_0.sql'),
  rpc_harden: path.join(MIGRATION_DIR, '20261104000002_harden_rpc_security.sql'),
  security_draft: path.join(MIGRATION_DIR, '20261105000002_security_rpc_and_remediation.sql'),
  critical_remediation: path.join(MIGRATION_DIR, '20261106000001_critical_security_remediation.sql'),
};

function runStaticValidation(fileMap = defaultFiles, isQuiet = false) {
  const log = (...args) => { if (!isQuiet) console.log(...args); };

  log('================================================================');
  log('PHASE 1C.2 / 1C.4-R — ENHANCED SQL STATIC SECURITY VALIDATOR');
  log('================================================================\n');

  const tests = [];
  let passCount = 0;
  let failCount = 0;

  function assert(id, category, description, passed, details = '') {
    if (passed) {
      passCount++;
      log(`[PASS] [${id}] [${category}] ${description}`);
      tests.push({ id, category, description, status: 'PASS', details });
    } else {
      failCount++;
      log(`[FAIL] [${id}] [${category}] ${description} -> ${details}`);
      tests.push({ id, category, description, status: 'FAIL', details });
    }
  }

  // Read SQL files
  const sqlCore = typeof fileMap.core === 'string' && fs.existsSync(fileMap.core) ? fs.readFileSync(fileMap.core, 'utf8') : (fileMap.coreContent || '');
  const sqlRpc = typeof fileMap.rpc_harden === 'string' && fs.existsSync(fileMap.rpc_harden) ? fs.readFileSync(fileMap.rpc_harden, 'utf8') : (fileMap.rpcContent || '');
  const sqlDraft = typeof fileMap.security_draft === 'string' && fs.existsSync(fileMap.security_draft) ? fs.readFileSync(fileMap.security_draft, 'utf8') : (fileMap.draftContent || '');
  const sqlCrit = typeof fileMap.critical_remediation === 'string' && fs.existsSync(fileMap.critical_remediation) ? fs.readFileSync(fileMap.critical_remediation, 'utf8') : (fileMap.critContent || '');

  if (!sqlCore || !sqlDraft) {
    assert('LOAD-01', 'FILES', 'Required migration files exist and readable', false, 'Missing core or draft migration file');
    return { passCount, failCount, tests, success: false };
  }

  assert('LOAD-01', 'FILES', 'Required migration files loaded successfully', true, 'All migration files present');

  const combinedSql = `${sqlCore}\n${sqlRpc}\n${sqlDraft}`;

  // --------------------------------------------------------------------------
  // 1. Transaction Boundaries & Quotation Integrity
  // --------------------------------------------------------------------------
  const draftBegin = /^BEGIN;/m.test(sqlDraft);
  const draftCommit = /^COMMIT;/m.test(sqlDraft);
  const draftDollars = (sqlDraft.match(/\$\$/g) || []).length;

  assert(
    'TX-01',
    'TRANSACTION',
    'Draft migration is enclosed in atomic BEGIN; ... COMMIT; block',
    draftBegin && draftCommit && sqlDraft.indexOf('BEGIN;') < sqlDraft.lastIndexOf('COMMIT;'),
    'BEGIN; and COMMIT; boundaries verified'
  );

  assert(
    'TX-02',
    'TRANSACTION',
    'String quotation delimiters ($$) are balanced across PL/pgSQL routines',
    draftDollars > 0 && draftDollars % 2 === 0,
    `Total $$ count: ${draftDollars}`
  );

  // --------------------------------------------------------------------------
  // 2. SECURITY DEFINER & search_path Hardening
  // --------------------------------------------------------------------------
  // Every function in sqlDraft with SECURITY DEFINER must have explicit SET search_path = public, extensions, pg_temp
  const secDefinerBlocks = [...sqlDraft.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)[\s\S]*?LANGUAGE\s+plpgsql[\s\S]*?(?=CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|COMMIT;|$)/gi)];
  
  let allSecDefSecure = true;
  let secDefViolations = [];

  for (const block of secDefinerBlocks) {
    const fnName = block[1];
    const text = block[0];
    if (/SECURITY\s+DEFINER/i.test(text)) {
      const searchPathMatch = text.match(/SET\s+search_path\s*=\s*([^;\n]+)/i);
      if (!searchPathMatch) {
        allSecDefSecure = false;
        secDefViolations.push(`${fnName} (missing SET search_path)`);
      } else {
        const pathVal = searchPathMatch[1].trim();
        const tokens = pathVal.split(',').map(t => t.trim().toLowerCase());
        const hasPgTempLast = tokens[tokens.length - 1] === 'pg_temp';
        const hasPublic = tokens.includes('public');
        if (!hasPgTempLast || !hasPublic) {
          allSecDefSecure = false;
          secDefViolations.push(`${fnName} (insecure path: ${pathVal})`);
        }
      }
    }
  }

  assert(
    'SEC-01',
    'SEARCH_PATH',
    'All draft SECURITY DEFINER functions enforce search_path with pg_temp strictly last',
    allSecDefSecure && secDefViolations.length === 0,
    secDefViolations.length > 0 ? `Violations: ${secDefViolations.join(', ')}` : 'All SECURITY DEFINER functions compliant'
  );

  // --------------------------------------------------------------------------
  // 3. EXECUTE Grants and Revocations
  // --------------------------------------------------------------------------
  // submit_glass_tip_atomic (Public Kiosk)
  const hasSubmitTipPublicRevoke = /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_glass_tip_atomic[^\n;]*FROM\s+PUBLIC/i.test(sqlDraft);
  const hasSubmitTipGrant = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_glass_tip_atomic[^\n;]*TO\s+anon,\s*authenticated,\s*service_role/i.test(sqlDraft);
  assert(
    'GRT-01',
    'PRIVILEGES',
    'submit_glass_tip_atomic explicitly REVOKES from PUBLIC and grants to anon, authenticated, service_role',
    hasSubmitTipPublicRevoke && hasSubmitTipGrant,
    'Public RPC privilege boundary verified'
  );

  // book_vehicle_atomic (Public Kiosk)
  const hasBookVehiclePublicRevoke = /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.book_vehicle_atomic[^\n;]*FROM\s+PUBLIC/i.test(sqlDraft);
  const hasBookVehicleGrant = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.book_vehicle_atomic[^\n;]*TO\s+anon,\s*authenticated,\s*service_role/i.test(sqlDraft);
  assert(
    'GRT-02',
    'PRIVILEGES',
    'book_vehicle_atomic explicitly REVOKES from PUBLIC and grants to anon, authenticated, service_role',
    hasBookVehiclePublicRevoke && hasBookVehicleGrant,
    'Fleet booking public privilege boundary verified'
  );

  // Administrative RPCs: reset_employee_kiosk_pin, verify_glass_tip_atomic, approve_vehicle_atomic
  const adminRpcNames = ['reset_employee_kiosk_pin', 'verify_glass_tip_atomic', 'approve_vehicle_atomic'];
  let adminRpcsSecured = true;
  let adminViolations = [];

  for (const rpc of adminRpcNames) {
    const revokeRegex = new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${rpc}[^\\n;]*FROM\\s+PUBLIC,\\s*anon`, 'i');
    const grantRegex = new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${rpc}[^\\n;]*TO\\s+authenticated,\\s*service_role`, 'i');
    const isRevoked = revokeRegex.test(sqlDraft);
    const isGranted = grantRegex.test(sqlDraft);

    if (!isRevoked || !isGranted) {
      adminRpcsSecured = false;
      adminViolations.push(`${rpc} (revoked=${isRevoked}, granted=${isGranted})`);
    }
  }

  assert(
    'GRT-03',
    'PRIVILEGES',
    'Administrative RPCs strictly REVOKE from PUBLIC, anon and grant only to authenticated, service_role',
    adminRpcsSecured,
    adminViolations.length > 0 ? `Violations: ${adminViolations.join(', ')}` : 'Administrative RPC isolation verified'
  );

  // Internal Helper: check_and_increment_rate_limit
  const rateLimitRevoke = /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.check_and_increment_rate_limit[^\n;]*FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(sqlDraft);
  assert(
    'GRT-04',
    'PRIVILEGES',
    'check_and_increment_rate_limit helper revokes EXECUTE from PUBLIC, anon, and authenticated',
    rateLimitRevoke,
    'Internal rate-limiter helper strictly shielded from direct caller'
  );

  // --------------------------------------------------------------------------
  // 4. Direct Table Mutation Protection
  // --------------------------------------------------------------------------
  const tipInsertRevoke = /REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.glass_tips\s+FROM\s+anon,\s*authenticated,\s*PUBLIC/i.test(sqlDraft);
  const tipUpdateRevoke = /REVOKE\s+UPDATE\s+ON\s+TABLE\s+public\.glass_tips\s+FROM\s+anon,\s*authenticated,\s*PUBLIC/i.test(sqlDraft);
  const fleetInsertRevoke = /REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.vehicle_borrowing_requests\s+FROM\s+anon,\s*authenticated,\s*PUBLIC/i.test(sqlDraft);
  const fleetUpdateRevoke = /REVOKE\s+UPDATE\s+ON\s+TABLE\s+public\.vehicle_borrowing_requests\s+FROM\s+anon,\s*authenticated,\s*PUBLIC/i.test(sqlDraft);
  const auditInsertRevoke = /REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.audit_logs\s+FROM\s+anon,\s*PUBLIC/i.test(sqlDraft);
  const tokensRevoke = /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.public_form_tokens\s+FROM\s+anon,\s*authenticated,\s*PUBLIC/i.test(sqlDraft);
  const rateLimitsRevoke = /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.rpc_rate_limits\s+FROM\s+anon,\s*authenticated,\s*PUBLIC/i.test(sqlDraft);

  const directTableOk = tipInsertRevoke && tipUpdateRevoke && fleetInsertRevoke && fleetUpdateRevoke && auditInsertRevoke && tokensRevoke && rateLimitsRevoke;

  assert(
    'TAB-01',
    'TABLE_SECURITY',
    'Direct INSERT/UPDATE on sensitive tables revoked to enforce atomic RPCs',
    directTableOk,
    'Direct table mutation bypass prevention verified'
  );

  // --------------------------------------------------------------------------
  // 5. RLS Policies: Restrictive DELETE on Labor Compliance Tables
  // --------------------------------------------------------------------------
  const compliancePolicies = [
    { table: 'leave_requests', policy: 'leave_requests_delete_deny' },
    { table: 'warning_letters', policy: 'warning_letters_delete_deny' },
    { table: 'violation_records', policy: 'violation_records_delete_deny' },
    { table: 'attendance_daily_records', policy: 'attendance_daily_records_delete_deny' },
  ];
  let allRestrictivePresent = true;
  let restrictiveViolations = [];

  for (const item of compliancePolicies) {
    const regex = new RegExp(`CREATE\\s+POLICY\\s+"${item.policy}"\\s+ON\\s+public\\.${item.table}[\\s\\S]*?AS\\s+RESTRICTIVE[\\s\\S]*?FOR\\s+DELETE\\s+TO\\s+authenticated[\\s\\S]*?USING\\s*\\(\\s*false\\s*\\)`, 'i');
    if (!regex.test(sqlDraft)) {
      allRestrictivePresent = false;
      restrictiveViolations.push(item.table);
    }
  }

  assert(
    'RLS-01',
    'RESTRICTIVE_DELETE',
    'All 4 labor compliance tables have AS RESTRICTIVE FOR DELETE (false) policies in draft migration',
    allRestrictivePresent,
    restrictiveViolations.length > 0 ? `Missing restrictive delete on: ${restrictiveViolations.join(', ')}` : 'Permanent anti-hard-delete enforced'
  );

  const badRestrictive = /CREATE\s+POLICY[^\n;]*ON\s+public\.(glass_tips|vehicle_borrowing_requests)\s+AS\s+RESTRICTIVE\s+FOR\s+DELETE/i.test(sqlDraft);
  assert(
    'RLS-02',
    'RESTRICTIVE_DELETE',
    'No erroneous restrictive delete policies assigned to glass_tips or fleet requests',
    !badRestrictive,
    'Operational tables maintain correct RLS classification'
  );

  // --------------------------------------------------------------------------
  // 6. Exclusion Constraints & Concurrency Protection
  // --------------------------------------------------------------------------
  const hasExclusionConstraint = /EXCLUDE\s+USING\s+gist\s*\(\s*vehicle_id\s+WITH\s+=,\s*tstzrange\s*\(\s*start_time,\s*estimated_return_time/i.test(sqlCore);
  assert(
    'CON-01',
    'EXCLUSION_GIST',
    'PostgreSQL exclusion constraint on vehicle schedule overlap defined in core schema',
    hasExclusionConstraint,
    'Engine-level schedule overlap prevention verified'
  );

  // --------------------------------------------------------------------------
  // 7. Audit Log Integrity & Anti-Spoofing
  // --------------------------------------------------------------------------
  const auditActorCheck = /CREATE\s+POLICY\s+"audit_logs_insert"\s+ON\s+public\.audit_logs[\s\S]*?FOR\s+INSERT\s+TO\s+authenticated[\s\S]*?actor_id\s*=\s*auth\.uid\(\)/i.test(sqlDraft);
  const auditTrigger = /CREATE\s+TRIGGER\s+trg_protect_audit_logs/i.test(sqlCore);
  const auditException = /Audit logs bersifat Append-Only/i.test(sqlCore);

  assert(
    'AUD-01',
    'AUDIT_INTEGRITY',
    'Audit logs enforce actor_id = auth.uid() and trigger prevents UPDATE/DELETE',
    auditActorCheck && auditTrigger && auditException,
    'Audit immutability and anti-spoofing verified'
  );

  // --------------------------------------------------------------------------
  // 8. Rate Limiter Table & Index Definitions
  // --------------------------------------------------------------------------
  const hasRateLimitsTable = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.rpc_rate_limits/i.test(sqlDraft);
  const hasRateLimitsIdx = /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_rpc_rate_limits_window_start/i.test(sqlDraft);
  const hasRateLimitsCleanup = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.cleanup_expired_rate_limits/i.test(sqlDraft);

  assert(
    'RAT-01',
    'RATE_LIMITING',
    'rpc_rate_limits table, index, and cleanup_expired_rate_limits maintenance defined',
    hasRateLimitsTable && hasRateLimitsIdx && hasRateLimitsCleanup,
    'Atomic rate-limiting infrastructure verified'
  );

  // --------------------------------------------------------------------------
  // 9. Input Sanitization & Bounds Hardening
  // --------------------------------------------------------------------------
  const hasPinRegex = /\^\[0-9\]\{6\}\$/i.test(sqlDraft);
  const hasDummyBcrypt = sqlDraft.includes('$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
  const hasIsDistinctFrom = /IS\s+DISTINCT\s+FROM/i.test(sqlDraft);

  assert(
    'INP-01',
    'INPUT_BOUNDS',
    '6-digit PIN regex validation, dummy bcrypt timing defense, and IS DISTINCT FROM null checks enforced',
    hasPinRegex && hasDummyBcrypt && hasIsDistinctFrom,
    'Adversarial input defenses verified'
  );

  // --------------------------------------------------------------------------
  // 10. PHASE 1C.4-R CRITICAL SECURITY REMEDIATION STATIC VALIDATION
  // --------------------------------------------------------------------------
  if (sqlCrit) {
    // TX-03: Transaction boundary for critical remediation migration
    const critBegin = /^BEGIN;/m.test(sqlCrit);
    const critCommit = /^COMMIT;/m.test(sqlCrit);
    const critDollars = (sqlCrit.match(/\$\$/g) || []).length;
    assert(
      'TX-03',
      'REMEDIATION_TX',
      'Critical remediation migration 20261106000001 is enclosed in atomic BEGIN; ... COMMIT;',
      critBegin && critCommit && sqlCrit.indexOf('BEGIN;') < sqlCrit.lastIndexOf('COMMIT;'),
      'Critical remediation migration transaction boundary verified'
    );
    assert(
      'TX-04',
      'REMEDIATION_TX',
      'Critical remediation PL/pgSQL routines have balanced $$ quotation delimiters',
      critDollars > 0 && critDollars % 2 === 0,
      `Total $$ count: ${critDollars}`
    );

    // SEC-02: SECURITY DEFINER and search_path on remediated RPCs
    const critSecDefs = [...sqlCrit.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)[\s\S]*?LANGUAGE\s+plpgsql[\s\S]*?(?=CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|COMMIT;|$)/gi)];
    let critSecOk = critSecDefs.length >= 2;
    let critSecViolations = [];
    for (const b of critSecDefs) {
      const fn = b[1];
      const txt = b[0];
      if (/SECURITY\s+DEFINER/i.test(txt)) {
        const sp = txt.match(/SET\s+search_path\s*=\s*([^;\n]+)/i);
        if (!sp || !sp[1].toLowerCase().includes('public') || !sp[1].trim().toLowerCase().endsWith('pg_temp')) {
          critSecOk = false;
          critSecViolations.push(fn);
        }
      }
    }
    assert(
      'SEC-02',
      'REMEDIATION_SEC',
      'Remediated RPCs (submit_leave_request_atomic, assign_user_roles_atomic) enforce secure search_path with pg_temp last',
      critSecOk,
      critSecViolations.length > 0 ? `Violations: ${critSecViolations.join(', ')}` : 'All remediated RPCs verified'
    );

    // RLS-03: Remediation 3 (HIGH) employee_sensitive_data RESTRICTIVE DELETE deny
    const sensPolicy = /CREATE\s+POLICY\s+"employee_sensitive_delete_deny"\s+ON\s+public\.employee_sensitive_data[\s\S]*?AS\s+RESTRICTIVE[\s\S]*?FOR\s+DELETE\s+TO\s+authenticated[\s\S]*?USING\s*\(\s*false\s*\)/i.test(sqlCrit);
    const sensRevoke = /REVOKE\s+DELETE\s+ON\s+TABLE\s+public\.employee_sensitive_data\s+FROM\s+anon,\s*authenticated,\s*PUBLIC/i.test(sqlCrit);
    assert(
      'RLS-03',
      'REMEDIATION_RLS',
      'employee_sensitive_data enforces AS RESTRICTIVE FOR DELETE (false) and revokes DELETE from all roles',
      sensPolicy && sensRevoke,
      'Anti-hard-delete on sensitive employee data verified'
    );

    // GRT-05: assign_user_roles_atomic privilege isolation
    const assignRevokePublic = /REVOKE\s+(?:ALL|EXECUTE)\s+ON\s+FUNCTION\s+public\.assign_user_roles_atomic[^\n;]*FROM\s+PUBLIC/i.test(sqlCrit);
    const assignRevokeAnon = /REVOKE\s+(?:ALL|EXECUTE)\s+ON\s+FUNCTION\s+public\.assign_user_roles_atomic[^\n;]*FROM\s+anon/i.test(sqlCrit);
    const assignGrant = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.assign_user_roles_atomic[^\n;]*TO\s+authenticated,\s*service_role/i.test(sqlCrit);
    assert(
      'GRT-05',
      'REMEDIATION_GRT',
      'assign_user_roles_atomic revokes from PUBLIC/anon and grants only to authenticated/service_role',
      assignRevokePublic && assignRevokeAnon && assignGrant,
      'User role assignment privilege isolation verified'
    );

    // GRT-06: submit_leave_request_atomic privilege boundary
    const leaveRevoke = /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.submit_leave_request_atomic[^\n;]*FROM\s+PUBLIC/i.test(sqlCrit);
    const leaveGrant = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_leave_request_atomic[^\n;]*TO\s+anon,\s*authenticated,\s*service_role/i.test(sqlCrit);
    assert(
      'GRT-06',
      'REMEDIATION_GRT',
      'submit_leave_request_atomic revokes from PUBLIC and grants to anon, authenticated, service_role',
      leaveRevoke && leaveGrant,
      'Kiosk leave privilege boundary verified'
    );

    // INP-02: Remediation 1 (CRITICAL) Rollback-free persistent lockout on wrong PIN
    const hasPinUpdateWithoutRollback = sqlCrit.includes('UPDATE employee_portal_auth') &&
                                       sqlCrit.includes('SET failed_attempts = v_new_attempts') &&
                                       sqlCrit.includes('RETURN jsonb_build_object(\'success\', false, \'code\', \'AUTH_FAILED\'');
    const hasNoRaiseExceptionOnWrongPin = !/v_auth\.pin_hash[\s\S]*?RAISE\s+EXCEPTION/i.test(sqlCrit);
    assert(
      'INP-02',
      'REMEDIATION_ROLLBACK_FREE',
      'submit_leave_request_atomic updates failed_attempts persistently without transaction rollback (no RAISE EXCEPTION on wrong PIN)',
      hasPinUpdateWithoutRollback && hasNoRaiseExceptionOnWrongPin,
      'Persistent PIN lockout without transaction abort verified'
    );

    // ------------------------------------------------------------------------
    // 11. PHASE 1C.4R-F SCHEMA FIX & RBAC HARDENING ASSERTIONS
    // ------------------------------------------------------------------------
    // SCH-01: No reference to nonexistent table leave_dates; strictly references leave_request_dates
    const referencesLeaveDates = /\bINTO\s+leave_dates\b/i.test(sqlCrit) || /\bFROM\s+leave_dates\b/i.test(sqlCrit);
    const referencesCanonicalDates = /\bINTO\s+leave_request_dates\b/i.test(sqlCrit);
    assert(
      'SCH-01',
      'CANONICAL_SCHEMA',
      'submit_leave_request_atomic references canonical table leave_request_dates and has NO reference to nonexistent leave_dates',
      !referencesLeaveDates && referencesCanonicalDates,
      'Canonical table leave_request_dates verified'
    );

    // SCH-02: No reference to nonexistent column is_sunday
    const referencesIsSunday = /\bis_sunday\b/i.test(sqlCrit);
    assert(
      'SCH-02',
      'CANONICAL_SCHEMA',
      'submit_leave_request_atomic contains zero references to nonexistent is_sunday column',
      !referencesIsSunday,
      'Absence of non-canonical is_sunday column verified'
    );

    // SCH-03: Structural validation that all columns in leave_request_dates INSERT exist in core schema
    const insertDatesMatch = sqlCrit.match(/INSERT\s+INTO\s+leave_request_dates\s*\(([^)]+)\)/i);
    let allColumnsValid = false;
    let invalidCols = [];
    if (insertDatesMatch) {
      const cols = insertDatesMatch[1].split(',').map(c => c.trim().toLowerCase());
      // Canonical columns from core schema: id, unit_id, leave_request_id, leave_date, created_at
      const canonicalCols = ['id', 'unit_id', 'leave_request_id', 'leave_date', 'created_at'];
      invalidCols = cols.filter(c => !canonicalCols.includes(c));
      allColumnsValid = invalidCols.length === 0 && cols.includes('unit_id') && cols.includes('leave_request_id') && cols.includes('leave_date');
    }
    assert(
      'SCH-03',
      'CANONICAL_SCHEMA',
      'All columns in leave_request_dates INSERT exist in canonical core schema table',
      allColumnsValid,
      invalidCols.length > 0 ? `Invalid columns found: ${invalidCols.join(', ')}` : 'Column alignment verified'
    );

    // RBAC-01: Super Admin self-demotion protection
    const hasSelfDemotionCheck = sqlCrit.includes('auth.uid() = p_target_user_id') &&
                                 sqlCrit.includes('SELF_DEMOTION_DENIED');
    assert(
      'RBAC-01',
      'RBAC_HARDENING',
      'assign_user_roles_atomic explicitly guards against Super Admin self-demotion',
      hasSelfDemotionCheck,
      'Self-demotion prevention gate verified'
    );

    // RBAC-02: Last-Super-Admin removal protection
    const hasLastSuperAdminCheck = sqlCrit.includes('LAST_SUPER_ADMIN_PROTECTED') &&
                                   sqlCrit.includes('v_active_super_count <= 1');
    assert(
      'RBAC-02',
      'RBAC_HARDENING',
      'assign_user_roles_atomic explicitly protects against removing the last active Super Admin',
      hasLastSuperAdminCheck,
      'Last-Super-Admin removal prevention verified'
    );

    // RBAC-03: System role type validation and active unit existence checks
    const hasRoleTypeCheck = sqlCrit.includes('INVALID_SYSTEM_ROLE') && sqlCrit.includes('v_role.is_system_role');
    const hasUnitValidation = sqlCrit.includes('INVALID_UNIT_ASSIGNMENT') && sqlCrit.includes('SELECT 1 FROM units WHERE id = u_id AND is_active = TRUE');
    assert(
      'RBAC-03',
      'RBAC_HARDENING',
      'assign_user_roles_atomic validates is_system_role flag and verifies active unit existence',
      hasRoleTypeCheck && hasUnitValidation,
      'Role type and unit existence integrity checks verified'
    );

    // RBAC-04: Concurrency serialization lock for Super Admin operations
    const hasAdvisoryXactLock = /pg_advisory_xact_lock\s*\(\s*hashtext\s*\(\s*'assign_user_roles_atomic:super_admin_serialization'\s*\)\s*\)/i.test(sqlCrit);
    assert(
      'RBAC-04',
      'CONCURRENCY_LOCKING',
      'assign_user_roles_atomic acquires pg_advisory_xact_lock to serialize Super Admin mutations',
      hasAdvisoryXactLock,
      'Transaction-level advisory serialization lock verified'
    );

    // SCH-04: submit_glass_tip_atomic canonical column selling_price_per_sqm and NO base_price
    const referencesBasePrice = /\bbase_price\b/i.test(sqlDraft);
    const referencesSellingPrice = /\bselling_price_per_sqm\b/i.test(sqlDraft);
    assert(
      'SCH-04',
      'CANONICAL_SCHEMA',
      'submit_glass_tip_atomic queries canonical selling_price_per_sqm and contains NO reference to nonexistent base_price',
      !referencesBasePrice && referencesSellingPrice,
      'Canonical column selling_price_per_sqm verified in submit_glass_tip_atomic'
    );

    // SCH-05: submit_glass_tip_atomic contains zero reference to non-canonical enum value 'PERCENTAGE'
    const referencesPercentageEnum = /'PERCENTAGE'/i.test(sqlDraft);
    assert(
      'SCH-05',
      'CANONICAL_SCHEMA',
      'submit_glass_tip_atomic contains zero references to non-canonical enum value PERCENTAGE',
      !referencesPercentageEnum,
      'Enum integrity verified against tip_calculation_method_enum'
    );

    // RAT-02: check_and_increment_rate_limit validates NULL and non-positive inputs
    const hasRateLimitParamValidation = sqlDraft.includes('p_bucket_key IS NULL OR TRIM(p_bucket_key) = \'\'') &&
                                        sqlDraft.includes('p_max_attempts IS NULL OR p_max_attempts <= 0') &&
                                        sqlDraft.includes('p_window_interval IS NULL OR p_window_interval <= INTERVAL \'0 second\'');
    assert(
      'RAT-02',
      'RATE_LIMITING',
      'check_and_increment_rate_limit explicitly guards against NULL and non-positive parameter inputs',
      hasRateLimitParamValidation,
      'Rate limiter parameter boundary validation verified'
    );

    // SCH-06: submit_leave_request_atomic enforces canonical month regex (01-12)
    const hasCanonicalMonthRegex = sqlCrit.includes('^[0-9]{4}-(0[1-9]|1[0-2])$');
    assert(
      'SCH-06',
      'CANONICAL_SCHEMA',
      'submit_leave_request_atomic validates month format strictly against canonical regex (01-12)',
      hasCanonicalMonthRegex,
      'Canonical month regex alignment verified'
    );

    // SCH-07: submit_glass_tip_atomic validates missing selling_price_per_sqm and halts with structured error
    const hasSellingPriceNullCheck = sqlDraft.includes('v_glass_type.selling_price_per_sqm IS NULL') &&
                                     sqlDraft.includes('INVALID_GLASS_PRICE');
    assert(
      'SCH-07',
      'CANONICAL_SCHEMA',
      'submit_glass_tip_atomic halts on NULL selling_price_per_sqm with INVALID_GLASS_PRICE error',
      hasSellingPriceNullCheck,
      'Master glass price validation gate verified'
    );

    // SCH-08: submit_glass_tip_atomic halts on pending calculation methods (SIZE_RANGE, HYBRID)
    const hasPendingMethodCheck = sqlDraft.includes('v_rate.calculation_method IN (\'SIZE_RANGE\', \'HYBRID\')') &&
                                  sqlDraft.includes('METHOD_PENDING_APPROVAL');
    assert(
      'SCH-08',
      'BUSINESS_RULE_GOVERNANCE',
      'submit_glass_tip_atomic halts on pending calculation methods (SIZE_RANGE, HYBRID) with METHOD_PENDING_APPROVAL',
      hasPendingMethodCheck,
      'Non-speculative calculation method governance verified'
    );

    // RAT-03: check_and_increment_rate_limit validates max 150 chars key and callers clamp IP to 45 chars
    const hasKeyLengthValidation = sqlDraft.includes('length(TRIM(p_bucket_key)) > 150');
    const hasIpClampingDraft = sqlDraft.includes('SUBSTRING(v_client_ip, 1, 45)');
    const hasIpClampingCrit = sqlCrit.includes('SUBSTRING(v_client_ip, 1, 45)');
    assert(
      'RAT-03',
      'RATE_LIMITING',
      'check_and_increment_rate_limit validates 150-char key bound and callers clamp client IP to 45 chars',
      hasKeyLengthValidation && hasIpClampingDraft && hasIpClampingCrit,
      'Rate limit key length and IP clamping defense verified'
    );
  }

  log('\n----------------------------------------------------------------');
  log(`STATIC VALIDATION FINISHED: ${passCount} PASSED, ${failCount} FAILED out of ${tests.length} tests`);
  log('----------------------------------------------------------------\n');

  return { passCount, failCount, tests, success: failCount === 0 };
}

if (require.main === module) {
  const result = runStaticValidation();
  process.exit(result.success ? 0 : 1);
}

module.exports = { runStaticValidation };
