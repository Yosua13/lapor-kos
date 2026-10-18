package checkout

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CancelCheckoutRequest struct {
	Reason string `json:"reason" binding:"required"`
}

func HandleCancelCheckout(uc *usecase.CancelCheckoutUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid checkout ID"})
			return
		}

		var req CancelCheckoutRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "reason is required"})
			return
		}

		err = uc.Execute(c.Request.Context(), usecase.CancelCheckoutInput{
			PropertyID: scope.PropertyID,
			CheckoutID: id,
			ActorID:    scope.ActorID,
			Reason:     req.Reason,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Checkout notice cancelled successfully"})
	}
}
