package user

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/user"
	"github.com/gin-gonic/gin"
)

func HandleRegisterUser(uc *usecase.RegisterUserUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		var u user.User
		if err := c.ShouldBindJSON(&u); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		res, err := uc.Execute(c.Request.Context(), usecase.RegisterUserInput{User: &u})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, res)
	}
}
