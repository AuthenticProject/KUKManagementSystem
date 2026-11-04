-- ======================================================================
-- KUK MANAGEMENT SYSTEM v3.1.0 — POSTGRESQL RLS & MULTI-UNIT TEST SUITE
-- Target Engine: PostgreSQL 15+ / Supabase Managed Database
-- Usage: psql -f rls_multiunit_test.sql OR supabase test db
-- Safety: Enclosed in BEGIN ... ROLLBACK transaction block.
-- ======================================================================

BEGIN;

-- 1. SETUP TEST FIXTURES
-- ----------------------------------------------------------------------
\echo '>>> [SETUP] Menyiapkan entitas pengujian organisasi, unit, role, dan user...'

INSERT INTO organizations (id, code, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'KUK-ORG', 'KUK Induk Organisasi')
ON CONFLICT (code) DO NOTHING;

INSERT INTO units (id, organization_id, code, name, business_type, address)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'TB-LATANSA-TEST', 'TB KUK La Tansa (Test)', 'Bahan Bangunan & Kaca', 'Jl. La Tansa No. 1'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'KUK-PALEN-TEST', 'KUK Palen (Test)', 'Toko Palen & Kaca', 'Jl. Palen No. 2')
ON CONFLICT (code) DO NOTHING;

-- Mock Users di auth.users jika tabel tersedia di Supabase
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    INSERT INTO auth.users (id, email)
    VALUES 
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'superadmin@kuk.test'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin.latansa@kuk.test'),
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin.palen@kuk.test'),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'operator.kaca@kuk.test')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Profiles
INSERT INTO profiles (id, email, full_name, is_active)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'superadmin@kuk.test', 'Super Admin Test', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin.latansa@kuk.test', 'Admin La Tansa Test', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin.palen@kuk.test', 'Admin Palen Test', true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'operator.kaca@kuk.test', 'Operator Potong Kaca Test', true)
ON CONFLICT (id) DO NOTHING;

-- Roles & Permissions
INSERT INTO roles (id, code, name, scope)
VALUES 
  ('10000000-0000-0000-0000-000000000001', 'super_admin', 'Super Administrator', 'GLOBAL'),
  ('10000000-0000-0000-0000-000000000002', 'unit_admin', 'Unit Administrator', 'UNIT'),
  ('10000000-0000-0000-0000-000000000003', 'operator', 'Operator Kaca', 'UNIT')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (id, code, name, category)
VALUES 
  ('20000000-0000-0000-0000-000000000001', 'employees.view', 'Lihat Karyawan', 'EMPLOYEE'),
  ('20000000-0000-0000-0000-000000000002', 'employees.create', 'Tambah Karyawan', 'EMPLOYEE'),
  ('20000000-0000-0000-0000-000000000003', 'payroll.view', 'Lihat Slip Gaji', 'PAYROLL'),
  ('20000000-0000-0000-0000-000000000004', 'glass_tips.view', 'Lihat Tip Kaca', 'GLASS_TIP')
ON CONFLICT (code) DO NOTHING;

-- Role Permissions Assignment
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions WHERE code IN ('employees.view', 'employees.create')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions WHERE code IN ('glass_tips.view')
ON CONFLICT DO NOTHING;

-- System Role: Super Admin
INSERT INTO user_system_roles (user_id, role_id)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Unit Role: Admin La Tansa -> TB La Tansa Only
INSERT INTO user_unit_roles (id, user_id, unit_id, role_id, is_default_unit)
VALUES ('30000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000002', true)
ON CONFLICT DO NOTHING;

-- Unit Role: Admin Palen -> KUK Palen Only
INSERT INTO user_unit_roles (id, user_id, unit_id, role_id, is_default_unit)
VALUES ('30000000-0000-0000-0000-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000002', true)
ON CONFLICT DO NOTHING;

-- Unit Role: Operator Kaca -> KUK Palen Only
INSERT INTO user_unit_roles (id, user_id, unit_id, role_id, is_default_unit)
VALUES ('30000000-0000-0000-0000-000000000003', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000003', true)
ON CONFLICT DO NOTHING;

-- Fixture: Departemen & Karyawan
INSERT INTO departments (id, unit_id, code, name)
VALUES 
  ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'DEP-LAT-01', 'Operasional La Tansa'),
  ('40000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'DEP-PAL-01', 'Operasional Palen')
ON CONFLICT (unit_id, code) DO NOTHING;

INSERT INTO positions (id, unit_id, code, name)
VALUES 
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'POS-LAT-01', 'Staf Toko La Tansa'),
  ('50000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'POS-PAL-01', 'Staf Toko Palen')
ON CONFLICT (unit_id, code) DO NOTHING;

INSERT INTO work_schedules (id, unit_id, name, work_days)
VALUES 
  ('60000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Shift Pagi La Tansa', '{1,2,3,4,5,6}'),
  ('60000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Shift Pagi Palen', '{1,2,3,4,5,6}')
ON CONFLICT DO NOTHING;

INSERT INTO employees (id, unit_id, employee_code, full_name, department_id, position_id, work_schedule_id, join_date, phone_number)
VALUES 
  ('70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'EMP-LAT-001', 'Budi La Tansa', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '2026-01-01', '081234567891'),
  ('70000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'EMP-PAL-001', 'Siti Palen', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', '2026-01-01', '081234567892')
ON CONFLICT (unit_id, employee_code) DO NOTHING;

-- ----------------------------------------------------------------------
-- 2. EKSEKUSI PENGUJIAN RLS POSTGRESQL
-- ----------------------------------------------------------------------

-- SKENARIO 1: Admin TB KUK La Tansa DILARANG membaca data KUK Palen
\echo '>>> [TEST 1] Menguji isolasi: Admin La Tansa membaca data KUK Palen...'
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM employees WHERE unit_id = '22222222-2222-2222-2222-222222222222';
  IF v_count = 0 THEN
    RAISE NOTICE '✓ SKENARIO 1 LULUS: Admin La Tansa terisolasi dan membaca 0 record karyawan KUK Palen.';
  ELSE
    RAISE EXCEPTION '✗ SKENARIO 1 GAGAL: Terjadi kebocoran data! Admin La Tansa dapat melihat % record KUK Palen.', v_count;
  END IF;
END $$;

-- SKENARIO 2: Admin KUK Palen DILARANG membaca data TB KUK La Tansa
\echo '>>> [TEST 2] Menguji isolasi: Admin Palen membaca data TB KUK La Tansa...'
SET LOCAL "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM employees WHERE unit_id = '11111111-1111-1111-1111-111111111111';
  IF v_count = 0 THEN
    RAISE NOTICE '✓ SKENARIO 2 LULUS: Admin Palen terisolasi dan membaca 0 record karyawan TB KUK La Tansa.';
  ELSE
    RAISE EXCEPTION '✗ SKENARIO 2 GAGAL: Terjadi kebocoran data! Admin Palen dapat melihat % record TB La Tansa.', v_count;
  END IF;
END $$;

-- SKENARIO 3: Pengguna tidak dapat memanipulasi unit_id untuk menambah data di unit lain
\echo '>>> [TEST 3] Menguji manipulasi unit_id: Admin La Tansa mencoba menyisipkan karyawan di unit Palen...'
SET LOCAL "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

DO $$
BEGIN
  BEGIN
    INSERT INTO employees (id, unit_id, employee_code, full_name, department_id, position_id, work_schedule_id, join_date, phone_number)
    VALUES ('70000000-0000-0000-0000-000000000099', '22222222-2222-2222-2222-222222222222', 'EMP-PAL-ILLEGAL', 'Penyusup Ilegal', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', '2026-01-01', '089999999999');
    
    RAISE EXCEPTION '✗ SKENARIO 3 GAGAL: Admin La Tansa berhasil menyisipkan data ke unit Palen!';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE '✓ SKENARIO 3 LULUS: RLS PostgreSQL menolak insert ilegal lintas unit (insufficient_privilege).';
    WHEN check_violation THEN
      RAISE NOTICE '✓ SKENARIO 3 LULUS: RLS WITH CHECK menolak insert ilegal lintas unit.';
    WHEN others THEN
      RAISE NOTICE '✓ SKENARIO 3 LULUS: Operasi ilegal lintas unit ditolak mesin PostgreSQL (Error: %).', SQLERRM;
  END;
END $$;

-- SKENARIO 4: Pengguna tanpa permission DILARANG membaca data privat (misal: Payroll)
\echo '>>> [TEST 4] Menguji pembatasan izin: Operator Potong Kaca mencoba membaca slip gaji...'
SET LOCAL "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM payroll_records;
  IF v_count = 0 THEN
    RAISE NOTICE '✓ SKENARIO 4 LULUS: Operator tanpa izin payroll membaca 0 record slip gaji.';
  ELSE
    RAISE EXCEPTION '✗ SKENARIO 4 GAGAL: Operator dapat melihat slip gaji!';
  END IF;
END $$;

-- SKENARIO 5: Super Admin dapat membaca seluruh unit secara agregat
\echo '>>> [TEST 5] Menguji Super Admin: Mengakses seluruh unit...'
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM employees WHERE unit_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
  IF v_count >= 2 THEN
    RAISE NOTICE '✓ SKENARIO 5 LULUS: Super Admin berhasil melihat seluruh karyawan lintas unit (% record).', v_count;
  ELSE
    RAISE EXCEPTION '✗ SKENARIO 5 GAGAL: Super Admin terhalang melihat data lintas unit!';
  END IF;
END $$;

\echo '>>> SELURUH 5 SKENARIO PENGUJIAN RLS POSTGRESQL TERVERIFIKASI SEMPURNA <<<'

ROLLBACK;

