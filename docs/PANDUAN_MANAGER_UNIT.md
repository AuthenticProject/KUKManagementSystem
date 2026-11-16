# PANDUAN RINGKAS PERAN: KEPALA TOKO (MANAGER UNIT)
## KUK MANAGEMENT SYSTEM v3.1.0

### Profil Peran
- **Manager La Tansa**: `manager.latansa@kuk.test` (Cakupan Unit: **TB KUK La Tansa**)
- **Manager Palen**: `manager.palen@kuk.test` (Cakupan Unit: **KUK Palen**)
- **Wewenang**: Pengawasan operasional toko harian, persetujuan awal cuti staf toko, persetujuan pengeluaran kas kecil toko, pemantauan armada toko.

---

### Alur Kerja Harian Kepala Toko

#### 1. Masuk ke Sistem (Login)
- Buka `http://localhost:3000`.
- Klik tombol **"Manager La Tansa"** atau **"Manager Palen"** sesuai unit yang ingin dikelola.
- Perhatikan tanda badge di sudut navigasi bahwa sistem langsung terkunci pada unit kerja bersangkutan (*Unit Isolation Guard*).

#### 2. Briefing Pagi & Presensi Harian
- Pastikan supervisor atau kasir telah membuka sesi briefing pagi.
- Periksa tingkat kehadiran staf toko di menu **"Presensi"** untuk memastikan tidak ada pos pelayanan kasir atau gudang yang kosong.

#### 3. Verifikasi Awal Permohonan Cuti
- Buka menu **"Cuti"**.
- Tinjau pengajuan cuti personil toko Anda.
- Pastikan operasional toko tetap aman jika staf tersebut mengambil cuti.
- Berikan rekomendasi persetujuan awal sebelum ditindaklanjuti oleh HRD Pusat.

#### 4. Otorisasi Pengeluaran Kas Kecil Toko
- Buka menu **"Keuangan (Kas Kecil)"**.
- Periksa nota-nota belanja operasional yang diinput oleh kasir toko (pembelian bensin armada, konsumsi lembur, alat pembersih).
- Klik **"Setujui (Approve)"** jika nota fisik valid dan jumlah wajar.
