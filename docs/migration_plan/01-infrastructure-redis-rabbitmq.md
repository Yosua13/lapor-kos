# Migration Plan: Fase 1 - Fondasi Infrastruktur Redis & RabbitMQ

- **Track ID:** ARCH-01
- **Fokus:** Setup dependensi, containerisasi lokal, konfigurasi env, koneksi resilient, dan health/readiness check probes.

---

## 1. Ruang Lingkup Pekerjaan

1. **Dependensi Go**:
   - Install `github.com/redis/go-redis/v9` untuk konektivitas Redis.
   - Install `github.com/rabbitmq/amqp091-go` untuk driver RabbitMQ.
2. **Containerisasi Lingkungan Lokal (`docker-compose.yml`)**:
   - Menambahkan service Redis 7 (Alpine) dengan proteksi password dan volume persistent.
   - Menambahkan service RabbitMQ 3.13 (Management Alpine) dengan port AMQP `5672` dan dashboard `15672`.
3. **Konfigurasi Aplikasi (`internal/config/config.go`)**:
   - Memuat variabel environment:
     - `REDIS_URL` / `REDIS_ADDR`, `REDIS_PASSWORD`, `REDIS_DB`.
     - `RABBITMQ_URL`.
4. **Modul Koneksi Resilient**:
   - `internal/infrastructure/redis/connection.go`: Inisialisasi Redis Client dengan connection pool, ping timeout, dan graceful reconnect.
   - `internal/infrastructure/rabbitmq/connection.go`: Inisialisasi RabbitMQ connection & channel manager dengan auto-reconnect listener.
5. **Observability & Health Probes**:
   - Memperbarui `/healthz` dan `/readyz` untuk memeriksa status ketersediaan Redis dan RabbitMQ selain PostgreSQL.

---

## 2. Rincian File yang Dibuat / Dimodifikasi

```text
backend/
├── docker-compose.yml                              # Update: tambah redis & rabbitmq service
├── internal/
│   ├── config/
│   │   └── config.go                               # Update: tambah RedisConfig & RabbitMQConfig
│   ├── infrastructure/
│   │   ├── redis/
│   │   │   ├── connection.go                       # New: func NewClient(...) (*redis.Client, error)
│   │   │   └── ping.go                             # New: func Ping(ctx, client) error
│   │   └── rabbitmq/
│   │       ├── connection.go                       # New: func NewConnection(url) (*Connection, error)
│   │       ├── declare_topology.go                 # New: deklarasi exchange dasar & dead-letter queue
│   │       └── ping.go                             # New: func Ping(conn) error
│   └── handler/
│       └── security_audit_handler.go               # Update: healthz/readyz probe menyertakan redis & rabbitmq
```

---

## 3. Kriteria Penerimaan (Acceptance Criteria)

- [ ] Redis dapat diakses melalui Docker Compose dan lolos ping konektivitas dari backend.
- [ ] RabbitMQ Management UI dapat diakses pada port 15672 dengan kredensial terkonfigurasi.
- [ ] Graceful degradation: Jika Redis atau RabbitMQ terputus, backend tidak crash seketika, melainkan mencatat error log terstruktur dan mencoba reconnect.
- [ ] Endpoint `/readyz` dan `/api/health` melaporkan status konektivitas 3 komponen utama: PostgreSQL, Redis, dan RabbitMQ.
