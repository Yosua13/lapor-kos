package service

import (
	"os"
	"testing"
)

func TestNewEmailService(t *testing.T) {
	os.Setenv("SMTP_HOST", "smtp.test.com")
	os.Setenv("SMTP_PORT", "587")
	os.Setenv("SMTP_USER", "user@test.com")
	os.Setenv("SMTP_PASS", "pass")
	os.Setenv("SMTP_SENDER", "Sender <sender@test.com>")
	os.Setenv("FRONTEND_URL", "http://test.com")

	svc := NewEmailService()

	if svc.host != "smtp.test.com" {
		t.Errorf("expected host smtp.test.com, got %s", svc.host)
	}
	if svc.port != 587 {
		t.Errorf("expected port 587, got %d", svc.port)
	}
	if svc.user != "user@test.com" {
		t.Errorf("expected user user@test.com, got %s", svc.user)
	}
	if svc.frontendURL != "http://test.com" {
		t.Errorf("expected frontendURL http://test.com, got %s", svc.frontendURL)
	}
}
