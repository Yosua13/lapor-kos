package handler

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"log"
	"net"
	"net/http"
	"net/mail"
	"os"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type TenantLifecycleHandler struct {
	repo     *repository.TenantLifecycleRepository
	users    repository.UserRepo
	email    service.EmailServiceInterface
	whatsApp service.WhatsAppServiceInterface
	storage  *service.StorageService
}

func NewTenantLifecycleHandler(repo *repository.TenantLifecycleRepository, users repository.UserRepo, email service.EmailServiceInterface, whatsApp service.WhatsAppServiceInterface, storage *service.StorageService) *TenantLifecycleHandler {
	return &TenantLifecycleHandler{repo: repo, users: users, email: email, whatsApp: whatsApp, storage: storage}
}

func (h *TenantLifecycleHandler) CreateInvitation(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}
	var req model.CreateTenantInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.DeliveryMethod = strings.ToLower(strings.TrimSpace(req.DeliveryMethod))
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Phone = normalizeIndonesianPhone(req.Phone)
	if req.DeliveryMethod != "email" && req.DeliveryMethod != "whatsapp" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Delivery method must be email or WhatsApp"})
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A valid email is required"})
		return
	}
	if req.Phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A valid Indonesian WhatsApp number is required"})
		return
	}
	hours := req.ExpiresInHours
	if hours == 0 {
		hours = 72
	}
	if hours < 1 || hours > 24*14 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invitation expiry must be between 1 hour and 14 days"})
		return
	}
	token, err := secureToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invitation"})
		return
	}
	invitation, err := h.repo.CreateInvitation(c.Request.Context(), scope.PropertyID, scope.ActorID, req, repository.InvitationDigest(token), time.Now().Add(time.Duration(hours)*time.Hour))
	if err != nil {
		if errors.Is(err, repository.ErrProfileAlreadyActive) {
			c.JSON(http.StatusConflict, gin.H{"error": "Tenant profile is already active"})
			return
		}
		log.Printf("create tenant invitation: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tenant invitation"})
		return
	}
	activationURL := strings.TrimRight(frontendURL(), "/") + "/activate-invitation?token=" + token
	deliveryStatus := "sent"
	var deliveryErr error
	if req.DeliveryMethod == "email" {
		if sender, ok := h.email.(interface{ IsConfigured() bool }); ok && !sender.IsConfigured() {
			deliveryErr = errors.New("SMTP is not configured")
		} else {
			deliveryErr = h.email.SendTenantInvitationEmail(req.Email, activationURL, invitation.ExpiresAt)
		}
	} else {
		if sender, ok := h.whatsApp.(interface{ IsConfigured() bool }); ok && !sender.IsConfigured() {
			deliveryErr = errors.New("WhatsApp gateway is not configured")
		} else {
			_, deliveryErr = h.whatsApp.SendMessage(c.Request.Context(), whatsappTarget(req.Phone), "Halo "+strings.TrimSpace(req.FullName)+", Anda diundang untuk mengaktifkan akun Lapor Kos. Buat kata sandi Anda melalui tautan berikut: "+activationURL+". Tautan berlaku sampai "+invitation.ExpiresAt.In(time.Local).Format("02 Jan 2006 15:04 MST")+".")
		}
	}
	if deliveryErr != nil {
		deliveryStatus = "failed"
		log.Printf("tenant invitation delivery failed (%s): %v", req.DeliveryMethod, deliveryErr)
	}
	c.JSON(http.StatusCreated, gin.H{"invitation": invitation, "delivery": gin.H{"method": req.DeliveryMethod, "status": deliveryStatus}})
}

func (h *TenantLifecycleHandler) ListInvitations(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}
	items, err := h.repo.ListInvitations(c.Request.Context(), scope.PropertyID)
	if err != nil {
		log.Printf("list invitations: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load tenant invitations"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *TenantLifecycleHandler) RevokeInvitation(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invitation ID"})
		return
	}
	if err = h.repo.RevokeInvitation(c.Request.Context(), scope.PropertyID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pending invitation not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *TenantLifecycleHandler) ListProfiles(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}
	profiles, err := h.repo.ListProfiles(c.Request.Context(), scope.PropertyID)
	if err != nil {
		log.Printf("list tenant profiles: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load tenant profiles"})
		return
	}
	c.JSON(http.StatusOK, profiles)
}

func (h *TenantLifecycleHandler) PreviewInvitation(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	invitation, err := h.repo.PreviewInvitation(c.Request.Context(), repository.InvitationDigest(token))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation is invalid, expired, or unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"full_name": invitation.FullName, "email": invitation.Email, "email_required": invitation.Email == "", "expires_at": invitation.ExpiresAt})
}

func (h *TenantLifecycleHandler) ActivateInvitation(c *gin.Context) {
	var req model.ActivateTenantInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.PolicyVersion = strings.TrimSpace(req.PolicyVersion)
	if !req.PolicyAccepted || req.PolicyVersion == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Policy agreement is required"})
		return
	}
	preview, err := h.repo.PreviewInvitation(c.Request.Context(), repository.InvitationDigest(req.Token))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invitation is invalid, expired, or unavailable"})
		return
	}
	activationEmail := strings.ToLower(strings.TrimSpace(preview.Email))
	if activationEmail == "" {
		activationEmail = strings.ToLower(strings.TrimSpace(req.Email))
		if _, emailErr := mail.ParseAddress(activationEmail); emailErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "A valid email is required to create the account"})
			return
		}
	}
	var existingID *uuid.UUID
	existing, lookupErr := h.users.FindByEmail(c.Request.Context(), activationEmail)
	if lookupErr == nil {
		if strings.TrimSpace(req.ExistingPassword) == "" || bcrypt.CompareHashAndPassword([]byte(existing.PasswordHash), []byte(req.ExistingPassword)) != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Existing account verification failed"})
			return
		}
		if !existing.IsVerified || !existing.IsActive {
			c.JSON(http.StatusForbidden, gin.H{"error": "Existing account must be active and contact-verified"})
			return
		}
		existingID = &existing.ID
	} else if !errors.Is(lookupErr, pgx.ErrNoRows) {
		log.Printf("lookup existing tenant identity: %v", lookupErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate existing account"})
		return
	}
	verificationKey := ""
	passwordHash := ""
	if existingID == nil {
		if len(req.Password) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be at least 8 characters"})
			return
		}
		passwordHashBytes, hashErr := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if hashErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to secure password"})
			return
		}
		passwordHash = string(passwordHashBytes)
		verificationKey, err = secureToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to activate invitation"})
			return
		}
	}
	result, err := h.repo.ActivateInvitation(c.Request.Context(), repository.ActivationInput{
		TokenDigest: repository.InvitationDigest(req.Token), PasswordHash: passwordHash, VerificationKey: verificationKey, Email: activationEmail,
		ExistingUserID: existingID, PolicyVersion: req.PolicyVersion, SourceIP: clientIP(c), UserAgent: c.GetHeader("User-Agent"),
	})
	if err != nil {
		if errors.Is(err, repository.ErrInvitationUnavailable) || errors.Is(err, repository.ErrProfileAlreadyActive) {
			c.JSON(http.StatusConflict, gin.H{"error": "Invitation can no longer be activated"})
			return
		}
		log.Printf("activate tenant invitation: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to activate invitation"})
		return
	}
	if result.NewAccount {
		_ = h.email.SendTenantAccountVerificationEmail(result.Email, verificationKey)
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Tenant profile activated", "requires_contact_verification": result.RequiresVerification})
}

func (h *TenantLifecycleHandler) ActivationStatus(c *gin.Context) {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invitation token is required"})
		return
	}
	verified, err := h.repo.IsInvitationActivationVerified(c.Request.Context(), repository.InvitationDigest(token))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation activation was not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"verified": verified})
}

func (h *TenantLifecycleHandler) UploadDocument(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}
	profileID, err := uuid.Parse(c.Param("profile_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tenant profile ID"})
		return
	}
	if h.storage == nil || !h.storage.IsTenantDocumentConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Private document storage is not configured"})
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Document file is required"})
		return
	}
	documentType := c.PostForm("document_type")
	uploaded, err := h.storage.UploadTenantDocument(file, scope.PropertyID, profileID, documentType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Document upload failed: " + err.Error()})
		return
	}
	document, err := h.repo.CreateDocument(c.Request.Context(), scope.PropertyID, profileID, scope.ActorID, documentType, uploaded.ObjectKey, uploaded.MimeType, uploaded.Checksum, uploaded.SizeBytes)
	if err != nil {
		log.Printf("persist tenant document: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save document metadata"})
		return
	}
	c.JSON(http.StatusCreated, document)
}

func (h *TenantLifecycleHandler) ListDocuments(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}
	profileID, err := uuid.Parse(c.Param("profile_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tenant profile ID"})
		return
	}
	documents, err := h.repo.ListDocuments(c.Request.Context(), scope.PropertyID, profileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load documents"})
		return
	}
	c.JSON(http.StatusOK, documents)
}

func (h *TenantLifecycleHandler) SignDocument(c *gin.Context)   { h.signDocument(c, false) }
func (h *TenantLifecycleHandler) SignMyDocument(c *gin.Context) { h.signDocument(c, true) }

func (h *TenantLifecycleHandler) signDocument(c *gin.Context, tenantSelf bool) {
	if h.storage == nil || !h.storage.IsTenantDocumentConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Private document storage is not configured"})
		return
	}
	documentID, err := uuid.Parse(c.Param("document_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}
	actorID, err := requestUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	var propertyID, profileID uuid.UUID
	if tenantSelf {
		propertyID, profileID, err = h.repo.MyDocumentContext(c.Request.Context(), actorID, documentID)
	} else {
		scope, ok := middleware.GetPropertyScope(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
			return
		}
		propertyID = scope.PropertyID
		profileID, err = uuid.Parse(c.Param("profile_id"))
	}
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	objectKey, err := h.repo.DocumentObjectKey(c.Request.Context(), propertyID, profileID, documentID, actorID, tenantSelf, c.GetHeader("X-Request-ID"))
	if err != nil {
		if errors.Is(err, repository.ErrDocumentAuditFailed) {
			log.Printf("audit tenant document access: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to audit document access"})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	url, err := h.storage.CreateTenantDocumentSignedURL(objectKey, 5*time.Minute)
	if err != nil {
		log.Printf("sign tenant document: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to create document access URL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url, "expires_in": 300})
}

func secureToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
func requestUserID(c *gin.Context) (uuid.UUID, error) {
	value, ok := c.Get("user_id")
	if !ok {
		return uuid.Nil, errors.New("missing user")
	}
	return uuid.Parse(value.(string))
}
func clientIP(c *gin.Context) string {
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err == nil {
		return host
	}
	return c.ClientIP()
}

func frontendURL() string {
	if value := strings.TrimSpace(os.Getenv("FRONTEND_URL")); value != "" {
		return value
	}
	return "http://localhost:3000"
}

func normalizeIndonesianPhone(value string) string {
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, value)
	if strings.HasPrefix(digits, "0") {
		digits = "62" + digits[1:]
	}
	if !strings.HasPrefix(digits, "62") || len(digits) < 11 || len(digits) > 14 {
		return ""
	}
	return digits
}

func whatsappTarget(phone string) string { return strings.TrimPrefix(phone, "+") }
