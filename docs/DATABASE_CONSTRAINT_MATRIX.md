# DATABASE CONSTRAINT MATRIX — KUK MANAGEMENT SYSTEM
## Composite Integrity, Unique, Check, and Exclusion Constraints (v3.1.0)
**Versi:** 3.1.0  
**Tanggal:** 2026-11-04  
**Target:** PostgreSQL 15+  

---

## 1. Ikhtisar Penegakan Integritas Struktural

Sistem KUK Management System v3.1.0 menerapkan pendekatan **Defense-in-Depth Relasional**:
1. **Pencegahan Silang Unit Fisik (Physical Anti-Cross-Tenant Leakage)**:
   Setiap entitas berkonteks unit wajib memiliki `UNIQUE (unit_id, id)`. Relasi anak wajib menggunakan composite foreign key `FOREIGN KEY (unit_id, entity_id) REFERENCES parent_table (unit_id, id)`.
2. **Pencegahan Double-Booking Kernel (Kernel-Level Exclusion Constraints)**:
   Peminjaman kendaraan dan jadwal tarif kaca menggunakan ekstensi PostgreSQL `btree_gist` dengan constraint `EXCLUDE USING gist`.
3. **Pemisahan Slot Cuti Dinamis (Dynamic Slot Locking)**:
   Menggunakan *Partial Unique Indexes* `WHERE (is_active = TRUE)` agar pembatalan transaksi melepaskan kuota tanpa menghapus riwayat.
4. **Validasi Format & Integritas Nilai (Check Constraints)**:
   Pemeriksaan nilai positif, rentang tanggal valid, dan regex format periode.

---

## 2. Matriks Komprehensif Constraint Database

| Nama Tabel | Tipe Constraint | Nama Constraint / Indeks | Definisi Kolom | Aksi On-Delete | Justifikasi Bisnis & Keamanan |
|---|---|---|---|:---:|---|
| **`units`** | Primary Key | `units_pkey` | `id` | - | Identitas unik UUID unit. |
| | Unique | `uq_units_code` | `code` | - | Mencegah duplikasi kode unit ('TB-LATANSA', 'KUK-PALEN'). |
| | Foreign Key | `fk_units_org` | `organization_id -> organizations(id)` | RESTRICT | Unit tidak boleh kehilangan relasi ke organisasi induk KUK. |
| **`departments`** | Composite Unique | `uq_dept_unit_id` | `(unit_id, id)` | - | Prasyarat referensi composite foreign key dari tabel anak. |
| | Composite Unique | `uq_dept_unit_code` | `(unit_id, code)` | - | Kode bagian unik di dalam masing-masing unit. |
| | Composite Unique | `uq_dept_unit_name` | `(unit_id, name)` | - | Nama bagian unik di dalam masing-masing unit. |
| | Foreign Key | `fk_dept_unit` | `unit_id -> units(id)` | RESTRICT | Mencegah penghapusan unit jika memiliki departemen. |
| **`positions`** | Composite Unique | `uq_pos_unit_id` | `(unit_id, id)` | - | Prasyarat referensi composite FK dari karyawan dan mutasi. |
| | Composite Unique | `uq_pos_unit_code` | `(unit_id, code)` | - | Kode jabatan unik di dalam masing-masing unit. |
| | Foreign Key | `fk_pos_unit` | `unit_id -> units(id)` | RESTRICT | Menjaga stabilitas struktur jabatan operasional. |
| **`work_schedules`** | Composite Unique | `uq_sched_unit_id` | `(unit_id, id)` | - | Prasyarat referensi FK jadwal kerja karyawan. |
| | Composite Unique | `uq_sched_unit_code`| `(unit_id, code)` | - | Kode jadwal shift unik di dalam masing-masing unit. |
| **`employees`** | Composite Unique | `uq_emp_unit_id` | `(unit_id, id)` | - | Prasyarat relasi composite seluruh transaksi anak. |
| | Composite Unique | `uq_emp_unit_code` | `(unit_id, employee_code)` | - | Kode karyawan unik di dalam unit kerjanya. |
| | Composite FK | `fk_emp_department`| `(unit_id, department_id) -> departments(unit_id, id)` | RESTRICT | Karyawan WAJIB terhubung ke departemen dari unit yang sama. |
| | Composite FK | `fk_emp_position`  | `(unit_id, position_id) -> positions(unit_id, id)` | RESTRICT | Karyawan WAJIB terhubung ke jabatan dari unit yang sama. |
| | Composite FK | `fk_emp_schedule`  | `(unit_id, work_schedule_id) -> work_schedules(unit_id, id)` | RESTRICT | Jadwal kerja karyawan harus berasal dari unitnya. |
| **`employee_sensitive_data`** | Primary Key & FK | `fk_emp_sensitive` | `(unit_id, employee_id) -> employees(unit_id, id)` | CASCADE | Relasi 1-to-1 data NIK & Bank; terhapus jika akun dihapus. |
| **`employee_portal_auth`** | Primary Key & FK | `fk_emp_auth` | `(unit_id, employee_id) -> employees(unit_id, id)` | CASCADE | Relasi 1-to-1 PIN hash portal mandiri; terhapus jika akun dihapus. |
| **`employee_status_history`** | Composite FK | `fk_emp_status_hist` | `(unit_id, employee_id) -> employees(unit_id, id)` | RESTRICT | Riwayat perubahan status aktif/nonaktif/resign tersimpan permanen. |
| **`employee_job_history`** | Composite FK | `fk_job_hist_to_dept`| `(to_unit_id, to_department_id) -> departments(unit_id, id)` | RESTRICT | Departemen tujuan mutasi wajib berasal dari unit tujuan yang sama. |
| | Composite FK | `fk_job_hist_to_pos` | `(to_unit_id, to_position_id) -> positions(unit_id, id)` | RESTRICT | Jabatan tujuan mutasi wajib berasal dari unit tujuan yang sama. |
| **`user_unit_roles`** | Unique Constraint| `uq_user_unit_role`| `(user_id, unit_id, role_id)` | CASCADE | Mencegah duplikasi penugasan role yang sama pada user & unit yang sama. |
| **`leave_policies`** | Unique Constraint| `uq_leave_policy_unit` | `unit_id` | RESTRICT | Tepat satu konfigurasi kebijakan cuti per unit. |
| **`leave_conflict_departments`**| Primary Key | `pk_conf_dept` | `(conflict_group_id, department_id)` | CASCADE | Memetakan bagian yang dilarang cuti bersamaan. |
| | Composite FK | `fk_conf_dept_group` | `(unit_id, conflict_group_id) -> leave_conflict_groups(unit_id, id)` | CASCADE | Kelompok bentrok harus berasal dari unit yang sama. |
| | Composite FK | `fk_conf_dept_dept` | `(unit_id, department_id) -> departments(unit_id, id)` | CASCADE | Bagian yang dipasangkan harus berasal dari unit yang sama. |
| **`leave_requests`** | Composite Unique | `uq_leave_req_unit_id` | `(unit_id, id)` | - | Prasyarat referensi composite detail tanggal & slot. |
| | Unique Constraint| `uq_leave_req_num` | `request_number` | - | Nomor dokumen cuti berurut unik secara global. |
| | Composite FK | `fk_leave_req_emp` | `(unit_id, employee_id) -> employees(unit_id, id)` | RESTRICT | Pemohon cuti wajib merupakan karyawan aktif dari unit transaksi. |
| | Check Constraint | `chk_leave_month` | `target_month ~ '^[0-9]{4}-(0[1-9]\|1[0-2])$'` | - | Format bulan cuti wajib format baku 'YYYY-MM'. |
| **`leave_conflict_slots`**| Partial Unique | `uq_active_dept_leave_slot` | `(unit_id, department_id, leave_date) WHERE (is_active = TRUE)` | - | **SLOT LOCK**: Mencegah 2 karyawan se-bagian cuti bersamaan; otomatis bebas saat batal. |
| | Partial Unique | `uq_active_group_leave_slot` | `(unit_id, conflict_group_id, leave_date) WHERE (is_active = TRUE AND conflict_group_id IS NOT NULL)` | - | **GROUP LOCK**: Mencegah 2 bagian dalam 1 kelompok bentrok cuti bersamaan. |
| | Composite FK | `fk_slot_request` | `(unit_id, leave_request_id) -> leave_requests(unit_id, id)` | CASCADE | Pembatalan/penghapusan pengajuan mereferensikan slot terkait. |
| **`glass_types`** | Composite Unique | `uq_glass_type_unit_id` | `(unit_id, id)` | - | Prasyarat referensi tarif dan transaksi pemotongan kaca. |
| | Composite Unique | `uq_glass_type_code`| `(unit_id, code)` | - | Kode tipe kaca unik per unit. |
| **`glass_tip_rates`** | Composite Unique | `uq_tip_rates_unit_id` | `(unit_id, id)` | - | Prasyarat referensi transaksi tip kaca. |
| | Composite FK | `fk_tip_rate_type` | `(unit_id, glass_type_id) -> glass_types(unit_id, id)` | RESTRICT | Tarif kaca wajib mengikat jenis kaca dari unit yang sama. |
| | **Exclusion** | `uq_tip_rates_no_overlap` | `unit_id WITH =, glass_type_id WITH =, effective_range WITH && WHERE (is_active = TRUE)` | - | **ANTI-OVERLAP**: Mencegah 2 skema tarif aktif tumpang tindih tanggal pada jenis kaca yang sama. |
| **`glass_tips`** | Composite Unique | `uq_tips_unit_id` | `(unit_id, id)` | - | Prasyarat referensi verifikasi tip kaca. |
| | Unique Constraint| `uq_tip_ref_code` | `reference_code` | - | Kode referensi pemotongan unik untuk pelacakan publik. |
| | Composite FK | `fk_tip_employee` | `(unit_id, employee_id) -> employees(unit_id, id)` | RESTRICT | Karyawan pemotong kaca wajib berasal dari unit transaksi. |
| | Composite FK | `fk_tip_glass_type`| `(unit_id, glass_type_id) -> glass_types(unit_id, id)` | RESTRICT | Jenis kaca wajib berasal dari unit transaksi. |
| | Composite FK | `fk_tip_rate_conf` | `(unit_id, rate_id) -> glass_tip_rates(unit_id, id)` | RESTRICT | Konfigurasi tarif wajib berasal dari unit transaksi. |
| | Composite FK | `fk_tip_payroll_period` | `(unit_id, payroll_period_id) -> payroll_periods(unit_id, id)` | RESTRICT | Mengikat transaksi tip ke periode payroll unit yang bersangkutan (mencegah unit_id menjadi NULL; unlinking dilakukan via soft-cancel). |
| | Check Constraint | `chk_dim_positive` | `length_cm > 0 AND height_cm > 0 AND quantity > 0` | - | Mencegah input ukuran nol atau negatif. |
| | Check Constraint | `chk_glass_price_positive` | `glass_price_snapshot >= 0 AND tip_amount >= 0` | - | Mencegah nilai harga kaca atau tip bernilai negatif. |
| **`violation_point_rules`**| Unique Constraint | `uq_vio_rules_unit`| `unit_id` | RESTRICT | Tepat satu aturan ambang poin dan masa berlaku per unit. |
| **`violation_records`** | Composite Unique | `uq_vio_rec_unit_id`| `(unit_id, id)` | - | Prasyarat referensi audit & lampiran bukti. |
| | Composite FK | `fk_vio_rec_emp` | `(unit_id, employee_id) -> employees(unit_id, id)` | RESTRICT | Karyawan yang melanggar wajib berasal dari unit bersangkutan. |
| | Composite FK | `fk_vio_rec_type` | `(unit_id, violation_type_id) -> violation_types(unit_id, id)` | RESTRICT | Jenis pelanggaran wajib berasal dari unit bersangkutan. |
| **`fingerprint_devices`**| Composite Unique | `uq_fp_dev_unit_id` | `(unit_id, id)` | - | Prasyarat referensi pendaftaran fingerprint karyawan. |
| **`employee_fingerprint_ids`**| Unique Constraint | `uq_fp_enrollment` | `(device_id, enrollment_id)` | CASCADE | Mencegah nomor PIN/Enrollment yang sama dipetakan ke 2 karyawan pada mesin yang sama. |
| | Composite FK | `fk_fp_id_emp` | `(unit_id, employee_id) -> employees(unit_id, id)` | CASCADE | Karyawan pemilik ID mesin wajib berasal dari unit yang sama. |
| | Composite FK | `fk_fp_id_dev` | `(unit_id, device_id) -> fingerprint_devices(unit_id, id)` | RESTRICT | Mesin fingerprint wajib berasal dari unit yang sama. |
| **`fingerprint_import_batches`**| Unique Constraint | `uq_fp_batch_hash`| `(unit_id, file_sha256_hash)` | - | Mencegah pengunggahan berkas log mesin yang sama secara berulang (*duplicate import*). |
| **`fingerprint_raw_logs`**| Unique Constraint | `uq_raw_log_tap` | `(unit_id, device_enrollment_id, log_timestamp)` | - | Mencegah duplikasi data tap mentah dari mesin sidik jari. |
| **`attendance_daily_records`**| Composite Unique | `uq_att_daily_unit_id`| `(unit_id, id)` | - | Prasyarat referensi koreksi absensi. |
| | Composite Unique | `uq_att_daily_emp_date` | `(unit_id, employee_id, work_date)` | - | Tepat satu rekapitulasi kehadiran harian per karyawan. |
| | Composite FK | `fk_att_daily_emp` | `(unit_id, employee_id) -> employees(unit_id, id)` | RESTRICT | Karyawan presensi wajib berasal dari unit kerja yang sama. |
| **`payroll_periods`** | Composite Unique | `uq_pay_period_unit_id` | `(unit_id, id)` | - | Prasyarat referensi slip gaji dan revisi payroll. |
| | Composite Unique | `uq_pay_period_code` | `(unit_id, period_code)` | - | Kode periode penggajian unik per unit. |
| **`payroll_records`** | Composite Unique | `uq_pay_rec_unit_id` | `(unit_id, id)` | - | Prasyarat referensi komponen rincian slip gaji. |
| | Unique Constraint| `uq_slip_number` | `slip_number` | - | Nomor slip gaji berurut unik global. |
| | Composite Unique | `uq_pay_one_slip_per_period` | `(unit_id, payroll_period_id, employee_id)` | - | **SATU SLIP PER KARYAWAN**: Mencegah duplikasi slip gaji pada satu periode. |
| | Composite FK | `fk_pay_rec_period`| `(unit_id, payroll_period_id) -> payroll_periods(unit_id, id)` | RESTRICT | Periode penggajian wajib berasal dari unit yang sama. |
| | Composite FK | `fk_pay_rec_emp` | `(unit_id, employee_id) -> employees(unit_id, id)` | RESTRICT | Karyawan penerima gaji wajib berasal dari unit yang sama. |
| **`vehicles`** | Composite Unique | `uq_veh_unit_id` | `(unit_id, id)` | - | Prasyarat referensi peminjaman, inspeksi, kerusakan, dan BBM. |
| | Unique Constraint| `uq_veh_license_plate` | `license_plate` | - | Plat nomor polisi armada unik secara nasional/organisasi. |
| **`vehicle_borrowing_requests`**| Composite Unique | `uq_fleet_req_unit_id` | `(unit_id, id)` | - | Prasyarat referensi inspeksi dan pelaporan kerusakan. |
| | Unique Constraint| `uq_fleet_booking_code` | `booking_code` | - | Kode booking armada unik untuk verifikasi publik. |
| | Composite FK | `fk_fleet_req_veh` | `(unit_id, vehicle_id) -> vehicles(unit_id, id)` | RESTRICT | Kendaraan yang dipinjam wajib milik unit peminjaman. |
| | Check Constraint | `chk_booking_time` | `estimated_return_time > start_time` | - | Waktu kembali wajib lebih besar daripada waktu keluar. |
| | **Exclusion** | `uq_vehicle_no_double_booking` | `vehicle_id WITH =, tstzrange(start_time, estimated_return_time, '[)') WITH && WHERE (status IN ('APPROVED', 'IN_USE'))` | - | **ANTI-DOUBLE BOOKING**: Menolak mutlak peminjaman bertabrakan pada kendaraan yang sama. |
| **`vehicle_condition_inspections`**| Composite FK | `fk_insp_req` | `(unit_id, borrowing_request_id) -> vehicle_borrowing_requests(unit_id, id)` | RESTRICT | Pemeriksaan fisik tidak boleh terhapus jika booking dibatalkan. |
| | Composite FK | `fk_insp_veh` | `(unit_id, vehicle_id) -> vehicles(unit_id, id)` | RESTRICT | Kendaraan yang diinspeksi wajib sesuai unit. |
| **`vehicle_damages`** | Composite FK | `fk_dmg_request` | `(unit_id, borrowing_request_id) -> vehicle_borrowing_requests(unit_id, id)` | RESTRICT | Catatan kerusakan terikat dengan transaksi booking unit. |
| | Composite FK | `fk_dmg_vehicle` | `(unit_id, vehicle_id) -> vehicles(unit_id, id)` | RESTRICT | Kendaraan yang rusak wajib berasal dari unit bersangkutan. |
| **`vehicle_fuel_logs`** | Composite FK | `fk_fuel_vehicle` | `(unit_id, vehicle_id) -> vehicles(unit_id, id)` | RESTRICT | Pengisian BBM terikat pada kendaraan unit yang sama. |
| | Composite FK | `fk_fuel_borrowing_req` | `(unit_id, borrowing_request_id) -> vehicle_borrowing_requests(unit_id, id)` | RESTRICT | Log BBM diasosiasikan opsional dengan peminjaman armada tanpa risiko unit_id ter-nullifikasi. |
| **`document_sequences`**| Composite Unique | `uq_doc_seq_lookup`| `(unit_id, doc_type, period_key)` | - | Menjamin kesinambungan nomor urut dokumen per unit & periode. |
| **`public_form_tokens`**| Unique Constraint | `uq_form_token_hash` | `token_hash` | - | Mencegah pemalsuan atau penggunaan token ganda (*replay attack*). |

---

## 3. Verifikasi Logika Aksi ON DELETE

1. **`ON DELETE RESTRICT`**:
   - Diterapkan pada seluruh entitas master yang memiliki relasi transaksional (Karyawan, Unit, Bagian, Jabatan, Kendaraan, Tipe Kaca, Periode Payroll).
   - Menjamin bahwa data historis tidak akan pernah menjadi *orphan records* (kehilangan relasi induk).
2. **`ON DELETE CASCADE`**:
   - Diterapkan hanya pada rincian internal yang tidak memiliki eksistensi mandiri tanpa induknya:
     - `employee_sensitive_data` dan `employee_portal_auth` (terkait 1-to-1 dengan Karyawan).
     - `leave_request_dates` dan `leave_conflict_slots` (rincian dari `leave_requests`).
     - `payroll_items` (rincian dari `payroll_records`).
     - `employee_salary_component_items` (rincian dari `employee_salary_structures`).
3. **`ON DELETE SET NULL`**:
   - Diterapkan pada referensi pengguna pencatat / penyetujui (`created_by`, `updated_by`, `approved_by`, `actor_id` di `audit_logs`).
   - Jika akun staf dinonaktifkan atau dihapus dari sistem autentikasi, rekaman audit dan transaksi operasional tetap utuh tersimpan di database.

