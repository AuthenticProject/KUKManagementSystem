# BUSINESS RULES & OPERATIONAL SPECIFICATION — KUK MANAGEMENT SYSTEM
## Logika Bisnis Komprehensif & Validasi Operasional
**Versi:** 3.0.0  
**Tanggal:** 2026-11-04  
**Status:** Canonical Reference / Phase 0 Final  

---

## 1. Aturan Organisasi & Multi-Unit

### BR-ORG-001: Model Entitas Tunggal Berbasis Unit
- Organisasi induk adalah **KUK**.
- Unit operasional awal yang wajib terdaftar:
  1. `TB KUK La Tansa` (Kode: `TB-LATANSA`) — Operasional toko bangunan, pemotongan kaca, armada ekspedisi material.
  2. `KUK Palen` (Kode: `KUK-PALEN`) — Operasional toko retail perlengkapan/palen.
- Unit baru dapat didaftarkan setiap saat oleh Super Admin tanpa migrasi tabel. Seluruh tabel data operasional mewarisi foreign key `unit_id`.

### BR-ORG-002: Isolasi Data Lintas Unit
- Pengguna dengan hak akses pada satu unit (`user_unit_access`) **dilarang keras** membaca atau memanipulasi data dari unit lain.
- Pelanggaran akses lintas unit dihentikan di level PostgreSQL RLS, bukan hanya dengan menyembunyikan elemen antarmuka (*UI hiding*).
- Super Admin dan Admin Pusat memiliki akses lintas unit (`cross-unit scope`) dan dapat memilih unit aktif atau melihat komparasi metrik di Dashboard Pusat.

### BR-ORG-003: Perpindahan Konteks Unit (Unit Context Switching)
- Unit aktif saat ini harus selalu ditampilkan dengan jelas pada header navigasi utama.
- Saat staf berganti unit pada dropdown, sistem wajib:
  1. Mengosongkan memori formulir yang belum disimpan.
  2. Me-reset seluruh query cache TanStack Query yang berkorelasi dengan `unit_id` lama.
  3. Memuat ulang data master (bagian, jabatan, karyawan, kendaraan) untuk unit terpilih.
  4. Mencegah sisa data (*data bleed*) dari unit sebelumnya tertinggal di layar.

---

## 2. Aturan Master Data Karyawan & SDM

### BR-EMP-001: Identitas Unik & Stabil
- Setiap karyawan memiliki kode unik karyawan (`employee_code`), misalnya `KUK-LAT-002` atau `KUK-PAL-012`.
- `employee_id` (UUID) adalah *foreign key* permanen untuk seluruh transaksi (cuti, tip, presensi, pelanggaran, payroll).
- Dilarang membuat relasi transaksi berbasis nama teks bebas (*string matching*).

### BR-EMP-002: Siklus Status Karyawan
- Status yang diakui: `ACTIVE`, `INACTIVE`, `RESIGNED`, `RETIRED`.
- Karyawan tidak boleh dihapus secara permanen (`HARD DELETE`) dari database.
- Karyawan dengan status non-`ACTIVE` otomatis disaring keluar dari dropdown form publik (cuti, tip, pinjam kendaraan) dan briefing presensi harian.
- Penonaktifan karyawan tidak boleh merusak riwayat transaksi cuti masa lalu, catatan pelanggaran, log absensi, maupun slip gaji yang telah difinalisasi.

### BR-EMP-003: Riwayat Mutasi (Job & Department History)
- Jika seorang karyawan berpindah bagian/jabatan/unit:
  1. Rekam jejak baru dimasukkan ke `employee_job_history`.
  2. Kolom `department_id`, `position_id`, dan `unit_id` pada tabel `employees` diperbarui.
  3. Seluruh slip gaji masa lalu, arsip permohonan cuti, dan verifikasi tip lama **tetap mempertahankan snapshot bagian/jabatan saat transaksi terjadi**.

---

## 3. Aturan Modul Cuti Karyawan

### BR-CUTI-001: Kuota Maksimal Bulanan
- Setiap karyawan hanya berhak mengambil **maksimal 3 (tiga) hari cuti** dalam 1 (satu) bulan kalender yang dituju.
- Hari cuti dapat diambil secara berturut-turut atau terpisah dalam bulan yang sama.

### BR-CUTI-002: Jendela Waktu Pengajuan (Submission Window)
- Pengajuan cuti untuk bulan operasional $M$ hanya dibuka sejak **tanggal 1 pada bulan $M-1$** sampai dengan **tanggal 3 pada bulan $M$**.
- Contoh: Untuk cuti di bulan **Agustus 2026**, formulir pengajuan dibuka pada **1 Juli 2026 (00:00 WIB)** dan ditutup pada **3 Agustus 2026 (23:59 WIB)**.
- Di luar jendela waktu tersebut, formulir pengajuan menolak input baru secara otomatis di tingkat server/RPC, dan antarmuka beralih menampilkan matriks rekapan resmi yang telah disetujui.

### BR-CUTI-003: Aturan Anti-Bentrok Departemen (Same Department Conflict)
- Pada tanggal kalender yang sama di unit yang sama, **tidak boleh ada 2 (dua) karyawan dari bagian/departemen yang sama yang mengambil cuti**.
- Contoh: Jika Bagian `Kasir` telah memiliki 1 karyawan cuti pada tanggal 15 Agustus 2026, karyawan kasir lain yang mengajukan tanggal tersebut otomatis ditolak oleh sistem.

### BR-CUTI-004: Aturan Kelompok Bentrok Lintas Bagian (Conflict Groups)
- Sistem mendukung konfigurasi `leave_conflict_groups`. Jika dua departemen berada dalam kelompok bentrok yang sama (contoh: *Pimpinan Toko & Admin*, atau *Kepala Gudang & Pengiriman*), maka karyawan dari kedua bagian tersebut dilarang cuti pada tanggal yang sama.

### BR-CUTI-005: Aturan Spesifik Jabatan Admin 3 (CONFIRMED)
- Karyawan dengan posisi/jabatan **Admin 3** (diidentifikasi secara stabil melalui data master `positions.code = 'ADMIN_3'` dan konfigurasi `positions.allowed_leave_days_of_week = '{0}'`) **hanya diizinkan mengambil cuti pada hari Minggu**.
- Pengajuan cuti pada hari selain Minggu (Senin s/d Sabtu) **wajib ditolak secara mutlak** oleh database stored procedure `submit_leave_request_atomic()`. Penegakan aturan ini ditegakkan di level PostgreSQL engine, bukan hanya di frontend.

### BR-CUTI-006: Persetujuan Otomatis (Auto-Approval) & Transaksi Atomik
- Jika seluruh aturan BR-CUTI-001 s/d BR-CUTI-005 terpenuhi, pengajuan cuti berstatus langsung `APPROVED` tanpa menunggu persetujuan manual bertingkat.
- Proses validasi bentrok, pengecekan kuota, dan penguncian tanggal dilakukan dalam **1 transaksi PostgreSQL terkunci secara atomik** (`submit_leave_request_atomic`), memanfaatkan *advisory lock* dan *partial unique index* pada `leave_conflict_slots`. Hal ini mencegah *race condition* jika ada dua karyawan yang mengklik tombol ajukan pada milidetik yang sama.

### BR-CUTI-007: Kebijakan Pembatalan Cuti
- Pembatalan cuti yang telah berstatus `APPROVED` hanya dapat dilakukan oleh HRD/Admin Unit melalui portal internal, atau oleh karyawan melalui verifikasi PIN sebelum jendela pengajuan berakhir.
- Pembatalan melepaskan slot konflik pada `leave_conflict_slots` (`is_active = FALSE`), sehingga kuota 3 hari karyawan dan ketersediaan tanggal bagian tersebut kembali pulih seketika.

### BR-CUTI-008: Perlindungan Privasi & Keamanan Pengajuan Publik
- Portal pengajuan cuti publik mewajibkan input PIN rahasia karyawan (`auth_pin_hash`). Sistem tidak menyimpan PIN dalam bentuk *plaintext*.
- Kalender publik tidak menampilkan alasan pribadi, nomor telepon, atau data sensitif karyawan lain. Kalender hanya menampilkan ketersediaan slot tanggal secara anonim saat periode pengajuan berjalan, dan menampilkan nama karyawan pada jadwal kerja resmi setelah periode terkunci.

---

## 4. Aturan Modul Tip Pemotongan Kaca

### BR-TIP-001: Akses Publik & Input Parameter
- Form input tip kaca dapat diakses publik tanpa login staf, dengan parameter wajib:
  1. `unit_id` (Default TB KUK La Tansa).
  2. `employee_id` (Dipilih dari daftar karyawan aktif di unit bersangkutan).
  3. `glass_type_id` (Jenis kaca, misal: Bening 5mm, Ribben 5mm, Cermin 5mm).
  4. `length_cm` (Panjang dalam centimeter, > 0).
  5. `height_cm` (Tinggi dalam centimeter, > 0).
  6. `quantity` (Jumlah potongan, bilangan bulat positif >= 1).

### BR-TIP-002: Rumus Baku Tip 3% dari Harga Kaca (CONFIRMED)
$$\text{Luas (m}^2\text{)} = \frac{\text{Panjang (cm)} \times \text{Tinggi (cm)} \times \text{Jumlah Potongan}}{10.000}$$
$$\text{Harga Kaca (Glass Price)} = \text{Luas (m}^2\text{)} \times \text{Harga Jual per m}^2$$
$$\text{Nominal Tip} = \text{Harga Kaca} \times 0.03$$
- Besaran tip ditetapkan sebesar **3% (0.03) dari harga jual kaca yang valid**.
- Hasil perhitungan tip dibulatkan ke atas ke kelipatan Rp 1.000 terdekat (`ROUND_UP_1000`) secara konsisten.
- **Catatan Detail**: Penentuan apakah dasar harga menggunakan harga sebelum atau sesudah diskon/pajak (PPN) dicatat untuk konfirmasi lanjutan bagian Finance. Saat ini sistem mengacu pada harga jual acuan (*base selling price*).

### BR-TIP-003: Snapshot Immutability Transaksi Tip
- Setiap transaksi pemotongan kaca wajib membekukan:
  - `glass_price_snapshot` (Total harga kaca transaksi).
  - `tip_percentage_snapshot` (Persentase 0.0300).
  - `tip_amount` (Nominal tip hasil kalkulasi 3%).
- Perubahan harga jual kaca pada master data di kemudian hari **TIDAK AKAN PERNAH mengubah nominal transaksi tip masa lalu**.

### BR-TIP-004: Alur Verifikasi (4-Eyes Principle)
- Transaksi dari form publik berstatus awal `PENDING`.
- Tip kaca berstatus `PENDING` **wajib diverifikasi oleh Admin/Kepala Toko** menjadi `VERIFIED` sebelum dapat ditarik ke perhitungan payroll karyawan.
- Admin berwenang dapat menyetujui, merevisi nominal (`ADJUST`), atau menolak (`REJECT`) dengan mencantumkan alasan.
- Setiap pengajuan publik menghasilkan kode referensi unik (contoh: `TIP-LAT-202611-0089`) yang dapat dipantau statusnya oleh pemotong kaca.

---

## 5. Aturan Modul Pelanggaran & Poin Sanksi

### BR-VIO-001: Pencatatan Insiden & Kategori
- Setiap insiden pelanggaran mencatat: tanggal, karyawan bersangkutan, kategori pelanggaran (`violation_types`), poin penalti, deskripsi kejadian, bukti foto/dokumen, dan petugas pencatat (`recorded_by`).

### BR-VIO-002: Akumulasi Poin & Ambang Batas Surat Peringatan (SP)
- Poin pelanggaran memiliki masa berlaku sesuai konfigurasi (`point_validity_months`, default: 6 bulan).
- Poin aktif diakumulasi otomatis. Sistem memberikan *alert* rekomendasi SP ketika ambang tercapai:
  - $\ge 20$ poin $\rightarrow$ Rekomendasi **SP 1**.
  - $\ge 40$ poin $\rightarrow$ Rekomendasi **SP 2**.
  - $\ge 60$ poin $\rightarrow$ Rekomendasi **SP 3**.
  - $\ge 100$ poin $\rightarrow$ Rekomendasi **Evaluasi PHK**.
- Ambang batas dan nilai poin wajib dikonfigurasi oleh manajemen berwenang, tidak boleh di-hardcode.

### BR-VIO-003: Keputusan Formal & Penerbitan Surat Peringatan (PDF)
- Rekomendasi ambang batas **tidak melakukan PHK otomatis**. Pemutusan hubungan kerja atau penerbitan SP resmi tetap memerlukan persetujuan dan tanda tangan pejabat HRD/Pimpinan.
- Surat Peringatan resmi diterbitkan dalam format PDF standar dengan nomor surat berurut (contoh: `001/SP1/KUK-LAT/XI/2026`).

---

## 6. Aturan Modul Presensi & Fingerprint

### BR-ABS-001: Absensi Briefing Pagi
- Dicatat harian sebelum operasional unit dimulai (pukul 07:30 WIB).
- Status kehadiran: `PRESENT` (Hadir), `PERMIT` (Izin), `SICK` (Sakit), `LATE` (Terlambat), `ABSENT` (Alpa).
- Satu karyawan hanya boleh memiliki 1 catatan status pada sesi briefing tanggal tertentu.

### BR-ABS-002: Impor Log Fingerprint (CSV / Excel)
- Sistem menerima berkas log mentah dari mesin fisik sidik jari.
- Alur proses impor:
  1. Unggah berkas $\rightarrow$ Simpan batch di `fingerprint_import_batches`.
  2. Parse data mentah ke `fingerprint_raw_logs` secara utuh (*raw log preservation*).
  3. Pemetaan `device_enrollment_id` ke `employee_id` master.
  4. Deteksi duplikasi (timestamp dan ID yang sama diabaikan).
  5. Kalkulasi jam masuk (`clock_in`), jam pulang (`clock_out`), menit keterlambatan (`late_minutes`), dan lembur.
  6. Simpan hasil kalkulasi ke `attendance_daily_records`.
- Data mentah pada `fingerprint_raw_logs` **tidak boleh diubah atau dihapus** saat dilakukan koreksi manual. Koreksi status atau jam dilakukan melalui tabel `attendance_adjustments` dengan mencatat alasan dan identitas staf pengoreksi.

---

## 7. Aturan Modul Penggajian (Payroll Engine)

### BR-PAY-001: Struktur Komponen Gaji
- Penghasilan karyawan KUK terdiri atas:
  - **Gaji Pokok** (`base_salary`): Sesuai unit dan kontrak kerja resmi.
  - **Gaji Bagian** (`department_salary`): Tunjangan berbasis divisi/bagian operasional.
  - **Tunjangan Keluarga** (`family_allowance`): Diberikan bagi karyawan yang berstatus menikah.
  - **Insentif & Bonus**: Sesuai target performa atau kebijakan manajemen.
  - **Tip Pemotongan Kaca**: Diambil otomatis dari akumulasi transaksi `glass_tips` yang berstatus `VERIFIED` pada rentang tanggal periode payroll bersangkutan.
- Potongan karyawan terdiri atas:
  - **Potongan KSJ**: Potongan standar koperasi/sosial (default: Rp 50.000).
  - **Potongan Alpa / Keterlambatan**: Dihitung dari akumulasi menit keterlambatan atau hari tidak hadir pada modul presensi.
  - **Potongan Pinjaman / Kasbon**: Sesuai penyesuaian manual yang disetujui.

### BR-PAY-002: Rumus Perhitungan Gaji Bersih
$$\text{Total Penghasilan} = \sum(\text{Seluruh Komponen Pendapatan})$$
$$\text{Total Potongan} = \sum(\text{Seluruh Komponen Potongan})$$
$$\text{Gaji Bersih (Net Salary)} = \text{Total Penghasilan} - \text{Total Potongan}$$

### BR-PAY-003: Finalisasi & Kekekalan Data (Snapshot Immutability)
1. Periode payroll berstatus awal `DRAFT` atau `CALCULATED`.
2. Admin/Finance dapat melihat *preview*, menyesuaikan koreksi dengan persetujuan, dan memverifikasi rekapitulasi.
3. Saat status diubah menjadi `FINALIZED`:
   - Seluruh data slip gaji dibekukan ke dalam `payroll_records` dan `payroll_items`.
   - Snapshot nama karyawan, jabatan, bagian, dan nominal per item tersimpan secara permanen.
   - Tip kaca yang masuk ke slip gaji ditandai dengan `payroll_period_id` untuk mencegah pembayaran ganda pada periode berikutnya.
   - **Pembaruan master gaji karyawan atau tarif di kemudian hari TIDAK AKAN PERNAH mengubah data pada slip gaji yang telah difinalisasi**.
4. Pembatalan/revisi slip yang telah difinalisasi hanya dapat dilakukan oleh Super Admin melalui alur otorisasi khusus dengan rekaman audit log lengkap.
5. Menghasilkan Slip Gaji format PDF resmi yang siap dicetak atau diunduh oleh pihak berwenang.

---

## 8. Aturan Modul Armada Kendaraan

### BR-FLT-001: Peminjaman Publik Bebas Bentrok Jadwal
- Form peminjaman dapat diakses publik tanpa login staf.
- Validasi jadwal: Waktu mulai (`start_time`) dan perkiraan kembali (`estimated_return_time`) **tidak boleh bertabrakan** dengan peminjaman lain pada kendaraan yang sama yang telah berstatus `APPROVED` atau `IN_USE`.
- Pengecekan jadwal dieksekusi melalui database lock (`book_vehicle_atomic`).

### BR-FLT-002: Alur Persetujuan & Pemeriksaan Fisik (Check-Out & Check-In)
- Peminjaman berstatus awal `PENDING`. Petugas armada unit melakukan verifikasi dan menetapkan status `APPROVED` atau `REJECTED`.
- Saat kendaraan diambil: Petugas melakukan **Check-Out Inspection** (mencatat odometer awal, level BBM, kondisi kebersihan, dan foto fisik kendaraan). Status beralih ke `IN_USE`.
- Saat kendaraan kembali: Petugas melakukan **Check-In Inspection** (mencatat jam aktual kembali, odometer akhir, level BBM akhir, dan kondisi fisik). Status beralih ke `RETURNED`.

### BR-FLT-003: Penanganan Kerusakan & Kompensasi
- Jika ditemukan kerusakan baru saat Check-In:
  1. Petugas mencatat deskripsi kerusakan dan mengunggah foto bukti di `vehicle_damages`.
  2. Sistem **tidak boleh menetapkan nominal tanggungan kompensasi secara otomatis**.
  3. Nilai ganti rugi/kompensasi hanya dapat ditentukan setelah pemeriksaan resmi oleh Pimpinan/Manager Unit.
  4. Menghasilkan Surat Perjanjian Kompensasi Kerusakan dalam format PDF.

---

## 9. Aturan Audit, Log Aktivitas & Pelaporan

### BR-SYS-001: Pemisahan Mutlak Audit Log vs Activity Log
- `audit_logs`: Mencatat perubahan mutasi data entitas bisnis (tabel, ID record, nilai sebelum `old_data`, nilai sesudah `new_data`, aktor, dan timestamp). Bersifat *append-only* mutlak, tidak dapat dimodifikasi atau dihapus oleh siapapun.
- `activity_logs`: Mencatat riwayat navigasi dan interaksi pengguna (login, logout, pencarian global, ekspor laporan Excel, pengunduhan slip gaji).

### BR-SYS-002: Standar Ekspor Laporan
- Seluruh modul wajib menyediakan fitur ekspor Excel (`.xlsx`) yang secara presisi mengikuti filter yang sedang diterapkan di antarmuka (filter tanggal, unit, bagian, dan status).
- Nama berkas ekspor mengikuti standar baku: `[NAMA_LAPORAN]_[KODE_UNIT]_[PERIODE_YYYYMMDD].xlsx`.

