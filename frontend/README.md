# Lapor Kos - Frontend Application 🎨

Direktori ini berisi kode frontend untuk aplikasi **Lapor Kos**, dibangun menggunakan framework modern Next.js (App Router), React 19, Tailwind CSS v4, dan TypeScript. Frontend ini menyediakan antarmuka interaktif bagi pemilik kos (dashboard okupansi, kalender perpanjangan kontrak, laporan grafik keuangan, dan kelola aturan kos) serta portal penghuni (riwayat tagihan, upload bukti transfer, dan input keluhan fasilitas).

---

## 🛠️ Tech Stack & Persyaratan Sistem

Sebelum menjalankan aplikasi, pastikan komputer Anda telah terinstal perangkat lunak berikut:

1. **Node.js**: Versi **`v22.x`** (LTS - Recommended) atau lebih baru.
   * Cek versi Node.js di terminal: `node --version`
   * Unduh di [nodejs.org](https://nodejs.org/).
2. **NPM**: Pengelola paket bawaan Node.js (Versi 10.x atau lebih baru).
3. **Teknologi Utama (Otomatis Terinstal)**:
   * **Next.js v16.2.6** (dengan App Router)
   * **React v19.2.4** & **React DOM v19.2.4**
   * **Tailwind CSS v4** (Utility-first CSS Framework)
   * **TypeScript v5.x** (Static Typing)
   * **Lucide React** (Kumpulan Ikon Modern)
   * **FullCalendar v6.1.20** (Peta Visual Kalender Kontrak)
   * **Vitest** (Unit Testing Utility)

---

## ⚙️ Langkah Instalasi Ulang (Fresh Setup)

Jika Anda ingin membersihkan file instalasi lama dan menginstal ulang seluruh paket dependensi frontend secara bersih:

### 1. Bersihkan File Sampah & Cache NPM
Buka terminal pada direktori `frontend` (`d:/project_yosua/lapor-kos/frontend`) dan jalankan perintah:

```bash
# Menghapus folder node_modules lama
rm -rf node_modules

# Menghapus file lock lama (Opsional jika ingin fresh lock file)
rm package-lock.json

# Membersihkan cache NPM secara paksa
npm cache clean --force
```

### 2. Jalankan Instalasi Ulang Paket Dependensi
Jalankan perintah berikut untuk mengunduh ulang seluruh package yang tercatat pada `package.json`:

```bash
npm install
```

### 3. Konfigurasi Environment Variables (`.env.local`)
Buat file baru bernama `.env.local` pada direktori root `frontend/` (sejajar dengan `package.json`) dengan konfigurasi berikut:

```env
# Alamat server URL backend API Lapor Kos
NEXT_PUBLIC_API_URL=http://localhost:8081
```

---

## 🚀 Cara Menjalankan Aplikasi

Untuk menjalankan server pengembangan lokal (*development server*):

```bash
npm run dev
```

Aplikasi web dapat diakses langsung pada peramban/browser Anda di alamat: **`http://localhost:3000`**

---

## 📋 Daftar Perintah Tersedia (Available Commands)

* **`npm run dev`**: Menjalankan aplikasi dalam mode pengembangan lokal dengan fitur *Fast Refresh*.
* **`npm run build`**: Mengompilasi dan mengoptimalkan aplikasi menjadi berkas statis siap rilis (*production bundle*).
* **`npm run start`**: Menjalankan aplikasi hasil kompilasi produksi (Jalankan `npm run build` terlebih dahulu).
* **`npm run lint`**: Mengevaluasi kualitas penulisan kode menggunakan ESLint untuk mencari peringatan dan kesalahan penulisan (*syntax & formatting check*).
* **`npm run test`**: Mengeksekusi rangkaian pengujian unit test menggunakan **Vitest** untuk memastikan kestabilan kode.
