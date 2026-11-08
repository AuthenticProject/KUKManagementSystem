# PHASE 1A — BATCH B SECURITY FINDINGS & TECHNICAL REMEDIATION
## KUK Management System v3.1.0

Dokumen ini mendokumentasikan akar masalah (*root cause*), implementasi teknis perbaikan, dan analisis risiko residual (*residual risk*) untuk seluruh temuan audit keamanan pada Batch B migrasi `20261105000002_security_rpc_and_remediation.sql`.

---

### 1. TEMUAN KRITIS (CRITICAL FINDINGS)

#### [CRIT-01] Hilangnya Persistensi Lockout Akun Akibat Rollback Transaksi pada Kegagalan PIN
- **Akar Masalah (Root Cause):** Pada implementasi awal `submit_glass_tip_atomic`, ketika verifikasi PIN gagal, sistem mengeksekusi `UPDATE employee_portal_auth SET failed_attempts = failed_attempts + 1` lalu langsung memanggil `RAISE EXCEPTION 'PIN otentikasi salah.'`. Dalam PostgreSQL, setiap `RAISE EXCEPTION` yang tidak ditangani di dalam sub-blok blok transaksi membatalkan seluruh perubahan DML dalam transaksi tersebut. Akibatnya, kenaikan `failed_attempts` ikut ter-rollback ke kondisi semula, merusak mekanisme *lockout* akun dan membuka celah serangan *brute-force* tanpa batas.
- **Implementasi Perbaikan:** 
  - Mengubah alur kegagalan PIN agar tidak melempar `RAISE EXCEPTION`.
  - Sistem menaikkan counter `failed_attempts` dalam variabel lokal, menghitung batas `locked_until` (30 menit jika $\ge 5$), menyimpan perubahan via `UPDATE employee_portal_auth`, mencatat audit log `KIOSK_PIN_FAILED`, lalu mengembalikan response JSONB:
    ```json
    { "success": false, "code": "AUTH_FAILED", "message": "Otentikasi Kiosk Gagal: Kredensial atau PIN salah." }
    ```
    atau (jika terakumulasi 5x kegagalan berturut-turut):
    ```json
    { "success": false, "code": "ACCOUNT_LOCKED", "message": "Akun portal karyawan terkunci sementara selama 30 menit..." }
    ```
  - Karena tidak ada exception DDL/DML, pembaruan baris otentikasi di-commit secara persisten ke database.

#### [CRIT-02] Kelemahan Null-Safety pada Pengecekan Hash PIN & Format PIN Tidak Tervalidasi
- **Akar Masalah (Root Cause):** 
  - Parameter `p_auth_pin` dapat menerima nilai `NULL` atau string acak dengan panjang sembarang.
  - Operator kesetaraan standar `v_auth.pin_hash != crypt(p_auth_pin, v_auth.pin_hash)` akan menghasilkan nilai `NULL` (falsy dalam konteks boolean SQL) jika salah satu operand bernilai `NULL`.
- **Implementasi Perbaikan:**
  - Menambahkan validasi ketat format PIN di awal fungsi:
    ```sql
    IF p_auth_pin IS NULL OR length(p_auth_pin) != 6 OR p_auth_pin !~ '^[0-9]{6}$' THEN
        PERFORM crypt(COALESCE(p_auth_pin, '000000'), '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
        RETURN jsonb_build_object('success', false, 'code', 'AUTH_FAILED', 'message', 'Otentikasi Kiosk Gagal: Kredensial atau PIN salah.');
    END IF;
    ```
  - Menggunakan perbandingan null-safe `IS DISTINCT FROM` untuk hash Bcrypt:
    ```sql
    v_calculated_hash := crypt(p_auth_pin, COALESCE(v_auth.pin_hash, ''));
    IF v_auth.pin_hash IS NULL OR v_calculated_hash IS NULL OR (v_auth.pin_hash IS DISTINCT FROM v_calculated_hash) THEN
    ```
  - Menambahkan eksekusi kalkulasi Bcrypt dummy jika format tidak valid atau karyawan tidak ditemukan guna menyamarkan respons timing.

#### [CRIT-03] Hak Akses Langsung (Direct INSERT) Anonim pada Tabel Transaksi Publik
- **Akar Masalah (Root Cause):** Pada skema awal, terdapat policy RLS permisif yang mengizinkan role `anon` melakukan `INSERT` langsung ke tabel fisik `glass_tips` dan `vehicle_borrowing_requests`. Hal ini membuka celah penyerang melakukan POST via PostgREST langsung ke tabel, membypass validasi bisnis, manipulasi nominal tip, atau menyisipkan status non-pending.
- **Implementasi Perbaikan:**
  - Menghapus policy anon: `DROP POLICY IF EXISTS "glass_tips_insert_anon" ON public.glass_tips;` dan `DROP POLICY IF EXISTS "vehicle_borrowing_requests_insert_anon" ON public.vehicle_borrowing_requests;`.
  - Mencabut izin `INSERT` secara definitif pada tabel fisik:
    ```sql
    REVOKE INSERT ON TABLE public.glass_tips FROM anon, PUBLIC;
    REVOKE INSERT ON TABLE public.vehicle_borrowing_requests FROM anon, PUBLIC;
    ```
  - Transaksi publik kini **100% eksklusif** dialihkan melalui stored procedures berstatus `SECURITY DEFINER` (`submit_glass_tip_atomic` dan `book_vehicle_atomic`), di mana seluruh validasi, generate kode dokumen, status locked `PENDING`, dan audit log ditegakkan secara atomik.

---

### 2. TEMUAN BERISIKO TINGGI (HIGH FINDINGS)

#### [HIGH-01] Kerentanan Shadowing Objek pada `search_path` Fungsi SECURITY DEFINER
- **Akar Masalah (Root Cause):** Konfigurasi `SET search_path = public, extensions;` tanpa penempatan `pg_temp` secara eksplisit atau meletakkan `pg_temp` di awal dapat dieksploitasi penyerang untuk membuat tabel/fungsi sementara di schema `pg_temp` yang mengaburkan (*shadowing*) objek resmi database.
- **Implementasi Perbaikan:**
  - Seluruh lima (5) RPC function diwajibkan menyertakan konfigurasi:
    ```sql
    SET search_path = public, extensions, pg_temp;
    ```
  - Dengan meletakkan `pg_temp` di urutan paling belakang, PostgreSQL memprioritaskan pencarian objek pada `public` dan `extensions`, sehingga mencegah manipulasi injeksi sementara.

#### [HIGH-02] Validasi Permohonan Armada Tidak Lengkap & Masalah Penanganan Konkurensi
- **Akar Masalah (Root Cause):** Pada fungsi peminjaman armada, input string tidak divalidasi dari string kosong/whitespace, waktu peminjaman di masa lampau diizinkan, durasi peminjaman tidak dibatasi, dan trapping error tumpang tindih waktu berpotensi menutupi galat database fatal lainnya.
- **Implementasi Perbaikan:**
  - Menambahkan sanitasi `TRIM()` dan validasi non-empty pada seluruh field teks (`borrower_name`, `phone`, `responsible_person`, `destination`, `purpose`).
  - Menolak waktu mulai masa lampau (`p_start_time < (now() - INTERVAL '15 minutes')`).
  - Membatasi durasi sewa maksimal 30 hari (`p_estimated_return_time > (p_start_time + INTERVAL '30 days')`).
  - Menambahkan batas maksimal karakter (150 chars untuk identitas, 500 chars tujuan, 1000 chars keperluan).
  - Pada prosedur persetujuan (`approve_vehicle_atomic`), penanganan konkurensi benturan jadwal secara spesifik menangkap `WHEN exclusion_violation THEN` dengan pengecekan `ERRCODE = '23P01'`, mencegah masking kesalahan sistemik lainnya.

#### [HIGH-03] Celah Pemalsuan Identitas (Actor Spoofing) pada `audit_logs`
- **Akar Masalah (Root Cause):** Policy `INSERT` pada tabel `audit_logs` tidak mencocokkan `actor_id` dengan identitas pengguna yang terotentikasi di sesi JWT Supabase, sehingga pengguna nakal dapat menulis log atas nama administrator lain.
- **Implementasi Perbaikan:**
  - Mencabut izin direct `INSERT` dari `anon` dan `PUBLIC`.
  - Menerapkan policy ketat anti-spoofing untuk role `authenticated`:
    ```sql
    CREATE POLICY "audit_logs_insert" ON public.audit_logs
        FOR INSERT TO authenticated
        WITH CHECK (
            actor_id = auth.uid()
        );
    ```
  - Log audit dari transaksi anonim publik (seperti kiosk dan booking armada) dicatat secara aman melalui prosedur `SECURITY DEFINER` dengan `actor_id = NULL` dan metadata lengkap pengajuan.

---

### 3. TEMUAN BERISIKO MENENGAH (MEDIUM FINDINGS)

#### [MEDIUM-01] Validasi Aksi Tidak Ketat pada Verifikasi Tip Kaca
- **Akar Masalah & Perbaikan:** Menolak nilai `p_action` yang `NULL` atau tidak berada dalam himpunan `('VERIFY', 'REJECT')`.

#### [MEDIUM-02] Anomali Nilai Nominal saat Aksi Penolakan (REJECT) Tip Kaca
- **Akar Masalah & Perbaikan:** Menolak request jika `p_action = 'REJECT'` namun menyertakan `p_verified_amount IS NOT NULL`.

#### [MEDIUM-03] Penguncian Akses Eksplisit pada Tabel Dormant `public_form_tokens`
- **Akar Masalah & Perbaikan:** Menjalankan `REVOKE ALL ON TABLE public.public_form_tokens FROM anon, PUBLIC;` untuk mencegah akses tidak sah.

#### [MEDIUM-04] Jejak Audit Kurang Lengkap pada Pengajuan Booking Kendaraan
- **Akar Masalah & Perbaikan:** Menambahkan logging audit `BOOK_VEHICLE` otomatis ke dalam tabel `audit_logs` saat permohonan berhasil dibuat via `book_vehicle_atomic`.

#### [MEDIUM-05] Batas Maksimal Panjang Teks Masukan Bebas
- **Akar Masalah & Perbaikan:** Menerapkan pembatasan panjang teks maksimal 500 karakter pada `p_notes` (`submit_glass_tip_atomic`, `verify_glass_tip_atomic`) dan `p_rejection_reason` (`approve_vehicle_atomic`).

#### [MEDIUM-06] Konsistensi Penolakan Aksi `approve_vehicle_atomic`
- **Akar Masalah & Perbaikan:** Menolak nilai `p_action` selain `'APPROVE'` atau `'REJECT'`, dan mewajibkan alasan penolakan (`p_rejection_reason`) tidak boleh kosong saat aksi adalah `'REJECT'`.

#### [MEDIUM-07] Pencabutan Izin Eksekusi Fungsi Administratif dari Role Publik
- **Akar Masalah & Perbaikan:** Menjalankan `REVOKE EXECUTE FROM PUBLIC, anon;` pada ketiga RPC administratif: `reset_employee_kiosk_pin`, `verify_glass_tip_atomic`, dan `approve_vehicle_atomic`.

#### [MEDIUM-08] Isolasi Unit Multi-Tenant pada Reset PIN Karyawan
- **Akar Masalah & Perbaikan:** Pada `reset_employee_kiosk_pin`, clause `ON CONFLICT (employee_id) DO UPDATE` diperketat dengan penambahan syarat `WHERE employee_portal_auth.unit_id = p_unit_id;` untuk menjamin integritas multi-tenant unit.

---

### 4. ANALISIS RISIKO RESIDUAL (RESIDUAL RISK)

Meskipun secara statis seluruh rancangan dan script migrasi telah memenuhi standar keamanan tingkat tinggi, terdapat risiko residual operasional yang harus diperhatikan:

1. **Verifikasi Runtime Database:** Validasi yang dilakukan saat ini bertumpu pada *static analysis*, *regex linting*, dan *typescript typechecking*. Eksekusi dinamis constraint exclusion PostgreSQL (`23P01`) dan evaluasi runtime RLS policies harus diverifikasi pada environment database Postgres aktif sebelum promosi Production.
2. **Ketergantungan Ekstensi `pgcrypto`:** Fungsi mengasumsikan ketersediaan `crypt` dan `gen_salt` pada schema `public` atau `extensions`. Pada remote Supabase standard, ekstensi ini berada di schema `extensions`. Penempatan `SET search_path = public, extensions, pg_temp;` telah memitigasi hal ini, namun status keberadaan ekstensi harus dikonfirmasi saat migrasi diterapkan di staging.
3. **Penyelarasan Kode Frontend (Batch C):** Penutupan direct `INSERT` pada tabel `glass_tips` dan `vehicle_borrowing_requests` mengharuskan frontend memanggil `supabase.rpc('submit_glass_tip_atomic', ...)` dan `supabase.rpc('book_vehicle_atomic', ...)`. Frontend belum dimigrasikan dan akan diselaraskan pada Batch C setelah persetujuan manual dokumen ini.

