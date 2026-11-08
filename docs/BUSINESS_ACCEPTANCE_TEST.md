# PANDUAN & DOKUMEN PENGUJIAN PENERIMAAN PENGGUNA (UAT)
## KUK MANAGEMENT SYSTEM v3.1.0 — RELEASE CANDIDATE (RC)

**Target Sistem:** KUK Management System v3.1.0  
**Lokasi Penerapan:** TB KUK La Tansa & KUK Palen  
**Tujuan Dokumen:** Format pengujian formal untuk pengelola unit, kepala toko, kasir, supervisor, dan pimpinan untuk memvalidasi kelayakan operasional sistem sebelum dioperasikan secara penuh.

---

### PANDUAN PENTING BAGI PENGUJI

> [!IMPORTANT]
> **BATASAN PENGUJIAN & PERLINDUNGAN PRIVASI DATA:**
> 1. **Dilarang menggunakan data karyawan asli** (gunakan nama contoh/fiktif, misalnya: *Budi Santoso (Demo)*, *Ahmad Fulan*, *Siti Karyawan*).
> 2. **Dilarang menguji pada database Supabase Production langsung** (`ckzciuybedefbsdfsexh`). Pengujian dilakukan pada lingkungan lokal / staging demo terisolasi.
> 3. Dokumen ini disiapkan untuk diisi langsung oleh pengguna manusia secara fisik (dicetak) atau digital selama sesi UAT berlangsung.
> 4. Status fitur belum dianggap "LULUS" sebelum penguji memberikan tanda centang `PASS` dan mencantumkan catatan hasil pengujian faktual.

---

## 1. PETUNJUK PENGISIAN & DEFINISI KLASIFIKASI TEMUAN

### A. Kolom Hasil Pengujian
- **PASS**: Alur fungsi berjalan persis sesuai dengan skenario dan hasil yang diharapkan.
- **FAIL**: Alur fungsi gagal, data tidak tersimpan, terjadi galat tidak tertangani, atau aturan bisnis terlanggar.
- **NOT TESTED**: Skenario belum sempat diuji dalam sesi pengujian saat ini.

### B. Tingkat Keparahan Temuan (Defect Severity)
Jika ditemukan ketidaksesuaian saat pengujian, catat temuan pada **Formulir Pencatatan Temuan** menggunakan kategori berikut:
1. **Critical**: Sistem terhenti, data antar-unit bocor, transaksi uang/gaji salah hitung, atau data hilang/rusak tanpa pemulihan.
2. **Major**: Alur kerja operasional utama terhambat (misal: kasir tidak bisa verifikasi tip, cuti tidak bisa diajukan), tetapi tidak merusak data.
3. **Minor**: Ketidaksesuaian kecil pada tampilan, salah ketik teks label, posisi tombol kurang pas, namun fungsi tetap berjalan.
4. **Enhancement**: Usulan penyempurnaan kemudahan penggunaan (UI/UX) atau penambahan opsi baru untuk rilis berikutnya.

---

## 2. DATA PENGUJI & PERSIAPAN LINGKUNGAN UAT

| Data Administrasi UAT | Informasi Pengujian |
| :--- | :--- |
| **Tanggal Pengujian** | `____ / ________ / 2026` |
| **Unit Bisnis yang Diuji** | [ ] TB KUK La Tansa &nbsp;&nbsp;&nbsp;&nbsp; [ ] KUK Palen &nbsp;&nbsp;&nbsp;&nbsp; [ ] Pengujian Lintas Unit |
| **Nama Penguji (User)** | `________________________________________________` |
| **Peran / Jabatan Penguji** | [ ] Pimpinan / Owner &nbsp;&nbsp; [ ] Kepala Toko &nbsp;&nbsp; [ ] Kasir &nbsp;&nbsp; [ ] Supervisor &nbsp;&nbsp; [ ] Checker |
| **Perangkat yang Digunakan** | [ ] Laptop / PC Toko &nbsp;&nbsp; [ ] Tablet &nbsp;&nbsp; [ ] Smartphone Kiosk |
| **Browser yang Digunakan** | [ ] Google Chrome &nbsp;&nbsp; [ ] Microsoft Edge &nbsp;&nbsp; [ ] Mozilla Firefox &nbsp;&nbsp; [ ] Safari |

---

## 3. MATRIKS SKENARIO PENGUJIAN PENERIMAAN PENGGUNA (UAT)

---

### MODUL 0: OTENTIKASI, HAK AKSES RBAC, DAN ISOLASI DATA UNIT

Tujuan: Memastikan pemisahan mutlak data operasional antara La Tansa dan KUK Palen, serta pembatasan menu sesuai wewenang peran kerja.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-0.1** | **Isolasi Data Unit** | **Positif:** Pergantian Unit Aktif membatasi tampilan data | 1. Login sebagai Pimpinan.<br>2. Pada pemilih unit di pojok atas, pilih **TB KUK La Tansa**.<br>3. Buka menu Karyawan dan Cuti.<br>4. Ganti pemilih unit ke **KUK Palen**.<br>5. Buka kembali menu Karyawan dan Cuti. | Daftar karyawan dan cuti yang muncul di unit La Tansa **TIDAK MUNCUL** saat unit KUK Palen dipilih, dan sebaliknya. Data terisolasi 100%. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-0.2** | **Isolasi Data Unit** | **Negatif:** User unit lokal tidak boleh melihat unit lain | 1. Login sebagai Kepala Toko atau Kasir yang ditugaskan di **KUK Palen** saja.<br>2. Perhatikan dropdown pemilih unit. | Pengguna hanya melihat unit **KUK Palen**; opsi untuk memilih atau mengintip data La Tansa tidak tersedia. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-0.3** | **Hak Akses Peran** | **Positif:** Kasir memiliki menu transaksi & verifikasi | 1. Login menggunakan akun dengan peran **KASIR**.<br>2. Periksa menu bilah sisi (sidebar). | Menu Tip Potong Kaca dan Pengeluaran Kas dapat diakses. Menu penggajian (Payroll) atau pengaturan sistem tidak dapat diakses. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-0.4** | **Hak Akses Peran** | **Negatif:** Cutter dilarang mengakses menu sensitif | 1. Login sebagai staf **CUTTER**.<br>2. Coba akses menu Penggajian atau Data Sensitif Karyawan. | Menu tidak ditampilkan pada sidebar. Jika URL diketik langsung, sistem menampilkan pesan penolakan akses (Akses Ditolak). | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### MODUL 1: DASHBOARD & NAVIGASI OPERASIONAL

Tujuan: Memastikan ringkasan angka operasional ditampilkan akurat, status jaringan/loading ramah pengguna, dan pesan error jelas.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-1.1** | **KPI Ringkasan Operasional** | **Positif:** Menampilkan kartu ringkasan unit aktif | 1. Buka halaman utama Dashboard.<br>2. Perhatikan 6 kartu metrik: Karyawan Aktif, Presensi Hari Ini, Cuti Tertunda, Tip Belum Verifikasi, Armada Siap, Kas Keluar. | Kartu metrik menampilkan angka faktual sesuai unit yang dipilih tanpa kendala. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-1.2** | **Konteks Dashboard Pusat** | **Positif:** Pimpinan melihat ringkasan gabungan | 1. Login sebagai Pimpinan.<br>2. Pilih konteks **Semua Unit (Dashboard Pusat)**.<br>3. Periksa badge konteks di bagian atas. | Muncul label berwarna merah marun/emas: *"Konteks: Dashboard Pusat (Seluruh Unit)"* dan menyajikan agregat kedua toko. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-1.3** | **Indikator Loading & Error** | **Positif:** Tampilan loading halus saat memuat data | 1. Buka salah satu halaman menu (misal Presensi atau Pengeluaran).<br>2. Perhatikan transisi saat memuat data. | Muncul animasi pemuatan (spinner / teks memuat data) yang rapi, bukan layar putih kosong atau tampilan rusak. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### MODUL 2: MANAJEMEN KARYAWAN & PERLINDUNGAN DATA SENSITIF

Tujuan: Memvalidasi pengelolaan data pegawai, perlindungan data pribadi (NIK/Bank/BPJS), serta larangan penghapusan fisik.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-2.1** | **Tambah Karyawan Baru** | **Positif:** Mendaftarkan data profil karyawan contoh | 1. Buka menu **Karyawan**.<br>2. Klik tombol **Tambah Karyawan**.<br>3. Isi Nama: `Budi UAT`, NIK: `3201010101010001`, Departemen: `Potong Kaca`, Posisi: `Tukang Potong Kaca`.<br>4. Klik **Simpan Data**. | Karyawan baru tersimpan dan langsung muncul pada tabel daftar karyawan unit tersebut. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-2.2** | **Proteksi Data Sensitif** | **Positif:** Masking NIK dan nomor rekening bank | 1. Buka daftar karyawan.<br>2. Lihat kolom NIK dan informasi kontak karyawan biasa. | NIK ditampilkan dengan tanda sensor (contoh: `320101******0001`). Hanya pengguna dengan izin `employees.view_sensitive` yang dapat membuka modal detail. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-2.3** | **Anti-Penghapusan Fisik (Anti-Hard-Delete)** | **Negatif:** Sistem tidak mengizinkan penghapusan permanen riwayat karyawan | 1. Pilih karyawan yang sudah memiliki catatan kerja/gaji.<br>2. Periksa aksi yang tersedia.<br>3. Nonaktifkan karyawan via ubah status ke `INACTIVE` atau `RESIGNED`. | Tidak ada tombol untuk menghapus baris secara fisik dari database. Status berubah menjadi tidak aktif, histori kerja tetap utuh. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-2.4** | **Reset PIN Kiosk Mandiri** | **Positif:** Pembuatan PIN 6-digit baru untuk presensi/tip | 1. Klik ikon kunci pada baris karyawan `Budi UAT`.<br>2. Masukkan PIN baru: `123456`.<br>3. Klik **Reset PIN Karyawan**. | Sistem mengonfirmasi perubahan PIN berhasil. Format 6 digit tervalidasi. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### MODUL 3: PRESENSI & SESI BRIEFING PAGI

Tujuan: Memverifikasi pencatatan jam kerja sesuai zona waktu lokal (WIB), pencatatan briefing, dan jejak audit koreksi.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-3.1** | **Pencatatan Sesi Briefing** | **Positif:** Input briefing pagi operasional toko | 1. Buka menu **Presensi**.<br>2. Klik tombol **Catat Sesi Briefing**.<br>3. Masukkan Topik: `K3 Pengangkatan Kaca Lembaran`, Pembicara: `Kepala Toko`, Jumlah Hadir: `8`.<br>4. Klik **Simpan Sesi Briefing**. | Sesi briefing tersimpan, tampil pada riwayat sesi hari ini lengkap dengan tanggal dan identitas pemateri. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-3.2** | **Koreksi Presensi Manual** | **Positif:** Supervisor mengoreksi presensi karyawan lupa tap | 1. Buka tab **Presensi Harian**.<br>2. Klik aksi **Koreksi** pada salah satu baris karyawan.<br>3. Masukkan Jam Masuk: `08:00`, Jam Keluar: `17:00`, Status: `PRESENT`, Catatan: `Mesin fingerprint offline, diverifikasi hadir`.<br>4. Simpan. | Status jam kerja terbarui, dan alasan koreksi tercatat rapi pada audit log. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-3.3** | **Validasi Tanggal & Jam WIB** | **Positif:** Jam presensi menggunakan Waktu Indonesia Barat | 1. Periksa tanggal default dan jam saat membuka menu presensi. | Tanggal dan jam default otomatis menampilkan kalender WIB (Asia/Jakarta), bukan jam UTC internasional (tidak bergeser selisih 7 jam). | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### MODUL 4: PENGAJUAN & PENGELOLAAN CUTI KARYAWAN

Tujuan: Menguji kepatuhan batas kuota 3 hari cuti, jendela pengajuan resmi (tgl 1 s.d. 3), dan deteksi bentrok antar-rekan satu bagian.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-4.1** | **Batas Maksimal Kuota Cuti** | **Negatif:** Mengajukan lebih dari 3 hari dalam 1 bulan | 1. Buka menu **Cuti** &rarr; klik **Ajukan Cuti Baru**.<br>2. Pilih karyawan: `Budi UAT`.<br>3. Pilih 4 tanggal cuti dalam bulan yang sama.<br>4. Coba simpan formulir. | Sistem menampilkan peringatan penolakan: *"Maksimal cuti adalah 3 hari per bulan"*, dan formulir tidak dapat dikirim. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-4.2** | **Validasi Jendela Pengajuan** | **Negatif:** Mengajukan cuti di luar jendela tanggal 1-3 | 1. Klik **Ajukan Cuti Baru**.<br>2. Pilih tanggal cuti untuk bulan depan pada tanggal simulasi di luar tanggal 1 bulan lalu s.d. tanggal 3 bulan target cuti.<br>3. Simpan. | Sistem menolak pengajuan dengan keterangan bahwa jendela pengajuan cuti resmi belum dibuka atau telah ditutup. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-4.3** | **Deteksi Konflik Departemen** | **Positif:** Dua karyawan satu bagian mengajukan tanggal sama | 1. Karyawan A (Bagian Potong Kaca) telah disetujui cuti pada tanggal `15 Desember 2026`.<br>2. Ajukan cuti untuk Karyawan B (juga Bagian Potong Kaca) pada tanggal yang sama `15 Desember 2026`.<br>3. Kirim pengajuan. | Sistem **TIDAK** menyetujui otomatis. Pengajuan dialihkan ke status **PENDING (Ada Potensi Konflik)** agar dievaluasi manual oleh Kepala Toko. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-4.4** | **Persetujuan Cuti Kepala Toko** | **Positif:** Kepala toko menyetujui pengajuan pending | 1. Login sebagai Kepala Toko.<br>2. Buka daftar pengajuan cuti berstatus PENDING.<br>3. Klik tombol **Setujui Cuti**.<br>4. Konfirmasi. | Status pengajuan cuti berubah menjadi **APPROVED** dan kuota cuti karyawan berkurang sesuai tanggal cuti. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### MODUL 5: TIP POTONG KACA & VERIFIKASI KASIR

Tujuan: Menguji kalkulasi otomatis luas kaca ($m^2$), penerapan tarif, serta memastikan tip ditolak/pending tidak pernah masuk payroll.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-5.1** | **Kalkulasi Luas & Nominal Tip** | **Positif:** Menginput nota potong kaca standar | 1. Buka menu **Tip Potong Kaca**.<br>2. Pilih Jenis Kaca: `Bening 5mm`, Panjang: `100 cm`, Lebar: `200 cm` (Luas = 2.00 $m^2$), Jumlah: `2 lembar`.<br>3. Periksa perhitungan sistem. | Sistem menghitung luas total = 4.00 $m^2$. Nominal tip dihitung otomatis berdasarkan tarif per $m^2$ yang aktif. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-5.2** | **Penolakan Metode Belum Disahkan** | **Negatif:** Memilih metode perhitungan berstatus draft | 1. Buka formulir input nota tip.<br>2. Coba pilih metode kalkulasi yang berstatus draft (misal Size Range / Hybrid tanpa tarif resmi). | Sistem membatasi hanya metode resmi yang dapat disimpan; metode pending menghasilkan pesan penolakan yang informatif. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-5.3** | **Verifikasi Wajib oleh Kasir** | **Positif:** Kasir menyetujui nota yang valid | 1. Login sebagai Kasir.<br>2. Buka tab **Daftar Nota** &rarr; cari nota berstatus `PENDING`.<br>3. Klik **Verifikasi Nota** &rarr; periksa nominal &rarr; klik **Setujui & Verifikasi**. | Status nota berubah menjadi **VERIFIED** lengkap dengan nama kasir pemeriksa dan waktu verifikasi. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-5.4** | **Pengecualian Tip Ditolak dari Payroll** | **Negatif:** Nota ditolak Kasir dilarang masuk penggajian | 1. Kasir memilih nota cacat &rarr; klik **Tolak Nota** dengan alasan: `Ukuran nota tidak sesuai fisik kaca`.<br>2. Buka tab **Rekap Tip Payroll**.<br>3. Periksa apakah nota tersebut masuk ke rekap gaji tukang potong. | Nota berstatus `REJECTED` **SAMA SEKALI TIDAK MUNCUL** pada akumulasi tip payroll tukang potong kaca terkait. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### MODUL 6: PENGELOLAAN & PEMINJAMAN ARMADA

Tujuan: Memvalidasi pencegahan bentrok jadwal pinjam dan penguncian armada jika petugas menyatakan tidak layak jalan.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-6.1** | **Booking Armada Operasional** | **Positif:** Mengajukan peminjaman truk pengiriman | 1. Buka menu **Armada** &rarr; klik **Pinjam Armada**.<br>2. Pilih Truk Engkel La Tansa, Driver: `Pak Sopir (Demo)`.<br>3. Waktu Berangkat: Besok jam 08:00, Waktu Kembali: Besok jam 12:00.<br>4. Tujuan: `Pengiriman Kaca Proyek Anyer`.<br>5. Simpan. | Pengajuan peminjaman tersimpan dan masuk ke daftar tunggu persetujuan pengelola armada. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-6.2** | **Pencegahan Jadwal Bentrok** | **Negatif:** Booking kendaraan yang sama di jam yang sama | 1. Ajukan peminjaman kedua untuk Truk Engkel yang sama.<br>2. Masukkan rentang jam yang bertabrakan (contoh: Besok jam 10:00 s.d. 14:00).<br>3. Coba kirim. | Sistem menolak pengajuan dengan pesan bahwa kendaraan telah dipesan pada rentang jam tersebut (Exclusion overlap guard). | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-6.3** | **Pengembalian Layak Jalan (FIT)** | **Positif:** Petugas menyatakan kendaraan prima | 1. Pada daftar armada dipinjam, klik **Proses Kembali**.<br>2. Masukkan KM Akhir: `45200`, BBM: `Penuh`, Kebersihan: `5`.<br>3. Pada pilihan **Kelaikan Operasional Petugas**, pilih **FIT (Layak & Siap Beroperasi)**.<br>4. Simpan. | Status armada seketika kembali menjadi **AVAILABLE** dan langsung siap dipinjam untuk tugas berikutnya. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-6.4** | **Pengembalian Rusak / Servis (NEEDS_MAINTENANCE)** | **Negatif:** Petugas menyatakan tidak layak jalan | 1. Pada armada lain yang kembali, klik **Proses Kembali**.<br>2. Isi catatan: `Ban belakang sobek dan rem bunyi berdecit`.<br>3. Pada **Kelaikan Operasional Petugas**, pilih **NEEDS_MAINTENANCE (Perlu Servis / Perbaikan)**.<br>4. Simpan.<br>5. Coba lakukan peminjaman baru untuk kendaraan ini. | Status armada seketika berubah menjadi **MAINTENANCE**. Kendaraan **DIBLOKIR** dari daftar pilihan peminjaman baru demi keselamatan. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### MODUL 7: PELANGGARAN & SURAT PERINGATAN (SP)

Tujuan: Memverifikasi pencatatan poin pelanggaran dan memastikan penerbitan SP tidak memotong gaji secara otomatis.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-7.1** | **Catat Poin Pelanggaran** | **Positif:** Input insiden indisipliner staf | 1. Buka menu **Pelanggaran** &rarr; klik **Catat Pelanggaran**.<br>2. Pilih Karyawan: `Budi UAT`, Tanggal: Hari ini, Poin: `5`, Keterangan: `Tidak memakai kacamata pelindung saat potong kaca`.<br>3. Simpan. | Pelanggaran tercatat dalam riwayat kedisiplinan unit. Akumulasi poin bertambah secara transparan. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-7.2** | **Penerbitan Surat Peringatan (SP)** | **Positif:** Menerbitkan SP dengan masa berlaku referensi | 1. Klik tombol **Terbitkan Surat Peringatan (SP)**.<br>2. Pilih Karyawan, Tingkat: `SP 1`, Alasan: `Akumulasi kelalaian K3`.<br>3. Periksa catatan informasi masa berlaku pada modal formulir.<br>4. Simpan. | SP berhasil diterbitkan. Tercantum catatan jelas: *"Referensi Berlaku s.d. [Tanggal] (Draft 6 Bln - Tidak memicu potongan gaji otomatis)"*. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-7.3** | **Non-Pemotongan Upah Otomatis** | **Negatif:** Memastikan SP tidak mengurangi gaji tanpa dasar keputusan | 1. Buka menu **Payroll** untuk karyawan yang baru saja menerima SP.<br>2. Periksa rincian komponen gaji. | Tidak ada potongan denda SP misterius atau tidak sah pada slip gaji. Komponen gaji murni sesuai data riil. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### MODUL 8: PENGGAJIAN (PAYROLL) & CETAK SLIP GAJI

Tujuan: Menguji pembuatan draft gaji, integrasi tip potong kaca, penguncian status FINALIZED, dan imutabilitas slip gaji.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-8.1** | **Pembuatan Periode Gaji Baru** | **Positif:** Membuka periode gaji bulan berjalan | 1. Buka menu **Payroll** &rarr; klik **Buat Periode Penggajian**.<br>2. Masukkan Nama: `Gaji Desember 2026`, Rentang: `01/12/2026 s.d. 31/12/2026`, Tgl Bayar: `01/01/2027`.<br>3. Simpan. | Periode baru terbentuk dengan status **DRAFT**. Daftar karyawan unit otomatis dimuat ke lembar kerja. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-8.2** | **Penarikan Tip Potong Kaca** | **Positif:** Tip terverifikasi masuk ke rincian gaji cutter | 1. Periksa rincian gaji karyawan tukang potong kaca di periode DRAFT.<br>2. Lihat komponen `Tip Potong Kaca`. | Nominal tip terverifikasi dari modul potong kaca masuk secara presisi ke kolom pendapatan tambahan tukang potong. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-8.3** | **Finalisasi Periode Gaji** | **Positif:** Mengunci periode gaji yang telah disetujui | 1. Login sebagai Pimpinan / Kepala Toko.<br>2. Klik tombol **Finalisasi Periode Penggajian**.<br>3. Baca kotak dialog konfirmasi penguncian permanen &rarr; ketik konfirmasi &rarr; klik **Kunci Payroll**. | Status periode berubah menjadi **FINALIZED**. Seluruh angka terkunci dan tidak dapat diubah lagi oleh siapa pun. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-8.4** | **Imutabilitas Cetak Slip Gaji** | **Positif:** Mencetak slip gaji dari snapshot final | 1. Pada periode FINALIZED, klik tombol **Lihat Slip Gaji** pada salah satu staf.<br>2. Periksa rincian slip & klik tombol **Cetak / PDF**.<br>3. Lakukan simulasi perubahan master gaji di menu karyawan. Buka kembali slip gaji tadi. | Tampilan slip gaji rapi berformat cetak resmi KUK. Angka pada slip **TETAP SAMA** dengan saat difinalisasi (membaca snapshot permanen). | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### MODUL 9: PENGELUARAN KAS (PETTY CASH) & OTORISASI

Tujuan: Menguji pencatatan nota pengeluaran operasional dan memastikan dana kas tidak dapat dicairkan tanpa persetujuan manajerial.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-9.1** | **Pencatatan Kas Awal (Status PENDING)** | **Positif:** Kasir mencatat biaya operasional rutin | 1. Buka menu **Pengeluaran Kas** &rarr; klik **Catat Pengeluaran**.<br>2. Kategori: `OPERATIONAL`, Nominal: `Rp 150.000`, Penerima: `Toko Sebelah`, Keperluan: `Beli ATK nota & lakban packing`.<br>3. Simpan. | Pengeluaran tersimpan dengan status awal **PENDING**. Tidak ada auto-approval otomatis tanpa persetujuan berwenang. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-9.2** | **Pencatatan Kas Nominal Besar** | **Positif:** Pengeluaran besar tetap berstatus PENDING | 1. Klik **Catat Pengeluaran**.<br>2. Kategori: `MAINTENANCE`, Nominal: `Rp 2.500.000`, Keperluan: `Ganti ban truk pengiriman`.<br>3. Simpan. | Pengeluaran tercatat rapi dengan status **PENDING** menunggu persetujuan otorisasi pimpinan unit. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-9.3** | **Otorisasi Persetujuan Kepala Toko** | **Positif:** Pejabat berwenang menyetujui pengeluaran | 1. Login sebagai Kepala Toko / Pimpinan.<br>2. Pada baris pengeluaran kas PENDING, klik tombol **Setujui**.<br>3. Konfirmasi. | Status pengeluaran berubah menjadi **APPROVED** dan nominal diakui masuk ke rekap kas keluar unit. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-9.4** | **Penolakan Pengeluaran Tidak Sah** | **Negatif:** Menolak pengeluaran tanpa bukti/nota valid | 1. Pada pengeluaran yang meragukan, klik tombol **Tolak**.<br>2. Masukkan alasan penolakan: `Nota fisik tidak terlampir atau buram`.<br>3. Konfirmasi penolakan. | Status berubah menjadi **REJECTED**, alasan tercatat, dan dana kas tidak dicairkan. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### MODUL 10: PENGATURAN SISTEM & ADMINISTRASI AKUN

Tujuan: Memvalidasi pengelolaan akun pengguna, perubahan hak akses peran, serta perlindungan akun Super Admin.

| Kode UAT | Fungsi yang Diuji | Skenario Pengujian | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Catatan & Bukti |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-10.1** | **Ubah Hak Akses / Role Pengguna** | **Positif:** Mengubah penugasan peran staf | 1. Login sebagai Super Admin &rarr; buka menu **Pengaturan** &rarr; tab **Pengguna**.<br>2. Pilih salah satu akun contoh &rarr; klik **Ubah Role**.<br>3. Ganti peran dari `KASIR` menjadi `SUPERVISOR`.<br>4. Simpan. | Peran pengguna berhasil diperbarui. Pengguna mendapatkan hak akses baru saat sesi berikutnya. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-10.2** | **Proteksi Akun Super Admin Terakhir** | **Negatif:** Mencegah penurunan pangkat Super Admin terakhir | 1. Coba turunkan pangkat akun Super Admin satu-satunya menjadi peran biasa. | Sistem menolak aksi dengan peringatan: *"Akun Super Admin terakhir tidak boleh diturunkan atau dihapus demi keamanan sistem"*. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-10.3** | **Kontrol Mode Pratinjau (Preview Mode)** | **Positif:** Pimpinan dapat mengaktifkan demo simulasi | 1. Buka tab **Mode Pratinjau** di menu Pengaturan.<br>2. Periksa status sakelar demo.<br>3. Jika diaktifkan, amati banner simulasi pada aplikasi. | Jika aktif, sistem menampilkan banner: `[Mode Simulasi Aktif]`. Di lingkungan produksi asli, sakelar ini otomatis terkunci demi integritas data. | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

## 4. DAFTAR ATURAN BISNIS YANG MEMERLUKAN KEPUTUSAN RESMI PIMPINAN

Bagian ini memuat daftar kebijakan operasional yang saat ini telah **diamankan dari asumsi sepihak sistem**. Pimpinan KUK diminta memberikan keputusan formal untuk penetapan parameter final:

| No | Nama Kebijakan Operasional | Kondisi Implementasi RC Saat Ini | Pilihan Keputusan Pimpinan | Keputusan Final Disetujui | Paraf |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | **Ambang Batas Pengeluaran Kas (Petty Cash)** | Seluruh pengeluaran berstatus `PENDING` tanpa ada auto-approval otomatis. | [ ] Semua nominal wajib persetujuan pimpinan<br>[ ] Auto-approve s.d. Rp _________________<br>[ ] Kepala Toko berwenang s.d. Rp _________ | | |
| **2** | **Masa Berlaku Surat Peringatan (SP)** | Berlaku 6 bulan secara administratif tanpa sanksi potong gaji otomatis. | [ ] Tetap 6 bulan sesuai UU Ketenagakerjaan<br>[ ] Ditentukan per kasus oleh pimpinan<br>[ ] Lainnya: ___________________________ | | |
| **3** | **Keterlambatan Masuk Kerja** | Menit keterlambatan dicatat faktual tanpa pemotongan uang otomatis. | [ ] Toleransi _____ menit, denda Rp ________<br>[ ] Evaluasi kumulatif bulanan via SP<br>[ ] Potong tunjangan kehadiran proporsional | | |
| **4** | **Lembur & Insentif Kerja** | Jam lembur dicatat faktual, nominal upah diisi manual/disetujui. | [ ] Tarif lembur flat Rp ____________ / jam<br>[ ] Perhitungan standar Depnaker (1.5x / 2x)<br>[ ] Lainnya: ___________________________ | | |
| **5** | **Servis Berkala & Odometer Armada** | Nilai KM dicatat pada form kembali; status servis ditentukan petugas. | [ ] Servis rutin wajib setiap __________ KM<br>[ ] Servis berkala setiap _________ bulan<br>[ ] Berdasarkan rekomendasi montir bengkel | | |

---

## 5. FORMULIR PENCATATAN TEMUAN (DEFECT / ISSUE LOG)

Gunakan tabel di bawah ini jika penguji menemukan kendala atau kegagalan saat menjalankan skenario di atas:

| No | Kode Skenario UAT | Modul / Halaman | Deskripsi Masalah yang Ditemukan | Bukti (Screenshot / Pesan Error) | Tingkat Keparahan (Critical / Major / Minor / Enh.) | Status Penyelesaian | Paraf Penguji |
| :---: | :---: | :---: | :--- | :--- | :---: | :---: | :---: |
| 1 | | | | | | [ ] Open [ ] Resolved | |
| 2 | | | | | | [ ] Open [ ] Resolved | |
| 3 | | | | | | [ ] Open [ ] Resolved | |
| 4 | | | | | | [ ] Open [ ] Resolved | |
| 5 | | | | | | [ ] Open [ ] Resolved | |
| 6 | | | | | | [ ] Open [ ] Resolved | |

---

## 6. CHECKLIST PENERIMAAN AKHIR (SIGN-OFF GATE)

Sebelum sistem diizinkan masuk ke tahap deployment basis data dan rilis operasional penuh, seluruh kriteria verifikasi berikut wajib terpenuhi:

- [ ] **Data Terpisah Sempurna:** Seluruh data transaksi, karyawan, dan kas La Tansa tidak tercampur dengan KUK Palen.
- [ ] **Hak Akses Terkunci Rapi:** Staf kasir, tukang potong, dan pengemudi hanya dapat mengakses wewenangnya masing-masing.
- [ ] **Kepatuhan Cuti & Presensi:** Batas 3 hari cuti, jendela pengajuan tgl 1-3, dan kalender WIB berjalan sesuai kesepakatan.
- [ ] **Verifikasi Tip Terjamin:** Tidak ada tip potong kaca yang lolos ke rekap gaji tanpa tanda tangan verifikasi kasir.
- [ ] **Keselamatan Armada Terlindungi:** Peminjaman tidak bisa bentrok dan kendaraan rusak langsung diblokir ke status Maintenance.
- [ ] **Payroll & Slip Gaji Terkunci:** Periode gaji yang difinalisasi tidak dapat diedit ulang dan cetak slip konsisten.
- [ ] **Zero Critical & Zero Major Defect:** Tidak ada temuan berstatus Critical atau Major yang belum terselesaikan.

---

## 7. LEMBAR PENGESAHAN PENERIMAAN BISNIS (ACCEPTANCE SIGN-OFF)

Dengan menandatangani dokumen ini, para pihak menyatakan bahwa **KUK Management System v3.1.0 (Release Candidate)** telah diuji secara langsung melalui skenario UAT di atas, dan memberikan rekomendasi sebagai berikut:

*(Pilih salah satu)*
- [ ] **DITERIMA PENUH (ACCEPTED)** — Sistem siap dilanjutkan ke tahap deployment basis data dan rilis kerja.
- [ ] **DITERIMA DENGAN CATATAN (ACCEPTED WITH MINOR NOTES)** — Sistem diterima, perbaikan minor diselesaikan bertahap.
- [ ] **DITOLAK / DITUNDA (REJECTED / BLOCKED)** — Terdapat temuan Major/Critical yang wajib diperbaiki terlebih dahulu.

<br>

Ditetapkan dan ditandatangani pada tanggal: `____ / ____________ / 2026`

<br>

| Perwakilan TB KUK La Tansa | Perwakilan KUK Palen | Manajemen / Pimpinan KUK |
| :---: | :---: | :---: |
| <br><br><br><br>___________________________<br>**Kepala Toko La Tansa** | <br><br><br><br>___________________________<br>**Kepala Toko KUK Palen** | <br><br><br><br>___________________________<br>**Pimpinan / Direktur KUK** |

