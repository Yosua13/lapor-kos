package service

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/jung-kurt/gofpdf"
)

type FinancialReportPDFData struct {
	Payments  []model.Payment
	OwnerName string
	Month     int
	Year      int
}

type financialReportSummary struct {
	TotalBilled    float64
	TotalCollected float64
	Outstanding    float64
	PaidCount      int
	PendingCount   int
	UnpaidCount    int
}

type ReportPDFService struct{}

func NewReportPDFService() *ReportPDFService {
	return &ReportPDFService{}
}

func (s *ReportPDFService) GenerateFinancialReport(data FinancialReportPDFData) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	summary := summarizePayments(data.Payments)
	periodLabel := reportPeriodLabel(data.Month, data.Year)
	generatedAt := time.Now().Format("02 January 2006")

	// Title
	pdf.SetFont("Arial", "B", 22)
	pdf.SetTextColor(15, 23, 42) // #0f172a
	pdf.CellFormat(180, 10, "Lapor Kos", "", 1, "C", false, 0, "")
	pdf.Ln(2)

	// Subtitle
	pdf.SetFont("Arial", "B", 14)
	pdf.SetTextColor(20, 184, 166) // #14b8a6
	pdf.CellFormat(180, 8, "Laporan Keuangan Kos", "", 1, "C", false, 0, "")
	pdf.Ln(4)

	// Meta Info
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(100, 116, 139) // #64748b
	metaText := fmt.Sprintf("Periode: %s   |   Dibuat: %s   |   Pemilik: %s", periodLabel, generatedAt, fallback(data.OwnerName, "Pemilik Kos"))
	pdf.CellFormat(180, 5, metaText, "", 1, "C", false, 0, "")
	pdf.Ln(8)

	// Intro
	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(51, 65, 85) // #334155
	pdf.MultiCell(180, 5, "Berikut adalah ringkasan laporan keuangan berdasarkan tagihan dan pembayaran yang tercatat pada aplikasi Lapor Kos.", "", "L", false)
	pdf.Ln(6)

	// Summary Cards (Total Tagihan, Terkumpul, Sisa Piutang, Rasio Bayar)
	items := []struct {
		label string
		value string
	}{
		{"Total Tagihan", formatRupiahFloat(summary.TotalBilled)},
		{"Terkumpul", formatRupiahFloat(summary.TotalCollected)},
		{"Sisa Piutang", formatRupiahFloat(summary.Outstanding)},
		{"Rasio Bayar", fmt.Sprintf("%d%%", collectionRate(summary))},
	}

	x := pdf.GetX()
	y := pdf.GetY()
	pdf.SetDrawColor(226, 232, 240) // #e2e8f0
	pdf.SetFillColor(248, 250, 252) // #f8fafc

	for _, item := range items {
		pdf.Rect(x, y, 45, 15, "FDF")
		
		// Draw label
		pdf.SetFont("Arial", "B", 7)
		pdf.SetTextColor(100, 116, 139)
		pdf.SetXY(x + 2, y + 2)
		pdf.Cell(41, 4, strings.ToUpper(item.label))
		
		// Draw value
		pdf.SetFont("Arial", "B", 9)
		pdf.SetTextColor(15, 23, 42)
		pdf.SetXY(x + 2, y + 8)
		pdf.Cell(41, 4, item.value)
		
		x += 45
	}
	pdf.SetXY(15, y+15)
	pdf.Ln(8)

	// Breakdown Table (Komposisi Tagihan)
	pdf.SetFont("Arial", "B", 12)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(180, 6, "Komposisi Tagihan", "", 1, "L", false, 0, "")
	pdf.Ln(2)

	var rent, electricity, water, other float64
	for _, p := range data.Payments {
		rent += p.AmountRent
		electricity += p.AmountElectricity
		water += p.AmountWater
		other += p.AmountOther
	}

	pdf.SetDrawColor(226, 232, 240)
	pdf.SetTextColor(51, 65, 85)
	
	breakdownItems := [][2]string{
		{"Sewa Kamar", formatRupiahFloat(rent)},
		{"Listrik", formatRupiahFloat(electricity)},
		{"Air", formatRupiahFloat(water)},
		{"Lainnya", formatRupiahFloat(other)},
	}

	for _, row := range breakdownItems {
		pdf.SetFont("Arial", "B", 9)
		pdf.CellFormat(90, 8, "  "+row[0], "1", 0, "L", false, 0, "")
		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(90, 8, row[1]+"  ", "1", 1, "R", false, 0, "")
	}
	pdf.Ln(8)

	// Transaction Detail Table
	pdf.SetFont("Arial", "B", 12)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(180, 6, "Detail Transaksi", "", 1, "L", false, 0, "")
	pdf.Ln(2)

	// Table Header
	pdf.SetFillColor(15, 23, 42)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 8)
	
	headers := []string{"No", "Periode", "Kamar", "Penghuni", "Tagihan", "Dibayar"}
	widths := []float64{10, 30, 25, 45, 35, 35}
	for i, h := range headers {
		pdf.CellFormat(widths[i], 8, h, "1", 0, "L", true, 0, "")
	}
	pdf.Ln(8)

	// Table Body
	pdf.SetTextColor(51, 65, 85)
	pdf.SetFont("Arial", "", 8)

	if len(data.Payments) == 0 {
		pdf.CellFormat(widths[0], 8, "1", "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[1], 8, "-", "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[2], 8, "-", "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[3], 8, "Tidak ada transaksi", "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[4], 8, formatRupiahFloat(0), "1", 0, "R", false, 0, "")
		pdf.CellFormat(widths[5], 8, formatRupiahFloat(0), "1", 1, "R", false, 0, "")
	} else {
		for i, p := range data.Payments {
			roomNumber := "-"
			tenantName := "-"
			if p.Contract != nil {
				if p.Contract.Room != nil {
					roomNumber = p.Contract.Room.RoomNumber
				}
				if p.Contract.User != nil {
					tenantName = p.Contract.User.Name
				}
			}

			periodText := fmt.Sprintf("%s %d", monthName(p.PeriodMonth), p.PeriodYear)
			roomText := "Kamar " + roomNumber
			tenantText := tenantName + " (" + statusLabel(p.Status) + ")"
			billText := formatRupiahFloat(totalBill(p))
			paidText := formatRupiahFloat(p.TotalPaid)

			pdf.CellFormat(widths[0], 8, fmt.Sprintf("%d", i+1), "1", 0, "L", false, 0, "")
			pdf.CellFormat(widths[1], 8, periodText, "1", 0, "L", false, 0, "")
			pdf.CellFormat(widths[2], 8, roomText, "1", 0, "L", false, 0, "")
			pdf.CellFormat(widths[3], 8, tenantText, "1", 0, "L", false, 0, "")
			pdf.CellFormat(widths[4], 8, billText+"  ", "1", 0, "R", false, 0, "")
			pdf.CellFormat(widths[5], 8, paidText+"  ", "1", 1, "R", false, 0, "")
		}
	}
	pdf.Ln(8)

	// Closing Text
	pdf.SetFont("Arial", "", 8)
	pdf.SetTextColor(71, 85, 105) // #475569
	pdf.MultiCell(180, 4, "Dokumen ini dibuat secara elektronik oleh sistem Lapor Kos dan dapat digunakan sebagai arsip laporan keuangan kos.", "", "L", false)
	pdf.Ln(8)

	// Signature
	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(15, 23, 42)
	
	ySig := pdf.GetY()
	// Ensure signature is on same page or check height, fpdf handles pages automatically, but we can write it on right
	pdf.SetXY(120, ySig)
	pdf.MultiCell(75, 5, fmt.Sprintf("Hormat kami,\n\n\n\n%s", fallback(data.OwnerName, "Pemilik Kos")), "", "R", false)

	// Output PDF to buffer
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func summarizePayments(payments []model.Payment) financialReportSummary {
	var s financialReportSummary
	for _, p := range payments {
		bill := totalBill(p)
		s.TotalBilled += bill
		if p.Status == "paid" || p.Status == "partial" {
			s.TotalCollected += p.TotalPaid
		}
		switch p.Status {
		case "paid":
			s.PaidCount++
		case "pending":
			s.PendingCount++
		default:
			s.UnpaidCount++
		}
	}
	s.Outstanding = s.TotalBilled - s.TotalCollected
	if s.Outstanding < 0 {
		s.Outstanding = 0
	}
	return s
}

func collectionRate(summary financialReportSummary) int {
	if summary.TotalBilled <= 0 {
		return 0
	}
	return int((summary.TotalCollected / summary.TotalBilled) * 100)
}

func reportPeriodLabel(month int, year int) string {
	if month > 0 && year > 0 {
		return fmt.Sprintf("%s %d", monthName(month), year)
	}
	if year > 0 {
		return fmt.Sprintf("Semua Bulan %d", year)
	}
	if month > 0 {
		return monthName(month)
	}
	return "Semua Periode"
}

func monthName(month int) string {
	names := []string{"Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"}
	if month < 1 || month > len(names) {
		return "-"
	}
	return names[month-1]
}

func totalBill(payment model.Payment) float64 {
	return payment.AmountRent + payment.AmountElectricity + payment.AmountWater + payment.AmountOther
}

func statusLabel(status string) string {
	switch status {
	case "paid":
		return "Lunas"
	case "pending":
		return "Menunggu"
	case "partial":
		return "Sebagian"
	case "overdue":
		return "Terlambat"
	default:
		return "Belum Bayar"
	}
}

func formatRupiahFloat(amount float64) string {
	negative := amount < 0
	if negative {
		amount = -amount
	}
	intAmount := int64(amount)
	raw := fmt.Sprintf("%d", intAmount)
	var parts []string
	for len(raw) > 3 {
		parts = append([]string{raw[len(raw)-3:]}, parts...)
		raw = raw[:len(raw)-3]
	}
	parts = append([]string{raw}, parts...)
	result := strings.Join(parts, ".")
	if negative {
		result = "-" + result
	}
	return "Rp " + result
}

func fallback(value string, fallbackValue string) string {
	if strings.TrimSpace(value) == "" {
		return fallbackValue
	}
	return value
}
