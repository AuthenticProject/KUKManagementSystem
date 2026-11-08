# PHASE 1A — BATCH B.2 SECURITY REMEDIATION & FRONTEND RPC INTEGRATION REPORT
## KUK Management System v3.1.0

- **Baseline Commit:** `b77fc90`
- **Scope Operasional:** **LOCAL-ONLY — STRICTLY ZERO PRODUCTION MUTATION**
- **Target Supabase Remote:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — **TIDAK PERNAH DIAKSES / ZERO MUTATION**
- **Draft Migration Dikembangkan:**
  - `supabase/migrations/20261105000001_remediate_rls_security.sql`
  - `supabase/migrations/20261105000002_security_rpc_and_remediation.sql` (32,493 bytes)
- **Status Proyek:** **PHASE 1 MASIH TERBUKA (OPEN) — MENUNGGU REVIEW MANUAL**

---

### 1. Ringkasan Perubahan

Batch B.2 menyelesaikan remediasi keamanan frontend dan database dengan fokus pada:
1. **Penghapusan Total Jalur Direct UPDATE:** Seluruh mutasi `glass_tips` dan `vehicle_borrowing_requests` di frontend telah dipindahkan 100% ke prosedur atomik `verify_glass_tip_atomic` dan `approve_vehicle_atomic`.
2. **Penanganan Error Tanpa Masking:** Frontend sekarang menangani respons `success: false` secara eksplisit, menampilkan status error/konflik jadwal (termasuk penangkapan kode `23P01`), dan mencegah penutupan modal atau mutasi UI jika RPC gagal.
3. **Pencabutan Direct UPDATE pada Database:** Penambahan klausul `REVOKE UPDATE` dan `DROP POLICY` pada tabel `glass_tips` dan `vehicle_borrowing_requests` pada draf migrasi `20261105000002`, menutup seluruh celah manipulasi via PostgREST.
4. **Desain Server-Side Rate Limiting:** Perancangan arsitektur rate limiting berbasis Edge Function dan database bucket atomik untuk endpoint publik `submit_glass_tip_atomic` dan `book_vehicle_atomic`.
5. **Audit Pasangan Kebijakan Restrictive DELETE:** Memperketat validator skrip untuk mencocokkan secara tepat pasangan nama tabel dan nama policy pada 4 tabel kepatuhan.
6. **Audit Inventaris INSERT Policy `audit_logs`:** Verifikasi ketat terhadap ketiadaan policy permisif lain yang berpotensi membypass anti-spoofing `actor_id = auth.uid()`.

---

### 2. Daftar File yang Diubah

| Path File | Kategori | Deskripsi Perubahan |
| :--- | :---: | :--- |
| `src/services/dataService.ts` | Frontend Service | Migrasi `verifyTipNota` dan `approveBorrowing` dari direct `.update()` ke `supabase.rpc()`, validasi input, penanganan error `23P01`, dan propagasi `success: false`. |
| `src/modules/glass-tips/GlassTipListPage.tsx` | Frontend UI | Penanganan error toast bertipe `isError`, modal verifikasi tetap terbuka saat RPC gagal, dan refresh data hanya jika `res.success === true`. |
| `src/modules/fleet/FleetListPage.tsx` | Frontend UI | Penanganan error toast bertipe `isError`, propagasi parameter aksi `'APPROVE'`, dan refresh data hanya jika `res.success === true`. |
| `supabase/migrations/20261105000002_security_rpc_and_remediation.sql` | Database Migration | Penambahan Seksi 1.7: `REVOKE UPDATE` dan `DROP POLICY ... UPDATE` pada `glass_tips` dan `vehicle_borrowing_requests`. |
| `scripts/validate_batch_b_migration.cjs` | Tooling / Validator | Penambahan 5 asersi integrasi frontend, asersi pencabutan UPDATE, asersi pasangan ketat restrictive DELETE, dan validasi anti-masking failure (Total: 34 asersi PASS). |

---

### 3. Inventaris Direct UPDATE (Sebelum vs. Sesudah)

| File | Fungsi | Operasi Awal | Permission Digunakan | Status Pasca Batch B.2 (Jalur Pengganti) |
| :--- | :--- | :--- | :--- | :--- |
| `src/services/dataService.ts` | `glassTipService.verifyTipNota` | `supabase.from('glass_tips').update({ status, verified_amount, notes, updated_at })` | `glass_tips.verify` | **DIGANTI KE RPC:** `supabase.rpc('verify_glass_tip_atomic', { p_unit_id, p_tip_id, p_action, p_verified_amount, p_notes })` |
| `src/services/dataService.ts` | `fleetService.approveBorrowing` | `supabase.from('vehicle_borrowing_requests').update({ status: 'APPROVED', approved_by, approved_at, updated_at })` | `fleet.approve_borrowing` | **DIGANTI KE RPC:** `supabase.rpc('approve_vehicle_atomic', { p_unit_id, p_request_id, p_action, p_rejection_reason })` |

> [!NOTE]
> **Audit Lengkap Direktori `src/`:** Tidak ada lagi pemanggilan `.from('glass_tips').update(...)` maupun `.from('vehicle_borrowing_requests').update(...)` di seluruh kode frontend aplikasi.

---

### 4. Kontrak RPC Frontend dan SQL

#### 4.1. Verifikasi Tip Kaca (`verify_glass_tip_atomic`)
- **Tanda Tangan SQL:**
  ```sql
  public.verify_glass_tip_atomic(
      p_unit_id UUID,
      p_tip_id UUID,
      p_action VARCHAR(20),
      p_verified_amount NUMERIC(12, 2) DEFAULT NULL,
      p_notes TEXT DEFAULT NULL
  ) RETURNS JSONB
  ```
- **Pemanggilan Frontend (`dataService.ts`):**
  ```typescript
  const { data, error } = await supabase.rpc('verify_glass_tip_atomic', {
    p_unit_id: unitId,
    p_tip_id: tipId,
    p_action: action, // 'VERIFY' | 'REJECT'
    p_verified_amount: action === 'VERIFY' ? verifiedAmount : null,
    p_notes: notes?.trim() ? notes.trim() : null,
  });
  ```
- **Kontrak Validasi:**
  - Jika `action === 'VERIFY'`, `verifiedAmount` wajib $> 0$.
  - Jika `action === 'REJECT'`, `p_verified_amount` wajib `null`.
  - Panjang `notes` maksimal 500 karakter.
  - Jika nota sudah berstatus non-PENDING atau telah diserap payroll (`payroll_period_id IS NOT NULL`), fungsi menolak mutasi.

#### 4.2. Persetujuan Armada Kendaraan (`approve_vehicle_atomic`)
- **Tanda Tangan SQL:**
  ```sql
  public.approve_vehicle_atomic(
      p_unit_id UUID,
      p_request_id UUID,
      p_action VARCHAR(20),
      p_rejection_reason TEXT DEFAULT NULL
  ) RETURNS JSONB
  ```
- **Pemanggilan Frontend (`dataService.ts`):**
  ```typescript
  const { data, error } = await supabase.rpc('approve_vehicle_atomic', {
    p_unit_id: unitId,
    p_request_id: requestId,
    p_action: action, // 'APPROVE' | 'REJECT'
    p_rejection_reason: action === 'REJECT' && rejectionReason?.trim() ? rejectionReason.trim() : null,
  });
  ```
- **Kontrak Validasi & Anti-Spoofing:**
  - Petugas yang menyetujui dicatat secara otomatis dari sesi aktif database (`approved_by = auth.uid()`), tidak lagi mengandalkan parameter `approverId` dari client.
  - Menangkap error konkurensi benturan jadwal (`23P01` / `exclusion_violation`) dan menerjemahkannya ke pesan ramah pengguna: *"Konflik Jadwal: Kendaraan telah memiliki reservasi aktif lain yang bertabrakan pada rentang waktu ini (Kode: 23P01)."*

---

### 5. Matriks Privilege & RLS Policy (Before vs. After)

#### Konsep: Perbedaan Antara Table Privilege vs. RLS Policy
- **Table Privilege (PostgreSQL GRANT/REVOKE):** Menentukan apakah suatu role database memiliki izin dasar untuk mengeksekusi perintah SQL (misalnya `SELECT`, `INSERT`, `UPDATE`, `DELETE`) pada tabel bersangkutan. Jika privilege di-`REVOKE`, engine PostgreSQL langsung menolak akses dengan galat `42501 (permission denied for table)` tanpa mengevaluasi RLS.
- **Row-Level Security (RLS Policy):** Filter berbasis baris (*row-level filter*) yang dievaluasi setelah table privilege terpenuhi. Menentukan baris mana yang dapat dibaca atau dimutasi oleh role tersebut.
- **SECURITY DEFINER:** Prosedur tersimpan yang dieksekusi dengan wewenang pemilik fungsi (`postgres`). Fungsi SECURITY DEFINER mengabaikan pembatasan privilege tabel pada pemanggil (`anon` / `authenticated`), sehingga tetap dapat melakukan mutasi data internal secara sah dan terkontrol.

#### Matriks Keamanan Tabel `glass_tips` & `vehicle_borrowing_requests`:

| Tabel | Operasi | Role | Kondisi Baseline (Before) | Kondisi Pasca Batch B.2 (After) | Status Keamanan |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `glass_tips` | `INSERT` | `anon` | Diizinkan via policy `glass_tips_insert_anon` | **REVOKED TOTAL** (`REVOKE INSERT ... FROM anon, authenticated, PUBLIC`) | **TERKUNCI KE RPC** |
| `glass_tips` | `INSERT` | `authenticated` | Diizinkan via default table grant (tanpa policy) | **REVOKED TOTAL** | **TERKUNCI KE RPC** |
| `glass_tips` | `UPDATE` | `anon` | Ditolak RLS | **REVOKED TOTAL** (`REVOKE UPDATE ... FROM anon, authenticated, PUBLIC`) | **TERKUNCI KE RPC** |
| `glass_tips` | `UPDATE` | `authenticated` | Diizinkan via policy `glass_tips_update` | **POLICY DROPPED & REVOKED TOTAL** | **TERKUNCI KE RPC** |
| `vehicle_borrowing_requests` | `INSERT` | `anon` | Diizinkan via policy `vehicle_borrowing_requests_insert_anon` | **REVOKED TOTAL** (`REVOKE INSERT ... FROM anon, authenticated, PUBLIC`) | **TERKUNCI KE RPC** |
| `vehicle_borrowing_requests` | `INSERT` | `authenticated` | Diizinkan via default table grant | **REVOKED TOTAL** | **TERKUNCI KE RPC** |
| `vehicle_borrowing_requests` | `UPDATE` | `anon` | Ditolak RLS | **REVOKED TOTAL** (`REVOKE UPDATE ... FROM anon, authenticated, PUBLIC`) | **TERKUNCI KE RPC** |
| `vehicle_borrowing_requests` | `UPDATE` | `authenticated` | Diizinkan via policy `vehicle_borrowing_requests_update` | **POLICY DROPPED & REVOKED TOTAL** | **TERKUNCI KE RPC** |

---

### 6. Desain & Status Rate Limiting untuk Endpoint Publik

#### Audit Risiko pada `submit_glass_tip_atomic` & `book_vehicle_atomic`:
1. **Risiko PIN Brute-Force & Enumerasi:** Penyerang dapat mencoba ratusan kombinasi PIN karyawan atau secara sengaja mengunci akun karyawan (*denial of service* per akun).
2. **Risiko Spam Permohonan Armada:** Penyerang mengirimkan permohonan booking armada fiktif dalam jumlah besar untuk membanjiri antrean verifikasi petugas.
3. **Risiko Keterbatasan Header Klien:** Header seperti `X-Forwarded-For` atau `User-Agent` dapat dengan mudah dipalsukan jika divalidasi tanpa reverse-proxy tepercaya.

#### Desain Arsitektur Server-Side Rate Limiting (Proposed Architecture):
Untuk menjamin keamanan tanpa bergantung pada browser dan tanpa membocorkan eksistensi karyawan:

```
[ Public Client / Kiosk ]
            │
            ▼
[ Supabase Edge Function: /api/v1/kiosk-submit ]
            │  1. Ekstrak Client IP Tepercaya (dari konteks Cloudflare / Kong Gateway)
            │  2. Evaluasi IP-bucket (Maks 10 req/menit per IP) via Upstash Redis
            │     └─ Jika terlampaui: Return HTTP 429 Too Many Requests (Zero DB transaction)
            │
            ▼
[ PostgreSQL RPC: submit_glass_tip_atomic ]
            │  3. Eksekusi timing-safe Bcrypt dummy jika ID tidak ada
            │  4. Evaluasi Account-lockout (Maks 5 kegagalan PIN / 30 menit)
            │  5. Mutasi atomic transaksi tip berstatus PENDING
            ▼
[ Audit Log: actor_id = NULL, metadata tercatat tanpa raw PIN ]
```

#### Prasyarat Implementasi & Status Lingkungan:
- **Prasyarat:** Konfigurasi Supabase Edge Functions, penyediaan secret API rate limit (misalnya Upstash Redis REST Token), atau tabel dedicated bucket rate-limiting di PostgreSQL (`kiosk_rate_limits`).
- **Status Saat Ini:** **DESIGN ONLY / UNTESTED ON PRODUCTION**. Sesuai batasan keselamatan, tidak ada konfigurasi dashboard atau deployment Edge Function ke Production yang dilakukan.

---

### 7. Hasil Audit Keamanan `search_path`

Audit terhadap kelima fungsi `SECURITY DEFINER`:
1. `reset_employee_kiosk_pin`
2. `submit_glass_tip_atomic`
3. `verify_glass_tip_atomic`
4. `book_vehicle_atomic`
5. `approve_vehicle_atomic`

#### Temuan:
- Seluruh fungsi secara seragam menyertakan:
  ```sql
  SET search_path = public, extensions, pg_temp;
  ```
- **Posisi `pg_temp`:** Ditempatkan di urutan paling belakang untuk memastikan skema sementara tidak dapat membajak (*shadowing*) tabel atau fungsi database resmi.
- **Penggunaan `crypt()` dan `gen_salt()`:** Dipanggil tanpa kualifikasi skema keras (`public.crypt` atau `extensions.crypt`) guna mempertahankan kompatibilitas lingkungan lokal dan Supabase hosted.
- **Status Verifikasi:** **UNVERIFIED**. Lokasi skema aktual ekstensi `pgcrypto` di Production dan privilege `CREATE` pada skema `extensions` belum diverifikasi melalui query katalog langsung (karena akses live Production dilarang keras).

#### Kueri Read-Only Katalog untuk Lingkungan Staging Terisolasi (Unexecuted):
```sql
-- Query pemeriksaan katalog (HANYA UNTUK STAGING/ISOLATED ENVIRONMENT):
SELECT e.extname, n.nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname IN ('pgcrypto', 'btree_gist');

SELECT nspname, has_schema_privilege('anon', nspname, 'CREATE') AS anon_create,
                has_schema_privilege('authenticated', nspname, 'CREATE') AS auth_create
FROM pg_namespace
WHERE nspname IN ('public', 'extensions');
```

---

### 8. Inventaris INSERT Policy pada `audit_logs`

Pemeriksaan menyeluruh terhadap seluruh migrasi memastikan bahwa:
1. **Satu-Satunya Policy INSERT:** Hanya terdapat satu policy INSERT pada tabel `audit_logs`:
   ```sql
   CREATE POLICY "audit_logs_insert" ON public.audit_logs
       FOR INSERT TO authenticated
       WITH CHECK (
           actor_id = auth.uid()
       );
   ```
2. **Ketiadaan Policy Permisif Lain:** Policy awal `WITH CHECK (true)` pada migrasi historis telah dibersihkan secara bersih via `DROP POLICY IF EXISTS "audit_logs_insert"`. Tidak ada policy permisif lain yang menggabungkan kondisi dengan `OR`.
3. **Pencabutan Akses Anonim:** `REVOKE INSERT ON TABLE public.audit_logs FROM anon, PUBLIC;` diterapkan secara eksplisit.
4. **Pencatatan Audit Sistem & Kiosk:** Transaksi publik anonim (kiosk dan booking kendaraan) mencatat log audit melalui prosedur `SECURITY DEFINER` (dieksekusi sebagai pemilik fungsi `postgres`), mencatat `actor_id = NULL` dan metadata lengkap secara sah tanpa celah pemalsuan identitas.

---

### 9. Hasil Validator & Quality Gates

#### 9.1. Advanced Security Specification Validator (`scripts/validate_batch_b_migration.cjs`)
- **Total Asersi:** 34 asersi
- **Hasil:** **34 PASSED / 0 FAILED (100% PASS)**
- **Kategori yang Lolos:**
  - `SQL_STRUCTURE`: 3 asersi (BEGIN/COMMIT, 10 dollar quotes seimbang, 5 fungsi)
  - `CRIT_EXECUTE`: 6 asersi (Pencabutan eksplisit dari PUBLIC untuk kelima fungsi)
  - `HIGH_RLS_RESTRICTIVE`: 2 asersi (Pencocokan eksak 4 pasangan tabel-policy kepatuhan & ketiadaan tabel salah)
  - `HIGH_SEARCH_PATH`: 1 asersi (Isolasi search_path dengan `pg_temp` terakhir)
  - `CRIT_TABLE_GRANTS`: 5 asersi (Pencabutan total INSERT & UPDATE pada `glass_tips`, `vehicle_borrowing_requests`, `audit_logs`, dan `public_form_tokens`)
  - `HIGH_AUDIT_SPOOFING`: 1 asersi (Penegakan `actor_id = auth.uid()`)
  - `CRIT_KIOSK_PIN`: 4 asersi (Validasi 6-digit regex, dummy timing, dan persistensi tanpa rollback)
  - `HIGH_MULTI_TENANT`: 1 asersi (Isolasi multi-tenant unit pada update)
  - `HIGH_VEHICLE`: 4 asersi (Sanitasi string, batas durasi, dan penangkapan 23P01)
  - `MEDIUM_GLASS_TIP`: 2 asersi (Validasi aksi VERIFY/REJECT dan nominal)
  - `MEDIUM_INPUT_BOUNDS`: 1 asersi (Batas panjang teks 500 karakter)
  - `FRONTEND_RPC`: 5 asersi (Ketiadaan direct `.update()`, pemanggilan RPC yang tepat, propagasi `success: false`)

#### 9.2. TypeScript Typecheck
- **Perintah:** `npm.cmd run typecheck` (`tsc --noEmit`)
- **Hasil:** Exit Code 0 (0 errors)

#### 9.3. Production Build
- **Perintah:** `npm.cmd run build` (`tsc && vite build`)
- **Hasil:** Exit Code 0 (Bundle berhasil dikompilasi ke `dist/` dalam 6.42 detik)

#### 9.4. Phase 2 Regression Suite
- **Perintah:** `npm.cmd run test:phase2` (`node scripts/test_phase2_logic.cjs`)
- **Hasil:** Exit Code 0 (11/11 tests passed)

#### 9.5. Immutabilitas Baseline Git
- `git diff HEAD -- supabase/migrations/20261104000001_core_schema_v3_1_0.sql supabase/migrations/20261104000002_harden_rpc_security.sql`: **0 diff (Identik)**.

---

### 10. Risiko yang Masih Terbuka (Open Risks)

1. **Uji Runtime Database (PostgreSQL Engine):** Semua validasi yang dilakukan saat ini adalah *static analysis*, *code inspection*, dan *typecheck*. Evaluasi dinamis RLS policies dan constraint exclusion `23P01` harus diuji pada database PostgreSQL aktif sebelum rilis.
2. **Konektivitas Live RPC pada Staging:** Pengujian integrasi panggilan jaringan live antara frontend dan Supabase remote memerlukan environment staging yang terisolasi.
3. **Penyalahgunaan Endpoint Publik sebelum Edge Function Dikonfigurasi:** Tanpa Edge Function rate limiter berbasis IP, perlindungan endpoint publik saat ini bertumpu pada lockout PIN per akun dan validasi ketat database.

---

### 11. Keputusan Bisnis yang Masih Dibutuhkan (Unconfirmed Business Decisions)

1. **Batas Ukuran & Kuantitas Pemotongan Kaca:**
   - Panjang: 5.0–600.0 cm
   - Tinggi: 5.0–350.0 cm
   - Kuantitas: 1–500 lembar
   - Status: **UNCONFIRMED / PROPOSED** (menunggu konfirmasi katalog lembar kaca pabrikan).
2. **Lockout Kiosk Karyawan:**
   - Batas 5 kali percobaan berturut-turut memicu penguncian akun selama 30 menit.
   - Status: **UNCONFIRMED / PROPOSED** (menunggu konfirmasi operasional HRD).
3. **Maksimum Durasi Peminjaman Kendaraan:**
   - Batas waktu sewa maksimal 30 hari kalender.
   - Status: **UNCONFIRMED / PROPOSED** (menunggu konfirmasi bagian umum/armada).
4. **Toleransi Waktu Mulai Peminjaman:**
   - Waktu mulai diizinkan hingga 15 menit sebelum waktu server (`now() - 15 minutes`).
   - Status: **UNCONFIRMED / PROPOSED** (diterapkan sebagai grace period operasional).
5. **Makna Kolom `tip_percentage_snapshot`:**
   - Interpretasi snapshot persentase ketika tarif menggunakan metode perhitungan `PER_SQM` atau `PER_PIECE`.
   - Status: **UNCONFIRMED** (menunggu klarifikasi aturan akuntansi tip).

---

### 12. Pernyataan Keselamatan & Batasan Operasional

> [!CAUTION]
> **Pernyataan Mutlak Keselamatan Lingkungan:**
> Seluruh pekerjaan Batch B.2 dilaksanakan secara **100% LOKAL**.
> Database Supabase Cloud Production (`ckzciuybedefbsdfsexh`) **TIDAK PERNAH DIHUBUNGI, TIDAK ADA PERINTAH SQL REMOTE, TIDAK ADA DDL/DML, TIDAK ADA MIGRATION UP, DAN TIDAK ADA COMMIT/PUSH GIT.**
> Phase 1 saat ini masih berstatus **TERBUKA (OPEN)**.
> Tidak ada klaim bahwa migrasi telah siap dideploy ke Production tanpa pengujian runtime staging.

---

**Saya BERHENTI DI SINI dan menunggu peninjauan manual serta instruksi tertulis dari Anda.**

