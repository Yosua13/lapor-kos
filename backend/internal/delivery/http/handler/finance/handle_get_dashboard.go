package finance

import (
	"net/http"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/gin-gonic/gin"
)

func HandleGetDashboard(uc *usecase.GetDashboardUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		periodStart := strings.TrimSpace(c.Query("period_start"))
		periodEnd := strings.TrimSpace(c.Query("period_end"))

		summary, err := uc.Execute(c.Request.Context(), usecase.GetDashboardInput{
			PropertyID:  scope.PropertyID,
			PeriodStart: periodStart,
			PeriodEnd:   periodEnd,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, summary)
	}
}
