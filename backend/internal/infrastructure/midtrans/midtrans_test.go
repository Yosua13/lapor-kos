package midtrans

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

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
)

func TestNewClientDefaults(t *testing.T) {
	sandboxClient := NewClient(config.MidtransConfig{
		ServerKey:    "SB-Mid-server-123",
		ClientKey:    "SB-Mid-client-123",
		IsProduction: false,
	}, nil)
	if !sandboxClient.IsConfigured() {
		t.Fatal("expected sandbox client to be configured")
	}
	if sandboxClient.IsProduction() {
		t.Fatal("expected sandbox client IsProduction to be false")
	}
	if sandboxClient.SnapURL() != DefaultSandboxSnapURL {
		t.Fatalf("expected sandbox URL %q, got %q", DefaultSandboxSnapURL, sandboxClient.SnapURL())
	}

	prodClient := NewClient(config.MidtransConfig{
		ServerKey:    "Mid-server-prod",
		ClientKey:    "Mid-client-prod",
		IsProduction: true,
	}, nil)
	if !prodClient.IsProduction() {
		t.Fatal("expected production client IsProduction to be true")
	}
	if prodClient.SnapURL() != DefaultProductionSnapURL {
		t.Fatalf("expected production URL %q, got %q", DefaultProductionSnapURL, prodClient.SnapURL())
	}
}

func TestClientCreateSnapTransactionSuccess(t *testing.T) {
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

		var payload payment.SnapRequest
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
		_ = json.NewEncoder(w).Encode(payment.SnapResponse{
			Token:       "snap-token-abc-123",
			RedirectURL: "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-token-abc-123",
		})
	}))
	defer ts.Close()

	client := NewClient(config.MidtransConfig{
		ServerKey:    serverKey,
		ClientKey:    "SB-Mid-client-test",
		IsProduction: false,
		SnapURL:      ts.URL,
	}, ts.Client())

	resp, err := client.CreateSnapTransaction(context.Background(), payment.SnapRequest{
		TransactionDetails: payment.SnapTransactionDetails{
			OrderID:     "LK-12345678-1700000000",
			GrossAmount: 1500000,
		},
		CustomerDetails: &payment.SnapCustomerDetails{
			FirstName: "Budi",
			LastName:  "Santoso",
			Email:     "tenant@laporkos.id",
			Phone:     "081234567890",
		},
		ItemDetails: []payment.SnapItemDetail{
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

func TestClientCreateSnapTransactionValidationAndErrors(t *testing.T) {
	unconfigured := NewClient(config.MidtransConfig{}, nil)
	_, err := unconfigured.CreateSnapTransaction(context.Background(), payment.SnapRequest{
		TransactionDetails: payment.SnapTransactionDetails{OrderID: "ORD-1", GrossAmount: 100000},
	})
	if !errors.Is(err, payment.ErrGatewayNotConfigured) {
		t.Fatalf("expected ErrGatewayNotConfigured, got: %v", err)
	}

	client := NewClient(config.MidtransConfig{
		ServerKey: "SB-Mid-server-valid",
		ClientKey: "SB-Mid-client-valid",
		SnapURL:   "http://localhost:9999",
	}, nil)

	// Missing OrderID
	_, err = client.CreateSnapTransaction(context.Background(), payment.SnapRequest{
		TransactionDetails: payment.SnapTransactionDetails{OrderID: "", GrossAmount: 100000},
	})
	if !errors.Is(err, payment.ErrInvalidSnapRequest) {
		t.Fatalf("expected ErrInvalidSnapRequest for empty order_id, got: %v", err)
	}

	// Zero GrossAmount
	_, err = client.CreateSnapTransaction(context.Background(), payment.SnapRequest{
		TransactionDetails: payment.SnapTransactionDetails{OrderID: "ORD-1", GrossAmount: 0},
	})
	if !errors.Is(err, payment.ErrInvalidSnapRequest) {
		t.Fatalf("expected ErrInvalidSnapRequest for zero gross_amount, got: %v", err)
	}

	// Item details mismatch with gross_amount
	_, err = client.CreateSnapTransaction(context.Background(), payment.SnapRequest{
		TransactionDetails: payment.SnapTransactionDetails{OrderID: "ORD-1", GrossAmount: 500000},
		ItemDetails: []payment.SnapItemDetail{
			{ID: "rent", Name: "Sewa Kamar", Price: 400000, Quantity: 1},
		},
	})
	if !errors.Is(err, payment.ErrInvalidSnapRequest) {
		t.Fatalf("expected ErrInvalidSnapRequest for item_details mismatch, got: %v", err)
	}
}

func TestClientVerifySignatureKey(t *testing.T) {
	serverKey := "SB-Mid-server-secret123"
	client := NewClient(config.MidtransConfig{
		ServerKey: serverKey,
		ClientKey: "SB-Mid-client-123",
	}, nil)

	orderID := "LK-87654321-1700000000"
	statusCode := "200"
	grossAmount := "1500000.00"

	hash := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	validSignature := hex.EncodeToString(hash[:])

	if !client.VerifySignatureKey(orderID, statusCode, grossAmount, validSignature) {
		t.Fatal("expected valid signature to return true")
	}

	if client.VerifySignatureKey(orderID, statusCode, "999999.00", validSignature) {
		t.Fatal("expected tampered gross_amount to fail signature verification")
	}

	if client.VerifySignatureKey(orderID, statusCode, grossAmount, "invalid-signature-hex") {
		t.Fatal("expected invalid signature to return false")
	}
}

