package complaint

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UpdateStatusRequest struct {
	Status string  `json:"status" binding:"required"`
	Notes  *string `json:"notes"`
}

func HandleUpdateStatus(uc *usecase.UpdateStatusUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid complaint ID"})
			return
		}

		var req UpdateStatusRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		err = uc.Execute(c.Request.Context(), usecase.UpdateStatusInput{
			ID:         id,
			PropertyID: scope.PropertyID,
			Status:     req.Status,
			ActorID:    &scope.ActorID,
			ActorName:  "",
			ActorRole:  string(scope.Role),
			Notes:      req.Notes,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "status updated successfully"})
	}
}
