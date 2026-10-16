package room_transfer

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleExecuteTransfer(uc *usecase.ExecuteTransferUseCase) gin.HandlerFunc {
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

		res, err := uc.Execute(c.Request.Context(), usecase.ExecuteTransferInput{
			PropertyID: scope.PropertyID,
			TransferID: transferID,
			ActorID:    scope.ActorID,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
