# Manual Test Cases: ARCH-02 Redis Distributed Capabilities

Dokumen ini memuat panduan pengujian manual dan verifikasi operasional untuk fitur-fitur kapabilitas terdistribusi berbasis Redis: Fast Session Revocation Cache, Distributed Sliding-Window Rate Limiting, Distributed Locking (Redlock), dan Property Metadata Cache.

---

## Ringkasan Skenario Uji

| Test ID | Judul Skenario | Prioritas | Tipe | Komponen Terkait |
|---|---|---|---|---|
| **REDIS-01** | Fast Session Revocation O(1) & Penolakan Token Seketika | P0 | Functional & Perf | `AuthMiddleware`, Redis Session Store |
| **REDIS-02** | Graceful Fallback ke PostgreSQL saat Redis Offline | P0 | Reliability | `AuthMiddleware`, `UserRepository` |
| **REDIS-03** | Distributed Sliding-Window Rate Limiter (ZSET) | P1 | Security & Limit | `DistributedRateLimit`, Redis ZSET |
| **REDIS-04** | Distributed Locking (Redlock / SETNX) pada Background Billing Cron | P0 | Concurrency | `BillingCron`, Redlock Lua Release |
| **REDIS-05** | Property Summary Metadata Cache & Invalidation | P1 | Performance | `PropertyCache`, Redis String |

---

## REDIS-01: Fast Session Revocation O(1) & Penolakan Token Seketika

### Tujuan
Memverifikasi bahwa pengecekan status JWT terjadi di Redis secara instan (<0.2ms) tanpa menyentuh PostgreSQL untuk sesi normal, dan token lama langsung ditolak status `401 Unauthorized` seketika setelah endpoint pencabutan sesi dipanggil.

### Langkah Pengujian
1. Login sebagai pengguna valid melalui `POST /api/auth/login`. Simpan token JWT yang diterima (`TOKEN_A`).
2. Kirim request berulang ke endpoint terproteksi `GET /api/auth/me` menggunakan `TOKEN_A`.
   - **Hasil Diharapkan**: Response `200 OK`. Latensi verifikasi auth di middleware < 0.2ms. Tidak ada query yang menyentuh tabel PostgreSQL `user_session_revocations`.
3. Panggil endpoint pencabutan sesi:
   ```bash
   POST /api/auth/revoke-sessions
   Authorization: Bearer <TOKEN_A>
   ```
   - **Hasil Diharapkan**: Response `200 OK` dengan pesan `"All previous sessions revoked successfully."`. Key `revoked:user:<userID>` tersimpan di Redis dengan TTL 30 hari.
4. Kirim ulang request `GET /api/auth/me` menggunakan `TOKEN_A`.
   - **Hasil Diharapkan**: Response langsung ditolak dengan status HTTP `401 Unauthorized` dan body `{"error": "Session has been revoked"}` tanpa menyentuh tabel PostgreSQL.
5. Login kembali untuk mendapatkan token baru (`TOKEN_B`).
6. Kirim request `GET /api/auth/me` menggunakan `TOKEN_B`.
   - **Hasil Diharapkan**: Response `200 OK`. Token baru yang diterbitkan setelah waktu revokasi tetap diizinkan.

---

## REDIS-02: Graceful Fallback ke PostgreSQL saat Redis Offline

### Tujuan
Memastikan aplikasi tidak panik (*no crash*) dan otentikasi tetap berjalan normal melalui fallback query PostgreSQL jika koneksi Redis terputus.

### Langkah Pengujian
1. Hentikan container Redis (`docker-compose stop redis`).
2. Jalankan request ke endpoint terproteksi `GET /api/auth/me` dengan token JWT valid.
   - **Hasil Diharapkan**: Backend mencatat log fallback, namun request tetap berhasil (`200 OK`) karena verifikasi dialihkan secara transparan ke PostgreSQL `UserRepository.IsSessionValid`.
3. Coba akses menggunakan token yang telah tercatat revoked di database PostgreSQL.
   - **Hasil Diharapkan**: Request tetap ditolak dengan `401 Unauthorized` (`"Session has been revoked"`).
4. Nyalakan kembali container Redis (`docker-compose start redis`).
   - **Hasil Diharapkan**: Redis client otomatis menyambung kembali (*auto-reconnect*) dan pengecekan O(1) Redis aktif kembali tanpa perlu me-restart server backend.

---

## REDIS-03: Distributed Sliding-Window Rate Limiter (ZSET)

### Tujuan
Memverifikasi bahwa rate limiting dengan algoritma sliding window log ZSET membatasi request secara akurat lintas thread/instance dan mengembalikan header `Retry-After`.

### Langkah Pengujian
1. Kirim request bertubi-tubi ke endpoint login `POST /api/auth/login` (konfigurasi: 10 request per 10 detik).
2. Request ke-1 hingga ke-10:
   - **Hasil Diharapkan**: Diproses normal (HTTP 200/400).
3. Request ke-11 dalam jendela waktu 10 detik:
   - **Hasil Diharapkan**: Ditolak dengan status HTTP `429 Too Many Requests`.
   - Header memuat `Retry-After: <detik>`.
   - Body response: `{"error": "Too many requests, please try again later"}`.
4. Tunggu hingga durasi jendela 10 detik berlalu.
5. Kirim kembali request login.
   - **Hasil Diharapkan**: Request diizinkan kembali secara otomatis karena item log usang di luar sliding window telah dibersihkan oleh `ZREMRANGEBYSCORE`.

---

## REDIS-04: Distributed Locking (Redlock / SETNX) pada Background Billing Cron

### Tujuan
Menjamin eksekusi background billing cron hanya dilakukan tepat satu kali oleh satu worker instance dan aman dari *race condition* atau *double-billing*.

### Langkah Pengujian
1. Simulasikan dua proses/instance backend berjalan bersamaan.
2. Trigger eksekusi penagihan secara paralel:
   ```bash
   POST /api/cron/trigger
   X-Cron-Secret: <CRON_SECRET>
   ```
3. Amati log sistem:
   - **Hasil Diharapkan**:
     - Worker 1 berhasil melakukan acquire lock `billing:scheduled:<propertyID>:<date>` via Redis `SETNX`.
     - Worker 2 mendeteksi lock aktif dan mencatat log:
       `[BILLING] property <id> billing is currently locked by another worker instance, skipping`
     - Tagihan sewa untuk properti tersebut hanya dibuat tepat satu kali.
     - Setelah Worker 1 selesai, lock dilepas secara aman melalui script atomik Lua tanpa merusak lock proses lain.

---

## REDIS-05: Property Summary Metadata Cache & Invalidation

### Tujuan
Memverifikasi penyimpanan dan pengambilan ringkasan metadata properti pada Redis dengan penanganan cache-miss yang aman.

### Langkah Pengujian
1. Panggil `GetPropertyCache` untuk ID properti yang belum dicache.
   - **Hasil Diharapkan**: Mengembalikan `nil, nil` (cache miss bersih tanpa error).
2. Simpan cache data via `SetPropertyCache(ctx, client, propID, data, 15*time.Minute)`.
   - **Hasil Diharapkan**: Key `cache:prop:<propID>` tersimpan di Redis dalam format JSON.
3. Panggil kembali `GetPropertyCache(ctx, client, propID)`.
   - **Hasil Diharapkan**: Data struct `PropertySummaryCache` ter-unmarshal secara sempurna dengan latensi memori sub-milidetik.
