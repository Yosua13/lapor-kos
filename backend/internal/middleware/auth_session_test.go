package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type sessionReaderStub struct {
	active bool
	valid  bool
}

func (s sessionReaderStub) IsUserActive(context.Context, uuid.UUID) (bool, error) {
	return s.active, nil
}

func (s sessionReaderStub) IsSessionValid(context.Context, uuid.UUID, time.Time) (bool, error) {
	return s.valid, nil
}

func TestAuthMiddlewareRejectsRevokedSession(t *testing.T) {
	t.Setenv("JWT_SECRET", "tenant-session-test-secret")
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID.String(),
		"iat": time.Now().Add(-time.Minute).Unix(),
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	signed, err := token.SignedString([]byte("tenant-session-test-secret"))
	if err != nil {
		t.Fatalf("sign JWT: %v", err)
	}

	router := gin.New()
	router.Use(AuthMiddleware(sessionReaderStub{active: true, valid: false}))
	router.GET("/private", func(c *gin.Context) { c.Status(http.StatusOK) })
	request := httptest.NewRequest(http.MethodGet, "/private", nil)
	request.Header.Set("Authorization", "Bearer "+signed)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body=%s", response.Code, http.StatusUnauthorized, response.Body.String())
	}
	if body := response.Body.String(); body != `{"error":"Session has been revoked"}` {
		t.Fatalf("unexpected response body: %s", body)
	}
}

func TestAuthMiddlewareAllowsSessionIssuedAfterRevocation(t *testing.T) {
	t.Setenv("JWT_SECRET", "tenant-session-test-secret")
	gin.SetMode(gin.TestMode)
	userID := uuid.New()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID.String(),
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	signed, err := token.SignedString([]byte("tenant-session-test-secret"))
	if err != nil {
		t.Fatalf("sign JWT: %v", err)
	}

	router := gin.New()
	router.Use(AuthMiddleware(sessionReaderStub{active: true, valid: true}))
	router.GET("/private", func(c *gin.Context) { c.Status(http.StatusOK) })
	request := httptest.NewRequest(http.MethodGet, "/private", nil)
	request.Header.Set("Authorization", "Bearer "+signed)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", response.Code, http.StatusOK, response.Body.String())
	}
}
