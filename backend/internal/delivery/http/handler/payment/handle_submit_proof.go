package payment

import (
	"net/http"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleSubmitProof(uc *usecase.SubmitPaymentProofUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID format"})
			return
		}

		userIDVal, _ := c.Get("user_id")
		userID, ok := userIDVal.(uuid.UUID)
		if !ok || userID == uuid.Nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User context is required"})
			return
		}

		var req struct {
			ProofURL  string  `json:"proof_url"`
			Method    string  `json:"method"`
			TotalPaid float64 `json:"total_paid"`
			Notes     string  `json:"notes"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := uc.Execute(c.Request.Context(), usecase.SubmitPaymentProofInput{
			ID:        id,
			UserID:    userID,
			ProofURL:  req.ProofURL,
			Method:    req.Method,
			TotalPaid: req.TotalPaid,
			Notes:     req.Notes,
		}); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Payment proof submitted successfully"})
	}
}
