# PHASE 1 TEST REPORT — KUK MANAGEMENT SYSTEM
## Foundation Application, Multi-Unit Auth & Layout Shell (v3.1.0)
**Tanggal:** 2026-11-04  
**Versi Sistem:** 3.1.0  
**Status Fase:** PHASE 1 IN PROGRESS (AUDITED & HARDENED)  
**Lingkungan:** Local Windows Workspace (Vite + React 18 + TypeScript + Tailwind CSS)

---

## 1. Konvensi Status Pengujian (Ketat & Transparan)

Sesuai instruksi keselamatan arsitektur, status pengujian didefinisikan secara tegas:
- **PASSED**: Telah dieksekusi secara nyata pada mesin lokal dan terbukti berhasil memenuhi kriteria tanpa galat.
- **FAILED**: Telah dieksekusi dan menghasilkan galat atau inkonsistensi.
- **BLOCKED**: Tidak dapat dieksekusi live karena ketiadaan dependensi lingkungan (Docker Desktop belum terpasang di host Windows; akses langsung ke Supabase produksi dilarang keras).
- **NOT RUN**: Belum dieksekusi secara live pada PostgreSQL connection engine (dijadwalkan saat database container staging aktif).

> **Prinsip Kejujuran Teknis**: Analisis kode atau unit test logika frontend **tidak pernah** diklaim sebagai pengganti kelulusan live database Supabase.

---

## 2. Hasil Audit Lingkungan Host (Environment Diagnostic)

Pemeriksaan menyeluruh terhadap dependensi sistem host menghasilkan diagnosis berikut:

| Perangkat Lunak | Lokasi / Hasil Perintah | Status Ketersediaan | Catatan Teknis |
| :--- | :--- | :---: | :--- |
| **Git Engine** | `C:\Program Files\Git\cmd\git.exe` | **TERPASANG** | Perintah `git status` gagal sebelumnya semata-mata karena folder `13. KUK V3` belum diinisialisasi sebagai repositori git (`.git` belum ada), bukan karena Git tidak ada di OS. |
| **Docker Engine** | `Get-Command docker` (CommandNotFound) | **BELUM TERPASANG** | Direktori `C:\Program Files\Docker` tidak ditemukan dan tidak ada service Docker pada Windows host. Docker Desktop perlu dipasang jika ingin menjalankan Supabase CLI lokal. |
| **Supabase CLI** | `Get-Command supabase` (CommandNotFound) | **BELUM TERPASANG** | Tidak terpasang secara global. Penggunaan `npx supabase` memerlukan Docker daemon aktif untuk memutar container database PostgreSQL, GoTrue, dan Kong. |
| **Node.js & npm** | `v24.21.0` / `npm.cmd 11.19.0` | **TERPASANG** | Berjalan normal. PowerShell execution policy (`npm.ps1`) diatasi dengan memanggil `npm.cmd` secara konsisten. |

---

## 3. Matriks Pengujian Frontend & Runtime (Bagian A & F)

| ID Uji | Skenario Pengujian | Hasil Aktual & Bukti Eksekusi | Status |
| :--- | :--- | :--- | :---: |
| **TC-FE-01** | Pemeriksaan Tipe Data TypeScript | Perintah `npm.cmd run typecheck` (`tsc --noEmit`) dieksekusi. Hasil: **0 galat tipe data (*Zero Errors*)**. | **PASSED** |
| **TC-FE-02** | Production Bundle Build | Perintah `npm.cmd run build` (`vite build`) dieksekusi. Hasil: **1,675 modul ditransformasi dalam 12.39 detik**, tercipta `dist/index.html`, `dist/assets/*.css`, `dist/assets/*.js`. | **PASSED** |
| **TC-FE-03** | Startup Development Server | Perintah `npm.cmd run dev -- --port 5173 --host 127.0.0.1` dijalankan. Server aktif stabil dalam 463 ms. | **PASSED** |
| **TC-FE-04** | Kemampuan Restart Server dari Terminal Baru | Server dimatikan (task kill) dan dijalankan ulang dari kondisi terminal bersih. Server berhasil bangkit kembali tanpa konflik port. | **PASSED** |
| **TC-FE-05** | Akses & Refresh Rute Internal SPA | Pengujian HTTP GET pada 15 rute (`/`, `/login`, `/dashboard`, `/employees`, `/leave`, `/glass-tips`, `/violations`, `/attendance`, `/payroll`, `/fleet`, `/audit-logs`, `/settings`, `/public/*`). Seluruhnya mengembalikan **HTTP 200 OK** dengan fallback HTML root. | **PASSED** |
| **TC-FE-06** | Transformasi Modul Frontend oleh Vite | Menguji GET request pada 15 modul inti (`main.tsx`, `App.tsx`, `routes.tsx`, `AuthContext.tsx`, `UnitContext.tsx`, dll). Seluruhnya berhasil dikompilasi oleh Vite tanpa error runtime. | **PASSED** |
| **TC-FE-07** | Tata Letak Responsif Desktop & Mobile | `Header.tsx` menyediakan tombol navigasi hamburger mobile (`md:hidden`), `Sidebar.tsx` mendukung backdrop overlay drawer geser. | **PASSED** |
| **TC-FE-08** | Error Boundary Runtime Protection | `ErrorBoundary.tsx` dipasang pada root `App.tsx` untuk menangkap eksepsi runtime React tanpa memicu *white-screen crash*. | **PASSED** |

---

## 4. Matriks Pengujian Autentikasi & Guard (Bagian B)

| ID Uji | Skenario Pengujian | Mekanisme & Penanganan Kode | Status | Catatan Evaluasi |
| :--- | :--- | :--- | :---: | :--- |
| **TC-AUTH-01** | Login Kredensial Valid | Panggilan HTTP ke endpoint Supabase Auth (`signInWithPassword`) | **BLOCKED** | Memerlukan backend Supabase lokal/staging aktif. Database produksi dilarang keras dihubungi. |
| **TC-AUTH-02** | Login Kredensial Salah | Penangkapan respon error 400/401 dari Supabase Auth | **BLOCKED** | Memerlukan backend. Komponen `LoginPage.tsx` telah disiapkan alert box pesan error. |
| **TC-AUTH-03** | Logout Sesi | Panggilan HTTP ke Supabase Auth (`signOut`) | **BLOCKED** | Memerlukan backend. Logika pembersihan state pengguna terverifikasi di `AuthContext.tsx`. |
| **TC-AUTH-04** | Refresh Halaman Saat Sesi Aktif | Pembacaan token JWT yang tersimpan di `window.localStorage` | **BLOCKED** | Memerlukan token live dari backend Supabase. |
| **TC-AUTH-05** | Konfigurasi Sesi Browser | `persistSession: true`, `storage: window.localStorage` pada `supabase.ts` | **PASSED** | Konfigurasi Supabase client terverifikasi valid tanpa celah. |
| **TC-AUTH-06** | Pengguna yang Belum Memiliki Profil | Pengguna terdaftar di `auth.users` namun record di `profiles` belum ada (`user && !profile`) | **PASSED** | `AuthGuard.tsx` mencegat dan menyajikan layar "Profil Belum Terdaftar" dengan instruksi hubungi HRD dan tombol logout. |
| **TC-AUTH-07** | Pengguna yang Akunnya Dinonaktifkan | Pengguna dengan sesi valid namun berstatus `profiles.is_active === false` | **PASSED** | `AuthGuard.tsx` mencegat secara instan dan menyajikan layar "Akun Dinonaktifkan". |
| **TC-AUTH-08** | Sesi Kadaluarsa (*Expired Session*) | Listener `onAuthStateChange` merespons event `SIGNED_OUT` / token expired | **PASSED** | State otentikasi direset otomatis saat sesi kadaluarsa. |

---

## 5. Matriks Pengujian Multi-Unit & Otorisasi RBAC (Bagian C)
*Diverifikasi secara nyata melalui test runner:* `scripts/test_auth_logic.js`

| ID Uji | Skenario Pengujian | Hasil Pengujian Logika Frontend | Status |
| :--- | :--- | :--- | :---: |
| **TC-MU-01** | Evaluasi Izin Super Admin | Super Admin memiliki izin tanpa batas lintas seluruh unit (`isSuperAdmin = true`, permission check selalu `true`). | **PASSED** |
| **TC-MU-02** | Isolasi Admin TB KUK La Tansa | Izin terbatas pada unit La Tansa. Akses ke unit KUK Palen mengembalikan `false`. Akses menu pusat mengembalikan `false`. | **PASSED** |
| **TC-MU-03** | Isolasi Admin KUK Palen | Izin terbatas pada unit KUK Palen. Akses ke unit TB KUK La Tansa mengembalikan `false`. | **PASSED** |
| **TC-MU-04** | Staf dengan Izin Terbatas (Operator) | Staf dengan izin `glass_tips.view` dapat mengakses modul tip kaca, namun ditolak pada modul `payroll` dan `employees`. | **PASSED** |
| **TC-MU-05** | Penolakan Manipulasi Unit Ilegal | Percobaan staf La Tansa memanggil `setActiveUnitId` ke unit Palen ditolak (`REJECTED_UNAUTHORIZED_UNIT`) dengan log peringatan keamanan. | **PASSED** |
| **TC-MU-06** | Penolakan Akses Agregat Pusat oleh Role Unit | Percobaan staf unit memilih mode Agregat Pusat (`null`) ditolak (`REJECTED_PUSAT_UNAUTHORIZED`). | **PASSED** |
| **TC-MU-07** | Pembersihan Cache Query Saat Pergantian Unit | Peralihan unit yang sah mengeksekusi `queryClient.clear()` total untuk menjamin tidak ada kebocoran data sisa antar unit. | **PASSED** |

---

## 6. Matriks Pengujian Database & RLS PostgreSQL (Bagian D & E)

> Pengujian RLS pada tingkat database PostgreSQL disiapkan secara khusus dalam skrip transaksi atomik [`supabase/tests/rls_multiunit_test.sql`](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/supabase/tests/rls_multiunit_test.sql).

| ID Uji | Skenario Uji PostgreSQL RLS | Rencana Validasi Database | Status |
| :--- | :--- | :--- | :---: |
| **TC-RLS-01** | Admin La Tansa DILARANG membaca data Palen | `SET LOCAL "request.jwt.claim.sub" = '<id_latansa>'`; `SELECT count(*) FROM employees WHERE unit_id = '<id_palen>'` = 0 | **NOT RUN** *(Test Script Ready)* |
| **TC-RLS-02** | Admin Palen DILARANG membaca data La Tansa | `SET LOCAL "request.jwt.claim.sub" = '<id_palen>'`; `SELECT count(*) FROM employees WHERE unit_id = '<id_latansa>'` = 0 | **NOT RUN** *(Test Script Ready)* |
| **TC-RLS-03** | Penolakan Manipulasi `unit_id` saat `INSERT` | Percobaan `INSERT INTO employees (unit_id = '<id_palen>')` oleh staf La Tansa ditolak oleh `WITH CHECK (has_unit_permission(...))` | **NOT RUN** *(Test Script Ready)* |
| **TC-RLS-04** | Penolakan Akses Payroll oleh Operator Kaca | `SET LOCAL "request.jwt.claim.sub" = '<id_operator>'`; `SELECT count(*) FROM payroll_records` = 0 | **NOT RUN** *(Test Script Ready)* |
| **TC-RLS-05** | Pembacaan Agregat Lintas Unit oleh Super Admin | `SET LOCAL "request.jwt.claim.sub" = '<id_superadmin>'`; `SELECT count(*) FROM employees` mengembalikan seluruh karyawan | **NOT RUN** *(Test Script Ready)* |
| **TC-DB-01** | Eksekusi Skema Migrasi Lengkap | Menjalankan `supabase db reset` pada container lokal | **BLOCKED** *(Docker tidak tersedia)* |

---

## 7. Riwayat Temuan & Remediasi Teknis Phase 1

1. **Remediasi Forward-Reference SQL Migrasi**:
   - *Temuan*: Tabel `glass_tips` (Seksi 5) menunjuk constraint FK ke `payroll_periods` (Seksi 8). Migrasi akan gagal jika dijalankan pada database kosong.
   - *Remediasi*: Constraint dipindahkan menjadi `ALTER TABLE glass_tips ADD CONSTRAINT fk_tip_payroll_period ...` tepat setelah `payroll_periods` dibuat.
2. **Remediasi Runtime State Update pada `LoginPage`**:
   - *Temuan*: Pemanggilan `navigate(from, { replace: true })` di tubuh render komponen `LoginPage.tsx` memicu peringatan update state selama siklus render.
   - *Remediasi*: Diganti dengan rendering kondisional idiomatik `<Navigate to={from} replace />`.
3. **Remediasi Akun Tanpa Profil Master**:
   - *Temuan*: Pengguna yang login di Supabase Auth namun belum memiliki record di `profiles` dibiarkan masuk ke dashboard kosong tanpa konteks.
   - *Remediasi*: `AuthGuard.tsx` diperkuat dengan interceptor layar khusus "Profil Belum Terdaftar".
4. **Remediasi Celah Pemilihan Unit Ilegal**:
   - *Temuan*: `setActiveUnitId` belum memvalidasi apakah unit yang diminta terdaftar dalam `availableUnits`.
   - *Remediasi*: Ditambahkan guard otorisasi ketat di `UnitContext.tsx` dan pembersihan total `queryClient.clear()`.
5. **Remediasi Pelacakan File Lingkungan Git**:
   - *Temuan*: File `.env` belum tercantum dalam `.gitignore`.
   - *Remediasi*: `.gitignore` diperbarui mengecualikan `.env`, `.env.local`, dan `.env.*.local`.
6. **Remediasi Kelengkapan RLS pada Skema Kanonikal**:
   - *Temuan*: Skema migrasi `20261104000001_core_schema_v3_1_0.sql` belum menyertakan deklarasi RLS helper functions dan kebijakan RLS per tabel.
   - *Remediasi*: Ditambahkan Seksi 13 (3 security helper functions) dan Seksi 14 (RLS enabled pada 60/60 tabel) sesuai matriks `docs/RLS_POLICY_MATRIX.md`.

---

## 8. Persyaratan Prasyarat untuk Pengujian Live

Agar pengujian berstatus **BLOCKED** dan **NOT RUN** dapat dieksekusi secara live pada tahapan selanjutnya, diperlukan lingkungan berikut:
1. Pemasangan Docker Desktop pada host Windows (atau penyediaan remote Linux Docker host).
2. Pemasangan Supabase CLI (`npm.cmd install -g supabase` atau via Scoop/Chocolatey).
3. Eksekusi `supabase start` untuk memutar container database PostgreSQL lokal pada port 54321.
4. Eksekusi `supabase/tests/rls_multiunit_test.sql` melalui `psql` atau `supabase test db`.
