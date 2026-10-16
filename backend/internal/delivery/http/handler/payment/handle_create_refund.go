package payment

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/gin-gonic/gin"
)

func HandleCreateRefund(uc *usecase.CreateRefundUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		var req payment.CreateRefundRequestPayload
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		refund, err := uc.Execute(c.Request.Context(), usecase.CreateRefundInput{
			PropertyID: scope.PropertyID,
			ActorID:    scope.ActorID,
			Request:    req,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, refund)
	}
}
