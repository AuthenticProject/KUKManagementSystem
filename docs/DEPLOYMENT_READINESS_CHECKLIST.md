# CHECKLIST KESIAPAN DEPLOYMENT PRODUKSI (DEPLOYMENT READINESS)
## KUK MANAGEMENT SYSTEM v3.1.0 — ENTERPRISE EDITION

Dokumen ini memetakan prasyarat dan langkah transisi dari **Lingkungan Local Demo / UAT** menuju **Lingkungan Live Production (Supabase & Cloud Hosting)**.

---

## 1. STATUS PERINGKAT KESIAPAN (READINESS TIERS)

Sesuai instruksi tata kelola proyek yang ketat, status sistem saat ini diklasifikasikan sebagai berikut:

```
[X] LOCAL DEMO READY          : 100% SIAP (Berjalan sempurna di localhost)
[X] LOCAL UAT READY           : 100% SIAP (9 Akun persona, skenario operasional lengkap)
[ ] DATABASE RUNTIME VERIFIED : MENUNGGU JADWAL MIGRASI STAGING/PRODUKSI
[ ] PRODUCTION READY          : MENUNGGU PERSETUJUAN DIREKSI & CUT-OVER RESMI
```

---

## 2. SYARAT GERBANG RILIS (GO/NO-GO GATES)

Sebelum aplikasi di-deploy ke server produksi:

### Gate 1: Integritas Basis Data & Skema
- [ ] Tinjauan skema database oleh DBA KUK.
- [ ] Memastikan migrasi historis (`20261104000001_core_schema_v3_1_0.sql` dan `20261104000002_harden_rpc_security.sql`) tetap **TIDAK DIMODIFIKASI / ZERO DIFF**.
- [ ] Menjalankan script migrasi pada basis data Supabase staging terisolasi sebelum ke production.
- [ ] Memastikan seluruh RLS (Row Level Security) aktif di semua tabel produksi.

### Gate 2: Keamanan Lingkungan & Kunci Rahasia
- [ ] Menetapkan `VITE_ENABLE_UAT_DEMO=false` pada environment production untuk mematikan panel akun demo.
- [ ] Menghasilkan token API Supabase dengan pembatasan domain (CORS whitelist).
- [ ] Memastikan file `demo_secrets.local` dan file `.env` produksi **TIDAK PERNAH DI-COMMIT** ke repositori git publik/utama.

### Gate 3: Infrastruktur & Cadangan (Disaster Recovery)
- [ ] Mengaktifkan point-in-time recovery (PITR) pada database PostgreSQL Supabase.
- [ ] Menyiapkan job otomatis pencadangan data harian ke storage cloud terenkripsi.
- [ ] Menyiapkan SSL/TLS Certificate (HTTPS) untuk domain resmi operasional (misal: `https://app.kuk.co.id`).

### Gate 4: Pelatihan Pengguna & Sign-Off UAT
- [ ] Sosialisasi buku panduan kepada Kasir, Kepala Toko, HRD, dan Bagian Keuangan.
- [ ] Penandatanganan Berita Acara Penerimaan UAT oleh Bapak Pimpinan (Direksi).
- [ ] Penetapan tanggal resmi peluncuran (*Go-Live Cutover Date*).

---

*Checklist Kesiapan Deployment KUK Management System v3.1.0 — Dokumen Tata Kelola Rilis.*
