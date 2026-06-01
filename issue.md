# Implementasi Issue #8: Kalender Kontrak & Jatuh Tempo

Tujuan: Membangun visualisasi kalender di halaman dashboard untuk memantau tanggal habis kontrak dan jatuh tempo pembayaran dalam satu tampilan terpadu, lengkap dengan filter, kode warna (hijau/kuning/merah), dan popup detail event yang terhubung dengan modul lainnya.

## User Review Required

> [!IMPORTANT]
> Mohon direview rancangan filter dan visualisasi warna kalender berikut:
> - **Filter**: Semua / Kontrak Habis / Jatuh Tempo.
> - **Aksi Klik Event**: Membuka popup detail yang berisi informasi ringkas dan memiliki tautan/tombol untuk mengarahkan pengguna ke halaman detail Kontrak atau detail Pembayaran terkait.
> - **Hak Akses**: Kalender ini dirancang khusus untuk peran **Owner** (Pemilik Kos).

## Open Questions

> [!NOTE]
> - **Format Warna Event**: Apakah kode warna (Hijau/Kuning/Merah) akan dihitung secara dinamis di backend dan dikirim dalam properti JSON `color_status`, atau dihitung sepenuhnya di frontend? *(Rekomendasi: Dihitung di backend agar konsisten dan efisien)*.
> - **Navigasi Bulan di FullCalendar**: Saat pengguna mengganti bulan di UI FullCalendar (tombol Prev/Next), frontend akan melakukan fetch ulang ke backend untuk bulan & tahun yang sesuai menggunakan endpoint query parameters `?month=X&year=Y`.

## Proposed Changes

---

### Backend

Akan dibuat endpoint baru pada backend Go untuk menarik data event kalender berdasarkan bulan dan tahun tertentu.

#### [NEW] [calendar.go](file:///d:/project_yosua/lapor-kos/backend/internal/model/calendar.go)
- Mendefinisikan struct `CalendarEvent` dan `EventDetails` untuk format respons API.

#### [NEW] [calendar_repository.go](file:///d:/project_yosua/lapor-kos/backend/internal/repository/calendar_repository.go)
- Menjalankan kueri SQL menggunakan `pgxpool` untuk mengambil:
  1. Kontrak yang berakhir pada bulan/tahun yang dipilih milik `owner_id`.
  2. Pembayaran yang jatuh tempo pada bulan/tahun yang dipilih milik `owner_id`.
- Menghitung kode warna (`green`, `yellow`, `red`) secara dinamis berdasarkan aturan:
  - **Hijau**: Kontrak dengan status `active` (> 30 hari tersisa), atau Pembayaran dengan status `paid`.
  - **Kuning**: Kontrak dengan status `active` yang habis dalam $\le 30$ hari, atau Pembayaran belum lunas (`unpaid`, `pending`, `partial`) yang jatuh tempo dalam $\le 7$ hari ke depan.
  - **Merah**: Kontrak dengan status `expired` atau `cancelled`, atau Pembayaran belum lunas yang sudah melewati tanggal jatuh tempo (`overdue` atau lewat hari ini).

#### [NEW] [calendar_handler.go](file:///d:/project_yosua/lapor-kos/backend/internal/handler/calendar_handler.go)
- Handler untuk `GET /api/calendar/events`.
- Menerima query parameter `month` dan `year`. Jika kosong, default ke bulan dan tahun saat ini.
- Melakukan verifikasi token JWT dan peran pengguna sebagai `owner`.

#### [MODIFY] [main.go](file:///d:/project_yosua/lapor-kos/backend/main.go)
- Menginstansiasi `CalendarRepository` and `CalendarHandler`.
- Mendaftarkan rute `GET /api/calendar/events` dengan middleware otentikasi `AuthMiddleware()` dan otorisasi `RoleMiddleware(dbPool, "owner")`.

---

### Frontend

Akan di-install pustaka FullCalendar, ditambahkan menu navigasi, dan dibangun halaman kalender yang interaktif.

#### Dependensi Baru
- Menjalankan perintah instalasi berikut di folder `frontend`:
  ```bash
  npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/core
  ```

#### [MODIFY] [layout.tsx](file:///d:/project_yosua/lapor-kos/frontend/src/app/(dashboard)/layout.tsx)
- Mengimpor icon `Calendar` dari `lucide-react`.
- Menambahkan item navigasi `"Kalender"` dengan rute `/calendar` pada sidebar Owner (di bawah menu "Dashboard" atau di dalam kelompok "MENU UTAMA").

#### [NEW] [page.tsx](file:///d:/project_yosua/lapor-kos/frontend/src/app/(dashboard)/calendar/page.tsx)
- Halaman kalender berbasis klien (`'use client'`).
- Menggunakan komponen `<FullCalendar>` dari `@fullcalendar/react` dengan plugin `@fullcalendar/daygrid`.
- Menyediakan komponen filter di bagian atas halaman:
  - **Semua Event** (default)
  - **Kontrak Habis**
  - **Jatuh Tempo**
- Melakukan pemanggilan `apiFetch('/api/calendar/events?month=X&year=Y')` saat inisialisasi dan setiap kali navigasi kalender berubah bulan/tahun.
- Mengatur warna event berdasarkan nilai `color_status` dari API:
  - `green`: background hijau, teks putih.
  - `yellow`: background kuning, teks gelap.
  - `red`: background merah, teks putih.
- Menampilkan modal popup kustom saat event diklik:
  - Menampilkan judul event, deskripsi, tanggal, nama penghuni, nomor kamar, status, dan nominal tagihan (khusus jatuh tempo).
  - Menyediakan tombol pintas seperti "Lihat Kontrak" (mengarahkan ke `/contracts/[id]`) atau "Lihat Pembayaran" (mengarahkan ke `/payments`).

## Verification Plan

### Automated Tests
- Menjalankan unit tests jika ada, atau memverifikasi respons JSON dari `/api/calendar/events?month=5&year=2026` via browser/Postman/cURL untuk memastikan format output dan kode warna terhitung dengan benar.

### Manual Verification
1. Masuk sebagai **Owner** dan navigasi ke menu **Kalender**.
2. Pastikan kalender menampilkan event kontrak dan pembayaran sesuai data di database.
3. Ubah filter menjadi "Kontrak Habis" dan pastikan event jatuh tempo tersembunyi.
4. Ubah filter menjadi "Jatuh Tempo" dan pastikan event kontrak tersembunyi.
5. Klik salah satu event dan verifikasi detail popup muncul dengan benar.
6. Klik tombol "Lihat Detail" di popup untuk memastikan navigasi mengarah ke halaman yang tepat (misal halaman kontrak atau pembayaran).
7. Ganti bulan menggunakan tombol navigasi FullCalendar (Prev/Next) dan pastikan data terupdate sesuai bulan yang baru dipilih.
