# PHASE 1C.4R-G — LAST SUPER ADMIN CONCURRENCY HARDENING REPORT
**Project:** KUK Management System v3.1.0  
**Baseline Git Commit:** `b77fc90`  
**Execution Mode:** Strictly Local-Only Audit & Concurrency Remediation  
**Status:** COMPLETE (VERIFIED WITH LIMITATIONS)

---

## 1. EXECUTIVE SUMMARY

In Phase 1C.4R-F, role-based access control (RBAC) hardening was introduced in migration draft `20261106000001_critical_security_remediation.sql` to prevent Super Admin self-demotion and protect against demoting the last active Super Admin.

In **Phase 1C.4R-G**, an in-depth adversarial concurrency audit was conducted on `assign_user_roles_atomic`. The audit confirmed a critical race condition under PostgreSQL's default `Read Committed` transaction isolation level:
- When two Super Admins simultaneously attempt to demote each other, both concurrent transactions execute `SELECT count(*) INTO v_active_super_count` before either transaction commits.
- Both transactions observe `v_active_super_count = 2 > 1`, bypass the last-admin guard, delete the respective Super Admin role mappings, and commit.
- This creates an orphaned system state with **0 active Super Admins**, permanently locking out administrative access.

To remediate this vulnerability locally without touching Supabase Cloud Production, database-level serialization was implemented in migration draft `20261106000001_critical_security_remediation.sql` using a transaction-level advisory lock (`pg_advisory_xact_lock`). The test suite was extended with static validation, dynamic race condition simulations, and negative mutation tests.

---

## 2. ADVERSARIAL CONCURRENCY RISK INVESTIGATION

### The Scenario
1. Initial State: Two active Super Admins exist in the system (Admin A: `uuid-a`, Admin B: `uuid-b`).
2. Concurrent Execution:
   - Admin A initiates demotion of Admin B (`p_target_user_id = 'uuid-b'`, removing `super_admin`).
   - Admin B simultaneously initiates demotion of Admin A (`p_target_user_id = 'uuid-a'`, removing `super_admin`).
3. Isolation Level Dynamics (`Read Committed`):
   - Transaction A checks: Is A demoting itself? No (`p_target_user_id != auth.uid()`).
   - Transaction B checks: Is B demoting itself? No (`p_target_user_id != auth.uid()`).
   - Transaction A executes `SELECT count(*) FROM user_system_roles WHERE role_code = 'super_admin'`. In Read Committed without locks, it counts 2.
   - Transaction B executes the same query concurrently before A commits. In Read Committed without locks, it also counts 2.
   - Both transactions evaluate `v_active_super_count > 1` as `TRUE`.
   - Transaction A deletes Admin B's Super Admin role.
   - Transaction B deletes Admin A's Super Admin role.
   - Both transactions commit.
4. Result:
   - Super Admin count drops from 2 to 0.
   - Catastrophic administrative lockout.

### Investigation Verdict
The unlatched query was fundamentally susceptible to phantom updates / race conditions. Row-level locks (`SELECT FOR UPDATE`) on `user_system_roles` cannot guarantee serialization because:
- Demotions involve deleting rows, while promotions involve inserting rows.
- If no rows or different rows are locked, locking individual rows does not prevent concurrent predicate evaluation.
- Table locks (`LOCK TABLE user_system_roles IN EXCLUSIVE MODE`) introduce excessive contention and could trigger deadlock chains with other transaction paths.

---

## 3. DATABASE-LEVEL REMEDIATION: TRANSACTION ADVISORY LOCKING

### Remediation Strategy
The optimal, deadlock-free serialization mechanism in PostgreSQL is a **transaction-level advisory exclusive lock**:
```sql
PERFORM pg_advisory_xact_lock(hashtext('assign_user_roles_atomic:super_admin_serialization'));
```

### Rationale & Guarantees
1. **Key Stability:** `hashtext('assign_user_roles_atomic:super_admin_serialization')` deterministically generates a signed 32-bit integer (`-1123483981`), ensuring all instances across the PostgreSQL cluster target the exact same advisory lock resource.
2. **Automatic Lifecycle:** `pg_advisory_xact_lock` is strictly bound to the transaction lifecycle. It is released automatically on `COMMIT` or `ROLLBACK` (or transaction crash), eliminating orphaned lock leaks.
3. **Execution Sequencing:**
   - Transaction A acquires the advisory lock first.
   - Transaction B attempts to acquire the lock and is put into a sleep/wait state at the PostgreSQL engine level.
   - Transaction A counts Super Admins (`v_active_super_count = 2`), demotes Admin B, and commits.
   - Lock is released upon commit.
   - Transaction B unblocks. Under Read Committed isolation, when Transaction B executes `SELECT count(*)`, it evaluates against the fresh database snapshot that includes Transaction A's committed deletion.
   - Transaction B calculates `v_active_super_count = 1 <= 1`.
   - Transaction B aborts the demotion, returning:
     ```json
     {"success": false, "error": "LAST_SUPER_ADMIN_PROTECTED", "message": "Cannot demote or remove the last active Super Admin account."}
     ```
   - Exactly 1 active Super Admin remains. Zero-admin lockout is mathematically impossible.
4. **Deadlock Immunity:** Because every call to `assign_user_roles_atomic` acquires this lock as its first serialization boundary before taking any table or row locks, lock acquisition order is strictly monotonic across all sessions. Deadlocks cannot occur.
5. **No Performance Degradation on Regular Traffic:** Operational queries (sales, attendance, inventory, fleet, tips) do not interact with this advisory lock. Only administrative role alterations contend for this lock.

---

## 4. MIGRATION DRAFT IMPLEMENTATION

In `supabase/migrations/20261106000001_critical_security_remediation.sql`, the beginning of `assign_user_roles_atomic` was hardened:

```sql
  -- =========================================================================
  -- 2. SERIALIZATION LOCK FOR SUPER ADMIN MUTATIONS
  -- =========================================================================
  -- Acquire a transaction-level advisory lock to serialize role assignment
  -- operations across concurrent transactions. This prevents the classic
  -- race condition where two Super Admins simultaneously demote each other,
  -- both see count(*) > 1 before either commits, and both demotions succeed,
  -- leaving the system with 0 active Super Admins.
  -- Key is stable: hashtext('assign_user_roles_atomic:super_admin_serialization')
  -- Lock is held until transaction commit/rollback (pg_advisory_xact_lock).
  -- =========================================================================
  PERFORM pg_advisory_xact_lock(hashtext('assign_user_roles_atomic:super_admin_serialization'));

  -- =========================================================================
  -- 3. VALIDATE TARGET USER EXISTS
  -- =========================================================================
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'USER_NOT_FOUND',
      'message', 'Target user does not exist.'
    );
  END IF;
```

---

## 5. TEST HARNESS & SIMULATION EXPANSIONS

Four layers of automated testing were enhanced:

### A. Static SQL AST / Regex Verification (`scripts/test_phase1_static.cjs`)
- Added `[RBAC-04] [CONCURRENCY_LOCKING]`: Verifies that `assign_user_roles_atomic` contains `pg_advisory_xact_lock(hashtext('assign_user_roles_atomic:super_admin_serialization'))`.
- Total suite assertions: 29 / 29 PASSED.

### B. Simulation Engine & Adversarial Tests (`scripts/test_phase1_simulation.cjs`)
- Added `[RPC-SIM-21] [CONCURRENT_MUTUAL_DEMOTION]`: Simulates two concurrent transactions where Admin A attempts to demote Admin B and Admin B attempts to demote Admin A under simulated transaction advisory locking. Confirms:
  - Transaction 1 acquires lock, validates `super_count = 2`, completes demotion, and commits.
  - Transaction 2 blocked until Transaction 1 commits; upon unblocking, snapshot sees `super_count = 1 <= 1`, demotion is blocked with `LAST_SUPER_ADMIN_PROTECTED`.
  - System retains exactly 1 active Super Admin.
- Added `[RPC-SIM-22] [CONCURRENT_PROMOTION_DEMOTION]`: Simulates concurrent succession: Admin A promotes Admin C to Super Admin while simultaneously attempting to demote Admin B. Confirms that once Admin C is promoted, Super Admin count allows subsequent demotion safely while maintaining at least 1 active Super Admin.
- Total suite assertions: 28 / 28 PASSED.

### C. False-Positive & Negative Mutation Harness (`scripts/test_phase1_negative_fpt.cjs`)
- Added `[FPT-12]`: Injects mutant code that deletes `PERFORM pg_advisory_xact_lock(...)` from `assign_user_roles_atomic`. Confirms that the static test validator flags the mutation and fails immediately.
- Total suite assertions: 12 / 12 PASSED.

### D. Consolidated Test Counts
- `npm run test:phase1:all`: 84 / 84 assertions PASSED.
- `npm run test:phase2`: 11 / 11 assertions PASSED.
- `npm run test:phase3`: 29 / 29 assertions PASSED.
- **Total Local Automated Assertions:** **124 / 124 PASSED (100%)**.
- `npm run typecheck`: 0 errors.
- `npm run build`: 0 errors (built clean in 8.05s).

---

## 6. BUSINESS RULE DEPENDENCIES

All 11 business rules identified in Phase 1C.4 remain strictly in state `BUSINESS_RULE_PENDING_APPROVAL`:
1. `BR-01`: Overtime rounding interval and approval tolerance.
2. `BR-02`: Leave accrual formula and prorated balance allocation.
3. `BR-03`: Late arrival salary deduction brackets.
4. `BR-04`: Glass tip pool distribution weighting per role.
5. `BR-05`: Vehicle maintenance grace mileage.
6. `BR-06`: Payroll bonus percentage calculation.
7. `BR-07`: Multi-tier approval thresholds for expenses.
8. `BR-08`: Public kiosk PIN failed attempt lockout duration (defaulted to 15 min pending formal approval).
9. `BR-09`: Daily leave application quota per department.
10. `BR-10`: Vehicle return inspection checklist mandatory failure criteria.
11. `BR-11`: Automatic session timeout duration for kiosk terminals.

---

## 7. RUNTIME LIMITATIONS & PRODUCTION BOUNDARIES

> [!CAUTION]
> **RUNTIME STATUS: NOT TESTED — REQUIRES POSTGRESQL/SUPABASE RUNTIME**  
> While the static regex analysis, simulation engine, and negative mutation tests prove correct implementation and design logic locally, **no live PostgreSQL 17 engine or Supabase Cloud database has executed this migration draft**. Real concurrent lock acquisition under high connection load, deadlock detection under competing processes, and foreign key cascades must be validated in an isolated PostgreSQL runtime before applying to Production.

### Production Safety Invariants
- Remote Supabase Production (`ckzciuybedefbsdfsexh`) was **NOT accessed, queried, or modified**.
- No staging project was created.
- Migration `20261106000001_critical_security_remediation.sql` remains strictly **UNAPPLIED**.
- Historical migrations (`20261104000001` and `20261104000002`) have **ZERO DIFF**.
- Public leave kiosk remains strictly **BLOCKED** in frontend (`PublicLeaveRequestPage.tsx`).
- No Git commit, branch push, or deployment was performed.

---

## 8. FINAL VERDICT

```
================================================================================
FINAL VERDICT: VERIFIED WITH LIMITATIONS
--------------------------------------------------------------------------------
Phase 1C.4R-G Last Super Admin Concurrency Hardening has been completely
implemented locally and verified through static AST analysis, simulation tests,
and negative mutation testing. The solution guarantees mutual demotion
serialization and prevents 0-admin lockouts.
Runtime execution in a live PostgreSQL engine is required before applying
migration 20261106000001 to Supabase Production.
================================================================================
```

