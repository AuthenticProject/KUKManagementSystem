# PANDUAN ADMINISTRATOR & OPERASIONAL SISTEM
## KUK MANAGEMENT SYSTEM v3.1.0 — ENTERPRISE EDITION

Dokumen ini ditujukan bagi Administrator Sistem, Tim TI Internal KUK, dan Teknisi Sistem yang bertugas mengelola, mengoperasikan, dan memelihara aplikasi KUK Management System v3.1.0.

---

## 1. SPESIFIKASI KEBUTUHAN SISTEM & PRASYARAT LINGKUNGAN

### 1.1 Persyaratan Perangkat Lunak Server / Komputer Host
- **Sistem Operasi**: Windows 10/11 Pro, Windows Server 2019/2022, atau Linux Ubuntu 22.04 LTS+.
- **Node.js**: Versi LTS 18.x atau 20.x (direkomendasikan Node.js v20 LTS).
- **Package Manager**: npm versi 9.x atau 10.x.
- **Web Browser**: Google Chrome versi 110+, Microsoft Edge, atau Mozilla Firefox ESR.

### 1.2 Persyaratan Jaringan & Port
- Port default aplikasi: **Port 3000** (atau Port 5173 bila port 3000 terpakai).
- Akses intranet lokal: Komputer kiosk di workshop kaca dan tablet armada di garasi harus berada dalam subnet LAN / Wi-Fi yang sama dengan host server.

---

## 2. PROSEDUR MEMULAI & MENGHENTIKAN APLIKASI

### 2.1 Menjalankan Server Aplikasi (Mode Pengembangan / UAT)
1. Buka terminal atau PowerShell pada direktori proyek:
   ```powershell
   cd "d:\00. Me\07. Code Project\13. KUK V3"
   ```
2. Jalankan perintah:
   ```powershell
   npm run dev
   ```
3. Terminal akan menampilkan konfirmasi bahwa server Vite aktif:
   ```text
   VITE v5.4.10  ready in 420 ms
   ➜  Local:   http://localhost:3000/
   ➜  Network: use --host to expose
   ```

### 2.2 Menjalankan untuk Akses Jaringan Lokal (Kiosk Toko)
Agar komputer kasir, kiosk potong kaca, dan tablet pengemudi dapat mengakses server utama melalui Wi-Fi toko:
```powershell
npm run dev -- --host 0.0.0.0 --port 3000
```
Perangkat lain di toko cukup membuka alamat IP komputer server, contoh: `http://192.168.1.100:3000`.

### 2.3 Menghentikan Server
Pada jendela terminal server yang sedang berjalan, tekan tombol kombinasi:
```text
Ctrl + C
```
Ketik `Y` lalu tekan **Enter** untuk mengonfirmasi penghentian server.

---

## 3. DAFTAR PERINTAH PENGUJIAN & VERIFIKASI (CLI COMMANDS)

Sistem telah dilengkapi dengan automated test suite lengkap untuk memastikan kehandalan sistem sebelum digunakan oleh pimpinan:

| Perintah NPM | Deskripsi & Fungsi Pengujian | Jumlah Test Case |
|---|---|:---:|
| `npm run typecheck` | Validasi kompilasi TypeScript (`tsc --noEmit`), memastikan 0 error | Mandatory |
| `npm run test:identities` | Verifikasi seluruh 9 identitas persona akun UAT, peran, dan cakupan unit | 22 PASS |
| `npm run test:phase1:all` | Validasi kontrak arsitektur & simulasi bisnis Fase 1 | 101 PASS |
| `npm run test:phase2` | Validasi logika perhitungan & integrasi bisnis Fase 2 | 11 PASS |
| `npm run test:phase3` | Validasi aturan bisnis, otorisasi, dan batas izin Fase 3 | 32 PASS |
| `npm run test:demo` | Pengujian mekanisme autentikasi akun demo lokal | 11 PASS |
| `npm run test:uat` | Validasi skenario acceptance testing operasional | 40 PASS |
| `npm run test:ui` | Validasi rendering antarmuka pengguna & navigasi modul | 22 PASS |
| `npm run test:deep` | Pengujian fungsional mendalam seluruh alur operasional | 15 PASS |
| `npm run test:negative` | Pengujian negatif & integritas batasan bisnis (anti-tamper) | 27 PASS |
| `npm run test:business-auth` | Validasi konsistensi otorisasi & isolasi jaringan Supabase | 28 PASS |
| `npm run test:maturity` | Validasi maturitas produk akhir & kepatuhan formula kaca 3% | 16 PASS |

---

## 4. ARSITEKTUR PENYIMPANAN DATA & BATASAN LINGKUNGAN

### 4.1 Mode Demo / UAT Lokal (Status Saat Ini)
- **Mekanisme Penyimpanan**: Menggunakan `sessionStorage` browser yang diisolasi di bawah kunci `KUK_PREVIEW_STORE_V1` via kelas `PreviewStore` (`src/services/previewStore.ts`).
- **Karakteristik Data**:
  - Penambahan data karyawan, mutasi, transaksi kas kecil, klaim tip kaca, dan permohonan cuti tersimpan di memori browser selama sesi pengujian aktif.
  - Data bertahan saat navigasi antar modul (*page switching*).
  - Melindungi database produksi secara mutlak dari kontaminasi data uji coba (*Zero Production Leakage*).

### 4.2 Mode Produksi Penuh (Live Production)
- **Mekanisme Penyimpanan**: Menggunakan PostgreSQL database di Supabase dengan Row Level Security (RLS) dan RPC Functions yang terenkripsi.
- **Transisi ke Produksi**:
  1. Setel flag `VITE_ENABLE_UAT_DEMO=false` pada environment produksi.
  2. Pastikan migrasi database diterapkan oleh DBA tersertifikasi.
  3. Lakukan provisioning pengguna nyata melalui Supabase Auth Admin API.

---

## 5. PROSEDUR PENCADANGAN (BACKUP) & PEMULIHAN (RESTORE) DATA

Saat sistem live di PostgreSQL:
1. **Pencadangan Harian (Automated Daily Backup)**:
   ```bash
   pg_dump -h db.supabase.co -U postgres -d postgres -F c -b -v -f "/backups/kuk_prod_$(date +%Y%m%d).dump"
   ```
2. **Pemulihan Bencana (Disaster Recovery)**:
   ```bash
   pg_restore -h db.supabase.co -U postgres -d postgres -v -c "/backups/kuk_prod_YYYYMMDD.dump"
   ```

---

## 6. DIAGNOSIS KENDALA & PENANGANAN MASALAH TEKNIS

### 6.1 Port Conflict (Port 3000 Terpakai)
Jika muncul pesan `Port 3000 is in use, trying another one...`:
- Vite akan otomatis mengalihkan ke port berikutnya (misal: 3001 atau 5173).
- Untuk memaksa port 3000, cari proses yang memakai port 3000 di Windows:
  ```powershell
  netstat -ano | findstr :3000
  taskkill /PID <PID_NUMBER> /F
  ```

### 6.2 Cache Browser Usang
Jika tampilan desain baru belum muncul di komputer staf toko:
- Minta pengguna menekan tombol **Ctrl + F5** (Hard Refresh) untuk membersihkan berkas cache CSS dan script lama.

---

*Panduan Administrator KUK Management System v3.1.0 — Dokumen Teknis Resmi.*
