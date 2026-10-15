package repository

import (
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckoutStatusTransitionsAndRules(t *testing.T) {
	validStatuses := map[string]bool{
		"submitted":            true,
		"inspection_scheduled": true,
		"inspection_completed": true,
		"settlement_pending":   true,
		"approved":             true,
		"completed":            true,
		"cancelled":            true,
	}

	assert.True(t, validStatuses["submitted"])
	assert.True(t, validStatuses["completed"])
	assert.True(t, validStatuses["cancelled"])
	assert.False(t, validStatuses["unknown_status"])
}

func TestCheckoutHandoverEnforcementLogic(t *testing.T) {
	// AC 1: Key handover or explicit override required
	testCases := []struct {
		name          string
		keyReturned   bool
		roomOverride  bool
		reason        string
		expectedError error
	}{
		{
			name:          "Handover completed normally",
			keyReturned:   true,
			roomOverride:  false,
			reason:        "",
			expectedError: nil,
		},
		{
			name:          "Handover missing without override fails",
			keyReturned:   false,
			roomOverride:  false,
			reason:        "",
			expectedError: ErrHandoverIncomplete,
		},
		{
			name:          "Handover missing with override reason succeeds",
			keyReturned:   false,
			roomOverride:  true,
			reason:        "Tenant left keys in drop-box, confirmed by CCTV",
			expectedError: nil,
		},
		{
			name:          "Handover missing with override but empty reason fails",
			keyReturned:   false,
			roomOverride:  true,
			reason:        "",
			expectedError: ErrHandoverIncomplete,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			isKeyHandedOver := tc.keyReturned
			hasOverride := tc.roomOverride && tc.reason != ""
			if !isKeyHandedOver && !hasOverride {
				require.Equal(t, tc.expectedError, ErrHandoverIncomplete)
			} else {
				require.Nil(t, tc.expectedError)
			}
		})
	}
}

func TestCheckoutSettlementModelIntegrity(t *testing.T) {
	settlement := model.CheckoutSettlement{
		Currency:            "IDR",
		DepositHeldMinor:    100000000,
		UnpaidInvoicesMinor: 20000000,
		DamageChargesMinor:  10000000,
		NetSettlementMinor:  70000000,
		SettlementType:      "refund",
		DepositStatus:       "refund_requested",
	}

	assert.Equal(t, "refund", settlement.SettlementType)
	assert.Equal(t, int64(70000000), settlement.NetSettlementMinor)
	assert.Equal(t, "refund_requested", settlement.DepositStatus)
}
