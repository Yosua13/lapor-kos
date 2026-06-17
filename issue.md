Searched for "owner_id"
Viewed 003_add_rooms_and_tenants.sql:1-22

Berdasarkan struktur SQL yang Anda lampirkan dan kode *backend* yang sudah kita bangun, saya telah melakukan analisis menyeluruh terkait arsitektur dan normalisasi databasenya. 

Berikut adalah temuan, kolom yang repetitif, serta saran perbaikannya dari segi efektivitas dan normalisasi:

### 🚨 1. Kelemahan Fatal: Tidak ada `owner_id` di tabel `Rooms`
- **Analisis:** Tabel `rooms` saat ini berdiri sendiri tanpa adanya referensi kepemilikan. Kolom `owner_id` memang ada di tabel `contracts` dan `complaints`, namun bayangkan skenario ini: *Pemilik A baru saja menambahkan kamar kosong (available)*. Karena belum ada penghuni/kontrak, sistem tidak akan tahu kamar tersebut milik siapa.
- **Saran:** Segera tambahkan kolom `owner_id (UUID)` sebagai *foreign key* di tabel `rooms` yang merujuk ke tabel `users`.

### 🔄 2. Tabel `Users`: Terlalu Banyak Beban (*Overloaded Table*)
- **Analisis:** Tabel `users` saat ini menampung dua *role* yang bertolak belakang fungsinya, yaitu Pemilik (*owner*) dan Anak Kos (*tenant*).
  - Kolom `whatsapp_group_link` hanya berguna untuk *owner*.
  - Kolom `ktp_url` dan `selfie_url` hanya berguna untuk *tenant*.
- **Saran:** Untuk aplikasi skala kecil/menengah ini disebut pola *Single Table Inheritance* dan masih dapat ditoleransi. Namun, untuk **normalisasi sejati**, Anda sebaiknya memisahkannya menjadi 3 tabel:
  - `users`: (id, email, password, role)
  - `owner_profiles`: (user_id, name, phone, whatsapp_group_link, bank_details)
  - `tenant_profiles`: (user_id, name, phone, ktp_url, selfie_url, emergency_contact)

### 📊 3. Tabel `Contracts` vs `Payments`: Apakah Redundan?
- **Analisis:** Di tabel `contracts` ada tagihan (`monthly_rent`, `electricity_bill`, dll), lalu di tabel `payments` juga ada (`amount_rent`, `amount_electricity`, dll).
- **Kesimpulan:** Ini **BUKAN** redudansi yang buruk, melainkan **Praktik Historis yang Benar**. Tabel `contracts` menyimpan "harga default" atau kesepakatan awal, sedangkan tabel `payments` menyimpan "tagihan aktual" per bulan. Jika bulan depan biaya air naik, Anda cukup mengubahnya di tagihan bulan tersebut tanpa merusak kesepakatan kontrak awal.
- **Kolom Kurang Efektif:** Kolom `total_price` di `contracts` sebenarnya adalah hasil kalkulasi (`monthly_rent * rental_duration`). Secara teori normalisasi, ini bisa dihapus karena bisa dihitung langsung menggunakan operasi matematika saat *query*. Namun, menyimpannya di DB (*denormalization*) berguna jika Anda butuh *query* pelaporan/dashboard yang cepat tanpa harus selalu menjumlahkan (*sum*) data.

### 🛋️ 4. Tabel `Rooms`: Kolom `description` (Fasilitas)
- **Analisis:** Saat ini Anda menyimpan fasilitas sebagai teks koma, contoh: `"AC, Lemari, Kasur"`.
- **Kesimpulan:** Jika aplikasi Anda kelak memiliki fitur **Filter Pencarian** (*"Cari kos yang punya kamar mandi dalam"*), maka menyimpan dengan koma sangat memberatkan performa pencarian database (*full-text scan*).
- **Saran Normalisasi:** Hapus kolom `description` dan buatkan relasi *Many-to-Many*:
  - Tabel `facilities` (id, name, icon)
  - Tabel `room_facilities` (room_id, facility_id)

### ✂️ Kesimpulan Rekomendasi Eksekusi
Jika Anda ingin menerapkan perbaikan tercepat yang paling **krusial**, fokuslah pada:
1. Menambahkan `owner_id` pada tabel `rooms` agar kamar tidak salah kepemilikan.
2. Menghapus kolom perhitungan seperti `total_price` di `contracts` jika dirasa tidak terlalu dibutuhkan secara persisten.

Apakah Anda ingin saya membantu mengimplementasikan penambahan **`owner_id` pada tabel `rooms`** sekarang juga, karena ini merupakan bug arsitektur yang cukup fatal untuk fitur-fitur selanjutnya?