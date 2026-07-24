# Lapor Kos - Backend API Server 🖥️

Repositori ini berisi kode backend untuk aplikasi **Lapor Kos**, dibangun menggunakan bahasa pemrograman Go (Golang) dan framework Gin Gonic. Backend ini bertanggung jawab mengelola basis data PostgreSQL, mengeksekusi migrasi, menangani alur autentikasi JWT, memicu cron job tagihan bulanan, serta mengintegrasikan Google Gemini AI dan WhatsApp Gateway.

---

## 🛠️ Tech Stack & Persyaratan Sistem

Pastikan perangkat Anda telah terinstal perangkat lunak berikut sebelum memulai:

1. **Go (Golang)**: Versi **`v1.25.x`** atau lebih baru.
   * Cek versi Go di terminal Anda: `go version`
   * Unduh di [golang.org/dl](https://golang.org/dl/).
2. **PostgreSQL**: Versi **`v15.x`** atau lebih baru.
   * Anda juga dapat menggunakan layanan PostgreSQL cloud terkelola seperti **Supabase**.
3. **Pustaka Utama Go (Otomatis Terinstal)**:
   * **Gin Gonic v1.12.0** (HTTP Web Framework)
   * **pgx/v5 v5.9.2** (Postgres Driver & Connection Pooler)
   * **gofpdf v1.16.2** (Mesin Pembuat Laporan PDF Gratis & Open Source)
   * **Go-Dotenv** (Pemuat Konfigurasi `.env`)

---

## ⚙️ Langkah Instalasi Ulang (Fresh Setup)

Ikuti langkah-langkah di bawah ini untuk membersihkan dan menyiapkan ulang dependensi backend:

### 1. Bersihkan Cache Go & Unduh Dependensi Baru
Buka terminal di dalam direktori `backend` (`d:/project_yosua/lapor-kos/backend`) lalu jalankan perintah berikut:

```bash
# Membersihkan cache module Go (Opsional jika terjadi error dependensi)
go clean -modcache

# Mengunduh dan menyeimbangkan dependensi sesuai go.mod
go mod tidy

# Memverifikasi integritas modul yang diunduh
go mod verify
```

### 2. Konfigurasi Environment Variables (`.env`)
Buat file bernama `.env` di direktori root `backend/` (salin dari contoh konfigurasi di bawah) dan sesuaikan nilainya:

```env
# Server Port
PORT=8081

# Database URL Connection String (PostgreSQL / Supabase)
# PENTING: Jika menggunakan Supabase Connection Pooler (PgBouncer) pada port 6543, 
# Anda WAJIB menambahkan parameter di bawah agar tidak terjadi error prepared statement:
# "?sslmode=require&default_query_exec_mode=exec&statement_cache_capacity=0"
DATABASE_URL=postgresql://postgres.xxx:your_password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&default_query_exec_mode=exec&statement_cache_capacity=0

# Keamanan JWT
JWT_SECRET=your_jwt_secret_here


# Pengaturan Pengiriman Email (SMTP Gmail / Mailgun)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email_anda@gmail.com
SMTP_PASS=app_password_gmail_16_karakter
SMTP_SENDER=Lapor Kos <email_anda@gmail.com>

# Tautan Aplikasi Frontend (Untuk CORS)
FRONTEND_URL=http://localhost:3000

# Google Gemini API Key (Untuk Analisis Prioritas Komplain Keluhan Fasilitas)
GEMINI_API_KEY=AIzaSyBtu...your_gemini_key

# WhatsApp Gateway (Fonnte API)
WHATSAPP_API_URL=https://api.fonnte.com/send
WHATSAPP_API_TOKEN=your_fonnte_token_here

# Supabase Storage Bucket (Untuk Menyimpan Foto Keluhan / Profil)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1Ni...your_service_role_key
SUPABASE_BUCKET=uploads
```

---

## 🚀 Cara Menjalankan Server

Untuk menjalankan server backend dalam mode pengembangan (*development*):

```bash
go run ./cmd/api
```

Setelah dijalankan, server akan:
* Melakukan koneksi ke database PostgreSQL.
* Menjalankan scheduler **Cron Job** untuk mengecek tagihan bulanan pada latar belakang.
* Berjalan dan mendengarkan permintaan API pada alamat: **`http://localhost:8081`**

Migrasi tidak dijalankan otomatis ketika aplikasi mulai. Terapkan semua file SQL
di direktori `migrations/` secara berurutan sebelum menjalankan versi aplikasi
yang baru. Untuk perubahan multi-properti, jalankan fase `013`, periksa hasil
backfill `014`, lalu terapkan constraint `015`.

Endpoint operasional lama tetap tersedia dengan header `X-Property-ID`.
Endpoint kanonis tersedia di bawah
`/api/v1/properties/:property_id/...`. Nilai properti selalu diverifikasi oleh
server terhadap membership pengguna yang masih aktif.

---

## 🧪 Menjalankan Unit Test

Untuk memverifikasi fungsionalitas layanan backend (seperti modul pembuat PDF laporan):

```bash
# Menjalankan seluruh test di direktori backend
go test ./... -v

# Menjalankan test khusus untuk generator laporan PDF
go test -v ./internal/service -run TestGenerateFinancialReport
```

### Uji Isolasi Dua Properti (Epic 01)

Acceptance test Epic 01 menjalankan data sementara untuk dua owner, dua
properti, dan resource operasional yang sama. Seluruh perubahan dilakukan di
dalam transaksi lalu di-rollback.

Gunakan database khusus pengujian dan jalankan:

```powershell
$env:TEST_DATABASE_URL='postgresql://...'
go test -tags=integration ./internal/repository -run TestPropertyIsolationWithTwoOwners -v
```

Test ini memeriksa isolasi read, update, delete, laporan/export, file, dan
validitas nomor kamar yang sama pada dua properti berbeda.
