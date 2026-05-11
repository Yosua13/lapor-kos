# 📋 Lapor Kos — Feature Implementation Plan

> **Stack:** Next.js 16 (TypeScript, Tailwind v4) + Go (Gin, pgx) + PostgreSQL  
> **Prinsip:** Setiap modul **harus selesai** sebelum modul berikutnya dikerjakan.  
> **Target pembaca:** Junior programmer / AI model

---

## Urutan Modul

```
M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7
```

| Modul | Nama | Bergantung Pada |
|-------|------|----------------|
| M0 | Setup Database & Auth (Login) | — |
| M1 | Manajemen Kamar & Penghuni | M0 |
| M2 | Manajemen Kontrak | M1 |
| M3 | Tracking Pembayaran Multi-metode | M2 |
| M4 | Dashboard Ringkasan Real-time | M3 |
| M5 | Kalender Kontrak & Jatuh Tempo | M2 |
| M6 | Sistem Notifikasi & Alert Otomatis | M3, M5 |
| M7 | Komplain & Laporan Fasilitas | M1 |

---

## M0 — Setup Database & Auth (Login)

### Tujuan
Fondasi seluruh aplikasi: skema database, autentikasi pemilik kos, dan middleware JWT.

### Backend (Go)

**Refactor `main.go`:**
- Pindahkan koneksi DB ke `pgxpool` (connection pool, bukan single connection)
- Buat struktur folder: `internal/handler/`, `internal/middleware/`, `internal/repository/`, `internal/model/`

**Database Migration (buat file `migrations/001_init.sql`):**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:**
- `POST /api/auth/register` — Daftarkan pemilik kos baru
- `POST /api/auth/login` — Login, return JWT token
- `GET /api/auth/me` — Ambil data user dari token (protected)

**Middleware:**
- `internal/middleware/auth.go` — validasi JWT di setiap request protected

**Library yang perlu di-install:**
```bash
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/crypto
```

### Frontend (Next.js)

**Halaman & Komponen:**
- `app/(auth)/login/page.tsx` — Form login (email + password)
- `app/(auth)/register/page.tsx` — Form registrasi
- `lib/api.ts` — Base API client (fetch wrapper dengan base URL dari env)
- `lib/auth.ts` — Helper: simpan/ambil/hapus JWT dari `localStorage` atau `httpOnly cookie`
- `middleware.ts` (Next.js) — Redirect ke `/login` jika tidak ada token

**Environment:**
```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8081
```

### Definition of Done
- [ ] Pemilik kos bisa register dan login
- [ ] Token JWT tersimpan dan dikirim di setiap request
- [ ] Route yang tidak login di-redirect ke halaman login
- [ ] Endpoint `/api/health` masih berjalan

---

## M1 — Manajemen Kamar & Penghuni

### Tujuan
CRUD kamar kos dan data penghuni (termasuk upload foto KTP & selfie).

### Backend

**Tabel Database (`migrations/002_rooms_tenants.sql`):**
```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  room_number VARCHAR(50) NOT NULL,
  floor VARCHAR(10),
  building VARCHAR(100),
  price NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'vacant', -- 'occupied' | 'vacant' | 'maintenance'
  facilities TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  emergency_contact VARCHAR(20),
  ktp_photo_url TEXT,
  selfie_photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints Kamar:**
- `GET /api/rooms` — List semua kamar milik owner
- `POST /api/rooms` — Tambah kamar baru
- `PUT /api/rooms/:id` — Update kamar
- `DELETE /api/rooms/:id` — Hapus kamar

**Endpoints Penghuni:**
- `GET /api/tenants` — List penghuni
- `POST /api/tenants` — Tambah penghuni + upload foto KTP/selfie
- `GET /api/tenants/:id` — Detail penghuni
- `PUT /api/tenants/:id` — Update data penghuni
- `DELETE /api/tenants/:id` — Hapus penghuni

**Upload foto:** Simpan ke folder lokal `uploads/` atau integrasi Supabase Storage / Cloudinary (pilih salah satu, dokumentasikan di `.env`).

### Frontend

**Halaman:**
- `app/(dashboard)/rooms/page.tsx` — List kamar + status badge (Terisi/Kosong/Maintenance)
- `app/(dashboard)/rooms/[id]/page.tsx` — Detail kamar
- `app/(dashboard)/tenants/page.tsx` — List penghuni
- `app/(dashboard)/tenants/[id]/page.tsx` — Detail penghuni + foto KTP
- `app/(dashboard)/tenants/new/page.tsx` — Form tambah penghuni dengan file upload

**Komponen Shared:**
- `components/StatusBadge.tsx` — Badge warna untuk status kamar/pembayaran
- `components/Layout/Sidebar.tsx` — Navigasi sidebar utama
- `components/Layout/Header.tsx` — Header dengan info user & logout

### Definition of Done
- [ ] Owner bisa tambah, edit, hapus kamar
- [ ] Owner bisa tambah penghuni dengan foto KTP & selfie
- [ ] List kamar menampilkan status (Terisi/Kosong)
- [ ] Semua endpoint terproteksi JWT

---

## M2 — Manajemen Kontrak

### Tujuan
Mencatat kontrak sewa antara penghuni dan kamar, beserta tanggal mulai & selesai.

### Backend

**Tabel Database (`migrations/003_contracts.sql`):**
```sql
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  tenant_id UUID REFERENCES tenants(id),
  owner_id UUID REFERENCES users(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_rent NUMERIC(12,2) NOT NULL,
  deposit NUMERIC(12,2) DEFAULT 0,
  payment_due_day INT DEFAULT 1, -- tanggal jatuh tempo tiap bulan (1-31)
  status VARCHAR(20) DEFAULT 'active', -- 'active' | 'expired' | 'terminated'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:**
- `GET /api/contracts` — List kontrak (bisa filter by status, room, tenant)
- `POST /api/contracts` — Buat kontrak baru (otomatis ubah status kamar jadi 'occupied')
- `GET /api/contracts/:id` — Detail kontrak
- `PUT /api/contracts/:id` — Update / perpanjang kontrak
- `DELETE /api/contracts/:id` — Terminasi kontrak (ubah status kamar jadi 'vacant')

**Business Logic Penting:**
- Saat kontrak dibuat, validasi kamar berstatus `vacant`
- Saat kontrak dihapus/expired, ubah status kamar ke `vacant`

### Frontend

**Halaman:**
- `app/(dashboard)/contracts/page.tsx` — List kontrak + filter status
- `app/(dashboard)/contracts/new/page.tsx` — Form buat kontrak (pilih kamar & penghuni)
- `app/(dashboard)/contracts/[id]/page.tsx` — Detail + tombol "Perpanjang Kontrak"

### Definition of Done
- [ ] Owner bisa membuat kontrak yang menghubungkan kamar dan penghuni
- [ ] Status kamar otomatis berubah saat kontrak dibuat/dihapus
- [ ] Kontrak bisa diperpanjang (update `end_date`)
- [ ] Filter list kontrak by status: aktif / expired

---

## M3 — Tracking Pembayaran Multi-metode

### Tujuan
Mencatat pembayaran sewa dan biaya tambahan, support berbagai metode pembayaran, generate kwitansi digital.

### Backend

**Tabel Database (`migrations/004_payments.sql`):**
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id),
  owner_id UUID REFERENCES users(id),
  period_month INT NOT NULL, -- 1-12
  period_year INT NOT NULL,
  amount_rent NUMERIC(12,2) DEFAULT 0,
  amount_electricity NUMERIC(12,2) DEFAULT 0,
  amount_water NUMERIC(12,2) DEFAULT 0,
  amount_other NUMERIC(12,2) DEFAULT 0,
  total_paid NUMERIC(12,2) DEFAULT 0,
  payment_method VARCHAR(30), -- 'cash'|'transfer'|'ovo'|'gopay'|'qris'
  status VARCHAR(20) DEFAULT 'unpaid', -- 'paid'|'partial'|'unpaid'|'overdue'
  proof_photo_url TEXT,
  paid_at TIMESTAMPTZ,
  due_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:**
- `GET /api/payments` — List pembayaran (filter by status, bulan, tahun)
- `POST /api/payments` — Catat pembayaran baru
- `GET /api/payments/:id` — Detail pembayaran
- `PUT /api/payments/:id` — Update pembayaran (tambah bayar partial)
- `GET /api/payments/:id/receipt` — Generate kwitansi (return HTML/PDF)

**Business Logic:**
- Jika `total_paid >= (amount_rent + electricity + water + other)` → status `paid`
- Jika sebagian → status `partial`
- Jika lewat `due_date` dan belum lunas → status `overdue`

### Frontend

**Halaman:**
- `app/(dashboard)/payments/page.tsx` — List pembayaran + filter
- `app/(dashboard)/payments/new/page.tsx` — Form input pembayaran + upload bukti
- `app/(dashboard)/payments/[id]/page.tsx` — Detail + tombol generate kwitansi

**Komponen:**
- `components/PaymentStatusBadge.tsx` — Badge: Lunas (hijau) / Partial (kuning) / Overdue (merah)
- `components/ReceiptModal.tsx` — Modal preview kwitansi digital

### Definition of Done
- [ ] Owner bisa catat pembayaran dengan berbagai metode
- [ ] Status otomatis berubah (paid/partial/overdue)
- [ ] Upload bukti transfer (foto)
- [ ] Kwitansi bisa di-preview dan dicetak

---

## M4 — Dashboard Ringkasan Real-time

### Tujuan
Halaman utama yang menampilkan semua ringkasan dalam satu layar.

### Backend

**Endpoint Agregasi:**
- `GET /api/dashboard/summary` — Return semua data ringkasan dalam 1 response:

```json
{
  "occupancy": { "occupied": 18, "vacant": 2, "total": 20, "rate": 90 },
  "revenue": { "this_month": 18000000, "collected": 13500000, "pending": 4500000 },
  "payments": { "paid": 15, "partial": 2, "overdue": 3 },
  "expiring_contracts": [
    { "room": "A5", "tenant": "Andi", "days_left": 7 }
  ],
  "vacant_long": [
    { "room": "D1", "vacant_days": 35 }
  ]
}
```

### Frontend

**Halaman:**
- `app/(dashboard)/page.tsx` — Dashboard utama (default setelah login)

**Widget Komponen:**
- `components/Dashboard/OccupancyCard.tsx` — Donut chart atau progress bar occupancy rate
- `components/Dashboard/RevenueCard.tsx` — Total pendapatan bulan ini vs yang sudah dibayar
- `components/Dashboard/PaymentOverviewCard.tsx` — Breakdown paid/partial/overdue
- `components/Dashboard/ExpiringContractsCard.tsx` — List kontrak hampir habis (≤30 hari)
- `components/Dashboard/VacantRoomsCard.tsx` — Kamar kosong lama (>30 hari)

**Catatan Implementasi:**
- Data di-fetch saat halaman load, tambahkan tombol "Refresh"
- Gunakan warna: Hijau `#22c55e` / Kuning `#eab308` / Merah `#ef4444`
- Tidak perlu websocket, cukup polling manual (refresh button)

### Definition of Done
- [ ] Dashboard menampilkan semua 5 widget
- [ ] Data akurat sesuai kondisi DB saat itu
- [ ] Tampilan responsif (mobile-friendly)
- [ ] Link dari setiap widget ke halaman detail terkait

---

## M5 — Kalender Kontrak & Jatuh Tempo

### Tujuan
Visualisasi kalender untuk melihat kontrak yang habis dan jatuh tempo pembayaran.

### Backend

**Endpoint:**
- `GET /api/calendar/events?month=5&year=2026` — Return semua event dalam bulan tersebut:

```json
[
  { "date": "2026-05-15", "type": "contract_end", "room": "A5", "tenant": "Andi" },
  { "date": "2026-05-30", "type": "payment_due", "room": "B3", "tenant": "Budi", "status": "unpaid" }
]
```

### Frontend

**Library:** Install `react-calendar` atau `@fullcalendar/react`
```bash
cd frontend && npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/core
```

**Halaman:**
- `app/(dashboard)/calendar/page.tsx` — Kalender dengan event overlay

**Color Coding Event:**
- Hijau: kontrak aktif, pembayaran lunas
- Kuning: kontrak habis dalam 30 hari / jatuh tempo dalam 7 hari
- Merah: kontrak expired / pembayaran overdue

**Fitur Tambahan:**
- Toggle view: Bulanan / Mingguan
- Filter: Semua / Kontrak Habis / Jatuh Tempo
- Klik event → popup detail + link ke halaman terkait

### Definition of Done
- [ ] Kalender menampilkan event kontrak dan pembayaran
- [ ] Color coding sesuai spesifikasi
- [ ] Filter event berfungsi
- [ ] Klik event membuka detail

---

## M6 — Sistem Notifikasi & Alert Otomatis

### Tujuan
Mengingatkan pemilik kos secara otomatis tanpa harus cek manual.

### Backend

**Tabel Database (`migrations/005_notifications.sql`):**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  -- 'contract_expiring'|'payment_due'|'payment_overdue'|'room_vacant_long'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reference_id UUID, -- ID kontrak / pembayaran terkait
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Scheduled Job (Cron):**
Buat file `internal/scheduler/cron.go` yang berjalan setiap hari pukul 07.00:
- Kontrak habis dalam 30 hari → insert notifikasi `contract_expiring`
- Pembayaran jatuh tempo dalam 7 hari → insert notifikasi `payment_due`
- Pembayaran terlambat >3 hari → insert notifikasi `payment_overdue`
- Kamar kosong >30 hari → insert notifikasi `room_vacant_long`

**Library Cron:**
```bash
go get github.com/robfig/cron/v3
```

**Endpoints Notifikasi:**
- `GET /api/notifications` — List notifikasi (terbaru di atas)
- `PUT /api/notifications/:id/read` — Tandai sudah dibaca
- `PUT /api/notifications/read-all` — Tandai semua sudah dibaca

### Frontend

**Komponen:**
- `components/Layout/NotificationBell.tsx` — Ikon lonceng di header + badge jumlah unread
- `app/(dashboard)/notifications/page.tsx` — List semua notifikasi

**Behavior:**
- Polling notifikasi setiap 60 detik (atau saat kembali ke tab)
- Klik notifikasi → tandai read + navigasi ke halaman terkait
- Badge merah di ikon lonceng jika ada notifikasi belum dibaca

> **Catatan Fase 2 (opsional, jangan dikerjakan dulu):** Integrasi WhatsApp via Fonnte/WA Gateway bisa ditambahkan setelah M6 selesai.

### Definition of Done
- [ ] Notifikasi terbuat otomatis setiap hari via cron
- [ ] Owner bisa lihat dan tandai baca notifikasi
- [ ] Badge notifikasi muncul di header
- [ ] 4 tipe notifikasi berfungsi sesuai aturan bisnis

---

## M7 — Komplain & Laporan Fasilitas

### Tujuan
Penghuni bisa melaporkan kerusakan atau komplain, pemilik bisa track dan update status.

### Backend

**Tabel Database (`migrations/006_tickets.sql`):**
```sql
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  tenant_id UUID REFERENCES tenants(id),
  room_id UUID REFERENCES rooms(id),
  category VARCHAR(50) NOT NULL,
  -- 'facility_damage'|'facility_request'|'complaint'|'other'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal', -- 'low'|'normal'|'high'|'urgent'
  status VARCHAR(30) DEFAULT 'open',
  -- 'open'|'in_progress'|'waiting_parts'|'resolved'|'closed'
  photo_url TEXT,
  resolved_at TIMESTAMPTZ,
  notes TEXT, -- catatan dari pemilik kos
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:**
- `GET /api/tickets` — List tiket (filter by status, category, room)
- `POST /api/tickets` — Buat tiket baru
- `GET /api/tickets/:id` — Detail tiket
- `PUT /api/tickets/:id/status` — Update status tiket
- `GET /api/dashboard/tickets-summary` — Summary untuk dashboard (open/in_progress/resolved count)

### Frontend

**Halaman:**
- `app/(dashboard)/tickets/page.tsx` — List tiket + filter + Kanban-style status board
- `app/(dashboard)/tickets/new/page.tsx` — Form laporan (kategori, deskripsi, foto, prioritas)
- `app/(dashboard)/tickets/[id]/page.tsx` — Detail tiket + tombol update status + kolom catatan

**Komponen:**
- `components/Tickets/TicketCard.tsx` — Card tiket dengan badge status & prioritas
- `components/Tickets/StatusDropdown.tsx` — Dropdown update status langsung dari list

**Kategori yang tersedia:**
1. Kerusakan Fasilitas (AC, Listrik, Air, Furniture, dll)
2. Permintaan Fasilitas Tambahan
3. Komplain Lingkungan (kebisingan, kebersihan, keamanan)
4. Lainnya

### Definition of Done
- [ ] Owner bisa membuat tiket mewakili penghuni
- [ ] Tiket bisa difilter by status dan kategori
- [ ] Owner bisa update status tiket
- [ ] Summary tiket muncul di dashboard (terintegrasi ke M4)

---

## Catatan Umum untuk Implementor

### Struktur Folder Backend (Final)
```
backend/
├── main.go
├── .env
├── migrations/
│   ├── 001_init.sql
│   ├── 002_rooms_tenants.sql
│   ├── 003_contracts.sql
│   ├── 004_payments.sql
│   ├── 005_notifications.sql
│   └── 006_tickets.sql
└── internal/
    ├── handler/       # HTTP handler per domain
    ├── middleware/    # JWT auth, logging
    ├── model/         # Struct Go per tabel
    ├── repository/    # Query SQL ke DB
    └── scheduler/     # Cron jobs
```

### Struktur Folder Frontend (Final)
```
frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (dashboard)/
│       ├── page.tsx              # Dashboard (M4)
│       ├── rooms/
│       ├── tenants/
│       ├── contracts/
│       ├── payments/
│       ├── calendar/             # M5
│       ├── notifications/        # M6
│       └── tickets/              # M7
├── components/
│   ├── Layout/
│   ├── Dashboard/
│   └── Tickets/
└── lib/
    ├── api.ts
    └── auth.ts
```

### Aturan Coding
1. **Backend:** Setiap domain punya file handler, model, dan repository sendiri
2. **Backend:** Gunakan `pgxpool` bukan single connection
3. **Frontend:** Semua API call lewat `lib/api.ts`, jangan fetch langsung di komponen
4. **Frontend:** Gunakan TypeScript strict mode, definisikan interface untuk semua response API
5. **Auth:** Semua endpoint `/api/*` kecuali `/api/auth/*` dan `/api/health` wajib pakai middleware JWT
6. **Error:** Selalu return JSON `{ "error": "pesan error" }` dengan HTTP status yang tepat
