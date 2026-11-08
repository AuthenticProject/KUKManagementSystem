# KUK MANAGEMENT SYSTEM v3.1.0
## PHASE 1C.1 — ISOLATED DATABASE ENVIRONMENT FEASIBILITY AUDIT

**Tanggal Audit:** 2026-11-08 17:30:00 +07:00  
**Baseline Repositori:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Status Audit:** **COMPLETED** (Inspeksi & Analisis Kelayakan Selesai)  
**Database Produksi:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — **STRICTLY ZERO ACCESS / UNTOUCHED**  

---

## 1. TUJUAN

Menentukan metode paling aman, ekonomis, dan realistis untuk melaksanakan pengujian runtime PostgreSQL (termasuk validasi schema DDL, RLS policies, trigger exclusion constraints, dan SECURITY DEFINER functions) tanpa menyentuh atau membahayakan Supabase Cloud Production.

### Identitas Lingkungan Produksi (Protected Target):
- **Project Name:** KUK Management System
- **Project Ref:** `ckzciuybedefbsdfsexh`
- **Region:** `ap-northeast-1`
- **Environment:** Production (Aktif & Operasional)
- **Status Batasan:** **DILARANG MENGAKSES, MENGIRIM QUERY, ATAU MEMUTASI PRODUCTION**

---

## 2. AUDIT LINGKUNGAN SISTEM LOKAL

Audit teknis dilakukan langsung pada sistem operasi host (Windows 11 / Node.js v24.21.0 / PowerShell) dengan hasil verifikasi sebagai berikut:

| Komponen / Perangkat Lunak | Status Ketersediaan | Bukti Pemeriksaan Perintah (Audit Command) | Keterangan Teknis |
| :--- | :---: | :--- | :--- |
| **PostgreSQL Server Lokal** | **NOT INSTALLED** | `Get-Service *postgres*` → Empty | Tidak ada service database PostgreSQL yang terpasang di Windows. |
| **psql CLI** | **NOT FOUND** | `Get-Command psql` → Not in PATH | Tidak ada utilitas klien PostgreSQL di environment path. |
| **pg_ctl CLI** | **NOT FOUND** | `Get-Command pg_ctl` → Not in PATH | Tidak ada controller server database lokal. |
| **createdb CLI** | **NOT FOUND** | `Get-Command createdb` → Not in PATH | Tidak ada utilitas pembuatan database lokal. |
| **Docker Engine / Desktop** | **NOT INSTALLED** | `Get-Command docker` / `Get-Service *docker*` → Empty | Tidak ada container runtime Docker pada host. |
| **Podman** | **NOT INSTALLED** | `Get-Command podman` → Empty | Tidak ada alternative container runtime. |
| **WSL (Windows Subsystem for Linux)** | **NOT INSTALLED** | `wsl -l -v` → *"The Windows Subsystem for Linux is not installed"* | Executable stub ada di Windows, namun distro Linux belum terpasang. |
| **Supabase CLI** | **PARTIAL (CACHED)** | `npx.cmd --no-install supabase --version` → `3.0.0` | CLI tersedia via cache `npx`, namun **tidak dapat menjalankan database lokal** tanpa Docker. |
| **Registry / Windows Installer** | **NOT FOUND** | Registry audit `HKLM/HKCU Uninstall` → 0 match | Tidak ada jejak instalasi software database di Windows registry. |

> [!IMPORTANT]
> **Kesimpulan Lingkungan Host:** Saat ini **tidak tersedia native PostgreSQL server maupun container runtime (Docker/Podman/WSL)** pada mesin lokal host. Sesuai batasan mutlak, **tidak ada software baru yang dipasang** selama audit ini.

---

## 3. AUDIT KOMPATIBILITAS MIGRATION

Pemeriksaan mendalam dilakukan terhadap 3 berkas migration:
1. `supabase/migrations/20261104000001_core_schema_v3_1_0.sql` (1.273 baris)
2. `supabase/migrations/20261104000002_harden_rpc_security.sql` (158 baris)
3. `supabase/migrations/20261105000002_security_rpc_and_remediation.sql` (795 baris)

### 3.1. Identifikasi Dependensi Teknis

#### A. PostgreSQL Version
- **Kebutuhan:** PostgreSQL 15.x ke atas (identik dengan versi Supabase Production).
- **Fitur Kritis yang Digunakan:**
  - `tstzrange` dan `tsrange` untuk range booking armada.
  - GIST index exclusion constraints.
  - Transaksional DDL dan fine-grained RLS (`RESTRICTIVE` policies).
  - Explicit function attribute `SET search_path = public, extensions, pg_temp`.

#### B. Extensions
- **`pgcrypto`:** Diperlukan oleh migration 1 untuk enkripsi PIN karyawan (`crypt(p_pin, gen_salt('bf', 8))`), verifikasi PIN karyawan, dan `gen_random_uuid()`.
- **`btree_gist`:** Kritis! Diperlukan untuk exclusion constraint peminjaman kendaraan:
  ```sql
  CONSTRAINT excl_active_vehicle_booking EXCLUDE USING gist (
      vehicle_id WITH =,
      tstzrange(start_time, estimated_return_time, '[)') WITH &&
  ) WHERE (status IN ('PENDING', 'APPROVED', 'IN_USE'));
  ```
  *Tanpa extension `btree_gist`, pembuatan tabel `vehicle_borrowing_requests` akan gagal pada native PostgreSQL.*

#### C. Supabase Auth Schema & Objects
- **Foreign Key ke `auth.users`:**
  - Pada tabel `profiles` (migration 1 baris 86):
    ```sql
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
    ```
    *Pada PostgreSQL murni, DDL ini akan gagal dengan `ERROR: relation "auth.users" does not exist` kecuali skema dan tabel `auth.users` dibuat terlebih dahulu.*
- **Fungsi Autentikasi `auth.uid()`:**
  - Digunakan di lebih dari 100 RLS policies dan fungsi helper:
    - `has_role(auth.uid(), ...)`
    - `has_unit_access(auth.uid(), ...)`
    - `has_permission(auth.uid(), ...)`
    - `profiles_update_self USING (id = auth.uid())`
    - `get_auth_unit_id()`
- **Konsep JWT Claims:**
  - PostgREST secara otomatis memetakan header Authorization JWT ke fungsi `auth.uid()`, `auth.jwt()`, dan role sesi database (`SET LOCAL ROLE authenticated`).

#### D. PostgREST Request Context (GUC Settings)
- Pada migration 3 (`20261105000002`), RPC `submit_glass_tip_atomic` dan `book_vehicle_atomic` membaca IP klien melalui GUC headers:
  ```sql
  current_setting('request.headers', true)::json->>'cf-connecting-ip'
  current_setting('request.headers', true)::json->>'x-real-ip'
  split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)
  ```
- Pada native PostgreSQL murni tanpa PostgREST, `current_setting('request.headers', true)` mengembalikan `NULL`. Fungsi telah diamankan dengan fallback `inet_client_addr()::text` dan `'unknown'`, sehingga tidak crash, tetapi ekstraksi IP berbasis header membutuhkan konfigurasi GUC eksplisit dalam sesi pengujian.

#### E. Supabase Predefined Roles
- Migration memberikan hak (`GRANT`) dan membuat kebijakan (`CREATE POLICY ... TO <role>`):
  - `anon` (pengunjung publik / kiosk tanpa login).
  - `authenticated` (pengguna dengan login Supabase Auth).
  - `service_role` (backend bypass role).
- Pada native PostgreSQL, ketiga role ini tidak ada secara default dan akan memicu error `ERROR: role "anon" does not exist` saat migration dieksekusi.

#### F. SECURITY DEFINER Functions
- Terdapat 20 fungsi `SECURITY DEFINER` dengan penguncian `search_path = public, extensions, pg_temp`.
- Berfungsi normal pada native PostgreSQL, namun mengeksekusi dengan hak pemilik fungsi (*owner*).

---

### 3.2. Matriks Klasifikasi Kompatibilitas Objek

```text
+-----------------------------------+-----------------------------------------+------------------------------------------------+
| Komponen Migration                | Klasifikasi Kategori                    | Syarat Prasyarat Pengujian                     |
+-----------------------------------+-----------------------------------------+------------------------------------------------+
| Tabel, Relasi FK internal, ENUM   | Native PostgreSQL Compatible            | PG 15+ engine                                  |
| Extension pgcrypto & btree_gist   | Native PostgreSQL Compatible            | Paket postgresql-contrib tersedia              |
| Trigger update timestamp & audit  | Native PostgreSQL Compatible            | PL/pgSQL engine                                |
| GIST Exclusion Constraint         | Native PostgreSQL Compatible            | Memerlukan btree_gist terpasang                |
| Restrictive & Permissive RLS      | Native PostgreSQL Compatible            | PG 15+ engine (memerlukan role switching)      |
| SECURITY DEFINER & search_path    | Native PostgreSQL Compatible            | PG 15+ engine                                  |
| Foreign Key `auth.users(id)`      | Requires Supabase-Specific Emulation    | Stub DDL: `CREATE SCHEMA auth; CREATE TABLE..` |
| Fungsi `auth.uid()`               | Requires Supabase-Specific Emulation    | Mock function membaca session setting          |
| Roles anon, authenticated, svc    | Requires Manual Setup                   | Script: `CREATE ROLE anon; ...`                |
| Header GUC `request.headers`      | Requires Supabase-Specific Emulation    | `SET LOCAL request.headers = '...'`            |
| GoTrue Auth & PostgREST HTTP      | Requires Actual Supabase Environment    | Full Supabase Stack / Cloud / Docker           |
+-----------------------------------+-----------------------------------------+------------------------------------------------+
```

---

## 4. EVALUASI ALTERNATIF LINGKUNGAN PENGUJIAN

Kami menganalisis secara objektif 5 alternatif lingkungan pengujian:

### Opsi A: PostgreSQL Lokal Windows (Bare-Metal)
- **Deskripsi:** Mengunduh dan memasang PostgreSQL 15/16 untuk Windows secara manual pada host.
- **Kepatuhan Terhadap Batasan:** **MELANGGAR** aturan *"Jangan memasang software baru"* jika dieksekusi sekarang tanpa izin pengguna.
- **Kemampuan:** Mampu mengeksekusi migration jika disiapkan *stub auth schema* dan *roles*.
- **Kelebihan:** Performa kueri native, tidak memerlukan Docker, konsumsi memori relatif hemat.
- **Kekurangan:** Tidak menguji PostgREST HTTP layer; tidak ada GoTrue Auth; memerlukan setup manual script mock auth (`auth.users`, `auth.uid()`); meninggalkan instalasi permanen di host.

### Opsi B: PostgreSQL melalui WSL (Ubuntu / Linux)
- **Deskripsi:** Memasang WSL 2 + Ubuntu Linux, lalu memasang PostgreSQL melalui `apt install postgresql`.
- **Kepatuhan Terhadap Batasan:** **MELANGGAR** aturan *"Jangan memasang software baru"*.
- **Kemampuan:** Paritas kernel Linux sama dengan server produksi Supabase.
- **Kelebihan:** Sangat mendekati lingkungan server Linux produksi; isolasi relatif baik.
- **Kekurangan:** WSL belum terpasang; ukuran download besar (gigabytes); setup rumit; tetap membutuhkan emulasi mock auth jika tidak menggunakan Docker.

### Opsi C: Supabase CLI Lokal Tanpa Docker
- **Deskripsi:** Menjalankan Supabase CLI secara native pada Windows tanpa Docker.
- **Analisis Teknis & Fakta Arsitektur:** **TIDAK DIDUKUNG OLEH SUPABASE**.
  - Supabase CLI mengandalkan orchestrator Docker untuk menjalankan container-container terpisah: `supabase/postgres`, `postgrest/postgrest`, `supabase/gotrue`, `supabase/storage-api`, `supabase/realtime`, dan `dhiway/kong`.
  - Perintah `supabase start` atau `supabase db start` secara teknis melakukan ping ke `/var/run/docker.sock` atau `\\.\pipe\docker_engine`. Tanpa daemon Docker aktif, perintah ini langsung abort dengan error: `Cannot connect to the Docker daemon`.
  - Oleh karena itu, Supabase CLI lokal tanpa Docker adalah **mitos teknis / tidak mungkin dijalankan**.

### Opsi D: Supabase Staging Project Terisolasi (Cloud / Akun Terpisah)
- **Deskripsi:** Menggunakan project Supabase Cloud baru yang didedikasikan secara khusus untuk Staging/Testing pada akun terpisah, terisolasi 100% dari organisasi project Production `ckzciuybedefbsdfsexh`.
- **Kepatuhan Terhadap Batasan:** Sesuai batasan mutlak, agen **dilarang membuat akun atau project baru secara sepihak**. Namun opsi ini dievaluasi sebagai opsi arsitektur masa depan atas persetujuan pengguna.
- **Kemampuan:** **100% PARITAS SEMPURNA** dengan Production (PostgreSQL 15.x, PostgREST 12, Supabase Auth GoTrue, JWT claim generation, RPC endpoints, RLS runtime enforcement).
- **Kelebihan:**
  - Menguji alur aplikasi riil: Supabase JS Client → PostgREST → RPC `submit_glass_tip_atomic` / `book_vehicle_atomic` → RLS policies.
  - Zero mock: Tidak memerlukan stub atau patch simulasi SQL.
  - Tidak membebani mesin lokal dengan instalasi software berat.
- **Kekurangan:** Memerlukan akun Supabase kedua atau upgrade kuota (karena akun saat ini sudah penuh 2 slot aktif: `cuunipngguedqttuutaa` dan `ckzciuybedefbsdfsexh`); memerlukan koneksi internet.

### Opsi E: PGlite / In-Memory WASM / Node.js Ephemeral Simulation Harness
- **Deskripsi:** Menggunakan engine PostgreSQL yang dikompilasi ke WebAssembly (PGlite oleh ElectricSQL) yang berjalan langsung di dalam proses Node.js, atau memperluas harness simulasi transaksional yang sudah terbukti pada Phase 1B/3.2.1 (`scripts/test_phase1b_runtime_simulation.cjs`).
- **Kepatuhan Terhadap Batasan:** **PATUH 100%** pada batasan lokal tanpa instalasi software host baru.
- **Kemampuan:**
  - PGlite mengeksekusi query PostgreSQL sesungguhnya di memori (WASM).
  - Mampu menjalankan syntax DDL, fungsi PL/pgSQL, dan perhitungan constraint.
- **Kelebihan:**
  - 100% terisolasi dalam memori, zero impact ke sistem host.
  - Sangat cepat, dapat diotomatisasi dalam CI/test script.
  - $0 biaya, zero network dependency.
- **Kekurangan:**
  - Extension `btree_gist` pada PGlite WASM memerlukan bundle khusus atau dependensi compiled WASM.
  - Tidak ada PostgREST HTTP layer (hanya SQL direct driver).
  - Emulasi session variable dan role switching harus diatur via command `SET LOCAL ROLE`.

---

## 5. REKOMENDASI DAN MATRIKS PERBANDINGAN

### 5.1. Matriks Evaluasi Alternatif

```text
+------------------------------------+-----------+------------+---------------+-----------------------------------------------+
| Kriteria Evaluasi                  | Opsi A    | Opsi B     | Opsi C        | Opsi D (Dedicated Cloud Staging)              | Opsi E (PGlite/Sim Harness)   |
|                                    | (PG Win)  | (PG WSL)   | (CLI No-Dock) | [REKOMENDASI UTAMA JANGKA PANJANG]           | [REKOMENDASI CADANGAN SAAT INI]|
+------------------------------------+-----------+------------+---------------+-----------------------------------------------+
| Keamanan terhadap Production       | 100% Aman | 100% Aman  | N/A (Gagal)   | 100% Aman (Isolasi Proyek Berbeda)            | 100% Aman (Lokal Memori)      |
| Biaya (Cost)                       | $0        | $0         | N/A           | $0 (Free Plan Akun Terpisah)                  | $0                            |
| Realistis Dijalankan Saat Ini      | Rendah*   | Rendah*    | Tidak Bisa    | Tinggi (Bila Pengguna Buat Proyek)            | Sangat Tinggi (Bisa Langsung) |
| Kebutuhan Install Software Host    | Ya        | Ya         | N/A           | TIDAK ADA (Cloud-native)                      | TIDAK ADA (via npm/node)      |
| Menjalankan Seluruh Migration DDL  | Ya (Stub) | Ya (Stub)  | Tidak         | YA (100% NATIVE TANPA STUB)                   | Sebagian (Constraint & DDL)   |
| Menguji RLS & SECURITY DEFINER     | Ya        | Ya         | Tidak         | YA (100% NATIVE ENGINE)                       | Ya (SQL Level)                |
| Menguji Supabase Auth & PostgREST  | Tidak     | Tidak      | Tidak         | YA (100% END-TO-END HTTP & JWT)               | Tidak (Direct SQL/Simulasi)   |
| Risiko Kebocoran ke Production     | Nol       | Nol        | Nol           | Nol (Project ID & API Key Berbeda)            | Nol                           |
+------------------------------------+-----------+------------+---------------+-----------------------------------------------+
*Rendah karena melanggar batasan "Jangan memasang software baru" pada sesi ini.
```

---

### 5.2. Keputusan Rekomendasi

#### REKOMENDASI 1 (OPSI UTAMA): Dedicated Supabase Staging Project pada Akun Terpisah
- **Status Kelayakan:** **SANGAT DIREKOMENDASIKAN UNTUK PENGUJIAN INTEGRASI PENUH (E2E)**
- **Mengapa:**
  1. Memberikan **100% paritas lingkungan** dengan production tanpa risiko merusak database produksi.
  2. Merupakan satu-satunya opsi yang memvalidasi integrasi PostgREST HTTP RPC (`supabase.rpc('submit_glass_tip_atomic', ...)`), penegakan header IP (`request.headers`), dan alur JWT token pengguna riil.
  3. Tidak memerlukan instalasi Docker Desktop atau software berat apapun pada laptop pengguna.
- **Langkah yang Diperlukan (Menunggu Tindakan Manual Pengguna):**
  1. Pengguna membuat akun Supabase gratis baru (atau menjeda proyek `cuunipngguedqttuutaa` yang tidak terpakai pada akun saat ini untuk membebaskan 1 slot gratis).
  2. Pengguna membuat project staging baru (misal: `kuk-staging-test`).
  3. Pengguna menyediakan URL dan Anon Key project staging tersebut ke environment test terpisah (misal `.env.test.local`).
  4. Migration dijalankan secara aman ke project staging terisolasi tersebut.

#### REKOMENDASI 2 (OPSI CADANGAN / IMMEDIATE): Node.js Ephemeral Simulation & SQL AST Verification Suite
- **Status Kelayakan:** **SANGAT DIREKOMENDASIKAN UNTUK PENGUJIAN OTOMATIS SAAT INI (ZERO-SOFTWARE-INSTALL)**
- **Mengapa:**
  1. Mematuhi 100% batasan absolut saat ini (zero install, zero remote call, zero mutation).
  2. Mengembangkan test suite yang telah sukses di Phase 1B dan Phase 3.2.1 (`scripts/test_phase1b_runtime_simulation.cjs` dan `scripts/test_phase3_logic.cjs`) untuk memverifikasi secara deterministik seluruh logika:
     - Rate limiter sliding window & token bucket atomicity.
     - Penolakan IP spoofing.
     - Password / PIN hashing logic dengan bcrypt timing defense.
     - Validasi exclusion range waktu peminjaman kendaraan.
     - Contract payload data service frontend terhadap response database.
- **Keterbatasan yang Harus Diakui:**
  - Tidak menjalankan proses PostgreSQL engine biner yang sesungguhnya.
  - Tidak memvalidasi parser query C-engine PostgreSQL secara real-time.

---

## 6. BATASAN RUNTIME YANG TERSISA (GAP ANALYSIS)

Jika pengujian database dilakukan secara lokal tanpa lingkungan Supabase riil, keterbatasan berikut tetap ada dan harus diakomodasi:
1. **Stub Schema Auth:** Foreign key `profiles -> auth.users` memerlukan stub SQL sebelum migration 1 dapat dieksekusi:
   ```sql
   CREATE SCHEMA IF NOT EXISTS auth;
   CREATE TABLE IF NOT EXISTS auth.users (
       id UUID PRIMARY KEY,
       email TEXT,
       created_at TIMESTAMPTZ DEFAULT now()
   );
   CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
       SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
   $$ LANGUAGE sql STABLE;
   ```
2. **Predefined Roles:** Perintah `CREATE ROLE anon`, `CREATE ROLE authenticated`, `CREATE ROLE service_role` harus dijalankan sebelum DDL migration dieksekusi.
3. **Exclusion Constraints:** Modul `btree_gist` wajib dikompilasi atau diinstal pada server database agar exclusion constraint `vehicle_borrowing_requests` tidak melempar syntax error.
4. **PostgREST GUC:** Pengecekan `request.headers` memerlukan injeksi via `SET LOCAL "request.headers" = '{"cf-connecting-ip":"127.0.0.1"}';` dalam blok transaksi pengujian.

---

## 7. KESIMPULAN & USULAN TINDAK LANJUT

Audit kelayakan telah tuntas diselesaikan dengan kesimpulan:
1. **Lingkungan Host Saat Ini:** Tidak memiliki PostgreSQL server lokal, Docker, Podman, maupun WSL.
2. **Supabase CLI Tanpa Docker:** Secara teknis **tidak dapat berjalan**.
3. **Jalur Terbaik & Teraman:**
   - **Untuk Immediate Verification (Sekarang):** Gunakan **Opsi E (Simulation Test Harness)** yang tidak memerlukan instalasi software apapun dan telah terbukti memvalidasi 29 skenario logika pada Phase 3.2.1.
   - **Untuk Live Database Integration Testing (Nanti):** Meminta persetujuan pengguna untuk menyiapkan **Opsi D (Dedicated Supabase Staging Project terpisah)** sehingga seluruh migration `20261105000002_security_rpc_and_remediation.sql` dan RLS policy dapat diuji pada lingkungan cloud PostgreSQL yang identik secara 1:1.

---
*Laporan ini disusun dengan kepatuhan penuh terhadap prinsip keamanan: ZERO ACCESS TO SUPABASE PRODUCTION, ZERO INSTALLATION, ZERO MUTATION.*

