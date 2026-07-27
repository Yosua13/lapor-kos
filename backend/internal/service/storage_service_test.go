package service

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

const tenantDocumentTestCredential = "test-service-key-not-for-url-or-errors"

func TestNewStorageServiceTenantDocumentConfigDoesNotDependOnGenericBucket(t *testing.T) {
	t.Setenv("SUPABASE_URL", "https://storage.example.test")
	t.Setenv("SUPABASE_SERVICE_KEY", tenantDocumentTestCredential)
	t.Setenv("SUPABASE_BUCKET", "")
	t.Setenv("SUPABASE_TENANT_DOCUMENT_BUCKET", "tenant-documents")

	storage := NewStorageService()

	if storage.IsConfigured() {
		t.Fatal("generic storage must remain unconfigured without SUPABASE_BUCKET")
	}
	if !storage.IsTenantDocumentConfigured() {
		t.Fatal("tenant document storage must be configured from SUPABASE_TENANT_DOCUMENT_BUCKET")
	}
}

func TestUploadTenantDocumentUsesDedicatedBucket(t *testing.T) {
	propertyID := uuid.MustParse("a4b01bf0-47a2-49af-aa9c-81bca4094987")
	tenantProfileID := uuid.MustParse("d1950112-4f1a-42dc-9cdd-68dc34f16f29")
	tenantBucket := "tenant-documents"
	expectedPathPrefix := "/storage/v1/object/" + tenantBucket + "/properties/" + propertyID.String() + "/tenant-profiles/" + tenantProfileID.String() + "/"

	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			t.Error("tenant document upload must use POST")
		}
		if !strings.HasPrefix(request.URL.EscapedPath(), expectedPathPrefix) {
			t.Error("tenant document upload did not use the dedicated bucket and namespace")
		}
		if strings.Contains(request.URL.String(), tenantDocumentTestCredential) {
			t.Error("tenant document upload URL must not expose service credentials")
		}
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Error("tenant document upload body could not be read")
		}
		if strings.Contains(string(body), tenantDocumentTestCredential) {
			t.Error("tenant document upload body must not expose service credentials")
		}
		if request.Header.Get("Authorization") != "Bearer "+tenantDocumentTestCredential {
			t.Error("tenant document upload must authenticate with the service key header")
		}

		response.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	storage := &StorageService{
		supabaseURL:          server.URL,
		serviceKey:           tenantDocumentTestCredential,
		bucket:               "",
		tenantDocumentBucket: tenantBucket,
		httpClient:           server.Client(),
	}

	uploaded, err := storage.UploadTenantDocument(testTenantDocumentFileHeader(t), propertyID, tenantProfileID, "ktp")
	if err != nil {
		t.Fatal("tenant document upload should succeed")
	}
	if !strings.HasPrefix(uploaded.ObjectKey, "properties/"+propertyID.String()+"/tenant-profiles/"+tenantProfileID.String()+"/") {
		t.Fatal("tenant document object key must remain in the tenant profile namespace")
	}
}

func TestCreateTenantDocumentSignedURLUsesDedicatedBucket(t *testing.T) {
	propertyID := uuid.MustParse("60c99bc6-9ee9-4bca-a07b-3ff8b0ca0d1b")
	tenantProfileID := uuid.MustParse("2eeb5bd0-0d15-43aa-90d5-5c2fd26b83ca")
	objectKey := "properties/" + propertyID.String() + "/tenant-profiles/" + tenantProfileID.String() + "/ktp.png"
	tenantBucket := "tenant-documents"
	expectedPath := "/storage/v1/object/sign/" + tenantBucket + "/" + objectKey

	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			t.Error("tenant document signing must use POST")
		}
		if request.URL.EscapedPath() != expectedPath {
			t.Error("tenant document signing did not use the dedicated bucket")
		}
		if strings.Contains(request.URL.String(), tenantDocumentTestCredential) {
			t.Error("tenant document signing URL must not expose service credentials")
		}
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Error("tenant document signing body could not be read")
		}
		if strings.Contains(string(body), tenantDocumentTestCredential) {
			t.Error("tenant document signing body must not expose service credentials")
		}
		if request.Header.Get("Authorization") != "Bearer "+tenantDocumentTestCredential {
			t.Error("tenant document signing must authenticate with the service key header")
		}
		if string(body) != `{"expiresIn":300}` {
			t.Error("tenant document signing must request the requested expiry")
		}

		response.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(response, `{"signedURL":"/object/sign/tenant-documents/signed-ktp.png?token=test"}`)
	}))
	defer server.Close()

	storage := &StorageService{
		supabaseURL:          server.URL,
		serviceKey:           tenantDocumentTestCredential,
		bucket:               "",
		tenantDocumentBucket: tenantBucket,
		httpClient:           server.Client(),
	}

	signedURL, err := storage.CreateTenantDocumentSignedURL(objectKey, 5*time.Minute)
	if err != nil {
		t.Fatal("tenant document signing should succeed")
	}
	if signedURL != server.URL+"/storage/v1/object/sign/tenant-documents/signed-ktp.png?token=test" {
		t.Fatal("tenant document signing returned an unexpected URL")
	}
}

func TestTenantDocumentSigningErrorDoesNotExposeServiceCredential(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		http.Error(response, "storage service unavailable", http.StatusInternalServerError)
	}))
	defer server.Close()

	storage := &StorageService{
		supabaseURL:          server.URL,
		serviceKey:           tenantDocumentTestCredential,
		tenantDocumentBucket: "tenant-documents",
		httpClient:           server.Client(),
	}

	_, err := storage.CreateTenantDocumentSignedURL("properties/test/tenant-profiles/test/ktp.png", time.Minute)
	if err == nil {
		t.Fatal("tenant document signing should return an error when storage rejects the request")
	}
	if strings.Contains(err.Error(), tenantDocumentTestCredential) {
		t.Fatal("tenant document signing errors must not expose service credentials")
	}
}

func testTenantDocumentFileHeader(t *testing.T) *multipart.FileHeader {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("document", "identity.png")
	if err != nil {
		t.Fatal("test document form file could not be created")
	}
	_, err = part.Write([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x00, 0x00, 0x00, 0x0d, 'I', 'H', 'D', 'R'})
	if err != nil {
		t.Fatal("test document contents could not be written")
	}
	if err := writer.Close(); err != nil {
		t.Fatal("test document multipart body could not be closed")
	}

	request := httptest.NewRequest(http.MethodPost, "/", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	if err := request.ParseMultipartForm(MaxUploadSizeBytes); err != nil {
		t.Fatal("test document multipart body could not be parsed")
	}
	file, header, err := request.FormFile("document")
	if err != nil {
		t.Fatal("test document file header could not be read")
	}
	_ = file.Close()
	return header
}
