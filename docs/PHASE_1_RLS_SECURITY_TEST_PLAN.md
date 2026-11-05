# PHASE 1 — RLS SECURITY TEST PLAN & TEST HARNESS SPECIFICATION
## KUK MANAGEMENT SYSTEM v3.1.0

**Tanggal Dokumen:** 2026-11-04  
**Auditor:** Antigravity Autonomous Agent  
**Target Environment:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`)  
**PostgreSQL Engine:** v17.11.0.011  
**Tujuan Dokumen:** Merancang matriks pengujian keamanan Row Level Security (RLS) multi-tenant dan mendefinisikan arsitektur test harness otomatis untuk membuktikan isolasi data antar unit kerja dan peran pengguna.

---

## 1. PRINSIP KEAMANAN & ISOLASI MULTI-TENANT

Arsitektur KUK Management System v3.1.0 berlandaskan pada prinsip isolasi multi-unit ketat:
1. **Pemisahan Unit Horizontal:** Staf yang ditugaskan di **TB KUK La Tansa** tidak boleh membaca, mengubah, atau menghapus data transaksi milik **KUK Palen**, dan sebaliknya.
2. **Pemisahan Peran Vertikal (RBAC):** Operator kasir atau staf umum tidak boleh membaca atau mengelola data penggajian (`payroll_records`), slip gaji, data rahasia karyawan (`employee_sensitive_data`), maupun audit logs.
3. **Super Admin Boundaries:** Super Admin memiliki akses pemeliharaan sistem global dan bypass RLS terkontrol melalui `has_system_role('super_admin')`.
4. **Isolasi Publik (Anonymous):** Pengguna tanpa autentikasi hanya boleh mengakses data publik yang diizinkan (misal: katalog kendaraan tersedia `vehicles_read_anon` dan pengajuan form via RPC atomik). Akses langsung ke tabel internal wajib ditolak atau mengembalikan 0 baris.
5. **Operasi CRUD Terpisah:** Setiap operasi `SELECT`, `INSERT`, `UPDATE`, dan `DELETE` memiliki kebijakan terpisah dan diuji secara independen.

---

## 2. MATRIKS PERAN & AKUN PENGUJIAN (TEST ACTORS)

Untuk menjalankan test harness secara live, berikut adalah spesifikasi akun uji khusus yang direncanakan:

| Kode Actor | Role / Penugasan | Email Uji yang Diusulkan | Unit Kerja | Izin Akses Kunci |
| :---: | :--- | :--- | :--- | :--- |
| **ACT-01** | Super Admin | `test.superadmin@kuk.test` | Global / Semua Unit | Sistem Global (`super_admin`), Full Bypass |
| **ACT-02** | Admin Pusat | `test.admin.pusat@kuk.test` | Kantor Pusat / Agregat | Multi-Unit View, Konsolidasi Laporan |
| **ACT-03** | Admin TB KUK La Tansa | `test.admin.latansa@kuk.test` | TB KUK La Tansa (`unit_latansa`) | `employees.*`, `payroll.*`, `fleet.*` (Khusus La Tansa) |
| **ACT-04** | Admin KUK Palen | `test.admin.palen@kuk.test` | KUK Palen (`unit_palen`) | `employees.*`, `payroll.*`, `fleet.*` (Khusus Palen) |
| **ACT-05** | Operator Kasir La Tansa | `test.operator.latansa@kuk.test`| TB KUK La Tansa (`unit_latansa`) | `attendance.view`, `glass_tips.input` (Tanpa Payroll) |
| **ACT-06** | Anonim (Unauthenticated)| *(Tanpa JWT / Anon Key Only)*| *(None)* | Akses Formulir Publik Saja |

---

## 3. MATRIKS SKENARIO UJI RLS (CRUD SEPARATION MATRIX)

### Skenario 1: Isolasi Antar Unit (Cross-Tenant La Tansa vs Palen)

| Test ID | Aktor | Target Tabel | Operasi | Data Sasaran | Hasil yang Diharapkan | Logika RLS Teruji |
| :---: | :---: | :---: | :---: | :--- | :---: | :--- |
| **RLS-01** | ACT-03 (Admin La Tansa) | `employees` | `SELECT` | Karyawan TB KUK La Tansa | **ALLOW (HTTP 200)** | `has_unit_permission(unit_id, 'employees.view')` |
| **RLS-02** | ACT-03 (Admin La Tansa) | `employees` | `SELECT` | Karyawan KUK Palen | **DENY (0 rows)** | Unit ID mismatch |
| **RLS-03** | ACT-03 (Admin La Tansa) | `employees` | `INSERT` | Karyawan di KUK Palen | **REJECT (Error 42501)** | `employees_insert_unit` policy check |
| **RLS-04** | ACT-03 (Admin La Tansa) | `employees` | `UPDATE` | Karyawan di KUK Palen | **REJECT (0 rows updated)** | `employees_update_unit` policy check |
| **RLS-05** | ACT-04 (Admin Palen) | `leave_requests` | `SELECT` | Cuti di TB KUK La Tansa | **DENY (0 rows)** | `has_unit_permission(unit_id, 'leave.view')` |
| **RLS-06** | ACT-04 (Admin Palen) | `glass_tips` | `UPDATE` | Tip Kaca di TB KUK La Tansa | **REJECT (0 rows updated)** | `glass_tips_update` unit check |

### Skenario 2: Pemisahan Wewenang Vertikal (Role Separation)

| Test ID | Aktor | Target Tabel | Operasi | Data Sasaran | Hasil yang Diharapkan | Logika RLS Teruji |
| :---: | :---: | :---: | :---: | :--- | :---: | :--- |
| **RLS-07** | ACT-05 (Operator Kasir) | `payroll_records` | `SELECT` | Slip Gaji Unit La Tansa | **DENY (0 rows)** | Tidak punya `payroll.view` |
| **RLS-08** | ACT-05 (Operator Kasir) | `employee_sensitive_data` | `SELECT` | Gaji Pokok & Bank Rekening | **DENY (0 rows)** | `employee_sensitive_read` check |
| **RLS-09** | ACT-05 (Operator Kasir) | `audit_logs` | `SELECT` | Log Mutasi Sistem | **DENY (0 rows)** | Tidak punya `audit_logs.view` |
| **RLS-10** | ACT-03 (Admin La Tansa) | `payroll_records` | `SELECT` | Slip Gaji Unit La Tansa | **ALLOW (HTTP 200)** | Memiliki `payroll.view` di La Tansa |

### Skenario 3: Immutability & Audit Protection

| Test ID | Aktor | Target Tabel | Operasi | Data Sasaran | Hasil yang Diharapkan | Logika RLS & Trigger Teruji |
| :---: | :---: | :---: | :---: | :--- | :---: | :--- |
| **RLS-11** | ACT-01 (Super Admin) | `audit_logs` | `UPDATE` | Catatan Audit Apapun | **REJECT (Error P0001)** | Trigger `trg_protect_audit_logs` & `audit_logs_deny_update` |
| **RLS-12** | ACT-01 (Super Admin) | `audit_logs` | `DELETE` | Catatan Audit Apapun | **REJECT (Error P0001)** | Trigger `trg_protect_audit_logs` & `audit_logs_deny_delete` |
| **RLS-13** | ACT-03 (Admin La Tansa) | `employees` | `DELETE` | Karyawan Apapun | **REJECT (Error 42501)** | Policy `employees_delete_deny` (USING false) |

### Skenario 4: Akses Anonim (Unauthenticated Isolation)

| Test ID | Aktor | Target Tabel | Operasi | Data Sasaran | Hasil yang Diharapkan | Logika RLS Teruji |
| :---: | :---: | :---: | :---: | :--- | :---: | :--- |
| **RLS-14** | ACT-06 (Anonim) | `organizations` | `SELECT` | Data Organisasi | **DENY (0 rows)** | `organizations_read_authenticated` |
| **RLS-15** | ACT-06 (Anonim) | `employees` | `SELECT` | Data Karyawan | **DENY (0 rows)** | `employees_read_unit` |
| **RLS-16** | ACT-06 (Anonim) | `vehicles` | `SELECT` | Armada Status `AVAILABLE` | **ALLOW (HTTP 200)** | Policy `vehicles_read_anon` |
| **RLS-17** | ACT-06 (Anonim) | `vehicles` | `SELECT` | Armada Status `MAINTENANCE` | **DENY (0 rows)** | Filter `status = 'AVAILABLE'` di policy |
| **RLS-18** | ACT-06 (Anonim) | `organizations` | `INSERT` | Entitas Organisasi Baru | **REJECT (Error 42501)** | Kebijakan hanya untuk `super_admin` |

---

## 4. SPESIFIKASI TEST HARNESS OTOMATIS

Direncanakan test harness berbasis TypeScript/Node.js (`scripts/test_rls_security_harness.js`) yang menginisialisasi 6 client Supabase dengan context sesi berbeda:

```typescript
// Konseptual Test Harness Runner
interface TestActorSession {
  actor: string;
  email: string;
  client: SupabaseClient; // Client yang telah signIn dengan token actor
}

async function runRlsHarness(actors: TestActorSession[]) {
  // Melakukan iterasi 18 skenario uji di atas secara otomatis
  // dan mencatat PASS / FAIL per operasi REST
}
```

---

## 5. PROSEDUR PROVISIONING AKUN UJI (MEMERLUKAN PERSETUJUAN USER)

Sesuai batasan operasional ("*Jangan membuat atau menghapus Auth users tanpa persetujuan*"), berikut adalah prosedur yang diajukan untuk disetujui pengguna sebelum eksekusi live RLS harness dapat dijalankan:

1. **Pembuatan 2 Unit Kerja Uji:**
   - Unit A: `TB KUK La Tansa` (Kode: `TB-LATANSA`)
   - Unit B: `KUK Palen` (Kode: `KUK-PALEN`)
2. **Pembuatan 5 Akun Pengujian di `auth.users`:**
   - Dibuat menggunakan email domain khusus testing (`@kuk.test`) agar mudah diisolasi dan dibersihkan.
   - Kata sandi acak aman dengan hash bcrypt standar Supabase Auth.
3. **Inisialisasi Data Profil & RBAC:**
   - Mapping ke tabel `profiles`.
   - Mapping ke tabel `roles` dan `role_permissions` sesuai skema canonical v3.1.0.
   - Mapping ke tabel `user_system_roles` dan `user_unit_roles`.
4. **Eksekusi Test Harness:**
   - Menjalankan 18 test cases secara otomatis.
   - Mengambil bukti response payload dan error code.
5. **Pembersihan Pasca-Uji (Cleanup Phase):**
   - Menghapus record transaksi uji tanpa merusak struktur database.

