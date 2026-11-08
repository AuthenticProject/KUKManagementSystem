# PHASE 1A — BATCH B.3 ISOLATED TEST PLAN & RUNTIME TEST CASES
## KUK Management System v3.1.0

- **Target Migration:** `supabase/migrations/20261105000002_security_rpc_and_remediation.sql`
- **Tujuan Dokumen:** Menyediakan rancangan skenario uji runtime PostgreSQL dan langkah pengujian database terisolasi (*isolated test suite*) yang siap dieksekusi begitu lingkungan staging atau container lokal aktif.
- **Status Saat Ini:** **NOT TESTED / UNPERFORMED (DITANGGUHKAN DEMI KEAMANAN PRODUCTION)**

---

### 1. Kueri Inspeksi Katalog PostgreSQL (Pre-Execution Staging Only)

Jalankan kueri read-only berikut pada database staging untuk memverifikasi lokasi ekstensi dan hak skema sebelum menerapkan migrasi:

```sql
-- 1.1. Periksa lokasi skema pgcrypto dan btree_gist
SELECT 
    e.extname AS extension_name,
    n.nspname AS installed_schema,
    e.extversion AS version
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname IN ('pgcrypto', 'btree_gist');

-- 1.2. Periksa privilege CREATE pada schema public dan extensions
SELECT 
    nspname AS schema_name,
    has_schema_privilege('anon', nspname, 'CREATE') AS anon_has_create,
    has_schema_privilege('authenticated', nspname, 'CREATE') AS auth_has_create,
    has_schema_privilege('PUBLIC', nspname, 'CREATE') AS public_has_create
FROM pg_namespace
WHERE nspname IN ('public', 'extensions');
```

---

### 2. Skenario Uji Runtime: Autentikasi PIN & Reset PIN Kiosk

| ID Test | Kategori | Kondisi Input | Perilaku yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **PIN-01** | Happy Path | PIN benar (6 digit numerik), status karyawan ACTIVE, lockout NULL. | Mengembalikan `{ success: true, reference_code: '...', status: 'PENDING' }`, `failed_attempts` direset ke 0, dan row tersimpan. | NOT TESTED |
| **PIN-02** | Wrong PIN | PIN salah (misal: '123456' padahal hash '654321'). | Mengembalikan `{ success: false, code: 'AUTH_FAILED' }`, `failed_attempts` bertambah +1 di database secara persisten (tidak rollback), dan log `KIOSK_PIN_FAILED` tercatat. | NOT TESTED |
| **PIN-03** | PIN NULL | `p_auth_pin` diberikan nilai `NULL`. | Ditolak seketika di langkah validasi, dummy Bcrypt dieksekusi, mengembalikan `{ success: false, code: 'AUTH_FAILED' }`. Tidak ada crash atau exception unhandled. | NOT TESTED |
| **PIN-04** | Invalid Length | PIN berupa 4 digit numerik atau teks alfabet ('abcd'). | Ditolak seketika oleh regex `^[0-9]{6}$`, dummy Bcrypt dieksekusi, mengembalikan `{ success: false, code: 'AUTH_FAILED' }`. | NOT TESTED |
| **PIN-05** | Inactive Emp | Karyawan berstatus `'SUSPENDED'`, `'TERMINATED'`, atau `NULL`. | Ditolak oleh `v_emp.status IS DISTINCT FROM 'ACTIVE'`, dummy Bcrypt dieksekusi, mengembalikan `{ success: false, code: 'AUTH_FAILED' }`. | NOT TESTED |
| **PIN-06** | Missing Emp | Kode karyawan tidak terdaftar pada unit. | Dummy Bcrypt dieksekusi untuk timing defense, mengembalikan `{ success: false, code: 'AUTH_FAILED' }`. | NOT TESTED |
| **PIN-07** | Missing Auth Row | Karyawan aktif ada di `employees`, tetapi baris di `employee_portal_auth` belum dibuat. | Dummy Bcrypt dieksekusi, mengembalikan `{ success: false, code: 'AUTH_FAILED' }`. | NOT TESTED |
| **PIN-08** | Lockout Triggered | Gagal PIN ke-5 berturut-turut. | Mengembalikan `{ success: false, code: 'ACCOUNT_LOCKED' }`, `locked_until` diisi `now() + 30 minutes`. Permintaan berikutnya sebelum 30 menit langsung ditolak `ACCOUNT_LOCKED`. | NOT TESTED |
| **PIN-09** | Reset Correct | Admin unit mereset PIN dengan unit yang sesuai. | Mengembalikan `{ success: true }`, `pin_hash` diperbarui, `failed_attempts` direset ke 0, `locked_until = NULL`, audit log `RESET_KIOSK_PIN` tercatat. | NOT TESTED |
| **PIN-10** | Reset Cross Unit | Admin Unit A mencoba mereset PIN karyawan Unit B. | Ditolak oleh `has_unit_permission(p_unit_id, ...)` atau query karyawan tidak ditemukan pada Unit A. | NOT TESTED |
| **PIN-11** | Reset Conflict | Karyawan ada di Unit A, tetapi row `employee_portal_auth` memiliki unit_id berbeda (anomali). Clause `ON CONFLICT DO UPDATE WHERE unit_id` menghasilkan 0 row. | Ditangkap oleh `GET DIAGNOSTICS v_rows_affected = ROW_COUNT;`. Mengembalikan `{ success: false, code: 'NO_ROWS_MODIFIED' }`. Audit log sukses TIDAK ditulis. | NOT TESTED |

---

### 3. Skenario Uji Runtime: Integritas Audit Logs & Anti-Spoofing

| ID Test | Kategori | Kondisi Uji | Perilaku yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **AUD-01** | Valid Insert | Pengguna authenticated meng-insert log dengan `actor_id = auth.uid()`. | Query INSERT berhasil disimpan ke tabel `audit_logs`. | NOT TESTED |
| **AUD-02** | Spoofed Actor | Pengguna authenticated mencoba meng-insert log dengan `actor_id` milik pengguna lain. | Ditolak oleh RLS policy `"audit_logs_insert"` dengan galat pelanggaran RLS `42501 / new row violates row-level security policy`. | NOT TESTED |
| **AUD-03** | Anon Direct Insert | Sesi `anon` mencoba melakukan `INSERT INTO audit_logs ...`. | Ditolak langsung pada level privilege tabel: `permission denied for table audit_logs`. | NOT TESTED |
| **AUD-04** | Direct Update/Delete | Sesi `authenticated` atau `anon` mencoba UPDATE atau DELETE baris di `audit_logs`. | Ditolak oleh policy `audit_logs_deny_update` dan `audit_logs_deny_delete` (`USING (false)`). | NOT TESTED |
| **AUD-05** | Kiosk Null Actor | Prosedur `submit_glass_tip_atomic` (SECURITY DEFINER) menulis log audit publik. | Log berhasil disimpan dengan `actor_id = NULL` dan metadata pengajuan tersimpan di `new_data`. | NOT TESTED |

---

### 4. Skenario Uji Runtime: Endpoint Transaksi Publik & Rate Limiting

| ID Test | Kategori | Kondisi Uji | Perilaku yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **PUB-01** | Direct Anon RPC | Pemanggil role `anon` memanggil `submit_glass_tip_atomic` atau `book_vehicle_atomic`. | RPC dapat dieksekusi sah karena di-GRANT ke `anon`, namun seluruh parameter divalidasi dan row disimpan berstatus terkunci `PENDING`. | NOT TESTED |
| **PUB-02** | Direct Anon Table | Pemanggil role `anon` mencoba `INSERT INTO glass_tips` atau `INSERT INTO vehicle_borrowing_requests`. | Ditolak pada level tabel: `permission denied for table glass_tips` (karena direct INSERT telah di-REVOKE dari anon, authenticated, PUBLIC). | NOT TESTED |
| **PUB-03** | IP Rate Limit (Tip) | Satu IP mengirimkan lebih dari 30 request pengajuan tip dalam 5 menit. | Request ke-31 ditolak oleh `check_and_increment_rate_limit` dengan `{ success: false, code: 'RATE_LIMIT_EXCEEDED' }` tanpa memproses kalkulasi tip. | NOT TESTED |
| **PUB-04** | Employee DoS Defense | Satu kode karyawan diserang dengan lebih dari 10 request dalam 10 menit. | Request ke-11 ditolak dengan `{ success: false, code: 'RATE_LIMIT_EXCEEDED' }`. Bcrypt dummy tetap dieksekusi agar timing seragam dan lockout akun terhindar dari DoS. | NOT TESTED |
| **PUB-05** | IP Rate Limit (Fleet) | Satu IP mengirimkan lebih dari 10 permohonan kendaraan dalam 10 menit. | Request ke-11 ditolak dengan `{ success: false, code: 'RATE_LIMIT_EXCEEDED' }`. Counter rate limit tetap tersimpan secara persisten (tidak rollback). | NOT TESTED |
| **PUB-06** | Vehicle Flood Defense | Satu kendaraan yang sama diajukan lebih dari 5 kali dalam 10 menit. | Request ke-6 ditolak dengan `{ success: false, code: 'RATE_LIMIT_EXCEEDED' }`. Counter rate limit tetap tersimpan secara persisten. | NOT TESTED |
| **PUB-07** | Invalid Unit/Vehicle | Booking diajukan dengan `vehicle_id` yang bukan milik `unit_id` atau berstatus non-aktif. | Ditolak dengan pesan: *"Armada kendaraan tidak ditemukan pada unit ini."* | NOT TESTED |
| **PUB-08** | Schedule Conflict (23P01)| Dua peminjaman diajukan pada jadwal yang bertabrakan. Permohonan A telah di-APPROVE, lalu petugas mencoba men-APPROVE Permohonan B. | Ditangkap secara spesifik oleh blok exception `WHEN exclusion_violation THEN ... ERRCODE = '23P01'` dengan pesan ramah pengguna: *"Konflik Jadwal..."*. | NOT TESTED |

---

### 5. Script Pengujian SQL Otomatis untuk Lingkungan Staging (Draft)

Simpan skrip di bawah ini sebagai `scripts/run_staging_security_tests.sql` untuk dijalankan saat staging Supabase siap:

```sql
-- SKRIP PENGUJIAN OTOMATIS (HANYA UNTUK DEDICATED STAGING DATABASE)
BEGIN;

-- 1. Uji Proteksi Direct INSERT pada glass_tips
DO $$
BEGIN
    SET ROLE anon;
    BEGIN
        INSERT INTO glass_tips (unit_id, reference_code, employee_id, glass_type_id, length_cm, height_cm, quantity, calculated_sqm, glass_price_snapshot, tip_percentage_snapshot, rounding_rule, tip_amount, status)
        VALUES ('00000000-0000-0000-0000-000000000001', 'HACK-01', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 100, 100, 1, 1, 10000, 0.03, 'EXACT', 1000, 'VERIFIED');
        RAISE EXCEPTION 'TEST FAILED: Anon berhasil melakukan direct INSERT ke glass_tips!';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: Direct INSERT anon ke glass_tips ditolak (insufficient_privilege).';
    END;
END $$;

-- 2. Uji Direct UPDATE pada glass_tips
DO $$
BEGIN
    SET ROLE authenticated;
    BEGIN
        UPDATE glass_tips SET status = 'VERIFIED' WHERE id = '00000000-0000-0000-0000-000000000001';
        RAISE EXCEPTION 'TEST FAILED: Authenticated berhasil melakukan direct UPDATE ke glass_tips!';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: Direct UPDATE authenticated ke glass_tips ditolak (insufficient_privilege).';
    END;
END $$;

-- 3. Uji Anti-Spoofing audit_logs
DO $$
BEGIN
    SET ROLE authenticated;
    BEGIN
        INSERT INTO audit_logs (unit_id, actor_id, action, table_name, record_id)
        VALUES ('00000000-0000-0000-0000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'SPOOF', 'test', '1');
        RAISE EXCEPTION 'TEST FAILED: Authenticated berhasil memalsukan actor_id audit_logs!';
    EXCEPTION
        WHEN row_security_active_violation OR insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: Spoofed actor_id pada audit_logs ditolak RLS.';
    END;
END $$;

ROLLBACK;
```

---

> [!NOTE]
> Seluruh skenario di atas telah dipersiapkan dan didokumentasikan. Eksekusi skrip SQL di atas ditangguhkan hingga dedicated staging database yang sepenuhnya terisolasi dari Production telah tersedia.

