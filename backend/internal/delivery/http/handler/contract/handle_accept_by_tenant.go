package contract

import (
	"net/http"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/contract"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleAcceptByTenant(uc *usecase.AcceptByTenantUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		tenantID := userIDVal.(uuid.UUID)

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid contract ID"})
			return
		}

		err = uc.Execute(c.Request.Context(), usecase.AcceptByTenantInput{
			ActorID:    tenantID,
			ContractID: id,
			SourceIP:   c.ClientIP(),
			UserAgent:  c.Request.UserAgent(),
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "contract accepted successfully"})
	}
}
