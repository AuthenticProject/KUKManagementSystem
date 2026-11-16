/**
 * Cloud Synchronization Service for KUK Management System
 * Connects directly to Google Apps Script cloud database to ensure
 * data is synchronized across all devices (Mobile, Desktop, Tablet, Kiosk).
 */

export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxAjktMA76CUG0l-kCOMuazdLrWt6ULfv6cwhlL-QuGiwhtVJx8Sb12tkOHyXqk48tl/exec';
export const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1gmv0TIJvTJcCyKD8rs7ichW4LANGFtyZ?usp=sharing';

// Daftar resmi 105 Kamar / Rayon / Instansi Pondok Modern Darussalam Gontor & TB KUK
export const DAFTAR_KAMAR: string[] = [
  "TB KUK La Tansa",
  "KUK Palen",
  "KUK Bangunan",
  "Rayon Al-Azhar",
  "Rayon Syanggit",
  "Rayon Cairo",
  "Rayon Damaskus",
  "Rayon Mekkah",
  "Rayon Madinah",
  "Rayon Tunis",
  "Rayon Sudan",
  "Rayon Tripoli",
  "Rayon Nin-Xia",
  "Bagian Dapur Pondok",
  "Dapur Guru",
  "Panitia / Bagian Pondok",
  "Kantor Panitia 100 Tahun Gontor",
  "Pengasuhan Santri",
  "Staf Pengasuhan Santri",
  "KMI Gontor",
  "Staf KMI",
  "Staf Sekretariat Pimpinan Pondok",
  "Kantor Badan Wakaf 1",
  "Kantor Badan Wakaf 2",
  "Staf Yayasan (YPPWPM)",
  "Perdos UNIDA Siman",
  "Staf Administrasi UNIDA",
  "Sekretaris UNIDA Gontor",
  "Darussalam Computer Centre (DCC)",
  "Islamic Center Gontor (ICG) Madiun",
  "Staf ICT (Information and Communication Technology)",
  "Kantor Kopontren",
  "Tempat Pengelolaan Sampah (TPS)",
  "Pembimbing Jam'iyyatul Qurra' Wal Huffadz (Midho'ah Lt. 1)",
  "Pembimbing Jam'iyyatul Qurra' Wal Huffadz (Midho'ah Lt. 2)",
  "Pembimbing Pelajaran Sore (Saudi 1 Lt. 1)",
  "Islamic Center Joresan",
  "Perpustakaan UNIDA Kampus Rabithah",
  "Gontor Mini Soccer",
  "Pembimbing Bahasa (Language Advisory Council)",
  "Majalah Gontor",
  "Raya Department Store (Mantingan)",
  "Gontor TV",
  "Staf Pasca UNIDA Kampus Putri Mantingan",
  "Wartel Rabithah",
  "La Tansa Transport Unit 1 (Gerbang Utama)",
  "La Tansa Transport Unit 2 (Komplek Stadion)",
  "La Tansa Transport Unit 3 (Saudi)",
  "La Tansa Laundry",
  "Wartel Sudan",
  "Darussalam Press (Unit 1)",
  "Darussalam Press (Unit 2)",
  "Pusat Data",
  "Bagian Perlistrikan Pondok",
  "Darussalam Gontor Audio (Indonesia 1.1)",
  "Staf Administrasi Pondok",
  "Toko Bangunan Mantingan",
  "La Tansa Konfeksi (Unit 1)",
  "Staf Kantor Pusat IKPM",
  "Wartel Satelit",
  "Khizanah Kreasi Gontor",
  "Slep",
  "Staf Yayasan Penggemukan Sapi",
  "Staf Pembangunan UNIDA Kampus Siman",
  "MABIKORI (Wisma Hadi Lt. 1)",
  "UKK Grosir dan Sayur",
  "Staf BAA UNIDA Kampus Robithoh",
  "Darussalam Gontor Stadium (DGS)",
  "Gambia Department Store",
  "Pabrik Teh dan Es Krim",
  "La Tansa Resto",
  "PT. Estafet Dwi Masa (ESDM) Wonosobo",
  "Staf Pembangunan",
  "Darussalam Laboratory",
  "La Tansa DC Mantingan",
  "Pembimbing Latihan Pidato dan Diskusi (Saudi 1 Lt. 1)",
  "Majalah Himmah",
  "Suargo FM",
  "PT. Estafet Dwi Masa (ESDM) Mlarak",
  "Baitul Mal Wa Tamwil (BMT) Gontor",
  "Staf Yasyfin",
  "Rumah Tebet",
  "La Tansa Distributor Buku",
  "La Tansa Book Store",
  "Studio Rekaman Asia",
  "Staf Yayasan Budidaya Lele",
  "La Tansa DDC",
  "Guest Reception Advisory Council",
  "Pembimbing Luar Negeri",
  "Pembimbing MBGND (Satelit)",
  "Satelit Mart",
  "Staf Pemeliharaan Barang Wakaf dan Pertamanan",
  "Staf BAA Pusat",
  "Staf Transportasi UNIDA Kampus Siman",
  "Air Minum Darussalam (AMIDAS)",
  "Dewan Mahasiswa (DEMA)",
  "Pabrik Roti",
  "La Tansa Stationery",
  "Markaz Khot",
  "Kantin Satelit",
  "Staf Sub Agen LPG",
  "Staf Pasca UNIDA Kampus Siman",
  "Staf Hubungan Masyarakat (Humas) PMDG",
  "La Tansa Sport",
  "Gontor Auto Service (GAS)",
  "Fotokopi (Baitul Millah)",
  "Balai Kesehatan Santri",
  "La Tansa Apotek",
  "Klinik Pratama Syifaa (Siman)",
  "Kantin Sudan (Koperasi Mahasiswa)",
  "La Tansa Penyewaan GOR Bulutangkis (Ponorogo Kota)",
  "Umum / Eksternal"
];

// Master Tarif Kaca Resmi KUK Bangunan
export interface MasterGlassRate {
  id: string;
  name: string;
  pricePerSqm: number;
  thickness: number;
}

export const MASTER_GLASS_RATES: MasterGlassRate[] = [
  { id: '11', name: 'Kaca Air 2mm', pricePerSqm: 11000, thickness: 2 },
  { id: '13', name: 'Kaca Air 3mm', pricePerSqm: 13000, thickness: 3 },
  { id: '16-air', name: 'Kaca Air 5mm', pricePerSqm: 16000, thickness: 5 },
  { id: '16-cer', name: 'Kaca Cermin 2mm', pricePerSqm: 16000, thickness: 2 },
  { id: '20-cer', name: 'Kaca Cermin 3mm', pricePerSqm: 20000, thickness: 3 },
  { id: '11-es', name: 'Kaca Es 3mm', pricePerSqm: 11000, thickness: 3 },
  { id: '20-es', name: 'Kaca Es 5mm', pricePerSqm: 20000, thickness: 5 },
  { id: '18-rib', name: 'Kaca Riben 5mm', pricePerSqm: 18000, thickness: 5 },
  { id: '12-pol', name: 'Kaca Polos 5mm', pricePerSqm: 12000, thickness: 5 },
  { id: '18-pol', name: 'Kaca Polos 8mm', pricePerSqm: 18500, thickness: 8 },
  { id: '35-pol', name: 'Kaca Polos 10mm Tempered', pricePerSqm: 35000, thickness: 10 },
];

export interface CloudDashboardData {
  karyawan?: Array<{ id: string; nama: string; bagian: string; status: string }>;
  users?: Array<{ username: string; jabatan: string }>;
  tips?: Array<{
    id: string;
    tanggal: string;
    idKaryawan?: string;
    nama: string;
    jenisKaca: string;
    luas: number;
    totalHarga: number;
    tip: number;
  }>;
  peminjaman?: Array<{
    id: string;
    namaPeminjam: string;
    kamar?: string;
    divisi?: string;
    kontak?: string;
    kendaraanId?: string;
    namaKendaraan: string;
    platKendaraan: string;
    waktuMulai: string;
    waktuRencanaKembali: string;
    keperluan: string;
    status: string;
    simImage?: string;
    qrImage?: string;
    createdAt?: string;
  }>;
}

export const cloudSyncService = {
  /**
   * Mengambil data cloud dari Google Apps Script untuk sinkronisasi seluruh device.
   */
  async fetchCloudData(): Promise<CloudDashboardData | null> {
    try {
      const res = await fetch(`${SCRIPT_URL}?action=dashboard_data`);
      if (!res.ok) return null;
      const json = await res.json();
      return json as CloudDashboardData;
    } catch (err) {
      console.warn('[CloudSync] Gagal memuat data cloud:', err);
      return null;
    }
  },

  /**
   * Simpan permohonan peminjaman kendaraan ke cloud database.
   */
  async savePeminjamanToCloud(record: any): Promise<boolean> {
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_peminjaman',
          record,
        }),
      });
      return true;
    } catch (err) {
      console.warn('[CloudSync] Gagal simpan peminjaman ke cloud:', err);
      return false;
    }
  },

  /**
   * Simpan permohonan cuti karyawan ke cloud database.
   */
  async saveCutiToCloud(payload: {
    idKaryawan: string;
    nama: string;
    bagian: string;
    unit?: string;
    tanggal: string[];
    alasan?: string;
  }): Promise<boolean> {
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simpan_cuti',
          idKaryawan: payload.idKaryawan,
          nama: payload.nama,
          bagian: payload.bagian,
          unit: payload.unit || 'TB KUK La Tansa',
          tanggal: payload.tanggal,
          alasan: payload.alasan,
        }),
      });
      return true;
    } catch (err) {
      console.warn('[CloudSync] Gagal simpan cuti ke cloud:', err);
      return false;
    }
  },

  /**
   * Simpan pencatatan tip potong kaca 3% ke cloud database.
   */
  async saveTipToCloud(payload: {
    karyawan: string;
    jenis: string;
    luas: number;
    totalHarga: number;
    tip: number;
    waktu: string;
  }): Promise<boolean> {
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_tip',
          ...payload,
        }),
      });
      return true;
    } catch (err) {
      console.warn('[CloudSync] Gagal simpan tip ke cloud:', err);
      return false;
    }
  },
};
