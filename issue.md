# Rencana Implementasi: Laporan (Komplain) & Integrasi WhatsApp + AI (Issue #10)

Membangun fitur pengaduan (komplain) bagi penghuni kos yang interaktif, terintegrasi dengan Gemini AI untuk respons otomatis serta integrasi nyata dengan API WhatsApp (seperti Fonnte/Generic Webhook) untuk mengirimkan pesan teguran santun ke grup WhatsApp kosan.

---

## Integrasi AI & WhatsApp

### 1. Integrasi Gemini AI
- Menggunakan endpoint API Gemini: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`.
- **Peran AI**:
  - **Empathetic Response**: Memberikan balasan respons cepat ke pelapor agar merasa didengarkan dan tenang.
  - **WhatsApp Group warning**: Menulis pesan singkat, santun, tidak provokatif, dan tanpa menyebutkan nama pelapor untuk menegur di grup WhatsApp (khusus kategori Keributan / `noisy`).
- **Fallback**: Jika `GEMINI_API_KEY` tidak diatur di `.env`, sistem akan otomatis menggunakan balasan cerdas berbasis teks statis terstruktur.

### 2. Integrasi WhatsApp API (Fonnte / Generic Gateway)
- Mendukung integrasi WhatsApp nyata yang dapat dikonfigurasi melalui `.env`:
  - `WHATSAPP_API_URL`: URL API WhatsApp Gateway (contoh Fonnte: `https://api.fonnte.com/send`).
  - `WHATSAPP_API_TOKEN`: Token otentikasi API Gateway Anda.
- **Logika Pengiriman**:
  - Jika token tersedia di `.env`, backend mengirimkan HTTP POST request riil ke WhatsApp Gateway.
  - Jika token kosong, backend akan melakukan simulasi dengan mencetak log ke console terminal (`[MOCK WA SEND] Group Link/ID: %s, Message: %s`) sehingga pengujian tetap dapat dilakukan dengan mudah tanpa harus menghubungkan perangkat asli.

---

## Proposed Changes

### 1. Database

#### [NEW] [008_create_complaints.sql](file:///d:/project_yosua/lapor-kos/backend/migrations/008_create_complaints.sql)
- Menambahkan kolom `whatsapp_group_link` ke tabel `users` untuk menyimpan ID/Tautan grup WhatsApp milik owner.
- Membuat tabel `complaints` dengan struktur:
  ```sql
  CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'noisy' (keributan), 'facility' (fasilitas rusak), 'cleanliness' (kebersihan), 'security' (keamanan), 'other' (lainnya)
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processed', 'resolved'
    photo_url TEXT, -- Link lampiran foto kerusakan fasilitas
    ai_response TEXT, -- Jawaban otomatis solutif dari AI
    wa_sent BOOLEAN DEFAULT FALSE,
    wa_message TEXT, -- Pesan teguran grup WA yang digenerate AI
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

---

### 2. Backend

#### [NEW] [complaint.go](file:///d:/project_yosua/lapor-kos/backend/internal/model/complaint.go)
- Mendefinisikan struct model `Complaint` dan payload DTO.

#### [NEW] [ai_service.go](file:///d:/project_yosua/lapor-kos/backend/internal/service/ai_service.go)
- Service untuk memanggil API Gemini.
- Method:
  - `GenerateEmpathicResponse(category, title, description)`
  - `GenerateGroupWarning(description)`

#### [NEW] [whatsapp_service.go](file:///d:/project_yosua/lapor-kos/backend/internal/service/whatsapp_service.go)
- Service untuk mengintegrasikan pengiriman WhatsApp melalui HTTP Client ke Fonnte/Gateway API.

#### [NEW] [complaint_repository.go](file:///d:/project_yosua/lapor-kos/backend/internal/repository/complaint_repository.go)
- Operasi database CRUD komplain.

#### [NEW] [complaint_handler.go](file:///d:/project_yosua/lapor-kos/backend/internal/handler/complaint_handler.go)
- Mengimplementasikan HTTP handler untuk `POST /api/complaints`, `GET /api/complaints/my`, `GET /api/complaints`, `PUT /api/complaints/:id/status`, dan pembaruan tautan grup WhatsApp.

#### [MODIFY] [main.go](file:///d:/project_yosua/lapor-kos/backend/main.go)
- Registrasi handler, repository, dan konfigurasi API Client untuk AI & WhatsApp.

---

### 3. Frontend

#### [NEW] [page.tsx](file:///d:/project_yosua/lapor-kos/frontend/src/app/(dashboard)/complaints/page.tsx)
- **Tampilan Penyewa (Tenant)**:
  - Kategori Card Selector dengan ikon menarik.
  - Upload Foto dengan *live preview* otomatis di dalam kontainer yang seragam.
  - Tampilan balon chat interaktif dari asisten AI setelah sukses submit.
  - Histori komplain berstatus warna.
- **Tampilan Pemilik (Owner)**:
  - Ringkasan metrik statistik aduan.
  - Modal detail aduan (foto terlampir, status WA, teks teguran, dll).
  - Quick action status dan konfigurasi tautan WhatsApp grup kosan.

---

## Verification Plan

### Manual Verification
1. **Atur Grup WhatsApp**: Login Owner, atur link grup WA ke tautan tes.
2. **Uji Real WhatsApp (Opsional)**: Set `WHATSAPP_API_TOKEN` & `WHATSAPP_API_URL` di `.env` backend, kirim komplain keributan sebagai Tenant, lalu periksa apakah pesan terkirim riil ke grup WA target.
3. **Uji AI Terintegrasi**: Set `GEMINI_API_KEY` di `.env`, kirim komplain, dan verifikasi teks respon & teguran ter-generate secara cerdas oleh AI.
