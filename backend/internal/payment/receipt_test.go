package payment

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestGenerateReceiptNumber(t *testing.T) {
	id := uuid.MustParse("11111111-2222-3333-4444-555555555555")
	now := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	num := GenerateReceiptNumber(now, id)
	require.Equal(t, "REC-202610-11111111", num)
}

func TestReceiptChecksumIntegrity(t *testing.T) {
	snapshot := map[string]interface{}{
		"receipt_number": "REC-202610-11111111",
		"total_minor":    int64(1500000),
		"currency":       "IDR",
		"tenant_name":    "Budi Santoso",
		"room_number":    "101",
	}

	checksum, err := ComputeChecksum(snapshot)
	require.NoError(t, err)
	require.NotEmpty(t, checksum)
	require.Len(t, checksum, 64)

	// Valid checksum
	isValid := VerifyChecksum(snapshot, checksum)
	require.True(t, isValid, "checksum should match untampered snapshot")

	// Tampered snapshot should fail verification
	tampered := map[string]interface{}{
		"receipt_number": "REC-202610-11111111",
		"total_minor":    int64(2000000), // modified amount
		"currency":       "IDR",
		"tenant_name":    "Budi Santoso",
		"room_number":    "101",
	}
	isTamperedValid := VerifyChecksum(tampered, checksum)
	require.False(t, isTamperedValid, "tampered snapshot must fail checksum verification")
}
