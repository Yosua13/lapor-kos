package billing

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestCalculateRoomTransfer(t *testing.T) {
	contractID := uuid.New()
	fromRoomID := uuid.New()
	toRoomID := uuid.New()

	effDate := time.Date(2026, time.October, 16, 0, 0, 0, 0, time.UTC)
	contractEnd := time.Date(2026, time.December, 31, 0, 0, 0, 0, time.UTC)

	calc := CalculateRoomTransfer(TransferCalcInput{
		ContractID:               contractID,
		FromRoomID:               fromRoomID,
		FromRoomNumber:           "101",
		FromRoomPriceMinor:       1500000,
		ToRoomID:                 toRoomID,
		ToRoomNumber:             "202",
		ToRoomPriceMinor:         2000000,
		FromDepositMinor:         1500000,
		ToDepositMinor:           2000000,
		MoveFeeMinor:             50000,
		EffectiveDate:            effDate,
		ContractEndDate:          contractEnd,
		TenantCreditBalanceMinor: 100000,
		OutstandingInvoicesMinor: 0,
		Currency:                 "IDR",
		Timezone:                 "Asia/Jakarta",
	})

	assert.Equal(t, contractID, calc.ContractID)
	assert.Equal(t, "101", calc.FromRoomNumber)
	assert.Equal(t, "202", calc.ToRoomNumber)
	assert.Equal(t, "2026-10-16", calc.EffectiveDate)
	assert.Equal(t, "2026-10-01", calc.BillingPeriodStart)
	assert.Equal(t, "2026-10-31", calc.BillingPeriodEnd)
	assert.Equal(t, 31, calc.DaysInPeriod)
	// Remaining days from 16 to 31 inclusive = 16 days
	assert.Equal(t, 16, calc.ActiveDaysRemaining)

	// Unused old rent prorated: 1500000 * 16 / 31 = 774194
	assert.Equal(t, int64(774194), calc.UnusedOldRentProratedMinor)
	// New rent prorated: 2000000 * 16 / 31 = 1032258
	assert.Equal(t, int64(1032258), calc.NewRentProratedMinor)
	// Rent diff = 1032258 - 774194 = 258064
	assert.Equal(t, int64(258064), calc.RentDifferenceMinor)
	// Deposit diff = 2000000 - 1500000 = 500000
	assert.Equal(t, int64(500000), calc.DepositDifferenceMinor)
	assert.Equal(t, int64(50000), calc.MoveFeeMinor)

	// Gross = 258064 + 500000 + 50000 = 808064
	// Credit applied: 100000
	// Net total = 808064 - 100000 = 708064
	assert.Equal(t, int64(100000), calc.CreditAppliedMinor)
	assert.Equal(t, int64(708064), calc.NetTotalAdjustmentMinor)
}

func TestCalculateRoomTransferZeroFeeAndSameRent(t *testing.T) {
	calc := CalculateRoomTransfer(TransferCalcInput{
		ContractID:         uuid.New(),
		FromRoomID:         uuid.New(),
		FromRoomNumber:     "101",
		FromRoomPriceMinor: 1500000,
		ToRoomID:           uuid.New(),
		ToRoomNumber:       "102",
		ToRoomPriceMinor:   1500000,
		FromDepositMinor:   1500000,
		ToDepositMinor:     1500000,
		MoveFeeMinor:       0,
		EffectiveDate:      time.Date(2026, time.October, 1, 0, 0, 0, 0, time.UTC),
		ContractEndDate:    time.Date(2026, time.October, 31, 0, 0, 0, 0, time.UTC),
	})

	assert.Equal(t, int64(0), calc.RentDifferenceMinor)
	assert.Equal(t, int64(0), calc.DepositDifferenceMinor)
	assert.Equal(t, int64(0), calc.MoveFeeMinor)
	assert.Equal(t, int64(0), calc.NetTotalAdjustmentMinor)
}
