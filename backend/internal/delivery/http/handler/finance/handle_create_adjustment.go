package finance

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleCreateAdjustment(uc *usecase.CreateAdjustmentUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		var req struct {
			PeriodCloseID  string `json:"period_close_id"`
			AdjustmentType string `json:"adjustment_type" binding:"required"`
			AmountMinor    int64  `json:"amount_minor" binding:"required"`
			Reason         string `json:"reason" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		closeID, err := uuid.Parse(req.PeriodCloseID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Valid period_close_id is required"})
			return
		}

		adj, err := uc.Execute(c.Request.Context(), usecase.CreateAdjustmentInput{
			PropertyID:    scope.PropertyID,
			RequestedByID: scope.ActorID,
			PeriodCloseID: closeID,
			Request: finance.CreatePeriodAdjustmentRequest{
				AdjustmentType: req.AdjustmentType,
				AmountMinor:    req.AmountMinor,
				Reason:         req.Reason,
			},
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, adj)
	}
}
