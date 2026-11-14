package payment

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
)

type ProcessMidtransWebhookResult struct {
	Payment      *payment.Payment `json:"payment"`
	IsDuplicate  bool             `json:"is_duplicate"`
	MappedStatus string           `json:"mapped_status"`
}

type ProcessMidtransWebhookUseCase struct {
	repo    payment.MidtransWebhookRepository
	gateway payment.Gateway
}

func NewProcessMidtransWebhookUseCase(repo payment.MidtransWebhookRepository, gateway payment.Gateway) *ProcessMidtransWebhookUseCase {
	return &ProcessMidtransWebhookUseCase{
		repo:    repo,
		gateway: gateway,
	}
}

func (uc *ProcessMidtransWebhookUseCase) Execute(ctx context.Context, notif payment.MidtransWebhookNotification) (*ProcessMidtransWebhookResult, error) {
	if uc.gateway == nil || !uc.gateway.IsConfigured() {
		return nil, payment.ErrGatewayNotConfigured
	}

	if strings.TrimSpace(notif.OrderID) == "" ||
		strings.TrimSpace(notif.StatusCode) == "" ||
		strings.TrimSpace(notif.GrossAmount) == "" {
		return nil, fmt.Errorf("%w: order_id, status_code, and gross_amount are required", payment.ErrInvalidSnapRequest)
	}

	if !uc.gateway.VerifySignatureKey(notif.OrderID, notif.StatusCode, notif.GrossAmount, notif.SignatureKey) {
		return nil, payment.ErrInvalidWebhookSignature
	}

	grossFloat, err := strconv.ParseFloat(strings.TrimSpace(notif.GrossAmount), 64)
	if err != nil || grossFloat <= 0 {
		return nil, fmt.Errorf("%w: invalid gross_amount %q", payment.ErrInvalidSnapRequest, notif.GrossAmount)
	}
	grossAmountMinor := int64(math.Round(grossFloat))

	txStatus := strings.ToLower(strings.TrimSpace(notif.TransactionStatus))
	fraudStatus := strings.ToLower(strings.TrimSpace(notif.FraudStatus))

	var mappedStatus string
	switch txStatus {
	case "settlement":
		mappedStatus = payment.StatusPaid
	case "capture":
		if fraudStatus == "" || fraudStatus == "accept" {
			mappedStatus = payment.StatusPaid
		} else if fraudStatus == "challenge" {
			mappedStatus = payment.StatusPending
		} else {
			mappedStatus = payment.StatusRejected
		}
	case "pending":
		mappedStatus = payment.StatusPending
	case "deny":
		mappedStatus = payment.StatusRejected
	case "expire", "cancel", "failure":
		mappedStatus = payment.StatusUnpaid
	default:
		return nil, fmt.Errorf("%w: unsupported transaction_status %q", payment.ErrInvalidSnapRequest, notif.TransactionStatus)
	}

	p, isDuplicate, err := uc.repo.ProcessMidtransWebhook(ctx, notif, mappedStatus, grossAmountMinor)
	if err != nil {
		return nil, err
	}

	return &ProcessMidtransWebhookResult{
		Payment:      p,
		IsDuplicate:  isDuplicate,
		MappedStatus: mappedStatus,
	}, nil
}

