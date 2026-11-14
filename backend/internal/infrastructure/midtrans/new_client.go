package midtrans

import (
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
)

// NewClient constructs a Midtrans Snap adapter from explicit configuration.
func NewClient(cfg config.MidtransConfig, httpClient *http.Client) *Client {
	snapURL := strings.TrimSpace(cfg.SnapURL)
	if snapURL == "" {
		if cfg.IsProduction {
			snapURL = DefaultProductionSnapURL
		} else {
			snapURL = DefaultSandboxSnapURL
		}
	}

	if httpClient == nil {
		httpClient = &http.Client{Timeout: 15 * time.Second}
	}

	return &Client{
		serverKey:    strings.TrimSpace(cfg.ServerKey),
		clientKey:    strings.TrimSpace(cfg.ClientKey),
		isProduction: cfg.IsProduction,
		snapURL:      snapURL,
		httpClient:   httpClient,
	}
}

// NewClientFromEnv constructs a Midtrans Snap adapter resolved from environment variables.
func NewClientFromEnv() *Client {
	isProd, _ := strconv.ParseBool(strings.TrimSpace(os.Getenv("MIDTRANS_IS_PRODUCTION")))
	return NewClient(config.MidtransConfig{
		ServerKey:    strings.TrimSpace(os.Getenv("MIDTRANS_SERVER_KEY")),
		ClientKey:    strings.TrimSpace(os.Getenv("MIDTRANS_CLIENT_KEY")),
		IsProduction: isProd,
		SnapURL:      strings.TrimSpace(os.Getenv("MIDTRANS_SNAP_URL")),
	}, nil)
}

