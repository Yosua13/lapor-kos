package billing

import (
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
)

type TransferCalcInput struct {
	ContractID               uuid.UUID
	FromRoomID               uuid.UUID
	FromRoomNumber           string
	FromRoomPriceMinor       int64
	ToRoomID                 uuid.UUID
	ToRoomNumber             string
	ToRoomPriceMinor         int64
	FromDepositMinor         int64
	ToDepositMinor           int64
	MoveFeeMinor             int64
	EffectiveDate            time.Time
	ContractEndDate          time.Time
	TenantCreditBalanceMinor int64
	OutstandingInvoicesMinor int64
	Currency                 string
	Timezone                 string
}

// CalculateRoomTransfer performs integer-precise prorata and adjustment calculations for room transfers.
func CalculateRoomTransfer(in TransferCalcInput) model.TransferCalculation {
	loc, err := time.LoadLocation(in.Timezone)
	if err != nil {
		loc = time.UTC
	}

	// Normalize date components
	effYear, effMonth, effDay := in.EffectiveDate.In(loc).Date()
	eff := time.Date(effYear, effMonth, effDay, 0, 0, 0, 0, loc)

	periodStart := time.Date(effYear, effMonth, 1, 0, 0, 0, 0, loc)
	periodEnd := time.Date(effYear, effMonth+1, 0, 0, 0, 0, 0, loc)
	daysInPeriod := periodEnd.Day()

	calcEnd := periodEnd
	if !in.ContractEndDate.IsZero() {
		endYear, endMonth, endDay := in.ContractEndDate.In(loc).Date()
		endNorm := time.Date(endYear, endMonth, endDay, 0, 0, 0, 0, loc)
		if endNorm.Before(calcEnd) {
			calcEnd = endNorm
		}
	}

	activeDays := 0
	if !calcEnd.Before(eff) {
		activeDays = int(calcEnd.Sub(eff).Hours()/24) + 1
	}
	if activeDays > daysInPeriod {
		activeDays = daysInPeriod
	}

	unusedOldRent := ProrateMinor(in.FromRoomPriceMinor, activeDays, daysInPeriod)
	newRent := ProrateMinor(in.ToRoomPriceMinor, activeDays, daysInPeriod)
	rentDiff := newRent - unusedOldRent

	depositDiff := in.ToDepositMinor - in.FromDepositMinor

	grossAdjustment := rentDiff + depositDiff + in.MoveFeeMinor
	creditApplied := int64(0)
	if grossAdjustment > 0 && in.TenantCreditBalanceMinor > 0 {
		if in.TenantCreditBalanceMinor >= grossAdjustment {
			creditApplied = grossAdjustment
		} else {
			creditApplied = in.TenantCreditBalanceMinor
		}
	}

	netTotal := grossAdjustment - creditApplied

	currency := in.Currency
	if currency == "" {
		currency = "IDR"
	}

	targetEndDate := in.ContractEndDate
	if targetEndDate.IsZero() {
		targetEndDate = periodEnd
	}

	return model.TransferCalculation{
		ContractID:                 in.ContractID,
		FromRoomID:                 in.FromRoomID,
		FromRoomNumber:             in.FromRoomNumber,
		FromRoomPriceMinor:         in.FromRoomPriceMinor,
		ToRoomID:                   in.ToRoomID,
		ToRoomNumber:               in.ToRoomNumber,
		ToRoomPriceMinor:           in.ToRoomPriceMinor,
		EffectiveDate:              eff.Format("2006-01-02"),
		TargetEndDate:              targetEndDate.Format("2006-01-02"),
		BillingPeriodStart:         periodStart.Format("2006-01-02"),
		BillingPeriodEnd:           periodEnd.Format("2006-01-02"),
		DaysInPeriod:               daysInPeriod,
		ActiveDaysRemaining:        activeDays,
		UnusedOldRentProratedMinor: unusedOldRent,
		NewRentProratedMinor:       newRent,
		RentDifferenceMinor:        rentDiff,
		DepositOldMinor:            in.FromDepositMinor,
		DepositNewMinor:            in.ToDepositMinor,
		DepositDifferenceMinor:     depositDiff,
		MoveFeeMinor:               in.MoveFeeMinor,
		TenantCreditBalanceMinor:   in.TenantCreditBalanceMinor,
		CreditAppliedMinor:         creditApplied,
		NetTotalAdjustmentMinor:    netTotal,
		OutstandingInvoicesMinor:   in.OutstandingInvoicesMinor,
		Currency:                   currency,
	}
}
