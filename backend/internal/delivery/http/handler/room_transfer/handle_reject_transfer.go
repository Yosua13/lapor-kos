package room_transfer

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RejectRequest struct {
	Reason string `json:"reason" binding:"required"`
}

func HandleRejectTransfer(uc *usecase.RejectTransferUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		transferID, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid transfer ID"})
			return
		}

		var req RejectRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "reason is required"})
			return
		}

		res, err := uc.Execute(c.Request.Context(), usecase.RejectTransferInput{
			PropertyID: scope.PropertyID,
			TransferID: transferID,
			ActorID:    scope.ActorID,
			Reason:     req.Reason,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
