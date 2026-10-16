package complaint

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleGetComplaint(uc *usecase.GetComplaintUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid complaint ID"})
			return
		}

		res, err := uc.Execute(c.Request.Context(), usecase.GetComplaintInput{
			ID:         id,
			PropertyID: scope.PropertyID,
			IsTenant:   false,
		})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
