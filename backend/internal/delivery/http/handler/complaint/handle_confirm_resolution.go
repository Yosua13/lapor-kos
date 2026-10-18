package complaint

import (
	"net/http"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ConfirmResolutionRequest struct {
	Comment *string `json:"comment"`
}

func HandleConfirmResolution(uc *usecase.ConfirmResolutionUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		userID := userIDVal.(uuid.UUID)

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid complaint ID"})
			return
		}

		var req ConfirmResolutionRequest
		_ = c.ShouldBindJSON(&req)

		err = uc.Execute(c.Request.Context(), usecase.ConfirmResolutionInput{
			ID:      id,
			UserID:  userID,
			Comment: req.Comment,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "complaint resolution confirmed"})
	}
}
