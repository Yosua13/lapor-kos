package midtrans

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
)

// CreateSnapTransaction calls the Midtrans Snap API to generate a payment token and redirect URL.
func (c *Client) CreateSnapTransaction(ctx context.Context, req payment.SnapRequest) (*payment.SnapResponse, error) {
	if !c.IsConfigured() {
		return nil, payment.ErrGatewayNotConfigured
	}

	orderID := strings.TrimSpace(req.TransactionDetails.OrderID)
	if orderID == "" {
		return nil, fmt.Errorf("%w: order_id is required", payment.ErrInvalidSnapRequest)
	}
	if req.TransactionDetails.GrossAmount <= 0 {
		return nil, fmt.Errorf("%w: gross_amount must be greater than 0", payment.ErrInvalidSnapRequest)
	}

	if len(req.ItemDetails) > 0 {
		var itemsTotal int64
		for _, item := range req.ItemDetails {
			if item.Quantity <= 0 {
				return nil, fmt.Errorf("%w: item quantity must be greater than 0", payment.ErrInvalidSnapRequest)
			}
			itemsTotal += item.Price * int64(item.Quantity)
		}
		if itemsTotal != req.TransactionDetails.GrossAmount {
			return nil, fmt.Errorf(
				"%w: item_details total (%d) does not match gross_amount (%d)",
				payment.ErrInvalidSnapRequest, itemsTotal, req.TransactionDetails.GrossAmount,
			)
		}
	}

	payloadBytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal midtrans snap request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.snapURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create midtrans http request: %w", err)
	}

	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", c.BasicAuthHeader())

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("midtrans snap request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read midtrans snap response: %w", err)
	}

	var snapResp payment.SnapResponse
	if len(bodyBytes) > 0 {
		if err := json.Unmarshal(bodyBytes, &snapResp); err != nil {
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				return nil, fmt.Errorf("midtrans api returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
			}
			return nil, fmt.Errorf("failed to decode midtrans snap response: %w", err)
		}
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		if len(snapResp.ErrorMessages) > 0 {
			return nil, fmt.Errorf("midtrans api error (status %d): %s", resp.StatusCode, strings.Join(snapResp.ErrorMessages, "; "))
		}
		return nil, fmt.Errorf("midtrans api returned unexpected status %d", resp.StatusCode)
	}

	if strings.TrimSpace(snapResp.Token) == "" {
		return nil, errors.New("midtrans snap response missing token")
	}

	return &snapResp, nil
}

