package payment

import (
	"errors"
	"net/http"

	domainpayment "github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func HandleMidtransWebhook(uc *usecase.ProcessMidtransWebhookUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		var notif domainpayment.MidtransWebhookNotification
		if err := c.ShouldBindJSON(&notif); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		res, err := uc.Execute(c.Request.Context(), notif)
		if err != nil {
			switch {
			case errors.Is(err, domainpayment.ErrInvalidWebhookSignature):
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature key"})
			case errors.Is(err, domainpayment.ErrInvalidSnapRequest):
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			case errors.Is(err, domainpayment.ErrGatewayNotConfigured):
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			case errors.Is(err, pgx.ErrNoRows):
				c.JSON(http.StatusNotFound, gin.H{"error": "Payment bill not found for order_id"})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process Midtrans webhook: " + err.Error()})
			}
			return
		}

		statusLabel := "processed"
		if res.IsDuplicate {
			statusLabel = "already_processed"
		}

		c.JSON(http.StatusOK, gin.H{
			"status":         statusLabel,
			"is_duplicate":   res.IsDuplicate,
			"payment_status": res.MappedStatus,
			"payment":        res.Payment,
		})
	}
}

