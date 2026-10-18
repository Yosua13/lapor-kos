package user

import (
	"net/http"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/user"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UpdateProfileRequest struct {
	Name             string `json:"name" binding:"required"`
	Phone            string `json:"phone"`
	EmergencyContact string `json:"emergency_contact"`
}

func HandleUpdateProfile(uc *usecase.UpdateProfileUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		userID := userIDVal.(uuid.UUID)

		var req UpdateProfileRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		err := uc.Execute(c.Request.Context(), usecase.UpdateProfileInput{
			ID:               userID,
			Name:             req.Name,
			Phone:            req.Phone,
			EmergencyContact: req.EmergencyContact,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "profile updated successfully"})
	}
}
