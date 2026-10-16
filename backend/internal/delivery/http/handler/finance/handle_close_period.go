package finance

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/gin-gonic/gin"
)

func HandleClosePeriod(uc *usecase.ClosePeriodUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		var req finance.ClosePeriodRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		closure, err := uc.Execute(c.Request.Context(), usecase.ClosePeriodInput{
			PropertyID: scope.PropertyID,
			ClosedByID: scope.ActorID,
			Request:    req,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, closure)
	}
}
