package service

import (
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"testing"
)

func TestGenerateFinancialReport(t *testing.T) {
	svc := NewReportPDFService()
	data := FinancialReportPDFData{
		Payments: []model.Payment{
			{
				ID:                uuid.New(),
				PeriodMonth:       6,
				PeriodYear:        2026,
				AmountRent:        1500000,
				AmountElectricity: 100000,
				AmountWater:       50000,
				AmountOther:       0,
				TotalPaid:         1650000,
				Status:            "paid",
			},
		},
		OwnerName: "Test Owner",
		Month:     6,
		Year:      2026,
	}

	pdfBytes, err := svc.GenerateFinancialReport(data)
	if err != nil {
		t.Fatalf("Failed to generate PDF: %v", err)
	}

	if len(pdfBytes) == 0 {
		t.Error("Generated PDF is empty")
	}
}
