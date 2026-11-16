# PANDUAN RINGKAS PERAN: TUKANG POTONG KACA (CUTTER)
## KUK MANAGEMENT SYSTEM v3.1.0

### Profil Peran
- **Nama Akun Demo**: Pemotong Kaca (UAT Demo)
- **Email Login**: `cutter.demo@kuk.test`
- **PIN Kiosk Mandiri**: `123456`
- **Cakupan Akses (Scope)**: **TB KUK La Tansa**
- **Wewenang**: Input klaim tip kaca mandiri pada layar kiosk, memantau buku catatan tip pribadi.

---

### Prosedur Klaim Tip Kaca di Layar Kiosk Mandiri

#### 1. Membuka Layar Kiosk Kaca
- Pada komputer layar sentuh (touchscreen) di area workshop potong kaca, buka alamat:
  ```text
  http://localhost:3000/kiosk/glass-tips
  ```

#### 2. Masukkan PIN Keamanan
- Sentuh layar keypad angka dan masukkan **PIN 6-digit** Anda (misal: `123456`).
- Sistem membuka jendela pengajuan klaim tip potong kaca.

#### 3. Menginput Data Pemotongan
- Masukkan **Nomor Nota Penjualan** dari kasir.
- Pilih **Jenis Kaca** (misal: *Kaca Polos 5mm*, *Kaca Riben 5mm*, dll).
- Masukkan **Panjang (cm)** dan **Lebar (cm)** serta **Jumlah Lembar**.
- Sistem secara otomatis menghitung estimasi tip baku:
  $$\text{Estimasi Tip} = 3\% \times \text{Harga Bahan Kaca}$$
- Klik tombol **"Kirim Klaim Tip"**.

#### 4. Membawa Nota ke Meja Kasir
- Bawa nota penjualan fisik ke kasir toko untuk diverifikasi agar klaim berubah dari `PENDING` menjadi `APPROVED`.
- Anda dapat memeriksa rekapitulasi total tip bulanan Anda di layar ringkasan kiosk.
