package service

import (
	"context"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewMidtransServiceDefaults(t *testing.T) {
	sandboxSvc := NewMidtransServiceWithConfig("SB-Mid-server-123", "SB-Mid-client-123", false, "", nil)
	if !sandboxSvc.IsConfigured() {
		t.Fatal("expected sandbox service to be configured")
	}
	if sandboxSvc.IsProduction() {
		t.Fatal("expected sandbox service IsProduction to be false")
	}
	if sandboxSvc.SnapURL() != DefaultMidtransSandboxSnapURL {
		t.Fatalf("expected sandbox URL %q, got %q", DefaultMidtransSandboxSnapURL, sandboxSvc.SnapURL())
	}

	prodSvc := NewMidtransServiceWithConfig("Mid-server-prod", "Mid-client-prod", true, "", nil)
	if !prodSvc.IsProduction() {
		t.Fatal("expected production service IsProduction to be true")
	}
	if prodSvc.SnapURL() != DefaultMidtransProductionSnapURL {
		t.Fatalf("expected production URL %q, got %q", DefaultMidtransProductionSnapURL, prodSvc.SnapURL())
	}
}

func TestMidtransServiceCreateSnapTransactionSuccess(t *testing.T) {
	serverKey := "SB-Mid-server-testkey999"
	expectedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(serverKey+":"))

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST method, got %s", r.Method)
		}
		if gotAuth := r.Header.Get("Authorization"); gotAuth != expectedAuth {
			t.Errorf("expected Authorization %q, got %q", expectedAuth, gotAuth)
		}
		if gotCT := r.Header.Get("Content-Type"); gotCT != "application/json" {
			t.Errorf("expected Content-Type application/json, got %q", gotCT)
		}
		if gotAccept := r.Header.Get("Accept"); gotAccept != "application/json" {
			t.Errorf("expected Accept application/json, got %q", gotAccept)
		}

		var payload SnapRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("failed to decode request payload: %v", err)
		}
		if payload.TransactionDetails.OrderID != "LK-12345678-1700000000" {
			t.Errorf("unexpected order_id: %s", payload.TransactionDetails.OrderID)
		}
		if payload.TransactionDetails.GrossAmount != 1500000 {
			t.Errorf("unexpected gross_amount: %d", payload.TransactionDetails.GrossAmount)
		}
		if payload.CustomerDetails == nil || payload.CustomerDetails.Email != "tenant@laporkos.id" {
			t.Errorf("unexpected customer_details: %+v", payload.CustomerDetails)
		}
		if len(payload.ItemDetails) != 2 {
			t.Errorf("expected 2 item_details, got %d", len(payload.ItemDetails))
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(SnapResponse{
			Token:       "snap-token-abc-123",
			RedirectURL: "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-token-abc-123",
		})
	}))
	defer ts.Close()

	svc := NewMidtransServiceWithConfig(serverKey, "SB-Mid-client-test", false, ts.URL, ts.Client())

	resp, err := svc.CreateSnapTransaction(context.Background(), SnapRequest{
		TransactionDetails: SnapTransactionDetails{
			OrderID:     "LK-12345678-1700000000",
			GrossAmount: 1500000,
		},
		CustomerDetails: &SnapCustomerDetails{
			FirstName: "Budi",
			LastName:  "Santoso",
			Email:     "tenant@laporkos.id",
			Phone:     "081234567890",
		},
		ItemDetails: []SnapItemDetail{
			{ID: "rent", Name: "Sewa Kamar Bulanan", Price: 1350000, Quantity: 1},
			{ID: "elec", Name: "Tagihan Listrik", Price: 150000, Quantity: 1},
		},
	})
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if resp.Token != "snap-token-abc-123" {
		t.Errorf("expected token snap-token-abc-123, got %s", resp.Token)
	}
	if resp.RedirectURL != "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-token-abc-123" {
		t.Errorf("unexpected redirect_url: %s", resp.RedirectURL)
	}
}

func TestMidtransServiceCreateSnapTransactionValidationAndErrors(t *testing.T) {
	unconfigured := NewMidtransServiceWithConfig("", "", false, "", nil)
	_, err := unconfigured.CreateSnapTransaction(context.Background(), SnapRequest{
		TransactionDetails: SnapTransactionDetails{OrderID: "ORD-1", GrossAmount: 100000},
	})
	if !errors.Is(err, ErrMidtransNotConfigured) {
		t.Fatalf("expected ErrMidtransNotConfigured, got: %v", err)
	}

	svc := NewMidtransServiceWithConfig("SB-Mid-server-valid", "SB-Mid-client-valid", false, "http://localhost:9999", nil)

	// Missing OrderID
	_, err = svc.CreateSnapTransaction(context.Background(), SnapRequest{
		TransactionDetails: SnapTransactionDetails{OrderID: "", GrossAmount: 100000},
	})
	if !errors.Is(err, ErrInvalidSnapRequest) {
		t.Fatalf("expected ErrInvalidSnapRequest for empty order_id, got: %v", err)
	}

	// Zero GrossAmount
	_, err = svc.CreateSnapTransaction(context.Background(), SnapRequest{
		TransactionDetails: SnapTransactionDetails{OrderID: "ORD-1", GrossAmount: 0},
	})
	if !errors.Is(err, ErrInvalidSnapRequest) {
		t.Fatalf("expected ErrInvalidSnapRequest for zero gross_amount, got: %v", err)
	}

	// Item details mismatch with gross_amount
	_, err = svc.CreateSnapTransaction(context.Background(), SnapRequest{
		TransactionDetails: SnapTransactionDetails{OrderID: "ORD-1", GrossAmount: 500000},
		ItemDetails: []SnapItemDetail{
			{ID: "rent", Name: "Sewa Kamar", Price: 400000, Quantity: 1},
		},
	})
	if !errors.Is(err, ErrInvalidSnapRequest) {
		t.Fatalf("expected ErrInvalidSnapRequest for item_details mismatch, got: %v", err)
	}
}

func TestMidtransServiceCreateSnapTransactionAPIError(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(SnapResponse{
			ErrorMessages: []string{"transaction_details.order_id sudah digunakan"},
		})
	}))
	defer ts.Close()

	svc := NewMidtransServiceWithConfig("SB-Mid-server-valid", "SB-Mid-client-valid", false, ts.URL, ts.Client())
	_, err := svc.CreateSnapTransaction(context.Background(), SnapRequest{
		TransactionDetails: SnapTransactionDetails{OrderID: "ORD-DUP", GrossAmount: 100000},
	})
	if err == nil {
		t.Fatal("expected error from 400 Bad Request, got nil")
	}
}

func TestMidtransServiceVerifySignatureKey(t *testing.T) {
	serverKey := "SB-Mid-server-secret123"
	svc := NewMidtransServiceWithConfig(serverKey, "SB-Mid-client-123", false, "", nil)

	orderID := "LK-87654321-1700000000"
	statusCode := "200"
	grossAmount := "1500000.00"

	hash := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	validSignature := hex.EncodeToString(hash[:])

	if !svc.VerifySignatureKey(orderID, statusCode, grossAmount, validSignature) {
		t.Fatal("expected valid signature to return true")
	}

	if svc.VerifySignatureKey(orderID, statusCode, "999999.00", validSignature) {
		t.Fatal("expected tampered gross_amount to fail signature verification")
	}

	if svc.VerifySignatureKey(orderID, statusCode, grossAmount, "invalid-signature-hex") {
		t.Fatal("expected invalid signature to return false")
	}
}
