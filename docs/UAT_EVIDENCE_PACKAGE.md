# PAKET DOKUMENTASI BUKTI & PANDUAN PENDUKUNG UAT
## KUK MANAGEMENT SYSTEM v3.1.0 — ENTERPRISE UAT EVIDENCE PACKAGE

**Versi Sistem:** 3.1.0 (Release Candidate)  
**Target Unit:** TB KUK La Tansa & KUK Palen  
**Lingkungan:** Local Development Sandbox (`http://localhost:3000`)

---

## 1. LEMBAR REFERENSI IDENTITAS DEMO PENGUJIAN (DEMO ACCOUNT REFERENCE SHEET)

Berikut adalah daftar 9 identitas demo resmi yang telah disiapkan di dalam sistem untuk kebutuhan UAT bisnis internal tanpa menggunakan data karyawan riil:

| No | Peran / Jabatan Demo | Label Tombol Login | Profil Pengguna Fiktif | Email Simulasi | Lingkup Unit Kerja | Wewenang Akses Utama |
|:---:|:---|:---|:---|:---|:---|:---|
| 1 | **Pimpinan / Direksi** | `Pimpinan Demo (UAT)` | Bapak Pimpinan (UAT Demo) | `pimpinan.demo@kuk.test` | **ALL** (Lintas Unit: La Tansa & Palen) | Akses eksekutif penuh, pengawasan seluruh transaksi toko, ganti unit aktif, dan tinjauan audit trail. |
| 2 | **HRD & Personalia** | `HRD Demo (UAT)` | Ibu Personalia (UAT Demo) | `hrd.demo@kuk.test` | **ALL** (Lintas Unit: La Tansa & Palen) | Master karyawan, persetujuan cuti, pencatatan absensi & notula briefing, penegakan kedisiplinan & SP. |
| 3 | **Admin Unit La Tansa** | `Manager La Tansa (UAT)` | Kepala Toko La Tansa (UAT Demo) | `manager.latansa@kuk.test` | **TB KUK La Tansa** | Wewenang manajerial penuh unit La Tansa: otorisasi kas toko, persetujuan armada, dan finalisasi payroll toko. |
| 4 | **Admin Unit Palen** | `Manager Palen (UAT)` | Kepala Toko Palen (UAT Demo) | `manager.palen@kuk.test` | **KUK Palen** | Wewenang manajerial penuh unit Palen: otorisasi kas toko, persetujuan armada, dan finalisasi payroll toko. |
| 5 | **Finance & Keuangan** | `Finance Demo (UAT)` | Staff Keuangan Pusat (UAT Demo) | `finance.demo@kuk.test` | **ALL** (Lintas Unit: La Tansa & Palen) | Pemeriksaan kas kecil toko, otorisasi pengeluaran dana operasional, dan audit slip gaji staf. |
| 6 | **Supervisor Lapangan** | `Supervisor Demo (UAT)` | Supervisor Toko (UAT Demo) | `supervisor.demo@kuk.test` | **TB KUK La Tansa** | Pengawasan tim toko, pembuatan sesi briefing pagi K3, koreksi absensi manual, dan inspeksi armada kembali. |
| 7 | **Kasir Toko** | `Kasir Demo (UAT)` | Kasir Utama (UAT Demo) | `kasir.demo@kuk.test` | **TB KUK La Tansa** | Verifikasi fisik nota tip potong kaca, pencatatan pengeluaran kas operasional toko (*Petty Cash*). |
| 8 | **Tukang Potong Kaca** | `Cutter Demo (UAT)` | Tukang Potong Kaca (UAT Demo) | `cutter.demo@kuk.test` | **TB KUK La Tansa** | Pengajuan nota mandiri via kiosk publik, pemantauan status komisi tip kaca, dan presensi mandiri. |
| 9 | **Pengemudi Armada** | `Driver Demo (UAT)` | Sopir Pengiriman (UAT Demo) | `driver.demo@kuk.test` | **TB KUK La Tansa** | Pengajuan peminjaman armada, pemantauan surat jalan pengiriman, dan presensi harian supir. |

---

## 2. LEMBAR CHECKLIST SKENARIO PENGUJIAN (TEST SCENARIO CHECKLIST)

Gunakan lembar periksa cepat berikut selama sesi pengujian berlangsung:

| Modul | Kode Skenario | Deskripsi Skenario UAT | Peran Penguji | Status Pengujian |
|:---|:---:|:---|:---:|:---:|
| **A. Karyawan** | `UAT-EMP-01` | Membuka dan meninjau daftar profil karyawan aktif | HRD / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-EMP-02` | Menambah karyawan baru dan mengubah data profil | HRD / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-EMP-03` | Mencari data karyawan dan filter berdasarkan departemen | HRD / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-EMP-04` | Mengunduh berkas data karyawan berformat CSV UTF-8 BOM | HRD / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-EMP-05` | Menonaktifkan status karyawan tanpa penghapusan baris fisik | HRD / Manager | [ ] PASS &nbsp; [ ] FAIL |
| **B. Presensi** | `UAT-ATT-01` | Memeriksa kalender presensi harian sesuai zona waktu WIB | Supervisor / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-ATT-02` | Mencatat sesi briefing pagi toko (K3, pemateri, peserta) | Supervisor / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-ATT-03` | Memeriksa rekapitulasi absensi bulanan dan ekspor data | Supervisor / Manager | [ ] PASS &nbsp; [ ] FAIL |
| **C. Cuti** | `UAT-LEV-01` | Mengajukan permohonan cuti staf biasa (status PENDING) | HRD / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-LEV-02` | Validasi penolakan pengajuan cuti melebihi batas 3 hari/bulan | HRD / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-LEV-03` | Deteksi potensi bentrok cuti staf pada satu departemen | HRD / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-LEV-04` | Persetujuan manajerial permohonan cuti (status APPROVED) | Kepala Toko | [ ] PASS &nbsp; [ ] FAIL |
| **D. Tip Kaca** | `UAT-TIP-01` | Input nota kiosk mandiri & kalkulasi tepat 3% tanpa pembulatan | Pemotong (Cutter) | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-TIP-02` | Penerbitan nomor referensi nota digital tanda terima | Pemotong (Cutter) | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-TIP-03` | Penolakan pengajuan nota untuk tipe kaca tanpa master tarif | Pemotong (Cutter) | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-TIP-04` | Verifikasi fisik nota potongan kaca oleh kasir toko | Kasir Toko | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-TIP-05` | Penolakan nota cacat fisik oleh kasir disertai alasan | Kasir Toko | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-TIP-06` | Pengecualian nota pending/ditolak dari rekapan tip payroll | Kasir / Finance | [ ] PASS &nbsp; [ ] FAIL |
| **E. Armada** | `UAT-FLT-01` | Mengajukan peminjaman kendaraan operasional toko | Driver / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-FLT-02` | Pencegahan jadwal peminjaman bentrok pada armada sama | Driver / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-FLT-03` | Pemeriksaan kembali kendaraan prima (Status FIT) | Supervisor / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-FLT-04` | Penguncian armada rusak/servis (Status NEEDS_MAINTENANCE) | Supervisor / Manager | [ ] PASS &nbsp; [ ] FAIL |
| **F. Disiplin & SP** | `UAT-VIO-01` | Mencatat insiden pelanggaran kedisiplinan dan poin K3 | Supervisor / HRD | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-VIO-02` | Menerbitkan SP draft simulasi administratif masa 6 bulan | HRD / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-VIO-03` | Memverifikasi ketiadaan pemotongan upah otomatis akibat SP | HRD / Manager | [ ] PASS &nbsp; [ ] FAIL |
| **G. Payroll** | `UAT-PAY-01` | Membuka dan memeriksa lembar kerja periode penggajian | Finance / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-PAY-02` | Memeriksa integrasi tip kaca terverifikasi ke slip gaji | Finance / Manager | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-PAY-03` | Mengunci periode gaji secara permanen (Status FINALIZED) | Kepala Toko / Pimpinan | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-PAY-04` | Mencetak slip gaji resmi membaca snapshot data imutabel | Finance / Pimpinan | [ ] PASS &nbsp; [ ] FAIL |
| **H. Kas Toko** | `UAT-FIN-01` | Kasir mencatat kas keluar rutin (Status awal PENDING) | Kasir Toko | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-FIN-02` | Kepala Toko memeriksa dan menyetujui pengeluaran kas | Kepala Toko / Finance | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-FIN-03` | Menolak pengeluaran tidak sah disertai alasan penolakan | Kepala Toko / Finance | [ ] PASS &nbsp; [ ] FAIL |
| **I. Isolasi Unit** | `UAT-ISO-01` | Pemisahan mutlak data TB KUK La Tansa dan KUK Palen | Pimpinan / Direksi | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-ISO-02` | Penguncian wewenang unit lokal (tidak bisa akses unit lain)| Manager Unit | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-ISO-03` | Isolasi tampilan dashboard kasir (Karyawan & Payroll sembunyi)| Kasir Toko | [ ] PASS &nbsp; [ ] FAIL |
| | `UAT-ISO-04` | Penolakan tegas akses rute URL terlarang bagi peran staf | Cutter / Driver | [ ] PASS &nbsp; [ ] FAIL |

---

## 3. PANDUAN HASIL YANG DIHARAPKAN (EXPECTED RESULTS GUIDE)

Rubrik penentuan kriteria **LULUS (PASS)** versus **GAGAL (FAIL)** untuk penguji:

### 1. Modul Tip Potong Kaca:
- **Kriteria PASS:**
  - Formula perhitungan: $\text{Luas (m}^2\text{)} \times \text{Tarif Master per m}^2 \times 3\%$.
  - Hasil perhitungan nominal tip **tidak dibulatkan** ke atas kelipatan Rp1.000 (contoh: Rp8.640 tetap Rp8.640, bukan Rp9.000).
  - Jika tipe kaca tidak memiliki tarif master, sistem wajib menolak pengajuan.
  - Nota berstatus `PENDING` atau `REJECTED` tidak pernah boleh muncul di kolom total tip payroll tukang potong.
- **Kriteria FAIL:**
  - Terjadi pembulatan ke Rp1.000 terdekat tanpa instruksi.
  - Komisi dihitung dari total harga invoice belanja konsumen dan bukan dari harga dasar kaca.
  - Nota ditolak kasir tetap masuk menambah gaji tukang potong.

### 2. Modul Kas Toko (Petty Cash):
- **Kriteria PASS:**
  - Kasir mencatat uang keluar toko dengan status awal **PENDING**.
  - Kasir tidak memiliki tombol untuk menyetujui pengeluarannya sendiri.
  - Kepala Toko / Petugas Keuangan berwenang menekan "Setujui" (berubah `APPROVED`) atau "Tolak" (berubah `REJECTED`).
  - Alasan penolakan kas tersimpan dan dapat dibaca kembali.
- **Kriteria FAIL:**
  - Kasir dapat menyetujui pengeluarannya sendiri (*self-approval breach*).
  - Alasan penolakan kas hilang setelah modal ditutup.

### 3. Modul Cuti Karyawan:
- **Kriteria PASS:**
  - Pengajuan cuti dibatasi maksimal 3 hari kerja dalam satu bulan kalender.
  - Pengajuan 4 hari langsung ditolak sistem dengan pesan informatif.
  - Pengajuan staf satu bagian pada hari yang sama dialihkan ke status evaluasi khusus.
- **Kriteria FAIL:**
  - Sistem meloloskan cuti 4 hari atau lebih tanpa validasi.
  - Kuota cuti terpotong padahal pengajuan belum disetujui.

---

## 4. KATALOG BUKTI TANGKAPAN LAYAR (SCREENSHOT EVIDENCE CATALOG)

Berikut adalah berkas bukti tangkapan layar antarmuka pengguna yang telah direkam secara otomatis pada lingkungan pengujian live:

### A. Tampilan Antarmuka 12 Modul (Resolusi Desktop 1366x768 & Mobile 390x844)
1. **Dashboard Operasional:**
   - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/01_dashboard.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/01_dashboard.png)
2. **Master Data Karyawan:**
   - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/02_employees.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/02_employees.png)
3. **Presensi & Sesi Briefing:**
   - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/03_attendance.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/03_attendance.png)
4. **Pengajuan & Rekap Cuti:**
   - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/04_leave.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/04_leave.png)
5. **Tip Pemotongan Kaca:**
   - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/05_glass_tips.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/05_glass_tips.png)
6. **Armada & Kendaraan Operasional:**
   - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/06_fleet.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/06_fleet.png)
7. **Kedisiplinan & Surat Peringatan (SP):**
   - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/07_violations.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/07_violations.png)
8. **Penggajian / Payroll Staf:**
   - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/08_payroll.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/08_payroll.png)
9. **Kas Toko (Petty Cash):**
   - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/09_finance.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/09_finance.png)
10. **Pengaturan Sistem & Master Tarif:**
    - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/10_settings.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/10_settings.png)
11. **Jejak Audit & Mutasi Data:**
    - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/11_audit.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/11_audit.png)
12. **Kiosk Mandiri Nota Potong Kaca:**
    - [Desktop (1366x768)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/desktop/12_public_glass.png) &nbsp;|&nbsp; [Mobile (390x844)](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/mobile/12_public_glass.png)

### B. Tangkapan Layar Alur Kerja Terpadu (Workflows Walkthrough)
1. [Pembuatan Karyawan Baru](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/workflows/01_employee_created.png)
2. [Pencatatan Notula Briefing Pagi](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/workflows/02_briefing_session.png)
3. [Pengajuan Kiosk Nota Kaca 3%](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/workflows/03_glass_tip_public_submitted.png)
4. [Verifikasi Nota Fisik oleh Kasir](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/workflows/04_glass_tip_verified.png)
5. [Otorisasi Persetujuan Kas Toko oleh Manajer](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/workflows/05_petty_cash_approved.png)
6. [Reservasi Peminjaman Armada](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/workflows/06_fleet_booking_approved.png)
7. [Imutabilitas Slip Gaji Periode Finalized](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/workflows/07_payroll_immutability.png)
8. [Isolasi Dashboard Sesuai Wewenang Kasir](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/screenshots/final_acceptance/workflows/08_kasir_role_dashboard.png)

---

## 5. FORMAT PELAPORAN KENDALA / ISU (ISSUE REPORTING TEMPLATE)

Jika tester menemukan ketidaksesuaian saat menjalankan pengujian, salin format berikut untuk dilaporkan:

```markdown
### FORMULIR LAPORAN TEMUAN UAT (UAT DEFECT REPORT)

- **ID Temuan:** DEF-UAT-[Nomor Urut, contoh: DEF-UAT-01]
- **Kode Skenario Terkait:** [contoh: UAT-TIP-04]
- **Modul / Halaman:** [contoh: Tip Potong Kaca (/glass-tips)]
- **Peran Penguji yang Digunakan:** [contoh: Kasir Demo (UAT)]
- **Tanggal & Jam Pengujian:** [contoh: 15 November 2026, 14:30 WIB]
- **Tingkat Keparahan:** [ ] Critical   [ ] Major   [ ] Minor   [ ] Usulan
- **Langkah-Langkah Kejadian (Steps to Reproduce):**
  1. Masuk sebagai Kasir Demo (UAT).
  2. Membuka menu Tip Potong Kaca.
  3. Mengklik tombol Verifikasi pada nota TIP-001.
  4. Menekan tombol Simpan Verifikasi.
- **Hasil yang Diharapkan:** Nota berubah status menjadi VERIFIED.
- **Hasil Aktual yang Terjadi:** Status tidak berubah atau muncul pesan error.
- **Bukti Pendukung:** [Nama file tangkapan layar / teks pesan error]
- **Nama Penguji:** [Nama Lengkap Penguji]
```

---

## 6. LEMBAR REKAPITULASI & TANDA TANGAN BERITA ACARA UAT (UAT SUMMARY & SIGN-OFF SHEET)

Dokumen ini dicetak pada akhir pelaksanaan sesi pengujian UAT untuk disahkan oleh para pihak:

### BERITA ACARA UAT BISNIS KUK MANAGEMENT SYSTEM v3.1.0

Pada hari ini, ...................., tanggal ....... bulan .................... tahun 2026, telah diselesaikan pelaksanaan Pengujian Penerimaan Pengguna (*Business User Acceptance Testing*) terhadap sistem informasi manajemen operasional **KUK Management System v3.1.0** bertempat di kantor TB KUK La Tansa dan KUK Palen.

Berdasarkan hasil pengujian terhadap seluruh modul (Karyawan, Presensi, Cuti, Tip Kaca 3%, Armada, Disiplin & SP, Payroll, Kas Toko, dan Isolasi Unit):

### KESIMPULAN HASIL PENGUJIAN:
- Total Skenario Diuji: ............ Skenario
- Skenario LULUS (PASS): ............ Skenario
- Skenario GAGAL (FAIL): ............ Skenario
- Total Temuan Dicatat: ............ Temuan (*Critical*: ......, *Major*: ......, *Minor*: ......)

### KEPUTUSAN BERSAMA:
*(Beri tanda silang pada salah satu opsi)*
- [ ] **SISTEM DITERIMA (ACCEPTED)** — Siap untuk dilanjutkan ke proses migrasi database produksi dan pelatihan staf.
- [ ] **SISTEM DITERIMA DENGAN SYARAT (CONDITIONALLY ACCEPTED)** — Siap digunakan dengan penyelesaian catatan minor terlampir.
- [ ] **SISTEM BELUM DAPAT DITERIMA (NOT ACCEPTED)** — Masih memerlukan perbaikan sebelum dapat dioperasikan.

<br><br>

| Kepala Toko TB KUK La Tansa | Kepala Toko KUK Palen | Tim Personalia & Keuangan | Direksi / Pimpinan Utama |
|:---:|:---:|:---:|:---:|
| <br><br><br><br><br>( .................................... )<br>Tanggal: ......................... | <br><br><br><br><br>( .................................... )<br>Tanggal: ......................... | <br><br><br><br><br>( .................................... )<br>Tanggal: ......................... | <br><br><br><br><br>( .................................... )<br>Tanggal: ......................... |
