# Manual Test Cases: [EPIC 08] Notification Center dan Delivery Platform

Dokumen ini menyediakan skenario uji manual end-to-end untuk memvalidasi fitur Pusat Notifikasi, Preferensi Pengguna, Jam Tenang (Quiet Hours), Outbox Deduplication, dan Pemantauan Status Pengiriman (Delivery Platform Monitor).

---

## Ringkasan Skenario

| Test ID | Skenario Uji | Kriteria Penerimaan Terkait | Peran Pengguna |
| :--- | :--- | :--- | :--- |
| **NTF-01** | Akses Kotak Masuk (Inbox) dan Filter Kategori | Ruang Lingkup Inbox | Tenant, Staf, Owner |
| **NTF-02** | Tandai Pesan Dibaca Tanpa Menghapus Histori | **AC 4** | Tenant, Staf, Owner |
| **NTF-03** | Hapus / Arsipkan Notifikasi dari Tampilan Pengguna | **AC 4** | Tenant, Staf, Owner |
| **NTF-04** | Badge Unread Count dan Popover Lonceng Topbar | Ruang Lingkup UI/UX | Tenant, Staf, Owner |
| **NTF-05** | Konfigurasi Saluran Pengiriman (In-App, WhatsApp, Email) | **AC 5** | Tenant, Staf, Owner |
| **NTF-06** | Pengaktifan Jam Tenang (Quiet Hours) & Pembatasan Jam | **AC 5** | Tenant, Staf, Owner |
| **NTF-07** | Pengabaian Pengiriman Eksternal untuk Kategori Opt-Out | **AC 5** | Tenant, Staf, Owner |
| **NTF-08** | Pencegahan Spam Melalui Deduplikasi Event Outbox | **AC 1** | Sistem, Staf |
| **NTF-09** | Isolasi Transaksi Bisnis Terhadap Kegagalan Gateway Eksternal | **AC 2** | Sistem, Owner |
| **NTF-10** | Monitoring Outbox dan Eksekusi Retry oleh Owner | **AC 3** | Owner, Manager |

---

## Rincian Test Cases

### NTF-01: Akses Kotak Masuk (Inbox) dan Filter Kategori
- **Tujuan:** Memverifikasi tampilan kotak masuk notifikasi dan filter kategori.
- **Langkah Pengujian:**
  1. Login ke aplikasi sebagai tenant atau staf.
  2. Klik ikon lonceng pada Topbar, lalu pilih **"Buka Seluruh Kotak Masuk"**, atau buka URL `/notifications`.
  3. Perhatikan daftar notifikasi yang tampil pada tab **"Kotak Masuk (Inbox)"**.
  4. Klik tab kategori: `Semua`, `Keuangan`, `Operasional`, `Komplain`, `Kontrak`, `Pengumuman`, `Keamanan`.
- **Hasil yang Diharapkan:**
  - Daftar notifikasi terfilter sesuai kategori yang dipilih.
  - Setiap kartu notifikasi menampilkan badge kategori, judul, ringkasan pesan, dan waktu relatif.

---

### NTF-02: Tandai Pesan Dibaca Tanpa Menghapus Histori (AC 4)
- **Tujuan:** Memastikan penandaan "dibaca" memperbarui status tanpa menghapus data historis.
- **Langkah Pengujian:**
  1. Pada halaman `/notifications`, temukan notifikasi yang memiliki indikator "Baru".
  2. Klik tombol **"Tandai Dibaca"** pada notifikasi tersebut.
  3. Alternatif lain: klik tombol **"Tandai Semua Dibaca"** di header atas.
  4. Nonaktifkan filter "Hanya belum dibaca" jika sedang aktif.
  5. Periksa apakah pesan yang baru saja ditandai dibaca masih ada di daftar.
- **Hasil yang Diharapkan:**
  - Indikator "Baru" hilang dan `is_read` menjadi `true`.
  - Pesan **tetap ada** dalam riwayat (tidak terhapus dari basis data).
  - Badge angka unread pada Topbar berkurang sesuai jumlah pesan yang ditandai dibaca.

---

### NTF-03: Hapus / Arsipkan Notifikasi dari Tampilan Pengguna (AC 4)
- **Tujuan:** Memvalidasi mekanisme soft-delete sehingga histori audit tetap dipertahankan.
- **Langkah Pengujian:**
  1. Pada halaman `/notifications`, klik ikon tempat sampah (**Hapus / Arsipkan**) pada salah satu notifikasi.
  2. Perhatikan kartu notifikasi tersebut langsung hilang dari tampilan kotak masuk pengguna.
  3. Periksa langsung tabel `in_app_notifications` di basis data:
     ```sql
     SELECT id, is_read, read_at, deleted_at FROM in_app_notifications WHERE id = '<notif_id>';
     ```
- **Hasil yang Diharapkan:**
  - Kolom `deleted_at` terisi timestamp waktu penghapusan (`deleted_at IS NOT NULL`).
  - Baris data **tidak dihapus secara fisik** (`hard delete`) dari basis data untuk keperluan retensi audit.

---

### NTF-04: Badge Unread Count dan Popover Lonceng Topbar
- **Tujuan:** Menguji interaktivitas lonceng notifikasi pada navigasi utama.
- **Langkah Pengujian:**
  1. Buka halaman manapun di dashboard (misal: `/rooms` atau `/`).
  2. Amati ikon lonceng di Topbar sebelah kanan atas.
  3. Klik ikon lonceng untuk membuka popover dropdown ringkas.
  4. Klik tautan notifikasi yang memiliki tautan tujuan (misal: deep link pembayaran `/payments`).
- **Hasil yang Diharapkan:**
  - Badge merah menampilkan jumlah pesan unread dengan animasi yang halus.
  - Popover dropdown menampilkan 5 notifikasi terbaru dengan tombol cepat "Tandai dibaca".
  - Mengklik pesan membuka tautan tujuan dan otomatis menandai pesan sebagai telah dibaca.

---

### NTF-05: Konfigurasi Saluran Pengiriman (In-App, WhatsApp, Email) (AC 5)
- **Tujuan:** Memvalidasi pengelolaan preferensi saluran komunikasi pengguna.
- **Langkah Pengujian:**
  1. Masuk ke halaman `/notifications` lalu klik tab **"Preferensi & Jam Tenang"** (atau buka `/settings` tab "Notifikasi & Jam Tenang").
  2. Ubah centang pada kartu saluran:
     - Nonaktifkan **WhatsApp**.
     - Aktifkan **Email** dan **Aplikasi (In-App)**.
  3. Klik **"Simpan Pengaturan"**.
  4. Muat ulang halaman dan periksa apakah nilai konfigurasi tetap tersimpan.
- **Hasil yang Diharapkan:**
  - Pesan sukses hijau tampil: *"Preferensi notifikasi berhasil disimpan!"*.
  - Status tersimpan persisten di tabel `notification_preferences`.

---

### NTF-06: Pengaktifan Jam Tenang (Quiet Hours) & Pembatasan Jam (AC 5)
- **Tujuan:** Menguji penundaan saluran pesan eksternal selama jam istirahat.
- **Langkah Pengujian:**
  1. Pada tab preferensi notifikasi, aktifkan toggle **"Jam Tenang (Quiet Hours)"**.
  2. Atur jam mulai: `22:00` dan jam selesai: `07:00`.
  3. Pilih zona waktu: `WIB (Asia/Jakarta)`.
  4. Klik **"Simpan Pengaturan"**.
  5. Kirimkan event non-darurat ke outbox pada rentang jam tenang (misal: jam 23:00).
- **Hasil yang Diharapkan:**
  - Notifikasi in-app tetap masuk ke kotak masuk aplikasi.
  - Percobaan pengiriman eksternal (WhatsApp/Email) mencatat status `skipped_quiet_hours` dan tidak mengganggu pengguna saat jam istirahat.
  - Pesan darurat (prioritas `urgent`) tetap terkirim secara instan tanpa terhambat jam tenang.

---

### NTF-07: Pengabaian Pengiriman Eksternal untuk Kategori Opt-Out (AC 5)
- **Tujuan:** Memvalidasi kepatuhan sistem terhadap kategori opt-out pengguna.
- **Langkah Pengujian:**
  1. Pada tab preferensi, pada bagian **"Kategori yang Dilewati (Opt-Out)"**, centang kategori **"Pengumuman Komunitas"** (`announcement`).
  2. Klik **"Simpan Pengaturan"**.
  3. Picu penerbitan event berkategori `announcement`.
- **Hasil yang Diharapkan:**
  - Status pengiriman pada outbox/deliveries tercatat sebagai `opted_out`.
  - Sistem tidak mengirimkan spam WhatsApp/email untuk kategori yang telah dipilih untuk di-opt-out oleh pengguna.

---

### NTF-08: Pencegahan Spam Melalui Deduplikasi Event Outbox (AC 1)
- **Tujuan:** Memastikan event duplikat dengan `dedup_key` yang sama dalam 24 jam tidak menghasilkan spam ganda.
- **Langkah Pengujian:**
  1. Picu event pertama dengan kunci deduplikasi tertentu (misal: pembayaran `payment:uuid-1:payment_verified:user-1`).
  2. Picu event kedua dengan `dedup_key` yang identik dalam jendela waktu kurang dari 24 jam.
  3. Periksa tabel `notification_outbox` dan `notification_deliveries`.
- **Hasil yang Diharapkan:**
  - Event pertama berstatus `delivered` atau `pending`.
  - Event kedua langsung diberi status `deduplicated` dengan keterangan *"Event duplikat diabaikan"*.
  - Penerima tidak menerima pesan duplikat (tidak terjadi spam).

---

### NTF-09: Isolasi Transaksi Bisnis Terhadap Kegagalan Gateway Eksternal (AC 2)
- **Tujuan:** Memverifikasi bahwa kegagalan API WhatsApp / SMTP tidak membatalkan transaksi utama.
- **Langkah Pengujian:**
  1. Simulasikan kegagalan jaringan atau token gateway eksternal yang salah.
  2. Lakukan transaksi bisnis (misal: verifikasi pembayaran invoice atau eksekusi checkout kamar).
  3. Amati respons API bisnis dan data transaksi di basis data.
- **Hasil yang Diharapkan:**
  - Transaksi bisnis **berhasil 100%** (status invoice tetap `paid`, checkout tetap `completed`).
  - Outbox mencatat status `failed` beserta pesan galat (`last_error`) tanpa memicu rollback pada data keuangan/hunian.

---

### NTF-10: Monitoring Outbox dan Eksekusi Retry oleh Owner (AC 3)
- **Tujuan:** Memvalidasi dashboard operasional outbox dan tombol Retry pengiriman pesan gagal.
- **Langkah Pengujian:**
  1. Login sebagai **Owner Properti** atau **Manager**.
  2. Buka menu `/notifications` lalu klik tab **"Monitoring Pengiriman (Outbox)"**.
  3. Filter status berdasarkan **"Gagal"**.
  4. Amati baris event yang gagal, perhatikan kolom *Alasan Kegagalan* dan jumlah retry.
  5. Klik ikon mata untuk melihat detail JSON payload dan daftar delivery record per channel.
  6. Klik tombol **"Retry"** (Coba Kirim Ulang).
- **Hasil yang Diharapkan:**
  - Sistem mengeksekusi ulang pengiriman outbox item tersebut.
  - Jumlah retry bertambah (`retry_count` + 1) dan status diperbarui secara otomatis.
  - Notifikasi toast sukses tampil menginformasikan hasil retry.
