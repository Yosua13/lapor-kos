package payment

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleGetPayment(uc *usecase.GetPaymentUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID format"})
			return
		}

		userRole, _ := c.Get("user_role")
		userIDVal, _ := c.Get("user_id")
		isTenant := userRole == "tenant"

		var userID uuid.UUID
		if uid, ok := userIDVal.(uuid.UUID); ok {
			userID = uid
		}

		var propID uuid.UUID
		if scope, ok := middleware.GetPropertyScope(c); ok {
			propID = scope.PropertyID
		}

		res, err := uc.Execute(c.Request.Context(), usecase.GetPaymentInput{
			ID:         id,
			PropertyID: propID,
			UserID:     userID,
			IsTenant:   isTenant,
		})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
