# Manual Test Cases: [ARCH-01] Infrastruktur Redis & RabbitMQ: Containerisasi, Config, & Health Probes

Dokumen ini menyediakan panduan pengujian manual end-to-end untuk memvalidasi seluruh kriteria penerimaan pada **GitHub Issue #71: [ARCH-01] Infrastruktur Redis & RabbitMQ: Containerisasi, Config, & Health Probes**.

---

## Ringkasan Skenario Pengujian

| Test ID | Skenario Pengujian | Kriteria Penerimaan | Aktor Penguji |
| :--- | :--- | :--- | :--- |
| **INFRA-01** | Pengujian Orkestrasi Docker Compose (Redis 7 Alpine & RabbitMQ 3.13) | Containerisasi | DevOps / Developer |
| **INFRA-02** | Verifikasi Probe Kesiapan Sistem (`/readyz`) dengan Status Tri-Komponen | Health Probes | SRE / Developer |
| **INFRA-03** | Pengujian Graceful Degradation Saat Redis / RabbitMQ Tidak Aktif | Resiliency | Backend QA |
| **INFRA-04** | Pengujian Auto-Reconnect Supervisor RabbitMQ saat Koneksi Pulih | Resiliency | Backend QA |
| **INFRA-05** | Verifikasi Zero Credential Leakage & Kebersihan Release Artifacts | Keamanan Rilis | Security Engineer |

---

## Rincian Test Cases

### INFRA-01: Pengujian Orkestrasi Docker Compose
- **Tujuan:** Memastikan service Redis dan RabbitMQ dapat dijalankan secara terisolasi dengan parameter otentikasi aman melalui docker-compose.
- **Langkah Pengujian:**
  1. Jalankan perintah:
     ```bash
     docker compose up -d redis rabbitmq
     ```
  2. Periksa status container:
     ```bash
     docker compose ps
     ```
  3. Buka browser pada `http://localhost:15672` (RabbitMQ Management Dashboard).
  4. Login menggunakan kredensial default: user `guest`, password `guest`.
  5. Uji akses Redis via CLI:
     ```bash
     docker compose exec redis redis-cli -a dev_redis_secret ping
     ```
- **Hasil yang Diharapkan:**
  - Status container `lapor-kos-redis` dan `lapor-kos-rabbitmq` adalah `healthy`.
  - RabbitMQ dashboard dapat diakses dan menampilkan status broker aktif.
  - Redis merespons `PONG`.

---

### INFRA-02: Verifikasi Probe Kesiapan Sistem (`/readyz`)
- **Tujuan:** Memastikan endpoint `/readyz` melaporkan status real-time ketiga komponen: PostgreSQL, Redis, dan RabbitMQ.
- **Langkah Pengujian:**
  1. Jalankan backend: `go run ./cmd/api`.
  2. Kirim HTTP GET ke `http://localhost:8081/readyz`.
  3. Periksa struktur JSON yang dikembalikan.
- **Hasil yang Diharapkan:**
  - Response memuat objek `database`, `redis`, dan `rabbitmq`.
  - Ketika Redis dan RabbitMQ aktif, status keseluruhan adalah `ready` (HTTP 200).
  - Objek `redis` dan `rabbitmq` memuat nilai `latency_ms` yang valid dan status `connected`.

---

### INFRA-03: Pengujian Graceful Degradation Saat Redis / RabbitMQ Tidak Aktif
- **Tujuan:** Menjamin backend tetap dapat berjalan normal melayani request meskipun Redis atau RabbitMQ sedang mati atau belum dikonfigurasi.
- **Langkah Pengujian:**
  1. Matikan service Redis dan RabbitMQ (atau kosongkan variabel `REDIS_URL` dan `RABBITMQ_URL` pada `.env`).
  2. Jalankan backend: `go run ./cmd/api`.
  3. Kirim HTTP GET ke `http://localhost:8081/readyz` dan `http://localhost:8081/healthz`.
  4. Lakukan request API login atau list properti.
- **Hasil yang Diharapkan:**
  - Backend menyala sukses tanpa fatal crash / panic.
  - Endpoint `/healthz` tetap merespons status `alive` (HTTP 200).
  - Endpoint `/readyz` merespons status `degraded` (HTTP 200) dengan rincian `redis: disconnected` / `disabled`, sementara `database: connected`.
  - Operasi API berbasis PostgreSQL tetap berjalan lancar.

---

### INFRA-04: Pengujian Auto-Reconnect Supervisor RabbitMQ
- **Tujuan:** Memastikan background supervisor RabbitMQ secara otomatis mendeteksi pemutusan koneksi dan menyambung kembali saat broker pulih.
- **Langkah Pengujian:**
  1. Jalankan backend dengan RabbitMQ aktif.
  2. Matikan container RabbitMQ: `docker compose stop rabbitmq`.
  3. Amati log terminal backend (harus muncul log percobaan rekoneksi berkala).
  4. Nyalakan kembali RabbitMQ: `docker compose start rabbitmq`.
  5. Kirim request ke `/readyz`.
- **Hasil yang Diharapkan:**
  - Terminal mencatat log: `[RABBITMQ] Reconnected successfully to broker`.
  - Endpoint `/readyz` kembali melaporkan `rabbitmq.status: connected`.

---

### INFRA-05: Verifikasi Zero Credential Leakage & Kebersihan Release Artifacts
- **Tujuan:** Memastikan penambahan konfigurasi Docker Compose dan file environment tidak membocorkan kredensial ke repository.
- **Langkah Pengujian:**
  1. Jalankan script scanner keamanan:
     ```bash
     go run ./scripts/ci/scan_secrets.go
     go run ./scripts/ci/check_release_artifacts.go
     ```
- **Hasil yang Diharapkan:**
  - `scan_secrets.go` melaporkan 0 pelanggaran.
  - `check_release_artifacts.go` mengonfirmasi repositori bersih dari file `.env` yang ditrack dan artefak terlarang.
