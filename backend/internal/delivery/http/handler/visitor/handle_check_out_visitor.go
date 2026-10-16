package visitor

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/visitor"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CheckOutRequest struct {
	Notes *string `json:"notes"`
}

func HandleCheckOutVisitor(uc *usecase.CheckOutVisitorUseCase) gin.HandlerFunc {
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

		var req CheckOutRequest
		_ = c.ShouldBindJSON(&req)

		res, err := uc.Execute(c.Request.Context(), usecase.CheckOutVisitorInput{
			PropertyID: scope.PropertyID,
			ID:         id,
			ActorID:    scope.ActorID,
			Notes:      req.Notes,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
