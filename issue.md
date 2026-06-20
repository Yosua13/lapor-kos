# Analisis & Rencana Implementasi: Manajemen Peraturan Kos Dinamis (Database-Driven)

Dokumen ini memuat analisis teknis, skema database, rancangan endpoint API, rencana pembaruan antarmuka frontend, dan kriteria penyelesaian (Definition of Done) untuk fitur **Manajemen Peraturan Kos** berdasarkan diskusi dan elaborasi kebutuhan terbaru.

---

## 1. Analisis Kebutuhan Bisnis
* **Penyimpanan Dinamis**: Peraturan kos yang sebelumnya statis (hardcoded) harus disimpan di database PostgreSQL agar lebih fleksibel.
* **Inisialisasi Otomatis (Seeding)**: Secara default, saat database peraturan kosong untuk suatu properti kos, sistem akan menginisialisasi tabel secara otomatis dengan 10 peraturan default.
* **Kontrol Akses Multi-Tenant**: 
  * **Penghuni (Tenant)**: Hanya dapat membaca peraturan yang dibuat oleh Pemilik Kos (Owner) tempat mereka tinggal.
  * **Pemilik Kos (Owner)**: Memiliki hak akses penuh untuk membuat, membaca, memperbarui, dan menghapus (CRUD) peraturan kos miliknya sendiri.

---

## 🛠️ Rencana Implementasi Backend (Go)

### A. Migrasi Database (`012_create_house_rules.sql`)
Buat tabel baru `house_rules` dengan relasi ke pemilik kos (`users.id`):
```sql
CREATE TABLE IF NOT EXISTS house_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'keamanan', 'kebersihan', 'fasilitas', 'pembayaran', 'umum'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    details TEXT[] NOT NULL, -- Menyimpan rincian bullet points peraturan
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Indexing untuk query cepat
CREATE INDEX IF NOT EXISTS idx_house_rules_owner ON house_rules(owner_id);
```

### B. Model Data (`internal/model/house_rule.go`)
```go
package model

import (
	"time"
	"github.com/google/uuid"
)

type HouseRule struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	OwnerID     uuid.UUID  `json:"owner_id" db:"owner_id"`
	Category    string     `json:"category" db:"category" binding:"required"`
	Title       string     `json:"title" db:"title" binding:"required"`
	Description string     `json:"description" db:"description" binding:"required"`
	Details     []string   `json:"details" db:"details" binding:"required,min=1"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at,omitempty" db:"updated_at"`
}
```

### C. Alur Endpoint API (`GET`, `POST`, `PUT`, `DELETE`)
1. **`GET /api/rules`**:
   * Ambil informasi pengguna dari token JWT (Context).
   * **Jika Tenant**: Cari `owner_id` dari kontrak aktif (`contracts`) tempat tenant tersebut terdaftar. Gunakan `owner_id` tersebut untuk mencari peraturan.
   * **Jika Owner**: Gunakan `user_id` miliknya sendiri sebagai `owner_id`.
   * **Seeding Otomatis**: Jika query peraturan ke database menghasilkan 0 data, backend akan memicu proses penyisipan bulk (*bulk insert*) 10 peraturan bawaan standar, kemudian mengembalikannya ke klien.
2. **`POST /api/rules`** (Owner Only):
   * Validasi payload. Sisipkan aturan baru dengan `owner_id` dari auth context.
3. **`PUT /api/rules/:id`** (Owner Only):
   * Update data berdasarkan `id` peraturan dan pastikan `owner_id` sesuai (mencegah modifikasi silang antar pemilik).
4. **`DELETE /api/rules/:id`** (Owner Only):
   * Hapus baris peraturan berdasarkan `id` dan pastikan `owner_id` sesuai.

---

## 💻 Rencana Implementasi Frontend (Next.js)

### A. Pengambilan Data Dinamis
* Mengubah [rules/page.tsx](file:///d:/project_yosua/lapor-kos/frontend/src/app/(dashboard)/rules/page.tsx) untuk memuat data menggunakan `apiFetch('/api/rules')`.
* Menyediakan visual loader (spinner / skeleton screen) saat data sedang di-fetch dari server.

### B. Portal Administrasi Peraturan (Khusus Pemilik Kos)
* Menampilkan panel kontrol / tombol aksi di halaman `/rules` bagi pengguna ber-role `owner`:
  * **Tombol "Tambah Peraturan"**: Membuka modal dengan form input kategori, judul, deskripsi, dan daftar dinamis detail poin (dapat menambah/menghapus baris item detail).
  * **Tombol "Edit" & "Hapus"**: Diletakkan pada setiap accordion card peraturan.
* **Komponen Form Peraturan**:
  * Input fields interaktif yang disinkronkan menggunakan State.
  * Dukungan penambahan baris list dinamis untuk properti `details` (array string).
  * Modal konfirmasi penghapusan demi keamanan data.

---

##  Definition of Done (DoD)

- [ ] File migrasi SQL `012_create_house_rules.sql` dibuat dan database berhasil diperbarui.
- [ ] Model, Repository, Handler, dan Router di backend selesai dibuat serta diuji sukses.
- [ ] Mekanisme inisialisasi default (seeding) otomatis berfungsi dengan baik saat data di-fetch pertama kali di database yang kosong.
- [ ] API Endpoint `/api/rules` terproteksi dengan middleware otentikasi.
- [ ] Pengguna role Tenant dapat melihat daftar peraturan milik Owner-nya secara dinamis tanpa memiliki tombol edit/hapus (*read-only*).
- [ ] Pengguna role Owner dapat melakukan penambahan, pengeditan, dan penghapusan peraturan kos dengan antarmuka modal form interaktif pada halaman `/rules`.
- [ ] Halaman `/rules` tetap mendukung pencarian real-time dan format cetak dokumen yang rapi (print-friendly).
- [ ] Aplikasi sukses dikompilasi di backend (`go run main.go` / `go build`) dan frontend (`npm run build`) dengan nilai pengujian linter bersih.
