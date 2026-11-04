# DATA MIGRATION PLAN & LEGACY AUDIT
## KUK Management System · V2 to V3 Enterprise Transition
**Versi:** 3.0.0  
**Tanggal:** 2026-11-04  
**Status:** Migration Baseline / Phase 0 Final  

---

## 1. Audit Sistem Lama (Legacy System Audit)

Berdasarkan audit terbatas terhadap direktori `08. KUK V2` dan repositori sebelumnya tanpa melakukan perubahan apapun pada berkas lama, sistem eksisting memiliki karakteristik:

### 1.1 Temuan Arsitektur & Penyimpanan Data Lama
- **Antarmuka**: Berbasis berkas HTML statis terpisah-pisah (`absen.html`, `cuti.html`, `karyawan.html`, `payroll_dashboard.html`, `peminjaman.html`, `pelanggaran.html`, `tip.html`) yang dihubungkan oleh script navigation bar vanilla (`shared/shell.js`).
- **Database Penyimpanan**: Berorientasi pada peramban klien lokal (*Client LocalStorage*) melalui `shared/master_db.js` dan `karyawan_db.js` dengan kunci penyimpanan:
  - `kuk_db_rekrutmen_v1`
  - `kuk_db_rekontrak_v2`
  - `kuk_db_gaji_v2`
  - `kuk_db_surat_v2`
  - `kuk_violations_db`
- **Sinkronisasi Cloud**: Menggunakan Google Apps Script (`apps-script-absen.js`, `apps-script-peminjaman.js`, `Cuti KUK/code.gs`) yang mengalirkan data ke Google Sheets dan Google Drive.
- **Kelemahan Kritis Sistem Lama**:
  1. *Data Silo*: Jika pengguna membuka web di peramban atau perangkat berbeda, data lokal tidak sinkron.
  2. *Keamanan Rapuh*: Validasi hanya berjalan di sisi klien; siapapun dapat mengedit `localStorage` atau mengubah nominal uang tip dan gaji.
  3. *Race Condition*: Pengajuan cuti bersamaan dapat meloloskan bentrok jadwal karena tidak adanya *database lock*.
  4. *Pencampuran Unit*: Pemisahan unit hanya mengandalkan filter string JavaScript (`toko: 'bangunan'` vs `toko: 'palen'`), rentan bocor ke pengguna yang tidak berhak.

---

## 2. Kategorisasi Fitur: KEEP, IMPROVE, REBUILD, MIGRATE

| Kategori | Fitur / Komponen | Tindakan & Alasan Teknis |
|---|---|---|
| **KEEP** | Rumus Luas Kaca | Rumus $\frac{P \times T \times \text{Qty}}{10.000}$ terbukti akurat dan dipahami staf; dipertahankan sebagai formula baku modul tip. |
| **KEEP** | Aturan Cuti 3 Hari & Jendela Waktu | Kuota 3 hari/bulan dan jendela pengajuan (tgl 1 bulan M-1 s/d tgl 3 bulan M) adalah SOP baku organisasi KUK. |
| **KEEP** | Roster 11 Karyawan Resmi | Daftar 11 karyawan aktif beserta jabatan dan gaji bagian adalah data riil yang menjadi aset utama organisasi. |
| **IMPROVE** | Skema Warna & UI KUK | Mengangkat palet warna Marun (`#6B1D2F` / `#540000`) dan Emas (`#D4AF37`) ke dalam Tailwind Design Tokens modern yang responsif di seluruh perangkat. |
| **IMPROVE** | Slip Gaji & Surat Peringatan PDF | Menggantikan HTML2Canvas yang rentan pecah resolusi dengan generator PDF presisi berbasis vektor. |
| **IMPROVE** | Verifikasi Tip Kaca | Menambahkan alur *4-Eyes Principle* (staf input $\rightarrow$ admin verifikasi $\rightarrow$ otomatis ditarik ke payroll) yang sebelumnya tidak memiliki filter approval. |
| **REBUILD** | Seluruh Lapisan Backend & DB | Menggantikan kombinasi LocalStorage + Google Apps Script dengan Supabase PostgreSQL, RLS multi-unit, dan atomic RPCs. |
| **REBUILD** | Autentikasi & RBAC | Menggantikan pengecekan session manual di JavaScript dengan Supabase Auth JWT, bcrypt PIN hash, dan tabel permissions granular. |
| **REBUILD** | Engine Presensi & Fingerprint | Membangun parser log mesin fisik dengan penyimpanan *raw logs* dan pemetaan ID mesin yang tervalidasi. |
| **MIGRATE** | Master Karyawan & Kontrak | Mengekstrak 11 karyawan aktif dari `karyawan_db.js` ke tabel `employees`, `employee_salary_structures`, dan `positions`. |
| **MIGRATE** | Histori Slip Gaji Juni 2026 | Memindahkan 11 arsip penggajian Juni 2026 ke tabel `payroll_records` dan `payroll_items` sebagai data historis awal. |
| **MIGRATE** | Master Armada Kendaraan | Memindahkan armada (Mobil Truk Engkel, Mitsubishi L300, Motor) ke tabel `vehicles`. |

---

## 3. Identifikasi Data Bernilai Tinggi untuk Migrasi

Dari berkas `08. KUK V2/karyawan_db.js`, teridentifikasi 11 data karyawan resmi yang wajib dimigrasikan ke skema baru:

### 3.1 Unit TB KUK La Tansa (`TB-LATANSA`)
1. **Wiba Sepdioko** (`K-002`) — Jabatan: *Admin 2*, Bagian: *Admin*, Gaji Pokok: Rp 850.000, Gaji Bagian: Rp 500.000, Menikah.
2. **Irfan Ulinnuha** (`K-003`) — Jabatan: *Kepala Toko*, Bagian: *Pimpinan*, Gaji Pokok: Rp 850.000, Gaji Bagian: Rp 650.000, Menikah.
3. **Syirojul Kahfi** (`K-004`) — Jabatan: *Kasir*, Bagian: *Kasir*, Gaji Pokok: Rp 850.000, Gaji Bagian: Rp 300.000, Single.
4. **Nur Hadi** (`K-005`) — Jabatan: *Kepala Gudang*, Bagian: *Gudang*, Gaji Pokok: Rp 850.000, Gaji Bagian: Rp 610.000, Menikah.
5. **Alip Rejeki** (`K-007`) — Jabatan: *Pengiriman*, Bagian: *Pengiriman*, Gaji Pokok: Rp 850.000, Gaji Bagian: Rp 400.000, Single.
6. **Arriyan Muhammad** (`K-008`) — Jabatan: *Frontliner*, Bagian: *Frontliner*, Gaji Pokok: Rp 850.000, Gaji Bagian: Rp 300.000, Single.
7. **Muhammad Hiba** (`K-009`) — Jabatan: *Frontliner*, Bagian: *Frontliner*, Gaji Pokok: Rp 850.000, Gaji Bagian: Rp 200.000, Single.
8. **Lailurrohman** (`K-010`) — Jabatan: *Frontliner*, Bagian: *Frontliner*, Gaji Pokok: Rp 850.000, Gaji Bagian: Rp 200.000, Single.
9. **Muhammad Irvan** (`K-011`) — Jabatan: *Admin 3*, Bagian: *Admin*, Gaji Pokok: Rp 850.000, Gaji Bagian: Rp 650.000, Menikah (Aturan Khusus Cuti Hari Minggu).

### 3.2 Unit KUK Palen (`KUK-PALEN`)
10. **Nukul** (`K-012`) — Jabatan: *Kepala Toko*, Bagian: *Pimpinan*, Gaji Pokok: Rp 700.000, Gaji Bagian: Rp 300.000, Single.
11. **Miftah** (`K-013`) — Jabatan: *Kepala Gudang*, Bagian: *Gudang*, Gaji Pokok: Rp 700.000, Gaji Bagian: Rp 300.000, Single.

---

## 4. Alur Kerja ETL (Extract, Transform, Load)

```
[Sumber Data Lama]
- karyawan_db.js (DEFAULT_REKONTRAK & DEFAULT_GAJI_HISTORI)
- File CSV Cuti KUK (rekap-cuti-08-2026.csv)
- Master Armada V2
         |
         v
[Langkah 1: EXTRACTION]
Skrip Node.js terisolasi membaca array data mentah tanpa memodifikasi berkas sumber.
         |
         v
[Langkah 2: TRANSFORMATION]
- Normalisasi teks unit ('bangunan' -> 'TB-LATANSA', 'palen' -> 'KUK-PALEN').
- Resolusi UUID: Memetakan nama departemen dan jabatan ke entitas departments.id dan positions.id.
- Hashing PIN awal karyawan (default: 6 digit tanggal lahir / kode acak yang diamankan).
- Konversi nominal mata uang string ('Rp 850.000') menjadi angka numerik murni (850000.00).
         |
         v
[Langkah 3: DATA VALIDATION & RECONCILIATION]
- Verifikasi tidak ada kode duplikat.
- Verifikasi total pengeluaran gaji Juni 2026 sama persis dengan total legacy (Rp 15.046.500).
         |
         v
[Langkah 4: LOADING (SEEDING)]
- Eksekusi skrip SQL Seed ke Supabase PostgreSQL dalam satu transaksi commit tertutup.
```

---

## 5. Strategi Zero-Risk Cutover & Rencana Rollback

1. **Prinsip Non-Destruktif**:
   - Seluruh direktori proyek lama (`01. KUK` dan `08. KUK V2`) dibiarkan utuh dalam status *read-only*.
   - Tidak ada penghapusan berkas atau modifikasi pada Google Sheets lama selama masa transisi.
2. **Masa Paralel (Parallel Run)**:
   - Selama 1 siklus operasional (misal: 1 bulan), sistem baru (KUK V3) dijalankan bersamaan dengan sistem lama untuk memastikan rekonsiliasi data 100% identik.
3. **Prosedur Rollback**:
   - Jika ditemukan anomali kritis selama masa pengujian, staf operasional tetap dapat mengakses formulir lama karena Google Apps Script dan server lokal V2 tidak dimatikan sebelum penandatanganan Berita Acara UAT resmi.
   - Database Supabase memiliki cadangan berkala (*Automated Daily Backup & Point-in-Time Recovery*).

