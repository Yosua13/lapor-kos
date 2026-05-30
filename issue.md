# Rencana Perbaikan UI: Manajemen Kamar & Data Penghuni

## 1. Halaman Manajemen Kamar (`/rooms`)
Menyelaraskan tampilan halaman Manajemen Kamar agar serupa dengan halaman Data Penghuni, dengan penambahan fitur berikut:
- **Statistik Ringkas (Stat Cards)**: Menampilkan 4 kartu statistik di bagian atas:
  - **Total Kamar**: Jumlah total kamar.
  - **Kamar Terisi**: Jumlah kamar dengan status `occupied`.
  - **Kamar Kosong**: Jumlah kamar dengan status `available`.
  - **Tingkat Hunian**: Persentase kamar terisi vs total kamar.
- **Toolbar Filter & Search**:
  - Filter tab: "Semua", "Tersedia", "Terisi".
  - Pencarian nomor kamar.
  - Pengurutan (Sorting): Nomor kamar, Harga Terendah, Harga Tertinggi.
  - Mode Tampilan: Toggle antara **Grid View** (tampilan kartu/card) dan **List View** (tampilan tabel/ledger).
- **Animasi Tombol Tambah Kamar**:
  - Mempertahankan animasi putar (`group-hover:rotate-90`) pada ikon `Plus` di tombol "Tambah Kamar".

## 2. Halaman Data Penghuni (`/tenants`)
- **Animasi Tombol Tambah Penghuni**:
  - Menambahkan efek animasi putar (`group-hover:rotate-90 transition-transform duration-500`) pada ikon `Plus` di tombol "+ Tambah Penghuni".
- **Form Modal Data Penghuni**:
  - Mengubah modal form agar menggunakan `createPortal` seperti pada halaman Manajemen Kamar.
  - Menerapkan efek background blur penuh (`backdrop-filter: blur(6px)`) dan warna gelap transparan (`rgba(11, 31, 53, 0.45)`) agar fokus hanya ke form saja.
  - Menyelaraskan struktur modal (Header statis, Body scrollable, Footer tombol aksi statis) agar serupa dengan Manajemen Kamar.
