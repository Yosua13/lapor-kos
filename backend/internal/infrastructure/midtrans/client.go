package midtrans

import (
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
)

const (
	DefaultSandboxSnapURL    = "https://app.sandbox.midtrans.com/snap/v1/transactions"
	DefaultProductionSnapURL = "https://app.midtrans.com/snap/v1/transactions"
	DefaultSandboxCoreURL    = "https://api.sandbox.midtrans.com/v2"
	DefaultProductionCoreURL = "https://api.midtrans.com/v2"
)

// Ensure Client implements the domain payment.Gateway and payment.CoreTransactionGateway outbound ports.
var _ payment.Gateway = (*Client)(nil)
var _ payment.CoreTransactionGateway = (*Client)(nil)

// Client is the outbound hexagonal adapter for Midtrans Snap API.
type Client struct {
	serverKey    string
	clientKey    string
	isProduction bool
	snapURL      string
	httpClient   *http.Client
}

func (c *Client) IsConfigured() bool {
	if c == nil {
		return false
	}
	return c.serverKey != "" && !strings.Contains(c.serverKey, "your_sandbox_server_key_here")
}

func (c *Client) ClientKey() string {
	if c == nil {
		return ""
	}
	return c.clientKey
}

func (c *Client) IsProduction() bool {
	if c == nil {
		return false
	}
	return c.isProduction
}

func (c *Client) SnapURL() string {
	if c == nil {
		return ""
	}
	return c.snapURL
}

func (c *Client) CoreBaseURL() string {
	if c == nil {
		return ""
	}
	if c.isProduction {
		return DefaultProductionCoreURL
	}
	return DefaultSandboxCoreURL
}

func (c *Client) BasicAuthHeader() string {
	if c == nil {
		return ""
	}
	encoded := base64.StdEncoding.EncodeToString([]byte(c.serverKey + ":"))
	return "Basic " + encoded
}

