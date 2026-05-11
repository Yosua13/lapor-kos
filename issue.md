# 📋 Lapor Kos — Pengembangan Fitur Autentikasi Lanjutan [COMPLETED]

Dokumen ini berisi instruksi high-level untuk pengembang dalam mengimplementasikan alur verifikasi email dan manajemen password.

---

## 1. Verifikasi Email Setelah Registrasi [DONE]
**Tujuan:** Memastikan email pengguna valid sebelum mereka dapat masuk ke aplikasi.

- **Alur Kerja:**
  - Setelah form registrasi berhasil disubmit, jangan langsung arahkan ke login, melainkan tampilkan pop up dengan instruksi "Cek Email Anda" dan user tidak bisa login sebelum verifikasi email selesai.
  - Backend harus mengirimkan email berisi tombol verifikasi dengan token unik.
  - Saat tombol diklik, arahkan pengguna ke endpoint verifikasi yang kemudian melakukan redirect ke halaman login dengan pesan sukses.
  - Tambahkan pengecekan pada proses Login: Pengguna yang belum diverifikasi tidak boleh masuk.

---

## 2. Fitur Lupa Password (OTP Based) [DONE]
**Tujuan:** Memberikan cara aman bagi pengguna untuk memulihkan akses akun mereka.

- **Alur Kerja:**
  - **Halaman Permintaan:** Pengguna memasukkan email untuk menerima kode OTP.
  - **Verifikasi OTP:** Pengguna memasukkan 6 digit kode OTP yang dikirimkan ke email mereka.
  - **Reset Password:** Setelah OTP valid, arahkan ke halaman pembuatan password baru.
  - **Finalisasi:** Setelah password berhasil diubah, arahkan pengguna kembali ke halaman Login.

---

## 3. Implementasi "Ingat Saya" (30 Hari) [DONE]
**Tujuan:** Meningkatkan kenyamanan pengguna dengan sesi yang lebih lama jika diinginkan.

- **Instruksi:**
  - Pastikan token JWT yang dihasilkan memiliki masa berlaku yang sesuai (misal: 30 hari).
  - Simpan token di storage permanen (LocalStorage) dan Cookie dengan `max-age` 30 hari jika opsi ini dicentang.
  - Pastikan middleware dapat memvalidasi token berdurasi panjang tersebut.

---

## 4. Pembersihan Autentikasi Google [DONE]
**Tujuan:** Menyederhanakan sistem autentikasi hanya melalui Email & Password.

- **Instruksi:**
  - Hapus seluruh komponen tombol "Masuk/Daftar dengan Google" di halaman Login dan Register.
  - Hapus semua logika atau API endpoint yang berkaitan dengan Google OAuth (jika ada) di sisi frontend dan backend.

---

## Prompt Implementasi untuk AI/Junior Dev:

> "Implementasikan alur verifikasi email dan reset password pada project Lapor Kos. Buatlah sistem pengiriman email (SMTP) untuk mengirimkan link verifikasi dan kode OTP. Pastikan pengguna tidak bisa login sebelum verifikasi email selesai. Gunakan alur: Request OTP -> Verify OTP -> Set New Password -> Login. Terakhir, hapus semua elemen UI yang berkaitan dengan login Google untuk menyederhanakan antarmuka."
