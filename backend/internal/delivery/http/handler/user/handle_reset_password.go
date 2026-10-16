package user

import (
	"net/http"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/user"
	"github.com/gin-gonic/gin"
)

type ResetPasswordRequest struct {
	Email           string `json:"email" binding:"required,email"`
	NewPasswordHash string `json:"new_password" binding:"required"`
}

func HandleResetPassword(uc *usecase.ResetPasswordUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ResetPasswordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		err := uc.Execute(c.Request.Context(), usecase.ResetPasswordInput{
			Email:           req.Email,
			NewPasswordHash: req.NewPasswordHash,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "password reset successfully"})
	}
}
