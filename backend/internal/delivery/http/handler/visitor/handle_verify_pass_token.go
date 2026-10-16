package visitor

import (
	"net/http"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/visitor"
	"github.com/gin-gonic/gin"
)

func HandleVerifyPassToken(uc *usecase.VerifyPassTokenUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Param("token")
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "pass token is required"})
			return
		}

		res, err := uc.Execute(c.Request.Context(), token)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
