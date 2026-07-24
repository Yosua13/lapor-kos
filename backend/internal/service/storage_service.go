package service

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

type UploadedPrivateFile struct {
	ObjectKey string
	MimeType  string
	SizeBytes int64
	Checksum  string
}

const MaxUploadSizeBytes int64 = 5 << 20

var allowedUploadExtensions = map[string]string{
	"application/pdf": ".pdf",
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
}

// StorageService handles file uploads to Supabase Storage.
type StorageService struct {
	supabaseURL string
	serviceKey  string
	bucket      string
	httpClient  *http.Client
}

// NewStorageService creates a new StorageService using environment variables.
func NewStorageService() *StorageService {
	return &StorageService{
		supabaseURL: os.Getenv("SUPABASE_URL"),
		serviceKey:  os.Getenv("SUPABASE_SERVICE_KEY"),
		bucket:      os.Getenv("SUPABASE_BUCKET"),
		httpClient:  &http.Client{Timeout: 30 * time.Second},
	}
}

// IsConfigured returns true if the Supabase Storage environment variables are set.
func (s *StorageService) IsConfigured() bool {
	return s.supabaseURL != "" && s.serviceKey != "" && s.bucket != ""
}

// UploadFile is retained for tenant compatibility. New staff-managed uploads
// must use UploadPropertyFile so an object can never be written outside a
// property namespace. It returns a private object key, not a public URL.
func (s *StorageService) UploadFile(fileHeader *multipart.FileHeader, prefix string) (string, error) {
	return s.uploadPrivateFile(fileHeader, "legacy", prefix)
}

// UploadPropertyFile stores an object in a private, property-specific prefix.
// The returned value is an opaque object key. Call CreateSignedURL only after
// the caller has been authorized for that property.
func (s *StorageService) UploadPropertyFile(fileHeader *multipart.FileHeader, propertyID uuid.UUID, prefix string) (string, error) {
	if propertyID == uuid.Nil {
		return "", fmt.Errorf("property ID is required")
	}
	return s.uploadPrivateFile(fileHeader, "properties/"+propertyID.String(), prefix)
}

// UploadTenantDocument writes identity documents into a non-guessable,
// tenant-specific private namespace. Its metadata is returned for persistence
// in the files table and must never be exposed as a public URL.
func (s *StorageService) UploadTenantDocument(fileHeader *multipart.FileHeader, propertyID, tenantProfileID uuid.UUID, prefix string) (*UploadedPrivateFile, error) {
	if propertyID == uuid.Nil || tenantProfileID == uuid.Nil {
		return nil, fmt.Errorf("property and tenant profile IDs are required")
	}
	return s.uploadPrivateFileMetadata(fileHeader, "properties/"+propertyID.String()+"/tenant-profiles/"+tenantProfileID.String(), prefix)
}

func (s *StorageService) uploadPrivateFile(fileHeader *multipart.FileHeader, namespace, prefix string) (string, error) {
	file, err := s.uploadPrivateFileMetadata(fileHeader, namespace, prefix)
	if err != nil {
		return "", err
	}
	return file.ObjectKey, nil
}

func (s *StorageService) uploadPrivateFileMetadata(fileHeader *multipart.FileHeader, namespace, prefix string) (*UploadedPrivateFile, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("supabase storage is not configured")
	}
	if fileHeader.Size > MaxUploadSizeBytes {
		return nil, fmt.Errorf("file is too large, maximum size is 5MB")
	}

	// Open the uploaded file
	src, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer src.Close()

	// Read file contents with a hard limit so malicious clients cannot exhaust memory.
	fileBytes, err := io.ReadAll(io.LimitReader(src, MaxUploadSizeBytes+1))
	if err != nil {
		return nil, fmt.Errorf("failed to read uploaded file: %w", err)
	}
	if int64(len(fileBytes)) > MaxUploadSizeBytes {
		return nil, fmt.Errorf("file is too large, maximum size is 5MB")
	}

	contentType := http.DetectContentType(fileBytes)
	ext, ok := allowedUploadExtensions[contentType]
	if !ok {
		return nil, fmt.Errorf("unsupported file type")
	}

	// Generate a unique filename
	filename := fmt.Sprintf("%s_%d_%s%s", sanitizeUploadPrefix(prefix), time.Now().UnixNano(), uuid.New().String(), ext)
	objectKey := strings.Trim(namespace, "/") + "/" + filename

	// Build the Supabase Storage upload URL
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", strings.TrimRight(s.supabaseURL, "/"), url.PathEscape(s.bucket), escapeObjectKey(objectKey))

	// Create and send the HTTP PUT request
	req, err := http.NewRequest(http.MethodPost, uploadURL, bytes.NewReader(fileBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create upload request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "false")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to upload file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase upload failed (status %d): %s", resp.StatusCode, string(body))
	}

	checksum := sha256.Sum256(fileBytes)
	return &UploadedPrivateFile{ObjectKey: objectKey, MimeType: contentType, SizeBytes: int64(len(fileBytes)), Checksum: fmt.Sprintf("%x", checksum)}, nil
}

// CreateSignedURL exchanges a private object key for a short-lived URL. The
// caller must authorize property/resource access before invoking this method.
func (s *StorageService) CreateSignedURL(objectKey string, expiresIn time.Duration) (string, error) {
	if !s.IsConfigured() {
		return "", fmt.Errorf("supabase storage is not configured")
	}
	objectKey = strings.TrimSpace(strings.TrimLeft(objectKey, "/"))
	if objectKey == "" || strings.Contains(objectKey, "..") {
		return "", fmt.Errorf("invalid object key")
	}
	seconds := int(expiresIn.Seconds())
	if seconds <= 0 || seconds > 15*60 {
		seconds = 5 * 60
	}
	body := []byte(fmt.Sprintf(`{"expiresIn":%d}`, seconds))
	signURL := fmt.Sprintf("%s/storage/v1/object/sign/%s/%s", strings.TrimRight(s.supabaseURL, "/"), url.PathEscape(s.bucket), escapeObjectKey(objectKey))
	req, err := http.NewRequest(http.MethodPost, signURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to sign storage object: %w", err)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("supabase sign failed (status %d): %s", resp.StatusCode, string(responseBody))
	}
	// Avoid another dependency for a two-field Supabase response.
	var payload struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.Unmarshal(responseBody, &payload); err != nil {
		return "", fmt.Errorf("invalid signed URL response: %w", err)
	}
	if payload.SignedURL == "" {
		return "", fmt.Errorf("signed URL response was empty")
	}
	if strings.HasPrefix(payload.SignedURL, "http://") || strings.HasPrefix(payload.SignedURL, "https://") {
		return payload.SignedURL, nil
	}
	return strings.TrimRight(s.supabaseURL, "/") + "/storage/v1" + payload.SignedURL, nil
}

func escapeObjectKey(key string) string {
	parts := strings.Split(strings.Trim(key, "/"), "/")
	for i := range parts {
		parts[i] = url.PathEscape(parts[i])
	}
	return strings.Join(parts, "/")
}

func sanitizeUploadPrefix(prefix string) string {
	prefix = strings.TrimSpace(strings.ToLower(prefix))
	if prefix == "" {
		return "upload"
	}

	var builder strings.Builder
	for _, r := range prefix {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			builder.WriteRune(r)
		}
	}
	if builder.Len() == 0 {
		return "upload"
	}
	return builder.String()
}
