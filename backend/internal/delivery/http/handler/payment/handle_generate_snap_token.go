package payment

import (
	"errors"
	"net/http"

	domainpayment "github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func HandleGenerateSnapToken(uc *usecase.GenerateSnapTokenUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID"})
			return
		}

		userIDVal, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var userID uuid.UUID
		switch v := userIDVal.(type) {
		case uuid.UUID:
			userID = v
		case string:
			userID, err = uuid.Parse(v)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
				return
			}
		default:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		var reqBody struct {
			ForceNew        bool   `json:"force_new"`
			PreviousOrderID string `json:"previous_order_id"`
		}
		_ = c.ShouldBindJSON(&reqBody)
		forceNew := reqBody.ForceNew || c.Query("force_new") == "true" || c.Query("force_new") == "1"
		prevOrderID := reqBody.PreviousOrderID
		if prevOrderID == "" {
			prevOrderID = c.Query("previous_order_id")
		}

		res, err := uc.Execute(c.Request.Context(), usecase.GenerateSnapTokenInput{
			PaymentID:       id,
			UserID:          userID,
			ForceNew:        forceNew,
			PreviousOrderID: prevOrderID,
		})
		if err != nil {
			switch {
			case errors.Is(err, pgx.ErrNoRows):
				c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
			case errors.Is(err, domainpayment.ErrPaymentNotPayable), errors.Is(err, domainpayment.ErrInvalidSnapRequest):
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			case errors.Is(err, domainpayment.ErrGatewayNotConfigured):
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			default:
				c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to generate Snap token: " + err.Error()})
			}
			return
		}

		c.JSON(http.StatusOK, res)
	}
}

