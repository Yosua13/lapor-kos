package repository

import (
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestRoomTransferStatusTransitions(t *testing.T) {
	t.Parallel()

	transfer := model.RoomTransfer{
		ID:            uuid.New(),
		PropertyID:    uuid.New(),
		ContractID:    uuid.New(),
		TenantID:      uuid.New(),
		FromRoomID:    uuid.New(),
		ToRoomID:      uuid.New(),
		EffectiveDate: time.Now().AddDate(0, 0, 5),
		TargetEndDate: time.Now().AddDate(0, 3, 0),
		Status:        model.RoomTransferPending,
		Reason:        "Ingin kamar di lantai 2 yang lebih tenang",
	}

	assert.Equal(t, model.RoomTransferPending, transfer.Status)

	// Transition to approved
	transfer.Status = model.RoomTransferApproved
	now := time.Now()
	actor := uuid.New()
	transfer.ApprovedBy = &actor
	transfer.ApprovedAt = &now
	assert.Equal(t, model.RoomTransferApproved, transfer.Status)
	assert.NotNil(t, transfer.ApprovedBy)
	assert.NotNil(t, transfer.ApprovedAt)

	// Transition to completed
	transfer.Status = model.RoomTransferCompleted
	transfer.CompletedAt = &now
	assert.Equal(t, model.RoomTransferCompleted, transfer.Status)
	assert.NotNil(t, transfer.CompletedAt)
}

func TestRoomTransferCalculationStructure(t *testing.T) {
	t.Parallel()

	calc := model.TransferCalculation{
		ContractID:                 uuid.New(),
		FromRoomNumber:             "A-101",
		FromRoomPriceMinor:         1500000,
		ToRoomNumber:               "B-205",
		ToRoomPriceMinor:           2000000,
		EffectiveDate:              "2026-11-01",
		RentDifferenceMinor:        500000,
		DepositDifferenceMinor:     500000,
		MoveFeeMinor:               50000,
		TenantCreditBalanceMinor:   100000,
		CreditAppliedMinor:         100000,
		NetTotalAdjustmentMinor:    950000,
		Currency:                   "IDR",
	}

	assert.Equal(t, "A-101", calc.FromRoomNumber)
	assert.Equal(t, "B-205", calc.ToRoomNumber)
	assert.Equal(t, int64(950000), calc.NetTotalAdjustmentMinor)
	assert.Equal(t, "IDR", calc.Currency)
}
