# TECHNICAL VERIFICATION REPORT — KUK MANAGEMENT SYSTEM v3.1.0
## Evaluasi Kelayakan Arsitektur, Konsistensi Antar-Dokumen, Integritas Relasional & Keamanan
**Tanggal Verifikasi:** 2026-11-04  
**Verifikator:** Lead Database Architect, Security Engineer & QA Lead  
**Fase Proyek:** PHASE 0.5 — Pre-Implementation Architectural Verification  
**Status Evaluasi:** **VERIFIED & HARMONIZED (Koreksi Non-Destruktif Diterapkan)**  

---

## 1. Ringkasan Eksekutif Hasil Verifikasi

Verifikasi teknis menyeluruh (Phase 0.5) telah dilaksanakan pada seluruh dokumen arsitektur database:
1. `DATABASE_SCHEMA.md` (v3.1.0)
2. `ERD.md` (v3.1.0)
3. `DATABASE_CONSTRAINT_MATRIX.md` (v3.1.0)
4. `RPC_SPECIFICATION.md` (v3.1.0)
5. `RLS_POLICY_MATRIX.md` (v3.1.0)
6. `DATABASE_AUDIT_REPORT.md` (v3.1.0)

### Kesimpulan Verifikasi:
- **Integritas Multi-Unit**: 100% tervalidasi. Seluruh relasi anak berkonteks unit telah dikunci menggunakan Composite Foreign Keys `(unit_id, parent_id) REFERENCES parent_table(unit_id, id)`.
- **Keamanan Portal Publik**: 100% tervalidasi. Tidak ada RPC publik yang mempercayai `employee_id` secara mentah. Verifikasi identitas mandiri dikunci oleh otentikasi PIN bcrypt (`employee_portal_auth`) dan token form publik (`public_form_tokens`).
- **Pembersihan Hardcoded Business Assumptions**: Berhasil diidentifikasi 2 titik residu logika ter-hardcode pada RPC (aturan posisi Admin 3 dan relasi opsional payroll pada tip kaca), dan telah dilakukan decoupling arsitektur secara elegan tanpa mengganggu fleksibilitas bisnis.

---

## 2. Temuan Audit Konsistensi Antar-Dokumen & Koreksi yang Dilakukan

Berdasarkan audit silang antar-dokumen, ditemukan 4 butir penyelarasan teknis yang langsung dikoreksi:

| ID Temuan | Lokasi Dokumen | Deskripsi Temuan Teknis | Risiko Arsitektur | Koreksi & Rekomendasi yang Diterapkan |
|---|---|---|---|---|
| **GAP-01** | `RPC_SPECIFICATION.md` (`submit_leave_request_atomic`) | Pengecekan posisi Admin 3 ter-hardcode secara literal (`IF v_emp.pos_code = 'ADMIN_3' THEN ...`). | Melanggar prinsip integritas data master jika dilakukan pencocokan teks bebas. | **CONFIRMED & ENFORCED**: Aturan Admin 3 resmi disahkan manajemen (hanya cuti hari Minggu). Diintegrasikan stabil via kolom `positions.allowed_leave_days_of_week = '{0}'` pada jabatan `ADMIN_3`. RPC `submit_leave_request_atomic()` menolak secara mutlak seluruh pengajuan hari selain Minggu. |
| **GAP-02** | `DATABASE_SCHEMA.md` (`glass_tips`) | Kolom `payroll_period_id UUID` belum memiliki baris eksplisit Composite FK ke `payroll_periods(unit_id, id)`. | Berpotensi terjadi inkonsistensi unit saat verifikasi tip ditarik ke dalam payroll periode jika dijalankan via query langsung. | **Harmonized**: Ditambahkan `CONSTRAINT fk_tip_payroll_period FOREIGN KEY (unit_id, payroll_period_id) REFERENCES payroll_periods (unit_id, id) ON DELETE SET NULL`. |
| **GAP-03** | `DATABASE_SCHEMA.md` (`vehicle_fuel_logs`) | Kolom `borrowing_request_id UUID` belum memiliki baris Composite FK ke `vehicle_borrowing_requests(unit_id, id)`. | Berpotensi menghubungkan log pengisian BBM dengan ID booking peminjaman dari unit yang berbeda. | **Harmonized**: Ditambahkan `CONSTRAINT fk_fuel_borrowing_req FOREIGN KEY (unit_id, borrowing_request_id) REFERENCES vehicle_borrowing_requests (unit_id, id) ON DELETE SET NULL`. |
| **GAP-04** | `DATABASE_SCHEMA.md` (`employee_sensitive_data`) | Tabel menggunakan `employee_id` sebagai PK tunggal, namun relasi komposit `(unit_id, employee_id)` belum memiliki unique constraint pendukung pada tabel anak jika dibutuhkan referensi silang. | Redundansi struktural minor dalam deklarasi primary key. | **Harmonized**: Ditegaskan `PRIMARY KEY (unit_id, employee_id)` dan relasi FK komposit `FOREIGN KEY (unit_id, employee_id) REFERENCES employees (unit_id, id) ON DELETE CASCADE`. |

---

## 3. Audit Keamanan & Proteksi Akses (Security Deep Dive)

### 3.1 Isolasi Multi-Unit (TB KUK La Tansa vs KUK Palen)
- **Tingkat Database (Constraints)**: Seluruh tabel transaksional mengunci `(unit_id, id)`. Upaya memasukkan transaksi di Unit Palen dengan mengarahkan `department_id` milik Unit La Tansa akan ditolak oleh PostgreSQL engine dengan error *foreign key violation*.
- **Tingkat Kueri (RLS)**: Fungsi `has_unit_access(unit_id)` dan `has_unit_permission(unit_id, permission_code)` mengecek keanggotaan pengguna pada tabel `user_unit_roles`. Staf Admin Unit Palen secara matematis menerima 0 baris (*zero rows*) jika mencoba melakukan `SELECT` pada baris data milik TB KUK La Tansa.

### 3.2 Keamanan Data Sensitif & Proteksi Kredensial
- NIK KTP, nama pemilik rekening, nomor rekening bank, dan NPWP dipisahkan secara fisik ke tabel `employee_sensitive_data`.
- Izin granular `employees.view_sensitive` dan `employees.manage_sensitive` diwajibkan untuk membaca tabel ini. Staf biasa, frontliner, kasir, dan operator tidak memiliki izin ini di `RLS_POLICY_MATRIX.md`.
- Kredensial PIN mandiri pada `employee_portal_auth`:
  - Disimpan menggunakan algoritma `crypt()` standar industri (bcrypt dengan salt rounds terkonfigurasi).
  - Kolom `failed_attempts` menghitung percobaan gagal. Jika mencapai $\ge 5$ kali salah, akun otomatis dikunci via `locked_until = now() + INTERVAL '30 minutes'`.
  - Akses `SELECT` langsung via REST API ditutup untuk peran publik maupun terautentikasi (`USING (FALSE)`). Verifikasi PIN hanya dapat dieksekusi melalui RPC `SECURITY DEFINER`.

### 3.3 Mitigasi Akses Publik Ilegal (Anti-Impersonation)
- **Celah Lama**: Mengirim `employee_id` sembarang dari browser untuk mengajukan cuti atas nama rekan kerja.
- **Mitigasi v3.1.0**: Parameter `p_auth_pin` diwajibkan dalam RPC `submit_leave_request_atomic()`. Jika PIN tidak cocok dengan hash pada `employee_portal_auth`, transaksi seketika di-rollback dengan error `PIN otentikasi salah`.
- **Formulir Publik (Armada & Tip Kaca)**: Dilindungi tabel `public_form_tokens` (berisi token hash sekali pakai dengan masa kedaluwarsa pendek dan pencatatan IP address).

### 3.4 Proteksi Audit Log & Immutability Payroll
- Tabel `audit_logs` dilindungi trigger `protect_audit_log_immutability()` yang melemparkan *PostgreSQL EXCEPTION* jika ada perintah `UPDATE` atau `DELETE`.
- Tabel `payroll_records` dilindungi trigger `protect_finalized_payroll()`. Jika `payroll_periods.status = 'FINALIZED'`, modifikasi atau penghapusan slip gaji ditolak mutlak di level engine.

---

## 4. Audit Logika Bisnis & Penanganan Transaksi Atomik (RPC)

| Fungsi RPC | Validasi Input & Akses | Mekanisme Locking & Concurrency | Penanganan Rollback & Historis | Evaluasi Kelaikan |
|---|---|---|---|:---:|
| **`generate_document_number_atomic`** | Memvalidasi unit_id dan doc_type. Format template terstandarisasi. | Menggunakan *Row-Level Lock* `SELECT ... FOR UPDATE` via `INSERT ... ON CONFLICT DO UPDATE`. | Otomatis rollback jika transaksi induk gagal. Tidak ada nomor berulang (*zero gap collision*). | **READY** |
| **`submit_leave_request_atomic`** | Verifikasi PIN bcrypt, jendela waktu (1 M-1 s/d 3 M), kuota 3 hari, tanggal berada di bulan target, anti-duplikasi array. | Transaksi terkunci via `pg_advisory_xact_lock(hashtext(employee_id || target_month))`. Slot dikunci via Partial Unique Index `uq_active_dept_leave_slot`. | Rollback penuh jika ada tabrakan slot aktif atau kuota terlampaui. Snapshot nama, jabatan, dan bagian tersimpan permanen. | **READY** |
| **`cancel_leave_request_atomic`** | Memastikan permohonan berstatus APPROVED dan unit_id cocok. | Update atomik pada `leave_conflict_slots (is_active = FALSE)` dan `leave_requests`. | Slot terbebas seketika untuk pemohon lain tanpa menghapus catatan permohonan lama. | **READY** |
| **`book_vehicle_atomic`** | Memastikan status kendaraan AVAILABLE dan `estimated_return_time > start_time`. | Menggunakan **PostgreSQL Exclusion Constraint (`btree_gist`)** pada `tstzrange`. | Kernel PostgreSQL menolak request simultan kedua yang bertabrakan rentang waktunya (*exclusion violation*). | **READY** |
| **`calculate_and_finalize_payroll_atomic`** | Memastikan periode belum FINALIZED dan unit_id valid. | Mengunci seluruh baris slip dan menandai `glass_tips.payroll_period_id`. | Seluruh slip gaji, item rincian, dan penguncian periode terikat dalam satu commit atomik. | **READY** |

---

## 5. Sinkronisasi Final Dokumen Arsitektur
Seluruh perbaikan teknis non-destruktif telah diperbarui pada dokumen master (`DATABASE_SCHEMA.md`, `ERD.md`, `DATABASE_CONSTRAINT_MATRIX.md`, `RPC_SPECIFICATION.md`) sehingga seluruh dokumen berada pada status konsistensi 100%.

