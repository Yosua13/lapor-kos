package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type ActiveUserReader interface {
	IsUserActive(context.Context, uuid.UUID) (bool, error)
}

func AuthMiddleware(activeUserReaders ...ActiveUserReader) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		tokenString := ""

		if authHeader != "" {
			parts := strings.Fields(authHeader)
			if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
				tokenString = parts[1]
			}
		}

		if tokenString == "" {
			if cookie, err := c.Cookie("auth_token"); err == nil {
				tokenString = cookie
			}
		}

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token is required"})
			c.Abort()
			return
		}
		secret, err := jwtSecret()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Authentication is not configured"})
			c.Abort()
			return
		}

		token, err := jwt.ParseWithClaims(tokenString, jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
			if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, fmt.Errorf("unexpected signing method: %s", token.Header["alg"])
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		userID, ok := claims["sub"].(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in token"})
			c.Abort()
			return
		}
		if len(activeUserReaders) > 0 && activeUserReaders[0] != nil {
			parsedUserID, parseErr := uuid.Parse(userID)
			if parseErr != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
				c.Abort()
				return
			}
			active, lookupErr := activeUserReaders[0].IsUserActive(c.Request.Context(), parsedUserID)
			if lookupErr != nil || !active {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Account is inactive"})
				c.Abort()
				return
			}
		}

		c.Set("user_id", userID)
		c.Next()
	}
}

func jwtSecret() (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret != "" {
		return secret, nil
	}
	if os.Getenv("APP_ENV") == "production" || os.Getenv("GIN_MODE") == gin.ReleaseMode {
		return "", fmt.Errorf("JWT_SECRET is required in production")
	}
	return "dev-only-lapor-kos-secret-change-me", nil
}
