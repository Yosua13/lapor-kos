package finance

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandlePayExpense(uc *usecase.PayExpenseUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID format"})
			return
		}

		var req struct {
			PaymentMethod string `json:"payment_method"`
		}
		_ = c.ShouldBindJSON(&req)
		if req.PaymentMethod == "" {
			req.PaymentMethod = "cash"
		}

		expense, err := uc.Execute(c.Request.Context(), usecase.PayExpenseInput{
			PropertyID:    scope.PropertyID,
			ExpenseID:     id,
			ActorID:       scope.ActorID,
			PaymentMethod: req.PaymentMethod,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, expense)
	}
}
