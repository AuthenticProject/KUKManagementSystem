# PHASE 1C.3 — SUPABASE REALTIME IMPLEMENTATION PLAN
## KUK Management System v3.1.0

**Status Dokumen:** **ARCHITECTURAL PLAN ONLY — NOT YET IMPLEMENTED**  
**Tanggal Penyusunan:** 2026-11-08 17:45:00 +07:00  
**Target Backend:** Supabase Cloud Production (`ckzciuybedefbsdfsexh`) — PostgreSQL 17.11  
**Aturan Mutlak:** **DILARANG MENGUBAH PUBLIKASI PRODUCTION / DILARANG MENAMBAH SUBSCRIPTION SEBELUM PERSETUJUAN**  

---

## 1. PENDAHULUAN & PRINSIP DASAR REALTIME

Penerapan Supabase Realtime pada KUK Management System v3.1.0 bertujuan untuk memberikan sinkronisasi instan antar-perangkat operasional (misalnya saat nota tip diajukan dari kiosk pemotong kaca, kasir di meja kasir langsung melihat notifikasi nota baru tanpa perlu me-refresh halaman).

### Prinsip Keamanan & Efisiensi Realtime:
1. **RLS Enforced:** Realtime dalam Supabase JS v2 menghormati kebijakan Row Level Security (RLS) untuk pengguna terautentikasi (*Authenticated Users*). Pengguna hanya menerima payload perubahan data baris (*change events*) yang diizinkan untuk mereka baca oleh RLS policy.
2. **Channel Naming Bukan Otorisasi:** Penamaan channel seperti `glass_tips:unit_id` semata-mata adalah konvensi perutean (*routing convention*), **BUKAN mekanisme keamanan**. Otorisasi sejati tetap berada pada RLS policy di PostgreSQL.
3. **Selektivitas Modul:** Tidak semua tabel memerlukan Realtime. Menghubungkan semua tabel ke Realtime hanya akan memboroskan kuota koneksi, meningkatkan beban CPU PostgreSQL (WAL replication), dan berpotensi memicu *memory leak* di browser.
4. **Resilience & Fallback:** Koneksi WebSocket Realtime dapat terputus sewaktu-waktu di jaringan seluler/toko ritel. Setiap komponen yang menggunakan Realtime **WAJIB** memiliki *refetch fallback* (baik via tombol muat ulang manual maupun sinkronisasi ulang saat reconnect).

---

## 2. INVENTARISASI MODUL & KEBUTUHAN REALTIME

Dari seluruh modul aplikasi, dilakukan klasifikasi ketat antara modul yang **benar-benar membutuhkan Realtime** vs modul yang **cukup mengandalkan refetch biasa**:

```text
+------------------------------+--------------------+------------------------------+---------------------+-------------------+
| Modul Aplikasi               | Tabel Target       | Event yang Dibutuhkan        | Prioritas / Urgensi | Kebutuhan Filter  |
+------------------------------+--------------------+------------------------------+---------------------+-------------------+
| 1. Glass Tips (Tip Kaca)     | glass_tips         | INSERT, UPDATE               | KRITIS (Prioritas 1)| unit_id = eq.UUID |
| 2. Fleet (Peminjaman Armada) | vehicle_borrowing_ | INSERT, UPDATE               | KRITIS (Prioritas 1)| unit_id = eq.UUID |
|                              | requests           |                              |                     |                   |
| 3. Leave (Pengajuan Cuti)    | leave_requests     | INSERT, UPDATE               | TINGGI (Prioritas 2)| unit_id = eq.UUID |
| 4. Attendance (Kehadiran)    | daily_attendance   | INSERT, UPDATE               | TINGGI (Prioritas 2)| unit_id = eq.UUID |
| 5. Dashboard (Ringkasan)     | (Mendengar event   | UPDATE aggregate counter     | SEDANG (Prioritas 3)| unit_id = eq.UUID |
|                              | modul di atas)     |                              |                     |                   |
| 6. Employees (Karyawan)      | employees          | TIDAK PERLU (Refetch cukup)  | RENDAH (No RT)      | -                 |
| 7. Violations & SP           | violation_records  | TIDAK PERLU (Refetch cukup)  | RENDAH (No RT)      | -                 |
| 8. Payroll (Penggajian)      | payroll_periods    | TIDAK PERLU (Batch bulanan)  | RENDAH (No RT)      | -                 |
| 9. Audit Logs (Log Jejak)    | audit_logs         | DILARANG (Beban WAL tinggi)  | DIHINDARI (No RT)   | -                 |
| 10. Settings & RBAC          | roles, permissions | DILARANG (Konfigurasi statis)| DIHINDARI (No RT)   | -                 |
+------------------------------+--------------------+------------------------------+---------------------+-------------------+
```

---

## 3. SPESIFIKASI TEKNIS SUBSCRIPTION PER MODUL PRIORITAS

### 3.1. Modul 1: Glass Tips (Prioritas 1 — Kritis)
- **Use Case:** Pemotong kaca mengajukan nota dari kiosk publik → Kasir menerima notifikasi nota baru secara instan untuk diverifikasi.
- **Tabel:** `public.glass_tips`
- **Events:**
  - `INSERT`: Menambahkan nota baru dengan status `PENDING` ke antrean verifikasi kasir.
  - `UPDATE`: Memperbarui status nota (misal: saat diverifikasi oleh kasir lain atau dibatalkan).
- **Filter Channel:** `unit_id=eq.${activeUnitId}`
- **Channel Name:** `realtime:glass_tips:${activeUnitId}`
- **Security Check:** RLS policy `glass_tips_select` memastikan hanya staf yang memiliki `has_unit_access(unit_id)` yang menerima payload baris.

### 3.2. Modul 2: Fleet Borrowing Requests (Prioritas 1 — Kritis)
- **Use Case:** Karyawan/tamu mengajukan peminjaman kendaraan → Koordinator armada menerima notifikasi permohonan baru untuk ditinjau.
- **Tabel:** `public.vehicle_borrowing_requests`
- **Events:**
  - `INSERT`: Menambahkan pengajuan baru (status `PENDING`).
  - `UPDATE`: Memperbarui status menjadi `APPROVED`, `REJECTED`, atau `IN_USE`.
- **Filter Channel:** `unit_id=eq.${activeUnitId}`
- **Channel Name:** `realtime:fleet:${activeUnitId}`
- **Security Check:** RLS policy membatasi pembacaan data armada pada unit pengguna.

### 3.3. Modul 3: Leave Requests (Prioritas 2 — Tinggi)
- **Use Case:** Pengajuan cuti diajukan → Admin Toko / Kepala Toko melihat antrean persetujuan cuti bertambah.
- **Tabel:** `public.leave_requests`
- **Events:** `INSERT`, `UPDATE`
- **Filter Channel:** `unit_id=eq.${activeUnitId}`
- **Channel Name:** `realtime:leave:${activeUnitId}`

### 3.4. Modul 4: Attendance Monitoring (Prioritas 2 — Tinggi)
- **Use Case:** Karyawan absen kehadiran di briefing pagi → Layar monitor admin menampilkan jumlah staf hadir secara live.
- **Tabel:** `public.daily_attendance`
- **Events:** `INSERT`, `UPDATE`
- **Filter Channel:** `unit_id=eq.${activeUnitId}`
- **Channel Name:** `realtime:attendance:${activeUnitId}`

---

## 4. SUBSCRIPTION LIFECYCLE & CLEANUP PATTERNS

Pencegahan kebocoran memori (*memory leak*) dan *duplicate events* menjadi prioritas arsitektur tertinggi.

### 4.1. Pola Standar React Hook untuk Realtime (`useRealtimeSubscription`)
Setiap langganan Realtime wajib mengikuti pola *lifecycle* ketat:

```typescript
// Architectural Reference Pattern (Untuk Implementasi Lokal Nanti)
useEffect(() => {
  if (!activeUnitId) return;

  const channelName = `realtime:${table}:${activeUnitId}`;
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*', // atau spesifik 'INSERT' | 'UPDATE'
        schema: 'public',
        table: table,
        filter: `unit_id=eq.${activeUnitId}`,
      },
      (payload) => {
        handleRealtimeEvent(payload);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setRealtimeStatus('CONNECTED');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setRealtimeStatus('ERROR');
        triggerFallbackRefetch();
      }
    });

  // CLEANUP MUTLAK: Selalu unsubscribe dan remove channel saat unmount atau ganti unit
  return () => {
    supabase.removeChannel(channel);
  };
}, [activeUnitId, table]);
```

### 4.2. Penanganan Pergantian Unit (`UnitContext`)
Ketika pengguna berpindah dari unit "TB KUK La Tansa" ke "KUK Palen", channel lama **WAJIB** ditutup terlebih dahulu sebelum membuka channel untuk unit baru. Ini otomatis dijamin oleh dependensi `activeUnitId` pada `useEffect` yang menjalankan fungsi pembersih (*cleanup*) sebelum re-subscribe.

---

## 5. RECONNECT BEHAVIOR & REFETCH FALLBACK

Koneksi WebSocket tidak selalu stabil. Pola ketahanan (*resilience architecture*) dirancang sebagai berikut:

```text
[ WebSocket Terhubung ] ──(Koneksi Putus)──► [ WebSocket Disconnected ]
                                                    │
                                                    ▼
                                            [ Menampilkan Indikator Offline ]
                                                    │
                                        (Auto Reconnect Supabase Client)
                                                    │
                                                    ▼
                                            [ WebSocket Re-Subscribed ]
                                                    │
                                                    ▼
                                [ TRIGGER FULL REFETCH DATABASE OTOMATIS ]
                                (Mencegah event yang hilang selama terputus)
```

1. **Auto-Refetch on Reconnect:**  
   Ketika channel beralih kembali ke status `SUBSCRIBED` setelah sebelumnya `CHANNEL_ERROR` atau `CLOSED`, klien **wajib memicu full refetch** data tabel. Hal ini krusial karena ada kemungkinan mutasi data terjadi saat browser sedang disconnected yang tidak sempat diterima lewat streaming WebSocket.
2. **Tombol Refetch Manual:**  
   Setiap halaman tetap mempertahankan tombol *"Muat Ulang / Refresh Data"* sebagai fallback manual kasir/admin.

---

## 6. ANALISIS RISIKO & BEBAN INFRASTRUKTUR

1. **Batas Kuota Koneksi Konkuren (Concurrent Connections):**
   - Supabase Free Tier memiliki batas **200 concurrent Realtime connections**.
   - Dengan estimasi perangkat operasional:
     - 2 Kasir La Tansa
     - 2 Kasir Palen
     - 2 Admin / Kepala Toko
     - 2 Tablet Kiosk
     - Maksimal ~10–20 koneksi simultan aktif.
   - *Status Beban:* **Sangat aman** (< 10% dari batas Free Tier).
2. **Beban PostgreSQL WAL (Write-Ahead Logging):**
   - Menambahkan tabel bervolume tinggi seperti `audit_logs` ke Realtime publication akan membebani logical decoding worker di PostgreSQL.
   - *Mitigasi:* Tabel `audit_logs`, `permissions`, `roles`, dan `payroll_records` **TIDAK DIIZINKAN** dimasukkan ke dalam publikasi Realtime.
3. **Kebocoran Data Antar-Unit:**
   - Realtime di Supabase JS menghormati RLS. Namun jika filter `unit_id=eq.<id>` tidak disertakan di sisi klien, klien menerima event dari seluruh unit yang diizinkan oleh RLS-nya (misal Admin Pusat menerima event dari kedua unit bercampur aduk).
   - *Mitigasi:* Selalu sertakan parameter `filter: 'unit_id=eq.' + activeUnitId` pada subscription.

---

## 7. TAHAPAN IMPLEMENTASI LOKAL BERTAPAP

Penerapan Realtime akan dilakukan melalui 4 fase terkontrol:

- **Fase A (Persiapan Utility):**  
  Membuat hook kustom terpusat `src/hooks/useRealtimeUnitSubscription.ts` dengan manajemen lifecycle, logging status koneksi, dan mekanisme auto-refetch.
- **Fase B (Implementasi Pilot Modul Glass Tips):**  
  Menerapkan hook pada `GlassTipListPage.tsx` untuk mendengar `INSERT` dan `UPDATE` pada tabel `glass_tips`. Uji coba transisi status nota saat diajukan vs saat diverifikasi.
- **Fase C (Implementasi Modul Fleet):**  
  Menerapkan hook pada `FleetListPage.tsx` untuk mendengar permohonan peminjaman armada baru.
- **Fase D (Evaluasi & Quality Gate):**  
  Uji konkurensi antar tab browser lokal, verifikasi pelepasan channel saat unmount, dan pengukuran stabilitas memori.

---

## 8. CHECKLIST SEBELUM PERUBAHAN PRODUCTION

Sebelum Realtime dapat diaktifkan pada Supabase Cloud Production (`ckzciuybedefbsdfsexh`), checklist berikut **WAJIB** dipenuhi:

```text
[ ] 1. Draft migration 20261105000002_security_rpc_and_remediation.sql telah diverifikasi dan disetujui.
[ ] 2. Pengguna memeriksa status publikasi default di Supabase Dashboard (Database -> Replication).
[ ] 3. Perintah DDL publikasi disiapkan secara spesifik (BUKAN ALL TABLES):
       ALTER PUBLICATION supabase_realtime ADD TABLE glass_tips, vehicle_borrowing_requests;
[ ] 4. RLS policies untuk SELECT pada tabel target telah terbukti aman dari kebocoran data.
[ ] 5. Frontend test suite (typecheck, build, simulation) lulus 100%.
[ ] 6. Persetujuan tertulis dari pengguna sebelum DDL remote dieksekusi.
```

---
*Rencana implementasi Realtime ini berstatus DRAFT ARSITEKTUR LOKAL dan TIDAK melakukan mutasi apapun pada lingkungan Production.*

