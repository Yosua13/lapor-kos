package room_transfer

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/gin-gonic/gin"
)

func HandleCreateTransfer(uc *usecase.CreateTransferUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		var req room_transfer.CreateTransferRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		res, err := uc.Execute(c.Request.Context(), usecase.CreateTransferInput{
			PropertyID: scope.PropertyID,
			ActorID:    scope.ActorID,
			Request:    req,
			IsTenant:   false,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, res)
	}
}
