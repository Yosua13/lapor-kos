package checkout

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleGetCheckoutCase(uc *usecase.GetCheckoutCaseUseCase) gin.HandlerFunc {
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

		res, err := uc.Execute(c.Request.Context(), usecase.GetCheckoutCaseInput{
			ID:         id,
			PropertyID: scope.PropertyID,
			IsTenant:   false,
		})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": res})
	}
}
