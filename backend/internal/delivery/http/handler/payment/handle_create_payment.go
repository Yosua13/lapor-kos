package payment

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/gin-gonic/gin"
)

func HandleCreatePayment(uc *usecase.CreatePaymentUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		var p payment.Payment
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		p.PropertyID = scope.PropertyID
		p.OwnerID = &scope.ActorID

		res, err := uc.Execute(c.Request.Context(), usecase.CreatePaymentInput{Payment: &p})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, res)
	}
}
