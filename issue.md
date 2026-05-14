# PROMPT — Redesign Modal "Tambah Penghuni Baru"

## Konteks
Perbaiki tampilan modal "Tambah Penghuni Baru" yang sudah ada.
Jangan tambah atau kurangi field — field harus tetap persis seperti ini:
1. Nama Lengkap
2. Nomor HP/WA
3. Pilih Kamar Tersedia (dropdown)
4. Tanggal Masuk
5. Dokumen KTP (upload foto)
6. Foto Selfie (upload foto)

Ikuti color palette aplikasi

---

## Yang Harus Diubah

### Modal Header
- Tambahkan tag kecil "REGISTRASI PENGHUNI" berwarna teal di atas judul
- Judul tetap "Tambah Penghuni Baru", subtitle "Lengkapi data identitas dan dokumen pendukung"
- Tombol ✕ close di pojok kanan atas

### Layout & Grouping
- Bagi form menjadi 3 grup dengan label section pemisah:
  - **Data Diri** → Nama Lengkap + Nomor HP/WA (2 kolom)
  - **Data Kamar** → Pilih Kamar + Tanggal Masuk (2 kolom)
  - **Dokumen Identitas** → Upload KTP + Upload Selfie (2 kolom)
- Label section berupa garis horizontal dengan teks di kiri (seperti divider)

### Input Fields
- Setiap field wajib punya label di atas input (bukan hanya placeholder)
- Tambahkan tanda `*` merah untuk field wajib
- Tambahkan helper text kecil di bawah input:
  - Nama Lengkap → "Sesuai KTP"
  - Nomor HP/WA → "Nomor aktif yang bisa dihubungi"
  - Tanggal Masuk → "Awal periode kontrak"
- Border input: `1.5px solid` abu-abu, saat focus border ganti teal + ring shadow teal transparan
- Border radius input: 9px

### Dropdown Pilih Kamar
- Saat kamar dipilih, tampilkan **info card kecil** di bawah dropdown berisi:
  - Nama kamar + detail lantai & fasilitas (kiri)
  - Harga per bulan berwarna teal (kanan)
- Card ini background teal sangat muda (`#f0faf8`) dengan border teal

### Upload Dokumen
- Area upload lebih besar dan visual, dengan:
  - Ikon emoji relevan (🪪 untuk KTP, 🤳 untuk selfie)
  - Judul upload yang jelas
  - Sub-teks format file yang diterima (JPG/PNG, maks 5MB)
  - Border dashed abu-abu, hover ganti border teal
- Saat file sudah dipilih:
  - Border solid hijau, background hijau sangat muda
  - Ikon ganti ✅
  - Nama file tampil terpotong jika terlalu panjang
  - Badge kecil "Terupload" di pojok kanan atas area upload

### Footer Modal
- Background cream `#faf8f5`, border top tipis
- Kiri: keterangan kecil "* Field wajib diisi"
- Kanan: tombol "Batal" (outline) + tombol "Simpan Data Penghuni" (teal solid + ikon centang)
- Tombol Simpan tidak berubah fungsi/label

---

## Yang Tidak Boleh Diubah
- Nama dan jumlah field (tetap 6 field seperti gambar asli)
- Logic dan koneksi ke API backend
- Struktur komponen secara keseluruhan
- Nama tombol: "Batal" dan "Simpan Data Penghuni"