# Panduan Menjalankan Frontend 🎨

Direktori ini berisi kode frontend untuk aplikasi **Lapor Kos**, dibangun sebagai *Single Page Application* (SPA) menggunakan **Vite**, **React 19**, **React Router v7**, **Tailwind CSS v4**, dan **TypeScript**.

---

## 🛠️ Prasyarat Sistem

Sebelum memulai, pastikan perangkat Anda telah terinstal:

1. **Node.js**: Versi **`v26.13.0`** atau lebih baru.
   * Cek versi di terminal: `node --version`
   * Unduh di [nodejs.org](https://nodejs.org/).
2. **NPM**: Versi **`10.x`** atau lebih baru (bawaan Node.js).

---

## ⚙️ Langkah Menjalankan Aplikasi

### 1. Instalasi Dependensi
Buka terminal pada direktori `frontend` (`lapor-kos/frontend`) dan jalankan:

```bash
npm install
```

### 2. Konfigurasi Environment Variables (`.env` / `.env.local`)
Buat berkas `.env` atau `.env.local` pada direktori root `frontend/` (sejajar dengan `package.json`):

```env
# Alamat server backend API Lapor Kos
NEXT_PUBLIC_API_URL=http://localhost:8081

# Midtrans Snap Client Key (Sandbox)
VITE_MIDTRANS_CLIENT_KEY=<MIDTRANS_CLIENT_KEY_SANDBOX_ANDA>
```

> **Catatan:** Dalam mode pengembangan (`npm run dev`), Vite juga menyediakan proxy otomatis untuk request yang mengarah ke `/api` sehingga langsung diarahkan ke `http://localhost:8081`.

### 3. Menjalankan Server Pengembangan (Dev Server)
Jalankan perintah:

```bash
npm run dev
```

Aplikasi web dapat langsung diakses pada peramban Anda di alamat:
👉 **[http://localhost:3000](http://localhost:3000)**

Server Vite dilengkapi dengan fitur *Instant Hot Module Replacement (HMR)* untuk pembaruan kode secara seketika tanpa me-refresh halaman manual.

---

## 📋 Daftar Perintah yang Tersedia

| Perintah | Deskripsi |
| :--- | :--- |
| **`npm run dev`** | Menjalankan server pengembangan lokal pada port `3000`. |
| **`npm run build`** | Memvalidasi tipe data TypeScript (`tsc -b`) dan membuat bundle produksi teroptimasi ke folder `dist/`. |
| **`npm run preview`** | Menjalankan server lokal untuk menguji pratinjau hasil build produksi dari folder `dist/`. |
| **`npm run test`** | Mengeksekusi seluruh pengujian unit dan komponen menggunakan **Vitest**. |
| **`npm run lint`** | Memeriksa kepatuhan kode dan sintaks menggunakan **ESLint**. |

---

## 🐳 Menjalankan dengan Docker

Frontend ini sudah dilengkapi dengan `Dockerfile` multi-stage berbasis **Nginx Alpine** yang sangat ringan (~20 MB):

```bash
# Build image Docker frontend
docker build -t lapor-kos-frontend .

# Jalankan container
docker run -p 3000:3000 lapor-kos-frontend
```
