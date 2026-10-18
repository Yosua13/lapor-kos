package room_transfer

import (
	"net/http"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/gin-gonic/gin"
)

func HandleListTransfers(uc *usecase.ListTransfersUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		status := strings.TrimSpace(c.Query("status"))
		res, err := uc.Execute(c.Request.Context(), usecase.ListTransfersInput{
			PropertyID: scope.PropertyID,
			Status:     status,
			IsTenant:   false,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
