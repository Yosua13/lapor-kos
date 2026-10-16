# Migration Plan: Fase 3 - Event-Driven Messaging Berbasis RabbitMQ

- **Track ID:** ARCH-03
- **Fokus:** Penghapusan database polling cron, pemrosesan notifikasi asynchronous (WhatsApp & Email), Dead Letter Queue (DLQ), dan background heavy job workers (PDF & CSV).

---

## 1. Ruang Lingkup Pekerjaan

1. **Topologi Exchange & Queue RabbitMQ**:
   - **Topic Exchange**: `kos.events.topic` untuk seluruh event domain (contoh: `invoice.issued`, `payment.verified`, `complaint.created`, `checkout.completed`).
   - **Notification Queues**:
     - `q.notification.whatsapp` (binding: `event.notification.wa.*`)
     - `q.notification.email` (binding: `event.notification.email.*`)
   - **Dead Letter Exchange (DLX)**: `kos.dlx` dan Dead Letter Queue `q.dead_letter` untuk pesan yang gagal diproses setelah N kali retry.
   - **Background Heavy Queues**:
     - `q.document.contract_pdf` untuk kompilasi PDF kontrak digital.
     - `q.document.report_csv` untuk ekspor CSV finansial volume besar.
     - `q.ai.complaint_triage` untuk klasifikasi dan auto-advisory Gemini AI.
2. **Reliable Transactional Outbox Publisher**:
   - Menghapus mekanisme polling interval 15 detik pada `delivery_cron.go`.
   - Pola Publish: Saat mutasi domain terjadi, publisher mengirim pesan ke RabbitMQ secara asinkron atau menggunakan worker outbox yang reaktif.
3. **Decoupled Consumer Workers (`cmd/worker/main.go`)**:
   - Memisahkan proses background worker dari proses web HTTP server (`cmd/api`). Worker dapat diskalakan secara independen (*horizontal pod autoscaling*).
   - Penanganan retry pesan dengan exponential backoff sebelum dipindahkan ke DLQ.
4. **Decoupling AI & Heavy Document Rendering**:
   - Mengalihkan eksekusi `aiService.AnalyzeComplaint` ke queue `q.ai.complaint_triage` sehingga request HTTP user selesai dalam <100ms tanpa menunggu respons vendor AI.

---

## 2. Rincian File yang Dibuat / Dimodifikasi (One Function Per File)

```text
backend/
├── cmd/
│   └── worker/
│       └── main.go                                 # New: dedicated worker runtime
├── internal/
│   ├── infrastructure/
│   │   └── rabbitmq/
│   │       ├── publish_notification_event.go       # func PublishNotificationEvent(ctx, ch, event) error
│   │       ├── publish_document_job.go             # func PublishDocumentJob(ctx, ch, job) error
│   │       └── publish_ai_triage_job.go            # func PublishAITriageJob(ctx, ch, job) error
│   └── delivery/
│       └── queue/
│           ├── consume_whatsapp_messages.go        # func ConsumeWhatsAppMessages(ctx, ch, waService)
│           ├── consume_email_messages.go           # func ConsumeEmailMessages(ctx, ch, emailService)
│           ├── consume_contract_pdf_jobs.go        # func ConsumeContractPDFJobs(ctx, ch, pdfService, storage)
│           ├── consume_report_export_jobs.go       # func ConsumeReportExportJobs(ctx, ch, exporter, storage)
│           └── consume_ai_triage_jobs.go           # func ConsumeAITriageJobs(ctx, ch, aiService, repo)
```

---

## 3. Kriteria Penerimaan (Acceptance Criteria)

- [ ] Polling database berkala di `delivery_cron.go` sepenuhnya digantikan oleh event streaming RabbitMQ.
- [ ] Pengiriman WhatsApp dan Email berjalan secara asinkron; kegagalan jaringan eksternal memicu retry otomatis dan akhirnya terisolasi di Dead Letter Queue tanpa menghilangkan data.
- [ ] Request HTTP saat komplain dibuat atau tagihan diterbitkan merespons dalam <100ms karena pekerjaan berat dipindahkan ke antrean RabbitMQ.
- [ ] Worker proses terpisah (`cmd/worker`) dapat dimatikan (*graceful shutdown*) tanpa terjadi kehilangan pesan (*zero message loss*) yang sedang diproses.
