# SECURITY & INTEGRITY TEST PLAN — KUK MANAGEMENT SYSTEM v3.1.0
## Rencana Pengujian Teknis Integritas Database, Isolasi Multi-Unit & Keamanan RLS
**Versi:** 3.1.0  
**Tanggal:** 2026-11-04  
**Target Pengujian:** Lingkungan Testing Lokal / Staging Terisolasi (Bukan Database Produksi)  
**Framework Pengujian:** pgTAP / SQL Integration Scripts / Vitest API Test Suite  

---

## 1. Lingkup, Batasan & Status Eksekusi

1. **Status Verifikasi vs Status Eksekusi**:
   Dokumen ini adalah **Rencana Pengujian Resmi (Test Plan Specification)**. Dokumen ini mendefinisikan skenario dan ekspektasi yang telah diaudit secara arsitektural. Sesuai batasan kerja fase 0.5, tidak ada migrasi atau pengujian destruktif yang dieksekusi ke database produksi Supabase.
2. **Definisi Status Eksekusi Uji**:
   - **`NOT RUN`**: Skenario telah dirancang dan diverifikasi secara logika, namun belum dieksekusi di database runner lokal/staging.
   - **`PASSED`**: Skenario telah dijalankan di database lokal/staging dan hasilnya 100% sesuai ekspektasi.
   - **`FAILED`**: Skenario gagal memenuhi ekspektasi pengujian.
   - **`BLOCKED`**: Skenario terhambat dependensi lingkungan atau bug kritis.
3. **Lingkungan Pengujian**: Seluruh pengujian wajib dijalankan pada instance database lokal (Supabase Local CLI via Docker) atau database staging khusus pengujian. **DILARANG KERAS menjalankan skrip uji pada database produksi**.

### Matriks Status Eksekusi Skenario Uji (Phase 0.5 Baseline)

| ID Uji | Nama Skenario Pengujian | Komponen Sasaran | Status Eksekusi | Lingkungan Target |
|---|---|---|:---:|---|
| **TEST-01** | Isolasi Data Lintas Unit (TB KUK La Tansa vs KUK Palen) | PostgreSQL RLS | `NOT RUN` | Supabase Local / Staging |
| **TEST-02** | Otorisasi & Perlindungan Akses Data Payroll | RLS & Permissions | `NOT RUN` | Supabase Local / Staging |
| **TEST-03** | Concurrency & Slot Locking Pengajuan Cuti Simultan | Partial Unique Index / Advisory Lock | `NOT RUN` | Supabase Local / Staging |
| **TEST-04** | Pelepasan Slot Cuti Pasca-Pembatalan | Dynamic Conflict Slot | `NOT RUN` | Supabase Local / Staging |
| **TEST-05** | Penegakan Kelompok Bentrok Lintas Departemen | Conflict Groups Partial Index | `NOT RUN` | Supabase Local / Staging |
| **TEST-06** | Proteksi Anti-Bruteforce PIN Portal Karyawan | Bcrypt & Lockout Logic | `NOT RUN` | Supabase Local / Staging |
| **TEST-07** | Pencegahan Double-Booking Kendaraan | GiST Exclusion Constraint | `NOT RUN` | Supabase Local / Staging |
| **TEST-08** | Deteksi Impor Berkas Fingerprint Duplikat | SHA-256 Unique Constraint | `NOT RUN` | Supabase Local / Staging |
| **TEST-09** | Penarikan Tip Kaca Terverifikasi Tunggal ke Payroll | Payroll Ingestion Query | `NOT RUN` | Supabase Local / Staging |
| **TEST-10** | Kekekalan Data Payroll Final (Finalized Immutability)| Immutability Trigger | `NOT RUN` | Supabase Local / Staging |
| **TEST-11** | Kekekalan Rekaman Audit Log (Append-Only) | Trigger & RLS Policy | `NOT RUN` | Supabase Local / Staging |
| **TEST-12** | Penomoran Dokumen Deterministik Bebas Ganda | Row-Lock Sequence Generator | `NOT RUN` | Supabase Local / Staging |

---

## 2. Rincian Skenario Uji Teknis (12 Skenario Inti)

```
========================================================================================
[TEST-01] Isolasi Data Lintas Unit (TB KUK La Tansa vs KUK Palen) [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan pengguna Unit A tidak dapat membaca atau memutasi data Unit B.
- Aktor      : Staf 'Admin Unit Palen' (unit_id = 'KUK-PALEN').
- Prosedur   :
  1. Login sebagai staf Unit Palen dengan token JWT terautentikasi.
  2. Eksekusi SELECT * FROM employees WHERE unit_id = 'TB-LATANSA'.
  3. Eksekusi INSERT INTO employees (unit_id, employee_code, department_id, ...) 
     VALUES ('TB-LATANSA', 'KUK-LAT-999', ...).
- Ekspektasi :
  1. Kueri SELECT mengembalikan 0 baris (Row Level Security menyaring otomatis).
  2. Kueri INSERT ditolak dengan error 'new row violates row-level security policy for table employees'.

========================================================================================
[TEST-02] Otorisasi & Perlindungan Akses Payroll [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan pengguna tanpa izin 'payroll.view' tidak dapat mengakses slip gaji.
- Aktor      : Operator Lapangan / Fleet Officer (memiliki akses unit, tanpa role finance).
- Prosedur   :
  1. Login sebagai Operator.
  2. Eksekusi SELECT * FROM payroll_records WHERE unit_id = 'TB-LATANSA'.
  3. Eksekusi SELECT * FROM employee_sensitive_data.
- Ekspektasi :
  1. Kueri ke payroll_records mengembalikan 0 baris.
  2. Kueri ke employee_sensitive_data mengembalikan 0 baris.

========================================================================================
[TEST-03] Concurrency & Slot Locking Pengajuan Cuti Simultan [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan dua karyawan dari bagian yang sama tidak dapat mengambil slot cuti pada tanggal yang sama secara bersamaan.
- Aktor      : Karyawan A dan Karyawan B dari Departemen 'Kasir'.
- Prosedur   :
  1. Siapkan 2 thread simultan yang memanggil RPC submit_leave_request_atomic() pada milidetik yang sama untuk tanggal '2026-11-15'.
- Ekspektasi :
  1. Thread pertama berhasil dengan status 'APPROVED' dan mengunci baris di leave_conflict_slots.
  2. Thread kedua seketika gagal dan di-rollback dengan error 'Pengajuan gagal: Tanggal yang dipilih bertabrakan dengan jadwal cuti rekan pada bagian/kelompok bagian Anda'.
  3. Tidak ada duplikasi slot di leave_conflict_slots.

========================================================================================
[TEST-04] Pelepasan Slot Cuti Pasca-Pembatalan [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan pembatalan cuti melepaskan slot aktif sehingga dapat digunakan kembali.
- Aktor      : Karyawan A (pemohon cuti) dan Karyawan C (pemohon baru dari bagian yang sama).
- Prosedur   :
  1. Karyawan A membatalkan cuti tgl '2026-11-15' via RPC cancel_leave_request_atomic().
  2. Periksa status leave_conflict_slots (is_active harus bernilai FALSE).
  3. Karyawan C mengajukan cuti pada tanggal '2026-11-15' via RPC submit_leave_request_atomic().
- Ekspektasi :
  1. Pengajuan Karyawan C berhasil disetujui (APPROVED).
  2. Kuota dan slot konflik tanggal tersebut pulih sempurna.

========================================================================================
[TEST-05] Penegakan Kelompok Bentrok Lintas Departemen (Conflict Groups) [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan aturan cuti bersamaan pada kelompok bentrok (misal: Kepala Toko vs Admin).
- Aktor      : Karyawan posisi Kepala Toko dan Admin 2 (berada dalam 1 conflict_group).
- Prosedur   :
  1. Kepala Toko telah memiliki cuti disetujui pada '2026-11-20'.
  2. Admin 2 mengajukan cuti pada tanggal yang sama '2026-11-20'.
- Ekspektasi :
  1. RPC submit_leave_request_atomic() menolak pengajuan Admin 2 karena partial index uq_active_group_leave_slot mendeteksi tabrakan slot kelompok aktif.

========================================================================================
[TEST-06] Proteksi Anti-Bruteforce PIN Portal Karyawan [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan kesalahan PIN berulang mengunci akun sementara.
- Aktor      : Penyerang anonim mencoba menebak PIN karyawan.
- Prosedur   :
  1. Panggil submit_leave_request_atomic() dengan parameter p_auth_pin yang salah sebanyak 5 kali berturut-turut.
- Ekspektasi :
  1. Percobaan 1 s/d 4 mengembalikan error 'PIN otentikasi salah'.
  2. Kolom failed_attempts pada employee_portal_auth bertambah hingga 5.
  3. Percobaan ke-5 mengunci akun via locked_until (now() + 30 minutes).
  4. Percobaan ke-6 (sekalipun memasukkan PIN benar) langsung ditolak dengan pesan 'Akun terkunci sementara'.

========================================================================================
[TEST-07] Pencegahan Double-Booking Kendaraan (PostgreSQL Exclusion Constraint) [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan armada kendaraan tidak dapat dibooking pada jam yang bertabrakan.
- Aktor      : Peminjam A dan Peminjam B untuk kendaraan 'Truk Engkel KUK'.
- Prosedur   :
  1. Booking 1: Mobil Truk Engkel, status APPROVED, rentang '2026-11-10 08:00:00+07' s/d '2026-11-10 12:00:00+07'.
  2. Booking 2: Mobil Truk Engkel, rentang '2026-11-10 10:00:00+07' s/d '2026-11-10 14:00:00+07'.
  3. Admin mencoba menyetujui Booking 2 menjadi status 'APPROVED'.
- Ekspektasi :
  1. PostgreSQL menolak mutasi status Booking 2 dengan error code 23P01 (exclusion_violation via constraint uq_vehicle_no_double_booking).

========================================================================================
[TEST-08] Deteksi Impor Berkas Fingerprint Duplikat [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan berkas log mentah mesin absensi tidak dapat diimpor dua kali.
- Aktor      : HRD / Operator Absensi.
- Prosedur   :
  1. Unggah berkas CSV log mesin (misal: 'log_agustus.csv' dengan SHA-256 hash HASH_A).
  2. Coba unggah kembali berkas yang sama dengan nama berbeda namun konten identik (HASH_A).
- Ekspektasi :
  1. Impor kedua ditolak oleh constraint uq_fp_batch_hash pada fingerprint_import_batches.
  2. Data tap mentah pada fingerprint_raw_logs tidak mengalami penggandaan.

========================================================================================
[TEST-09] Penarikan Tip Kaca Terverifikasi Tunggal ke Payroll [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan transaksi tip yang sudah diverifikasi hanya ditarik 1 kali ke slip gaji.
- Aktor      : Finance / Payroll Officer.
- Prosedur   :
  1. Buat 1 transaksi tip kaca berstatus 'VERIFIED' (nominal Rp 150.000, payroll_period_id = NULL).
  2. Jalankan RPC calculate_and_finalize_payroll_atomic() untuk Periode Bulan N.
  3. Periksa kolom payroll_period_id pada transaksi tip tersebut (terisi ID Periode N).
  4. Jalankan RPC kalkulasi untuk Periode Bulan N+1.
- Ekspektasi :
  1. Pada slip gaji Periode N, tip Rp 150.000 masuk ke payroll_items.
  2. Pada slip gaji Periode N+1, tip tersebut tidak ditarik kembali (*zero double payout*).

========================================================================================
[TEST-10] Kekekalan Data Payroll Final (Finalized Immutability) [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan slip gaji pada periode FINALIZED tidak dapat dimanipulasi langsung via SQL.
- Aktor      : Pengguna terautentikasi dengan hak akses database langsung.
- Prosedur   :
  1. Pilih baris slip gaji pada payroll_records yang periode induknya berstatus 'FINALIZED'.
  2. Jalankan kueri UPDATE payroll_records SET net_salary = net_salary + 1000000 WHERE id = '...'.
  3. Jalankan kueri DELETE FROM payroll_records WHERE id = '...'.
- Ekspektasi :
  1. Kedua kueri di atas digagalkan oleh trigger protect_finalized_payroll() dengan error 'Slip gaji pada periode payroll yang telah FINALIZED tidak boleh dimodifikasi atau dihapus secara langsung'.

========================================================================================
[TEST-11] Kekekalan Rekaman Audit Log (Append-Only Enforcement) [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan rekam jejak audit tidak dapat dimanipulasi sekalipun oleh Super Admin.
- Aktor      : Akun Super Admin.
- Prosedur   :
  1. Jalankan UPDATE audit_logs SET old_data = '{}' WHERE id = 1.
  2. Jalankan DELETE FROM audit_logs WHERE id = 1.
- Ekspektasi :
  1. Kedua kueri digagalkan seketika oleh trigger protect_audit_log_immutability() dan kebijakan RLS audit_logs_no_update / audit_logs_no_delete.

========================================================================================
[TEST-12] Penomoran Dokumen Deterministik Bebas Nomor Ganda [Status: NOT RUN]
========================================================================================
- Tujuan     : Membuktikan pemanggilan simultan nomor dokumen menghasilkan nomor berurut unik.
- Aktor      : Sistem RPC generate_document_number_atomic().
- Prosedur   :
  1. Panggil fungsi generate_document_number_atomic(unit_id, 'CUTI', '202611') sebanyak 20 kali secara simultan dari 5 sesi terpisah.
- Ekspektasi :
  1. Seluruh 20 nomor dokumen berurutan dari 0001 hingga 0020.
  2. Tidak ada satupun nomor yang berulang atau melompati nilai (*gapless uniqueness*).
========================================================================================
```

---

## 3. Kriteria Keberhasilan Eksekusi (Exit Criteria)
1. Seluruh 12 skenario pengujian di atas wajib berstatus **`PASS`**.
2. Tidak ditemukan kebocoran data (*data leakage*) antarunit TB KUK La Tansa dan KUK Palen.
3. Seluruh error message database bersifat ramah pengguna dan tidak membocorkan nama tabel fisik, struktur skema, atau hash kredensial ke lapisan publik.

