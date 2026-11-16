# BUKU PANDUAN PENGGUNA RESMI (USER MANUAL)
## KUK MANAGEMENT SYSTEM v3.1.0 — ENTERPRISE EDITION
### Sistem Manajemen Operasional Terpadu TB KUK La Tansa & KUK Palen

---

## DAFTAR ISI

- [BAB 1: Mengenal Sistem Manajemen KUK v3.1.0](#bab-1-mengenal-sistem-manajemen-kuk-v310)
- [BAB 2: Cara Mengakses Aplikasi & Prosedur Login](#bab-2-cara-mengakses-aplikasi--prosedur-login)
- [BAB 3: Navigasi Antarmuka & Dashboard Eksekutif](#bab-3-navigasi-antarmuka--dashboard-eksekutif)
- [BAB 4: Manajemen Master Data Karyawan](#bab-4-manajemen-master-data-karyawan)
- [BAB 5: Riwayat Karir & Mutasi Jabatan](#bab-5-riwayat-karir--mutasi-jabatan)
- [BAB 6: Presensi Harian, Rekap Bulanan & Impor Fingerprint](#bab-6-presensi-harian-rekap-bulanan--impor-fingerprint)
- [BAB 7: Pengelolaan Cuti & Kebijakan Kuota](#bab-7-pengelolaan-cuti--kebijakan-kuota)
- [BAB 8: Prosedur Reset & Pengelolaan PIN Kiosk](#bab-8-prosedur-reset--pengelolaan-pin-kiosk)
- [BAB 9: Penegakan Disiplin & Surat Peringatan (SP)](#bab-9-penegakan-disiplin--surat-peringatan-sp)
- [BAB 10: Insentif Potong Kaca & Verifikasi Kasir](#bab-10-insentif-potong-kaca--verifikasi-kasir)
- [BAB 11: Manajemen Armada & Peminjaman Kendaraan](#bab-11-manajemen-armada--peminjaman-kendaraan)
- [BAB 12: Penggajian Karyawan (Payroll) & Slip Gaji](#bab-12-penggajian-karyawan-payroll--slip-gaji)
- [BAB 13: Pengeluaran Kas Kecil (Cash Expense)](#bab-13-pengeluaran-kas-kecil-cash-expense)
- [BAB 14: Jejak Audit (Audit Trail) & Keamanan Data](#bab-14-jejak-audit-audit-trail--keamanan-data)
- [BAB 15: Konfigurasi Sistem & Master Data](#bab-15-konfigurasi-sistem--master-data)
- [BAB 16: Panduan Pemecahan Masalah (Troubleshooting)](#bab-16-panduan-pemecahan-masalah-troubleshooting)

---

## BAB 1: MENGENAL SISTEM MANAJEMEN KUK v3.1.0

### 1.1 Latar Belakang & Identitas Perusahaan
KUK Management System v3.1.0 adalah aplikasi berbasis web yang dirancang khusus untuk mendukung digitalisasi, standarisasi, dan otomatisasi tata kelola operasional pada dua unit usaha strategis:
1. **TB KUK La Tansa**: Toko bahan bangunan, konstruksi, dan sentra pemotongan kaca arsitektur.
2. **KUK Palen**: Toko kelontong, retail perlengkapan harian, dan barang komersial.

### 1.2 Filosofi Desain Resmi KUK
Sistem dibangun berdasarkan buku panduan resmi (*Official Rebranding Identity*) dengan standar palet warna:
- **KUK Crimson / Maroon Primer** (`#540000` / `#3B0000`): Melambangkan ketegasan, integritas, dan pondasi bisnis yang kokoh.
- **KUK Gold Accent** (`#FFCC00` / `#996414`): Melambangkan kemakmuran, presisi, dan keunggulan pelayanan.
- **Tipografi Resmi**: Menggunakan font tampilan *Revans* dan font pembacaan *Plus Jakarta Sans* untuk kemudahan membaca data tabel keuangan dan operasional.

---

## BAB 2: CARA MENGAKSES APLIKASI & PROSEDUR LOGIN

### 2.1 Persyaratan Perangkat & Browser
Aplikasi dapat diakses melalui komputer desktop, laptop, tablet, maupun layar kiosk toko dengan menggunakan peramban modern:
- Google Chrome (Direkomendasikan, versi 100+)
- Microsoft Edge
- Mozilla Firefox / Safari

### 2.2 Membuka Aplikasi
1. Buka peramban (browser) Anda.
2. Masukkan alamat URL lokal pengujian:
   ```text
   http://localhost:3000
   ```
3. Tekan **Enter**. Anda akan diarahkan ke Halaman Utama (Login / Landing Page).

### 2.3 Prosedur Masuk (Login)
Tersedia dua metode login:
* **Metode Pintasan Cepat (One-Click UAT)**: Pada kotak kuning emas di sebelah kanan form login, klik salah satu tombol peran (misalnya **"Pimpinan"**, **"HRD"**, **"Manager La Tansa"**, atau **"Kasir"**). Sistem akan mengautentikasi akun secara instan.
* **Metode Manual**: Ketik alamat email akun resmi (misal: `hrd.demo@kuk.test`) dan masukkan kata sandi Anda, lalu klik tombol merah **"Masuk ke Sistem"**.

### 2.4 Prosedur Keluar (Logout)
Untuk menjaga keamanan data:
1. Klik nama profil Anda di pojok kanan atas layar.
2. Pilih menu **"Keluar (Logout)"**.
3. Sistem akan menghapus sesi aktif dan mengembalikan Anda ke halaman login awal.

---

## BAB 3: NAVIGASI ANTARMUKA & DASHBOARD EKSEKUTIF

### 3.1 Struktur Navigasi (Sidebar)
Menu samping (Sidebar) kiri dirancang adaptif sesuai hak akses pengguna:
- **Navigasi Utama**: Dashboard, Karyawan, Presensi, Cuti, Tip Kaca, Armada, Pelanggaran/SP, Payroll, Keuangan Kas Kecil.
- **Navigasi Administratif**: Audit Trail, Pengaturan Master Data.
- **Peralihan Unit**: Di bagian atas layar terdapat pemilih unit (*Unit Switcher*) untuk berpindah antara *TB KUK La Tansa* dan *KUK Palen* (khusus bagi peran dengan cakupan ALL).

### 3.2 Komponen Dashboard Eksekutif
Dashboard menyajikan ringkasan indikator kinerja utama (*KPI Cards*):
- **Total Karyawan Aktif**: Jumlah personil terdaftar yang berstatus aktif.
- **Tingkat Kehadiran Hari Ini**: Persentase kehadiran berdasarkan data presensi harian.
- **Permohonan Cuti Menunggu Approval**: Jumlah pengajuan cuti yang memerlukan tindakan atasan.
- **Pengeluaran Kas Kecil Berjalan**: Akumulasi biaya operasional bulan berjalan.

---

## BAB 4: MANAJEMEN MASTER DATA KARYAWAN

### 4.1 Melihat & Menyaring Data Karyawan
1. Klik menu **"Karyawan"** pada sidebar.
2. Gunakan kolom pencarian untuk mencari berdasarkan **Nama** atau **NIK (Nomor Induk Karyawan)**.
3. Gunakan filter dropdown untuk menyaring berdasarkan **Unit Kerja** (*La Tansa / Palen*), **Departemen**, atau **Status Kepegawaian** (*Tetap / Kontrak / Harian*).

### 4.2 Menambahkan Karyawan Baru
1. Klik tombol **"+ Tambah Karyawan"** di sudut kanan atas.
2. Lengkapi formulir pendaftaran:
   - *Nama Lengkap*, *NIK*, *Email*, dan *Nomor Telepon/WhatsApp*.
   - *Unit Kerja Penempatan*, *Departemen*, dan *Jabatan*.
   - *Tanggal Masuk Kerja* dan *Besaran Gaji Pokok*.
3. Klik tombol **"Simpan Data"**.

### 4.3 Kebijakan Penonaktifan (*Soft-Deactivate*)
> [!IMPORTANT]
> **TIDAK ADA PENGHAPUSAN FISIK:**
> Sistem KUK tidak pernah menghapus data karyawan secara permanen (*Hard Delete*) agar tidak merusak rekam jejak historis penggajian, nota kasbon, dan slip gaji masa lalu.
> Untuk karyawan yang telah mengundurkan diri (resign) atau diberhentikan:
> 1. Buka profil karyawan bersangkutan.
> 2. Ubah status menjadi **"NON-AKTIF"** atau **"RESIGNED"**.
> 3. Karyawan tersebut otomatis tidak akan muncul pada daftar aktif presensi dan payroll bulan berikutnya.

---

## BAB 5: RIWAYAT KARIR & MUTASI JABATAN

Setiap perubahan jenjang jabatan karyawan dicatat secara sistematis:
1. Pada tabel karyawan, klik ikon **"Riwayat Jabatan"** pada baris karyawan.
2. Sistem menampilkan garis waktu (*Career Timeline*):
   - Tanggal efektif perubahan.
   - Jabatan lama $\rightarrow$ Jabatan baru.
   - Unit asal $\rightarrow$ Unit tujuan (jika terjadi mutasi antar unit La Tansa dan Palen).
   - Keterangan surat keputusan manajerial.
3. Riwayat ini bersifat permanen (*append-only*) sebagai dokumen pendukung promosi berkala.

---

## BAB 6: PRESENSI HARIAN, REKAP BULANAN & IMPOR FINGERPRINT

### 6.1 Status Presensi Harian
Sistem mencatat presensi dengan 5 kode baku:
- **HADIR (H)**: Masuk tepat waktu sesuai jadwal kerja.
- **TERLAMBAT (T)**: Masuk melebihi toleransi jam kerja (misal: > 15 menit).
- **IZIN (I)**: Tidak masuk dengan pemberitahuan resmi yang disetujui.
- **SAKIT (S)**: Tidak masuk dengan melampirkan surat keterangan dokter.
- **ALPHA (A)**: Tidak masuk kerja tanpa keterangan.

### 6.2 Presensi Briefing Pagi
Setiap pagi sebelum operasional toko dibuka, Supervisor/Kepala Toko membuka modul **"Presensi Briefing"** untuk mencatat kehadiran personil yang mengikuti arahan keselamatan kerja dan koordinasi harian.

### 6.3 Prosedur Impor Mesin Fingerprint
Untuk mempercepat rekapitulasi tanpa input manual satu per satu:
1. Buka modul **"Presensi"** $\rightarrow$ klik tombol **"Impor Fingerprint"**.
2. Pilih file hasil ekspor mesin absensi (format `.csv` atau `.dat`).
3. Sistem akan melakukan validasi format:
   - Mencocokkan NIK mesin dengan NIK database KUK.
   - Menghitung durasi jam kerja dan mendeteksi keterlambatan.
4. Klik **"Proses & Simpan Presensi"**. Baris yang bermasalah akan disorot warna merah untuk diperiksa manual.

---

## BAB 7: PENGELOLAAN CUTI & KEBIJAKAN KUOTA

### 7.1 Kebijakan Pokok Cuti (Business Rules)
1. **Aturan Maksimal 3 Hari**: Pengajuan cuti reguler dibatasi maksimal **3 hari berturut-turut** guna menjaga kesinambungan pelayanan toko. Cuti lebih dari 3 hari wajib mendapatkan persetujuan khusus Direksi.
2. **Jendela Pengajuan**: Formulir cuti wajib diajukan minimal **3 hari kerja sebelum tanggal pelaksanaan (H-3)**.
3. **Pencegahan Bentrok Satu Bagian**: Sistem akan secara otomatis menolak atau memperingatkan jika pada tanggal yang sama ada rekan kerja dalam satu departemen/unit yang telah disetujui cutinya.

### 7.2 Alur Persetujuan (Approval Workflow)
1. Karyawan/Kasir mengajukan form permohonan cuti.
2. **Kepala Toko (Manager Unit)** menerima notifikasi pengajuan untuk verifikasi awal.
3. **HRD** memverifikasi sisa kuota tahunan dan menerbitkan status **DISETUJUI (APPROVED)** atau **DITOLAK (REJECTED)** disertai alasan resmi.

---

## BAB 8: PROSEDUR RESET & PENGELOLAAN PIN KIOSK

Kiosk mandiri (Tip Kaca & Peminjaman Armada) diamankan dengan **PIN 6-Digit Angka**.

### 8.1 Standar Operasional Prosedur (SOP) Reset PIN
Jika seorang tukang potong kaca atau sopir lupa PIN kiosk:
1. Karyawan melapor langsung kepada **Kepala Toko** atau **HRD**.
2. Petugas melakukan verifikasi NIK dan nama karyawan pada modul data karyawan.
3. Buka jendela **"Kelola Akses Kiosk"** pada profil karyawan.
4. Masukkan PIN baru (wajib 6 angka, misal: `246810`).
5. Klik tombol **"Perbarui PIN"**. PIN langsung aktif dan dapat digunakan di layar kiosk.

---

## BAB 9: PENEGAKAN DISIPLIN & SURAT PERINGATAN (SP)

### 9.1 Tingkatan Surat Peringatan
Sistem mendukung penegakan disiplin berjenjang sesuai UU Ketenagakerjaan:
- **SP 1 (Peringatan Pertama)**: Diberikan untuk keterlambatan berulang atau kelalaian ringan.
- **SP 2 (Peringatan Kedua)**: Diberikan jika pelanggaran berulang dalam masa aktif SP1.
- **SP 3 (Peringatan Terakhir)**: Diberikan untuk pelanggaran berat atau pelanggaran lanjutan dari SP2.

### 9.2 Aturan Masa Berlaku 6 Bulan
Setiap SP yang diterbitkan memiliki **masa kedaluwarsa otomatis selama 6 bulan (180 hari)** kalender sejak tanggal penerbitan. Setelah lewat 6 bulan, status SP pada profil karyawan berubah menjadi non-aktif (*expired*).

### 9.3 Larangan Pemotongan Gaji Ilegal
> [!NOTE]
> Penerbitan SP murni sebagai instrumen pembinaan dan evaluasi disiplin. Sistem KUK **TIDAK MENGURANGI** gaji pokok karyawan akibat penerbitan SP, sesuai dengan ketentuan hukum ketenagakerjaan Republik Indonesia.

---

## BAB 10: INSENTIF POTONG KACA & VERIFIKASI KASIR

### 10.1 Rumus Baku Perhitungan Tip Kaca
Untuk mencegah selisih kas dan perselisihan perhitungan:
$$\text{Insentif Tip} = 3\% \times \text{Harga Dasar Kaca (Master Rate)}$$

> [!WARNING]
> - Tip dihitung murni dari harga material kaca berdasarkan jenis dan ketebalan (misal: *Kaca Polos 5mm*, *Kaca Riben 5mm*, *Kaca Tempered*).
> - **DILARANG** menghitung 3% dari total faktur nota yang menyertakan biaya antar, semen, atau perkakas lain.
> - **DILARANG** melakukan pembulatan sepihak ke Rp1.000 terdekat tanpa aturan master data.

### 10.2 Alur Klaim & Verifikasi
1. **Input di Kiosk Mandiri**: Tukang potong memasukkan nomor nota penjualan, memilih jenis kaca, dan memasukkan ukuran potong.
2. **Klaim Masuk**: Data muncul di modul Kasir dengan status `PENDING`.
3. **Verifikasi Kasir**: Kasir memeriksa fisik faktur dan fisik potongan kaca, lalu klik tombol **"Verifikasi & Setujui"**.
4. Akumulasi tip yang telah diverifikasi akan otomatis masuk sebagai komponen penambah insentif pada slip gaji bulanan karyawan bersangkutan.

---

## BAB 11: MANAJEMEN ARMADA & PEMINJAMAN KENDARAAN

### 11.1 Pemantauan Status Armada
Seluruh armada pengiriman (Truk Colt Diesel, Pikap L300, Sepeda Motor) dipantau kondisinya:
- **TERSEDIA (AVAILABLE)**: Siap digunakan untuk pengiriman barang.
- **DIGUNAKAN (IN USE)**: Sedang dalam perjalanan pengantaran order.
- **PERAWATAN (MAINTENANCE)**: Dalam perbaikan di bengkel atau servis berkala.

### 11.2 Peminjaman via Kiosk & Formulir
1. Sopir memasukkan PIN pada Kiosk Armada (`/kiosk/fleet`).
2. Memilih kendaraan yang tersedia dan memasukkan tujuan pengantaran serta estimasi jam kembali.
3. **Inspeksi Awal (Berangkat)**: Melaporkan kondisi odometer, bensin, dan kelayakan ban.
4. **Inspeksi Akhir (Kembali)**: Sopir mencatat kilometer akhir dan memastikan kendaraan dalam status **FIT** atau melaporkan kendala mesin jika butuh servis (**NEEDS MAINTENANCE**).

---

## BAB 12: PENGGAJIAN KARYAWAN (PAYROLL) & SLIP GAJI

### 12.1 Komponen Penghitungan Gaji
Setiap periode penggajian bulanan (tanggal 1 s/d akhir bulan) mengakumulasikan:
- **Penghasilan**: Gaji Pokok + Tunjangan Jabatan + Uang Makan/Hadir + Akumulasi Tip Kaca + Upah Lembur Resmi.
- **Potongan**: Iuran BPJS + Potongan Keterlambatan/Absen + Potongan Pelunasan Kasbon.
- **Gaji Bersih (Take Home Pay)** = Total Penghasilan - Total Potongan.

### 12.2 Status Draft vs Finalisasi Imutabel
1. **Status DRAFT**: Bagian Personalia/HRD dapat melakukan simulasi hitung, memeriksa presensi, dan menyesuaikan lembur.
2. **Status FINALIZED**: Hanya dapat dilakukan oleh **Pimpinan / Finance**. Begitu difinalisasi, seluruh angka terkunci (*immutable snapshot*) dan tidak dapat diubah lagi untuk menjamin akuntabilitas audit perpajakan dan perbankan.

### 12.3 Pencetakan Slip Gaji
Slip gaji dapat dicetak satu per satu atau serentak (*batch print*) dengan kop resmi PT KUK, lengkap dengan rincian penerimaan dan potongan.

---

## BAB 13: PENGELUARAN KAS KECIL (CASH EXPENSE)

### 13.1 Batasan & Kategori Kas Kecil
Pengeluaran harian toko yang dicatat mencakup:
- Biaya konsumsi lembur & air mineral galon.
- Bahan bakar minyak (BBM) darurat kendaraan toko.
- Perlengkapan kebersihan & perkakas habis pakai toko.

### 13.2 Alur Pengajuan & Persetujuan
1. Kasir/Staff mencatat pengeluaran, nominal, dan mengunggah foto kuitansi/nota belanja.
2. Pengeluaran otomatis berstatus `PENDING`.
3. Kepala Toko / Finance memeriksa kewajaran pengeluaran dan memberikan status `APPROVED` agar saldo kas kecil berkurang secara valid.

---

## BAB 14: JEJAK AUDIT (AUDIT TRAIL) & KEAMANAN DATA

Sistem KUK Management System menerapkan pengawasan ketat:
- Setiap penambahan karyawan, persetujuan cuti, pengubahan status kendaraan, hingga finalisasi payroll dicatat dalam **Buku Catatan Audit (Audit Trail)**.
- Catatan mencakup: *Waktu & Tanggal Kejadian*, *Nama Pengguna Pelaksana*, *Aksi/Operasi*, dan *Perubahan Nilai (Before vs After)*.
- Jejak audit tidak dapat disunting maupun dihapus oleh siapapun.

---

## BAB 15: PENGATURAN SISTEM & MASTER DATA

Modul Pengaturan (Settings) khusus dikelola oleh Administrator/Pimpinan:
- **Master Unit**: Alamat, nomor telepon, dan status operasional TB KUK La Tansa dan KUK Palen.
- **Master Tarif Kaca**: Daftar harga per meter persegi untuk tiap tipe dan ketebalan kaca sebagai dasar hitung tip 3%.
- **Master Departemen & Jabatan**: Struktur organisasi dan hak tunjangan jabatan.

---

## BAB 16: PANDUAN PEMECAHAN MASALAH (TROUBLESHOOTING)

| Gejala Kendala | Kemungkinan Penyebab | Langkah Penanganan Solutif |
|---|---|---|
| **Layar blank putih saat membuka aplikasi** | Server lokal belum aktif | Hubungi Admin TI untuk menjalankan `npm run dev` pada terminal lokal. |
| **Tidak bisa login / email salah** | Salah pengetikan atau salah huruf besar/kecil | Gunakan tombol **Pintasan Cepat UAT** di samping form login, atau pastikan format email persis `@kuk.test`. |
| **Gagal submit cuti (Tombol tidak merespon)** | Kuota melebihi 3 hari atau tanggal kurang dari H-3 | Periksa kembali rentang tanggal. Maksimal cuti adalah 3 hari kerja dan diajukan minimum 3 hari sebelumnya. |
| **Lupa PIN Kiosk Potong Kaca** | Karyawan lupa kombinasi 6 angka | Minta HRD atau Kepala Toko membuka menu Karyawan dan lakukan reset PIN pada jendela profil karyawan. |
| **Data yang diinput hilang setelah refresh** | Sesi browser ditutup / incognito | Pada mode pengujian (Demo UAT), data disimpan di `sessionStorage` browser lokal. Jangan gunakan tab samaran (*Incognito*) jika ingin mempertahankan data demo saat menguji. |

---

*Buku Panduan Pengguna KUK Management System v3.1.0 — Diterbitkan resmi untuk operasional internal TB KUK La Tansa & KUK Palen.*
