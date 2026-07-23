package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/authz"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const propertyScopeContextKey = "property_scope"

type PropertyMembershipReader interface {
	FindActiveMembership(context.Context, uuid.UUID, uuid.UUID) (*model.PropertyMembership, error)
}

// RequirePropertyAccess resolves an explicit property context and verifies the
// actor's active membership on every request. The path parameter is canonical;
// X-Property-ID is supported as a compatibility fallback for legacy routes.
func RequirePropertyAccess(repo PropertyMembershipReader, required ...authz.Permission) gin.HandlerFunc {
	return propertyAccessMiddleware(repo, false, required...)
}

// OptionalPropertyAccess leaves tenant self-service routes without an explicit
// property untouched, while applying the exact same membership and permission
// checks whenever the caller supplies a path or header property context.
func OptionalPropertyAccess(repo PropertyMembershipReader, required ...authz.Permission) gin.HandlerFunc {
	return propertyAccessMiddleware(repo, true, required...)
}

func propertyAccessMiddleware(repo PropertyMembershipReader, optional bool, required ...authz.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		propertyID, present, valid := requestedPropertyID(c)
		if !present && optional {
			c.Next()
			return
		}
		if !present || !valid {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "A valid property context is required"})
			return
		}

		actorID, ok := authenticatedActorID(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		membership, err := repo.FindActiveMembership(c.Request.Context(), propertyID, actorID)
		if err != nil {
			if errors.Is(err, repository.ErrPropertyAccessNotFound) || errors.Is(err, repository.ErrPropertyNotFound) {
				c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Property not found"})
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Property authorization failed"})
			return
		}
		if membership == nil || membership.Status != model.MembershipStatusActive {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Property not found"})
			return
		}
		if !authz.HasAll(membership.Role, membership.Permissions, required...) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Insufficient property permission"})
			return
		}

		c.Set(propertyScopeContextKey, model.PropertyScope{
			PropertyID:   propertyID,
			ActorID:      actorID,
			MembershipID: membership.ID,
			Role:         membership.Role,
			Permissions:  authz.EffectivePermissions(membership.Role, membership.Permissions),
		})
		c.Next()
	}
}

func GetPropertyScope(c *gin.Context) (model.PropertyScope, bool) {
	value, exists := c.Get(propertyScopeContextKey)
	if !exists {
		return model.PropertyScope{}, false
	}
	switch scope := value.(type) {
	case model.PropertyScope:
		return scope, true
	case *model.PropertyScope:
		if scope != nil {
			return *scope, true
		}
	}
	return model.PropertyScope{}, false
}

func requestedPropertyID(c *gin.Context) (uuid.UUID, bool, bool) {
	pathValue := strings.TrimSpace(c.Param("property_id"))
	headerValue := strings.TrimSpace(c.GetHeader("X-Property-ID"))

	if pathValue != "" {
		pathID, err := uuid.Parse(pathValue)
		if err != nil || pathID == uuid.Nil {
			return uuid.Nil, true, false
		}
		if headerValue != "" {
			headerID, headerErr := uuid.Parse(headerValue)
			if headerErr != nil || headerID == uuid.Nil || headerID != pathID {
				return uuid.Nil, true, false
			}
		}
		return pathID, true, true
	}

	if headerValue == "" {
		return uuid.Nil, false, false
	}
	headerID, err := uuid.Parse(headerValue)
	if err != nil || headerID == uuid.Nil {
		return uuid.Nil, true, false
	}
	return headerID, true, true
}

func authenticatedActorID(c *gin.Context) (uuid.UUID, bool) {
	value, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}
	switch actor := value.(type) {
	case string:
		parsed, err := uuid.Parse(actor)
		return parsed, err == nil && parsed != uuid.Nil
	case uuid.UUID:
		return actor, actor != uuid.Nil
	default:
		return uuid.Nil, false
	}
}
