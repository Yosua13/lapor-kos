package handler

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Yosua13/lapor-kos/backend/internal/authz"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PropertyRepositoryContract interface {
	CreateWithOwner(context.Context, uuid.UUID, *model.Property) (*model.PropertyAccess, error)
	ListForUser(context.Context, uuid.UUID) ([]model.PropertyAccess, error)
	Update(context.Context, uuid.UUID, model.UpdatePropertyRequest) (*model.Property, error)
	ListMembers(context.Context, uuid.UUID) ([]model.PropertyMember, error)
	AddMemberByEmail(context.Context, uuid.UUID, uuid.UUID, string, model.PropertyRole, []string) (*model.PropertyMember, error)
	UpdateMember(context.Context, uuid.UUID, uuid.UUID, model.UpdatePropertyMemberRequest) (*model.PropertyMember, error)
	RevokeMember(context.Context, uuid.UUID, uuid.UUID) error
}

type PropertyHandler struct {
	repo PropertyRepositoryContract
}

func NewPropertyHandler(repo PropertyRepositoryContract) *PropertyHandler {
	return &PropertyHandler{repo: repo}
}

func (h *PropertyHandler) ListProperties(c *gin.Context) {
	actorID, ok := propertyActorID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	properties, err := h.repo.ListForUser(c.Request.Context(), actorID)
	if err != nil {
		writePropertyError(c, err)
		return
	}
	for index := range properties {
		properties[index].Permissions = authz.EffectivePermissions(properties[index].Role, properties[index].Permissions)
	}
	c.JSON(http.StatusOK, gin.H{"properties": properties})
}

func (h *PropertyHandler) CreateProperty(c *gin.Context) {
	actorID, ok := propertyActorID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var request model.CreatePropertyRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid property payload"})
		return
	}
	property, err := normalizeNewProperty(request)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	access, err := h.repo.CreateWithOwner(c.Request.Context(), actorID, property)
	if err != nil {
		writePropertyError(c, err)
		return
	}
	access.Permissions = authz.EffectivePermissions(access.Role, access.Permissions)
	c.JSON(http.StatusCreated, gin.H{"property": access})
}

func (h *PropertyHandler) UpdateProperty(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}

	var request model.UpdatePropertyRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid property payload"})
		return
	}
	if err := normalizePropertyUpdate(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	property, err := h.repo.Update(c.Request.Context(), scope.PropertyID, request)
	if err != nil {
		writePropertyError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"property": property})
}

func (h *PropertyHandler) ListMembers(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}

	members, err := h.repo.ListMembers(c.Request.Context(), scope.PropertyID)
	if err != nil {
		writePropertyError(c, err)
		return
	}
	for index := range members {
		members[index].Permissions = authz.EffectivePermissions(members[index].Role, members[index].Permissions)
	}
	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (h *PropertyHandler) AddMember(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}

	var request model.AddPropertyMemberRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member payload"})
		return
	}
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))
	if request.Email == "" || !request.Role.Valid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A valid email and property role are required"})
		return
	}
	permissions, err := authz.NormalizePermissions(request.Permissions)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "One or more permissions are not supported"})
		return
	}

	member, err := h.repo.AddMemberByEmail(
		c.Request.Context(),
		scope.PropertyID,
		scope.ActorID,
		request.Email,
		request.Role,
		permissions,
	)
	if err != nil {
		writePropertyError(c, err)
		return
	}
	member.Permissions = authz.EffectivePermissions(member.Role, member.Permissions)
	c.JSON(http.StatusCreated, gin.H{"member": member})
}

func (h *PropertyHandler) UpdateMember(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}
	membershipID, err := propertyMembershipID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid membership ID"})
		return
	}

	var request model.UpdatePropertyMemberRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member payload"})
		return
	}
	if request.Role == nil && request.Status == nil && request.Permissions == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one member field must be provided"})
		return
	}
	if request.Role != nil && !request.Role.Valid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported property role"})
		return
	}
	if request.Status != nil && !request.Status.Valid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported membership status"})
		return
	}
	if request.Permissions != nil {
		normalized, normalizeErr := authz.NormalizePermissions(*request.Permissions)
		if normalizeErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "One or more permissions are not supported"})
			return
		}
		request.Permissions = &normalized
	}

	member, err := h.repo.UpdateMember(c.Request.Context(), scope.PropertyID, membershipID, request)
	if err != nil {
		writePropertyError(c, err)
		return
	}
	member.Permissions = authz.EffectivePermissions(member.Role, member.Permissions)
	c.JSON(http.StatusOK, gin.H{"member": member})
}

func (h *PropertyHandler) DeleteMember(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}
	membershipID, err := propertyMembershipID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid membership ID"})
		return
	}

	if err := h.repo.RevokeMember(c.Request.Context(), scope.PropertyID, membershipID); err != nil {
		writePropertyError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Property member revoked successfully"})
}

func propertyActorID(c *gin.Context) (uuid.UUID, bool) {
	value, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}
	switch typed := value.(type) {
	case string:
		parsed, err := uuid.Parse(typed)
		return parsed, err == nil
	case uuid.UUID:
		return typed, typed != uuid.Nil
	default:
		return uuid.Nil, false
	}
}

func propertyMembershipID(c *gin.Context) (uuid.UUID, error) {
	value := c.Param("membership_id")
	if value == "" {
		value = c.Param("member_id")
	}
	return uuid.Parse(value)
}

func normalizeNewProperty(request model.CreatePropertyRequest) (*model.Property, error) {
	name := strings.TrimSpace(request.Name)
	if name == "" {
		return nil, errors.New("Property name is required")
	}
	if utf8.RuneCountInString(name) > 255 {
		return nil, errors.New("Property name is too long")
	}
	timezone := strings.TrimSpace(request.Timezone)
	if timezone == "" {
		timezone = model.DefaultPropertyTimezone
	}
	if _, err := time.LoadLocation(timezone); err != nil {
		return nil, errors.New("Unsupported property timezone")
	}
	currency := strings.ToUpper(strings.TrimSpace(request.Currency))
	if currency == "" {
		currency = model.DefaultPropertyCurrency
	}
	if !validCurrency(currency) {
		return nil, errors.New("Currency must be a three-letter ISO code")
	}
	return &model.Property{
		Name:     name,
		Address:  strings.TrimSpace(request.Address),
		Timezone: timezone,
		Currency: currency,
		Status:   model.PropertyStatusDraft,
	}, nil
}

func normalizePropertyUpdate(request *model.UpdatePropertyRequest) error {
	if request.Name == nil && request.Address == nil && request.Timezone == nil && request.Currency == nil && request.Status == nil && request.WhatsAppGroupLink == nil {
		return errors.New("At least one property field must be provided")
	}
	if request.Name != nil {
		name := strings.TrimSpace(*request.Name)
		if name == "" {
			return errors.New("Property name cannot be empty")
		}
		if utf8.RuneCountInString(name) > 255 {
			return errors.New("Property name is too long")
		}
		request.Name = &name
	}
	if request.Address != nil {
		address := strings.TrimSpace(*request.Address)
		request.Address = &address
	}
	if request.Timezone != nil {
		timezone := strings.TrimSpace(*request.Timezone)
		if timezone == "" {
			return errors.New("Property timezone cannot be empty")
		}
		if _, err := time.LoadLocation(timezone); err != nil {
			return errors.New("Unsupported property timezone")
		}
		request.Timezone = &timezone
	}
	if request.Currency != nil {
		currency := strings.ToUpper(strings.TrimSpace(*request.Currency))
		if !validCurrency(currency) {
			return errors.New("Currency must be a three-letter ISO code")
		}
		request.Currency = &currency
	}
	if request.Status != nil && !request.Status.Valid() {
		return errors.New("Unsupported property status")
	}
	if request.WhatsAppGroupLink != nil {
		link := strings.TrimSpace(*request.WhatsAppGroupLink)
		request.WhatsAppGroupLink = &link
	}
	return nil
}

func validCurrency(value string) bool {
	if len(value) != 3 {
		return false
	}
	for _, character := range value {
		if character < 'A' || character > 'Z' {
			return false
		}
	}
	return true
}

func writePropertyError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repository.ErrPropertyNotFound),
		errors.Is(err, repository.ErrPropertyAccessNotFound),
		errors.Is(err, repository.ErrPropertyMemberNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Property resource not found"})
	case errors.Is(err, repository.ErrPropertyUserNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "User is not available for membership"})
	case errors.Is(err, repository.ErrPropertyMemberExists):
		c.JSON(http.StatusConflict, gin.H{"error": "User is already a property member"})
	case errors.Is(err, repository.ErrLastPropertyOwner):
		c.JSON(http.StatusConflict, gin.H{"error": "Property must keep at least one active owner"})
	default:
		// Keep database details out of the response, but retain the original
		// error in the server log so a failed migration or schema mismatch can
		// be diagnosed without reproducing the request in the browser.
		log.Printf("property operation failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Property operation failed"})
	}
}
