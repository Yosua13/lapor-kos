package midtrans

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
)

// CancelTransaction calls Midtrans Core API POST /v2/{order_id}/cancel to cancel
// a pending Virtual Account / QRIS / e-wallet transaction when the tenant switches payment methods.
func (c *Client) CancelTransaction(ctx context.Context, orderID string) error {
	if !c.IsConfigured() {
		return payment.ErrGatewayNotConfigured
	}
	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return nil
	}

	endpoint := fmt.Sprintf("%s/%s/cancel", c.CoreBaseURL(), url.PathEscape(orderID))
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to create midtrans cancel request: %w", err)
	}

	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", c.BasicAuthHeader())

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("midtrans cancel request failed: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	// 404 or 412 means the Snap token was never converted into an active payment or was already cancelled/expired.
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusPreconditionFailed {
		return nil
	}
	return fmt.Errorf("midtrans cancel returned unexpected status %d", resp.StatusCode)
}

