# DIREKTORI AKUN & PANDUAN KREDENSIAL UAT
## KUK MANAGEMENT SYSTEM v3.1.0 — ENTERPRISE EDITION

Dokumen ini memuat direktori resmi akun pengujian (User Acceptance Testing / UAT) dan demo operasional sistem KUK Management System v3.1.0 untuk unit bisnis **TB KUK La Tansa** dan **KUK Palen**.

---

## 1. PEMBERITAHUAN KEAMANAN & LINGKUNGAN PENGUJIAN

> [!IMPORTANT]
> **ISOLASI LINGKUNGAN DEMO / UAT:**
> Akun-akun di bawah ini beroperasi secara eksklusif pada **Local Demo & UAT Preview Environment**. Sistem diisolasi secara ketat dan **TIDAK TERHUBUNG** ke basis data Supabase Production (`ckzciuybedefbsdfsexh.supabase.co`).
>
> Segala transaksi, penambahan data karyawan, pencatatan kas, dan pengajuan cuti yang dilakukan menggunakan akun-akun ini tersimpan di memori browser lokal (*isolated session store*) dan aman digunakan untuk pelatihan, demonstrasi pimpinan, maupun uji operasional tanpa risiko merusak data produksi nyata.

---

## 2. DIREKTORI 9 IDENTITAS AKUN RESMI (DEMO / UAT)

Tersedia **9 Persona Pengguna** yang mencerminkan seluruh hierarki jabatan dan fungsi operasional di PT KUK:

| No | Jabatan / Role | Nama Pengguna / Display | Email Login | Password Lokal* | Cakupan Unit (Scope) | Tipe Akses Utama |
|---|---|---|---|---|---|---|
| **1** | **Pimpinan (Direksi)** | Bapak Pimpinan (UAT Demo) | `pimpinan.demo@kuk.test` | *Lihat `demo_secrets.local`* | **Seluruh Unit (ALL)** | Dashboard Eksekutif, Semua Modul, Seluruh Rekapitulasi |
| **2** | **HRD & Personalia** | Ibu Personalia / HRD (UAT Demo) | `hrd.demo@kuk.test` | *Lihat `demo_secrets.local`* | **Seluruh Unit (ALL)** | Manajemen Karyawan, Cuti, SP, Presensi, Rekap Gaji |
| **3** | **Manager Unit La Tansa** | Kepala Toko La Tansa (UAT Demo) | `manager.latansa@kuk.test` | *Lihat `demo_secrets.local`* | **TB KUK La Tansa** | Operasional Toko Bahan Bangunan, Approval Cuti & Kas Unit |
| **4** | **Manager Unit Palen** | Kepala Toko Palen (UAT Demo) | `manager.palen@kuk.test` | *Lihat `demo_secrets.local`* | **KUK Palen** | Operasional Toko Palen/Kelontong, Approval Cuti & Kas Unit |
| **5** | **Finance & Akuntansi** | Staff Keuangan Pusat (UAT Demo) | `finance.demo@kuk.test` | *Lihat `demo_secrets.local`* | **Seluruh Unit (ALL)** | Finalisasi Payroll, Verifikasi Kasbon, Approval Kas Kecil |
| **6** | **Supervisor Lapangan** | Supervisor Toko (UAT Demo) | `supervisor.demo@kuk.test` | *Lihat `demo_secrets.local`* | **TB KUK La Tansa** | Briefing Pagi, Pengecekan Kendaraan, Pengawasan Lapangan |
| **7** | **Kasir Toko** | Kasir Utama (UAT Demo) | `kasir.demo@kuk.test` | *Lihat `demo_secrets.local`* | **TB KUK La Tansa** | Verifikasi Tip Kaca, Pencatatan Kas Kecil Harian Toko |
| **8** | **Tukang Potong Kaca** | Pemotong Kaca (UAT Demo) | `cutter.demo@kuk.test` | *PIN Kiosk: `123456`* | **TB KUK La Tansa** | Kiosk Mandiri Tip Kaca (`/kiosk/glass-tips`), Rekap Tip |
| **9** | **Sopir Pengiriman** | Sopir Pengiriman (UAT Demo) | `driver.demo@kuk.test` | *PIN Kiosk: `123456`* | **TB KUK La Tansa** | Kiosk Peminjaman Kendaraan (`/kiosk/fleet`), Presensi |

*\*Catatan Keamanan: Nilai passphrase lokal terdefinisi dalam berkas `demo_secrets.local` yang berada dalam aturan `.gitignore` demi memenuhi kaidah OWASP dan kepatuhan audit keamanan.*

---

## 3. DUA CARA LOGIN KE SISTEM

Aplikasi KUK Management System v3.1.0 menyediakan dua metode autentikasi yang sangat mudah:

### METODE A — Satu Kali Klik (One-Click Quick Login) *(Direkomendasikan saat UAT)*
1. Buka browser dan arahkan ke alamat: `http://localhost:3000`
2. Pada panel login sebelah kanan, perhatikan kotak berwarna krem emas **"Pintasan Akses Cepat Demo (UAT Identitas)"**.
3. Klik tombol sesuai peran yang ingin diuji:
   - Tombol **"Pimpinan"** untuk login instan sebagai Direksi.
   - Tombol **"HRD"** untuk login instan sebagai Bagian Personalia.
   - Tombol **"Manager La Tansa"** atau **"Manager Palen"** untuk login sebagai Kepala Toko.
   - Tombol **"Finance"**, **"Supervisor"**, atau **"Kasir"** untuk peran operasional lainnya.
4. Sistem akan secara otomatis memuat profil, hak akses (RBAC), dan cakupan unit yang bersangkutan tanpa perlu mengetik manual.

### METODE B — Login Menggunakan Form Email & Password
1. Buka `http://localhost:3000`.
2. Masukkan alamat email persona pada kolom **Email**, misalnya: `pimpinan.demo@kuk.test`.
3. Masukkan kata sandi lokal dari `demo_secrets.local` (atau kata sandi demo yang tertera di dokumen pengantar pengujian).
4. Klik tombol **"Masuk ke Sistem"**.
5. Sistem memvalidasi identitas dan mengarahkan langsung ke Dashboard sesuai kewenangan pengguna.

---

## 4. MATRIKS HAK AKSES PERAN (ROLE-ACCESS MATRIX)

| Modul Aplikasi | Pimpinan | HRD | Manager Unit | Finance | Supervisor | Kasir | Cutter | Driver |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Dashboard Eksekutif** | Penuh (ALL) | Penuh (ALL) | Khusus Unit | Finansial | Khusus Unit | Terbatas | Non-Aktif | Non-Aktif |
| **Data Karyawan** | Lihat Saja | Penuh (CRUD) | Lihat & Input Unit | Lihat Saja | Lihat Tim | Non-Aktif | Non-Aktif | Non-Aktif |
| **Presensi & Briefing** | Rekap Eksekutif | Penuh & Impor FP | Kelola Unit | Rekap Gaji | Absen Briefing | Non-Aktif | Mandiri | Mandiri |
| **Manajemen Cuti** | Otorisasi Akhir | Otorisasi HRD | Otorisasi Unit | Lihat Jadwal | Lihat Jadwal | Pengajuan | Pengajuan | Pengajuan |
| **Tip Potong Kaca** | Audit Laporan | Rekap Bulanan | Rekap Unit | Rekapitulasi | Monitoring | Verifikasi Nota | Input Mandiri | Non-Aktif |
| **Armada & Kendaraan** | Audit Aset | Pantau Driver | Approval Unit | Pantau BBM | Inspeksi Fisik | Non-Aktif | Non-Aktif | Booking & Cek |
| **Surat Peringatan (SP)**| Persetujuan SP3 | Penerbitan SP1-3 | Usulan Teguran | Non-Aktif | Pelaporan | Non-Aktif | Non-Aktif | Non-Aktif |
| **Penggajian (Payroll)**| Persetujuan Akhir| Rekap & Evaluasi | Non-Aktif | Finalisasi Bank| Non-Aktif | Non-Aktif | Non-Aktif | Non-Aktif |
| **Kas Kecil (Expenses)** | Laporan Laba/Rugi | Biaya Personalia | Approval Belanja| Approval & Buku | Non-Aktif | Entri Nota | Non-Aktif | Non-Aktif |
| **Audit Log & Trail** | Akses Penuh | Non-Aktif | Non-Aktif | Non-Aktif | Non-Aktif | Non-Aktif | Non-Aktif | Non-Aktif |
| **Pengaturan Sistem** | Konfigurasi | Terbatas HR | Non-Aktif | Master Tarif | Non-Aktif | Non-Aktif | Non-Aktif | Non-Aktif |

---

## 5. PROSEDUR PROVISIONING AKUN PRODUKSI (SAAT LIVE NANTI)

Ketika KUK Management System beralih ke lingkungan operasional resmi (Production):
1. Akun pengguna resmi akan didaftarkan melalui konsol administratif atau Supabase Auth Admin.
2. Setiap karyawan akan menerima email undangan aktivasi dengan kata sandi pribadi yang aman (*minimum 8 karakter dengan kombinasi angka dan simbol*).
3. Akun demo berakhiran `@kuk.test` akan dinonaktifkan secara otomatis melalui flag konfigurasi lingkungan `VITE_ENABLE_UAT_DEMO=false`.
4. Seluruh aturan batasan unit dan RBAC yang telah teruji pada lingkungan UAT akan langsung berlaku identik di lingkungan produksi.
