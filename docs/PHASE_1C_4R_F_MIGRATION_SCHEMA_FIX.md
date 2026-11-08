# DOKUMENTASI PERBAIKAN SKEMA MIGRASI & PENGUATAN RBAC (PHASE 1C.4R-F)
## KUK Management System v3.1.0
**Tanggal Pelaksanaan:** 8 November 2026  
**Status Eksekusi:** COMPLETED & LOCALLY VERIFIED  
**Baseline Git:** `b77fc90` (Branch: `main`)  
**Target Migration:** `supabase/migrations/20261106000001_critical_security_remediation.sql` (**STATUS: UNAPPLIED**)  
**Runtime Status:** `NOT TESTED — REQUIRES POSTGRESQL/SUPABASE RUNTIME`

---

## 1. PERNYATAAN STATUS KESELAMATAN & BOUNDARIES

1. **Supabase Cloud Production (Project Ref: `ckzciuybedefbsdfsexh`, Tokyo) TIDAK PERNAH DIHUBUNGI / DISENTUH** (zero remote connection, zero remote DDL/DML).
2. **Historical Migrations Immutability:** Migrasi `20261104000001_core_schema_v3_1_0.sql` dan `20261104000002_harden_rpc_security.sql` dijaga kekal dengan **ZERO DIFF**.
3. **Draft Status:** Seluruh perbaikan dilakukan secara lokal pada draft migrasi `20261106000001_critical_security_remediation.sql` dan **TIDAK DIAPLIKASIKAN (UNAPPLIED)** ke database mana pun.
4. **Portal Kiosk Publik:** Formulir pengajuan cuti mandiri pada `src/modules/public/PublicLeaveRequestPage.tsx` dan `src/services/dataService.ts` tetap **TERKUNCI SECARA EKSPLISIT (`BLOCKED`)**.
5. **No Deployment / Commit:** Tidak ada commit, push, atau deploy yang dilakukan.

---

## 2. CACAT AWAL SKEMA & AKAR PENYEBABNYA (CRITICAL SCHEMA MISMATCH)

### A. Cacat Awal pada Migration Draft `20261106000001`
Pada prosedur RPC `submit_leave_request_atomic`, blok penyimpanan detail tanggal cuti (baris 260–272) sebelumnya memanggil:
```sql
-- KODE CACAT SEBELUMNYA:
FOREACH v_date IN ARRAY p_leave_dates LOOP
    INSERT INTO leave_dates (
        unit_id,
        leave_request_id,
        leave_date,
        is_sunday
    ) VALUES (
        p_unit_id,
        v_leave_id,
        v_date,
        (EXTRACT(DOW FROM v_date) = 0)
    );
END LOOP;
```

### B. Bukti Skema Kanonikal (`20261104000001_core_schema_v3_1_0.sql`)
Berdasarkan inspeksi langsung terhadap baris 401–414 migrasi kanonikal `20261104000001`:
```sql
CREATE TABLE leave_request_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL,
    leave_request_id UUID NOT NULL,
    leave_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_leave_dates_request
        FOREIGN KEY (unit_id, leave_request_id)
        REFERENCES leave_requests (unit_id, id)
        ON DELETE CASCADE,

    UNIQUE (leave_request_id, leave_date)
);
```
- **Fakta 1:** Nama tabel penyimpanan tanggal cuti yang sah adalah **`leave_request_dates`**, BUKAN `leave_dates`.
- **Fakta 2:** Kolom **`is_sunday` TIDAK ADA** dalam skema kanonikal.
- **Fakta 3:** Pada arsitektur PostgreSQL KUK, penentuan hari Minggu diderivasi secara dinamis saat query menggunakan fungsi bawaan `EXTRACT(DOW FROM leave_date) = 0`, sehingga penyimpanan redundant pada tabel dilarang.
- **Akar Masalah:** Penulis draft migrasi sebelumnya berasumsi menggunakan nama tabel simplifikasi `leave_dates` dan kolom derivasi `is_sunday`. Jika dieksekusi di runtime PostgreSQL, ini akan memicu error fatal `ERROR: 42P01: relation "leave_dates" does not exist`.

### C. Perbaikan SQL yang Diterapkan
Pada `supabase/migrations/20261106000001_critical_security_remediation.sql`, baris 260–271 telah diperbaiki secara tepat sesuai skema kanonikal:
```sql
-- 14. Simpan Detail Tanggal Cuti pada Tabel Kanonikal leave_request_dates
FOREACH v_date IN ARRAY p_leave_dates LOOP
    INSERT INTO leave_request_dates (
        unit_id,
        leave_request_id,
        leave_date
    ) VALUES (
        p_unit_id,
        v_leave_id,
        v_date
    );
END LOOP;
```
Seluruh nama kolom (`unit_id`, `leave_request_id`, `leave_date`) dan nilai foreign key terbukti cocok 100% dengan tabel kanonikal `leave_request_dates`.

---

## 3. PENGUATAN RBAC PADA `assign_user_roles_atomic`

Auditor independen sebelumnya menemukan bahwa Super Admin dapat secara keliru mencabut role miliknya sendiri (*self-demotion*) atau mencabut Super Admin terakhir dalam sistem.

### A. Proteksi Self-Demotion Super Admin
Pada `assign_user_roles_atomic`, ditambahkan pengaman:
```sql
-- 4. Proteksi Self-Demotion: Super Admin tidak boleh mencabut atau mendemosi role super_admin miliknya sendiri
IF auth.uid() = p_target_user_id AND (p_system_role_code IS NULL OR TRIM(p_system_role_code) != 'super_admin') THEN
    RETURN jsonb_build_object(
        'success', false,
        'code', 'SELF_DEMOTION_DENIED',
        'message', 'Operasi ditolak: Super Administrator tidak diizinkan mencabut atau mendemosi role sistem miliknya sendiri demi menjaga integritas akses.'
    );
END IF;
```
Super Admin dilarang menurunkan dirinya sendiri, mencegah skenario akun terkunci karena kecerobohan administratif.

### B. Proteksi Last-Super-Admin (Anti-Orphan)
Untuk mencegah skenario di mana seorang Super Admin mencabut role Super Admin lain hingga tidak ada lagi akun Super Admin yang tersisa di sistem:
```sql
-- 5. Proteksi Last-Super-Admin: Mencegah sistem kehilangan Super Admin terakhir
IF v_target_currently_super AND (p_system_role_code IS NULL OR TRIM(p_system_role_code) != 'super_admin') THEN
    SELECT COUNT(*) INTO v_active_super_count
    FROM user_system_roles usr
    JOIN profiles p ON usr.user_id = p.id
    WHERE usr.role_id = v_super_admin_role_id
      AND p.is_active = TRUE;

    IF v_active_super_count <= 1 THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'LAST_SUPER_ADMIN_PROTECTED',
            'message', 'Operasi ditolak: Tidak dapat mencabut role Super Administrator terakhir yang aktif dalam sistem.'
        );
    END IF;
END IF;
```

### C. Validasi Role Type & Unit Assignment
1. **Validasi `is_system_role`:**
   Memastikan `p_system_role_code` yang diberikan benar-benar memiliki flag `is_system_role = TRUE` pada tabel `roles`, menolak upaya memasukkan role operasional unit (seperti `cashier` atau `cutter`) ke dalam tabel `user_system_roles`:
   ```sql
   IF NOT v_role.is_system_role THEN
       RETURN jsonb_build_object('success', false, 'code', 'INVALID_SYSTEM_ROLE', 'message', 'Role yang dipilih bukan merupakan role level sistem.');
   END IF;
   ```
2. **Validasi Eksistensi Unit:**
   Sebelum menghapus dan memasukkan data baru ke `user_unit_roles`, prosedur memverifikasi seluruh unit ID di `p_unit_ids` terdaftar dan aktif di tabel `units`:
   ```sql
   IF p_unit_ids IS NOT NULL AND array_length(p_unit_ids, 1) > 0 THEN
       IF EXISTS (
           SELECT 1
           FROM unnest(p_unit_ids) AS u_id
           WHERE u_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000000'::UUID
             AND NOT EXISTS (
                 SELECT 1 FROM units WHERE id = u_id AND is_active = TRUE
             )
       ) THEN
           RETURN jsonb_build_object('success', false, 'code', 'INVALID_UNIT_ASSIGNMENT', 'message', 'Satu atau lebih unit yang ditugaskan tidak valid atau tidak aktif.');
       END IF;
   END IF;
   ```

---

## 4. PENINGKATAN SUITE PENGUJIAN (TEST HARNESS IMPROVEMENTS)

Ditambahkan assertion struktural dan pengujian mutasi negatif ke dalam harness pengujian lokal:

### A. Assertion Statis Baru (`scripts/test_phase1_static.cjs`)
1. `SCH-01`: Memastikan zero reference ke tabel non-eksisten `leave_dates` dan keberadaan referensi ke `leave_request_dates`.
2. `SCH-02`: Memastikan zero reference ke kolom non-kanonikal `is_sunday`.
3. `SCH-03`: Ekstraksi kolom dari pernyataan `INSERT INTO leave_request_dates` dan verifikasi seluruh kolom (`unit_id`, `leave_request_id`, `leave_date`) sah dalam skema inti kanonikal.
4. `RBAC-01`: Memverifikasi proteksi `SELF_DEMOTION_DENIED`.
5. `RBAC-02`: Memverifikasi proteksi `LAST_SUPER_ADMIN_PROTECTED`.
6. `RBAC-03`: Memverifikasi validasi flag `is_system_role` dan pengecekan unit aktif.

### B. Simulasi Behavioral Baru (`scripts/test_phase1_simulation.cjs`)
1. `RPC-SIM-18`: Menguji penolakan self-demotion Super Admin dengan return `SELF_DEMOTION_DENIED`.
2. `RPC-SIM-19`: Menguji penolakan demosi Super Admin terakhir dengan return `LAST_SUPER_ADMIN_PROTECTED`.
3. `RPC-SIM-20`: Menguji penolakan penugasan unit ID palsu/tidak aktif dengan return `INVALID_UNIT_ASSIGNMENT`.

### C. Pengujian Mutasi Negatif Baru (`scripts/test_phase1_negative_fpt.cjs`)
1. `FPT-09`: Menginjeksi kembali tabel salah `leave_dates` dan kolom `is_sunday` ke memori. Validator berhasil mendeteksi dan menggagalkannya via `SCH-01`/`SCH-02`.
2. `FPT-10`: Menghapus proteksi self-demotion dari draft SQL. Validator berhasil mendeteksi dan menggagalkannya via `RBAC-01`.
3. `FPT-11`: Menghapus proteksi Last-Super-Admin dari draft SQL. Validator berhasil mendeteksi dan menggagalkannya via `RBAC-02`.

---

## 5. HASIL REGRESI LOKAL & REKAPITULASI PENGUJIAN

Seluruh pengujian otomatis dijalankan secara lokal:

| Test Suite | File Skrip | Assertions | Status |
|---|---|---|---|
| Enhanced SQL Static Validator | `scripts/test_phase1_static.cjs` | 28 / 28 Passed | **PASSED** |
| RLS & Atomic RPC Simulation Engine | `scripts/test_phase1_simulation.cjs` | 26 / 26 Passed | **PASSED** |
| Frontend Contract Verifier | `scripts/test_phase1_contracts.cjs` | 15 / 15 Passed | **PASSED** |
| False-Positive Mutation Harness | `scripts/test_phase1_negative_fpt.cjs` | 11 / 11 Passed | **PASSED** |
| Phase 2 Logic & Permission Suite | `scripts/test_phase2_logic.cjs` | 11 / 11 Passed | **PASSED** |
| Phase 3 Business Workflow & Mock Remediation | `scripts/test_phase3_logic.cjs` | 29 / 29 Passed | **PASSED** |
| **TOTAL SEMUA SUITE** | — | **120 / 120 Passed** | **100% LULUS** |

- `npm run typecheck` (`tsc --noEmit`): **PASSED (0 Errors)**
- `npm run build` (`tsc && vite build`): **PASSED (0 Errors, 8.05s)**

---

## 6. STATUS BUSINESS RULES & RUNTIME LIMITATIONS

### A. Rekonsiliasi 11 Aturan Bisnis (Status: `BUSINESS_RULE_PENDING_APPROVAL`)
Tidak ada aturan bisnis yang disetujui secara sepihak. Seluruh 11 aturan tetap berstatus PENDING:
1. Persentase dasar tip potong kaca (3%)
2. Aturan pembulatan nominal tip (kelipatan Rp1.000)
3. Batas dimensi kaca (5 cm s/d 600 cm)
4. Batas kuantitas lembar kaca per nota (1 s/d 500 lembar)
5. Batas kegagalan PIN kiosk & durasi lockout (5 kali / 30 menit)
6. Toleransi booking armada waktu lampau (15 menit)
7. Batas maksimal durasi peminjaman armada (30 hari kalender)
8. Semantik kolom `tip_percentage_snapshot` (NULLABLE)
9. Kuota cuti mandiri bulanan (maksimal 3 hari)
10. Jendela pengajuan cuti bulanan (tanggal 1 s/d 3)
11. Aturan cuti Admin di hari operasional Minggu

### B. Keterbatasan Runtime (Runtime Limitation Statement)
> [!IMPORTANT]
> Status Validasi Runtime: **`NOT TESTED — REQUIRES POSTGRESQL/SUPABASE RUNTIME`**.  
> Seluruh perbaikan skema telah diverifikasi secara statis dan struktural terhadap skema kanonikal `20261104000001`. Namun, karena lingkungan lokal tidak memiliki instance runtime engine PostgreSQL 17 riil (sesuai hasil audit kelayakan Phase 1C.1), eksekusi DDL/DML langsung belum diuji pada engine PostgreSQL.
> File migrasi `20261106000001_critical_security_remediation.sql` **TETAP UNAPPLIED**.

