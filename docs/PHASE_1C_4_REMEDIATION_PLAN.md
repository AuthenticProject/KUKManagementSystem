# PHASE 1C.4 — REMEDIATION PLAN & THREAT MITIGATION
## KUK Management System v3.1.0

**Tanggal Rencana:** 2026-11-08 18:25:00 +07:00  
**Baseline Git:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Prinsip Utama:** **AUDIT DULU — JANGAN LAKUKAN MUTASI KODE/DATABASE SEBELUM TINJAUAN SELESAI**  
**Target Lingkungan:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — **ZERO ACCESS / ZERO REMOTE DDL**  

---

## 1. EXECUTIVE SUMMARY

Berdasarkan hasil audit komprehensif pada berkas [PHASE_1C_4_DATABASE_MUTATION_SECURITY_AUDIT.md](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/PHASE_1C_4_DATABASE_MUTATION_SECURITY_AUDIT.md) dan [PHASE_1C_4_FRONTEND_MUTATION_AUDIT.md](file:///d:/00.%20Me/07.%20Code%20Project/13.%20KUK%20V3/docs/PHASE_1C_4_FRONTEND_MUTATION_AUDIT.md), dokumen ini menyusun rencana aksi perbaikan terstruktur (*remediation plan*) yang memprioritaskan temuan berdasarkan tingkat keparahan (*severity*).

Seluruh rekomendasi dirancang agar dapat diimplementasikan dan diuji secara **100% lokal** menggunakan simulation harness yang telah diperkuat pada Phase 1C.2, tanpa menyentuh database Supabase Production.

---

## 2. SEVERITY BREAKDOWN

```text
+-------------------+-----------------+------------------------------------------------------------------------+
| Tingkat Keparahan | Jumlah Temuan   | Dampak Utama                                                           |
+-------------------+-----------------+------------------------------------------------------------------------+
| CRITICAL          | 2 Temuan        | Celah brute-force PIN cuti di DB & query ke tabel non-eksisten di UI   |
| HIGH              | 2 Temuan        | Potensi hard-delete data sensitif & risiko mass-assignment form staf   |
| MEDIUM            | 2 Temuan        | Direct update status cuti & direct insert status SP approved langsung  |
| LOW               | 1 Temuan        | Tabel dormant public_form_tokens belum dibersihkan dari skema          |
| INFORMATIONAL     | 2 Temuan        | Batasan perlindungan BYPASSRLS & pembersihan query cache UnitContext   |
+-------------------+-----------------+------------------------------------------------------------------------+
| TOTAL             | 9 Temuan        | Rencana aksi teknis terperinci disajikan di bawah                      |
+-------------------+-----------------+------------------------------------------------------------------------+
```

---

## 3. DETAILED REMEDIATION ITEMS

---

### [ITEM-01] [CRITICAL] Perbaikan Transaksi Atomik pada RPC Kiosk Cuti (`submit_leave_request_atomic`)
1. **Penjelasan Masalah:**  
   Fungsi historis `submit_leave_request_atomic` pada `20261104000001_core_schema_v3_1_0.sql` (baris 1378-1383) melempar `RAISE EXCEPTION 'PIN otentikasi salah.'` saat PIN salah. Di PostgreSQL, unhandled exception menyebabkan transaksi dibatalkan (*rollback*), sehingga penambahan counter `failed_attempts` pada tabel `employee_portal_auth` ikut dibatalkan. Hal ini menyebabkan proteksi lockout 5 kali salah PIN tidak pernah tercapai, memungkinkan serangan brute-force online tanpa batas.
2. **Dampak terhadap Bisnis:**  
   Pelaku dapat membobol PIN 6 digit karyawan dan mengajukan cuti palsu tanpa terdeteksi oleh sistem lockout.
3. **File Terkait:**  
   `supabase/migrations/20261104000001_core_schema_v3_1_0.sql` (Historis) & `src/modules/public/PublicLeaveRequestPage.tsx`.
4. **Solusi yang Direkomendasikan:**  
   Redefinisikan fungsi `submit_leave_request_atomic` pada migration lokal baru (misal: `20261106000001_harden_leave_kiosk_rpc.sql`) mengikuti pola yang telah terbukti aman pada `submit_glass_tip_atomic`:
   - Tangkap kegagalan PIN tanpa melempar exception (`RETURN jsonb_build_object('success', false, 'message', ...)`).
   - Pastikan `UPDATE employee_portal_auth SET failed_attempts = failed_attempts + 1` berhasil di-commit.
   - Tambahkan integrasi rate limiting via `check_and_increment_rate_limit`.
   - Jalankan dummy Bcrypt saat karyawan tidak ditemukan untuk menyamarkan waktu komputasi (*anti-timing enumeration*).
   - Setelah RPC aman, buka blokir pada `PublicLeaveRequestPage.tsx` dan `dataService.ts:submitLeaveRequestWithPin`.
5. **Membutuhkan Perubahan Frontend?** Ya (Buka status BLOCKED setelah backend siap).
6. **Membutuhkan Migration SQL Baru?** Ya (Buat RPC baru pengganti).
7. **Membutuhkan Persetujuan Pemilik Bisnis?** Ya (Konfirmasi aturan lockout cuti).
8. **Dapat Diperbaiki Lokal Tanpa Production?** Ya (100% lokal).

---

### [ITEM-02] [CRITICAL] Refaktor Pemanggilan Tabel Non-Eksisten `user_profiles` pada `systemService.saveUserRole`
1. **Penjelasan Masalah:**  
   Fungsi `systemService.saveUserRole` dan `getUsers` di `src/services/dataService.ts` (baris 1180-1205) memanggil `.from('user_profiles')` dengan atribut denormalisasi `system_role` dan `assigned_units`. Pada skema kanonikal v3.1.0, tabel `user_profiles` tidak ada, melainkan menggunakan tabel ternormalisasi: `profiles`, `user_system_roles`, dan `user_unit_roles`.
2. **Dampak terhadap Bisnis:**  
   Super Admin tidak dapat mengubah role atau penugasan unit staf melalui halaman Settings, dan query akan melempar error runtime `relation "user_profiles" does not exist` saat terhubung ke database.
3. **File Terkait:**  
   `src/services/dataService.ts:1180-1205` dan `src/modules/settings/SettingsPage.tsx`.
4. **Solusi yang Direkomendasikan:**  
   Refaktor `systemService.saveUserRole` agar melakukan mutasi ke tabel relasi yang sah:
   - Update `profiles` untuk data profil umum.
   - Upsert/Delete ke `user_system_roles` untuk role sistem.
   - Upsert/Delete ke `user_unit_roles` untuk penugasan unit kerja.
5. **Membutuhkan Perubahan Frontend?** Ya (Refaktor `dataService.ts`).
6. **Membutuhkan Migration SQL Baru?** Tidak (Skema database sudah mendukung).
7. **Membutuhkan Persetujuan Pemilik Bisnis?** Tidak (Perbaikan teknis bug integrasi).
8. **Dapat Diperbaiki Lokal Tanpa Production?** Ya (100% lokal).

---

### [ITEM-03] [HIGH] Penambahan Kebijakan RESTRICTIVE DELETE pada `employee_sensitive_data`
1. **Penjelasan Masalah:**  
   Kebijakan RLS `employee_sensitive_manage` pada `employee_sensitive_data` menggunakan klausa `FOR ALL TO authenticated USING (has_unit_permission(unit_id, 'employees.manage_sensitive'))`. Karena `FOR ALL` mencakup perintah `DELETE`, staf yang memiliki permission tersebut dapat menghapus baris data sensitif karyawan secara permanen (*hard-delete*).
2. **Dampak terhadap Bisnis:**  
   Risiko kehilangan data kepatuhan ketenagakerjaan permanen (NIK, nomor BPJS, nomor rekening bank) jika akun admin disusupi.
3. **File Terkait:**  
   `supabase/migrations/20261105000002_security_rpc_and_remediation.sql`.
4. **Solusi yang Direkomendasikan:**  
   Tambahkan kebijakan berikut ke dalam draft migration:
   ```sql
   DROP POLICY IF EXISTS "employee_sensitive_delete_deny" ON public.employee_sensitive_data;
   CREATE POLICY "employee_sensitive_delete_deny" ON public.employee_sensitive_data
       AS RESTRICTIVE
       FOR DELETE TO authenticated
       USING (false);
   ```
5. **Membutuhkan Perubahan Frontend?** Tidak.
6. **Membutuhkan Migration SQL Baru?** Ya (Tambahkan pada draft migration).
7. **Membutuhkan Persetujuan Pemilik Bisnis?** Tidak (Standar keamanan kepatuhan ketenagakerjaan).
8. **Dapat Diperbaiki Lokal Tanpa Production?** Ya (100% lokal).

---

### [ITEM-04] [HIGH] Sanitasi Mass Assignment pada `employeeService.saveEmployee`
1. **Penjelasan Masalah:**  
   `employeeService.saveEmployee` di `src/services/dataService.ts` (baris 356) menyalin objek `employee` secara mentah (`const payload = { ...employee, unit_id: unitId, ... }`).
2. **Dampak terhadap Bisnis:**  
   Objek form yang disusupi dapat mengirim field tak terduga ke database PostgREST.
3. **File Terkait:**  
   `src/services/dataService.ts:353-368`.
4. **Solusi yang Direkomendasikan:**  
   Terapkan *explicit whitelisting* atribut pada payload sebelum dikirim ke `supabase.from('employees')`.
5. **Membutuhkan Perubahan Frontend?** Ya (Refaktor fungsi di `dataService.ts`).
6. **Membutuhkan Migration SQL Baru?** Tidak.
7. **Membutuhkan Persetujuan Pemilik Bisnis?** Tidak.
8. **Dapat Diperbaiki Lokal Tanpa Production?** Ya (100% lokal).

---

### [ITEM-05] [MEDIUM] Pengalihan Approval Cuti ke Atomic State-Machine RPC
1. **Penjelasan Masalah:**  
   `leaveService.updateLeaveStatus` menggunakan direct `.update()` pada tabel `leave_requests`. Jika dua admin membuka permohonan yang sama dan secara bersamaan satu menyetujui sementara yang lain menolak, terjadi *race condition* tanpa mekanisme row-locking yang terjamin.
2. **Dampak terhadap Bisnis:**  
   Potensi inkonsistensi status permohonan cuti dan kuota bulanan staf.
3. **File Terkait:**  
   `src/services/dataService.ts:454-466` & migration.
4. **Solusi yang Direkomendasikan:**  
   Buat RPC `approve_or_reject_leave_atomic(p_unit_id, p_request_id, p_action, p_reason)` yang mengunci baris permohonan `FOR UPDATE`, memeriksa status `PENDING`, dan mencatat jejak audit secara otomatis.
5. **Membutuhkan Perubahan Frontend?** Ya (Arahkan pemanggilan service ke RPC).
6. **Membutuhkan Migration SQL Baru?** Ya.
7. **Membutuhkan Persetujuan Pemilik Bisnis?** Ya (Konfirmasi alur persetujuan cuti).
8. **Dapat Diperbaiki Lokal Tanpa Production?** Ya (100% lokal).

---

### [ITEM-06] [MEDIUM] Penambahan Validasi Alur Penerbitan SP (`warning_letters`)
1. **Penjelasan Masalah:**  
   `violationService.issueWarningLetter` langsung meng-insert `{ approval_status: 'APPROVED' }` ke database tanpa memerlukan persetujuan pimpinan unit.
2. **Dampak terhadap Bisnis:**  
   Surat Peringatan dapat langsung berstatus aktif dan memotong hak karyawan tanpa review atasan.
3. **File Terkait:**  
   `src/services/dataService.ts:590-608`.
4. **Solusi yang Direkomendasikan:**  
   Konfirmasi dengan pemilik bisnis apakah alur SP memerlukan status `DRAFT` / `PENDING_APPROVAL` oleh Kepala Toko, atau memang langsung sah saat diterbitkan oleh admin HR.
5. **Membutuhkan Perubahan Frontend?** Bergantung keputusan bisnis.
6. **Membutuhkan Migration SQL Baru?** Bergantung keputusan bisnis.
7. **Membutuhkan Persetujuan Pemilik Bisnis?** **YA (Keputusan Alur Kerja SP)**.
8. **Dapat Diperbaiki Lokal Tanpa Production?** Ya (100% lokal).

---

### [ITEM-07] [LOW] Pembersihan Skema Tabel Dormant `public_form_tokens`
1. **Penjelasan Masalah:**  
   Tabel `public_form_tokens` telah dicabut hak aksesnya di Batch B.3, namun skema fisiknya masih ada dan tidak pernah dipakai oleh modul manapun.
2. **Dampak terhadap Bisnis:**  
   Membebani pemeliharaan skema database (*schema bloat*).
3. **File Terkait:**  
   `supabase/migrations/20261104000001_core_schema_v3_1_0.sql`.
4. **Solusi yang Direkomendasikan:**  
   Biarkan dalam status terisolasi saat ini, lalu rencanakan `DROP TABLE` formal pada rilis mayor v3.2.0.
5. **Membutuhkan Perubahan Frontend?** Tidak.
6. **Membutuhkan Migration SQL Baru?** Ya (Saat rilis v3.2.0).
7. **Membutuhkan Persetujuan Pemilik Bisnis?** Tidak.
8. **Dapat Diperbaiki Lokal Tanpa Production?** Ya.

---

### [ITEM-08 & 09] [INFORMATIONAL] Batasan Perlindungan RLS & Pembersihan Cache Unit
1. **BYPASSRLS Boundary:** Dokumentasikan di pedoman deployment bahwa secret key `service_role` tidak boleh disematkan pada klien web karena mengabaikan seluruh kebijakan RLS.
2. **Query Cache Invalidation:** Pertahankan `queryClient.clear()` pada `UnitContext` saat beralih unit kerja untuk memastikan data cache La Tansa tidak terlihat di memori saat membuka Palen.

---

## 4. BUSINESS RULES PENDING APPROVAL (STATUS TETAP)

Parameter operasional berikut tetap diisolasi dan berstatus `BUSINESS_RULE_PENDING_APPROVAL` hingga ada persetujuan tertulis resmi dari pemilik bisnis:

1. **Persentase Tip Kaca:** Usulan formula 3%. *(Status: `BUSINESS_RULE_PENDING_APPROVAL`)*
2. **Aturan Pembulatan Tip:** Pembulatan ke atas kelipatan Rp1.000. *(Status: `BUSINESS_RULE_PENDING_APPROVAL`)*
3. **Batas Dimensi Kaca:** Batas panjang dan tinggi 5 cm s/d 600 cm. *(Status: `BUSINESS_RULE_PENDING_APPROVAL`)*
4. **Batas Kuantitas Lembar Kaca:** Batas 1 s/d 500 lembar. *(Status: `BUSINESS_RULE_PENDING_APPROVAL`)*
5. **Toleransi Lockout PIN:** Batas 5 kali gagal / lockout 30 menit. *(Status: `BUSINESS_RULE_PENDING_APPROVAL`)*
6. **Toleransi Waktu Lampau Booking Armada:** Batas 15 menit. *(Status: `BUSINESS_RULE_PENDING_APPROVAL`)*
7. **Maksimal Durasi Peminjaman Armada:** Batas 30 hari kalender. *(Status: `BUSINESS_RULE_PENDING_APPROVAL`)*
8. **Penggunaan `tip_percentage_snapshot`:** Kolom snapshot tarif nullable. *(Status: `BUSINESS_RULE_PENDING_APPROVAL`)*

---

## 5. ROADMAP EKSEKUSI & QUALITY GATES

Jika disetujui pengguna, langkah remediasi lokal akan dijalankan dengan alur terpadu:
- **Langkah 1 (Lokal):** Refaktor `systemService.saveUserRole` dan sanitasi mass assignment `saveEmployee` pada `dataService.ts`.
- **Langkah 2 (Lokal):** Tambahkan kebijakan `AS RESTRICTIVE FOR DELETE (false)` pada `employee_sensitive_data` di berkas draft migration `20261105000002`.
- **Langkah 3 (Lokal):** Rancang RPC pengganti yang aman `submit_leave_request_atomic` dan buka blokir portal cuti kiosk setelah teruji.
- **Langkah 4 (Quality Gates):** Jalankan `npm run typecheck`, `npm run build`, `npm run test:phase1:all`, `npm run test:phase2`, dan `npm run test:phase3`.

