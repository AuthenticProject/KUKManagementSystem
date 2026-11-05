# PHASE 1 — RPC & STORED PROCEDURES SECURITY REVIEW
## KUK MANAGEMENT SYSTEM v3.1.0

**Tanggal Dokumen:** 2026-11-04  
**Auditor:** Antigravity Autonomous Agent  
**Target Environment:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`)  
**PostgreSQL Engine:** v17.11.0.011  
**Tujuan Dokumen:** Mengaudit keamanan 10 fungsi PostgreSQL dan Stored Procedures/RPC yang terpasang pada skema database v3.1.0, menganalisis risiko paparan publik (`anon`), validasi parameter, serta menyusun rekomendasi penguatan (hardening) tanpa mengubah konfigurasi remote secara prematur.

---

## 1. INVENTARISASI 10 FUNGSI POSTGRESQL

| No | Nama Fungsi | Tipe Fungsi | Security Mode | Search Path Terpasang | Volatility | Hak Akses Saat Ini |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | `generate_document_number_atomic` | Stored Procedure | **SECURITY DEFINER** | `public, pg_temp` | VOLATILE | `PUBLIC:EXECUTE` |
| 2 | `submit_leave_request_atomic` | Stored Procedure | **SECURITY DEFINER** | `public, pg_temp` | VOLATILE | `PUBLIC:EXECUTE` |
| 3 | `cancel_leave_request_atomic` | Stored Procedure | **SECURITY DEFINER** | `public, pg_temp` | VOLATILE | `PUBLIC:EXECUTE` |
| 4 | `book_vehicle_atomic` | Stored Procedure | **SECURITY DEFINER** | `public, pg_temp` | VOLATILE | `PUBLIC:EXECUTE` |
| 5 | `calculate_and_finalize_payroll_atomic` | Stored Procedure | **SECURITY DEFINER** | `public, pg_temp` | VOLATILE | `PUBLIC:EXECUTE` |
| 6 | `has_system_role` | Helper RLS | **SECURITY DEFINER** | `public, pg_temp` | STABLE | `PUBLIC:EXECUTE` |
| 7 | `has_unit_access` | Helper RLS | **SECURITY DEFINER** | `public, pg_temp` | STABLE | `PUBLIC:EXECUTE` |
| 8 | `has_unit_permission` | Helper RLS | **SECURITY DEFINER** | `public, pg_temp` | STABLE | `PUBLIC:EXECUTE` |
| 9 | `protect_audit_log_immutability` | Trigger Function | **SECURITY DEFINER** | `public, pg_temp` | VOLATILE | `PUBLIC:EXECUTE` |
| 10 | `protect_finalized_payroll` | Trigger Function | **SECURITY DEFINER** | `public, pg_temp` | VOLATILE | `PUBLIC:EXECUTE` |

---

## 2. AUDIT MENDALAM SETIAP FUNGSI (DEEP SECURITY AUDIT)

### 1. `generate_document_number_atomic(p_unit_id UUID, p_doc_type VARCHAR, p_period_key VARCHAR)`
- **Tujuan Operasional:** Menghasilkan nomor seri dokumen atomik (contoh: SP, cuti, peminjaman kendaraan) yang bebas dari *race conditions* menggunakan kunci baris `FOR UPDATE` pada tabel `document_sequences`.
- **Validasi Identitas & Hak:** Memvalidasi keberadaan unit via `SELECT code INTO v_unit_code FROM units WHERE id = p_unit_id`. Melempar exception `'Unit ID tidak valid'` jika tidak ditemukan.
- **Potensi Akses Anon:** Fungsi ini dapat dieksekusi oleh `anon` via REST API PostgREST.
- **Tingkat Risiko:** **SEDANG (MEDIUM).** Pihak publik anonim dapat memicu penambahan nomor urut dokumen formal meskipun tidak mengubah data bisnis lain.
- **Evaluasi Arsitektur:** Fungsi ini idealnya bersifat internal (*private procedure*). Karena pemanggilnya (`submit_leave_request_atomic` dan `book_vehicle_atomic`) sudah berstatus `SECURITY DEFINER`, pemanggil tersebut tidak memerlukan izin `anon` pada fungsi nomor urut.

### 2. `submit_leave_request_atomic(...)`
- **Tujuan Operasional:** Menangani pengajuan cuti mandiri oleh pegawai melalui Employee Portal / Kiosk.
- **Validasi Identitas:** Mengautentikasi pegawai menggunakan pencocokan hash PIN (`crypt(p_auth_pin, v_auth.pin_hash) = v_auth.pin_hash`). Melakukan pengecekan *lockout* percobaan gagal (`failed_attempts >= 5`) dan lockout durasi 15 menit.
- **Validasi Unit & Cuti:** Memvalidasi bahwa pegawai berstatus `ACTIVE` pada `p_unit_id`, tidak ada pengajuan tanggal ganda (`leave_conflict_slots`), tidak melebihi kuota cuti simultan per departemen, serta mematuhi aturan penutupan tanggal bulanan (`submission_close_day`).
- **Potensi Akses Anon:** **DIPERLUKAN (LEGITIMATE).** Pegawai operasional pabrik kaca dan toko bangunan tidak memiliki login Supabase Auth pribadi dan menggunakan PIN portal.
- **Tingkat Risiko:** **TERKENDALI (LOW-MEDIUM).** Telah dilengkapi mitigasi brute-force PIN dan audit logging IP/User-Agent.

### 3. `cancel_leave_request_atomic(p_unit_id UUID, p_leave_id UUID, p_cancelled_by UUID, p_reason TEXT)`
- **Tujuan Operasional:** Membatalkan pengajuan cuti yang berstatus `PENDING` atau `APPROVED` dan melepaskan slot konflik tanggal (`leave_conflict_slots`).
- **Validasi Identitas:** Menerima `p_cancelled_by UUID`. Namun, fungsi **belum memverifikasi** apakah `p_cancelled_by` sama dengan `auth.uid()` atau memiliki izin pembatalan cuti unit.
- **Potensi Akses Anon:** Dapat dipanggil oleh `anon`.
- **Tingkat Risiko:** **TINGGI (HIGH).** Jika seseorang mengetahui `p_leave_id`, mereka dapat membatalkan cuti orang lain secara anonim.
- **Rekomendasi:** Memerlukan verifikasi login (`auth.uid() = p_cancelled_by OR has_unit_permission(p_unit_id, 'leave.manage')`) atau verifikasi PIN.

### 4. `book_vehicle_atomic(...)`
- **Tujuan Operasional:** Memproses peminjaman armada mobil/truk operasional toko dan pemotongan kaca dengan mengunci slot armada via `FOR UPDATE` untuk mencegah benturan jadwal (*double-booking*).
- **Validasi Unit & Armada:** Memvalidasi ketersediaan armada di unit (`status = 'AVAILABLE'` dan `is_active = true`). Memeriksa benturan jadwal pinjam.
- **Potensi Akses Anon:** **DIPERLUKAN (LEGITIMATE).** Peminjaman armada dapat diisi dari formulir permohonan publik oleh unit terafiliasi.
- **Tingkat Risiko:** **TERKENDALI (LOW).**

### 5. `calculate_and_finalize_payroll_atomic(p_unit_id UUID, p_payroll_period_id UUID, p_finalized_by UUID)`
- **Tujuan Operasional:** Mengkalkulasi seluruh komponen gaji, tunjangan, potongan, tip kaca, denda pelanggaran, dan menerbitkan slip gaji final yang terkunci.
- **Validasi Identitas:** Menerima `p_finalized_by UUID`. Namun saat ini fungsi **belum memverifikasi** apakah pemanggil memiliki izin `payroll.manage` di dalam body PL/pgSQL.
- **Potensi Akses Anon:** Dapat dipanggil oleh `anon` via REST API akibat default privilege `PUBLIC:EXECUTE`.
- **Tingkat Risiko:** **KRITIS (CRITICAL).** Modul payroll adalah data paling sensitif di organisasi. Publik atau pihak tak berwenang tidak boleh memiliki jalur eksekusi apa pun ke fungsi ini.
- **Rekomendasi Wajib:** Segera lakukan `REVOKE EXECUTE FROM PUBLIC, anon` dan batasi hanya untuk `authenticated`.

### 6, 7, 8. `has_system_role`, `has_unit_access`, `has_unit_permission`
- **Tujuan Operasional:** Fungsi helper RLS inti untuk mengevaluasi hak akses RBAC pengguna.
- **Validasi:** Menggunakan `auth.uid()`. Jika dipanggil oleh `anon`, `auth.uid()` bernilai `NULL`, sehingga query evaluasi langsung mengembalikan `FALSE`.
- **Tingkat Risiko:** **AMAN (LOW).** Tidak ada celah kebocoran data.

### 9, 10. `protect_audit_log_immutability`, `protect_finalized_payroll`
- **Tujuan Operasional:** Trigger level-baris untuk menjamin catatan audit tidak dapat diubah/dihapus, dan slip gaji yang telah `FINALIZED` tidak dapat diotak-atik.
- **Tingkat Risiko:** **AMAN (LOW).** Tidak dapat dipanggil sebagai RPC REST publik.

---

## 3. RANGKUMAN TINGKAT RISIKO & DAFTAR REKOMENDASI HARDENING

| Nama Fungsi | Tingkat Risiko | Status Akses Anon Saat Ini | Rekomendasi Hardening |
| :--- | :---: | :---: | :--- |
| `calculate_and_finalize_payroll_atomic` | **KRITIS** | Terbuka (`PUBLIC`) | `REVOKE EXECUTE FROM PUBLIC, anon;` Hanya beri izin ke `authenticated`. Tambahkan validasi internal `has_unit_permission(p_unit_id, 'payroll.manage')`. |
| `cancel_leave_request_atomic` | **TINGGI** | Terbuka (`PUBLIC`) | Batasi eksekusi hanya untuk `authenticated` atau sertakan verifikasi PIN mandiri. |
| `generate_document_number_atomic` | **SEDANG** | Terbuka (`PUBLIC`) | `REVOKE EXECUTE FROM PUBLIC, anon;` Hanya diakses secara internal oleh fungsi lain atau staf login. |
| `submit_leave_request_atomic` | **RENDAH-SEDANG** | Terbuka (`PUBLIC`) | Pertahankan izin `anon` (kebutuhan Kiosk). Pastikan rate-limit IP aktif. |
| `book_vehicle_atomic` | **RENDAH-SEDANG** | Terbuka (`PUBLIC`) | Pertahankan izin `anon` (kebutuhan Form Publik). Tambahkan validasi token permohonan. |
| Helper RLS (3 fungsi) | **AMAN** | Terbuka (`PUBLIC`) | Tetap aman karena mengevaluasi `auth.uid()`. |
| Trigger Functions (2 fungsi) | **AMAN** | Trigger Only | Aman. |

---

## 4. DRAFT SQL HARDENING (UNTUK DIEKSEKUSI PADA MIGRASI BERIKUTNYA)

> **PERINGATAN BATASAN:**  
> Sesuai instruksi audit Phase 1, script SQL di bawah ini **TIDAK DIJALANKAN SEKARANG**. Script ini disiapkan sebagai draft migrasi resmi (`20261104000002_rpc_security_hardening.sql`) yang akan diajukan kepada user untuk dieksekusi melalui Supabase CLI setelah persetujuan:

```sql
-- DRAFT: supabase/migrations/20261104000002_rpc_security_hardening.sql

-- 1. Cabut hak eksekusi publik anonim pada fungsi sensitif
REVOKE EXECUTE ON FUNCTION calculate_and_finalize_payroll_atomic(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION calculate_and_finalize_payroll_atomic(UUID, UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION cancel_leave_request_atomic(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_leave_request_atomic(UUID, UUID, UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION generate_document_number_atomic(UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_document_number_atomic(UUID, VARCHAR, VARCHAR) TO authenticated;

-- 2. Pastikan fungsi kiosk mandiri tetap dapat diakses anonim
GRANT EXECUTE ON FUNCTION submit_leave_request_atomic TO anon, authenticated;
GRANT EXECUTE ON FUNCTION book_vehicle_atomic TO anon, authenticated;
```

