package payment

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleListPayments(uc *usecase.ListPaymentsUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, _ := c.Get("user_role")
		userIDVal, _ := c.Get("user_id")
		isTenant := userRole == "tenant"

		var userID uuid.UUID
		if uid, ok := userIDVal.(uuid.UUID); ok {
			userID = uid
		}

		var propID uuid.UUID
		if scope, ok := middleware.GetPropertyScope(c); ok {
			propID = scope.PropertyID
		}

		filterStatus := strings.TrimSpace(c.Query("status"))
		month, _ := strconv.Atoi(c.Query("month"))
		year, _ := strconv.Atoi(c.Query("year"))
		contractIDStr := strings.TrimSpace(c.Query("contract_id"))
		userIDStr := strings.TrimSpace(c.Query("user_id"))

		payments, err := uc.Execute(c.Request.Context(), usecase.ListPaymentsInput{
			PropertyID: propID,
			UserID:     userID,
			IsTenant:   isTenant,
			Status:     filterStatus,
			Month:      month,
			Year:       year,
			ContractID: contractIDStr,
			UserIDStr:  userIDStr,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, payments)
	}
}
