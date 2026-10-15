package billing

import (
	"math"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type SettlementCalcInput struct {
	DepositHeldMinor    int64
	CreditBalanceMinor  int64
	UnpaidInvoicesMinor int64
	ProrataRentMinor    int64
	DamageChargesMinor  int64
	UtilityChargesMinor int64
	OtherChargesMinor   int64
	Currency            string
}

// CalculateCheckoutSettlement performs audited, integer-precise calculations for tenancy final settlement.
// NetSettlement = AvailableFunds (Deposit + Credits) - Deductions (Unpaid + Prorata + Damages + Utilities + Other).
func CalculateCheckoutSettlement(in SettlementCalcInput) model.SettlementCalculation {
	currency := in.Currency
	if currency == "" {
		currency = "IDR"
	}

	depHeld := max(0, in.DepositHeldMinor)
	credits := max(0, in.CreditBalanceMinor)
	unpaid := max(0, in.UnpaidInvoicesMinor)
	prorata := max(0, in.ProrataRentMinor)
	damages := max(0, in.DamageChargesMinor)
	utilities := max(0, in.UtilityChargesMinor)
	other := max(0, in.OtherChargesMinor)

	totalFunds := depHeld + credits
	totalDeductions := unpaid + prorata + damages + utilities + other

	net := totalFunds - totalDeductions

	var settlementType string
	var refundAmount int64
	var invoiceAmount int64
	var depositApplied int64
	var depositStatus string

	switch {
	case net > 0:
		settlementType = "refund"
		refundAmount = net
		invoiceAmount = 0
		depositApplied = min(depHeld, totalDeductions)
		depositStatus = "refund_requested"
	case net < 0:
		settlementType = "invoice"
		refundAmount = 0
		invoiceAmount = -net
		depositApplied = depHeld
		depositStatus = "applied_to_deductions"
	default: // net == 0
		settlementType = "zero_balance"
		refundAmount = 0
		invoiceAmount = 0
		depositApplied = depHeld
		depositStatus = "zero_balance"
	}

	snapshot := map[string]any{
		"currency":                           currency,
		"deposit_held_minor":                 depHeld,
		"credit_balance_minor":               credits,
		"total_available_funds_minor":        totalFunds,
		"unpaid_invoices_minor":              unpaid,
		"prorata_rent_minor":                 prorata,
		"damage_charges_minor":               damages,
		"utility_charges_minor":              utilities,
		"other_charges_minor":                other,
		"total_deductions_minor":             totalDeductions,
		"net_settlement_minor":               net,
		"settlement_type":                    settlementType,
		"refund_amount_minor":                refundAmount,
		"invoice_amount_minor":               invoiceAmount,
		"deposit_applied_to_deductions_minor": depositApplied,
		"deposit_status":                     depositStatus,
		"calculated_at":                      time.Now().UTC().Format(time.RFC3339),
	}

	return model.SettlementCalculation{
		Currency:                        currency,
		DepositHeldMinor:                depHeld,
		CreditBalanceMinor:              credits,
		TotalAvailableFundsMinor:        totalFunds,
		UnpaidInvoicesMinor:             unpaid,
		ProrataRentMinor:                prorata,
		DamageChargesMinor:              damages,
		UtilityChargesMinor:             utilities,
		OtherChargesMinor:               other,
		TotalDeductionsMinor:            totalDeductions,
		NetSettlementMinor:              net,
		SettlementType:                  settlementType,
		RefundAmountMinor:               refundAmount,
		InvoiceAmountMinor:              invoiceAmount,
		DepositAppliedToDeductionsMinor: depositApplied,
		DepositStatus:                   depositStatus,
		Snapshot:                        snapshot,
	}
}

// CalculateUtilityUsage calculates utility charge from meter difference using integer half-up rounding.
func CalculateUtilityUsage(prev, current float64, unitPriceMinor int64) int64 {
	if current < prev || prev < 0 || unitPriceMinor <= 0 {
		return 0
	}
	diff := current - prev
	charge := math.Round(diff * float64(unitPriceMinor))
	return int64(charge)
}
