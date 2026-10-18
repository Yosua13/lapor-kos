package checkout

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/gin-gonic/gin"
)

func HandleCreateCheckoutNotice(uc *usecase.CreateCheckoutNoticeUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		var req checkout.CreateCheckoutNoticeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		res, err := uc.Execute(c.Request.Context(), usecase.CreateCheckoutNoticeInput{
			PropertyID: scope.PropertyID,
			ActorID:    scope.ActorID,
			Request:    req,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "Checkout notice submitted successfully",
			"data":    res,
		})
	}
}
