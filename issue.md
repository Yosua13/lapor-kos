# Rencana Implementasi Modul 8: Pengaturan Aplikasi

Modul ini mencakup pembuatan fitur pengaturan aplikasi yang dapat digunakan oleh **Owner (Pemilik Kos)** maupun **Penghuni**. Fitur ini meliputi pembaruan informasi profil, perubahan kata sandi, pengaturan tema tampilan (gelap/terang), serta dasar untuk pengaturan lainnya di masa depan.

---

## 1. Fitur Utama

### A. Pengaturan Profil
*   **Tujuan:** Memungkinkan pengguna untuk melihat dan memperbarui informasi dasar akun mereka.
*   **Informasi yang Dapat Diubah:**
    *   Nama Lengkap
    *   Email
    *   Nomor Handphone (HP)
*   **Validasi Input:**
    *   Nama tidak boleh kosong.
    *   Format email harus valid.
    *   Nomor HP harus berupa angka yang valid.

### B. Keamanan (Ubah Kata Sandi)
*   **Tujuan:** Memungkinkan pengguna mengganti kata sandi demi keamanan akun.
*   **Kebutuhan Input:**
    *   Kata Sandi Saat Ini (untuk verifikasi)
    *   Kata Sandi Baru
    *   Konfirmasi Kata Sandi Baru
*   **Validasi Input:**
    *   Kata sandi baru harus cocok dengan konfirmasi kata sandi baru.
    *   Kata sandi baru memiliki panjang minimal yang aman (misalnya, 6 atau 8 karakter).

### C. Pengaturan Tampilan (Tema Gelap / Terang)
*   **Tujuan:** Meningkatkan kenyamanan pengguna dengan opsi tema visual.
*   **Kebutuhan:**
    *   Tombol toggle atau pilihan untuk berganti antara **Tema Terang (Light Mode)** dan **Tema Gelap (Dark Mode)**.
    *   Tema yang dipilih harus langsung diterapkan ke seluruh aplikasi.
    *   Pilihan tema harus disimpan agar ketika halaman dimuat ulang (reload), tema pilihan terakhir tetap aktif (disimpan di LocalStorage atau database).

### D. Pengaturan Lainnya (Ekstensi Masa Depan)
*   **Tujuan:** Menyediakan struktur/layout menu untuk pengaturan tambahan lainnya di masa depan (contoh: toggle notifikasi).

---

## 2. Tugas Bagian Depan (Frontend - Next.js)

1.  **Halaman / Tab Baru untuk Pengaturan:**
    *   Buat halaman/menu baru dengan nama "Pengaturan" atau "Settings" di dashboard Owner dan dashboard Penghuni.
2.  **Formulir Profil & Keamanan:**
    *   Buat komponen UI formulir yang bersih dan responsif.
    *   Tampilkan data profil pengguna saat ini secara otomatis (pre-filled).
    *   Tampilkan pesan sukses atau pesan error yang jelas setelah pengguna menekan tombol simpan.
3.  **Toggle Switch Tema:**
    *   Pasang saklar (toggle switch) atau tombol khusus untuk pergantian tema gelap/terang.
    *   Pastikan ada integrasi dengan CSS / tailwind theme variable yang digunakan pada proyek untuk mengubah warna dasar aplikasi saat mode gelap aktif.

---

## 3. Tugas Bagian Belakang (Backend - Go)

1.  **Endpoint Mengambil Profil:**
    *   Sediakan API endpoint untuk mengambil data profil pengguna yang sedang login (berdasarkan token autentikasi/session).
2.  **Endpoint Update Profil:**
    *   Sediakan API endpoint untuk memperbarui data profil (Nama, Email, Nomor HP).
    *   Lakukan pengecekan validasi data sebelum menyimpannya ke database.
3.  **Endpoint Ubah Kata Sandi:**
    *   Sediakan API endpoint untuk mengubah kata sandi.
    *   Backend harus memverifikasi terlebih dahulu apakah Kata Sandi Saat Ini yang dimasukkan pengguna sudah benar.
    *   Jika benar, lakukan enkripsi (hashing) pada Kata Sandi Baru dan simpan ke database.

---

## 4. Kriteria Keberhasilan (Acceptance Criteria)

- [ ] Pengguna (Owner & Penghuni) dapat memperbarui Nama, Email, dan No HP mereka dan perubahan tersimpan di database.
- [ ] Pengguna dapat mengubah kata sandi mereka dengan memverifikasi kata sandi lama terlebih dahulu.
- [ ] Pengguna dapat berganti tema dari Terang ke Gelap dan sebaliknya secara instan di layar.
- [ ] Pilihan tema pengguna tidak hilang setelah halaman di-refresh.
- [ ] Tampilan antarmuka (UI) halaman pengaturan rapi, ramah pengguna, dan responsif di perangkat mobile maupun desktop.
