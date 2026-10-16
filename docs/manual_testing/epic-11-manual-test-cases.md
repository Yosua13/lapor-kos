# Manual Test Cases: [EPIC 11] Peraturan Kos Versioned dan Acknowledgment

Dokumen ini menyediakan panduan pengujian manual end-to-end untuk memvalidasi seluruh kriteria penerimaan pada **Epic 11: Peraturan Kos Versioned dan Acknowledgment**.

---

## Ringkasan Skenario Pengujian

| Test ID | Skenario Pengujian | Acceptance Criteria Terkait | Aktor Penguji |
| :--- | :--- | :--- | :--- |
| **RULE-01** | Membaca Peraturan Kos Bersifat Murni Read-Only Tanpa Efek Samping | **AC 1** | Owner / Tenant / Sistem |
| **RULE-02** | Pembuatan Draft & Pemuatan Template Standar Tanpa Auto-Seed Otomatis | **AC 1** | Owner / Manager |
| **RULE-03** | Penerbitan Versi Peraturan Baru & Penjaminan Immutability | **AC 2** | Owner / Manager |
| **RULE-04** | Histori Versi Tersedia Lengkap dan Tidak Tertimpa (Draft, Published, Superseded) | **AC 2, AC 4** | Owner / Manager |
| **RULE-05** | Tenant Baru Wajib Mengakui Versi Aktif Sebelum Kontrak Diaktifkan | **AC 3** | Owner & Tenant |
| **RULE-06** | Pencatatan Bukti Persetujuan (Acknowledgment) Secara Audit Trail | **AC 3, AC 5** | Tenant |
| **RULE-07** | Perubahan Aturan Tidak Berlaku Retroaktif pada Kontrak Berjalan | **AC 4** | Owner & Tenant |
| **RULE-08** | Notifikasi Terbitnya Versi Baru ke Seluruh Tenant Aktif | Dependensi EP-08 | Sistem / Tenant |
| **RULE-09** | Tabel Audit Menampilkan Tenant, Kamar, IP Address, Device, dan Waktu | **AC 5** | Owner / Manager |
| **RULE-10** | Isolasi Akses Berdasarkan Property Boundary (Property-Scoped) | Dependensi EP-01 | Multi-Tenant & Multi-Owner |

---

## Rincian Test Cases

### RULE-01: Membaca Peraturan Kos Bersifat Murni Read-Only (AC 1)
- **Tujuan:** Memastikan pemanggilan API atau pembukaan halaman peraturan ketika data kosong tidak melakukan auto-seeding atau penulisan data diam-diam ke database.
- **Prasyarat:** Properti baru yang belum memiliki peraturan di database.
- **Langkah Pengujian:**
  1. Periksa tabel `rule_versions` dan `house_rules` untuk `property_id` pengujian (pastikan jumlah baris = 0).
  2. Buka halaman **Peraturan Kos** (`/rules`) sebagai pengguna dengan akses ke properti tersebut.
  3. Lakukan refresh halaman beberapa kali.
  4. Periksa kembali database tabel `rule_versions` dan `house_rules`.
- **Hasil yang Diharapkan:**
  - Halaman menampilkan pesan ramah: *"Belum Ada Peraturan Diterbitkan"*.
  - Jumlah baris di database tetap 0 (tidak ada penulisan diam-diam).
  - Status HTTP adalah 200 OK dengan payload array kosong atau respons terstruktur.

---

### RULE-02: Pembuatan Draft & Pemuatan Template Standar (AC 1)
- **Tujuan:** Menyediakan template 10 kategori standar sebagai bahan review pengelola yang dapat dimuat ke dalam editor draft tanpa penulisan otomatis ke database sebelum disimpan.
- **Prasyarat:** Login sebagai Owner atau Manager.
- **Langkah Pengujian:**
  1. Masuk ke halaman `/rules`.
  2. Klik tombol **"Edit Draft / Versi Baru"**.
  3. Klik tombol **"Muat dari Template"**.
  4. Periksa daftar butir peraturan yang muncul di formulir (Jam malam, Kunjungan tamu, Sampah, Dapur, Listrik, Parkir, Denda sewa, Ketertiban, Larangan barang terlarang).
  5. Sesuaikan salah satu jam malam atau rincian aturan.
  6. Klik **"Simpan Draft Saja"**.
- **Hasil yang Diharapkan:**
  - Template termuat di browser secara instan via `GET /api/rules/templates`.
  - Setelah klik simpan, draft tersimpan dengan status `draft` dan nomor versi draft berikutnya.
  - Aturan belum berstatus aktif (`published`) sampai owner secara eksplisit menerbitkannya.

---

### RULE-03: Penerbitan Versi Peraturan Baru & Penjaminan Immutability (AC 2)
- **Tujuan:** Memastikan proses publish menghasilkan versi aktif yang immutable (tidak dapat diubah atau dihapus kembali).
- **Prasyarat:** Draft peraturan telah siap di editor.
- **Langkah Pengujian:**
  1. Pada modal editor draft, klik tombol **"Lanjut Terbitkan"**.
  2. Isi Tanggal Mulai Berlaku (`effective_from`) dan Catatan Perubahan (`change_summary`: *"Pembaruan peraturan tata tertib hunian 2026"*).
  3. Klik **"Konfirmasi & Terbitkan Sekarang"**.
  4. Periksa tampilan halaman utama `/rules`.
  5. Coba lakukan modifikasi atau penghapusan langsung pada versi yang telah terbit (melalui query SQL atau API PUT).
- **Hasil yang Diharapkan:**
  - Versi berubah menjadi `published` dengan badge hijau *"Versi X · Aktif / Diterbitkan"*.
  - Upaya mengubah isi atau menghapus versi/item yang telah diterbitkan ditolak dengan error database trigger (`Cannot modify content of published or superseded rule version`).

---

### RULE-04: Histori Versi Tersedia Lengkap dan Tidak Tertimpa (AC 2, AC 4)
- **Tujuan:** Memastikan saat versi baru diterbitkan, versi sebelumnya berubah menjadi `superseded` dan tetap dapat dibuka sebagai dokumen histori.
- **Prasyarat:** Minimal 1 versi peraturan (`published`) telah ada.
- **Langkah Pengujian:**
  1. Buka kembali editor draft dan tambahkan butir aturan baru.
  2. Terbitkan sebagai Versi 2.
  3. Klik tombol **"Histori Versi"** di pojok kanan atas.
  4. Periksa daftar riwayat versi yang ditampilkan.
  5. Klik tombol **"Lihat Detail"** pada Versi 1 (status `Tergantikan (Histori)`).
- **Hasil yang Diharapkan:**
  - Versi 2 berstatus `Aktif / Diterbitkan`.
  - Versi 1 berstatus `Tergantikan (Histori)` lengkap dengan tanggal terbit, publisher, dan catatan perubahan aslinya.
  - Modal detail menampilkan snapshot isi butir aturan Versi 1 secara utuh dan read-only.

---

### RULE-05: Tenant Baru Wajib Mengakui Versi Aktif Sebelum Kontrak Diaktifkan (AC 3)
- **Tujuan:** Menjamin kontrak baru tidak dapat diaktifkan jika tenant belum memberikan konfirmasi/persetujuan atas versi peraturan yang aktif.
- **Prasyarat:** Properti memiliki peraturan berstatus `published`. Kontrak baru dibuat dengan status `pending_tenant`.
- **Langkah Pengujian:**
  1. Sebagai Owner, coba ubah status kontrak langsung ke `active` tanpa melalui persetujuan tenant (`AcceptByTenant`).
  2. Periksa respons sistem.
  3. Sebagai Tenant, buka halaman peninjauan kontrak (`/contracts/:id`).
  4. Periksa kotak persetujuan: *"Saya menyetujui snapshot kontrak dan aturan properti yang berlaku"*.
  5. Centang persetujuan dan klik **"Setujui kontrak"**.
  6. Sebagai Owner, lakukan aktivasi kontrak.
- **Hasil yang Diharapkan:**
  - Upaya aktivasi kontrak sebelum adanya rule acknowledgment ditolak dengan error `ErrContractPrerequisite: tenant must acknowledge active house rules before contract activation`.
  - Saat tenant menyetujui kontrak, rekam jejak `rule_acknowledgments` tercatat otomatis dan kontrak menyimpan `rule_version_id`.
  - Aktivasi kontrak selanjutnya berhasil dieksekusi dengan sukses.

---

### RULE-06: Pencatatan Bukti Persetujuan (Acknowledgment) Secara Audit Trail (AC 3, AC 5)
- **Tujuan:** Memastikan tenant dapat mengakui peraturan aktif langsung dari menu `/rules` dan data persetujuan tersimpan lengkap.
- **Prasyarat:** Login sebagai tenant yang memiliki kontrak aktif di properti.
- **Langkah Pengujian:**
  1. Buka halaman `/rules`.
  2. Periksa banner notifikasi peringatan: *"Persetujuan Peraturan Versi X Diperlukan"*.
  3. Centang checkbox *"Saya memahami & menyetujui Versi X"*.
  4. Klik tombol **"Konfirmasi Persetujuan"**.
  5. Periksa perubahan tampilan banner.
- **Hasil yang Diharapkan:**
  - Muncul toast/banner hijau: *"Persetujuan Peraturan Versi X berhasil dicatat"*.
  - Banner beralih ke status disetujui lengkap dengan tanggal, jam, dan teks pernyataan consent.
  - Checkbox consent terkunci dan tidak dapat di-submit ganda.

---

### RULE-07: Perubahan Aturan Tidak Berlaku Retroaktif (AC 4)
- **Tujuan:** Memastikan kontrak yang terikat pada Versi 1 tidak otomatis berpindah baseline saat Owner menerbitkan Versi 2 tanpa proses penandatanganan/amendment.
- **Prasyarat:** Kontrak Tenant A terikat pada Peraturan Versi 1.
- **Langkah Pengujian:**
  1. Owner menerbitkan Peraturan Versi 2 dengan perubahan aturan atau sanksi baru.
  2. Periksa detail kontrak Tenant A di `/contracts/:id`.
  3. Periksa kolom `contracts.rule_version_id`.
  4. Tenant A membuka halaman `/rules`.
- **Hasil yang Diharapkan:**
  - Kontrak Tenant A tetap terhubung ke Versi 1 sebagai baseline hukum awal sewa.
  - Pada halaman `/rules`, Tenant A melihat versi aktif terbaru (Versi 2) dengan notifikasi pembaruan aturan untuk ditinjau dan disetujui sebagai addendum/pembaruan kesepakatan tata tertib.

---

### RULE-08: Notifikasi Terbitnya Versi Baru ke Seluruh Tenant Aktif (Dependensi EP-08)
- **Tujuan:** Memastikan saat versi baru diterbitkan, event notifikasi outbox dan notifikasi in-app dibuat otomatis untuk tenant aktif.
- **Prasyarat:** Terdapat penyewa aktif pada properti.
- **Langkah Pengujian:**
  1. Owner menerbitkan versi aturan baru di `/rules`.
  2. Buka menu notifikasi sebagai tenant (atau periksa tabel `in_app_notifications` dan `notification_outbox`).
- **Hasil yang Diharapkan:**
  - Tenant menerima in-app notification kategori `announcement`: *"Peraturan Kos Diperbarui (Versi X)"* dengan tautan langsung menuju `/rules`.
  - Baris outbox tersimpan dengan `event_type = 'rule_version_published'`.

---

### RULE-09: Tabel Audit Menampilkan Tenant, Kamar, IP Address, Device, dan Waktu (AC 5)
- **Tujuan:** Memverifikasi pengelola kos dapat memeriksa daftar lengkap tenant yang telah menyetujui aturan beserta bukti digital forensik.
- **Prasyarat:** Minimal 1 tenant telah melakukan persetujuan aturan.
- **Langkah Pengujian:**
  1. Login sebagai Owner atau Manager.
  2. Buka menu `/rules`.
  3. Klik tombol **"Audit Persetujuan"**.
  4. Periksa tabel log audit.
- **Hasil yang Diharapkan:**
  - Tabel menampilkan kolom: Nama Tenant, Nomor Kamar, Kontak (Email/HP), Waktu Persetujuan, IP Address, Device (User-Agent), dan Teks Consent.
  - Data bersifat append-only dan tidak dapat diubah maupun dihapus oleh siapapun.

---

### RULE-10: Isolasi Akses Berdasarkan Property Boundary (Property-Scoped)
- **Tujuan:** Menjamin peraturan dan audit persetujuan hanya dapat diakses oleh pihak yang berwenang pada properti yang bersangkutan.
- **Prasyarat:** Dua akun pemilik/properti terpisah (Properti Alpha dan Properti Beta).
- **Langkah Pengujian:**
  1. Login sebagai staf Properti Alpha.
  2. Coba akses endpoint `/api/rules/versions/:id` milik Properti Beta via Header `X-Property-ID: <Alpha_UUID>`.
  3. Periksa kode status respons HTTP.
- **Hasil yang Diharapkan:**
  - Permintaan ditolak dengan status 404 Not Found atau 403 Forbidden.
  - Data peraturan properti lain tidak pernah bocor lintas scope.
