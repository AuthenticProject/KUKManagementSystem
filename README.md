# KUK Management System V3 (Clean Rebuild)
## Multi-Unit · Production-Oriented · Enterprise Grade

Sistem manajemen operasional terpadu untuk organisasi bisnis **KUK**, mengelola multi-unit usaha (**TB KUK La Tansa** dan **KUK Palen**), kepegawaian, presensi briefing & fingerprint, pemotongan kaca, pelanggaran kerja, penggajian, serta armada operasional kendaraan.

---

## Indeks Dokumentasi Arsitektur, Verifikasi & Desain Database (v3.1.0)

Seluruh dokumentasi teknis, hasil audit verifikasi, dan matriks keamanan sistem tersedia di direktori [`docs/`](./docs/):

### Laporan Pelaksanaan & Verifikasi Phase 1 (Fondasi Aplikasi, Auth & Verifikasi Runtime)
1. **[PHASE_1_IMPLEMENTATION_REPORT.md](./docs/PHASE_1_IMPLEMENTATION_REPORT.md)**: Laporan detail implementasi fondasi aplikasi React 18 + TS + Vite + Tailwind CSS, Multi-Unit Auth, Route Guards, Error Boundary, dan Layout Shell responsif.
2. **[PHASE_1_TEST_REPORT.md](./docs/PHASE_1_TEST_REPORT.md)**: Matriks pengujian komprehensif Phase 1 (Typecheck, Production Build, Dev Server Restart, 15 Rute SPA Refresh, Unit Test RBAC 5/5 PASSED, Guard Akun Nonaktif & Tanpa Profil, dan status BLOCKED live Supabase).
3. **[PHASE_1_DATABASE_REPORT.md](./docs/PHASE_1_DATABASE_REPORT.md)**: Spesifikasi arsitektur skema SQL kanonikal v3.1.0 (`20261104000001_core_schema_v3_1_0.sql`, 2,084 baris, 60 tabel, 18 ENUM, dan 10 fungsi/trigger).
4. **[PHASE_1_SECURITY_REVIEW.md](./docs/PHASE_1_SECURITY_REVIEW.md)**: Audit keamanan mendalam Phase 1: pemindaian secret bundle, proteksi `.gitignore` pada `.env`, ketiadaan logging PIN/kredensial, dan kemandirian database RLS.
5. **[PHASE_1_MIGRATION_VALIDATION.md](./docs/PHASE_1_MIGRATION_VALIDATION.md)**: Validasi graf dependensi relasional SQL migrasi, remediasi forward-reference `glass_tips` -> `payroll_periods`, penegakan RLS pada 60/60 tabel, dan jaminan eksekusi clean-slate database.

### Dokumen Verifikasi Teknis Phase 0.5
6. **[TECHNICAL_VERIFICATION_REPORT.md](./docs/TECHNICAL_VERIFICATION_REPORT.md)**: Laporan verifikasi teknis menyeluruh (konsistensi dokumen, keamanan data, audit logika RPC, dan penyelarasan composite foreign key).
7. **[IMPLEMENTATION_READINESS.md](./docs/IMPLEMENTATION_READINESS.md)**: Keputusan kelayakan implementasi dan status verifikasi Phase 1 (**PHASE 1 IN PROGRESS · AWAITING USER APPROVAL**).
8. **[BUSINESS_RULES_CONFIRMATION.md](./docs/BUSINESS_RULES_CONFIRMATION.md)**: Daftar butir kebijakan operasional yang dikonfirmasi resmi manajemen (Cuti Admin 3 & Tip Kaca 3% CONFIRMED).
9. **[FEATURE_COVERAGE_MATRIX.md](./docs/FEATURE_COVERAGE_MATRIX.md)**: Matriks pemetaan 20 domain kebutuhan fungsional terhadap kesiapan skema database (95% Ready, 5% Later Phase).
10. **[SECURITY_TEST_PLAN.md](./docs/SECURITY_TEST_PLAN.md)**: Rencana pengujian teknis 12 skenario inti keamanan (isolasi multi-unit, anti-bruteforce, exclusion booking, locking cuti, dan immutability).

### Spesifikasi Inti Database & ERD (v3.1.0)
11. **[DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)**: Spesifikasi skema database PostgreSQL 15+ Supabase versi 3.1.0 lengkap (Composite Foreign Keys, Exclusion Constraints, Data Dictionary 35 tabel, dan trigger immutability).
12. **[ERD.md](./docs/ERD.md)**: Visualisasi diagram entitas-relasi (Mermaid ER-diagrams v3.1.0) untuk seluruh 9 domain modul sistem beserta matriks kardinalitas.
13. **[DATABASE_AUDIT_REPORT.md](./docs/DATABASE_AUDIT_REPORT.md)**: Laporan audit arsitektur dari versi 3.0.0 ke 3.1.0.
14. **[DATABASE_CONSTRAINT_MATRIX.md](./docs/DATABASE_CONSTRAINT_MATRIX.md)**: Matriks lengkap penegakan integritas database (Composite Keys, Exclusion Constraints `btree_gist`, Partial Unique Indexes, Check Constraints, dan On-Delete).
15. **[RPC_SPECIFICATION.md](./docs/RPC_SPECIFICATION.md)**: Spesifikasi Stored Procedures / RPCs transaksi atomik (`submit_leave_request_atomic`, `cancel_leave_request_atomic`, `book_vehicle_atomic`, `calculate_and_finalize_payroll_atomic`, `generate_document_number_atomic`).
16. **[RLS_POLICY_MATRIX.md](./docs/RLS_POLICY_MATRIX.md)**: Matriks kebijakan Row Level Security (RLS) menyeluruh untuk seluruh tabel privat, isolasi multi-unit, dan proteksi mutlak audit logs.

### Blueprint & Panduan Operasional Pendukung
17. **[SYSTEM_BLUEPRINT.md](./docs/SYSTEM_BLUEPRINT.md)**: Cetak biru arsitektur sistem, topologi komponen, dan spesifikasi tech stack.
18. **[BUSINESS_RULES.md](./docs/BUSINESS_RULES.md)**: Spesifikasi aturan bisnis operasional organisasi.
19. **[SECURITY_RULES.md](./docs/SECURITY_RULES.md)**: Kebijakan keamanan, threat modeling, dan test suite keamanan.
20. **[ROLE_PERMISSION_MATRIX.md](./docs/ROLE_PERMISSION_MATRIX.md)**: Matriks peran pengguna (RBAC) dan izin granular.
21. **[DEVELOPMENT_ROADMAP.md](./docs/DEVELOPMENT_ROADMAP.md)**: Rencana pengembangan bertahap 8 fase (Phase 0 s/d Phase 7).
22. **[MIGRATION_PLAN.md](./docs/MIGRATION_PLAN.md)**: Rencana audit sistem lama (V2) dan strategi migrasi data 11 karyawan resmi.

---

## Status Proyek Saat Ini
- **Fase Aktif**: **PHASE 1 (Fondasi Aplikasi, Multi-Unit Auth & Layout Shell) — TAHAP VERIFIKASI & PENGUATAN**
- **Kondisi Kompilasi & Runtime**: **PASSED (0 TypeScript errors, Vite Dev Server & Production Build 100% Sukses)**
- **Kondisi Skema**: **100% Dependency Compliant (60 tabel, 18 ENUM, 10 fungsi/trigger, 60/60 tabel RLS enabled, bebas forward-reference)**
- **Keamanan**: **PASSED (Secret scan clean, .env git-ignored, instant inactive/no-profile guard, total cache purging on unit switch)**
- **Status Persetujuan**: **Menunggu persetujuan tertulis pengguna sebelum melangkah ke Phase 2**

---

## Panduan Menjalankan Aplikasi Frontend Secara Lokal

```bash
# 1. Pastikan dependensi telah terpasang
npm.cmd install

# 2. Periksa keabsahan tipe data
npm.cmd run typecheck

# 3. Jalankan server pengembangan Vite
npm.cmd run dev

# 4. Membangun bundel produksi
npm.cmd run build
```
# KUKManagementSystem
