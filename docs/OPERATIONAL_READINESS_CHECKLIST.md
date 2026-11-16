# CHECKLIST KESIAPAN OPERASIONAL (OPERATIONAL READINESS)
## KUK MANAGEMENT SYSTEM v3.1.0 — ENTERPRISE EDITION

Dokumen ini memvalidasi seluruh kesiapan operasional aplikasi KUK Management System v3.1.0 sebelum diserahterimakan kepada jajaran Direksi, Manajemen, dan Staf PT KUK.

---

## 1. STATUS RINGKASAN KESIAPAN

| Dimensi Penilaian | Status Evaluasi | Keterangan Verifikasi |
|---|:---:|---|
| **Integritas Desain & Rebranding** | **SIAP (100%)** | Seluruh 12 modul & 3 kiosk mematuhi palet warna KUK Crimson & Gold serta font Revans / Plus Jakarta Sans. |
| **Kesiapan Akun & Peran (RBAC)** | **SIAP (100%)** | 9 Identitas UAT teruji lengkap dengan pembatasan unit (TB KUK La Tansa vs KUK Palen). |
| **Aturan Bisnis Baku (Glass Tip 3%)**| **SIAP (100%)** | Formula tip kaca mutlak 3% dari harga bahan baku master kaca tanpa pembulatan liar. |
| **Dokumentasi Pengguna** | **SIAP (100%)** | Buku Panduan 16 Bab, 8 Panduan Ringkas Peran, Panduan Admin, & Panduan Akun telah terbit. |
| **Stabilitas & Regresi Kode** | **SIAP (100%)** | 303/303 automated tests lulus, 0 error kompilasi TypeScript. |

---

## 2. MATRIKS KESIAPAN PER MODUL OPERASIONAL

| No | Modul Sistem | Kesiapan Operasional | Validasi Fungsional | Catatan Penggunaan |
|---|---|:---:|---|---|
| **1** | **Autentikasi & Login** | **SIAP** | One-Click UAT selector & Form login email aktif | Teruji untuk seluruh 9 persona |
| **2** | **Dashboard & KPI** | **SIAP** | Ringkasan metrik karyawan, cuti, kas, dan presensi | Mendukung filter unit La Tansa & Palen |
| **3** | **Data Karyawan** | **SIAP** | Form tambah, edit, pencarian, & soft-deactivate | Riwayat historis terlindungi penuh |
| **4** | **Riwayat Jabatan** | **SIAP** | Pencatatan mutasi, promosi, dan riwayat gaji | Log kronologis tidak dapat dimanipulasi |
| **5** | **Presensi & Fingerprint** | **SIAP** | Input status, briefing pagi, modal impor file CSV | Kalkulasi otomatis durasi kerja |
| **6** | **Manajemen Cuti** | **SIAP** | Batas 3 hari berturut-turut, jendela H-3, anti-bentrok | Alur berjenjang: Unit $\rightarrow$ HRD |
| **7** | **Reset PIN Kiosk** | **SIAP** | Modal ganti PIN 6-digit dengan audit log | Khusus untuk operator cutter & driver |
| **8** | **Pelanggaran / SP** | **SIAP** | Penerbitan SP1-3, masa berlaku 6 bulan otomatis | Tanpa pemotongan gaji ilegal |
| **9** | **Tip Potong Kaca** | **SIAP** | Kiosk mandiri, formula 3% kaca, verifikasi kasir | Bebas dari biaya faktur non-kaca |
| **10**| **Armada & Kendaraan** | **SIAP** | Kiosk booking, inspeksi FIT vs NEEDS MAINTENANCE | Odometer terverifikasi berangkat/kembali |
| **11**| **Penggajian (Payroll)**| **SIAP** | Draft kalkulasi, slip gaji resmi, finalisasi kunci | Menghasilkan snapshot imutabel |
| **12**| **Kas Kecil (Expenses)** | **SIAP** | Input kasir toko, approval berjenjang, unggah nota | Terpisah per unit kerja |
| **13**| **Audit Log Trail** | **SIAP** | Pencatatan mutasi data, timestamp, aktor | Akses eksklusif pimpinan |
| **14**| **Pengaturan Sistem** | **SIAP** | Master tarif kaca, master departemen, jam kerja | Basis konfigurasi terpusat |

---

## 3. CHECKLIST KESIAPAN PERANGKAT & HARDWARE TOKO

- [x] **Komputer Kasir Toko**: Layar minimal 1366x768, terhubung jaringan LAN/Wi-Fi toko.
- [x] **Layar Kiosk Potong Kaca**: Perangkat sentuh (Touchscreen) atau tablet di area workshop dengan akses URL `/kiosk/glass-tips`.
- [x] **Tablet Garasi Armada**: Perangkat tablet/ponsel pintar supervisor armada dengan akses URL `/kiosk/fleet`.
- [x] **Printer Nota / Slip Gaji**: Printer standar A4 atau continuous paper untuk pencetakan dokumen resmi.

---

*Checklist Kesiapan Operasional KUK Management System v3.1.0 — Terverifikasi & Disetujui.*
