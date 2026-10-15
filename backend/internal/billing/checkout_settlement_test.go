package billing_test

import (
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/billing"
	"github.com/stretchr/testify/assert"
)

func TestCalculateCheckoutSettlement_Refund(t *testing.T) {
	// Deposit: Rp 1.500.000, Credit: Rp 200.000 (Total funds = Rp 1.700.000)
	// Deductions: Damages Rp 300.000, Utilities Rp 150.000 (Total deductions = Rp 450.000)
	// Net: Rp +1.250.000 (Refund to tenant)
	input := billing.SettlementCalcInput{
		DepositHeldMinor:    150000000,
		CreditBalanceMinor:  20000000,
		UnpaidInvoicesMinor: 0,
		ProrataRentMinor:    0,
		DamageChargesMinor:  30000000,
		UtilityChargesMinor: 15000000,
		OtherChargesMinor:   0,
		Currency:            "IDR",
	}

	result := billing.CalculateCheckoutSettlement(input)

	assert.Equal(t, "refund", result.SettlementType)
	assert.Equal(t, int64(125000000), result.NetSettlementMinor)
	assert.Equal(t, int64(125000000), result.RefundAmountMinor)
	assert.Equal(t, int64(0), result.InvoiceAmountMinor)
	assert.Equal(t, int64(45000000), result.DepositAppliedToDeductionsMinor)
	assert.Equal(t, "refund_requested", result.DepositStatus)
	assert.NotNil(t, result.Snapshot)
}

func TestCalculateCheckoutSettlement_InvoiceDeficit(t *testing.T) {
	// Deposit: Rp 500.000, Credit: 0 (Total funds = Rp 500.000)
	// Deductions: Unpaid invoice Rp 1.000.000, Damages Rp 200.000 (Total deductions = Rp 1.200.000)
	// Net: Rp -700.000 (Invoice to tenant)
	input := billing.SettlementCalcInput{
		DepositHeldMinor:    50000000,
		CreditBalanceMinor:  0,
		UnpaidInvoicesMinor: 100000000,
		ProrataRentMinor:    0,
		DamageChargesMinor:  20000000,
		UtilityChargesMinor: 0,
		OtherChargesMinor:   0,
		Currency:            "IDR",
	}

	result := billing.CalculateCheckoutSettlement(input)

	assert.Equal(t, "invoice", result.SettlementType)
	assert.Equal(t, int64(-70000000), result.NetSettlementMinor)
	assert.Equal(t, int64(0), result.RefundAmountMinor)
	assert.Equal(t, int64(70000000), result.InvoiceAmountMinor)
	assert.Equal(t, int64(50000000), result.DepositAppliedToDeductionsMinor)
	assert.Equal(t, "applied_to_deductions", result.DepositStatus)
}

func TestCalculateCheckoutSettlement_ZeroBalance(t *testing.T) {
	// Deposit: Rp 500.000
	// Deductions: Damages Rp 500.000
	// Net: Rp 0 (Exact zero balance)
	input := billing.SettlementCalcInput{
		DepositHeldMinor:    50000000,
		CreditBalanceMinor:  0,
		UnpaidInvoicesMinor: 0,
		ProrataRentMinor:    0,
		DamageChargesMinor:  50000000,
		UtilityChargesMinor: 0,
		OtherChargesMinor:   0,
		Currency:            "IDR",
	}

	result := billing.CalculateCheckoutSettlement(input)

	assert.Equal(t, "zero_balance", result.SettlementType)
	assert.Equal(t, int64(0), result.NetSettlementMinor)
	assert.Equal(t, int64(0), result.RefundAmountMinor)
	assert.Equal(t, int64(0), result.InvoiceAmountMinor)
	assert.Equal(t, int64(50000000), result.DepositAppliedToDeductionsMinor)
	assert.Equal(t, "zero_balance", result.DepositStatus)
}

func TestCalculateUtilityUsage(t *testing.T) {
	// Prev: 100.5 kWh, Current: 150.2 kWh, Unit price: Rp 1.500 (150000 minor)
	// Diff = 49.7 kWh * 1500 = 74550
	charge := billing.CalculateUtilityUsage(100.5, 150.2, 1500)
	assert.Equal(t, int64(74550), charge)

	// Negative diff returns 0
	invalidCharge := billing.CalculateUtilityUsage(150.0, 120.0, 1500)
	assert.Equal(t, int64(0), invalidCharge)
}
