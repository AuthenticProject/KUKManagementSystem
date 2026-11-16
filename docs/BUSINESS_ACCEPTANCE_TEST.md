# PANDUAN & DOKUMEN PENGUJIAN PENERIMAAN PENGGUNA (BUSINESS ACCEPTANCE TEST)
## KUK MANAGEMENT SYSTEM v3.1.0 — RELEASE CANDIDATE (RC)

**Target Sistem:** KUK Management System v3.1.0  
**Lokasi Penerapan:** TB KUK La Tansa & KUK Palen  
**Tujuan Dokumen:** Format pengujian formal terpadu untuk Direksi/Pimpinan, HRD, Kepala Toko (Admin Unit), Petugas Keuangan, Kasir, Pengemudi (Driver), dan Tukang Potong (Cutter) untuk memvalidasi kelayakan operasional sistem sebelum digunakan secara komersial.

---

### PANDUAN PENTING BAGI PENGUJI (TESTER GUIDELINES)

> [!IMPORTANT]
> **BATASAN PENGUJIAN & PERLINDUNGAN PRIVASI DATA:**
> 1. **Dilarang menggunakan data karyawan asli** (gunakan nama contoh fiktif yang telah disiapkan sistem, misalnya: *Budi Santoso (Demo)*, *Ahmad Subandi (Demo)*, *Siti Rahma (Demo)*).
> 2. **Dilarang menguji pada database Supabase Production langsung** (`ckzciuybedefbsdfsexh.supabase.co`). Seluruh pengujian UAT ini dijalankan pada lingkungan lokal terisolasi (*Zero-State Local Preview Mode*) pada alamat `http://localhost:3000`.
> 3. Dokumen ini disiapkan untuk diisi secara langsung oleh pengguna manusia secara fisik (dicetak) atau digital selama sesi UAT berlangsung.
> 4. Status fitur **TIDAK BOLEH** dianggap "LULUS" sebelum penguji memberikan tanda centang `[x] PASS`, mencantumkan hasil aktual, serta paraf penguji.

---

## 1. PETUNJUK PENGISIAN & KLASIFIKASI TEMUAN

### A. Kolom Status Pengujian
- `[ ] PASS`: Alur fungsi berjalan persis sesuai skenario dan hasil yang diharapkan.
- `[ ] FAIL`: Alur fungsi gagal, data tidak tersimpan, terjadi galat tidak tertangani, atau aturan bisnis terlanggar.
- `[ ] NOT TESTED`: Skenario belum sempat diuji dalam sesi pengujian saat ini.

### B. Tingkat Keparahan Temuan (Defect Severity)
Jika ditemukan ketidaksesuaian saat pengujian, catat temuan pada **Formulir Pencatatan Temuan (Bagian 4)** menggunakan klasifikasi berikut:
1. **Critical**: Sistem terhenti (*crash*), data antar-unit bocor, transaksi uang/gaji salah hitung, atau data hilang tanpa pemulihan.
2. **Major**: Alur kerja operasional utama terhambat (misal: kasir tidak bisa verifikasi tip, cuti tidak bisa disetujui), tetapi tidak merusak data lain.
3. **Minor**: Ketidaksesuaian kecil pada tampilan, salah ketik teks label, posisi tombol kurang pas, namun fungsi tetap berjalan.
4. **Enhancement**: Usulan penyempurnaan kemudahan penggunaan (UI/UX) atau penambahan opsi baru untuk rilis berikutnya.

---

## 2. LEMBAR DATA PENGUJI (TESTER PROFILE)

| Informasi Administrasi UAT | Data Isian Penguji |
| :--- | :--- |
| **Tanggal Pengujian** | `..... / ..... / 2026` |
| **Nama Lengkap Penguji** | ........................................................................ |
| **Jabatan / Peran Penguji** | [ ] Pimpinan / Direksi &nbsp;&nbsp; [ ] HRD & Personalia &nbsp;&nbsp; [ ] Kepala Toko (Admin Unit)<br>[ ] Petugas Keuangan &nbsp;&nbsp; [ ] Kasir Toko &nbsp;&nbsp; [ ] Driver / Supir &nbsp;&nbsp; [ ] Cutter / Pemotong |
| **Unit Kerja Penguji** | [ ] TB KUK La Tansa &nbsp;&nbsp;&nbsp;&nbsp; [ ] KUK Palen &nbsp;&nbsp;&nbsp;&nbsp; [ ] Kantor Pusat (Lintas Unit) |
| **Perangkat yang Digunakan** | [ ] Komputer Desktop (PC Toko) &nbsp;&nbsp; [ ] Laptop Kantor &nbsp;&nbsp; [ ] Tablet &nbsp;&nbsp; [ ] Smartphone |
| **Peramban (Browser)** | [ ] Google Chrome &nbsp;&nbsp; [ ] Microsoft Edge &nbsp;&nbsp; [ ] Mozilla Firefox &nbsp;&nbsp; [ ] Safari |

---

## 3. MATRIKS SKENARIO PENGUJIAN PENERIMAAN BISNIS (UAT SCENARIO MATRIX)

---

### A. MANAJEMEN KARYAWAN (EMPLOYEE MANAGEMENT)
**Tujuan:** Memvalidasi pengelolaan data pegawai, penambahan & pengubahan data, pencarian & filter, proteksi data sensitif, ekspor CSV, dan larangan penghapusan fisik (*anti-hard-delete*).

| Kode UAT | Peran Penguji | Prasyarat | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Catatan Penguji |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-EMP-01** | HRD / Kepala Toko | Login sebagai **HRD Demo** atau **Manager La Tansa** | 1. Buka menu **Karyawan** (`/employees`).<br>2. Periksa daftar karyawan yang tampil. | Daftar karyawan unit aktif tampil lengkap dengan NIP, Nama, Departemen, Posisi, dan Status aktif. NIK disensor secara aman (`320101******0001`). | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-EMP-02** | HRD / Kepala Toko | Berada di halaman `/employees` | 1. Klik tombol **Tambah Karyawan**.<br>2. Isi Nama: `Ahmad Syahroni (Demo)`, No. HP: `081299991111`, Departemen: `Potong Kaca`, Posisi: `Tukang Potong Kaca`.<br>3. Klik **Simpan**.<br>4. Cari karyawan tersebut, klik ikon edit (pensil).<br>5. Ubah nomor HP menjadi `081299992222` lalu simpan. | Karyawan baru berhasil tersimpan, langsung muncul di tabel unit aktif, dan pembaruan nomor HP terupdate secara instan. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-EMP-03** | HRD / Kepala Toko | Berada di halaman `/employees` | 1. Masukkan kata kunci nama pada kotak pencarian (contoh: `Budi`).<br>2. Pilih filter Departemen: `Kasir`.<br>3. Reset filter ke Semua. | Tabel memfilter data secara instan sesuai kata kunci dan departemen terpilih tanpa perlu me-reload halaman. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-EMP-04** | HRD / Kepala Toko | Berada di halaman `/employees` | 1. Klik tombol **Ekspor CSV**.<br>2. Buka berkas CSV yang terunduh menggunakan Microsoft Excel. | Berkas CSV terunduh dengan format UTF-8 BOM, nama file memuat kode unit dan tanggal, serta karakter Indonesia terbaca rapi di Excel tanpa kolom berantakan. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-EMP-05** | HRD / Kepala Toko | Berada di halaman `/employees` | 1. Pilih salah satu karyawan.<br>2. Klik tombol ubah status menjadi `INACTIVE` atau `RESIGNED`.<br>3. Periksa modal konfirmasi dan periksa tabel. | Muncul modal konfirmasi elegan (*ConfirmModal*, bukan browser alert mentah). Baris karyawan **TIDAK TERHAPUS FISIK** dari database; status berubah nonaktif dan riwayat kerja tetap tersimpan. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### B. PRESENSI & SESI BRIEFING (ATTENDANCE & BRIEFINGS)
**Tujuan:** Memvalidasi pencatatan jam kerja sesuai zona waktu WIB, pencatatan sesi briefing pagi operasional toko, dan tinjauan rekapitulasi bulanan.

| Kode UAT | Peran Penguji | Prasyarat | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Catatan Penguji |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-ATT-01** | Supervisor / Kepala Toko | Login sebagai **Supervisor Demo** atau **Manager La Tansa** | 1. Buka menu **Presensi** (`/attendance`).<br>2. Periksa tanggal default dan daftar absensi harian. | Kalender dan jam presensi menampilkan tanggal hari ini sesuai Waktu Indonesia Barat (WIB, Asia/Jakarta) tanpa pergeseran zona waktu internasional. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-ATT-02** | Supervisor / Kepala Toko | Berada di halaman `/attendance` | 1. Klik tombol **Sesi Briefing Baru**.<br>2. Masukkan Topik: `Briefing K3 Penanganan Kaca & Kerapian Kasir`.<br>3. Narasumber: `Kepala Toko`, Jumlah Hadir: `8`.<br>4. Klik **Simpan Briefing**. | Sesi briefing tersimpan, muncul di kartu sesi briefing hari ini lengkap dengan nama pemateri, jumlah peserta, dan timestamp waktu pencatatan. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-ATT-03** | Supervisor / Kepala Toko | Berada di halaman `/attendance` | 1. Buka tab **Rekap Bulanan**.<br>2. Periksa akumulasi Hadir, Terlambat, Izin, dan Cuti karyawan unit. | Ringkasan kehadiran bulanan terakumulasi secara akurat dan tombol **Ekspor CSV** mengunduh rekap presensi terformat UTF-8 BOM. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### C. PENGAJUAN & PENGELOLAAN CUTI (LEAVE MANAGEMENT)
**Tujuan:** Memvalidasi kepatuhan batas kuota maksimal 3 hari kerja per bulan, deteksi bentrok pengajuan antar-rekan satu departemen, dan alur persetujuan manajerial.

| Kode UAT | Peran Penguji | Prasyarat | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Catatan Penguji |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-LEV-01** | Karyawan / HRD / Manager | Login sebagai **HRD Demo** atau **Manager La Tansa** | 1. Buka menu **Cuti** (`/leave`).<br>2. Klik tombol **Ajukan Cuti Staf**.<br>3. Pilih karyawan, isi 1 atau 2 tanggal cuti, isi alasan: `Keperluan keluarga di kampung`.<br>4. Klik **Ajukan Permohonan Cuti**. | Permohonan cuti berhasil terdaftar dengan status awal **PENDING** dan kuota cuti staf tervalidasi. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-LEV-02** | HRD / Manager | Berada di modal ajukan cuti | 1. Coba pilih 4 tanggal cuti dalam bulan yang sama untuk karyawan yang sama.<br>2. Coba kirim formulir. | Sistem menolak pengajuan dengan pesan validasi tegas: *"Maksimal cuti adalah 3 hari per bulan (SOP KUK)"*. Formulir tidak dapat disimpan. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-LEV-03** | HRD / Manager | Karyawan A (bagian potong kaca) cuti tgl 20 | 1. Ajukan cuti untuk Karyawan B (juga bagian potong kaca) pada tanggal yang sama (tgl 20).<br>2. Kirim formulir cuti. | Sistem mendeteksi potensi bentrok staf satu departemen; pengajuan dialihkan ke status evaluasi khusus agar dievaluasi langsung oleh Kepala Toko. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-LEV-04** | Kepala Toko / Manager | Login sebagai **Manager La Tansa** | 1. Cari pengajuan cuti yang berstatus `PENDING`.<br>2. Klik tombol **Setujui Cuti**.<br>3. Konfirmasi persetujuan. | Status permohonan cuti berubah menjadi **APPROVED** lengkap dengan atribusi identitas manajer yang menyetujui. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### D. TIP POTONG KACA (GLASS TIPS & CASHIER VERIFICATION)
**Tujuan:** Memvalidasi pengajuan mandiri kiosk publik, validasi master tarif kaca, penerapan formula baku 3% eksak tanpa pembulatan Rp1.000, penolakan tipe kaca tanpa tarif master, verifikasi & penolakan nota oleh kasir, serta integrasi rekapan tip payroll.

| Kode UAT | Peran Penguji | Prasyarat | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Catatan Penguji |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-TIP-01** | Pemotong (Cutter) | Buka halaman Kiosk Publik mandiri (`/public/glass-tip`) | 1. Masukkan Kode Karyawan: `EMP-LATANSA-001`, PIN: `123456`.<br>2. Pilih Tipe Kaca: `Bening 5mm` (Tarif master Rp120.000/m²).<br>3. Masukkan Panjang: `150 cm`, Tinggi: `80 cm`, Jumlah: `2 lembar`.<br>4. Periksa estimasi angka yang muncul. | Luas kaca terhitung $2.40\text{ m}^2$. Nilai dasar kaca terhitung $2.40 \times Rp120.000 = Rp288.000$. Estimasi tip terhitung **tepat 3% = Rp8.640** (EKSAK, tanpa pembulatan Rp1.000 ke Rp9.000). | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-TIP-02** | Pemotong (Cutter) | Berada di halaman `/public/glass-tip` | 1. Klik tombol **Kirim Pengajuan Nota Potong Kaca**.<br>2. Amati layar konfirmasi tanda terima digital. | Muncul layar sukses dengan **Nomor Referensi Nota** (contoh: `TIP-0000-XXXXXX`), rincian dimensi, nilai jual, estimasi tip 3%, dan tanggal pengajuan. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-TIP-03** | Pemotong (Cutter) | Berada di halaman `/public/glass-tip` | 1. Pilih tipe kaca khusus yang belum memiliki konfigurasi tarif master aktif.<br>2. Amati indikator estimasi tip dan coba submit. | Sistem menampilkan peringatan *(Tipe kaca ini belum memiliki tarif master)*, estimasi tip menampilkan `-`, dan pengajuan ditolak demi integritas keuangan. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-TIP-04** | Kasir Toko | Login sebagai **Kasir Demo (UAT)** | 1. Buka menu **Tip Potong Kaca** (`/glass-tips`).<br>2. Periksa banner notice resmi di atas tabel.<br>3. Cari nota berstatus `PENDING` yang diajukan pemotong.<br>4. Klik tombol **Verifikasi**.<br>5. Periksa rincian fisik kaca, lalu klik **Simpan Verifikasi**. | Banner menampilkan formula resmi 3% tanpa pembulatan Rp1.000. Status nota berubah menjadi **VERIFIED** lengkap dengan nama kasir pemeriksa dan timestamp verifikasi. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-TIP-05** | Kasir Toko | Login sebagai **Kasir Demo (UAT)** | 1. Pilih nota yang tidak sesuai fisik kaca (misal ukuran salah).<br>2. Pada modal verifikasi, pilih Keputusan: `TOLAK`.<br>3. Masukkan alasan: `Ukuran fisik kaca tidak cocok dengan nota`.<br>4. Simpan keputusan. | Status nota berubah menjadi **REJECTED** dan alasan penolakan tersimpan jelas. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-TIP-06** | Kasir / Finance | Berada di halaman `/glass-tips` | 1. Buka tab **Rekap Tip Payroll**.<br>2. Periksa kolom akumulasi tip terverifikasi vs pending.<br>3. Pastikan nota yang berstatus `REJECTED` atau `PENDING` tidak masuk ke total siap payroll. | Total tip yang siap ditarik ke payroll **HANYA** menjumlahkan nota yang berstatus `VERIFIED`. Nota ditolak atau pending terisolasi 100%. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### E. OPERASIONAL & RESERVASI ARMADA (FLEET MANAGEMENT)
**Tujuan:** Memvalidasi pengajuan peminjaman armada, otorisasi persetujuan manajerial, pencegahan jadwal bentrok (*schedule overlap*), dan pemeriksaan kelaikan kendaraan saat kembali (*FIT* vs *NEEDS_MAINTENANCE*).

| Kode UAT | Peran Penguji | Prasyarat | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Catatan Penguji |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-FLT-01** | Driver / Kepala Toko | Login sebagai **Driver Demo** atau **Manager La Tansa** | 1. Buka menu **Armada** (`/fleet`).<br>2. Klik tombol **Ajukan Pinjam Armada**.<br>3. Pilih kendaraan: Suzuki Carry Pick-Up, Peminjam: `Pak Joko`, No HP: `081234567888`.<br>4. Waktu: Besok jam 08:00 s.d. 12:00, Tujuan: `Kirim material semen ke Anyer`.<br>5. Klik **Kirim Pengajuan**. | Pengajuan peminjaman tersimpan dan masuk ke daftar antrean reservasi unit aktif. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-FLT-02** | Driver / Kepala Toko | Berada di halaman `/fleet` | 1. Ajukan peminjaman kedua untuk Suzuki Carry Pick-Up yang sama.<br>2. Masukkan rentang jam yang bertabrakan (misal besok jam 10:00 s.d. 14:00).<br>3. Coba kirim formulir. | Sistem menolak pengajuan dengan peringatan bahwa jadwal kendaraan bentrok dengan reservasi yang telah ada. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-FLT-03** | Supervisor / Kepala Toko | Login sebagai **Manager La Tansa** | 1. Pada daftar armada yang dipinjam, klik **Proses Kembali**.<br>2. Masukkan KM Akhir, kondisi BBM, kebersihan.<br>3. Pada **Kelaikan Operasional Petugas**, pilih **FIT (Layak & Siap Beroperasi)**.<br>4. Simpan. | Status kendaraan kembali menjadi **AVAILABLE (Tersedia)** dan siap dipinjam untuk tugas berikutnya. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-FLT-04** | Supervisor / Kepala Toko | Berada di halaman `/fleet` | 1. Pada armada lain yang kembali, klik **Proses Kembali**.<br>2. Pada **Kelaikan Operasional Petugas**, pilih **NEEDS_MAINTENANCE (Perlu Servis / Rusak)**.<br>3. Simpan.<br>4. Coba ajukan peminjaman baru untuk mobil ini. | Status kendaraan berubah menjadi **MAINTENANCE (Dalam Perbaikan)** dan seketika **DIBLOKIR** dari daftar pilihan peminjaman baru demi keselamatan kerja. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### F. KEDISIPLINAN, PELANGGARAN & SURAT PERINGATAN (VIOLATIONS & SP)
**Tujuan:** Memvalidasi pencatatan poin pelanggaran, simulasi administratif SP berjangka 6 bulan bertanda draft, dan memastikan tidak ada pemotongan upah otomatis tanpa dasar kebijakan.

| Kode UAT | Peran Penguji | Prasyarat | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Catatan Penguji |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-VIO-01** | Supervisor / HRD | Login sebagai **HRD Demo** atau **Supervisor Demo** | 1. Buka menu **Pelanggaran** (`/violations`).<br>2. Klik tombol **Catat Pelanggaran**.<br>3. Pilih karyawan, Tanggal: Hari ini, Poin: `5`, Keterangan: `Tidak mengenakan kacamata pelindung saat potong kaca`.<br>4. Simpan. | Pelanggaran tercatat pada riwayat kedisiplinan dan poin pelanggaran karyawan bertambah secara transparan. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-VIO-02** | HRD / Kepala Toko | Login sebagai **HRD Demo** atau **Manager La Tansa** | 1. Klik tombol **Terbitkan Surat Peringatan (SP)**.<br>2. Pilih Karyawan, Tingkat: `SP 1`, Alasan: `Akumulasi pelanggaran K3`.<br>3. Periksa informasi masa berlaku dan simpan. | SP berhasil diterbitkan berlabel `DRAFT SIMULASI ADMINISTRATIF (Masa Berlaku 6 Bulan)` sesuai status kebijakan terbuka yang belum disahkan permanen. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-VIO-03** | HRD / Kepala Toko | Karyawan baru saja menerima SP | 1. Buka menu **Payroll** (`/payroll`).<br>2. Periksa rincian slip gaji karyawan yang menerima SP tersebut. | **TIDAK ADA** pemotongan gaji misterius atau denda otomatis akibat SP. Komponen pemotongan gaji tetap murni dan tidak ada pemotongan sepihak (`sp_deductions === 0`). | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### G. PENGGAJIAN & CETAK SLIP GAJI (PAYROLL & HISTORICAL PAYSLIPS)
**Tujuan:** Memvalidasi pembuatan periode gaji, integrasi tip kaca terverifikasi, finalisasi penguncian status FINALIZED, dan imutabilitas cetak slip gaji.

| Kode UAT | Peran Penguji | Prasyarat | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Catatan Penguji |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-PAY-01** | Finance / Kepala Toko | Login sebagai **Finance Demo** atau **Manager La Tansa** | 1. Buka menu **Payroll** (`/payroll`).<br>2. Periksa daftar periode penggajian yang ada. | Daftar periode penggajian unit tampil lengkap dengan nama periode, rentang tanggal, status (`DRAFT` / `FINALIZED`), dan total beban payroll. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-PAY-02** | Finance / Kepala Toko | Berada di halaman `/payroll` | 1. Buka salah satu slip gaji tukang potong kaca pada periode DRAFT.<br>2. Periksa komponen pendapatan `Tip Potong Kaca`. | Nominal tip potong kaca terverifikasi dari modul kaca ditarik secara presisi ke kolom penambah penghasilan tukang potong. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-PAY-03** | Kepala Toko / Pimpinan | Login sebagai **Manager La Tansa** | 1. Pada periode DRAFT yang sudah disetujui, klik **Finalisasi Penggajian**.<br>2. Baca modal konfirmasi in-app dan konfirmasikan. | Status periode gaji terkunci permanen menjadi **FINALIZED**. Angka slip gaji tidak dapat diubah lagi oleh siapa pun. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-PAY-04** | Finance / Pimpinan | Berada di periode FINALIZED | 1. Klik tombol **Lihat Slip Gaji** &rarr; klik **Cetak Slip Resmi**.<br>2. Lakukan simulasi perubahan data master gaji karyawan di menu Karyawan.<br>3. Buka kembali slip gaji periode FINALIZED tadi. | Slip gaji tercetak rapi dengan Kop Surat KUK. Angka pada slip **TETAP SAMA PERSIS** karena membaca data snapshot permanen yang kebal dari perubahan master data. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### H. KAS TOKO & OTORISASI PENGELUARAN (PETTY CASH MANAGEMENT)
**Tujuan:** Memvalidasi pencatatan kas keluar oleh kasir (status PENDING), otorisasi persetujuan oleh Kepala Toko, serta pencatatan alasan penolakan kas.

| Kode UAT | Peran Penguji | Prasyarat | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Catatan Penguji |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-FIN-01** | Kasir Toko | Login sebagai **Kasir Demo (UAT)** | 1. Buka menu **Kas Toko** (`/finance`).<br>2. Klik tombol **Catat Pengeluaran Kas**.<br>3. Penerima: `Toko ATK Makmur`, Nominal: `Rp 75.000`, Keperluan: `Beli 5 Roll Kertas Struk Kasir Thermal`.<br>4. Simpan formulir. | Pengeluaran kas tersimpan dengan status awal **PENDING**. Kasir tidak memiliki tombol "Setujui" sendiri (larangan otorisasi mandiri). | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-FIN-02** | Kepala Toko / Finance | Login sebagai **Manager La Tansa** atau **Finance Demo** | 1. Buka menu `/finance`.<br>2. Temukan pengeluaran kas `Toko ATK Makmur` berstatus PENDING.<br>3. Klik tombol **Setujui** &rarr; konfirmasi. | Status pengeluaran berubah menjadi **APPROVED** dan tercatat nama pejabat yang menyetujui. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-FIN-03** | Kepala Toko / Finance | Berada di menu `/finance` | 1. Pada transaksi kas yang tidak valid (misal tanpa nota fisik), klik tombol **Tolak**.<br>2. Masukkan alasan: `Nota fisik tidak terlampir atau buram`.<br>3. Konfirmasi penolakan. | Status berubah menjadi **REJECTED**, alasan penolakan tersimpan di sistem, dan dana kas tidak dicairkan. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

### I. ISOLASI UNIT & PEMBATASAN WEWENANG (UNIT ISOLATION & RBAC)
**Tujuan:** Memvalidasi pemisahan mutlak data antara TB KUK La Tansa dan KUK Palen serta penguncian antarmuka dashboard sesuai wewenang peran kerja.

| Kode UAT | Peran Penguji | Prasyarat | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Catatan Penguji |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-ISO-01** | Pimpinan / Direksi | Login sebagai **Pimpinan Demo (UAT)** | 1. Pada pemilih unit di header atas, pilih **TB KUK La Tansa**.<br>2. Buka menu Karyawan dan Armada.<br>3. Ganti pemilih unit ke **KUK Palen**.<br>4. Buka kembali menu Karyawan dan Armada. | Data karyawan dan armada La Tansa **TIDAK MUNCUL** di KUK Palen, dan sebaliknya. Terjadi pemisahan mutlak 100% (Zero Cross-Unit Leakage). | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-ISO-02** | Admin Unit / Manager | Login sebagai **Manager La Tansa** | 1. Periksa pemilih unit di header atas.<br>2. Coba beralih ke unit KUK Palen. | Dropdown terkunci hanya untuk **TB KUK La Tansa**; opsi untuk melihat atau memanipulasi unit KUK Palen tidak tersedia. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-ISO-03** | Kasir Toko | Login sebagai **Kasir Demo (UAT)** | 1. Buka halaman `/dashboard`.<br>2. Amati kartu-kartu statistik operasional yang muncul. | Kasir **HANYA** melihat kartu Kas Kecil (Petty Cash) dan Tip Kaca Pending. Kartu Karyawan, Payroll, Armada, dan SP disembunyikan total. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |
| **UAT-ISO-04** | Cutter / Driver | Login sebagai **Cutter Demo** atau **Driver Demo** | 1. Coba ketik rute sensitif di address bar peramban (contoh: `http://localhost:3000/payroll` atau `/settings`). | Akses seketika diblokir oleh Route Guard dengan banner resmi: *"Akses Ditolak: Anda tidak memiliki wewenang untuk membuka modul ini"*. | | [ ] PASS<br>[ ] FAIL<br>[ ] NOT TESTED | |

---

## 4. FORMULIR PENCATATAN TEMUAN (DEFECT / ISSUE LOGGING TEMPLATE)

Gunakan tabel di bawah ini untuk mencatat kendala, bug, atau ketidaksesuaian yang ditemukan selama pelaksanaan UAT:

| No | Kode Skenario | Modul / Halaman | Peran Penguji | Deskripsi Masalah yang Terjadi | Bukti (Screenshot / Pesan Error) | Tingkat Keparahan (Critical/Major/Minor) | Tindak Lanjut Tim Teknis | Paraf Penguji |
|:---:|:---:|:---:|:---:|:---|:---|:---:|:---|:---:|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | | | | | | | |

---

## 5. LEMBAR PENGESAHAN HASIL PENGUJIAN PENERIMAAN BISNIS (BUSINESS UAT SIGN-OFF)

Berdasarkan seluruh hasil pengujian yang telah dilaksanakan secara langsung oleh perwakilan staf operasional dan pimpinan unit pada lingkungan simulasi demo terisolasi:

### REKOMENDASI KELAYAKAN OPERASIONAL:
*(Beri tanda silang `[X]` pada salah satu pilihan)*

- [ ] **DITERIMA PENUH (ACCEPTED)** — Seluruh modul berfungsi dengan baik, tidak ada kendala Major/Critical, dan sistem dinyatakan siap untuk proses migrasi database produksi.
- [ ] **DITERIMA DENGAN CATATAN (CONDITIONALLY ACCEPTED)** — Sistem dapat diterima untuk operasional harian dengan perbaikan minor yang dicatat pada formulir temuan.
- [ ] **DITOLAK / DITUNDA (REJECTED)** — Ditemukan kendala berstatus Critical atau Major yang wajib diselesaikan terlebih dahulu sebelum deployment.

<br>

Ditetapkan dan ditandatangani di Cilegon pada tanggal: `..... / ..... / 2026`

<br><br>

| Perwakilan TB KUK La Tansa | Perwakilan KUK Palen | Manajemen Personalia & Keuangan | Direksi / Pimpinan CV KUK |
| :---: | :---: | :---: | :---: |
| <br><br><br><br><br>_________________________<br>**Kepala Toko La Tansa** | <br><br><br><br><br>_________________________<br>**Kepala Toko KUK Palen** | <br><br><br><br><br>_________________________<br>**HRD & Keuangan Pusat** | <br><br><br><br><br>_________________________<br>**Direktur / Pimpinan Pusat** |
