# Master Implementation Plan: Backend Architecture Modernization & Data/Code Structure Migration

- **Epic:** [EPIC 14] Backend Modernization: Clean Architecture, One-Function-Per-File, Redis & RabbitMQ
- **Target Sistem:** Go Gin Backend, PostgreSQL (`pgxpool`), Redis (`go-redis/v9`), RabbitMQ (`amqp091-go`)
- **Prinsip Utama:** Single Responsibility Principle (SRP) murni, 1 File = 1 Fungsi/Use Case, Property-Scoped Multi-Tenancy, Zero-Downtime Migration.

---

## 1. Latar Belakang & Tujuan

Berdasarkan analisis mendalam terhadap backend Lapor Kos, struktur saat ini memiliki fondasi domain dan kontrol multi-tenancy yang sangat baik, namun menghadapi tantangan skalabilitas dan pemeliharaan (*maintainability*):
1. **God Files & Monolitik Repository/Handler**: File seperti `finance_repository.go` (>1.200 baris, 48 KB) dan `complaint_handler.go` (29.5 KB) mencampuradukkan puluhan tanggung jawab yang berbeda.
2. **Ketiadaan Use-Case Layer**: Handler HTTP memanggil repository secara langsung dan mengorkestrasi dependensi eksternal (AI, WhatsApp, Email, Storage).
3. **Overhead I/O Database untuk Verifikasi Sesi**: Pengecekan status revokasi sesi pada setiap request HTTP membebani PostgreSQL.
4. **Polling Cron In-Memory**: Polling outbox notifikasi setiap 15 detik dan billing cron yang berjalan tanpa *distributed lock* berisiko bentrok saat aplikasi diskalakan ke multi-instance.

**Tujuan Rencana Migrasi:**
- Mentransformasi arsitektur backend ke **Clean Architecture** berlapis (**Domain**, **Use Case**, **Infrastructure**, **Delivery**).
- Menerapkan pola **One Function Per File** untuk seluruh Use Case, HTTP Handler, Database Query, dan Queue Consumer.
- Mengintegrasikan **Redis** untuk cache revokasi sesi instan (*O(1)*), distributed rate limiter, dan distributed locking (Redlock).
- Mengintegrasikan **RabbitMQ** untuk pemrosesan notifikasi asynchronous, background export job, dan AI triage decoupling.

---

## 2. Struktur Fase Pelaksanaan (Decomposed Tracks)

Migrasi dipecah menjadi 4 fase mandiri yang terdokumentasi terpisah di subdirektori `docs/migration_plan/`:

| Fase | Dokumen Rinci | Ruang Lingkup Utama | Output Utama |
| :---: | :--- | :--- | :--- |
| **Fase 1** | [01-infrastructure-redis-rabbitmq.md](file:///d:/project_yosua/lapor-kos/docs/migration_plan/01-infrastructure-redis-rabbitmq.md) | Setup dependensi, containerisasi Docker Compose, config, health checks | Redis & RabbitMQ client siap digunakan, health probes termonitor |
| **Fase 2** | [02-redis-distributed-capabilities.md](file:///d:/project_yosua/lapor-kos/docs/migration_plan/02-redis-distributed-capabilities.md) | Fast session cache, sliding-window rate limit, Redlock billing/cron | Pengecekan JWT O(1) <0.2ms, distributed lock aman multi-replica |
| **Fase 3** | [03-rabbitmq-event-driven-messaging.md](file:///d:/project_yosua/lapor-kos/docs/migration_plan/03-rabbitmq-event-driven-messaging.md) | Event broker, notification consumers (WA/Email), DLQ, async PDF/CSV | Penghapusan polling DB cron, reliabilitas pengiriman pesan dengan retry |
| **Fase 4** | [04-domain-decomposition-one-func-per-file.md](file:///d:/project_yosua/lapor-kos/docs/migration_plan/04-domain-decomposition-one-func-per-file.md) | Dekomposisi repository & handler monolitik menjadi 1 file = 1 func | Modul Finance, Auth, Payment, Complaint, dll. terpecah rapi & bersih |

---

## 3. Desain Topologi Arsitektur Sistem

```
                                      [ Client / Next.js Frontend ]
                                                    │
                                                    ▼
                                ┌───────────────────────────────────────┐
                                │          HTTP Transport Layer         │
                                │    (Gin, Safe Logger, Correlation)    │
                                └───────────────────┬───────────────────┘
                                                    │
                            ┌───────────────────────┴───────────────────────┐
                            ▼                                               ▼
                 ┌─────────────────────┐                         ┌─────────────────────┐
                 │   Redis (Cache &    │                         │  Application Layer  │
                 │ Distributed Coord)  │                         │     (Use Cases)     │
                 │                     │                         │                     │
                 │ • Fast Session Rev. │ ◄───[ Fast Check ]──────┤ 1 File = 1 Func     │
                 │ • Sliding RateLimit │                         │                     │
                 │ • Redlock (Billing) │                         │ • CreateExpense     │
                 │ • Query Caching     │                         │ • ClosePeriod       │
                 └─────────────────────┘                         │ • VerifyPayment     │
                                                                 └──────────┬──────────┘
                                                                            │
                                                    ┌───────────────────────┴───────────────────────┐
                                                    ▼                                               ▼
                                         ┌─────────────────────┐                         ┌─────────────────────┐
                                         │ PostgreSQL (Primary │                         │      RabbitMQ       │
                                         │ Persistent Storage) │                         │  (Message Broker)   │
                                         │                     │                         │                     │
                                         │ • 1 Query = 1 File  │                         │ • Topic Exchange    │
                                         │ • Append-Only Audit │                         │ • Outbox Publisher  │
                                         │ • Strict Trigger    │                         │ • Dead Letter Queue │
                                         └─────────────────────┘                         └──────────┬──────────┘
                                                                                                    │
                                                                            ┌───────────────────────┴───────────────────────┐
                                                                            ▼                                               ▼
                                                                 ┌─────────────────────┐                         ┌─────────────────────┐
                                                                 │ Notification Worker │                         │ Background Job Wkr  │
                                                                 │ • WhatsApp Consumer │                         │ • PDF Generator     │
                                                                 │ • Email Consumer    │                         │ • CSV Export Worker │
                                                                 │ • Push In-App       │                         │ • AI Triage Worker  │
                                                                 └─────────────────────┘                         └─────────────────────┘
```

---

## 4. Konvensi "One Function Per File"

Setiap komponen struktural wajib mematuhi konvensi penamaan dan lingkup fungsi:

### 4.1 Use Case Layer (`internal/usecase/<domain>/`)
- Nama file menggunakan format kata kerja aksi: `<action>_<entity>.go`.
- Berisi:
  - Definisi Struct Input/Command (`CreateExpenseInput`).
  - Definisi Struct Use Case (`CreateExpenseUseCase`).
  - Factory function (`NewCreateExpenseUseCase`).
  - Satu fungsi eksekusi utama: `func (uc *CreateExpenseUseCase) Execute(ctx context.Context, input ...) (*Result, error)`.
- File test pendamping: `<action>_<entity>_test.go` (menguji 100% jalur sukses dan error use case tersebut).

### 4.2 HTTP Delivery Layer (`internal/delivery/http/handler/<domain>/`)
- Nama file: `handle_<action>_<entity>.go`.
- Berisi satu fungsi handler Gin: `func HandleCreateExpense(uc *usecase.CreateExpenseUseCase) gin.HandlerFunc`.
- Tanggung jawab dibatasi pada: parsing parameter URL/header/body, validasi DTO HTTP, memanggil use case, dan mengembalikan HTTP status JSON.

### 4.3 Database Infrastructure Layer (`internal/infrastructure/postgres/<domain>/`)
- Nama file: `<sql_action>_<entity>.go` (contoh: `insert_expense.go`, `find_expense_by_id.go`, `update_expense_status.go`).
- Berisi satu fungsi query/eksekusi spesifik pada struct repository domain.

### 4.4 Queue Consumers (`internal/delivery/queue/`)
- Nama file: `consume_<event_type>.go` (contoh: `consume_whatsapp_notification.go`, `consume_email_notification.go`).
- Berisi satu fungsi loop pembaca channel amqp091 dengan pengakuan pesan (ACK/NACK) yang terisolasi.

---

## 5. Strategi Zero-Downtime & Backward Compatibility

Untuk memastikan transisi data dan kode berjalan mulus tanpa merusak aplikasi produksi:
1. **Side-by-Side Coexistence**: Repository lama tetap dapat diakses selama modul baru dibangun per domain. Endpoint HTTP dialihkan secara bertahap.
2. **Fallback Polling to RabbitMQ**: Jika RabbitMQ connection terputus sementara, publisher menyimpan pesan ke database outbox sebagai fallback, lalu diproses ulang saat koneksi pulih.
3. **Redis Cache-Aside**: Jika Redis tidak tersedia (*downtime*), sistem otomatis *fallback* ke query PostgreSQL langsung dengan log alert terstruktur.
4. **Automated Regression Testing**: Seluruh test backend (`go test ./...`) dan build frontend wajib lulus sebelum setiap merge PR per fase.
