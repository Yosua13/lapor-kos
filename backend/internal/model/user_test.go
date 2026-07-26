package model

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestUserDoesNotSerializeIdentityDocumentLocations(t *testing.T) {
	ktpURL := "https://storage.example.test/ktp.jpg"
	selfieURL := "https://storage.example.test/selfie.jpg"
	additionalURL := "https://storage.example.test/supporting.pdf"

	payload, err := json.Marshal(User{
		Name:             "Tenant Test",
		KtpURL:           &ktpURL,
		SelfieURL:        &selfieURL,
		AdditionalDocURL: &additionalURL,
	})
	if err != nil {
		t.Fatalf("marshal user: %v", err)
	}

	serialized := string(payload)
	for _, sensitiveField := range []string{"ktp_url", "selfie_url", "additional_doc_url", "storage.example.test"} {
		if strings.Contains(serialized, sensitiveField) {
			t.Fatalf("serialized user exposes %q: %s", sensitiveField, serialized)
		}
	}
}
