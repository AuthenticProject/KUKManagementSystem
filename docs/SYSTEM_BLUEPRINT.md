# SYSTEM BLUEPRINT — KUK MANAGEMENT SYSTEM
## Clean Rebuild · Multi-Unit · Production-Oriented Architecture
**Versi:** 3.0.0  
**Tanggal:** 2026-11-04  
**Status:** Architecture Blueprint / Phase 0 Final  
**Penulis:** Senior Software Architect, Senior Full-Stack Engineer, Database Engineer, UI/UX Designer, QA Engineer  

---

## 1. Ringkasan Eksekutif & Prinsip Desain

KUK Management System V3 adalah platform web modular terpadu untuk pengelolaan operasional, sumber daya manusia (SDM), presensi, pemotongan kaca, pelanggaran kerja, penggajian, armada kendaraan, dan pelaporan eksekutif pada organisasi bisnis **KUK**.

### 1.1 Prinsip Fundamental (Clean Rebuild)
1. **Bukan Modifikasi Tambal-Sulam**: Proyek ini dibangun dari nol (*clean rebuild*) dengan standar *production-ready enterprise*, bukan sekadar merapikan kode monolitik HTML/JS atau Apps Script lama.
2. **Satu Organisasi, Multi-Unit Berkelanjutan**: Mengakomodasi unit awal **TB KUK La Tansa** dan **KUK Palen**, serta siap menerima unit baru secara dinamis tanpa restrukturisasi database.
3. **Pemisahan Logis Terpusat**: Satu aplikasi frontend, satu domain, satu proyek Supabase terpusat, dengan partisi data menggunakan `unit_id` dan penegakan *Row Level Security* (RLS) di lapisan PostgreSQL.
4. **Keutuhan Integritas & Audit Trail**: Tidak ada manipulasi riwayat penggajian (*snapshot immutability*), penghapusan permanen transaksi operasional, atau pemindahan saldo/tip tanpa jejak audit.
5. **Pemisahan Portal Publik vs Internal**: Form publik (Peminjaman Kendaraan, Pengajuan Cuti, Tip Kaca) terlindungi dari akses dashboard internal dan data sensitif, dengan verifikasi kriptografis dan rate limiting.
6. **UI/UX Profesional & Ramah Pengguna**: Mengusung identitas visual KUK (Marun `#6B1D2F` / `#540000`, aksen Emas `#D4AF37`, latar terang bersih `#F9FAFB`), tipografi tajam, dan alur kerja intuitif untuk staf non-teknis.

---

## 2. Arsitektur Komponen & Topologi Sistem

```
+---------------------------------------------------------------------------------------+
|                                    KLIEN & PERANGKAT                                  |
|   +------------------------------------+   +--------------------------------------+   |
|   |         PORTAL PUBLIK MANDIRI      |   |        PORTAL INTERNAL STAF          |   |
|   |  - Cuti Karyawan (PIN/OTP Auth)    |   |  - Unit Selector Context Engine      |   |
|   |  - Form Tip Potong Kaca            |   |  - Dashboard Pusat & Dashboard Unit  |   |
|   |  - Peminjaman Armada Kendaraan     |   |  - Modul SDM, Payroll, Fleet, dll    |   |
|   +-----------------+------------------+   +-------------------+------------------+   |
+---------------------|------------------------------------------|----------------------+
                      | HTTPS / WSS                              | HTTPS / WSS
                      v                                          v
+---------------------------------------------------------------------------------------+
|                               FRONTEND APPLICATION (SPA)                              |
|   - React 18+ / TypeScript / Vite / Tailwind CSS                                      |
|   - State & Server Cache: TanStack Query v5                                           |
|   - Routing & Route Guards: React Router v6 (RBAC + Unit Scope)                       |
|   - Form & Validasi: React Hook Form + Zod Schema Validation                          |
|   - Visualisasi & Dokumen: Recharts, jsPDF / html2canvas-pro, SheetJS (XLSX)          |
+---------------------------------------------------------------------------------------+
                                           |
                                           | Supabase Client (Anon Key + JWT)
                                           v
+---------------------------------------------------------------------------------------+
|                                  SUPABASE BACKEND CLOUD                               |
|                                                                                       |
|   +-----------------------+  +-----------------------+  +-------------------------+   |
|   |     SUPABASE AUTH     |  |   SUPABASE STORAGE    |  |     EDGE FUNCTIONS      |   |
|   | - JWT Session         |  | - Private: Slip Gaji, |  | - Rate Limiter / Anti-   |   |
|   | - Role Claims / Hooks |  |   Surat Peringatan,   |  |   Spam Verification     |   |
|   | - Secure Reset / PIN  |  |   Bukti Insiden       |  | - Scheduled Cron Tasks  |   |
|   +-----------+-----------+  | - Public: Bukti Armada|  +------------+------------+   |
|               |              +-----------+-----------+               |                |
|               v                          v                           v                |
|   +-------------------------------------------------------------------------------+   |
|   |                        POSTGRESQL 15+ DATABASE ENGINE                         |   |
|   |                                                                               |   |
|   |  +-------------------------------------------------------------------------+  |   |
|   |  |                     ROW LEVEL SECURITY (RLS) POLICIES                   |  |   |
|   |  |  - Isolasi Unit: user_unit_access & permissions check                   |  |   |
|   |  |  - Proteksi Publik: Validated Stored Procedures Only                   |  |   |
|   |  |  - Perlindungan Kolom Sensitif (Gaji Pokok, PIN Hash)                  |  |   |
|   |  +-------------------------------------------------------------------------+  |   |
|   |                                                                               |   |
|   |  +-------------------------------------------------------------------------+  |   |
|   |  |                  ATOMIC BUSINESS LOGIC (PL/pgSQL RPCs)                  |  |   |
|   |  |  - submit_leave_request_atomic() (Anti-Bentrok & Slot Lock)             |  |   |
|   |  |  - calculate_and_finalize_payroll() (Snapshot Immutability)             |  |   |
|   |  |  - book_vehicle_atomic() (Anti-Tabrakan Jadwal Armada)                  |  |   |
|   |  |  - generate_document_number() (Nomor Dokumen Berurut Unik)              |  |   |
|   |  +-------------------------------------------------------------------------+  |   |
|   |                                                                               |   |
|   |  +-------------------------------------------------------------------------+  |   |
|   |  |               DATA TABLES WITH STRICT CONSTRAINTS & AUDIT               |  |   |
|   |  |  - Organizations & Units (unit_id)                                     |  |   |
|   |  |  - RBAC (profiles, roles, permissions, role_permissions, user_unit)     |  |   |
|   |  |  - Master Data (departments, positions, employees, rate_configs)        |  |   |
|   |  |  - Transaksi (leave, glass_tips, violations, attendance, fleet, payroll)|  |   |
|   |  |  - Immutable Audit Logs & Activity Logs                                 |  |   |
|   |  +-------------------------------------------------------------------------+  |   |
+---+-------------------------------------------------------------------------------+---+
```

---

## 3. Desain Multi-Unit & Siklus Konteks

### 3.1 Struktur Multi-Unit
Organisasi induk **KUK** menaungi unit-unit usaha otonom:
- **Unit 1: TB KUK La Tansa** (`TB-LATANSA`) — Fokus toko bangunan, material, pemotongan kaca, dan armada ekspedisi material.
- **Unit 2: KUK Palen** (`KUK-PALEN`) — Fokus retail peralatan/palen, operasional armada lokal.
- **Unit Baru N**: Dibuat melalui antarmuka Super Admin (`organizations.settings`) dengan kode unik, konfigurasi jam kerja, aturan cuti, dan struktur departemen independen.

### 3.2 Siklus Pemilihan Unit (Unit Selector Engine)
1. **Pasca-Login Staf**:
   - Sistem memuat profil dan daftar `user_unit_access`.
   - Jika pengguna hanya memiliki akses ke 1 unit: Otomatis menetapkan `active_unit_id` ke unit tersebut dan melompat ke Dashboard Unit.
   - Jika pengguna memiliki akses ke >1 unit (atau `admin_pusat`/`super_admin`):
     - Membuka Dashboard Pusat (Lintas Unit) secara default.
     - Menyediakan *Unit Switcher Dropdown* di header navigasi utama.
2. **Perpindahan Unit (Unit Context Switching)**:
   - Mengubah `active_unit_id` pada *Global App Context*.
   - Menghapus (*invalidate*) seluruh cache TanStack Query yang berkorelasi dengan `['unit', previous_unit_id]`.
   - Mengarahkan ulang (*reset*) state form yang sedang aktif untuk mencegah kebocoran (*leakage*) data antarunit.
   - Header aplikasi selalu menampilkan lencana (*badge*) unit aktif: Warna Marun/Emas untuk TB KUK La Tansa, Warna Marun/Biru untuk KUK Palen, atau Lencana Khusus "PUSAT (SEMUA UNIT)".

---

## 4. Spesifikasi Tech Stack & Alasan Pemilihan

| Layer | Pilihan Teknologi | Versi Target | Justifikasi & Peran |
|---|---|---|---|
| **Language** | TypeScript | ^5.6.0 | *Type-safety* menyeluruh, mencegah null-pointer, mengikat *database types* otomatis dari Supabase. |
| **Framework UI** | React | ^18.3.0 | Ekosistem stabil, rendering cepat, didukung jutaan library teruji. |
| **Build Tool** | Vite | ^5.4.0 | HMR instan, konfigurasi minimal, kompilasi production yang sangat efisien. |
| **Styling** | Tailwind CSS | ^3.4.0 | Utilitas CSS modern, pemeliharaan mudah, konsistensi token warna marun-emas KUK. |
| **State & Cache** | TanStack Query | ^5.50.0 | Server-state management mutakhir, revalidasi otomatis, caching terisolasi per unit. |
| **Routing** | React Router | ^6.26.0 | Deklaratif, route-guarding granular berbasis unit & permission, nested layouts. |
| **Form & Validasi** | React Hook Form + Zod | RHF ^7.52, Zod ^3.23 | Validasi deklaratif berperforma tinggi, schema sharing antara client dan server RPC. |
| **Grafik/Chart** | Recharts | ^2.12.0 | Visualisasi performa presensi, perbandingan tip, dan biaya operasional armada. |
| **Komponen UI** | Lucide React + Headless UI / Radix Primitives | Terbaru | Aksesibilitas tinggi, ikonografi konsisten, modal, dialog konfirmasi, dan popover. |
| **Backend & DB** | Supabase (PostgreSQL) | PostgreSQL 15+ | Relasional tangguh, RLS bawaan, RPC PL/pgSQL, realtime subscriptions, Storage. |
| **Export Engine** | SheetJS (xlsx) + jsPDF / html2canvas-pro | Standar Stabil | Ekspor rekapitulasi Excel bersih dan cetak slip gaji/surat peringatan PDF presisi. |

---

## 5. Konfigurasi Lingkungan, Zona Waktu, dan Moneter

- **Timezone Sistem**: `Asia/Jakarta` (WIB / UTC+7). Seluruh timestamp disimpan dalam format ISO-8601 UTC di database, namun diproses dan ditampilkan dalam waktu lokal Jakarta.
- **Format Tanggal**: Standar Indonesia (`id-ID`), contoh: `04 November 2026`, format jam `24 Jam` (`19:30 WIB`).
- **Mata Uang**: Rupiah Indonesia (`IDR`), contoh: `Rp 1.850.000`, tanpa desimal sen, pemisah ribuan titik (`.`).
- **Keamanan Kredensial**:
  - `VITE_SUPABASE_URL`: Publik.
  - `VITE_SUPABASE_ANON_KEY`: Publik (terbatas oleh RLS).
  - `SUPABASE_SERVICE_ROLE_KEY`: **DILARANG KERAS** dimasukkan ke dalam frontend source code atau repo git. Hanya digunakan pada Edge Functions atau migrasi terisolasi.

---

## 6. Arsitektur Struktur Proyek (Target Phase 1+)

```
kuk-management-system/
├── docs/                               # Seluruh blueprint, schema, ERD, dan aturan
│   ├── SYSTEM_BLUEPRINT.md
│   ├── DATABASE_SCHEMA.md
│   ├── ERD.md
│   ├── BUSINESS_RULES.md
│   ├── SECURITY_RULES.md
│   ├── ROLE_PERMISSION_MATRIX.md
│   ├── DEVELOPMENT_ROADMAP.md
│   └── MIGRATION_PLAN.md
├── src/
│   ├── app/                            # Inisialisasi aplikasi, Providers, Router
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── routes.tsx
│   ├── components/                     # Komponen UI Reusable
│   │   ├── ui/                         # Button, Input, Modal, Table, Badge, Card
│   │   ├── feedback/                   # Alert, Spinner, Toast, EmptyState
│   │   └── navigation/                 # Header, Sidebar, UnitSelector, GlobalSearch
│   ├── layouts/                        # Layout Wrapper
│   │   ├── AdminLayout.tsx             # Shell Internal dengan Header & Sidebar
│   │   ├── PublicPortalLayout.tsx      # Shell Publik Minimalis Elegan
│   │   └── AuthLayout.tsx              # Shell Login Staf
│   ├── contexts/                       # React Contexts
│   │   ├── AuthContext.tsx             # Akun staf, JWT, role, permissions
│   │   └── UnitContext.tsx             # Active unit, list of accessible units
│   ├── modules/                        # Modul Fungsional Bisnis
│   │   ├── landing/                    # 3 Card Utama (Kendaraan, Karyawan, Login)
│   │   ├── dashboard/                  # Dashboard Pusat & Dashboard Unit
│   │   ├── organization/               # Unit, Bagian/Departemen, Jabatan
│   │   ├── employees/                  # Master Karyawan, Riwayat Jabatan/Status
│   │   ├── leave/                      # Cuti Publik & Admin Rekap Matriks
│   │   ├── glass-tips/                 # Form Tip Publik, Verifikasi, Rekap
│   │   ├── violations/                 # Catatan Insiden, Poin, Cetak SP PDF
│   │   ├── attendance/                 # Briefing Pagi & Fingerprint CSV Importer
│   │   ├── payroll/                    # Struktur Gaji, Kalkulasi, Slip Gaji PDF
│   │   ├── fleet/                      # Form Pinjam Publik, Check-in/out, BBM, Kerusakan
│   │   ├── staff/                      # Kelola Akun Staf & Penugasan Unit
│   │   ├── reports/                    # Laporan Lintas Modul & Export Excel
│   │   ├── notifications/              # Pusat Notifikasi & Task Alert
│   │   └── settings/                   # Konfigurasi Organisasi, Periode, Tarif
│   ├── services/                       # API Wrappers & Supabase Queries
│   ├── hooks/                          # Custom Hooks (useUnit, usePermission, etc.)
│   ├── types/                          # TypeScript Interfaces & Database Schema Types
│   ├── utils/                          # Formatter (Currency, Date), Calculators
│   └── validations/                    # Zod Schemas
├── supabase/
│   ├── migrations/                     # SQL Migrations Berurutan
│   ├── functions/                      # Supabase Edge Functions
│   ├── seeds/                          # Data Awal Resmi (Unit, Role, Karyawan Default)
│   └── tests/                          # SQL Test Scripts
├── tests/
│   ├── unit/                           # Pengujian logika bisnis murni
│   ├── integration/                    # Pengujian hooks & service layer
│   └── e2e/                            # Playwright / Vitest E2E workflows
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## 7. Rangkuman Verifikasi Phase 0
Arsitektur di atas memastikan fondasi KUK Management System berdiri di atas landasan yang kokoh:
1. **Tidak Bergantung pada Kode Lama**: Struktur monolitik lama digantikan oleh arsitektur berlapis yang modern, bersih, dan berorientasi jangka panjang.
2. **Kesiapan Eksekusi**: Setiap modul memiliki batas tanggung jawab (*boundary*) yang tegas sehingga pengembangan per fase dapat berjalan tanpa risiko tumpang tindih.

