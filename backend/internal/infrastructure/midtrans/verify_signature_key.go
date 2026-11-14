package midtrans

import (
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"strings"
)

// VerifySignatureKey validates Midtrans webhook notification authenticity using
// SHA512(order_id + status_code + gross_amount + server_key).
func (c *Client) VerifySignatureKey(orderID, statusCode, grossAmount, signatureKey string) bool {
	if !c.IsConfigured() || strings.TrimSpace(signatureKey) == "" {
		return false
	}
	raw := orderID + statusCode + grossAmount + c.serverKey
	hash := sha512.Sum512([]byte(raw))
	expected := hex.EncodeToString(hash[:])
	return subtle.ConstantTimeCompare(
		[]byte(strings.ToLower(expected)),
		[]byte(strings.ToLower(strings.TrimSpace(signatureKey))),
	) == 1
}

