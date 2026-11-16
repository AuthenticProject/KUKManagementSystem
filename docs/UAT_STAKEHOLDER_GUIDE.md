# PANDUAN PENGUJIAN PENERIMAAN BISNIS (UAT)
## KUK MANAGEMENT SYSTEM v3.1.0 — PANDUAN PRAKTIS STAF OPERASIONAL & PIMPINAN

Dokumen ini disusun khusus dalam bahasa praktis sehari-hari untuk memandu rekan-rekan staf toko, kasir, supir, tukang potong kaca, kepala toko, dan pimpinan dalam menguji aplikasi **KUK Management System v3.1.0** secara mandiri dan aman.

---

## 1. TUJUAN PENGUJIAN UAT

Tujuan dari pengujian ini adalah memastikan bahwa:
1. Tombol, menu, dan formulir kerja di komputer toko mudah digunakan dan tidak membingungkan.
2. Perhitungan tip potong kaca 3% dan pencatatan kas toko akurat dan sesuai kenyataan kerja.
3. Data toko TB KUK La Tansa dan KUK Palen tidak saling tercampur.
4. Hak akses terkunci dengan aman (misalnya: supir atau tukang potong tidak bisa melihat slip gaji orang lain).

> [!NOTE]
> **LINGKUNGAN SIMULASI AMAN (LOCAL DEMO MODE):**  
> Seluruh pengujian ini berjalan di komputer lokal (`http://localhost:3000`). Data yang Anda buat, ubah, atau simpan adalah data simulasi latihan dan **TIDAK AKAN** merusak atau mengubah data operasional toko yang sebenarnya. Anda bebas mencoba menu tanpa takut salah!

---

## 2. LANGKAH-LANGKAH MEMULAI PENGUJIAN

### Langkah 1: Buka Aplikasi di Komputer
1. Buka peramban (*browser*) favorit Anda (Google Chrome atau Microsoft Edge).
2. Ketik alamat: `http://localhost:3000` lalu tekan Enter.
3. Anda akan melihat halaman depan login **Portal Staf KUK Management System**.

---

### Langkah 2: Masuk Menggunakan Akun Demo Sesuai Tugas Anda
Di bagian bawah formulir login terdapat panel berwarna kuning keemasan bertuliskan **"Akses Cepat Pengujian Lokal (DEMO / UAT)"**.

Cukup klik tombol kartu peran yang sesuai dengan tugas pengujian Anda:

| Tombol Peran Demo | Jabatan / Fungsi | Wewenang Kerja yang Diuji |
| :--- | :--- | :--- |
| **Pimpinan Demo (UAT)** | Direksi / Pimpinan Pusat | Melihat ringkasan eksekutif seluruh unit bisnis (bisa ganti unit La Tansa dan Palen). |
| **HRD Demo (UAT)** | Personalia / HRD | Menambah karyawan, memproses permohonan cuti, mencatat absensi & surat peringatan. |
| **Manager La Tansa (UAT)** | Kepala Toko La Tansa | Menyetujui kas keluar, menyetujui pinjam mobil, dan mengunci gaji toko La Tansa. |
| **Manager Palen (UAT)** | Kepala Toko KUK Palen | Menyetujui kas keluar, menyetujui pinjam mobil, dan mengunci gaji toko KUK Palen. |
| **Finance Demo (UAT)** | Staf Keuangan Pusat | Memeriksa laporan kas, memverifikasi slip gaji, dan memeriksa rekapitulasi tip kaca. |
| **Kasir Demo (UAT)** | Kasir Toko | Memverifikasi fisik nota tip kaca dan mencatat uang keluar toko (*Petty Cash*). |
| **Driver Demo (UAT)** | Sopir / Pengemudi Armada | Mengajukan peminjaman armada mobil/truk dan memeriksa jadwal tugas pengiriman barang. |
| **Cutter Demo (UAT)** | Tukang Potong Kaca | Memeriksa akumulasi komisi tip potong kaca dan mencatat absensi harian toko. |

---

### Langkah 3: Memilih Toko / Unit Kerja
- Jika Anda masuk sebagai **Pimpinan**, **HRD**, atau **Finance**, Anda dapat memilih unit di pojok kanan atas layar:
  - Pilih **TB KUK La Tansa** untuk menguji data toko La Tansa.
  - Pilih **KUK Palen** untuk menguji data toko Palen.
- Jika Anda masuk sebagai **Kepala Toko**, **Kasir**, **Driver**, atau **Cutter**, unit kerja Anda otomatis terkunci pada toko Anda sendiri demi keamanan data.

---

### Langkah 4: Menjalankan Skenario Pengujian
Buka dokumen acuan [BUSINESS_ACCEPTANCE_TEST.md](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/BUSINESS_ACCEPTANCE_TEST.md) dan lakukan pengujian sesuai modul Anda:

1. **Untuk Kasir:**
   - Buka menu **Tip Potong Kaca** &rarr; klik tombol **Verifikasi** pada nota yang masuk &rarr; pastikan nominal tip kaca tepat 3% dari harga dasar &rarr; klik **Simpan Verifikasi**.
   - Buka menu **Kas Toko** &rarr; klik **Catat Pengeluaran Kas** &rarr; isi nota pembelian barang operasional (misal kertas struk kasir) &rarr; klik **Simpan**.
2. **Untuk Tukang Potong Kaca (Kiosk Mandiri):**
   - Buka rute `http://localhost:3000/public/glass-tip` di tab baru.
   - Masukkan NIP `EMP-LATANSA-001` dan PIN `123456`.
   - Masukkan ukuran kaca (panjang $\times$ tinggi $\times$ jumlah lembar) &rarr; amati kalkulasi komisi otomatis 3% &rarr; kirim nota dan catat nomor referensinya.
3. **Untuk Pengemudi / Sopir:**
   - Buka menu **Armada** &rarr; klik **Ajukan Pinjam Armada** &rarr; pilih mobil, isi tujuan pengantaran barang, dan jam berangkat/kembali &rarr; kirim permohonan.
4. **Untuk Kepala Toko & HRD:**
   - Periksa permohonan cuti staf & pastikan batas maksimal 3 hari per bulan dipatuhi sistem.
   - Setujui pengeluaran kas toko yang dicatat oleh kasir.
   - Buat sesi briefing pagi toko dan simpan notulanya.
   - Periksa slip gaji staf dan pastikan komisi tip kaca terverifikasi telah masuk otomatis.

---

### Langkah 5: Mencatat Hasil & Memberi Tanda Centang
Pada dokumen [BUSINESS_ACCEPTANCE_TEST.md](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/BUSINESS_ACCEPTANCE_TEST.md):
- Beri tanda centang `[X] PASS` jika menu berjalan lancar dan angka perhitungannya benar.
- Beri tanda centang `[X] FAIL` jika tombol tidak merespons, angka salah, atau muncul pesan kesalahan.
- Tuliskan catatan pada kolom **Hasil Aktual** jika Anda memiliki saran tampilan yang lebih nyaman.

---

## 3. APA YANG HARUS DILAKUKAN JIKA MENEMUKAN KENDALA?

Jika Anda menemukan tombol yang tidak bisa diklik atau perhitungan yang tidak sesuai:
1. **Jangan panik:** Data toko yang asli tetap aman 100%.
2. Ambil foto layar (*screenshot*) menggunakan tombol `Print Screen` di keyboard atau foto layar komputer menggunakan kamera ponsel Anda.
3. Catat di **Formulir Pencatatan Temuan (Bagian 4 Dokumen UAT)**:
   - Nama halaman / menu yang dibuka.
   - Tombol apa yang baru saja diklik.
   - Pesan apa yang muncul di layar.
4. Laporkan kepada Koordinator UAT atau tim IT untuk segera ditindaklanjuti.

---

## 4. CARA KELUAR DARI MODE DEMO
Jika Anda ingin berganti peran penguji (misalnya dari Kasir ingin mencoba peran Kepala Toko):
1. Klik tombol **Keluar Demo** yang berada di pojok kanan atas bilah navigasi.
2. Anda akan kembali ke halaman login dan dapat memilih peran demo yang lain.
