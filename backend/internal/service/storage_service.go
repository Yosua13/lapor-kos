package service

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

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

// UploadFile uploads a file from a multipart.FileHeader to Supabase Storage and returns the public URL.
// prefix is an optional prefix string (e.g., "ktp", "selfie", "payment") for the filename.
func (s *StorageService) UploadFile(fileHeader *multipart.FileHeader, prefix string) (string, error) {
	if !s.IsConfigured() {
		return "", fmt.Errorf("supabase storage is not configured")
	}
	if fileHeader.Size > MaxUploadSizeBytes {
		return "", fmt.Errorf("file is too large, maximum size is 5MB")
	}

	// Open the uploaded file
	src, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer src.Close()

	// Read file contents with a hard limit so malicious clients cannot exhaust memory.
	fileBytes, err := io.ReadAll(io.LimitReader(src, MaxUploadSizeBytes+1))
	if err != nil {
		return "", fmt.Errorf("failed to read uploaded file: %w", err)
	}
	if int64(len(fileBytes)) > MaxUploadSizeBytes {
		return "", fmt.Errorf("file is too large, maximum size is 5MB")
	}

	contentType := http.DetectContentType(fileBytes)
	ext, ok := allowedUploadExtensions[contentType]
	if !ok {
		return "", fmt.Errorf("unsupported file type")
	}

	// Generate a unique filename
	filename := fmt.Sprintf("%s_%d_%s%s", sanitizeUploadPrefix(prefix), time.Now().UnixNano(), uuid.New().String(), ext)

	// Build the Supabase Storage upload URL
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.supabaseURL, s.bucket, filename)

	// Create and send the HTTP PUT request
	req, err := http.NewRequest(http.MethodPost, uploadURL, bytes.NewReader(fileBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create upload request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "true")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to upload file to supabase: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("supabase upload failed (status %d): %s", resp.StatusCode, string(body))
	}

	// Build and return the public URL
	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", s.supabaseURL, s.bucket, filename)
	return publicURL, nil
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
