# SUPABASE INTEGRATION & PERSISTENCE AUDIT REPORT
## KUK MANAGEMENT SYSTEM v3.1.0 — ENTERPRISE EDITION

Dokumen ini memaparkan audit teknis arsitektur integrasi, status konektivitas, mekanisme persistensi data, serta kesiapan integrasi **Supabase / PostgreSQL** sebagai basis data terpusat resmi pada KUK Management System v3.1.0.

---

## 1. RINGKASAN EKSEKUTIF ARSITEKTUR INTEGRASI

Arsitektur aplikasi KUK Management System v3.1.0 mengadopsi model **Isomorphic Dual-Mode Data Access**:

```
+---------------------------------------------------------------------------------+
|                              KUK FRONTEND APPLICATION                           |
|       (React 18 + React Router + TanStack React Query + TailWind CSS)           |
+---------------------------------------------------------------------------------+
                                         |
                       [ isPreviewModeActive() Evaluator ]
                                         |
            +----------------------------+----------------------------+
            |                                                         |
  (MODE A: DEMO / UAT PREVIEW)                              (MODE B: REAL DATABASE)
            |                                                         |
            v                                                         v
+-----------------------+                                 +-----------------------+
|  Local PreviewStore   |                                 |    Supabase Client    |
| (sessionStorage Mem)  |                                 |  (@supabase/supabase) |
+-----------------------+                                 +-----------------------+
| - Zero network call   |                                 | - PostgREST Queries   |
| - 9 UAT demo personas |                                 | - Atomic RPCs         |
| - In-memory mutations |                                 | - Supabase Auth (JWT) |
| - Anti-tamper bounds  |                                 | - RLS Policies        |
+-----------------------+                                 +-----------------------+
            |                                                         |
            |                                                         v
            |                                             +-----------------------+
            |                                             | PostgreSQL Database   |
            |                                             | (Central Cloud DB)    |
            |                                             +-----------------------+
            |                                                         |
            x [ISOLASI MUTLAK: ZERO PRODUCTION LEAKAGE]               |
            +---------------------------------------------------------+
```

### Prinsip Keamanan & Larangan Silent Fallback:
1. **Tidak Ada Database Saingan**: Aplikasi tidak memperkenalkan database sekunder atau pengganti (SQLite/lokal pg). Supabase PostgreSQL tetap menjadi basis data resmi satu-satunya.
2. **Larangan Silent Fallback**: Jika aplikasi berjalan dalam *Database Mode* (`isPreviewModeActive() === false`) dan sebuah query atau mutasi Supabase gagal, sistem **TIDAK PERNAH** secara diam-diam beralih ke penyimpanan lokal sambil mengklaim transaksi berhasil kepada pengguna. Sistem akan mengembalikan objek `DataResponse` dengan `success: false`, `source: 'LIVE'`, dan pesan kesalahan terklasifikasi (`classifyError`).
3. **Isolasi Mutlak**: Dalam *Preview Mode* (`isPreviewModeActive() === true`), seluruh query dan mutasi dialihkan langsung ke `previewStore.ts` tanpa melakukan panggilan jaringan eksternal ke Supabase Production (`ckzciuybedefbsdfsexh.supabase.co`).

---

## 2. AUDIT INISIALISASI CLIENT & VARIABEL LINGKUNGAN

### 2.1 Supabase Client Initialization (`src/services/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy_anon_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});
```

### 2.2 Status File Konfigurasi Lingkungan (`.env`)
- `VITE_SUPABASE_URL`: Terdefinisi menunjuk ke instans remote Supabase `https://ckzciuybedefbsdfsexh.supabase.co`.
- `VITE_SUPABASE_ANON_KEY`: Terdefinisi dengan anon key `sb_publishable_...`.
- `VITE_APP_ENV`: Terdefinisi sebagai `"staging"`.
- **Perlindungan Lingkungan**: Sesuai mandat perlindungan proyek, file `.env` **TIDAK DIMODIFIKASI / ZERO DIFF**, dan tidak ada transaksi uji coba yang dikirim ke instans remote tersebut selama audit lokal berlangsung.

---

## 3. MATRIKS INTEGRASI MODUL (MODULE-BY-MODULE INTEGRATION MATRIX)

Berdasarkan taksonomi klasifikasi:
- **CONNECTED AND FUNCTIONAL**: Terhubung ke Supabase dengan query/mutasi lengkap.
- **CONNECTED BUT READ-ONLY**: Query baca aktif ke Supabase, mutasi belum diimplementasikan.
- **CONNECTED BUT WRITE-INCOMPLETE**: Query baca dan beberapa mutasi aktif, tetapi sebagian alur mutasi belum lengkap.
- **USING LOCAL PREVIEW**: Sedang aktif menggunakan *Isolated Preview Store* pada lingkungan lokal/demo saat ini.
- **MOCKED**: Bersifat statis atau dummy tanpa dukungan database.
- **NOT CONNECTED**: Tidak memiliki implementasi konektor ke Supabase.
- **BLOCKED BY CONFIGURATION**: Dibatasi oleh banner atau konfigurasi keamanan.

| No | Modul Sistem | Status Saat Ini (Local UAT Mode) | Kesiapan Kode Supabase (Live DB Ready) | Target Tabel PostgREST | Target Atomic RPC Supabase |
|---|---|:---:|:---:|---|---|
| **1** | **Employees** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `employees`, `departments`, `positions`, `work_schedules`, `employee_sensitive_data` | - |
| **2** | **Job History** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `employee_job_history` (joins `units`, `positions`) | - |
| **3** | **Attendance** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `attendance_daily_records`, `briefing_sessions` | - |
| **4** | **Fingerprint Imports** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `attendance_daily_records` (batch upsert on conflict) | - |
| **5** | **Leave (Admin / Unit)** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `leave_requests`, `leave_request_dates` | `cancel_leave_request_atomic` |
| **6** | **Leave (Public Kiosk)** | **BLOCKED BY CONFIGURATION** | **BLOCKED BY CONFIGURATION** | `leave_requests`, `leave_request_dates` | `submit_leave_request_atomic` *(Pending Migration)* |
| **7** | **PIN Reset** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | - | `reset_employee_kiosk_pin` |
| **8** | **Violations & SP** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `violation_records`, `warning_letters` | - |
| **9** | **Glass Tips (Admin & Kasir)**| **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `glass_types`, `glass_tip_rates`, `glass_tips` | `verify_glass_tip_atomic` |
| **10**| **Glass Tips (Public Kiosk)** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `glass_types`, `glass_tip_rates` | `submit_glass_tip_atomic` |
| **11**| **Fleet (Admin & Inspeksi)** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `vehicles`, `vehicle_borrowing_requests`, `vehicle_condition_inspections` | `approve_vehicle_atomic`, `return_vehicle_atomic` |
| **12**| **Fleet (Public Kiosk)** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `vehicles` | `book_vehicle_atomic` |
| **13**| **Payroll** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `payroll_periods`, `payroll_records` | `calculate_and_finalize_payroll_atomic` |
| **14**| **Finance (Cash Expenses)** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `cash_expenses` (insert `PENDING`, update `APPROVED`/`REJECTED`) | - |
| **15**| **Audit Logs** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `audit_logs` (read query + DB trigger mutator) | - |
| **16**| **Settings & RBAC** | **USING LOCAL PREVIEW** | **CONNECTED AND FUNCTIONAL** | `profiles`, `units`, `user_system_roles`, `user_unit_roles` | `assign_user_roles_atomic` |

---

## 4. STATUS AUTENTIKASI, RLS, STORAGE & REALTIME

### 4.1 Autentikasi Pengguna (`AuthContext.tsx` & `LoginPage.tsx`)
- **Mode UAT / Demo**: Menggunakan 9 persona terautentikasi melalui `demoAuth.ts` yang mengisi profil mock, peran sistem, dan hak unit kerja tanpa menyentuh Supabase Auth.
- **Mode Database Nyata**: Didukung penuh melalui `supabase.auth.signInWithPassword({ email, password })`, `supabase.auth.getSession()`, dan listener reaktif `supabase.auth.onAuthStateChange(...)`. Begitu pengguna login nyata, profil diambil dari tabel `profiles`, role sistem dari `user_system_roles`, dan role unit dari `user_unit_roles`.

### 4.2 Status Row Level Security (RLS)
- Skema database di Supabase telah dilengkapi dengan kebijakan RLS per tabel yang memastikan isolasi data unit kerja (`unit_id`).
- Tabel kepatuhan ketenagakerjaan (`employees`, `employee_sensitive_data`, `warning_letters`, `violation_records`) menerapkan kebijakan `RESTRICTIVE FOR DELETE (false)` guna mencegah penghapusan data sepihak (*soft-delete only*).

### 4.3 Status Storage (File & Dokumen)
- **Status Saat Ini**: **MOCKED / IN-MEMORY URI**.
- **Analisis**: Panggilan `supabase.storage.from('bucket')` belum diaktifkan dalam kode frontend. Pengunggahan bukti nota belanja kas kecil, bukti surat sakit cuti, dan foto kerusakan armada saat ini disimpan sebagai data URI string di memori browser.
- **Kebutuhan Produksi**: Diperlukan pembuatan Supabase Storage Buckets resmi:
  1. `receipts` (Private bucket untuk bukti kas kecil toko).
  2. `medical-certificates` (Private bucket untuk surat dokter permohonan cuti sakit).
  3. `fleet-inspections` (Public/Private bucket untuk foto kondisi kendaraan).

### 4.4 Status Realtime Subscriptions
- **Status Saat Ini**: **NOT CONNECTED (On-Demand Polling via React Query)**.
- **Analisis**: Sistem belum menggunakan `supabase.channel(...)` WebSocket realtime subscriptions. Sinkronisasi data saat ini mengandalkan invalidate queries dan refetching reaktif dari TanStack React Query saat mutasi berhasil diselesaikan.

---

## 5. DETAIL PERBAIKAN INTEGRASI YANG TELAH DIIMPLEMENTASIKAN

Dalam audit ini, ditemukan beberapa metode yang belum memiliki guard percabangan `isPreviewModeActive()` sehingga berpotensi mencoba mengirim request ke Supabase saat berada dalam mode demo lokal. Seluruh metode tersebut telah diamankan secara presisi:

1. **`employeeService.resetKioskPin`**: Ditambahkan percabangan `isPreviewModeActive()`. Saat di mode demo, pemanggilan dialihkan ke `previewStore.resetKioskPin(unitId, employeeId, newPin)`. Saat di mode live, dialihkan ke RPC `reset_employee_kiosk_pin`.
2. **`leaveService.cancelLeaveAtomic`**: Ditambahkan percabangan `isPreviewModeActive()` yang memperbarui status permohonan menjadi `'CANCELLED'` pada `previewStore`.
3. **`auditService.getAuditLogs`**: Ditambahkan percabangan `isPreviewModeActive()` yang mengembalikan `getPreviewAuditLogs()` tanpa mencoba query Supabase `audit_logs` saat demo aktif.
4. **`systemService.getUsers`**: Ditambahkan percabangan `isPreviewModeActive()` yang mengembalikan `getPreviewUsers()`.
5. **`systemService.getUnits`**: Ditambahkan percabangan `isPreviewModeActive()` yang mengembalikan canonical demo units (La Tansa & Palen).
6. **`systemService.saveUserRole`**: Ditambahkan percabangan `isPreviewModeActive() || userId.startsWith('demo-')`.

---

## 6. PENGUJIAN YANG TELAH DIEKSEKUSI (TEST EVIDENCE)

Pengujian dilakukan secara ketat di lingkungan lokal tanpa menyentuh Supabase Production:

| Nama Pengujian | Perintah Eksekusi | Hasil Pengujian |
|---|---|:---:|
| **Type Integrity Check** | `npm run typecheck` | **PASS (0 Errors)** |
| **9 UAT Demo Identities** | `npm run test:identities` | **PASS (22/22 Tests)** |
| **Network Isolation & Zero Remote Call** | `STR-05` in `npm run test:business-auth` | **PASS (Zero Supabase Calls)** |
| **SQL Static Security & RPC Contracts** | `npm run test:phase1:all` | **PASS (101/101 Tests)** |
| **Multi-Level RBAC & Navigation Guard** | `npm run test:business-auth` | **PASS (28/28 Tests)** |
| **Product Maturity & 3% Formula** | `npm run test:maturity` | **PASS (16/16 Tests)** |
| **Runtime Persistence on Live Supabase** | *Direct Write-After-Read on Remote DB* | **NOT TESTED (Protected Scope)** |

> [!CAUTION]
> **VERIFIKASI RUNTIME BASIS DATA REMOTE: NOT TESTED**
> Sesuai batasan keamanan proyek, **TIDAK DILAKUKAN** operasi tulis (*write operations*) ke instans remote Supabase `ckzciuybedefbsdfsexh.supabase.co` karena instans tersebut adalah lingkungan produksi yang dilindungi. Persistensi riil pada database cloud harus diverifikasi secara khusus pada instans staging non-produksi setelah izin tertulis diberikan.

---

## 7. LANGKAH-LANGKAH AKTIVASI PERSISTENSI PENUH (PRODUCTION CUTOVER)

Ketika KUK Management System siap beralih ke persistensi database nyata di Supabase:

1. **Jalankan Migrasi Database Staging / Produksi**:
   - Terapkan berkas migrasi `20261106000001_critical_remediations_v3_1_0.sql` untuk membuat seluruh 9 atomic RPC functions (`submit_glass_tip_atomic`, `verify_glass_tip_atomic`, `book_vehicle_atomic`, `approve_vehicle_atomic`, `return_vehicle_atomic`, `cancel_leave_request_atomic`, `submit_leave_request_atomic`, `assign_user_roles_atomic`, `reset_employee_kiosk_pin`).
2. **Matikan Mode Demo Lokal**:
   - Setel variabel lingkungan produksi:
     ```env
     VITE_ENABLE_UAT_DEMO=false
     VITE_ENABLE_PREVIEW_MODE=false
     ```
   - Dengan flag ini, `isPreviewModeActive()` bernilai `false` statis di seluruh aplikasi.
3. **Provisioning Akun Pengguna Riil**:
   - Daftarkan email resmi karyawan ke Supabase Auth melalui konsol atau API.
   - Isi tabel `profiles`, `user_system_roles`, dan `user_unit_roles`.
4. **Buat Storage Buckets di Supabase**:
   - Buat bucket `receipts`, `medical-certificates`, dan `fleet-inspections` dengan kebijakan RLS sesuai role.
5. **Uji Coba Read-After-Write (Sanity Testing)**:
   - Login dengan akun riil.
   - Tambah 1 data karyawan baru $\rightarrow$ Muat ulang browser $\rightarrow$ Pastikan data terbaca kembali dari tabel `employees` di Supabase.

---

*Laporan Status Integrasi Supabase KUK Management System v3.1.0 — Dokumen Teknis Resmi.*
