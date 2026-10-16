package finance

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleUpdateExpense(uc *usecase.UpdateExpenseUseCase) gin.HandlerFunc {
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

		var req finance.UpdateExpenseRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		expense, err := uc.Execute(c.Request.Context(), usecase.UpdateExpenseInput{
			PropertyID: scope.PropertyID,
			ExpenseID:  id,
			ActorID:    scope.ActorID,
			Request:    req,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, expense)
	}
}
