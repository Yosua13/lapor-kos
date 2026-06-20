# Analisis & Rencana Implementasi: Syarat & Ketentuan dan Kebijakan Privasi (UU PDP Compliance)

Dokumen ini disusun sebagai elaborasi dan perencanaan pada [issue.md](file:///d:/project_yosua/lapor-kos/issue.md) mengenai implementasi Syarat & Ketentuan (Terms of Service) dan Kebijakan Privasi (Privacy Policy) untuk aplikasi **Lapor Kos**, sesuai dengan catatan pada [noted.md](file:///d:/project_yosua/lapor-kos/noted.md) nomor 1.

---

## 1. Analisis Aliran Data & Informasi Sensitif dalam Aplikasi
Aplikasi **Lapor Kos** memproses berbagai macam data pribadi yang bersifat sensitif dan sangat dilindungi oleh hukum (khususnya **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi / UU PDP**). Berikut adalah rincian data tersebut:

| Kategori Data | Jenis Data | Fitur Terkait | Risiko & Kebutuhan Pelindungan |
| :--- | :--- | :--- | :--- |
| **Identitas Resmi** | Foto/Scan KTP, Foto Selfie Wajah | Tambah Penghuni (`/rooms/add` & `/rooms` modal) | **Sangat Sensitif**. Risiko pencurian identitas, penyalahgunaan foto selfie untuk pinjaman online ilegal, atau kebocoran data KTP. Wajib diatur hak akses dan masa penyimpanannya. |
| **Kontak Darurat** | Nama, Hubungan, & No HP Kerabat | Tambah Penghuni (`/rooms/add`) | Melibatkan data pihak ketiga yang tidak mendaftar langsung. Harus dinyatakan bahwa data ini hanya digunakan jika terjadi kondisi darurat penyewa. |
| **Data Keuangan** | Nominal Sewa, Tagihan Listrik/Air, Bukti Transfer Pembayaran | Tagihan & Pembayaran (`/payments`), Kwitansi Digital | Riwayat transaksi dan bukti transfer perbankan/e-wallet. Kebutuhan untuk mencegah manipulasi bukti transfer dan perlindungan informasi rekening. |
| **Informasi Pekerjaan** | Pekerjaan, Status, & Dokumen Pendukung (KK, dll) | Dokumen Tambahan (`/rooms/add`)
| **Identitas Akun** | Nama, Email, Password, No HP | Registrasi (`/register`) & Login (`/login`) | Kredensial masuk aplikasi. |

---

## 2. Elaborasi Kebijakan (Policy Drafting Guidelines)

Untuk melindungi pengguna (Penghuni & Pemilik Kos) serta Lapor Kos sebagai platform, dokumen hukum wajib merinci poin-poin berikut:

### A. Kebijakan Privasi (Privacy Policy)
1. **Dasar Hukum**: Kepatuhan terhadap UU PDP No. 27 Tahun 2022.
2. **Tujuan Pengumpulan Data**:
   - Memverifikasi identitas penyewa demi keamanan bersama di lingkungan kos.
   - Pembuatan draf kontrak sewa menyewa yang sah secara hukum perdata.
   - Pencatatan transaksi pembayaran sewa dan utilitas.
3. **Penyimpanan & Keamanan**:
   - File KTP, Selfie, dan Bukti Transfer disimpan di Supabase Storage yang aman.
   - Dokumen dienkripsi dalam penyimpanan dan hanya dapat diakses oleh Pemilik Kos terkait serta admin sistem.
4. **Pembagian Data ke Pihak Ketiga**: Data **tidak akan pernah** dijual atau dibagikan kepada pihak ketiga untuk tujuan marketing atau komersial tanpa persetujuan eksplisit.
5. **Masa Retensi & Penghapusan**: Data KTP dan Selfie dapat diminta untuk dihapus 30 hari setelah masa kontrak sewa berakhir secara resmi.

### B. Syarat & Ketentuan (Terms of Service)
1. **Keabsahan Data**: Pengguna bertanggung jawab penuh atas keaslian KTP, data diri, dan bukti transfer pembayaran. Tindakan mengunggah KTP palsu atau bukti transfer palsu dapat dilaporkan ke pihak berwajib.
2. **Kewajiban Pembayaran**: Detail jatuh tempo pembayaran bulanan dan denda (jika diatur).
3. **Aturan Menginap & Izin**: Kebijakan pelaporan kerabat/teman yang menginap melalui fitur izin/komplain demi ketertiban lingkungan kos.

---

## 3. Rencana Teknis Implementasi Frontend

Saat ini, tautan `/terms` dan `/privacy` di halaman register masih kosong (memicu 404). Berikut adalah langkah-langkah implementasinya:

### Langkah 1: Pembuatan Halaman Syarat & Ketentuan
- **Rute Baru**: `src/app/(auth)/terms/page.tsx` (atau di luar grup auth agar bisa diakses publik: `src/app/terms/page.tsx`)
- **Konten**: Halaman statis berdesain premium (menggunakan komponen typography Lapor Kos, skema warna Navy & Teal, tombol kembali ke registrasi).

### Langkah 2: Pembuatan Halaman Kebijakan Privasi
- **Rute Baru**: `src/app/privacy/page.tsx`
- **Konten**: Rincian kebijakan penanganan KTP, Selfie, enkripsi data, hak-hak pemilik data sesuai UU PDP.

### Langkah 3: Penambahan Checkbox Persetujuan di Form Registrasi
Sebelum mengirimkan form pendaftaran, pengguna wajib mencentang persetujuan Syarat & Ketentuan serta Kebijakan Privasi.
- **Modifikasi**: `src/app/(auth)/register/page.tsx`
- **Perubahan**:
  - Menambahkan checkbox wajib (`termsAccepted`) ke dalam skema Zod `registerSchema`.
  - Menampilkan checkbox di bawah form password sebelum tombol submit.

---

## 4. Draf Dokumen Hukum (Hanya Struktur Utama)

### Draf Kebijakan Privasi (Privacy Policy)
1. **Pendahuluan**: Lapor Kos berkomitmen melindungi data pribadi Anda selaku Penghuni atau Pemilik Kos.
2. **Data yang Kami Kumpulkan**: Data pendaftaran, data profil (KTP, Selfie), data transaksi, berkas darurat.
3. **Penggunaan Data**: Hanya untuk verifikasi kos, komunikasi tagihan, dan pembuatan kwitansi/kontrak.
4. **Hak Pemilik Data**: Hak untuk mengakses, memperbaiki, dan meminta penghapusan data setelah masa sewa berakhir.

### Draf Syarat & Ketentuan (Terms & Conditions)
1. **Penggunaan Layanan**: Akun tidak boleh dipindahtangankan.
2. **Verifikasi Kamar & Penghuni**: Pemilik kos berhak memverifikasi keaslian dokumen KTP/Selfie.
3. **Pembayaran & Denda**: Tagihan bulanan harus dilunasi sebelum tanggal jatuh tempo yang disepakati.

---
*Perencanaan ini siap diimplementasikan. Silakan konfirmasi untuk membuat halaman `/terms` dan `/privacy` secara langsung di Next.js.*
