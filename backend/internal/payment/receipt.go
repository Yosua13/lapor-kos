package payment

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// GenerateReceiptNumber formats a canonical, human-readable receipt number.
// Example: REC-202610-A1B2C3D4
func GenerateReceiptNumber(now time.Time, paymentID uuid.UUID) string {
	shortID := paymentID.String()[:8]
	return fmt.Sprintf("REC-%s-%s", now.Format("200601"), shortID)
}

// ComputeChecksum calculates a deterministic SHA-256 hash of a receipt snapshot.
func ComputeChecksum(snapshot map[string]interface{}) (string, error) {
	data, err := json.Marshal(snapshot)
	if err != nil {
		return "", fmt.Errorf("failed to marshal receipt snapshot: %w", err)
	}
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:]), nil
}

// VerifyChecksum validates that the stored checksum matches the snapshot data.
func VerifyChecksum(snapshot map[string]interface{}, expectedChecksum string) bool {
	computed, err := ComputeChecksum(snapshot)
	if err != nil {
		return false
	}
	return computed == expectedChecksum
}
