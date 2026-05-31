# Rencana Perbaikan: Validasi Ketersediaan Kamar Sebelum Pembuatan Kontrak

Dokumen ini berisi panduan langkah-demi-langkah (high-level) untuk junior programmer atau model LLM guna mengimplementasikan validasi agar kontrak baru tidak bisa dibuat untuk kamar yang sudah terisi (*occupied*).

---

## 1. Tujuan
Mencegah pembuatan kontrak sewa baru apabila kamar yang dipilih **tidak berstatus "available"** (atau sedang terisi). Saat ini sistem langsung memperbolehkan pembuatan kontrak tanpa mempedulikan status kamar saat ini.

---

## 2. Langkah Perubahan (Backend)

### A. Ubah Berkas: `backend/internal/repository/contract_repository.go`
Kita perlu memvalidasi status kamar di dalam transaksi database sebelum melakukan *insert* data kontrak baru.

1. **Buka Berkas**: `backend/internal/repository/contract_repository.go` pada fungsi `Create(...)`.
2. **Tambahkan Validasi Query**:
   - Di dalam transaksi (`tx`), sebelum melakukan query `INSERT INTO contracts`, lakukan `SELECT status FROM rooms WHERE id = $1` menggunakan `room_id` dari kontrak.
   - Ambil (scan) status kamar tersebut.
3. **Pengecekan Kondisi**:
   - Jika status kamar tersebut **tidak sama dengan** `'available'`, batalkan transaksi (`rollback`) dan kembalikan error dengan pesan yang jelas (misalnya: `"kamar sudah terisi atau tidak tersedia"`).
   - Jika status kamar `'available'`, lanjutkan proses *insert* kontrak dan *update* status kamar menjadi `'occupied'` seperti biasa.

---

## 3. Langkah Perubahan (Backend Handler - Opsional untuk Response Bagus)

### B. Ubah Berkas: `backend/internal/handler/contract_handler.go`
Pastikan pesan error dari repository ditangani dengan baik agar frontend menerima HTTP Status 400 (Bad Request).

1. **Buka Berkas**: `backend/internal/handler/contract_handler.go` pada fungsi `CreateContract(...)`.
2. **Tangani Error**:
   - Periksa bagian pemanggilan `h.repo.Create(...)`.
   - Jika error yang dikembalikan adalah tentang kamar tidak tersedia, berikan respon `c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})` (bukan 500 Internal Server Error).

---

## 4. Cara Uji Coba (Verifikasi)
1. **Melalui Frontend / Postman**:
   - Pilih satu kamar yang statusnya sudah **Terisi (Occupied)**.
   - Coba buat kontrak baru untuk kamar tersebut.
   - **Ekspektasi**: Sistem harus menolak pembuatan kontrak tersebut dan memunculkan pesan error "Kamar tidak tersedia".
2. **Coba Kamar Kosong**:
   - Coba buat kontrak untuk kamar yang statusnya **Kosong (Available)**.
   - **Ekspektasi**: Kontrak berhasil dibuat dan status kamar berubah otomatis menjadi **Occupied**.
