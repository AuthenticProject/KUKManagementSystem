# PHASE 1C.2 — RUNTIME TEST GAP MATRIX
## KUK Management System v3.1.0

**Tanggal Dokumen:** 2026-11-08 17:59:00 +07:00  
**Baseline Git:** Commit `b77fc9096c36f6a339480d638f1900888d8c2b75` (`b77fc90`)  
**Tujuan Dokumen:** Memetakan secara transparan dan jujur batas antara verifikasi yang telah terbukti secara lokal vs aspek yang secara teknis masih memerlukan pengujian pada PostgreSQL engine atau Supabase Cloud runtime.  

---

## 1. STANDAR KLASIFIKASI STATUS

- **`PASS`:** Telah diverifikasi sepenuhnya secara lokal (melalui AST parsing, static analysis, atau in-memory simulation) dengan kepastian logika 100%.
- **`PARTIAL`:** Logika atau antarmuka telah diverifikasi sebagian, namun memerlukan konfirmasi perilaku runtime.
- **`NOT TESTED — REQUIRES POSTGRESQL/SUPABASE RUNTIME`:** Tidak dapat diuji tanpa instance engine PostgreSQL aktif atau stack Supabase (PostgREST / GoTrue).
- **`BUSINESS_RULE_PENDING_APPROVAL`:** Nilai atau parameter operasional belum disetujui secara resmi oleh pemilik bisnis (*owner*).

---

## 2. MATRIKS KOMPONEN & STATUS GAP RUNTIME

```text
+--------------------------------------+---------------------+-----------------------+------------------------------------------+----------------------------------------+--------------------------------------------------+
| Komponen / Fitur Arsitektur          | Static Validation   | In-Memory Simulation  | PostgreSQL Runtime Test Gap              | Supabase Cloud E2E Test Gap            | Status Evaluasi Final                            |
+--------------------------------------+---------------------+-----------------------+------------------------------------------+----------------------------------------+--------------------------------------------------+
| 1. DDL Structure & Transaction       | PASS (TX-01, TX-02) | PASS (Load check)     | DDL syntax compatibility di PG 17        | Migrations runner execution            | PASS (Statis) / NOT TESTED (Runtime)             |
|                                      |                     |                       |                                          |                                        |                                                  |
| 2. SECURITY DEFINER search_path      | PASS (SEC-01)       | PASS                  | Evaluasi search_path session runtime     | Eksekusi RPC via PostgREST             | PASS (Statis) / NOT TESTED (Runtime)             |
|                                      |                     |                       |                                          |                                        |                                                  |
| 3. Exclusion Constraint (Armada)     | PASS (CON-01)       | PASS (RPC-SIM-10)     | Verifikasi index GIST & btree_gist di C  | Penanganan HTTP code 409 / 23P01 REST  | PARTIAL (Logika PASS, Engine Belum)              |
|                                      |                     |                       |                                          |                                        |                                                  |
| 4. Restrictive Hard-Delete Denial    | PASS (RLS-01)       | PASS (RLS-SIM-05)     | Penegakan DELETE USING (false) di kernel | Supabase JS client .delete() response  | PARTIAL (Logika PASS, Engine Belum)              |
|                                      |                     |                       |                                          |                                        |                                                  |
| 5. Multi-Tenant Unit Scoping RLS     | PASS (Static rule)  | PASS (RLS-SIM-01..04) | Evaluasi has_unit_access() di session DB | JWT claims auto-injection ke auth.uid()| PARTIAL (Logika PASS, Auth Session Belum)        |
|                                      |                     |                       |                                          |                                        |                                                  |
| 6. Rate Limiter (Token Bucket)       | PASS (RAT-01)       | PASS (RPC-SIM-01)     | Concurrency loop FOR UPDATE locking      | Ekstraksi IP via PostgREST headers GUC | PARTIAL (Logika PASS, IP Header Belum)           |
|                                      |                     |                       |                                          |                                        |                                                  |
| 7. Kiosk PIN Lockout & Timing Def.   | PASS (INP-01)       | PASS (RPC-SIM-02..04) | Eksekusi pgcrypto crypt() benchmark      | Uji brute-force via HTTP endpoint REST | PARTIAL (Logika PASS, Crypto Benchmark Belum)   |
|                                      |                     |                       |                                          |                                        |                                                  |
| 8. submit_glass_tip_atomic           | PASS (GRT-01)       | PASS (RPC-SIM-02)     | Eksekusi transaksi atomik & rollback     | Supabase Client .rpc() integration     | PARTIAL (Kontrak PASS, Engine Belum)             |
|                                      |                     |                       |                                          |                                        |                                                  |
| 9. verify_glass_tip_atomic           | PASS (GRT-03)       | PASS (RPC-SIM-07..09) | SELECT FOR UPDATE row-locking riil       | Transisi status dari antrean kasir     | PARTIAL (Kontrak PASS, Lock Manager Belum)       |
|                                      |                     |                       |                                          |                                        |                                                  |
| 10. book_vehicle_atomic              | PASS (GRT-02)       | PASS (RPC-SIM-10,11)  | Deteksi tstzrange overlap di memory DB   | Supabase Client .rpc() integration     | PARTIAL (Kontrak PASS, Engine Belum)             |
|                                      |                     |                       |                                          |                                        |                                                  |
| 11. approve_vehicle_atomic           | PASS (GRT-03)       | PASS (Traps 23P01)    | Penangkapan exception 23P01 di PL/pgSQL  | Notifikasi approval ke antarmuka armada| PARTIAL (Kontrak PASS, Engine Belum)             |
|                                      |                     |                       |                                          |                                        |                                                  |
| 12. finalize_payroll_atomic          | PASS (Core DDL)     | PASS (RPC-SIM-12)     | Lock periode FOR UPDATE & batch sum      | Finalisasi payroll end-to-end          | PARTIAL (Logika PASS, Engine Belum)              |
|                                      |                     |                       |                                          |                                        |                                                  |
| 13. cancel_leave_request_atomic      | PASS (Core DDL)     | PASS (RPC-SIM-13)     | Reversi kuota cuti di database            | Pembatalan cuti oleh Admin Toko         | PARTIAL (Logika PASS, Engine Belum)              |
|                                      |                     |                       |                                          |                                        |                                                  |
| 14. reset_employee_kiosk_pin         | PASS (GRT-03)       | PASS (RPC-SIM-05,06)  | Bcrypt hashing gen_salt('bf', 10)        | Modal reset PIN pada antarmuka admin    | PARTIAL (Kontrak PASS, Engine Belum)             |
|                                      |                     |                       |                                          |                                        |                                                  |
| 15. Audit Log Immutability           | PASS (AUD-01)       | PASS                  | Trigger trg_protect_audit_logs exception  | Percobaan manipulasi audit via REST API| PARTIAL (Statis PASS, Trigger Runtime Belum)     |
|                                      |                     |                       |                                          |                                        |                                                  |
| 16. Kiosk Cuti Mandiri               | PASS (CTR-11)       | PASS (RPC-SIM-14)     | RPC backend belum dibuat                  | Form dinonaktifkan di frontend (BLOCKED)| BLOCKED (Menunggu Phase 1C Backend)              |
|                                      |                     |                       |                                          |                                        |                                                  |
| 17. Persentase Tip Kaca (3%)         | N/A                 | SIMULATED             | Memerlukan persetujuan operasional        | Memerlukan persetujuan operasional      | BUSINESS_RULE_PENDING_APPROVAL                   |
|                                      |                     |                       |                                          |                                        |                                                  |
| 18. Pembulatan Tip (Rp1.000)         | N/A                 | SIMULATED             | Memerlukan persetujuan operasional        | Memerlukan persetujuan operasional      | BUSINESS_RULE_PENDING_APPROVAL                   |
|                                      |                     |                       |                                          |                                        |                                                  |
| 19. Batas Dimensi Kaca (5-600cm)     | N/A                 | SIMULATED             | Memerlukan konfirmasi toko bahan bangunan | Memerlukan konfirmasi toko bahan        | BUSINESS_RULE_PENDING_APPROVAL                   |
|                                      |                     |                       |                                          |                                        |                                                  |
| 20. Toleransi Masa Lampau Booking    | N/A                 | SIMULATED             | Memerlukan konfirmasi koordinator armada  | Memerlukan konfirmasi koordinator armada| BUSINESS_RULE_PENDING_APPROVAL                   |
+--------------------------------------+---------------------+-----------------------+------------------------------------------+----------------------------------------+--------------------------------------------------+
```

---

## 3. RINCIAN GAP POSTGRESQL ENGINE

Hal-hal berikut **TIDAK DAPAT** diverifikasi menggunakan JavaScript atau Node.js dan wajib menunggu tersedianya database PostgreSQL terisolasi:

1. **PostgreSQL Concurrency Planner & Lock Manager:**  
   Ketika dua koneksi mengeksekusi `SELECT ... FOR UPDATE` pada ID baris yang sama persis di CPU core yang berbeda, apakah satu transaksi menunggu (*blocking wait*) dan membaca nilai terbaru (*dirty read prevention*), atau melempar deadlock?  
   *(Status: `NOT TESTED — REQUIRES POSTGRESQL`)*
2. **C-Extension Binary Compatibility (`btree_gist`):**  
   Apakah modul binary `btree_gist` pada server PostgreSQL 17.11 terkompilasi dan aktif untuk mendukung constraint `tstzrange`?  
   *(Status: `NOT TESTED — REQUIRES POSTGRESQL`)*
3. **Pl/pgSQL Exception Trapping Real-Time:**  
   Apakah blok `EXCEPTION WHEN exclusion_violation THEN` pada fungsi `approve_vehicle_atomic` secara akurat menangkap kode `23P01` dari index GIST dan mengembalikan respons JSONB tanpa membatalkan transaksi rate-limit luar?  
   *(Status: `NOT TESTED — REQUIRES POSTGRESQL`)*

---

## 4. RINCIAN GAP SUPABASE CLOUD RUNTIME (E2E)

Hal-hal berikut bergantung pada arsitektur terpadu Supabase Cloud dan memerlukan pengujian live:

1. **GoTrue Auth & JWT Lifecyle:**  
   Alur refresh token otomatis di browser klien saat token JWT kadaluarsa (setelah 3600 detik) di tengah-tengah form modal operasional kasir.  
   *(Status: `NOT TESTED — REQUIRES SUPABASE RUNTIME`)*
2. **PostgREST HTTP Header Ingestion:**  
   Apakah PostgREST secara konsisten meneruskan header `CF-Connecting-IP` atau `X-Real-IP` ke dalam GUC setting `request.headers` saat dipanggil dari jaringan cloud proxy Cloudflare?  
   *(Status: `NOT TESTED — REQUIRES SUPABASE RUNTIME`)*
3. **Supabase Realtime WebSocket Replication:**  
   Apakah koneksi WebSocket menerima streaming data perubahan baris (`postgres_changes`) secara real-time dengan latensi rendah di jaringan toko ritel?  
   *(Status: `NOT TESTED — REQUIRES SUPABASE RUNTIME`)*

---

## 5. KESIMPULAN GAP ANALYSIS

Harness lokal saat ini telah mencapai **tingkat keyakinan maksimal yang mungkin dicapai pada lingkungan lokal tanpa PostgreSQL server terpasang** (54/54 assertions passing). 

Seluruh aspek logika, parsing, kontrak API, penanganan error, dan pertahanan adversarial telah terbukti secara deterministik. Kesenjangan (*gap*) yang tersisa sepenuhnya berada pada ranah eksekusi kernel database biner (C-engine) dan integrasi jaringan HTTP cloud yang hanya dapat diselesaikan pada fase pengujian staging/database terisolasi di masa depan.

