package contract

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/contract"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RenewRequest struct {
	Child  contract.Contract `json:"child" binding:"required"`
	Reason string            `json:"reason" binding:"required"`
}

func HandleRenewContract(uc *usecase.RenewContractUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid contract ID"})
			return
		}

		var req RenewRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		err = uc.Execute(c.Request.Context(), usecase.RenewContractInput{
			PropertyID: scope.PropertyID,
			ActorID:    scope.ActorID,
			ContractID: id,
			Child:      &req.Child,
			Reason:     req.Reason,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "contract renewed successfully"})
	}
}
