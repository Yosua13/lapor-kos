package visitor

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/visitor"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CancelPermitRequest struct {
	Reason *string `json:"reason"`
}

func HandleCancelVisitorPermit(uc *usecase.CancelVisitorPermitUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid permit ID"})
			return
		}

		var req CancelPermitRequest
		_ = c.ShouldBindJSON(&req)

		res, err := uc.Execute(c.Request.Context(), usecase.CancelVisitorPermitInput{
			ID:       id,
			ActorID:  scope.ActorID,
			IsTenant: false,
			Reason:   req.Reason,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
