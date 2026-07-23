package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/authz"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type propertyMembershipReaderStub struct {
	membership *model.PropertyMembership
	err        error
	calls      int
	propertyID uuid.UUID
	userID     uuid.UUID
}

func (s *propertyMembershipReaderStub) FindActiveMembership(_ context.Context, propertyID, userID uuid.UUID) (*model.PropertyMembership, error) {
	s.calls++
	s.propertyID = propertyID
	s.userID = userID
	return s.membership, s.err
}

func TestRequirePropertyAccessAllowsAuthorizedMember(t *testing.T) {
	gin.SetMode(gin.TestMode)
	propertyID := uuid.New()
	actorID := uuid.New()
	membershipID := uuid.New()
	repo := &propertyMembershipReaderStub{membership: &model.PropertyMembership{
		ID:          membershipID,
		PropertyID:  propertyID,
		UserID:      actorID,
		Role:        model.PropertyRoleManager,
		Permissions: []string{},
		Status:      model.MembershipStatusActive,
	}}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", actorID.String())
		c.Next()
	})
	router.GET("/properties/:property_id/rooms", RequirePropertyAccess(repo, authz.PermissionRoomWrite), func(c *gin.Context) {
		scope, ok := GetPropertyScope(c)
		if !ok {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.JSON(http.StatusOK, scope)
	})

	request := httptest.NewRequest(http.MethodGet, "/properties/"+propertyID.String()+"/rooms", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%s", response.Code, http.StatusOK, response.Body.String())
	}
	if repo.calls != 1 || repo.propertyID != propertyID || repo.userID != actorID {
		t.Fatalf("unexpected membership lookup: calls=%d property=%s user=%s", repo.calls, repo.propertyID, repo.userID)
	}
}

func TestRequirePropertyAccessUsesHeaderFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	propertyID := uuid.New()
	actorID := uuid.New()
	repo := &propertyMembershipReaderStub{membership: &model.PropertyMembership{
		ID:         uuid.New(),
		PropertyID: propertyID,
		UserID:     actorID,
		Role:       model.PropertyRoleViewer,
		Status:     model.MembershipStatusActive,
	}}
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", actorID)
		c.Next()
	})
	router.GET("/legacy", RequirePropertyAccess(repo, authz.PermissionPropertyRead), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/legacy", nil)
	request.Header.Set("X-Property-ID", propertyID.String())
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d; body=%s", response.Code, http.StatusNoContent, response.Body.String())
	}
}

func TestRequirePropertyAccessRejectsInvalidContextBeforeLookup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name       string
		path       string
		header     string
		wantStatus int
	}{
		{name: "missing", path: "/legacy", wantStatus: http.StatusBadRequest},
		{name: "invalid header", path: "/legacy", header: "not-a-uuid", wantStatus: http.StatusBadRequest},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repo := &propertyMembershipReaderStub{}
			router := gin.New()
			router.Use(func(c *gin.Context) {
				c.Set("user_id", uuid.New().String())
				c.Next()
			})
			router.GET("/legacy", RequirePropertyAccess(repo), func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			if test.header != "" {
				request.Header.Set("X-Property-ID", test.header)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, test.wantStatus)
			}
			if repo.calls != 0 {
				t.Fatalf("repository was called %d times", repo.calls)
			}
		})
	}
}

func TestRequirePropertyAccessRejectsPathHeaderMismatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &propertyMembershipReaderStub{}
	propertyID := uuid.New()
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", uuid.New().String())
		c.Next()
	})
	router.GET("/properties/:property_id", RequirePropertyAccess(repo), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/properties/"+propertyID.String(), nil)
	request.Header.Set("X-Property-ID", uuid.New().String())
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusBadRequest)
	}
	if repo.calls != 0 {
		t.Fatalf("repository was called %d times", repo.calls)
	}
}

func TestRequirePropertyAccessHidesMissingMembership(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &propertyMembershipReaderStub{err: repository.ErrPropertyAccessNotFound}
	propertyID := uuid.New()
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", uuid.New().String())
		c.Next()
	})
	router.GET("/properties/:property_id", RequirePropertyAccess(repo), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/properties/"+propertyID.String(), nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNotFound)
	}
}

func TestRequirePropertyAccessRejectsInsufficientPermission(t *testing.T) {
	gin.SetMode(gin.TestMode)
	propertyID := uuid.New()
	actorID := uuid.New()
	repo := &propertyMembershipReaderStub{membership: &model.PropertyMembership{
		ID:         uuid.New(),
		PropertyID: propertyID,
		UserID:     actorID,
		Role:       model.PropertyRoleViewer,
		Status:     model.MembershipStatusActive,
	}}
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", actorID.String())
		c.Next()
	})
	router.GET("/properties/:property_id", RequirePropertyAccess(repo, authz.PermissionMembershipManage), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/properties/"+propertyID.String(), nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusForbidden)
	}
}

func TestRequirePropertyAccessReturnsInternalErrorForRepositoryFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &propertyMembershipReaderStub{err: errors.New("database unavailable")}
	propertyID := uuid.New()
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", uuid.New().String())
		c.Next()
	})
	router.GET("/properties/:property_id", RequirePropertyAccess(repo), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/properties/"+propertyID.String(), nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusInternalServerError)
	}
}

func TestOptionalPropertyAccessContinuesWithoutContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &propertyMembershipReaderStub{}
	router := gin.New()
	router.GET("/tenant/self", OptionalPropertyAccess(repo, authz.PermissionPaymentRead), func(c *gin.Context) {
		if _, ok := GetPropertyScope(c); ok {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/tenant/self", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d; body=%s", response.Code, http.StatusNoContent, response.Body.String())
	}
	if repo.calls != 0 {
		t.Fatalf("repository was called %d times", repo.calls)
	}
}

func TestOptionalPropertyAccessRejectsInvalidProvidedContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &propertyMembershipReaderStub{}
	router := gin.New()
	router.GET("/tenant/self", OptionalPropertyAccess(repo), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/tenant/self", nil)
	request.Header.Set("X-Property-ID", "invalid")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusBadRequest)
	}
	if repo.calls != 0 {
		t.Fatalf("repository was called %d times", repo.calls)
	}
}
