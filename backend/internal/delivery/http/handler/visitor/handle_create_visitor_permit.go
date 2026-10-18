package visitor

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/visitor"
	"github.com/gin-gonic/gin"
)

func HandleCreateVisitorPermit(uc *usecase.CreateVisitorPermitUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		var permit visitor.VisitorPermit
		if err := c.ShouldBindJSON(&permit); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		res, err := uc.Execute(c.Request.Context(), usecase.CreateVisitorPermitInput{
			Permit: &permit,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, res)
	}
}
