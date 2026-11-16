# PANDUAN RINGKAS PERAN: KEUANGAN & AKUNTANSI (FINANCE)
## KUK MANAGEMENT SYSTEM v3.1.0

### Profil Peran
- **Nama Akun Demo**: Staff Keuangan Pusat (UAT Demo)
- **Email Login**: `finance.demo@kuk.test`
- **Cakupan Akses (Scope)**: **SELURUH UNIT (TB KUK La Tansa & KUK Palen)**
- **Wewenang**: Pengendalian kas operasional toko, audit pencairan dana, rekonsiliasi klaim tip kaca, perhitungan dan finalisasi penggajian.

---

### Alur Kerja Operasional Bagian Keuangan

#### 1. Masuk ke Sistem (Login)
- Buka `http://localhost:3000`.
- Klik tombol **"Finance"** pada panel Pintasan Akses Cepat Demo (UAT).

#### 2. Audit & Pembukuan Kas Kecil Toko
- Buka menu **"Keuangan (Kas Kecil)"**.
- Tinjau seluruh daftar pengeluaran tunai dari unit TB KUK La Tansa dan KUK Palen.
- Periksa kelengkapan bukti transaksi/kuitansi digital.
- Lakukan persetujuan pencairan (*Disbursement Approval*) dan catat ke dalam buku pengeluaran kas.

#### 3. Rekonsiliasi Insentif Tip Potong Kaca
- Buka menu **"Tip Potong Kaca"**.
- Periksa daftar klaim yang telah diverifikasi oleh kasir toko.
- Pastikan formula hitung akurat: $3\% \times \text{Harga Dasar Kaca}$, tanpa penambahan biaya di luar material kaca.
- Konfirmasi total akumulasi tip untuk dimasukkan ke modul penggajian.

#### 4. Finalisasi Penggajian (Payroll Finalization)
- Buka menu **"Penggajian"**.
- Periksa angka gaji kotor, tunjangan, lembur, dan potongan kasbon karyawan.
- Setelah seluruh data seimbang, lakukan penguncian data (*Finalize Payroll Period*).
- Cetak rekapitulasi pembayaran gaji dan slip gaji untuk arsip akuntansi.
