package checkout

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleRecordInspections(uc *usecase.RecordInspectionsUseCase) gin.HandlerFunc {
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

		var req checkout.RecordInspectionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		res, err := uc.Execute(c.Request.Context(), usecase.RecordInspectionsInput{
			PropertyID: scope.PropertyID,
			CheckoutID: id,
			ActorID:    scope.ActorID,
			Request:    req,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Inspection recorded successfully",
			"data":    res,
		})
	}
}
