package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockSecurityAuditRepo struct {
	mock.Mock
}

func (m *mockSecurityAuditRepo) RecordFinancialAudit(ctx context.Context, entry model.FinancialAuditLog) error {
	args := m.Called(ctx, entry)
	return args.Error(0)
}

func (m *mockSecurityAuditRepo) ListFinancialAudits(ctx context.Context, filter model.FinancialAuditFilter) (*model.FinancialAuditListResult, error) {
	args := m.Called(ctx, filter)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.FinancialAuditListResult), args.Error(1)
}

func (m *mockSecurityAuditRepo) RevokeUserSession(ctx context.Context, userID, revokedBy uuid.UUID, reason string) error {
	args := m.Called(ctx, userID, revokedBy, reason)
	return args.Error(0)
}

func (m *mockSecurityAuditRepo) CheckDatabaseHealth(ctx context.Context) (model.DatabaseHealth, error) {
	args := m.Called(ctx)
	return args.Get(0).(model.DatabaseHealth), args.Error(1)
}

func (m *mockSecurityAuditRepo) GetSecurityChecklist(ctx context.Context, propertyID uuid.UUID) (*model.SecurityChecklist, error) {
	args := m.Called(ctx, propertyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.SecurityChecklist), args.Error(1)
}

type mockRedisPinger struct {
	health model.DependencyHealth
}

func (m *mockRedisPinger) Ping(ctx context.Context) model.DependencyHealth {
	return m.health
}

type mockRabbitPinger struct {
	health model.DependencyHealth
}

func (m *mockRabbitPinger) Ping() model.DependencyHealth {
	return m.health
}

func TestSecurityAuditHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("LivenessCheck returns 200 alive", func(t *testing.T) {
		h := NewSecurityAuditHandler(nil, nil, nil)
		r := gin.New()
		r.GET("/healthz", h.LivenessCheck)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/healthz", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), `"status":"alive"`)
	})

	t.Run("ReadinessCheck returns ready when database is connected", func(t *testing.T) {
		mockRepo := new(mockSecurityAuditRepo)
		mockRepo.On("CheckDatabaseHealth", mock.Anything).Return(model.DatabaseHealth{
			Status:          "connected",
			LatencyMs:       1.5,
			TotalConns:      5,
			LatestMigration: "030",
		}, nil)

		h := NewSecurityAuditHandler(mockRepo, nil, nil)
		r := gin.New()
		r.GET("/readyz", h.ReadinessCheck)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/readyz", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), `"status":"ready"`)
		assert.Contains(t, w.Body.String(), `"latest_migration":"030"`)
		assert.Contains(t, w.Body.String(), `"redis":{"status":"disabled"`)
		assert.Contains(t, w.Body.String(), `"rabbitmq":{"status":"disabled"`)
	})

	t.Run("ReadinessCheck with connected Redis and RabbitMQ returns ready", func(t *testing.T) {
		mockRepo := new(mockSecurityAuditRepo)
		mockRepo.On("CheckDatabaseHealth", mock.Anything).Return(model.DatabaseHealth{
			Status:          "connected",
			LatencyMs:       1.5,
			TotalConns:      5,
			LatestMigration: "030",
		}, nil)

		h := NewSecurityAuditHandler(mockRepo, nil, nil).WithInfrastructure(
			&mockRedisPinger{health: model.DependencyHealth{Status: model.DependencyStatusConnected, Enabled: true, LatencyMs: 0.5}},
			&mockRabbitPinger{health: model.DependencyHealth{Status: model.DependencyStatusConnected, Enabled: true, LatencyMs: 1.2}},
		)
		r := gin.New()
		r.GET("/readyz", h.ReadinessCheck)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/readyz", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), `"status":"ready"`)
		assert.Contains(t, w.Body.String(), `"redis":{"status":"connected"`)
		assert.Contains(t, w.Body.String(), `"rabbitmq":{"status":"connected"`)
	})

	t.Run("ReadinessCheck with disconnected Redis degrades gracefully with 200 OK", func(t *testing.T) {
		mockRepo := new(mockSecurityAuditRepo)
		mockRepo.On("CheckDatabaseHealth", mock.Anything).Return(model.DatabaseHealth{
			Status:          "connected",
			LatencyMs:       1.5,
			TotalConns:      5,
			LatestMigration: "030",
		}, nil)

		h := NewSecurityAuditHandler(mockRepo, nil, nil).WithInfrastructure(
			&mockRedisPinger{health: model.DependencyHealth{Status: model.DependencyStatusDisconnected, Enabled: true, Error: "timeout"}},
			&mockRabbitPinger{health: model.DependencyHealth{Status: model.DependencyStatusConnected, Enabled: true}},
		)
		r := gin.New()
		r.GET("/readyz", h.ReadinessCheck)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/readyz", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), `"status":"degraded"`)
		assert.Contains(t, w.Body.String(), `"redis":{"status":"disconnected"`)
	})

	t.Run("ListFinancialAudits returns property scoped audits", func(t *testing.T) {
		mockRepo := new(mockSecurityAuditRepo)
		propertyID := uuid.New()

		mockRepo.On("ListFinancialAudits", mock.Anything, mock.MatchedBy(func(f model.FinancialAuditFilter) bool {
			return f.PropertyID == propertyID
		})).Return(&model.FinancialAuditListResult{
			Items: []model.FinancialAuditLog{
				{
					ID:            uuid.New(),
					PropertyID:    propertyID,
					Action:        "payment_verify",
					EntityType:    "payment",
					AmountMinor:   1500000,
					Reason:        "Verified",
					CorrelationID: "req-123",
					CreatedAt:     time.Now().UTC(),
				},
			},
			Total:      1,
			Page:       1,
			PageSize:   25,
			TotalPages: 1,
		}, nil)

		h := NewSecurityAuditHandler(mockRepo, nil, nil)
		r := gin.New()

		r.GET("/api/audit/financial", func(c *gin.Context) {
			// Mock property scope
			c.Set("property_scope", model.PropertyScope{
				PropertyID: propertyID,
				ActorID:    uuid.New(),
				Role:       model.PropertyRoleOwner,
			})
			c.Next()
		}, h.ListFinancialAudits)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/audit/financial", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), `"payment_verify"`)
		assert.Contains(t, w.Body.String(), `"req-123"`)
	})

	t.Run("GetMetrics returns runtime and connection stats", func(t *testing.T) {
		mockRepo := new(mockSecurityAuditRepo)
		mockRepo.On("CheckDatabaseHealth", mock.Anything).Return(model.DatabaseHealth{
			Status:     "connected",
			LatencyMs:  0.8,
			TotalConns: 4,
		}, nil)

		h := NewSecurityAuditHandler(mockRepo, nil, nil)
		r := gin.New()
		r.GET("/api/metrics", h.GetMetrics)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/metrics", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), `"goroutines"`)
		assert.Contains(t, w.Body.String(), `"database"`)
	})

	t.Run("RevokeSession rejects invalid body", func(t *testing.T) {
		h := NewSecurityAuditHandler(nil, nil, nil)
		r := gin.New()
		r.POST("/api/security/sessions/revoke", h.RevokeSession)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/api/security/sessions/revoke", strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
