package notification

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

const TemplateVersion = "v1.0"

// FormattedNotification represents the resolved message content ready for delivery
type FormattedNotification struct {
	Category  model.NotificationCategory `json:"category"`
	Title     string                     `json:"title"`
	Message   string                     `json:"message"`
	ActionURL string                     `json:"action_url"`
	Priority  string                     `json:"priority"` // urgent, normal, low
}

// MaskBankAccount masks a bank account number showing only the last 4 digits (e.g. BCA ****1234)
func MaskBankAccount(bank, number string) string {
	clean := strings.TrimSpace(number)
	if len(clean) <= 4 {
		return fmt.Sprintf("%s %s", bank, clean)
	}
	masked := strings.Repeat("*", len(clean)-4) + clean[len(clean)-4:]
	return fmt.Sprintf("%s %s", bank, masked)
}

// RenderTemplate transforms an event type and payload into user-facing notification content
// with minimum PII and clean localization (Indonesian).
func RenderTemplate(eventType string, payloadBytes []byte) FormattedNotification {
	var data map[string]interface{}
	if len(payloadBytes) > 0 {
		_ = json.Unmarshal(payloadBytes, &data)
	}
	if data == nil {
		data = make(map[string]interface{})
	}

	getString := func(key, fallback string) string {
		if val, ok := data[key]; ok && val != nil {
			if s, ok := val.(string); ok && s != "" {
				return s
			}
		}
		return fallback
	}

	switch eventType {
	// Payment Events
	case "payment_verified":
		invNum := getString("invoice_number", "")
		msg := "Pembayaran tagihan Anda telah diverifikasi oleh tim pengelola."
		if invNum != "" {
			msg = fmt.Sprintf("Pembayaran untuk invoice %s telah diverifikasi.", invNum)
		}
		return FormattedNotification{
			Category:  model.NotificationCategoryBilling,
			Title:     "Pembayaran Terverifikasi",
			Message:   msg,
			ActionURL: "/payments",
			Priority:  "normal",
		}

	case "payment_rejected":
		reason := getString("reason", "Bukti transfer tidak valid atau belum masuk.")
		return FormattedNotification{
			Category:  model.NotificationCategoryBilling,
			Title:     "Pembayaran Ditolak",
			Message:   fmt.Sprintf("Pembayaran ditolak: %s. Silakan ajukan ulang dengan bukti pembayaran yang sah.", reason),
			ActionURL: "/payments",
			Priority:  "urgent",
		}

	case "refund_requested":
		bank := getString("bank_name", "Bank")
		acc := getString("account_number", "")
		dest := MaskBankAccount(bank, acc)
		return FormattedNotification{
			Category:  model.NotificationCategoryBilling,
			Title:     "Pengajuan Pengembalian Dana (Refund)",
			Message:   fmt.Sprintf("Pengajuan refund Anda ke rekening %s telah didaftarkan dan sedang diproses.", dest),
			ActionURL: "/payments",
			Priority:  "normal",
		}

	case "invoice_generated", "invoice_created":
		period := getString("period", "bulan ini")
		return FormattedNotification{
			Category:  model.NotificationCategoryBilling,
			Title:     "Tagihan Baru Diterbitkan",
			Message:   fmt.Sprintf("Invoice tagihan kos untuk periode %s telah diterbitkan. Harap lakukan pembayaran sebelum jatuh tempo.", period),
			ActionURL: "/invoices",
			Priority:  "normal",
		}

	// Room Transfer Events
	case "room_transfer_requested":
		targetRoom := getString("target_room_number", "")
		msg := "Permohonan pindah kamar baru telah diajukan dan sedang menunggu persetujuan pengelola."
		if targetRoom != "" {
			msg = fmt.Sprintf("Permohonan pindah ke kamar %s telah diajukan dan sedang ditinjau.", targetRoom)
		}
		return FormattedNotification{
			Category:  model.NotificationCategoryOperations,
			Title:     "Permohonan Pindah Kamar",
			Message:   msg,
			ActionURL: "/rooms/transfers",
			Priority:  "normal",
		}

	case "room_transfer_approved":
		targetRoom := getString("target_room_number", "")
		moveDate := getString("move_date", "tanggal yang disepakati")
		return FormattedNotification{
			Category:  model.NotificationCategoryOperations,
			Title:     "Pindah Kamar Disetujui",
			Message:   fmt.Sprintf("Permohonan pindah ke kamar %s telah disetujui untuk %s. Silakan bersiap untuk serah terima.", targetRoom, moveDate),
			ActionURL: "/rooms/transfers",
			Priority:  "normal",
		}

	case "room_transfer_rejected":
		reason := getString("reason", "Kamar tidak tersedia atau jadwal belum memungkinkan.")
		return FormattedNotification{
			Category:  model.NotificationCategoryOperations,
			Title:     "Permohonan Pindah Kamar Ditolak",
			Message:   fmt.Sprintf("Permohonan pindah kamar belum dapat disetujui: %s", reason),
			ActionURL: "/rooms/transfers",
			Priority:  "normal",
		}

	case "room_transfer_completed":
		newRoom := getString("target_room_number", "")
		return FormattedNotification{
			Category:  model.NotificationCategoryOperations,
			Title:     "Pindah Kamar Selesai",
			Message:   fmt.Sprintf("Proses pemindahan hunian ke kamar %s telah selesai secara operasional dan finansial. Selamat menempati kamar baru!", newRoom),
			ActionURL: "/rooms/transfers",
			Priority:  "normal",
		}

	// Checkout Events
	case "checkout_notice_filed":
		moveOut := getString("planned_move_out", "akhir periode")
		return FormattedNotification{
			Category:  model.NotificationCategoryOperations,
			Title:     "Notice Checkout Didaftarkan",
			Message:   fmt.Sprintf("Notice rencana checkout untuk tanggal %s telah dicatat. Tim pengelola akan menjadwalkan inspeksi kamar.", moveOut),
			ActionURL: "/checkouts",
			Priority:  "normal",
		}

	case "checkout_completed":
		roomNum := getString("room_number", "")
		msg := "Proses checkout, serah terima kunci, dan penyelesaian deposit telah selesai."
		if roomNum != "" {
			msg = fmt.Sprintf("Proses checkout kamar %s dan settlement finansial telah selesai dengan sukses.", roomNum)
		}
		return FormattedNotification{
			Category:  model.NotificationCategoryOperations,
			Title:     "Checkout Selesai",
			Message:   msg,
			ActionURL: "/checkouts",
			Priority:  "normal",
		}

	case "checkout_cancelled":
		reason := getString("cancellation_reason", "Dibatalkan atas permintaan tenant/pengelola.")
		return FormattedNotification{
			Category:  model.NotificationCategoryOperations,
			Title:     "Checkout Dibatalkan",
			Message:   fmt.Sprintf("Proses checkout telah dibatalkan: %s", reason),
			ActionURL: "/checkouts",
			Priority:  "normal",
		}

	// Complaints & General
	case "complaint_updated":
		status := getString("status", "diperbarui")
		return FormattedNotification{
			Category:  model.NotificationCategoryComplaint,
			Title:     "Pembaruan Komplain Fasilitas",
			Message:   fmt.Sprintf("Laporan komplain fasilitas Anda telah berstatus: %s.", status),
			ActionURL: "/complaints",
			Priority:  "normal",
		}

	case "security_alert":
		msg := getString("message", "Aktivitas keamanan akun terdeteksi.")
		return FormattedNotification{
			Category:  model.NotificationCategorySecurity,
			Title:     "Pemberitahuan Keamanan",
			Message:   msg,
			ActionURL: "/settings",
			Priority:  "urgent",
		}

	default:
		title := getString("title", "Pemberitahuan Sistem")
		message := getString("message", "Anda memiliki pemberitahuan baru di Lapor Kos.")
		return FormattedNotification{
			Category:  model.NotificationCategoryGeneral,
			Title:     title,
			Message:   message,
			ActionURL: getString("action_url", "/"),
			Priority:  getString("priority", "normal"),
		}
	}
}
