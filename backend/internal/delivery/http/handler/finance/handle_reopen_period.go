package finance

import (
	"net/http"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/gin-gonic/gin"
)

func HandleReopenPeriod(uc *usecase.ReopenPeriodUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		periodKey := strings.TrimSpace(c.Param("period_key"))
		var req finance.ReopenPeriodRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		closure, err := uc.Execute(c.Request.Context(), usecase.ReopenPeriodInput{
			PropertyID:   scope.PropertyID,
			ReopenedByID: scope.ActorID,
			PeriodKey:    periodKey,
			Request:      req,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, closure)
	}
}
