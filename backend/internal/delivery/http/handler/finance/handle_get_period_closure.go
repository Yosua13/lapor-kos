package finance

import (
	"net/http"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/gin-gonic/gin"
)

func HandleGetPeriodClosure(uc *usecase.GetPeriodClosureUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		periodKey := strings.TrimSpace(c.Param("period_key"))
		closure, err := uc.Execute(c.Request.Context(), usecase.GetPeriodClosureInput{
			PropertyID: scope.PropertyID,
			PeriodKey:  periodKey,
		})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, closure)
	}
}
