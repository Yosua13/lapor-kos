package contract

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/contract"
	"github.com/gin-gonic/gin"
)

type AmendRequest struct {
	Amended contract.Contract `json:"amended" binding:"required"`
	Reason  string            `json:"reason" binding:"required"`
}

func HandleAmendContract(uc *usecase.AmendContractUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		var req AmendRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		err := uc.Execute(c.Request.Context(), usecase.AmendContractInput{
			PropertyID: scope.PropertyID,
			ActorID:    scope.ActorID,
			Amended:    &req.Amended,
			Reason:     req.Reason,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "contract amended successfully"})
	}
}
