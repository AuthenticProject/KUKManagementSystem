# PANDUAN RINGKAS PERAN: KASIR TOKO
## KUK MANAGEMENT SYSTEM v3.1.0

### Profil Peran
- **Nama Akun Demo**: Kasir Utama (UAT Demo)
- **Email Login**: `kasir.demo@kuk.test`
- **Cakupan Akses (Scope)**: **TB KUK La Tansa**
- **Wewenang**: Verifikasi faktur tip potong kaca, pencatatan kas kecil toko, pelaporan transaksi harian toko.

---

### Alur Kerja Harian Kasir Toko

#### 1. Masuk ke Sistem (Login)
- Buka `http://localhost:3000`.
- Klik tombol **"Kasir"** pada panel Pintasan Akses Cepat Demo (UAT).

#### 2. Verifikasi Klaim Tip Potong Kaca
- Setiap kali tukang potong kaca menyelesaikan pemotongan kaca nota pelanggan:
  1. Tukang potong membawa nota fisik penjualan ke meja kasir.
  2. Buka menu **"Tip Potong Kaca"**.
  3. Cari nomor nota atau nama pemotong pada daftar klaim berstatus `PENDING`.
  4. Cocokkan nomor nota, tipe kaca, dan ukuran yang tertera di sistem dengan nota fisik.
  5. Jika data cocok, klik tombol hijau **"Verifikasi & Setujui"**.
  6. Berikan cap paraf pada nota fisik sebagai tanda klaim telah tervalidasi di sistem.

#### 3. Pencatatan Pengeluaran Kas Kecil
- Jika ada pengeluaran tunai darurat toko (misal: beli isi ulang galon, bensin darurat, materai):
  1. Buka menu **"Keuangan (Kas Kecil)"**.
  2. Klik tombol **"+ Catat Pengeluaran"**.
  3. Masukkan nominal uang, pilih kategori pengeluaran, dan tulis keterangan keperluan.
  4. Unggah foto nota/kuitansi pembelian sebagai bukti fisik.
  5. Klik **"Simpan"** (pengeluaran otomatis menunggu verifikasi Kepala Toko).
