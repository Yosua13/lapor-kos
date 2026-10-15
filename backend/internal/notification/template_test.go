package notification

import (
	"encoding/json"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/stretchr/testify/assert"
)

func TestMaskBankAccount(t *testing.T) {
	assert.Equal(t, "BCA 1234", MaskBankAccount("BCA", "1234"))
	assert.Equal(t, "Mandiri ******7890", MaskBankAccount("Mandiri", "1234567890"))
	assert.Equal(t, "BNI 12", MaskBankAccount("BNI", "12"))
}

func TestRenderTemplate(t *testing.T) {
	t.Run("payment_verified template", func(t *testing.T) {
		payload, _ := json.Marshal(map[string]interface{}{
			"invoice_number": "INV-2026-001",
		})
		rendered := RenderTemplate("payment_verified", payload)
		assert.Equal(t, model.NotificationCategoryBilling, rendered.Category)
		assert.Equal(t, "Pembayaran Terverifikasi", rendered.Title)
		assert.Contains(t, rendered.Message, "INV-2026-001")
		assert.Equal(t, "/payments", rendered.ActionURL)
		assert.Equal(t, "normal", rendered.Priority)
	})

	t.Run("refund_requested masks bank account", func(t *testing.T) {
		payload, _ := json.Marshal(map[string]interface{}{
			"bank_name":      "BCA",
			"account_number": "5420123456",
		})
		rendered := RenderTemplate("refund_requested", payload)
		assert.Equal(t, model.NotificationCategoryBilling, rendered.Category)
		assert.Contains(t, rendered.Message, "BCA ******3456")
		assert.NotContains(t, rendered.Message, "5420123456") // PII masked!
	})

	t.Run("checkout_completed template", func(t *testing.T) {
		payload, _ := json.Marshal(map[string]interface{}{
			"room_number": "102",
		})
		rendered := RenderTemplate("checkout_completed", payload)
		assert.Equal(t, model.NotificationCategoryOperations, rendered.Category)
		assert.Contains(t, rendered.Message, "kamar 102")
		assert.Equal(t, "/checkouts", rendered.ActionURL)
	})

	t.Run("security_alert is urgent priority", func(t *testing.T) {
		payload, _ := json.Marshal(map[string]interface{}{
			"message": "Login baru dari perangkat tak dikenal.",
		})
		rendered := RenderTemplate("security_alert", payload)
		assert.Equal(t, model.NotificationCategorySecurity, rendered.Category)
		assert.Equal(t, "urgent", rendered.Priority)
	})
}
