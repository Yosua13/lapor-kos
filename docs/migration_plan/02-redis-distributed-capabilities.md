# Migration Plan: Fase 2 - Kemampuan Terdistribusi Berbasis Redis

- **Track ID:** ARCH-02
- **Fokus:** Peningkatan kinerja otentikasi (Fast Session Revocation O(1)), Distributed Sliding-Window Rate Limiter, dan Distributed Locking (Redlock) untuk background jobs.

---

## 1. Ruang Lingkup Pekerjaan

1. **Fast Session Revocation Cache**:
   - Menghapus ketergantungan query PostgreSQL langsung di `AuthMiddleware` pada setiap HTTP request.
   - Saat sesi pengguna atau tenant dicabut:
     - Simpan key `revoked:user:{userID}` dan `revoked:tenant:{propID}:{tenantID}` di Redis dengan TTL sepanjang durasi sisa masa berlaku token JWT.
   - Middleware cukup melakukan pengecekan `EXISTS` ke Redis (latensi <0.2ms).
2. **Distributed Sliding-Window Rate Limiter**:
   - Menggantikan implementasi map lokal `sync.Mutex` pada `internal/middleware/security.go`.
   - Menggunakan Redis Sorted Set (ZSET) dengan algoritma *Sliding Window Log*:
     - `ZREMRANGEBYSCORE` untuk membersihkan timestamp usang di luar window.
     - `ZCARD` untuk menghitung jumlah request aktif dalam window.
     - `ZADD` untuk mencatat request baru.
   - Bekerja secara konsisten di multi-replica/cluster tanpa kebocoran memori.
3. **Distributed Locking (Redlock / SETNX)**:
   - Mengamankan eksekusi periodik background jobs agar tidak terjadi *race condition* ganda:
     - `lock:billing:{periodKey}` untuk cron tagihan sewa bulanan.
     - `lock:period_close:{propID}:{periodKey}` untuk penutupan buku finansial.
     - `lock:checkout_execute:{checkoutID}` untuk eksekusi checkout kamar.
   - Mekanisme pelepasan lock menggunakan script Lua atomik.
4. **Active Property & Metadata Cache**:
   - Cache ringkasan properti aktif dan konfigurasi billing policy dengan TTL terukur dan invalidasi berbasis mutasi data.

---

## 2. Rincian File yang Dibuat / Dimodifikasi (One Function Per File)

```text
backend/
├── internal/
│   ├── infrastructure/
│   │   └── redis/
│   │       ├── set_session_revocation.go           # func SetSessionRevocation(ctx, client, userID, ttl) error
│   │       ├── is_session_revoked.go               # func IsSessionRevoked(ctx, client, userID) (bool, error)
│   │       ├── check_sliding_rate_limit.go         # func CheckSlidingRateLimit(ctx, client, key, limit, window) (bool, error)
│   │       ├── acquire_distributed_lock.go         # func AcquireDistributedLock(ctx, client, lockKey, val, ttl) (bool, error)
│   │       ├── release_distributed_lock.go         # func ReleaseDistributedLock(ctx, client, lockKey, val) error
│   │       ├── get_property_cache.go               # func GetPropertyCache(ctx, client, propID) (*PropSummary, error)
│   │       └── set_property_cache.go               # func SetPropertyCache(ctx, client, propID, data, ttl) error
│   ├── middleware/
│   │   ├── auth.go                                 # Update: gunakan redis is_session_revoked dengan fallback DB
│   │   └── distributed_rate_limit.go               # New: middleware rate limiter berbasis redis
│   └── cron/
│       └── billing_cron.go                         # Update: bungkus eksekusi dengan acquire_distributed_lock
```

---

## 3. Kriteria Penerimaan (Acceptance Criteria)

- [x] Pengecekan JWT pada `AuthMiddleware` berjalan instan melalui Redis dengan fallback transparan ke PostgreSQL jika Redis mengalami gangguan sementara.
- [x] Pencabutan sesi instan melalui `/api/security/sessions/revoke` langsung menginvaliasi token pada request berikutnya tanpa menunggu database query.
- [x] Rate limit teruji menolak request berlebih secara konsisten meskipun request dikirim ke port atau instance backend yang berbeda.
- [x] Background billing cron hanya dieksekusi tepat satu kali ketika dijalankan pada 2 atau lebih instance backend bersamaan.
