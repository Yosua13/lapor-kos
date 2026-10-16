package complaint

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/gin-gonic/gin"
)

func HandleCreateComplaint(uc *usecase.CreateComplaintUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		var comp complaint.Complaint
		if err := c.ShouldBindJSON(&comp); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		res, err := uc.Execute(c.Request.Context(), usecase.CreateComplaintInput{
			Complaint: &comp,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, res)
	}
}
