package checkout

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ApproveSettlementRequest struct {
	Notes string `json:"notes"`
}

func HandleApproveSettlement(uc *usecase.ApproveSettlementUseCase) gin.HandlerFunc {
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

		var req ApproveSettlementRequest
		_ = c.ShouldBindJSON(&req)

		res, err := uc.Execute(c.Request.Context(), usecase.ApproveSettlementInput{
			PropertyID: scope.PropertyID,
			CheckoutID: id,
			ActorID:    scope.ActorID,
			Notes:      req.Notes,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Settlement approved successfully",
			"data":    res,
		})
	}
}
