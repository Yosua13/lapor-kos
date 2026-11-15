# Panduan Menjalankan Backend API Server 🖥️

Direktori ini berisi kode backend untuk aplikasi **Lapor Kos**, dibangun menggunakan bahasa pemrograman **Go (Golang)** dan framework **Gin Gonic**. Backend ini menangani basis data PostgreSQL, alur autentikasi JWT, billing engine otomatis, scheduler cron job, PDF generator, serta integrasi Google Gemini AI dan WhatsApp Gateway.

---

## 🛠️ Prasyarat Sistem

Sebelum memulai, pastikan perangkat Anda telah terinstal:

1. **Go (Golang)**: Versi **`v1.25.x`** atau lebih baru.
   * Cek versi Go di terminal: `go version`
   * Unduh di [golang.org/dl](https://golang.org/dl/).
2. **PostgreSQL**: Versi **`v15.x`** atau lebih baru (Sangat direkomendasikan menggunakan layanan cloud terkelola seperti **Supabase**).
3. **Redis & RabbitMQ** *(Opsional untuk pengujian lokal, bisa dijalankan via Docker)*:
   * Redis untuk rate limiting dan token blacklist.
   * RabbitMQ untuk pemrosesan pesan antrean asinkron.

---

## ⚙️ Langkah Menjalankan Server

### 1. Unduh dan Sinkronkan Dependensi Modul
Buka terminal pada direktori `backend` (`lapor-kos/backend`) dan jalankan:

```bash
go mod tidy
```

### 2. Konfigurasi Environment Variables (`.env`)
Buat berkas `.env` di dalam folder `backend/` (dapat menyalin dari `.env.example`) dan sesuaikan nilainya:

```env
# Server Port
PORT=8081
GIN_MODE=debug

# Koneksi Database PostgreSQL / Supabase
# PENTING: Jika menggunakan Supabase Connection Pooler (PgBouncer) pada port 6543, 
# WAJIB menyertakan parameter berikut agar tidak terjadi error prepared statement:
# "?sslmode=require&default_query_exec_mode=exec&statement_cache_capacity=0"
DATABASE_URL=postgresql://user:password@host:6543/dbname?sslmode=require&default_query_exec_mode=exec&statement_cache_capacity=0

# Keamanan Token JWT
JWT_SECRET=rahasia_kunci_jwt_anda_disini

# Pengaturan Pengiriman Email (SMTP Gmail / Mailgun)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email_anda@gmail.com
SMTP_PASS=app_password_gmail_16_karakter
SMTP_SENDER=Lapor Kos <email_anda@gmail.com>

# Tautan Aplikasi Frontend (Untuk CORS Protection)
FRONTEND_URL=http://localhost:3000

# Google Gemini API Key (Untuk Triase & Analisis Komplain Kerusakan Fasilitas)
GEMINI_API_KEY=AIzaSy...your_gemini_key

# WhatsApp Gateway (Fonnte API)
WHATSAPP_API_URL=https://api.fonnte.com/send
WHATSAPP_API_TOKEN=your_fonnte_token_here

# Supabase Storage (Untuk Menyimpan Unggahan Foto Fasilitas & Bukti Transfer)
SUPABASE_URL=https://your_project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1Ni...your_service_role_key
SUPABASE_BUCKET=uploads

# Midtrans Payment Gateway (Sandbox / Production)
MIDTRANS_SERVER_KEY=<MIDTRANS_SERVER_KEY_SANDBOX_ANDA>
MIDTRANS_CLIENT_KEY=<MIDTRANS_CLIENT_KEY_SANDBOX_ANDA>
MIDTRANS_IS_PRODUCTION=false
```

---

## 🗄️ Menjalankan Migrasi Database

Sebelum server pertama kali dijalankan, terapkan seluruh berkas skrip SQL pada direktori `migrations/` secara berurutan (`001` sampai `030`) ke database PostgreSQL / Supabase Anda:

* **Melalui Supabase SQL Editor**: Buka SQL Editor di dasbor Supabase, lalu salin dan jalankan isi berkas SQL dari urutan awal ke akhir.
* **Melalui CLI (`psql`)**:
  ```bash
  for file in migrations/*.sql; do
    psql "$DATABASE_URL" -f "$file"
  done
  ```

---

## 🚀 Menjalankan Server API

Untuk memulai API server dalam mode pengembangan:

```bash
go run ./cmd/api
```

Saat server berhasil menyala:
* Koneksi ke database PostgreSQL akan diinisialisasi.
* **Cron Job Scheduler** akan aktif di latar belakang untuk pengecekan tagihan rutin dan status kontrak.
* API server akan mendengarkan request pada:
  👉 **[http://localhost:8081](http://localhost:8081)**

Endpoint health check:
* `GET http://localhost:8081/api/health`

---

## 🧪 Menjalankan Pengujian (Testing)

Untuk menjalankan seluruh unit test backend:

```bash
# Menjalankan seluruh unit test
go test ./... -v

# Menjalankan unit test spesifik (contoh: generator laporan keuangan PDF)
go test -v ./internal/service -run TestGenerateFinancialReport
```

---

## 🐳 Menjalankan dengan Docker

```bash
# Build image Docker backend
docker build -t lapor-kos-backend .

# Jalankan container
docker run -p 8081:8081 --env-file .env lapor-kos-backend
```
