# PANDUAN RINGKAS PERAN: SOPIR PENGIRIMAN (DRIVER)
## KUK MANAGEMENT SYSTEM v3.1.0

### Profil Peran
- **Nama Akun Demo**: Sopir Pengiriman (UAT Demo)
- **Email Login**: `driver.demo@kuk.test`
- **PIN Kiosk Mandiri**: `123456`
- **Cakupan Akses (Scope)**: **TB KUK La Tansa**
- **Wewenang**: Peminjaman kendaraan pengiriman di kiosk armada, pelaporan inspeksi kendaraan saat berangkat dan kembali.

---

### Prosedur Peminjaman Armada di Layar Kiosk Mandiri

#### 1. Membuka Layar Kiosk Armada
- Pada tablet atau layar sentuh area garasi/parkir armada, buka:
  ```text
  http://localhost:3000/kiosk/fleet
  ```

#### 2. Masukkan PIN Keamanan
- Masukkan **PIN 6-digit** Anda (misal: `123456`).
- Sistem memuat daftar armada toko yang berstatus **TERSEDIA (AVAILABLE)**.

#### 3. Melakukan Pemesanan (Booking Kendaraan)
- Pilih kendaraan yang akan digunakan (misal: Truk Colt Diesel atau Pikap L300).
- Masukkan **Tujuan Pengiriman** dan **Estimasi Jam Kembali**.
- Klik tombol **"Pesan Kendaraan"**.

#### 4. Pengisian Inspeksi Berangkat & Kembali
- **Saat Berangkat**: Catat angka kilometer (odometer) awal dan kondisi fisik bensin/ban.
- **Saat Selesai Pengantaran**:
  - Buka kembali kiosk armada $\rightarrow$ pilih tugas peminjaman aktif Anda.
  - Masukkan kilometer akhir.
  - Berikan tanda centang **Kondisi Kendaraan Baik (FIT)**, atau centang **Butuh Perbaikan Bengkel (NEEDS MAINTENANCE)** jika ada kendala mesin, rem, atau lampu.
  - Klik **"Selesaikan Peminjaman"**. Kunci diserahkan kembali ke gantungan kunci kantor.
