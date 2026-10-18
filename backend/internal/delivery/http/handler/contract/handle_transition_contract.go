package contract

import (
	"net/http"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/contract"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleTransitionContract(uc *usecase.TransitionContractUseCase) gin.HandlerFunc {
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

		var req contract.ContractTransitionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var effectiveDate *time.Time
		if req.EffectiveDate != "" {
			if parsed, err := time.Parse("2006-01-02", req.EffectiveDate); err == nil {
				effectiveDate = &parsed
			}
		}

		err = uc.Execute(c.Request.Context(), usecase.TransitionContractInput{
			PropertyID:    scope.PropertyID,
			ActorID:       scope.ActorID,
			ContractID:    id,
			ToStatus:      req.ToStatus,
			Reason:        req.Reason,
			EffectiveDate: effectiveDate,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "contract status updated successfully"})
	}
}
