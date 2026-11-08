# PHASE 1C.3 — PRODUCTION DATA ARCHITECTURE, MULTI-DEVICE & REALTIME READINESS AUDIT
## KUK Management System v3.1.0

**Tanggal Audit:** 2026-11-08 17:40:00 +07:00  
**Auditor Roles:** Senior Supabase Architect, Database Security Engineer, Frontend Integration Auditor  
**Baseline Git:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Production Target:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — **STRICTLY READ-ONLY / UNTOUCHED**  
**Arsitektur Database:** Single Centralized PostgreSQL 17.11 Instance (Tokyo Region)  
**Status Evaluasi:** **READ-ONLY LOCAL ARCHITECTURAL AUDIT**  

---

## 1. EXECUTIVE SUMMARY

Audit ini mengevaluasi kesiapan arsitektur data **KUK Management System v3.1.0** untuk beroperasi secara aman dan andal menggunakan **satu database Supabase Production terpusat** (`ckzciuybedefbsdfsexh`) yang diakses secara simultan dari beragam perangkat operasional (desktop admin, laptop manajer, smartphone staf, dan tablet kiosk publik), serta kesiapan sistem dalam mengadopsi sinkronisasi data real-time.

### Temuan Kunci Audit:
1. **Single Source of Truth:** Seluruh modul frontend menggunakan satu Supabase client singleton (`src/services/supabase.ts`). Tidak ada `localStorage` yang dijadikan media penyimpanan utama data operasional bisnis. Mode pratinjau (`KUK_PREVIEW_MODE`) telah diamankan secara ketat sehingga tertolak secara default pada build Production.
2. **Multi-Device Readiness:** Autentikasi berbasis JWT dengan penyimpanan token pada browser masing-masing perangkat (`localStorage`). Batasan hak akses multi-unit tidak bergantung pada state browser, melainkan ditegakkan langsung oleh RLS policies di database (`has_unit_access(unit_id)`).
3. **Realtime Status:** Fitur Supabase Realtime saat ini **BELUM DIIMPLEMENTASIKAN** di seluruh modul frontend (0 panggilan `.channel()`, 0 listener `postgres_changes`). Pembaruan data saat ini mengandalkan kueri saat navigasi halaman (*on-mount / refetch*).
4. **Data Concurrency & Atomicity:** Operasi sensitif telah dilindungi oleh fungsi atomic RPC dengan *row-level locking* (`FOR UPDATE`) dan *exclusion constraints* (`23P01`), namun masih berstatus draft migration lokal (`20261105000002_security_rpc_and_remediation.sql`) dan belum diterapkan ke Production.
5. **Keterbatasan Pengujian:** Tanpa lingkungan pengujian PostgreSQL/Supabase runtime lokal, seluruh verifikasi perilaku database berstatus `STATICALLY VERIFIED` atau `SIMULATED`.

**Verdict Keseluruhan:** **`READY WITH LIMITATIONS`**  
*(Sistem siap untuk implementasi lokal bertahap, namun memerlukan tindakan verifikasi manual pada Supabase Dashboard dan penerapan draft migration sebelum dapat dinyatakan siap secara operasional penuh).*

---

## 2. ARCHITECTURE OVERVIEW

Sistem dirancang sebagai **Single Database Multi-Tenant Unit** dengan topologi sebagai berikut:

```text
[ Desktop Admin TB KUK La Tansa ]   [ Laptop Admin KUK Palen ]   [ Tablet Kiosk Publik ]   [ HP Karyawan ]
             │                                   │                           │                     │
             └───────────────────────────────────┼───────────────────────────┴─────────────────────┘
                                                 ▼
                             HTTPS (REST / RPC / Supabase JS Client v2)
                                                 │
                                                 ▼
                     ┌───────────────────────────────────────────────────────┐
                     │          SUPABASE PRODUCTION (Tokyo / PG 17.11)       │
                     │          Project Ref: ckzciuybedefbsdfsexh            │
                     │                                                       │
                     │  ┌─────────────────────────────────────────────────┐  │
                     │  │ GoTrue Auth Service (JWT Session & Claims)      │  │
                     │  └─────────────────────────────────────────────────┘  │
                     │  ┌─────────────────────────────────────────────────┐  │
                     │  │ PostgREST API Gateway                           │  │
                     │  └─────────────────────────────────────────────────┘  │
                     │  ┌─────────────────────────────────────────────────┐  │
                     │  │ PostgreSQL Engine (v17.11)                      │  │
                     │  │  - Row Level Security (RLS) Multi-Tenant        │  │
                     │  │  - Master Roles & Permissions Matrix            │  │
                     │  │  - Exclusion Constraints (Armada 23P01)         │  │
                     │  │  - Atomic SECURITY DEFINER RPCs                 │  │
                     │  │  - Immutability Triggers (Audit Logs)           │  │
                     │  └─────────────────────────────────────────────────┘  │
                     │  ┌─────────────────────────────────────────────────┐  │
                     │  │ Realtime Engine (Dormant / Belum Diaktifkan)    │  │
                     │  └─────────────────────────────────────────────────┘  │
                     └───────────────────────────────────────────────────────┘
```

- **TB KUK La Tansa:** Unit ritel bahan bangunan.
- **KUK Palen:** Unit ritel kebutuhan harian dan listrik.
- **Kantor Pusat:** Manajemen lintas unit dengan hak agregat super-admin / central-admin.

---

## 3. SINGLE SOURCE OF TRUTH ASSESSMENT

| Indikator Evaluasi | Status Klasifikasi | Bukti / Penjelasan Teknis |
| :--- | :---: | :--- |
| **Konsistensi Supabase Client** | `VERIFIED IN SOURCE` | Inisialisasi tunggal di `src/services/supabase.ts` diekspor sebagai singleton dan diimpor seragam oleh `AuthContext`, `UnitContext`, dan `dataService.ts`. |
| **Data Operasional Asli** | `STATICALLY VERIFIED` | Seluruh operasi baca diarahkan ke tabel Supabase riil (`employees`, `leave_requests`, `glass_tips`, `vehicles`, `payroll_periods`, dll.). |
| **Penyimpanan Lokal (localStorage)** | `VERIFIED IN SOURCE` | `localStorage` HANYA digunakan untuk Supabase Auth session token (`sb-ckzciuybedefbsdfsexh-auth-token`) dan toggle pratinjau dev. Tidak ada data bisnis yang disimpan di storage browser. |
| **Pencegahan Mock Diam-diam** | `STATICALLY VERIFIED` | `resolveDataResponse()` dan `handleServiceCatch()` hanya mengembalikan fixture jika `isPreviewModeActive() === true`. Jika non-aktif, error database dikembalikan secara transparan (`success: false`). |
| **Isolasi Preview Mode** | `VERIFIED IN SOURCE` | `isPreviewModeActive()` menolak aktivasi pada lingkungan `PROD` secara permanen kecuali flag build `VITE_ENABLE_PREVIEW_MODE=true` diset. |
| **Pemisahan Empty vs Error** | `STATICALLY VERIFIED` | Database kosong (`data: []`) menghasilkan `{ success: true, data: [], error: null }`. Error koneksi menghasilkan `{ success: false, data: [], error: <error_info> }`. |
| **Diferensiasi RLS Error** | `STATICALLY VERIFIED` | Error PostgreSQL `42501` diklasifikasikan eksplisit sebagai `Akses ditolak: Anda tidak memiliki izin untuk mengakses data ini (RLS Denied)`. Tidak disamarkan sebagai data kosong. |
| **Integritas Mutasi Data** | `STATICALLY VERIFIED` | Seluruh mutasi mengembalikan `{ success: boolean, message: string }`. Tidak ada *silent fallback success* saat kueri database gagal. |

---

## 4. MODULE DATA SOURCE MATRIX

Inventarisasi sumber data dan alur mutasi pada setiap modul aplikasi:

| Modul | Sumber Data Baca | Operasi Mutasi Utama | Penanganan Error / Empty | Status Integrasi |
| :--- | :---: | :---: | :---: | :---: |
| **Dashboard** | LIVE (Supabase) | Read-only aggregate (`Promise.all`) | Banner error / Empty state jika 0 record | `STATICALLY VERIFIED` |
| **Employees** | LIVE (Supabase) | Direct `.insert()`, `.update()` & RPC `reset_employee_kiosk_pin` | Banner error / Empty state terpisah | `STATICALLY VERIFIED` |
| **Leave (Admin)** | LIVE (Supabase) | Direct `.update()` & RPC `cancel_leave_atomic` | Banner error / Empty state terpisah | `STATICALLY VERIFIED` |
| **Leave (Kiosk Public)** | LIVE (Supabase) | RPC `submit_leave_request_atomic` | **FORM DINONAKTIFKAN** (BLOCKED banner) | `BLOCKED` (Menunggu Phase 1C Backend) |
| **Attendance** | LIVE (Supabase) | Direct `.insert()` ke `briefing_sessions` & `daily_attendance` | Banner error / Empty state terpisah | `STATICALLY VERIFIED` |
| **Violations** | LIVE (Supabase) | Direct `.insert()` ke `violation_records` & `warning_letters` | Banner error / Empty state terpisah | `STATICALLY VERIFIED` |
| **Glass Tips (Admin)** | LIVE (Supabase) | RPC `verify_glass_tip_atomic` | Traps RLS / RPC errors secara transparan | `STATICALLY VERIFIED` |
| **Glass Tips (Kiosk)** | LIVE (Supabase) | RPC `submit_glass_tip_atomic` | Rate limit & Lockout feedback terintegrasi | `STATICALLY VERIFIED` |
| **Payroll** | LIVE (Supabase) | RPC `finalize_payroll_atomic` | Lock row `FOR UPDATE` | `STATICALLY VERIFIED` |
| **Fleet (Admin)** | LIVE (Supabase) | RPC `approve_vehicle_atomic` | Traps exclusion conflict `23P01` | `STATICALLY VERIFIED` |
| **Fleet (Kiosk)** | LIVE (Supabase) | RPC `book_vehicle_atomic` | Traps overlap range `23P01` & rate limits | `STATICALLY VERIFIED` |
| **Audit Logs** | LIVE (Supabase) | Read-only (`.from('audit_logs')`) | Trigger PostgreSQL menolak UPDATE/DELETE | `STATICALLY VERIFIED` |
| **Settings** | LIVE (Supabase) | Direct `.update()` ke `user_profiles` | RBAC guard (Super Admin only) | `STATICALLY VERIFIED` |

---

## 5. MULTI-DEVICE ARCHITECTURE AUDIT

### 5.1. Analisis Kesiapan Akses Simultan Multi-Perangkat

1. **Koneksi Terpusat:** Seluruh perangkat terhubung ke instance database yang sama (`ckzciuybedefbsdfsexh.supabase.co`). Perubahan data dari perangkat manapun langsung tersimpan pada PostgreSQL engine terpusat.
2. **Independensi Browser Client:** Tidak ada ketergantungan pada *local state* browser antar-perangkat. Sinkronisasi antarperangkat terjadi saat kueri dieksekusi ke backend.
3. **Session Authentication & Multi-Device Login:**
   - Supabase Auth mendukung login konkuren dari beberapa perangkat untuk satu akun yang sama. Masing-masing perangkat memegang refresh token dan JWT tersendiri di `localStorage`.
   - `autoRefreshToken: true` pada client menjamin sesi diperbarui secara transparan tanpa mengganggu operasional.
4. **Isolasi Multi-Tenant & Penegakan Scope Unit:**
   - Unit filter pada frontend (`UnitContext`) bersifat *advisory UI filter*.
   - Keamanan sesungguhnya ditegakkan di level database oleh PostgreSQL RLS policies (`has_unit_access(id)`). Manipulasi `localStorage` atau request header oleh staf La Tansa **TIDAK BISA** menembus data KUK Palen karena RLS memvalidasi relasi `user_unit_roles` berbasis `auth.uid()`.
5. **Pencegahan Double Submission:**
   - Tombol simpan/submit pada form modal (`EmployeeFormModal`, `CreateLeaveModal`, form kiosk) dilindungi oleh flag state lokal `isSubmitting` / `isProcessing` (`disabled={isSubmitting}`).

### 5.2. Evaluasi Skenario Multi-Perangkat

| Skenario Operasional Multi-Perangkat | Analisis Resiko & Penanganan Sistem | Status |
| :--- | :--- | :---: |
| **1. Admin La Tansa mengubah data karyawan** | Mutasi tersimpan ke database. Perangkat Admin Palen tidak melihat data ini karena isolasi unit RLS (`unit_id = latansa`). | `STATICALLY VERIFIED` |
| **2. Admin Palen membuka data unitnya** | Kueri mengeksekusi `eq('unit_id', palen)`. Data La Tansa tersembunyi total. | `STATICALLY VERIFIED` |
| **3. Admin Pusat melihat lintas unit** | Role `super_admin` / `admin_pusat` melewati filter unit dan melihat agregasi kedua unit secara sah. | `STATICALLY VERIFIED` |
| **4. Karyawan mengajukan cuti via HP** | Form kiosk cuti saat ini berstatus `BLOCKED` untuk mencegah pengajuan tanpa validasi PIN backend. | `STATICALLY VERIFIED` |
| **5. Dua perangkat login akun yang sama** | Supabase Auth mendukung multi-session. Mutasi dari perangkat A langsung tercermin di DB; perangkat B melihat data terbaru setelah refetch/navigasi. | `STATICALLY VERIFIED` |
| **6. Dua admin menyetujui armada bersamaan** | RPC `approve_vehicle_atomic` mengunci baris `FOR UPDATE` dan menangkap konflik exclusion range `23P01`. | `SIMULATED` (Butuh PG Runtime) |
| **7. Sesi kadaluarsa saat transaksi** | Client menangkap respons token expired (`401 / PGRST301`) via `classifyError('AUTH_EXPIRED')`, menampilkan pesan sesi berakhir dan menghentikan mutasi tanpa merusak data. | `STATICALLY VERIFIED` |

---

## 6. SUPABASE REALTIME READINESS AUDIT

### 6.1. Inventarisasi Penggunaan Realtime di Kode Sumber

Pemeriksaan komprehensif terhadap seluruh berkas di direktori `src/`:
- Panggilan `supabase.channel()`: **0 DITEMUKAN**
- Listener `postgres_changes`: **0 DITEMUKAN**
- Penggunaan Broadcast / Presence: **0 DITEMUKAN**

### 6.2. Tabel Kesiapan Realtime per Modul

| Modul | Realtime Implemented | Tabel Target | Event Kritis | Kebutuhan Filter Unit | Urgensi Realtime | Status Saat Ini |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard** | TIDAK | Agregat | `INSERT`, `UPDATE` | `unit_id = eq.<unit>` | Sedang | `NOT IMPLEMENTED` |
| **Employees** | TIDAK | `employees` | `INSERT`, `UPDATE` | `unit_id = eq.<unit>` | Rendah (Refetch cukup) | `NOT IMPLEMENTED` |
| **Leave** | TIDAK | `leave_requests` | `INSERT`, `UPDATE` | `unit_id = eq.<unit>` | **TINGGI** (Notifikasi Cuti) | `NOT IMPLEMENTED` |
| **Attendance** | TIDAK | `daily_attendance` | `INSERT`, `UPDATE` | `unit_id = eq.<unit>` | **TINGGI** (Monitoring Hadir) | `NOT IMPLEMENTED` |
| **Violations** | TIDAK | `violation_records` | `INSERT` | `unit_id = eq.<unit>` | Rendah (Refetch cukup) | `NOT IMPLEMENTED` |
| **Glass Tips** | TIDAK | `glass_tips` | `INSERT`, `UPDATE` | `unit_id = eq.<unit>` | **KRITIS** (Kasir Verifikasi) | `NOT IMPLEMENTED` |
| **Payroll** | TIDAK | `payroll_periods` | `UPDATE` | `unit_id = eq.<unit>` | Rendah (Batch bulanan) | `NOT IMPLEMENTED` |
| **Fleet** | TIDAK | `vehicle_borrowing_requests` | `INSERT`, `UPDATE` | `unit_id = eq.<unit>` | **KRITIS** (Koordinator Armada)| `NOT IMPLEMENTED` |
| **Audit Logs** | TIDAK | `audit_logs` | `INSERT` | `unit_id = eq.<unit>` | Tidak Disarankan (Heavy) | `NOT IMPLEMENTED` |

> [!WARNING]
> **Status Realtime Production:** Pada Supabase Cloud Production, publikasi `supabase_realtime` secara default tidak mencakup tabel bisnis kustom kecuali ditambahkan melalui perintah DDL (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`). Status konfigurasi publikasi di Production saat ini adalah **`NOT VERIFIED`** (tidak dapat dicek tanpa akses remote/dashboard).

---

## 7. DATA CONSISTENCY & CONCURRENT OPERATIONS

Audit terhadap potensi konflik data bersamaan (*race conditions*):

| Skenario Konkurensi | Mekanisme Proteksi Arsitektur | Lokasi Implementasi | Status Evaluasi |
| :--- | :--- | :--- | :---: |
| **Dua booking armada bentrok** | PostgreSQL Exclusion Constraint `EXCLUDE USING gist (...)` melempar SQLSTATE `23P01`. | `20261104000001` & `fleetService.ts` | `SIMULATED` / `NOT TESTED (PG)` |
| **Dua verifikasi tip kaca simultan** | RPC `verify_glass_tip_atomic` menggunakan `SELECT ... FOR UPDATE` dan memverifikasi `status = 'PENDING'`. Request kedua ditolak. | `20261105000002` (Line 430) | `SIMULATED` / `NOT TESTED (PG)` |
| **Dua finalisasi payroll bersamaan** | RPC `finalize_payroll_atomic` mengunci baris periode `FOR UPDATE` dan memvalidasi `status != 'FINALIZED'`. | `20261104000001` (Line 1150) | `SIMULATED` / `NOT TESTED (PG)` |
| **Replay / spam nota tip kaca** | RPC `submit_glass_tip_atomic` memanggil `check_and_increment_rate_limit` (maks 10 request/menit per IP & kode karyawan). | `20261105000002` (Line 350) | `SIMULATED` / `NOT TESTED (PG)` |
| **Konkurensi update data karyawan** | Menggunakan mekanisme Last-Write-Wins (LWW). Belum ada kolom versioning (`version_id` / optimistic locking). | Frontend direct update | `PARTIALLY IMPLEMENTED` |
| **Double-click tombol form** | State `isSubmitting` menonaktifkan tombol submit secara instan saat permintaan pertama dikirim. | React components | `VERIFIED IN SOURCE` |

---

## 8. BACKUP, RECOVERY & DATA DURABILITY AUDIT

### 8.1. Evaluasi Perlindungan Data Aktual

1. **Version Control Schema & Migrations:**  
   Seluruh skema database terlindungi di bawah Git version control (`supabase/migrations/`). Tiga migration mendefinisikan skema secara lengkap dan deterministik.
2. **Immutabilitas Jejak Audit (`audit_logs`):**  
   Trigger database `trg_protect_audit_logs` melempar pengecualian `P0001` pada setiap usaha `UPDATE` atau `DELETE`. Tidak ada operator atau aplikasi yang dapat mengubah atau menghapus jejak log audit.
3. **Pencegahan Hard-Delete Tidak Sengaja:**  
   Empat tabel kepatuhan ketenagakerjaan (`employees`, `employee_sensitive_data`, `leave_requests`, `payroll_records`) dilindungi oleh policy `AS RESTRICTIVE FOR DELETE TO authenticated USING (false)`. Penghapusan fisik data dilarang mutlak di level engine.
4. **Soft Delete & Deactivation:**  
   Entitas bisnis menggunakan status non-aktif (`status = 'INACTIVE'`, `is_active = false`) alih-alih penghapusan baris.

### 8.2. Keterbatasan Konfigurasi Cadangan (Production Backup)
- Status otomatisasi backup harian (*Daily Backup*), retensi cadangan, dan ketersediaan Point-in-Time Recovery (PITR) pada project `ckzciuybedefbsdfsexh` berstatus **`NOT VERIFIED`** dari kode sumber lokal.
- Sesuai batasan mutlak, tidak ada perubahan atau kueri administratif yang dijalankan ke Production.

### 8.3. Tindakan Manual yang Wajib Diperiksa Pengguna di Supabase Dashboard:
1. Buka **Supabase Dashboard** → Project `ckzciuybedefbsdfsexh` → **Project Settings** → **Database** → **Backups**.
2. Pastikan status **Daily Automated Backups** aktif.
3. Periksa jendela retensi cadangan (Free tier: 1-7 hari; Pro tier: 30 hari / PITR).
4. Buat SOP ekspor data mandiri: Lakukan dump skema dan data berkala (`pg_dump` atau ekspor CSV melalui Dashboard Table Editor) minimal 1 minggu sekali untuk tabel kritis (`employees`, `payroll_records`, `glass_tips`).

---

## 9. NETWORK & OFFLINE BEHAVIOR

Audit terhadap perilaku aplikasi pada kondisi jaringan abnormal:

| Kondisi Jaringan | Respon & Penanganan Sistem | Kategori Error | Status Kepatuhan |
| :--- | :--- | :---: | :---: |
| **Koneksi Internet Terputus** | Ditangkap oleh `classifyError()`. Menampilkan banner: *"Gagal terhubung ke database server. Periksa koneksi internet Anda."* | `NETWORK_ERROR` | `VERIFIED IN SOURCE` |
| **Request Timeout / Latency Tinggi** | Ditangkap oleh `classifyError()`. Menampilkan: *"Koneksi ke database server melebihi batas waktu (Request Timeout)."* | `TIMEOUT` | `VERIFIED IN SOURCE` |
| **Sesi Auth Expired di Tengah Jalan** | Ditangkap oleh `classifyError()`. Menampilkan: *"Sesi autentikasi telah berakhir. Silakan login kembali."* | `AUTH_EXPIRED` | `VERIFIED IN SOURCE` |
| **Browser Ditutup Saat Mutasi Berjalan** | Transaksi RPC PostgreSQL bersifat atomik (semua berhasil atau semua gagal via `BEGIN/COMMIT`). Tidak meninggalkan *half-written state*. | Database ACID | `STATICALLY VERIFIED` |
| **Pencegahan Duplicate Retry** | Klien tidak mengimplementasikan antrean offline otomatis (*no reckless auto-retry queue*), mencegah penggandaan transaksi nota tip atau booking armada saat koneksi pulih. | Client Design | `VERIFIED IN SOURCE` |

---

## 10. PERFORMANCE & CONNECTION EFFICIENCY

1. **Singleton Client Instance:** Hanya 1 instance `createClient` yang hidup dalam memori aplikasi (`src/services/supabase.ts`), mencegah kebocoran koneksi WebSocket atau pool koneksi REST.
2. **Scoping Kueri Unit:** Sebagian besar kueri menyertakan `.eq('unit_id', unitId)`, memanfaatkan index btree pada kolom `unit_id`.
3. **Paging & Data Limits:** Kueri jejak audit dibatasi dengan `.limit(100)`. Namun beberapa kueri operasional (`employees`, `glass_tips`) belum memiliki pagination server-side (masih mengambil seluruh record unit aktif).
4. **Dashboard Query Efficiency:**  
   Fungsi `getDashboardSummary` menjalankan 7 kueri paralel via `Promise.all`:
   ```ts
   [empRes, leaveRes, tipRes, fleetRes, violRes, attRes, payRes] = await Promise.all([...]);
   ```
   *Rekomendasi Arsitektur:* Meskipun paralel, 7 HTTP roundtrip dapat membebani latensi koneksi seluler. Di masa depan disarankan membuat 1 RPC komprehensif `get_dashboard_summary_atomic(p_unit_id)` untuk memangkas 7 request menjadi 1 roundtrip.

---

## 11. SECURITY FINDINGS SUMMARY

1. **Status Migrasi Lokal:** Draft migration `20261105000002_security_rpc_and_remediation.sql` telah memenuhi seluruh standar keamanan (46/46 validasi lulus: revoke execute PUBLIC, atomic rate limiting, IP extraction defense, dummy bcrypt timing, restrictive delete policies). Namun, migration ini **BELUM DITERAPKAN KE PRODUCTION**.
2. **Public Leave Kiosk:** Jalur pengajuan cuti mandiri kiosk secara sah dinonaktifkan (`BLOCKED`) karena skema backend belum menyediakan RPC autentikasi PIN mandiri.
3. **No Direct UPDATE on Sensitive Tables:** Frontend telah dibersihkan dari direct update pada `glass_tips` dan `vehicle_borrowing_requests`, sepenuhnya dialihkan ke RPC `verify_glass_tip_atomic` dan `approve_vehicle_atomic`.

---

## 12. UNVERIFIED PRODUCTION CONFIGURATIONS (MEMERLUKAN TINDAKAN PENGGUNA)

Karena audit dilakukan strictly read-only tanpa menyentuh server Production, konfigurasi berikut **TIDAK DAPAT DIVERIFIKASI DARI LOKAL** dan memerlukan pemeriksaan manual oleh pengguna:

1. **Supabase Realtime Publication:** Apakah tabel `glass_tips`, `vehicle_borrowing_requests`, `leave_requests`, dan `daily_attendance` sudah dimasukkan ke dalam publikasi `supabase_realtime` di Production? *(Status: `NOT VERIFIED`)*
2. **Database Backup & PITR:** Berapa lama periode retensi backup aktif pada project `ckzciuybedefbsdfsexh`? *(Status: `NOT VERIFIED`)*
3. **PostgreSQL Extension State di Production:** Apakah extension `btree_gist` dan `pgcrypto` sudah terinstal di database Production? *(Status: `NOT VERIFIED`)*
4. **Draft Migration 20261105000002 Status:** Belum diterapkan ke Production. *(Status: `LOCAL DRAFT ONLY`)*

---

## 13. POSTGRESQL RUNTIME LIMITATIONS

Pengujian saat ini didasarkan pada static AST verification, TypeScript typecheck, Vite build, dan in-memory simulation (`scripts/test_phase1b_runtime_simulation.cjs` & `scripts/test_phase3_logic.cjs`).
Keterbatasan yang tetap ada hingga runtime database riil diuji:
- Verifikasi perilaku konkurensi sesungguhnya dari PostgreSQL lock manager (`FOR UPDATE`).
- Validasi indeks GIST sesungguhnya saat dua request overlapping tiba di millisecond yang persis sama.
- Evaluasi performa kueri riil (`EXPLAIN ANALYZE`) pada PostgreSQL 17.11.

---

## 14. RECOMMENDATIONS

1. **Langkah Segera (Immediate):**
   - Pertahankan mode pratinjau dalam status terisolasi dan non-aktif di Production.
   - Tetap pertahankan status `BLOCKED` pada form kiosk cuti mandiri hingga RPC backend dirancang pada Phase 1C lanjutan.
2. **Penyusunan Rencana Realtime:**
   - Gunakan dokumen [PHASE_1C_3_REALTIME_IMPLEMENTATION_PLAN.md](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/PHASE_1C_3_REALTIME_IMPLEMENTATION_PLAN.md) sebagai panduan teknis implementasi bertahap.
   - Mulai implementasi Realtime lokal secara selektif HANYA pada 2 modul dengan urgensi tertinggi: **Glass Tips** (kasir) dan **Fleet Requests** (koordinator armada).
3. **Tindakan Verifikasi Pengguna di Supabase Production:**
   - Lakukan pemeriksaan manual di dashboard Supabase sesuai instruksi di Bagian 8.3 dan Bagian 12.

---
*Audit arsitektur selesai dengan status kepatuhan mutlak terhadap Zero Production Mutation.*

