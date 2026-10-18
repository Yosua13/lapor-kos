package finance

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleApproveAdjustment(uc *usecase.ApproveAdjustmentUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		id, err := uuid.Parse(c.Param("adjustment_id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid adjustment ID format"})
			return
		}

		var req finance.ApproveAdjustmentRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		adj, err := uc.Execute(c.Request.Context(), usecase.ApproveAdjustmentInput{
			PropertyID:   scope.PropertyID,
			AdjustmentID: id,
			ApproverID:   scope.ActorID,
			Request:      req,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, adj)
	}
}
