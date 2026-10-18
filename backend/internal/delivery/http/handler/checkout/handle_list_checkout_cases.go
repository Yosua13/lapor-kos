package checkout

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/gin-gonic/gin"
)

func HandleListCheckoutCases(uc *usecase.ListCheckoutCasesUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

		filter := checkout.CheckoutListFilter{
			Status:    strings.TrimSpace(c.Query("status")),
			StartDate: strings.TrimSpace(c.Query("start_date")),
			EndDate:   strings.TrimSpace(c.Query("end_date")),
			Page:      page,
			PageSize:  pageSize,
		}

		res, err := uc.Execute(c.Request.Context(), usecase.ListCheckoutCasesInput{
			PropertyID: scope.PropertyID,
			Filter:     filter,
			IsTenant:   false,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, res)
	}
}
