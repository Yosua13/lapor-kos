package midtrans

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
)

// GetTransactionStatus queries Midtrans Core API GET /v2/{order_id}/status to retrieve
// the real-time transaction status (settlement, capture, pending, cancel, expire, deny).
func (c *Client) GetTransactionStatus(ctx context.Context, orderID string) (*payment.MidtransWebhookNotification, error) {
	if !c.IsConfigured() {
		return nil, payment.ErrGatewayNotConfigured
	}
	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return nil, fmt.Errorf("%w: order_id is required", payment.ErrInvalidSnapRequest)
	}

	endpoint := fmt.Sprintf("%s/%s/status", c.CoreBaseURL(), url.PathEscape(orderID))
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create midtrans status request: %w", err)
	}

	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", c.BasicAuthHeader())

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("midtrans status request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read midtrans status response: %w", err)
	}

	var notif payment.MidtransWebhookNotification
	if err := json.Unmarshal(bodyBytes, &notif); err != nil {
		return nil, fmt.Errorf("failed to decode midtrans status response: %w", err)
	}

	return &notif, nil
}

