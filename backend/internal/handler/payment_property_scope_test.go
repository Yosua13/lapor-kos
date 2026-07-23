package handler

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type paymentRepoSpy struct {
	gotPropertyID uuid.UUID
	gotActorID    uuid.UUID
	gotPayment    *model.Payment
	createErr     error
	findByIDErr   error
	findForUser   *model.Payment
}

func (s *paymentRepoSpy) Create(_ context.Context, payment *model.Payment) error {
	copy := *payment
	s.gotPayment = &copy
	return s.createErr
}

func (s *paymentRepoSpy) FindByID(_ context.Context, _ uuid.UUID, propertyID uuid.UUID) (*model.Payment, error) {
	s.gotPropertyID = propertyID
	if s.findByIDErr != nil {
		return nil, s.findByIDErr
	}
	return &model.Payment{PropertyID: propertyID}, nil
}

func (s *paymentRepoSpy) FindByIDForUser(_ context.Context, _ uuid.UUID, userID uuid.UUID) (*model.Payment, error) {
	s.gotActorID = userID
	if s.findForUser != nil {
		return s.findForUser, nil
	}
	return nil, pgx.ErrNoRows
}

func (s *paymentRepoSpy) FindAll(_ context.Context, propertyID uuid.UUID, _ string, _, _ int, _, _ string) ([]model.Payment, error) {
	s.gotPropertyID = propertyID
	return []model.Payment{}, nil
}

func (s *paymentRepoSpy) FindByUserID(_ context.Context, userID uuid.UUID) ([]model.Payment, error) {
	s.gotActorID = userID
	return []model.Payment{}, nil
}

func (s *paymentRepoSpy) Update(_ context.Context, propertyID uuid.UUID, payment *model.Payment) (*model.Payment, error) {
	s.gotPropertyID = propertyID
	copy := *payment
	s.gotPayment = &copy
	return &copy, nil
}

func (s *paymentRepoSpy) SubmitProof(_ context.Context, _ uuid.UUID, userID uuid.UUID, _, _ string, _ float64, _ string) error {
	s.gotActorID = userID
	return nil
}

type membershipReaderStub struct {
	actorID uuid.UUID
}

func (s membershipReaderStub) FindActiveMembership(_ context.Context, propertyID, actorID uuid.UUID) (*model.PropertyMembership, error) {
	if actorID != s.actorID {
		return nil, pgx.ErrNoRows
	}
	return &model.PropertyMembership{
		ID:         uuid.New(),
		PropertyID: propertyID,
		UserID:     actorID,
		Role:       model.PropertyRoleOwner,
		Status:     model.MembershipStatusActive,
	}, nil
}

func scopedPaymentRouter(actorID uuid.UUID, spy *paymentRepoSpy, method, path string, handler gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Handle(method, path,
		func(c *gin.Context) {
			c.Set("user_id", actorID.String())
			c.Next()
		},
		middleware.RequirePropertyAccess(membershipReaderStub{actorID: actorID}),
		handler,
	)
	return router
}

func TestPaymentListUsesPropertyScope(t *testing.T) {
	actorID := uuid.New()
	propertyID := uuid.New()
	spy := &paymentRepoSpy{}
	handler := NewPaymentHandler(spy, nil)
	router := scopedPaymentRouter(actorID, spy, http.MethodGet, "/payments", handler.GetAllPayments)

	request := httptest.NewRequest(http.MethodGet, "/payments", nil)
	request.Header.Set("X-Property-ID", propertyID.String())
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}
	if spy.gotPropertyID != propertyID {
		t.Fatalf("repository received property %s, want %s", spy.gotPropertyID, propertyID)
	}
}

func TestPaymentForeignIDIsHiddenAsNotFound(t *testing.T) {
	actorID := uuid.New()
	propertyID := uuid.New()
	spy := &paymentRepoSpy{findByIDErr: pgx.ErrNoRows}
	handler := NewPaymentHandler(spy, nil)
	router := scopedPaymentRouter(actorID, spy, http.MethodGet, "/payments/:id", handler.GetPayment)

	request := httptest.NewRequest(http.MethodGet, "/payments/"+uuid.NewString(), nil)
	request.Header.Set("X-Property-ID", propertyID.String())
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", response.Code, response.Body.String())
	}
	if spy.gotPropertyID != propertyID {
		t.Fatalf("repository received property %s, want %s", spy.gotPropertyID, propertyID)
	}
}

func TestTenantPaymentReadDerivesAccessFromUser(t *testing.T) {
	actorID := uuid.New()
	paymentID := uuid.New()
	spy := &paymentRepoSpy{findForUser: &model.Payment{ID: paymentID}}
	handler := NewPaymentHandler(spy, nil)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/payments/:id", func(c *gin.Context) {
		c.Set("user_id", actorID.String())
		c.Next()
	}, handler.GetPayment)

	request := httptest.NewRequest(http.MethodGet, "/payments/"+paymentID.String(), nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}
	if spy.gotActorID != actorID {
		t.Fatalf("repository received user %s, want %s", spy.gotActorID, actorID)
	}
}

func TestCreatePaymentRejectsForeignContractWithoutLeaking(t *testing.T) {
	actorID := uuid.New()
	propertyID := uuid.New()
	spy := &paymentRepoSpy{createErr: pgx.ErrNoRows}
	handler := NewPaymentHandler(spy, nil)
	router := scopedPaymentRouter(actorID, spy, http.MethodPost, "/payments", handler.CreatePaymentBill)
	body := []byte(`{"contract_id":"` + uuid.NewString() + `","period_month":7,"period_year":2026,"due_date":"2026-07-05"}`)

	request := httptest.NewRequest(http.MethodPost, "/payments", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Property-ID", propertyID.String())
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", response.Code, response.Body.String())
	}
	if spy.gotPayment == nil {
		t.Fatal("expected repository create call")
	}
	if spy.gotPayment.PropertyID != propertyID || spy.gotPayment.OwnerID == nil || *spy.gotPayment.OwnerID != actorID {
		t.Fatalf("payment scope was not derived from middleware: %+v", spy.gotPayment)
	}
}
