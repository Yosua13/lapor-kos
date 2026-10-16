# Manual Test Cases: ARCH-03 RabbitMQ Event-Driven Messaging

Dokumen ini memuat panduan pengujian manual dan verifikasi operasional untuk arsitektur *event-driven messaging* berbasis RabbitMQ: Decoupled Worker Runtime, Outbox Publisher, Queue Consumers (WhatsApp, Email, Contract PDF, Report CSV, Gemini AI Triage), serta mekanisme Dead Letter Queue (DLQ) dengan exponential retry.

---

## Ringkasan Skenario Uji

| Test ID | Judul Skenario | Prioritas | Tipe | Komponen Terkait |
|---|---|---|---|---|
| **QUEUE-01** | Notifikasi Asinkron WhatsApp & Email via RabbitMQ Topic Exchange | P0 | Functional & Perf | `PublishNotificationEvent`, `ConsumeWhatsAppMessages`, `ConsumeEmailMessages` |
| **QUEUE-02** | Zero Message Loss: Exponential Retry & Pengalihan ke Dead Letter Queue (DLQ) | P0 | Reliability & Fault Tolerance | `kos.dlx`, `q.dead_letter`, NACK with x-death header |
| **QUEUE-03** | Heavy Job Asinkron: Kompilasi PDF Kontrak Digital | P1 | Async Processing | `PublishDocumentJob`, `ConsumeContractPDFJobs`, `PDFService` |
| **QUEUE-04** | Heavy Job Asinkron: Ekspor CSV Laporan Finansial Volume Besar | P1 | Async Processing | `PublishDocumentJob`, `ConsumeReportExportJobs`, `FinanceRepository` |
| **QUEUE-05** | Heavy Job Asinkron: Auto-Triage & Klasifikasi Komplain Gemini AI | P1 | Performance & AI | `PublishAITriageJob`, `ConsumeAITriageJobs`, `AIService` |
| **QUEUE-06** | Graceful Shutdown Worker Runtime (`cmd/worker`) saat Memproses Pesan | P0 | Resilience | `cmd/worker/main.go`, `sync.WaitGroup`, Signal Handling |

---

## QUEUE-01: Notifikasi Asinkron WhatsApp & Email via RabbitMQ Topic Exchange

### Tujuan
Memverifikasi bahwa penerbitan invoice atau trigger notifikasi tidak lagi memblokir request HTTP ataupun menunggu polling interval 15 detik pada database cron, melainkan dipublikasikan ke topic exchange `kos.events.topic` dan langsung dieksekusi oleh worker WhatsApp/Email dalam <100ms.

### Langkah Pengujian
1. Pastikan container RabbitMQ dan database aktif:
   ```bash
   docker-compose up -d rabbitmq postgres redis
   ```
2. Jalankan runtime worker di terminal terpisah:
   ```bash
   go run ./cmd/worker
   ```
   - **Hasil Diharapkan**: Log mencatat `"RabbitMQ topology declared successfully"`, `"WhatsApp consumer listening on q.notification.whatsapp"`, `"Email consumer listening on q.notification.email"`, dan `"Worker runtime successfully running"`.
3. Jalankan backend API di terminal lain:
   ```bash
   go run ./cmd/api
   ```
4. Panggil endpoint pembuatan notifikasi / verifikasi pembayaran:
   ```bash
   POST /api/billing/invoices/:id/verify
   Authorization: Bearer <TOKEN_OWNER>
   ```
5. Amati latensi HTTP dan terminal worker.
   - **Hasil Diharapkan**:
     - Endpoint HTTP merespons `200 OK` dalam kurun waktu cepat (<100ms) tanpa jeda pengiriman email/WA.
     - Terminal worker seketika mencatat:
       `[Notification Worker] Processing WhatsApp notification for recipient: 08123456789 (template: payment_verified)`
       `[Notification Worker] Successfully delivered WhatsApp message`
     - Antrean `q.notification.whatsapp` di RabbitMQ Management Dashboard (`http://localhost:15672`) kembali menjadi 0 (pesan di-ACK).

---

## QUEUE-02: Zero Message Loss: Exponential Retry & Pengalihan ke Dead Letter Queue (DLQ)

### Tujuan
Memverifikasi bahwa jika vendor pihak ketiga (Fonnte/WhatsApp API atau SMTP Server) mengalami kegagalan/timeout, pesan tidak hilang (*zero message loss*), melainkan dicoba kembali (*exponential backoff retry*), dan setelah 3 kali gagal otomatis dialihkan ke antrean `q.dead_letter` dengan status NACK requeue=false.

### Langkah Pengujian
1. Konfigurasikan credentials vendor email / WhatsApp dengan parameter invalid atau putuskan koneksi internet ke vendor.
2. Kirim notifikasi event ke queue `q.notification.whatsapp`.
3. Pantau log pada terminal worker:
   - **Percobaan 1**: Worker mencatat kegagalan kirim:
     `[Notification Worker] Retrying WhatsApp message (attempt 1/3) after backoff 1s...`
   - **Percobaan 2**: Worker menunggu 2 detik lalu mencoba kembali:
     `[Notification Worker] Retrying WhatsApp message (attempt 2/3) after backoff 2s...`
   - **Percobaan 3**: Worker menunggu 4 detik lalu mencoba kembali:
     `[Notification Worker] Retrying WhatsApp message (attempt 3/3) after backoff 4s...`
   - **Batas Maksimal**:
     `[Notification Worker] Max retries reached for WhatsApp message. Rejecting to DLQ (kos.dlx -> q.dead_letter)`
4. Buka RabbitMQ Management UI (`http://localhost:15672/#/queues`) dan periksa antrean `q.dead_letter`:
   - **Hasil Diharapkan**:
     - Pesan masuk ke dalam `q.dead_letter`.
     - Payload pesan tetap utuh (*payload integrity*), lengkap dengan metadata error pada header `x-death`.
     - Tidak ada data yang hilang dari sistem.

---

## QUEUE-03: Heavy Job Asinkron: Kompilasi PDF Kontrak Digital

### Tujuan
Memverifikasi bahwa kompilasi PDF kontrak kamar kos berukuran besar dialihkan ke antrean `q.document.contract_pdf` sehingga request HTTP pembuatan/perpanjangan kontrak langsung merespons tanpa menunggu rendering selesai.

### Langkah Pengujian
1. Buat kontrak baru via API:
   ```bash
   POST /api/contracts
   Authorization: Bearer <TOKEN_OWNER>
   Content-Type: application/json
   {
     "property_id": "...",
     "user_id": "...",
     "rental_duration": 12,
     "monthly_rent": 1500000
   }
   ```
2. Amati response HTTP:
   - **Hasil Diharapkan**: Response `201 Created` diterima dalam <100ms.
3. Amati log worker:
   - **Hasil Diharapkan**:
     `[Contract Worker] Received contract PDF compilation job for contract ID: <UUID>`
     `[Contract Worker] Generated PDF contract successfully: contracts/<UUID>.pdf`
     `[Contract Worker] Acknowledged contract PDF job`

---

## QUEUE-04: Heavy Job Asinkron: Ekspor CSV Laporan Finansial Volume Besar

### Tujuan
Memverifikasi bahwa permintaan ekspor riwayat transaksi ratusan/ribuan baris tidak membebani koneksi HTTP dan tidak menyebabkan request timeout.

### Langkah Pengujian
1. Buat permintaan ekspor laporan finansial:
   ```bash
   POST /api/finance/export
   Authorization: Bearer <TOKEN_OWNER>
   Content-Type: application/json
   {
     "property_id": "...",
     "start_date": "2025-01-01",
     "end_date": "2026-12-31"
   }
   ```
2. Amati response HTTP:
   - **Hasil Diharapkan**: Response `202 Accepted` dengan status payload `{"status": "queued", "job_id": "<UUID>"}` diterima dalam tempo cepat.
3. Amati antrean `q.document.report_csv` dan log worker:
   - **Hasil Diharapkan**:
     `[Report Worker] Received export CSV job for property <UUID> (range: 2025-01-01 - 2026-12-31)`
     `[Report Worker] Export report completed: reports/<UUID>.csv. Job acknowledged.`

---

## QUEUE-05: Heavy Job Asinkron: Auto-Triage & Klasifikasi Komplain Gemini AI

### Tujuan
Memverifikasi bahwa pengajuan komplain oleh penyewa segera sukses tanpa tertahan oleh latensi model AI eksternal (~1500ms - 3000ms), dan analisis prioritas/kategori komplain diisi secara asinkron di background.

### Langkah Pengujian
1. Tenant mengirim komplain baru:
   ```bash
   POST /api/complaints
   Authorization: Bearer <TOKEN_TENANT>
   Content-Type: application/json
   {
     "property_id": "...",
     "room_id": "...",
     "title": "Air kamar mandi tidak mengalir sama sekali sejak pagi",
     "description": "Kran shower mati total dan ada kebocoran pipa utama di koridor lantai 2"
   }
   ```
2. Amati response HTTP:
   - **Hasil Diharapkan**: Response `201 Created` diterima <80ms dengan `ai_advisory: ""` (menandakan belum dievaluasi).
3. Amati log terminal worker:
   - **Hasil Diharapkan**:
     `[AI Triage Worker] Received AI triage job for complaint ID: <UUID>`
     `[AI Triage Worker] Gemini advisory completed for complaint <UUID>: Category='plumbing', Severity='high', Advisory='Segera periksa pipa utama...'`
     `[AI Triage Worker] Persisted AI suggestion to database and acknowledged job`
4. Lakukan `GET /api/complaints/:id`:
   - **Hasil Diharapkan**: Field `ai_advisory` dan rekomendasi tindakan telah terisi otomatis oleh worker.

---

## QUEUE-06: Graceful Shutdown Worker Runtime (`cmd/worker`) saat Memproses Pesan

### Tujuan
Memverifikasi bahwa ketika worker menerima sinyal penghentian (`SIGINT`/`SIGTERM`), worker tidak langsung menghentikan proses secara mendadak melainkan menyelesaikan pesan yang sedang berjalan (*in-flight messages*) dan menolak pesan baru tanpa kehilangan data.

### Langkah Pengujian
1. Jalankan worker: `go run ./cmd/worker`.
2. Kirim sejumlah antrean tugas besar ke `q.document.contract_pdf`.
3. Segera tekan `Ctrl + C` (mengirim sinyal `SIGINT`) saat worker sedang memproses dokumen.
4. Amati log terminal:
   - **Hasil Diharapkan**:
     `Shutdown signal received (interrupt). Initiating graceful consumer drain...`
     `[Contract Worker] Finished in-flight job for contract <UUID>`
     `All consumers drained and finished processing.`
     `RabbitMQ connection closed cleanly. Worker exit: 0.`
5. Periksa antrean di RabbitMQ Management:
   - **Hasil Diharapkan**: Tidak ada pesan yang hilang atau unacknowledged (*0 unacked messages*).
