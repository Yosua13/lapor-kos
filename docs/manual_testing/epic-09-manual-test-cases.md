# Manual Test Cases: [EPIC 09] Izin Tamu dan Kerabat Menginap

Dokumen ini menyediakan skenario uji manual end-to-end untuk memvalidasi alur pengajuan izin tamu, validasi hunian aktif, kepatuhan batas akhir kontrak sewa, peraturan kos & menginap, audit trail keputusan (approval/reject/request change), check-in/out, deteksi overstay, pass tamu digital, dan kebijakan retensi data minimum.

---

## Ringkasan Skenario

| Test ID | Skenario Uji | Kriteria Penerimaan Terkait | Peran Pengguna |
| :--- | :--- | :--- | :--- |
| **GUEST-01** | Pengajuan Izin Tamu Hanya untuk Hunian Aktif | **AC 1** | Tenant Tanpa Kontrak Aktif |
| **GUEST-02** | Pengajuan Izin Tamu Berhasil oleh Tenant Aktif | **AC 1** | Tenant dengan Kontrak Aktif |
| **GUEST-03** | Penolakan Pengajuan yang Melewati Batas Akhir Kontrak Sewa | **AC 2** | Tenant Aktif |
| **GUEST-04** | Validasi Aturan Jam Kunjungan Non-Menginap (Maksimal 22:00 WIB) | **AC 2** | Tenant Aktif |
| **GUEST-05** | Validasi Durasi Maksimal Menginap (Maksimal 3 Malam Berturut-turut) | **AC 2** | Tenant Aktif |
| **GUEST-06** | Peninjauan & Persetujuan (Approve) Izin Tamu Beserta Pass Digital | **AC 3** | Owner / Manager Properti |
| **GUEST-07** | Penolakan Izin Tamu (Reject) dengan Alasan Wajib Dicatat | **AC 3** | Owner / Manager Properti |
| **GUEST-08** | Permintaan Perubahan (Request Change) dengan Catatan Wajib | **AC 3** | Owner / Manager Properti |
| **GUEST-09** | Pembatasan Hak Akses Data Tamu Antar-Role & Property-Scoped | **AC 4** | Tenant A vs Tenant B vs Viewer |
| **GUEST-10** | Kebijakan Retensi Pendek & Anonimisasi Data PII Tamu | **AC 4** | Owner / Manager Properti |
| **GUEST-11** | Filter Riwayat Tamu Berdasarkan Properti, Tanggal, dan Status | **AC 5** | Staf / Owner |
| **GUEST-12** | Pencatatan Check-In dan Check-Out Tamu di Lokasi | Operasional | Petugas Keamanan / Staf |
| **GUEST-13** | Peringatan Overstay Otomatis Saat Tamu Melebihi Batas Waktu | Operasional | Petugas Keamanan / Staf / Owner |
| **GUEST-14** | Verifikasi Publik Visitor Pass Digital Tanpa Login | Operasional / Keamanan | Petugas Gerbang / Tamu |

---

## Rincian Test Cases

### GUEST-01: Pengajuan Izin Tamu Hanya untuk Hunian Aktif (AC 1)
- **Tujuan:** Memastikan pengguna yang tidak memiliki hunian/kontrak aktif tidak dapat mengajukan izin tamu.
- **Prasyarat:** Akun pengguna tenant yang belum memiliki kontrak atau kontraknya berstatus selain `active` (`ended`, `terminated`).
- **Langkah Pengujian:**
  1. Login ke aplikasi sebagai tenant tanpa kontrak aktif.
  2. Buka menu **Izin Tamu** (`/guest-permits`).
  3. Klik tombol **"Ajukan Izin Tamu"**.
  4. Isi nama tamu: `"Dimas Prayoga"`, hubungan: `"Teman"`, waktu mulai & selesai.
  5. Klik tombol **"Kirim Pengajuan Izin"**.
- **Hasil yang Diharapkan:**
  - Sistem menolak pengajuan dengan pesan kesalahan: `"Tenant hanya dapat mengajukan izin tamu untuk hunian/kontrak aktif miliknya. Tidak ditemukan kontrak aktif."`
  - Tidak ada data permit yang dibuat di basis data.

---

### GUEST-02: Pengajuan Izin Tamu Berhasil oleh Tenant Aktif (AC 1)
- **Tujuan:** Memverifikasi tenant dengan hunian aktif dapat mengajukan izin kunjungan tamu dengan sukses.
- **Prasyarat:** Akun tenant dengan kontrak berstatus `active`.
- **Langkah Pengujian:**
  1. Login sebagai tenant aktif.
  2. Buka menu `/guest-permits`, klik **"Ajukan Izin Tamu"**.
  3. Isi form:
     - Nama Tamu: `"Siti Rahma"`
     - Hubungan: `"Keluarga"`
     - Tujuan: `"Menengok dan mengantar keperluan kuliah"`
     - Menginap: `Tidak`
     - Waktu Mulai: Hari ini pukul 14:00
     - Waktu Selesai: Hari ini pukul 18:00
     - Jumlah Tamu: `1`
     - Kendaraan: `Sepeda Motor` (`B 4567 XYZ`)
     - 4 Digit Akhir Identitas: `8901`
  4. Klik **"Kirim Pengajuan Izin"**.
- **Hasil yang Diharapkan:**
  - Muncul notifikasi sukses: `"Permintaan izin tamu berhasil diajukan dan sedang menunggu persetujuan pengelola."`
  - Izin tamu muncul di tabel dengan badge berstatus `"Menunggu Persetujuan"` (`pending`).
  - Tercipta rekaman audit di tabel `visitor_permit_events` dengan `event_type = 'submitted'`.
  - Tercipta pesan notifikasi di `notification_outbox` untuk pengelola kos.

---

### GUEST-03: Penolakan Pengajuan yang Melewati Batas Akhir Kontrak Sewa (AC 2)
- **Tujuan:** Memastikan permohonan kunjungan atau menginap yang jadwalnya melampaui tanggal berakhirnya kontrak sewa ditolak tegas.
- **Prasyarat:** Tenant aktif dengan tanggal akhir kontrak tertentu (misal: 31 Desember 2026).
- **Langkah Pengujian:**
  1. Login sebagai tenant aktif.
  2. Buka form **Ajukan Izin Tamu**.
  3. Isi data tamu dengan waktu kedatangan atau kepulangan di tahun berikutnya (misal: 05 Januari 2027), melampaui masa aktif kontrak.
  4. Klik **"Kirim Pengajuan Izin"**.
- **Hasil yang Diharapkan:**
  - Sistem menampilkan pesan penolakan: `"Waktu izin tamu melewati batas akhir kontrak sewa Anda (31 Des 2026). Pengajuan ditolak."`
  - Request tidak tersimpan di basis data.

---

### GUEST-04: Validasi Aturan Jam Kunjungan Non-Menginap (AC 2)
- **Tujuan:** Memastikan tamu non-menginap tidak diizinkan berkunjung melewati batas jam malam (22:00 WIB) sesuai House Rules kos.
- **Langkah Pengujian:**
  1. Buka form **Ajukan Izin Tamu** dengan opsi Menginap: `Nonaktif` (tidak menginap).
  2. Tentukan waktu mulai: Hari ini pukul 19:00.
  3. Tentukan waktu selesai: Hari ini pukul 23:30 (melewati pukul 22:00 WIB).
  4. Klik **"Kirim Pengajuan Izin"**.
- **Hasil yang Diharapkan:**
  - Sistem menampilkan peringatan aturan: `"Kunjungan tamu tanpa menginap maksimal hingga pukul 22:00 WIB di hari yang sama. Silakan pilih opsi 'Menginap' jika tamu bermaksud lewat pukul 22:00."`

---

### GUEST-05: Validasi Durasi Maksimal Menginap (AC 2)
- **Tujuan:** Memvalidasi pembatasan durasi menginap berturut-turut (maksimal 3 hari / 72 jam) sesuai peraturan kos.
- **Langkah Pengujian:**
  1. Buka form **Ajukan Izin Tamu**.
  2. Aktifkan opsi **"Tamu Akan Menginap"**.
  3. Masukkan waktu mulai: `20 Oktober 2026 14:00`.
  4. Masukkan waktu selesai: `25 Oktober 2026 14:00` (5 hari berturut-turut).
  5. Klik **"Kirim Pengajuan Izin"**.
- **Hasil yang Diharapkan:**
  - Sistem menolak pengajuan dengan pesan: `"Durasi menginap tamu melebihi batas maksimal 3 hari berturut-turut sesuai peraturan kos."`

---

### GUEST-06: Peninjauan & Persetujuan (Approve) Izin Tamu Beserta Pass Digital (AC 3)
- **Tujuan:** Memverifikasi alur persetujuan oleh Owner/Manager, pencatatan aktor & waktu, serta penerbitan token visitor pass.
- **Langkah Pengujian:**
  1. Login sebagai Owner atau Manager properti.
  2. Buka menu **Izin Tamu & Pengunjung** (`/guest-permits`).
  3. Temukan permit berstatus `"Menunggu"`.
  4. Klik tombol **"Tinjau"**.
  5. Pada modal peninjauan, pilih opsi **"Setujui"**.
  6. Masukkan catatan: `"Disetujui. Harap titipkan kartu identitas asli di pos keamanan saat tiba."`
  7. Klik **"Simpan Keputusan"**.
- **Hasil yang Diharapkan:**
  - Status permit berubah menjadi `"Disetujui"` (`approved`).
  - Sistem menghasilkan `pass_token` unik dengan format `VP-XXXXXX`.
  - Kolom `reviewed_by`, `reviewed_at`, dan `review_notes` terisi lengkap.
  - Event `approved` tercatat di `visitor_permit_events`.
  - Notifikasi terkirim ke in-app inbox tenant terkait status persetujuan.
  - Tombol **"Lihat Pass Digital"** aktif dan menampilkan kartu pass digital lengkap dengan kode QR.

---

### GUEST-07: Penolakan Izin Tamu (Reject) dengan Alasan Wajib Dicatat (AC 3)
- **Tujuan:** Memverifikasi penolakan permohonan izin tamu dan penegakan input alasan penolakan.
- **Langkah Pengujian:**
  1. Login sebagai Owner atau Manager properti.
  2. Temukan permit berstatus `"Menunggu"`, klik **"Tinjau"**.
  3. Pilih opsi **"Tolak"**.
  4. Kosongkan kolom alasan keputusan, lalu klik **"Simpan Keputusan"**.
  5. Perhatikan sistem mencegah submit jika alasan kosong.
  6. Masukkan alasan: `"Kapasitas parkir kendaraan kos sedang penuh pada jadwal tersebut."`
  7. Klik **"Simpan Keputusan"**.
- **Hasil yang Diharapkan:**
  - Status permit diperbarui menjadi `"Ditolak"` (`rejected`).
  - Alasan penolakan tersimpan di kolom `review_notes` dan rekaman audit `visitor_permit_events`.
  - Notifikasi penolakan masuk ke akun tenant.

---

### GUEST-08: Permintaan Perubahan (Request Change) dengan Catatan Wajib (AC 3)
- **Tujuan:** Memverifikasi alur permintaan revisi data izin tamu oleh pengelola kos.
- **Langkah Pengujian:**
  1. Buka modal peninjauan untuk permit yang berstatus `"Menunggu"`.
  2. Pilih opsi **"Minta Revisi"**.
  3. Masukkan instruksi: `"Mohon lengkapi 4 digit terakhir nomor identitas KTP tamu untuk keperluan akses pintu gerbang."`
  4. Klik **"Simpan Keputusan"**.
- **Hasil yang Diharapkan:**
  - Status permit berubah menjadi `"Perlu Revisi"` (`change_requested`).
  - Catatan permintaan revisi tersimpan pada timeline audit.

---

### GUEST-09: Pembatasan Hak Akses Data Tamu Antar-Role & Property-Scoped (AC 4)
- **Tujuan:** Memastikan data tamu tersekat secara ketat: tenant hanya dapat melihat tamu miliknya, dan staf hanya dapat melihat data tamu properti yang ditugaskan.
- **Langkah Pengujian:**
  1. Login sebagai Tenant A di Kamar 101. Buka `/guest-permits`.
  2. Pastikan Tenant A **hanya melihat** permohonan izin tamu yang diajukannya sendiri.
  3. Coba panggil API `/api/visitor-permits/my/:id` menggunakan ID izin tamu milik Tenant B.
  4. Buka aplikasi sebagai Petugas Maintenance / Security.
  5. Buka `/guest-permits` dengan header `X-Property-ID` properti yang berwenang.
- **Hasil yang Diharapkan:**
  - Tenant A menerima respons `404 Not Found` saat mencoba mengakses izin tamu Tenant B.
  - Staf hanya dapat melihat daftar tamu pada properti aktif mereka.

---

### GUEST-10: Kebijakan Retensi Pendek & Anonimisasi Data PII Tamu (AC 4)
- **Tujuan:** Memvalidasi pembersihan dan anonimisasi data identitas sensitif tamu (PII) untuk data historis lama.
- **Langkah Pengujian:**
  1. Login sebagai Owner atau Manager properti.
  2. Pada halaman `/guest-permits`, klik tombol **"Pembersihan Retensi (AC 4)"**.
  3. Pilih masa retensi (misal: 30 hari).
  4. Klik **"Terapkan Anonimisasi Sekarang"**.
  5. Periksa catatan data tamu lama yang telah berstatus `completed`, `rejected`, atau `cancelled` di database:
     ```sql
     SELECT id, guest_name, guest_phone, guest_id_card_last4, vehicle_number, is_anonymized, anonymized_at
     FROM visitor_permits
     WHERE is_anonymized = TRUE;
     ```
- **Hasil yang Diharapkan:**
  - Kolom `guest_name` berubah menjadi `"Tamu (Dianonimkan)"`.
  - Kolom `guest_phone`, `guest_id_card_last4`, dan `vehicle_number` di-`NULL`-kan.
  - Nilai `is_anonymized` menjadi `TRUE` dan `anonymized_at` mencatat timestamp eksekusi.
  - Rekaman audit `visitor_permit_events` mencatat event `anonymized` dari sistem.
  - Statistik agregat jumlah kunjungan dan kepatuhan operasional tetap utuh.

---

### GUEST-11: Filter Riwayat Tamu Berdasarkan Properti, Tanggal, dan Status (AC 5)
- **Tujuan:** Memverifikasi fleksibilitas filtering riwayat tamu pada dashboard pengelola.
- **Langkah Pengujian:**
  1. Buka halaman `/guest-permits` sebagai staf/owner.
  2. Klik tab filter status:
     - `Semua Status`
     - `Menunggu`
     - `Aktif di Lokasi`
     - `Disetujui`
     - `Selesai`
  3. Pilih rentang tanggal kunjungan pada kolom Tanggal Mulai dan Tanggal Selesai.
  4. Centang filter **"Hanya Yang Menginap"**.
  5. Masukkan kata kunci pencarian pada input pencarian (nama tamu, plat nomor kendaraan, atau nomor kamar).
- **Hasil yang Diharapkan:**
  - Tabel memuat daftar izin tamu yang cocok secara presisi dengan kombinasi filter yang diterapkan.
  - Indikator total counter menyesuaikan dengan hasil filter query.

---

### GUEST-12: Pencatatan Check-In dan Check-Out Tamu di Lokasi (Operasional)
- **Tujuan:** Memverifikasi pencatatan kedatangan dan kepulangan tamu oleh petugas pos/staf.
- **Langkah Pengujian:**
  1. Buka halaman `/guest-permits` sebagai Staf / Petugas Keamanan.
  2. Pada baris tamu berstatus `"Disetujui"`, klik tombol **"Check-In"**.
  3. Konfirmasi dialog check-in.
  4. Perhatikan status permit langsung berubah menjadi `"Tamu di Lokasi (Aktif)"` dengan penanda waktu tiba.
  5. Saat tamu selesai berkunjung, klik tombol **"Check-Out"**.
  6. Konfirmasi dialog check-out.
- **Hasil yang Diharapkan:**
  - Saat check-in: status menjadi `active`, `checked_in_at` dan `checked_in_by` terisi, event `checked_in` dicatat.
  - Saat check-out: status menjadi `completed`, `checked_out_at` dan `checked_out_by` terisi, event `checked_out` dicatat.

---

### GUEST-13: Peringatan Overstay Otomatis Saat Tamu Melebihi Batas Waktu (Operasional)
- **Tujuan:** Memastikan sistem menandai dan memberikan alert visual apabila tamu masih berstatus aktif melewati waktu kepulangan yang diizinkan.
- **Langkah Pengujian:**
  1. Buat permit yang waktu selesainya (`end_time`) telah lewat, namun belum di-check-out (`status = 'active'`).
  2. Buka dashboard `/guest-permits`.
  3. Perhatikan metric card **"Overstay Alert"** di bagian atas.
  4. Perhatikan badge status pada baris permit tersebut di tabel.
- **Hasil yang Diharapkan:**
  - Metric card "Overstay Alert" bertambah dan berkedip/menyala (highlight).
  - Badge pada tabel menampilkan status merah menyala: `"Overstay di Lokasi"`.

---

### GUEST-14: Verifikasi Publik Visitor Pass Digital Tanpa Login (Operasional / Keamanan)
- **Tujuan:** Memastikan petugas gerbang atau tamu dapat memverifikasi keabsahan pass tamu via QR link publik tanpa memerlukan akun login.
- **Langkah Pengujian:**
  1. Pada permit yang telah disetujui, buka modal **Lihat Pass Digital**.
  2. Klik **"Salin Tautan Verifikasi"** atau klik **"Buka Halaman Verifikasi Publik"**.
  3. Buka URL tersebut (`/visitor-pass/VP-XXXXXX`) pada browser baru atau mode penyamaran (incognito) tanpa login.
- **Hasil yang Diharapkan:**
  - Halaman memuat tampilan digital gate pass yang rapi dan responsif.
  - Menampilkan banner hijau `"PASS VALID & DISETUJUI"`, nama kos, nomor kamar, nama inisial tamu tersanitasi (misal: `"B*** S***"`), masa berlaku, dan relasi.
  - Data pribadi sensitif seperti nomor telepon dan nomor identitas penuh **tidak diekspos** ke publik.

---

## Ringkasan Hasil Validasi Kriteria Penerimaan

| Kriteria Penerimaan (AC) | Status Uji | Catatan Implementasi |
| :--- | :---: | :--- |
| **AC 1: Tenant hanya dapat mengajukan izin untuk active occupancy miliknya** | **LULUS** | Divalidasi via kontrak aktif (`status = 'active'`) pada repository dan handler. Tenant tanpa hunian aktif ditolak langsung. |
| **AC 2: Request yang melewati akhir kontrak atau melanggar aturan wajib ditolak atau ditandai jelas** | **LULUS** | Validasi tanggal terhadap `contract.end_date`, batas jam malam 22:00 untuk non-menginap, serta maksimal 3 malam berturut-turut untuk menginap. |
| **AC 3: Setiap keputusan menyimpan actor, waktu, status, dan alasan** | **LULUS** | Tersimpan di tabel audit append-only `visitor_permit_events` dan kolom `reviewed_by`, `reviewed_at`, `review_notes`. |
| **AC 4: Data tamu hanya dapat diakses role terkait dan mengikuti masa retensi pendek** | **LULUS** | Pembatasan akses berbasis tenant dan membership properti; fitur anonimisasi otomatis/manual membersihkan PII setelah 30 hari. |
| **AC 5: Riwayat dapat difilter berdasarkan property, tanggal, dan status** | **LULUS** | Didukung query params filter properti, status, rentang tanggal, search, dan pagination pada backend serta UI filter tabs. |
