# BUSINESS RULES CONFIRMATION & POLICY GOVERNANCE
## Status Keputusan Aturan Operasional Manajemen KUK (v3.1.0)
**Versi:** 3.1.0  
**Tanggal Pembaruan:** 2026-11-04  
**Status Tata Kelola:** Governance Synchronized  

---

## 1. Aturan Bisnis yang Telah Dikonfirmasi Resmi (CONFIRMED)

Berikut adalah aturan bisnis yang telah resmi disahkan oleh Manajemen KUK dan ditegakkan secara absolut di tingkat arsitektur database, skema relasional, dan RPC transaction engine:

### 1.1 CUTI ADMIN 3 (STATUS: CONFIRMED)
- **Keputusan Resmi**:
  1. Karyawan dengan posisi/jabatan **Admin 3** (diidentifikasi secara stabil melalui data master `positions.code = 'ADMIN_3'` dan konfigurasi `positions.allowed_leave_days_of_week = '{0}'`) **hanya diizinkan mengambil cuti pada hari Minggu**.
  2. Pengajuan cuti pada hari selain Minggu (Senin s/d Sabtu) **wajib ditolak secara mutlak** oleh database stored procedure `submit_leave_request_atomic()`.
  3. Penegakan tidak boleh hanya mengandalkan frontend, melainkan dieksekusi di level PostgreSQL engine.
  4. Pengenalan kategori Admin 3 menggunakan referensi stabil foreign key `positions.id` dan `positions.code`, dilarang menggunakan pencocokan teks bebas (*free text*).

### 1.2 TIP PEMOTONGAN KACA (STATUS: CONFIRMED)
- **Keputusan Resmi**:
  1. Besaran komisi/tip pemotongan kaca ditetapkan sebesar **3% (0.03) dari harga jual kaca**.
  2. **Formula Baku**:
     $$\text{Harga Kaca (Glass Price)} = \text{Luas (m}^2\text{)} \times \text{Harga Jual per m}^2$$
     $$\text{Nominal Tip} = \text{Harga Kaca} \times 0.03$$
  3. Setiap transaksi pada tabel `glass_tips` **wajib menyimpan snapshot**:
     - `glass_price_snapshot` (Total nominal harga jual kaca yang dipotong).
     - `tip_percentage_snapshot` (Persentase tip yang diterapkan, default: `0.0300`).
     - `tip_amount` (`calculated_amount`, hasil kalkulasi harga $\times$ 0.03).
  4. **Kekekalan Transaksi Historis**: Perubahan harga jual kaca pada master data di masa mendatang **tidak akan pernah mengubah** nilai tip pada transaksi yang telah tersimpan.
  5. **Aturan Pembulatan (Rounding Rule)**: Nominal tip dibulatkan ke atas ke kelipatan Rp 1.000 terdekat (`ROUND_UP_1000`) secara konsisten, atau sesuai aturan master `rounding_rule`.
  6. **Catatan Detail yang Masih Menunggu Konfirmasi**:
     > [!IMPORTANT]
     > Apakah dasar harga jual kaca yang digunakan merupakan harga **sebelum diskon / sebelum pajak (PPN)** atau **setelah diskon / setelah pajak (PPN)**? Saat ini sistem menggunakan dasar harga jual acuan (*base selling price*) dan parameter ini dicatat untuk konfirmasi lanjutan bagian Finance.

---

## 2. Aturan Bisnis yang Masih Menunggu Konfirmasi Manajemen (AWAITING CONFIRMATION)

| No | Modul Operasional | Butir Kebijakan | Status di Sistem v3.1.0 | Opsi Pilihan Kebijakan | Keputusan Dibutuhkan Dari |
|---|---|---|---|---|---|
| **1** | **Pelanggaran & Sanksi** | Ambang Poin SP1, SP2, SP3, dan Evaluasi PHK | Disediakan tabel konfigurasi `violation_point_rules` tanpa default hardcode. | **Opsi A**: Skema lama V2 (SP1: 20, SP2: 40, SP3: 60, PHK: 100).<br>**Opsi B**: Skema bertingkat dinamis sesuai klasifikasi berat-ringan pelanggaran. | Direksi KUK / HRD Manager |
| **2** | **Pelanggaran & Sanksi** | Masa Berlaku Poin Pelanggaran (*Point Validity*) | Kolom `point_validity_days` pada `violation_point_rules`. | **Opsi A**: 180 hari (6 bulan kalender).<br>**Opsi B**: 365 hari (1 tahun kalender).<br>**Opsi C**: Reset per pergantian tahun buku. | Direksi KUK / HRD Manager |
| **3** | **Penggajian (Payroll)**| Potongan Koperasi/Sosial (KSJ) | Dikelola via tabel `salary_components` (tipe: `DEDUCTION`). | **Opsi A**: Potongan seragam Rp 50.000 untuk seluruh karyawan tetap/kontrak.<br>**Opsi B**: Bersifat sukarela berdasarkan keikutsertaan anggota koperasi.<br>**Opsi C**: Proporsional terhadap masa kerja. | Pengurus Koperasi KSJ & Finance |
| **4** | **Presensi & Disiplin** | Aturan Denda/Potongan Keterlambatan Presensi | Kolom `late_minutes` dihitung otomatis dari `work_schedules`. Rumus potongan dikonfigurasi via `salary_components`. | **Opsi A**: Pemotongan nominal per menit keterlambatan (misal: Rp 1.000/menit).<br>**Opsi B**: Denda bertingkat per kelipatan 15 menit.<br>**Opsi C**: Konversi ke poin pelanggaran kedisiplinan tanpa potongan langsung. | HRD Manager & Finance |
| **5** | **Armada Kendaraan** | Kebijakan Tingkat Persetujuan Peminjaman Armada | Status peminjaman awal `PENDING` di `vehicle_borrowing_requests`. | **Opsi A**: Cukup persetujuan 1 orang (Fleet Officer / Kepala Gudang unit).<br>**Opsi B**: Wajib persetujuan berjenjang (Kepala Gudang + Kepala Toko) untuk rute luar kota. | Koordinator Armada & Pimpinan Unit |
