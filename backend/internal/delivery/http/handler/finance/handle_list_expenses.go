package finance

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/gin-gonic/gin"
)

func HandleListExpenses(uc *usecase.ListExpensesUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

		filter := finance.ExpenseFilter{
			Category:  strings.TrimSpace(c.Query("category")),
			Status:    strings.TrimSpace(c.Query("status")),
			VendorID:  strings.TrimSpace(c.Query("vendor_id")),
			StartDate: strings.TrimSpace(c.Query("start_date")),
			EndDate:   strings.TrimSpace(c.Query("end_date")),
			Search:    strings.TrimSpace(c.Query("search")),
			Page:      page,
			PageSize:  pageSize,
		}

		out, err := uc.Execute(c.Request.Context(), usecase.ListExpensesInput{
			PropertyID: scope.PropertyID,
			Filter:     filter,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"data":      out.Expenses,
			"total":     out.Total,
			"page":      page,
			"page_size": pageSize,
		})
	}
}
