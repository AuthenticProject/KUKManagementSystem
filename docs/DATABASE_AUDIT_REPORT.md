# DATABASE ARCHITECTURE AUDIT REPORT
## KUK Management System · Architecture Version 3.0.0 to 3.1.0 Evaluation
**Tanggal Audit:** 2026-11-04  
**Auditor:** Lead Database Architect & Senior Security Engineer  
**Status:** Architectural Review & Remediation Plan  

---

## 1. Eksekutif Ringkasan Audit (v3.0.0 Evaluation)

Audit teknis komprehensif telah dilakukan terhadap berkas arsitektur database versi 3.0.0 (`DATABASE_SCHEMA.md` dan `ERD.md`). Hasil audit mengonfirmasi bahwa versi 3.0.0 telah meletakkan fondasi domain yang baik, namun **memiliki kerentanan integritas relasional, asumsi bisnis yang belum disahkan, potensi race-condition, serta inkonsistensi multi-unit** jika diimplementasikan ke lingkungan produksi tanpa perbaikan struktural.

Versi 3.1.0 dirancang untuk menyelesaikan seluruh temuan audit tersebut dengan menerapkan:
1. **Composite Foreign Keys** `(unit_id, entity_id)` untuk mencegah relasi lintas unit secara fisik di level database engine.
2. **PostgreSQL Exclusion Constraints (`tstzrange` via `btree_gist`)** untuk mencegah *double booking* armada secara absolut.
3. **Mekanisme Dynamic Slot Locking** pada modul cuti dengan partial unique index agar pembatalan cuti mengembalikan slot secara bersih.
4. **Pembersihan Seluruh Nilai Default Asumsi** (menghapus asumsi poin SP, durasi masa berlaku sanksi, potongan KSJ Rp 50.000, status lunas otomatis, dan asumsi gender/status pernikahan).
5. **Standarisasi Zona Waktu Jakarta** menggunakan `(now() AT TIME ZONE 'Asia/Jakarta')::date` dan penyimpanan `TIMESTAMPTZ DEFAULT now()`.
6. **Pemisahan Kredensial Sensitif & Autentikasi Mandiri** (`employee_portal_auth`, `employee_sensitive_data`, `employee_fingerprint_ids`).
7. **Kelengkapan Tabel Sistem Produksi** (`notifications`, `system_settings`, `file_attachments`, `public_form_tokens`, `work_schedules`).

---

## 2. Matriks Temuan Audit v3.0.0 & Tindakan Perbaikan v3.1.0

| Domain | Temuan Kritis v3.0.0 | Dampak / Risiko | Perbaikan Arsitektur v3.1.0 |
|---|---|---|---|
| **Multi-Unit Isolation** | Foreign key hanya mengikat `id` tunggal. Contoh: `employees.department_id` merujuk `departments(id)`. | Karyawan di Unit A dapat secara tidak sengaja/sengaja dipasangkan dengan Departemen dari Unit B via API atau SQL tanpa terdeteksi constraint database. | Diterapkan **Composite Foreign Keys**: Setiap entitas master memiliki `UNIQUE(unit_id, id)`. Relasi anak mewajibkan `FOREIGN KEY (unit_id, department_id) REFERENCES departments(unit_id, id)`. |
| **Employee Master Data** | `employee_code` unik global (`UNIQUE`), `auth_pin_hash` tercampur di master, `gender` default 'L', `marital_status` default 'SINGLE', NIK terbuka di tabel umum. | Pelanggaran privasi data, asumsi bias kondisi karyawan, tidak mendukung format kode per-unit, dan kebocoran PIN. | 1. `UNIQUE(unit_id, employee_code)`.<br>2. Hapus nilai default gender/marital status.<br>3. Pisahkan ke `employee_portal_auth` dan `employee_sensitive_data`.<br>4. Tambahkan `employee_status_history` dan `employee_fingerprint_ids`. |
| **RBAC & Authorization** | `user_unit_access` membatasi 1 user hanya 1 role per unit (`UNIQUE(user_id, unit_id)`). Ketergantungan pada flag `profiles.is_super_admin`. | Staf yang merangkap role (misal: Admin Unit sekaligus Fleet Manager di unit yang sama) tidak terakomodasi. Super admin rentan eskalasi privilege melalui modifikasi flag profil. | 1. Transformasi ke `user_unit_roles` (relasi many-to-many: `user_id, unit_id, role_id`).<br>2. Penetapan Super Admin melalui penugasan role sistem di database dan fungsi pembantu tersentralisasi dengan hak eksekusi terbatas. |
| **Leave Management** | `leave_request_dates` memiliki `UNIQUE(unit_id, department_id, leave_date)`. Verifikasi identitas pemohon cuti publik hanya mengandalkan parameter kiriman klien. | 1. Jika pengajuan dibatalkan, tanggal tersebut terkunci selamanya karena unique constraint tidak mengenal status.<br>2. Pengunjung publik dapat mengajukan cuti atas nama karyawan lain jika mengetahui `employee_id`. | 1. Diperkenalkan tabel `leave_conflict_slots` dengan **Partial Unique Index** `WHERE (is_active = TRUE)`. Pembatalan cuti menonaktifkan slot secara atomik.<br>2. RPC `submit_leave_request_atomic` memverifikasi token sesi/PIN hash di `employee_portal_auth`. |
| **Timezone Management** | Penggunaan `timezone('utc'::text, now())` dan `timezone('Asia/Jakarta'::text, now())` menghasilkan `timestamp without time zone` yang rentan terdistorsi konfigurasi session timezone klien. | Kesalahan penentuan tanggal operasional briefing, cuti, dan keterlambatan presensi. | Standarisasi PostgreSQL: Semua kolom waktu bertipe `TIMESTAMPTZ DEFAULT now()`. Penentuan tanggal operasional unit menggunakan `(now() AT TIME ZONE 'Asia/Jakarta')::date`. |
| **Glass Tips** | Formula tip kaku, hanya mendukung per m², tidak ada struktur rentang ukuran (*size range*), berpotensi overlap periode tarif, dan nominal tip rentan dimanipulasi klien. | Tidak mendukung jenis tarif per potong/rentang dimensi, serta inkonsistensi penghitungan tarif bertingkat. | 1. Penambahan `glass_tip_rate_ranges`.<br>2. Dukungan metode `PER_SQM`, `PER_PIECE`, `SIZE_RANGE`, `HYBRID`.<br>3. Constraint pencegah tumpang tindih periode tarif.<br>4. Integrasi proteksi `public_form_tokens`. |
| **Violations & Sanctions** | Hardcoded angka asumsi: SP1 (20 poin), SP2 (40 poin), SP3 (60 poin), PHK (100 poin), masa berlaku 6 bulan. Tidak ada tabel template dan approval SP. | Angka belum disahkan pimpinan KUK. Tidak ada dokumen template resmi SP. | 1. Menghapus seluruh default nominal poin dan ambang batas.<br>2. Menambahkan tabel `warning_letter_templates` dan `warning_letter_approvals`. |
| **Attendance & Fingerprint** | `fingerprint_raw_logs` tidak mencatat serial perangkat fisik, tidak ada katalog mesin fingerprint, dan jam briefing universal (07:30) mengabaikan jadwal shift. | Tidak dapat mengidentifikasi mesin asal jika organisasi memiliki lebih dari 1 mesin, dan tidak mendukung shift fleksibel. | 1. Menambahkan `fingerprint_devices`.<br>2. Menambahkan `work_schedules` per unit.<br>3. Pemetaan multi-perangkat di `employee_fingerprint_ids`.<br>4. Logging koreksi lengkap di `attendance_adjustments` (nilai sebelum dan sesudah). |
| **Payroll Engine** | Payroll record tidak memiliki unique constraint per periode karyawan, status pembayaran default 'Lunas/Ditransfer', potongan KSJ default Rp 50.000, tidak ada lock fisik anti-update saat final. | 1. Potensi duplikasi slip gaji dalam satu periode.<br>2. Data payroll final dapat diubah diam-diam oleh query UPDATE.<br>3. Asumsi potongan KSJ tidak valid. | 1. `UNIQUE(unit_id, payroll_period_id, employee_id)`.<br>2. Default payment status: 'PENDING_PAYMENT'.<br>3. Trigger penolak UPDATE/DELETE pada payroll berstatus 'FINALIZED'.<br>4. Tabel `payroll_revisions` untuk revisi berizin. |
| **Vehicle Booking** | Pemeriksaan bentrok jadwal armada hanya mengandalkan pengecekan manual di RPC tanpa exclusion constraint. Potensi double-booking jika 2 request dieksekusi bersamaan. | Truk atau mobil yang sama dapat dipinjam oleh 2 pihak berbeda pada jam yang bertabrakan. | Diterapkan **PostgreSQL Exclusion Constraint**: Menggunakan extension `btree_gist` dan tipe `tstzrange` dengan predikat `WHERE (status IN ('APPROVED', 'IN_USE'))`. |
| **Audit & System Tables** | `audit_logs` belum memiliki trigger proteksi immutability, `document_sequences` menggunakan angka acak (*random math*), tabel `system_settings`, `notifications`, dan `file_attachments` belum terdefinisi. | Audit log dapat dimanipulasi melalui akses langsung, nomor surat berantakan, berkas lampiran tidak terdata. | 1. Trigger PostgreSQL menolak mutasi UPDATE/DELETE pada `audit_logs`.<br>2. Generator nomor dokumen berbasis *Atomic Row Locking* (`SELECT FOR UPDATE`).<br>3. Definisi lengkap tabel pendukung sistem. |

---

## 3. Keputusan Teknis Penting & Penjelasan Arsitektur v3.1.0

### 3.1 Penegakan Integritas Multi-Unit Melalui Database Composite Foreign Keys
Pada sistem multi-tenant terpadu, kegagalan terbesar sering kali terjadi karena mempercayai `WHERE unit_id = x` di lapisan kode aplikasi. Pada versi 3.1.0:
- Setiap tabel berkonteks unit memiliki constraint: `UNIQUE (unit_id, id)`.
- Setiap foreign key yang menghubungkan entitas unit wajib menyertakan `unit_id`:
  ```sql
  CONSTRAINT fk_emp_department
      FOREIGN KEY (unit_id, department_id)
      REFERENCES departments (unit_id, id)
      ON DELETE RESTRICT
  ```
Hal ini memastikan secara matematis bahwa **tidak mungkin ada baris data anak yang menunjuk ke entitas induk dari unit yang berbeda**, bahkan jika dieksekusi melalui SQL console atau terjadi *bug* pada antarmuka frontend.

### 3.2 Penyelesaian Masalah Slot Cuti (Dynamic Conflict Allocation)
Pada v3.0.0, unique constraint `UNIQUE(unit_id, department_id, leave_date)` diterapkan langsung pada tabel data pengajuan cuti. Akibatnya, saat pengajuan dibatalkan, baris tidak boleh dihapus demi jejak audit, namun tanggal tersebut tetap terblokir dari pemohon lain.
Pada v3.1.0:
- Data permohonan tersimpan pada `leave_requests` dan rincian tanggal pada `leave_request_dates`.
- Slot konflik operasional dipisahkan ke tabel `leave_conflict_slots`.
- Penegakan anti-bentrok menggunakan **Partial Unique Index**:
  ```sql
  CREATE UNIQUE INDEX uq_active_dept_leave_slot 
  ON leave_conflict_slots (unit_id, department_id, leave_date) 
  WHERE (is_active = TRUE);
  ```
- Ketika suatu pengajuan cuti dibatalkan secara sah, transaksi atomik mengubah `is_active = FALSE` pada `leave_conflict_slots`, seketika membebaskan kuota departemen tanpa merusak histori permohonan.

### 3.3 Pencegahan Mutlak Double Booking Kendaraan (Exclusion Constraint)
Memeriksa ketersediaan armada menggunakan kueri `SELECT COUNT(*)` sebelum melakukan `INSERT` rentan terhadap *phantom read* pada request simultan.
Pada v3.1.0, tabel `vehicle_borrowing_requests` menggunakan PostgreSQL GiST Exclusion:
```sql
CONSTRAINT uq_vehicle_no_double_booking
EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(start_time, estimated_return_time, '[)') WITH &&
) WHERE (status IN ('APPROVED', 'IN_USE'));
```
Database PostgreSQL menjamin di level kernel engine bahwa dua rentang waktu yang bertabrakan (*overlap*) pada kendaraan yang sama tidak akan pernah dapat disimpan secara bersamaan.

---

## 4. Risiko Teknis Tersisa (Residual Risks) & Mitigasi

| Risiko Tersisa | Tingkat Risiko | Strategi Mitigasi Terencana |
|---|:---:|---|
| **Ketergantungan Ekstensi `btree_gist`** | Rendah | Ekstensi `btree_gist` telah didukung secara *native* pada Supabase PostgreSQL. Skrip migrasi wajib mengaktifkannya via `CREATE EXTENSION IF NOT EXISTS btree_gist;`. |
| **Beban Kueri RLS Berlapis** | Sedang | Kueri RLS yang mengecek relasi izin dapat menambah latensi jika tabel bertumbuh jutaan baris. Dimigasikan dengan menambahkan indeks komposit pada `(user_id, unit_id, role_id)` dan menandai fungsi helper sebagai `STABLE`. |
| **Ketidaksesuaian Format Log Mesin Fisik** | Sedang | Format ekspor CSV tiap mesin fingerprint (misal: ZKTeco, Solution, Fingerspot) berbeda. Modul impor v3.1.0 menyimpan `fingerprint_raw_logs` dalam format JSONB mentah sebelum dipetakan oleh adapter mesin. |

---

## 5. Keputusan Bisnis yang Masih Membutuhkan Konfirmasi Manajemen KUK

1. **Ambang Batas Poin Sanksi & Masa Berlaku**: Nilai pasti ambang poin penerbitan SP1, SP2, SP3, dan PHK serta masa aktif poin (misal 6 atau 12 bulan) perlu disahkan secara tertulis oleh Direksi/HRD KUK sebelum dimasukkan ke dalam seed konfigurasi.
2. **Besaran Tarif Tip Potong Kaca**: Besaran tarif per meter persegi atau per potong untuk tiap ketebalan kaca (5mm bening, 5mm ribben, 8mm, cermin) wajib diisi melalui form konfigurasi oleh Finance, bukan di-hardcode.
3. **Komponen Potongan Standar**: Skema potongan tetap seperti KSJ (Koperasi/Sosial) dan aturan denda keterlambatan presensi (per menit atau flat) harus dikonfirmasi apakah berlaku sama di seluruh unit atau berbeda per unit.

