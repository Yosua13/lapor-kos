package complaint

import (
	"net/http"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ReopenRequest struct {
	Reason string `json:"reason" binding:"required"`
}

func HandleReopenComplaint(uc *usecase.ReopenComplaintUseCase) gin.HandlerFunc {
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

		var req ReopenRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "reason is required"})
			return
		}

		err = uc.Execute(c.Request.Context(), usecase.ReopenComplaintInput{
			ID:     id,
			UserID: userID,
			Reason: req.Reason,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "complaint reopened successfully"})
	}
}
