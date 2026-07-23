package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RoleMiddleware(db *pgxpool.Pool, allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		userID, err := uuid.Parse(userIDStr.(string))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
			c.Abort()
			return
		}

		var role string
		err = db.QueryRow(c.Request.Context(), "SELECT role FROM users WHERE id = $1 AND is_active = TRUE", userID).Scan(&role)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: user not found"})
			c.Abort()
			return
		}

		// Check if role is allowed
		allowed := false
		for _, r := range allowedRoles {
			if r == role {
				allowed = true
				break
			}
		}

		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: insufficient permissions"})
			c.Abort()
			return
		}

		c.Set("user_role", role)
		c.Next()
	}
}
