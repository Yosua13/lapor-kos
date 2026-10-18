package contract

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/contract"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleGetContractDetail(uc *usecase.GetContractDetailUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid contract ID"})
			return
		}

		res, err := uc.Execute(c.Request.Context(), usecase.GetContractDetailInput{
			PropertyID: scope.PropertyID,
			ContractID: id,
		})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
