package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

type redisSessionCheckerStub struct {
	sessionReaderStub
	redisRevoked bool
	redisErr     error
	redisCalled  bool
	dbCalled     bool
}

func (r *redisSessionCheckerStub) IsSessionRevoked(context.Context, uuid.UUID, ...time.Time) (bool, error) {
	r.redisCalled = true
	return r.redisRevoked, r.redisErr
}

func (r *redisSessionCheckerStub) IsSessionValid(ctx context.Context, u uuid.UUID, t time.Time) (bool, error) {
	r.dbCalled = true
	return r.sessionReaderStub.IsSessionValid(ctx, u, t)
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

func TestAuthMiddleware_FastPathRedisAndFallback(t *testing.T) {
	t.Setenv("JWT_SECRET", "fast-path-secret")
	gin.SetMode(gin.TestMode)
	userID := uuid.New()

	createToken := func() string {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": userID.String(),
			"iat": time.Now().Unix(),
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		signed, err := token.SignedString([]byte("fast-path-secret"))
		require.NoError(t, err)
		return signed
	}

	// 1. Fast Redis check: Not revoked (DB should NOT be called!)
	stubValid := &redisSessionCheckerStub{
		sessionReaderStub: sessionReaderStub{active: true, valid: true},
		redisRevoked:      false,
		redisErr:          nil,
	}
	router1 := gin.New()
	router1.Use(AuthMiddleware(stubValid))
	router1.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	req1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req1.Header.Set("Authorization", "Bearer "+createToken())
	resp1 := httptest.NewRecorder()
	router1.ServeHTTP(resp1, req1)

	assert.Equal(t, http.StatusOK, resp1.Code)
	assert.True(t, stubValid.redisCalled, "redis should be called")
	assert.False(t, stubValid.dbCalled, "database should NOT be touched for normal sessions")

	// 2. Fast Redis check: Revoked (Immediate 401 without DB query)
	stubRevoked := &redisSessionCheckerStub{
		sessionReaderStub: sessionReaderStub{active: true, valid: true},
		redisRevoked:      true,
		redisErr:          nil,
	}
	router2 := gin.New()
	router2.Use(AuthMiddleware(stubRevoked))
	router2.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	req2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req2.Header.Set("Authorization", "Bearer "+createToken())
	resp2 := httptest.NewRecorder()
	router2.ServeHTTP(resp2, req2)

	assert.Equal(t, http.StatusUnauthorized, resp2.Code)
	assert.True(t, stubRevoked.redisCalled)
	assert.False(t, stubRevoked.dbCalled)

	// 3. Fallback: Redis error -> DB is checked gracefully!
	stubError := &redisSessionCheckerStub{
		sessionReaderStub: sessionReaderStub{active: true, valid: true},
		redisRevoked:      false,
		redisErr:          errors.New("redis timeout"),
	}
	router3 := gin.New()
	router3.Use(AuthMiddleware(stubError))
	router3.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	req3 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req3.Header.Set("Authorization", "Bearer "+createToken())
	resp3 := httptest.NewRecorder()
	router3.ServeHTTP(resp3, req3)

	assert.Equal(t, http.StatusOK, resp3.Code)
	assert.True(t, stubError.redisCalled)
	assert.True(t, stubError.dbCalled, "database should be called as fallback when redis errors")
}
