# PANDUAN RINGKAS PERAN: HRD & PERSONALIA
## KUK MANAGEMENT SYSTEM v3.1.0

### Profil Peran
- **Nama Akun Demo**: Ibu Personalia / HRD (UAT Demo)
- **Email Login**: `hrd.demo@kuk.test`
- **Cakupan Akses (Scope)**: **SELURUH UNIT (TB KUK La Tansa & KUK Palen)**
- **Wewenang**: Pengelolaan master data karyawan, evaluasi presensi & cuti, penerbitan Surat Peringatan (SP), mutasi jenjang karir, penyiapan draft gaji.

---

### Alur Kerja Operasional HRD

#### 1. Masuk ke Sistem (Login)
- Buka `http://localhost:3000`.
- Klik tombol **"HRD"** pada panel Pintasan Akses Cepat Demo (UAT).

#### 2. Manajemen Data Karyawan
- Tambah Karyawan: Klik tombol **"+ Tambah Karyawan"**, isi biodata, NIK, penempatan unit, dan besaran gaji pokok.
- Nonaktifkan Karyawan Resign: Buka profil karyawan $\rightarrow$ ubah status menjadi `NON-AKTIF`. Data historis tetap utuh (*soft-delete* aman).
- Mutasi Jabatan: Buka riwayat jabatan karyawan dan tambahkan catatan promosi/rotasi unit.

#### 3. Rekapitulasi Presensi & Impor Fingerprint
- Buka menu **"Presensi"**.
- Klik **"Impor Fingerprint"** untuk mengunggah file absensi dari mesin toko.
- Periksa status absensi: Hadir, Terlambat, Izin, Sakit, atau Alpha.

#### 4. Otorisasi Permohonan Cuti
- Buka menu **"Cuti"**.
- Evaluasi permohonan yang berstatus `MENUNGGU APPROVAL`.
- Pastikan tidak melanggar aturan kuota 3 hari kerja berturut-turut dan tidak bentrok dengan staf se-departemen.
- Klik tombol **"Setujui"** atau **"Tolak"** dengan menyertakan alasan.

#### 5. Penerbitan Surat Peringatan (SP)
- Buka menu **"Pelanggaran / SP"**.
- Klik **"Terbitkan SP"**, pilih karyawan, jenis SP (SP1, SP2, SP3), dan uraian pelanggaran.
- Masa berlaku SP aktif secara otomatis selama 6 bulan (180 hari) tanpa memotong gaji pokok.
