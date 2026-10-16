package visitor

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/visitor"
	"github.com/gin-gonic/gin"
)

func HandleListVisitorPermits(uc *usecase.ListVisitorPermitsUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		filter := visitor.VisitorPermitFilter{
			PropertyID: scope.PropertyID,
		}

		list, total, err := uc.Execute(c.Request.Context(), usecase.ListVisitorPermitsInput{
			Filter:   filter,
			IsTenant: false,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"data":  list,
			"total": total,
		})
	}
}
