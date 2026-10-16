package complaint

import (
	"net/http"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TriageRequest struct {
	Priority         string     `json:"priority" binding:"required"`
	Impact           string     `json:"impact" binding:"required"`
	AccessWindow     *string    `json:"access_window"`
	FirstResponseDue *time.Time `json:"first_response_due"`
	ResolutionDue    *time.Time `json:"resolution_due"`
	Reason           *string    `json:"reason"`
}

func HandleTriageComplaint(uc *usecase.TriageComplaintUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
			return
		}

		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid complaint ID"})
			return
		}

		var req TriageRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		err = uc.Execute(c.Request.Context(), usecase.TriageInput{
			ID:               id,
			PropertyID:       scope.PropertyID,
			Priority:         req.Priority,
			Impact:           req.Impact,
			AccessWindow:     req.AccessWindow,
			FirstResponseDue: req.FirstResponseDue,
			ResolutionDue:    req.ResolutionDue,
			ActorID:          &scope.ActorID,
			ActorName:        "",
			ActorRole:        string(scope.Role),
			Reason:           req.Reason,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "complaint triaged successfully"})
	}
}
