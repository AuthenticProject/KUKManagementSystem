# PHASE 1C.4 — FRONTEND MUTATION SECURITY AUDIT
## KUK Management System v3.1.0

**Tanggal Audit:** 2026-11-08 18:20:00 +07:00  
**Auditor Roles:** Senior Frontend Integration Auditor & Database Security Engineer  
**Baseline Git:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Target Kode Sumber:** Seluruh antarmuka, hooks, konteks, dan service di `src/` (37 berkas)  
**Status Evaluasi:** **READ-ONLY LOCAL CODEBASE AUDIT**  

---

## 1. EXECUTIVE SUMMARY

Audit keamanan ini mengevaluasi seluruh titik masuk dan jalur eksekusi perubahan data (*data mutations*) yang diprakarsai oleh antarmuka pengguna (*frontend*) KUK Management System v3.1.0. Audit memverifikasi apakah validasi otorisasi di sisi klien telah selaras dengan batasan basis data, mendeteksi potensi kerentanan *mass assignment*, mengevaluasi pencegahan pengiriman ganda (*double submission*), memastikan tidak ada penyamaran kegagalan mutasi dengan data palsu, serta memverifikasi bahwa mode pratinjau (*preview mode*) terisolasi total dari lingkungan produksi.

### Temuan Kunci Frontend:
1. **Sentralisasi Penuh Mutasi:** Seluruh 20 mutasi data dalam aplikasi terpusat secara konsisten di dalam [src/services/dataService.ts](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/src/services/dataService.ts). Tidak ada halaman (*page*), modal form, atau komponen kustom yang melakukan kueri `supabase.from(...).insert/update/delete` langsung.
2. **Kelemahan Mass Assignment pada `saveEmployee`:** Pemanggilan `employeeService.saveEmployee(unitId, employee)` menyebarkan seluruh field objek `employee` ke dalam payload kueri Supabase (`const payload = { ...employee, unit_id: unitId };`). Jika form dimanipulasi di sisi klien, field internal seperti `created_at` atau metadata lain dapat ikut terkirim ke database.
3. **Legacy Table Reference pada `systemService.saveUserRole`:** Fungsi `systemService.saveUserRole` mengeksekusi update ke tabel `user_profiles` dengan kolom denormalisasi `system_role` dan `assigned_units`. Pada skema v3.1.0, tabel ini telah dinormalisasi menjadi `profiles`, `user_system_roles`, dan `user_unit_roles`. Pemanggilan fungsi ini di Production akan menghasilkan error `relation "user_profiles" does not exist`.
4. **Pencegahan Double Submission:** Seluruh tombol form pada modal dialog dan halaman kiosk telah diproteksi menggunakan flag state lokal `isSubmitting` / `isProcessing` (`disabled={isSubmitting}`), mencegah pengiriman payload berulang akibat klik ganda pengguna.
5. **Transparansi Error Total:** Mesin `classifyError()` telah mengeliminasi silent mock fallback pada operasi yang gagal. Kegagalan mutasi basis data selalu mengembalikan `{ success: false, message: ... }` dengan kode error yang jelas (`42501`, `AUTH_EXPIRED`, `TIMEOUT`, `NETWORK_ERROR`).

---

## 2. COMPLETE FRONTEND MUTATION INVENTORY

Inventarisasi komprehensif terhadap seluruh 20 operasi penulisan data yang terdeteksi di dalam repositori:

| No | Modul | Tabel / RPC Target | Operasi | Lokasi Kode | Role Pemanggil | Validasi Hak Akses Frontend | Mekanisme Audit | Status Keamanan |
| :---: | :--- | :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | **Employees** | `employees` | UPDATE | `dataService.ts:358` | Admin Toko / HR | `PermissionGuard('employees.update')` | Trigger DB | `SECURE` |
| 2 | **Employees** | `employees` | INSERT | `dataService.ts:361` | Admin Toko / HR | `PermissionGuard('employees.create')` | Trigger DB | `SECURE` |
| 3 | **Employees** | `employee_sensitive_data` | UPSERT | `dataService.ts:373` | Admin Toko / HR | `PermissionGuard('employees.manage_sensitive')` | Trigger DB | `POTENSI HARD-DELETE DI DB` |
| 4 | **Employees** | `employees` | UPDATE | `dataService.ts:389` | Admin Toko / HR | `PermissionGuard('employees.update')` | Trigger DB | `SECURE` |
| 5 | **Employees** | `reset_employee_kiosk_pin` | RPC | `dataService.ts:419` | Admin Toko / HR | `hasPermission('employees.update')` | Dicatat di DB | `SECURE` |
| 6 | **Leave** | `leave_requests` | UPDATE | `dataService.ts:459` | Admin Toko | `PermissionGuard('leave.manage')` | Trigger DB | `DIRECT UPDATE (No Atomic RPC)` |
| 7 | **Leave** | `cancel_leave_request_atomic` | RPC | `dataService.ts:471` | Admin Toko | `PermissionGuard('leave.manage')` | Dicatat di DB | `SECURE` |
| 8 | **Leave** | `leave_requests` | INSERT | `dataService.ts:507` | Internal Admin | `PermissionGuard('leave.manage')` | Trigger DB | `SECURE` |
| 9 | **Violations** | `violation_records` | INSERT | `dataService.ts:582` | Admin Toko / Spv | `PermissionGuard('violations.manage')` | Trigger DB | `SECURE` |
| 10 | **Violations** | `warning_letters` | INSERT | `dataService.ts:602` | Admin Toko / Kepala | `PermissionGuard('violations.manage')` | Trigger DB | `INSERTS APPROVED DIRECTLY` |
| 11 | **Attendance** | `briefing_sessions` | INSERT | `dataService.ts:647` | Pimpinan / Kasir | `PermissionGuard('attendance.manage')` | Trigger DB | `SECURE` |
| 12 | **Attendance** | `attendance_daily_records` | UPDATE | `dataService.ts:667` | Admin Toko | `PermissionGuard('attendance.manage')` | Trigger DB | `SECURE (Marks Manual Adjust)` |
| 13 | **Glass Tips** | `submit_glass_tip_atomic` | RPC | `dataService.ts:821` | Kiosk Publik Pemotong | Kiosk Publik (PIN Auth di DB) | Rate Limiter | `SECURE` |
| 14 | **Glass Tips** | `verify_glass_tip_atomic` | RPC | `dataService.ts:898` | Kasir / Checker | `PermissionGuard('glass_tips.verify')` | Row Lock & DB | `SECURE` |
| 15 | **Payroll** | `calculate_and_finalize_payroll_atomic` | RPC | `dataService.ts:959` | Admin Toko / Direksi | `PermissionGuard('payroll.finalize')` | Row Lock & DB | `SECURE` |
| 16 | **Fleet** | `approve_vehicle_atomic` | RPC | `dataService.ts:1022` | Petugas Armada | `PermissionGuard('fleet.approve_borrowing')` | Traps 23P01 | `SECURE` |
| 17 | **Fleet** | `vehicles` | INSERT | `dataService.ts:1054` | Petugas Armada | `PermissionGuard('fleet.manage')` | Trigger DB | `SECURE` |
| 18 | **Fleet** | `book_vehicle_atomic` | RPC | `dataService.ts:1080` | Kiosk Publik Armada | Kiosk Publik (Rate limit di DB) | Exclusion GIST | `SECURE` |
| 19 | **Fleet** | `vehicles` | UPDATE | `dataService.ts:1131` | Petugas Armada | `PermissionGuard('fleet.manage')` | Trigger DB | `SECURE` |
| 20 | **Settings** | `user_profiles` | UPDATE | `dataService.ts:1200` | Super Admin | `isSuperAdmin` check di UI | Trigger DB | `CRITICAL: Legacy Table Name` |

---

## 3. AUTHENTICATION & RBAC PRE-CHECKS

### 3.1. Struktur Penjaga Otorisasi Frontend
Antarmuka pengguna mengimplementasikan otorisasi berlapis:
1. **`AuthGuard` (`src/components/guards/AuthGuard.tsx`):** Memastikan sesi JWT valid sebelum halaman dirender. Mengalihkan pengguna yang belum login ke `/login`.
2. **`PermissionGuard` (`src/components/guards/PermissionGuard.tsx`):** Memeriksa apakah `profile.systemRoles` atau `profile.unitRoles` memiliki kode izin (*permission code*) yang dibutuhkan (misal: `employees.update`, `glass_tips.verify`).
3. **Prinsip Pertahanan Berlapis (*Defense-in-Depth*):**  
   Pemeriksaan otorisasi di sisi frontend diakui secara jujur hanya sebagai **panduan antarmuka (*UI display control*)**, bukan benteng keamanan absolut. Jika pengguna menyalin token JWT dan mengirimkan mutasi langsung ke endpoint REST PostgREST, RLS policies di database PostgreSQL tetap menjadi hakim penegak mutlak.

---

## 4. UNIT SCOPING & PAYLOAD TAMPERING ANALYSIS

### 4.1. Asal Usul Nilai `unit_id`
- Pada komponen internal admin, `unitId` diekstrak dari `UnitContext.activeUnitId`.
- `UnitContext` menentukan unit aktif berdasarkan penugasan resmi pengguna pada database (`user_unit_roles`), bukan dari input bebas.
- **Uji Manipulasi Parameter:** Jika pelaku memodifikasi request HTTP dan mengubah payload `unit_id` dari unit La Tansa ke unit Palen:
  - Database mengevaluasi `has_unit_permission(unit_id, ...)` pada baris yang di-insert/update.
  - Karena pelaku tidak memiliki role di unit Palen pada tabel `user_unit_roles`, PostgreSQL menolak mutasi dengan SQLSTATE `42501` (Akses ditolak).

---

## 5. MASS ASSIGNMENT AUDIT

Audit mendalam terhadap perakitan payload pada `dataService.ts`:

### Temuan Mass Assignment pada `saveEmployee`:
```typescript
// dataService.ts:356
const payload = { ...employee, unit_id: unitId, updated_at: new Date().toISOString() };
if (employee.id && !employee.id.startsWith('emp-')) {
  const { error } = await supabase.from('employees').update(payload).eq('id', employee.id).eq('unit_id', unitId);
```
- **Masalah:** Objek `employee` disalin secara mentah (*shallow copy*) menggunakan operator spread (`...employee`) tanpa penyaringan atribut eksplisit (*whitelist*).
- **Dampak Potensial:** Klien dapat menyuntikkan properti tambahan yang tidak dimaksudkan untuk diubah melalui form (misalnya mencoba mengubah kolom yang seharusnya diatur via workflow khusus).
- **Rekomendasi:** Gunakan skema validasi Zod eksplisit atau deklarasi payload tertutup (*explicit field whitelisting*):
  ```typescript
  const sanitizedPayload = {
    full_name: employee.full_name?.trim(),
    employee_code: employee.employee_code?.trim(),
    department_id: employee.department_id,
    position_id: employee.position_id,
    work_schedule_id: employee.work_schedule_id,
    gender: employee.gender,
    marital_status: employee.marital_status,
    employment_type: employee.employment_type,
    join_date: employee.join_date,
    phone: employee.phone?.trim(),
    email: employee.email?.trim() || null,
    unit_id: unitId,
    updated_at: new Date().toISOString(),
  };
  ```

---

## 6. DOUBLE SUBMISSION & IDEMPOTENCY

1. **Proteksi UI:** Seluruh komponen form dialog (`EmployeeFormModal`, `CreateLeaveModal`, `ResetPinModal`, dll.) menggunakan state `const [isSubmitting, setIsSubmitting] = useState(false)` yang langsung menonaktifkan tombol submit (`disabled={isSubmitting}`) saat tombol diklik pertama kali.
2. **Idempotensi di Level Database:**
   - **Tip Kaca:** Menghasilkan kode nota unik (`reference_code`) berformat `TIP-<UNIT>-<TIMESTAMP>-<RAND>`. Kolom `reference_code` dijamin unik oleh constraint `UNIQUE`, mencegah pengiriman nota yang sama berulang kali.
   - **Armada:** Menghasilkan kode booking unik (`booking_code`) dan dilindungi oleh constraint exclusion `23P01`.

---

## 7. ERROR SURFACING & ANTI-MASKING VERIFICATION

Audit membuktikan bahwa seluruh fungsi mutasi pada `dataService.ts`:
1. Tidak lagi mengembalikan `{ success: true }` palsu saat error koneksi atau RLS terjadi.
2. Menangkap error Supabase dan meneruskannya ke mesin `classifyError()`.
3. Membedakan pesan kesalahan operasional secara transparan:
   - Sesi habis → *"Sesi autentikasi telah berakhir. Silakan login kembali."*
   - RLS ditolak → *"Akses ditolak: Anda tidak memiliki izin untuk mengakses data ini (RLS Denied)."*
   - Konflik armada → *"Konflik Jadwal: Kendaraan telah memiliki reservasi aktif lain yang bertabrakan pada rentang waktu ini (Kode: 23P01)."*

---

## 8. PREVIEW MODE & MOCK ISOLATION

Mekanisme mode pratinjau (`KUK_PREVIEW_MODE`) telah diaudit dan dipastikan:
1. **Produksi Menolak Preview Mode Secara Permanen:**
   ```typescript
   const isProd = typeof import.meta !== 'undefined' && ((import.meta as any)?.env?.PROD === true || (import.meta as any)?.env?.VITE_APP_ENV === 'production');
   const allowInProd = typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_ENABLE_PREVIEW_MODE === 'true';
   if (isProd && !allowInProd) return false;
   ```
2. **Mutasi Pratinjau Disertai Peringatan Tegas:**  
   Setiap mutasi pada ID simulasi lokal (`emp-`, `att-`, `veh-`, `user-`) mengembalikan pesan eksplisit: `[SIMULASI PREVIEW] ... (TIDAK tersimpan ke database)`.

---

## 9. PUBLIC KIOSK SECURITY

| Halaman Kiosk Publik | Jalur Mutasi | Mekanisme Proteksi Keamanan | Status Keamanan |
| :--- | :---: | :--- | :---: |
| **`PublicGlassTipPage.tsx`** | RPC `submit_glass_tip_atomic` | Validasi 6-digit PIN Bcrypt, dummy timing defense, rate limiting 10 req/menit per IP & kode karyawan. | **SECURE** |
| **`PublicFleetBookingPage.tsx`** | RPC `book_vehicle_atomic` | Validasi rentang waktu ketat (15m past, 30d max), PostgreSQL exclusion constraint `23P01`, rate limiting per IP & Armada. | **SECURE** |
| **`PublicLeaveRequestPage.tsx`** | RPC `submit_leave_request_atomic` | **PORTAL DINONAKTIFKAN:** Form menampilkan banner `STATUS PORTAL: BLOCKED` dan tombol submit berstatus `disabled={true}`. Mencegah eksploitasi sebelum RPC backend diperbaiki. | **SECURE (DISARMED)** |

---

## 10. FRONTEND SECURITY FINDINGS CLASSIFICATION

1. **[CRITICAL] Pemanggilan Tabel Usang `user_profiles` di `systemService.saveUserRole`:**  
   Fungsi ini mencoba meng-update tabel non-eksisten `user_profiles` dengan atribut denormalisasi `system_role` dan `assigned_units`. Harus direfaktor agar memanipulasi relasi `profiles`, `user_system_roles`, dan `user_unit_roles` yang sah.
2. **[HIGH] Mass Assignment pada `saveEmployee`:**  
   Objek form `employee` disebarkan tanpa whitelist atribut, berpotensi mengirimkan properti ekstra ke tabel basis data.
3. **[MEDIUM] Direct INSERT `warning_letters` dengan Status APPROVED Langsung:**  
   Form penerbitan SP langsung mengirimkan `{ approval_status: 'APPROVED' }` ke database tanpa melewati alur verifikasi dua pihak atau RPC terotorisasi.
4. **[LOW] Direct UPDATE pada `leaveService.updateLeaveStatus`:**  
   Persetujuan cuti dilakukan via direct table update alih-alih RPC atomik terpadu dengan logging audit otomatis.
5. **[INFORMATIONAL] Ketergantungan State `UnitContext`:**  
   Perpindahan unit di antarmuka harus selalu membersihkan query cache (`queryClient.clear()`) untuk mencegah kebocoran sisa data antar-unit pada komponen yang di-cache.

