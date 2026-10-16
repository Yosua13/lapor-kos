package user

import (
	"net/http"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/user"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleGetUserByID(uc *usecase.GetUserByIDUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
			return
		}

		res, err := uc.Execute(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
