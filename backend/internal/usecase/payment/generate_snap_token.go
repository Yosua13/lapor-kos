package payment

import (
	"context"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
)

type GenerateSnapTokenInput struct {
	PaymentID       uuid.UUID
	UserID          uuid.UUID
	CustomerDetails *payment.SnapCustomerDetails
	ForceNew        bool
	PreviousOrderID string
}

type cachedSnapSession struct {
	result      payment.SnapTokenResult
	grossAmount int64
	createdAt   time.Time
}

type GenerateSnapTokenUseCase struct {
	repo     payment.TenantPaymentFinder
	gateway  payment.Gateway
	nowFn    func() time.Time
	mu       sync.RWMutex
	sessions map[uuid.UUID]cachedSnapSession
}

func NewGenerateSnapTokenUseCase(repo payment.TenantPaymentFinder, gateway payment.Gateway) *GenerateSnapTokenUseCase {
	return &GenerateSnapTokenUseCase{
		repo:     repo,
		gateway:  gateway,
		nowFn:    time.Now,
		sessions: make(map[uuid.UUID]cachedSnapSession),
	}
}

func (uc *GenerateSnapTokenUseCase) Execute(ctx context.Context, input GenerateSnapTokenInput) (*payment.SnapTokenResult, error) {
	if input.PaymentID == uuid.Nil {
		return nil, fmt.Errorf("%w: payment ID is required", payment.ErrInvalidSnapRequest)
	}
	if input.UserID == uuid.Nil {
		return nil, fmt.Errorf("%w: user ID is required", payment.ErrInvalidSnapRequest)
	}
	if uc.gateway == nil || !uc.gateway.IsConfigured() {
		return nil, payment.ErrGatewayNotConfigured
	}

	bill, err := uc.repo.FindByIDForUser(ctx, input.PaymentID, input.UserID)
	if err != nil {
		return nil, err
	}

	status := strings.ToLower(strings.TrimSpace(bill.Status))
	if status != payment.StatusUnpaid &&
		status != payment.StatusOverdue &&
		status != payment.StatusPending &&
		status != payment.StatusRejected {
		return nil, fmt.Errorf("%w (current status: %s)", payment.ErrPaymentNotPayable, bill.Status)
	}
	if status == payment.StatusPending {
		provider := strings.ToLower(strings.TrimSpace(bill.Provider))
		if strings.TrimSpace(bill.ProofPhotoURL) != "" || len(bill.Proofs) > 0 || provider == "manual" {
			return nil, fmt.Errorf("%w: pembayaran manual sedang menunggu verifikasi pemilik kos", payment.ErrPaymentNotPayable)
		}
	}

	periodLabel := "Bulanan"
	if bill.PeriodMonth > 0 && bill.PeriodYear > 0 {
		periodLabel = fmt.Sprintf("%02d/%d", bill.PeriodMonth, bill.PeriodYear)
	}

	var items []payment.SnapItemDetail
	var itemsSum int64

	if rentMinor := int64(math.Round(bill.AmountRent)); rentMinor > 0 {
		items = append(items, payment.SnapItemDetail{
			ID:       "rent",
			Price:    rentMinor,
			Quantity: 1,
			Name:     fmt.Sprintf("Sewa Kamar (%s)", periodLabel),
		})
		itemsSum += rentMinor
	}
	if elecMinor := int64(math.Round(bill.AmountElectricity)); elecMinor > 0 {
		items = append(items, payment.SnapItemDetail{
			ID:       "electricity",
			Price:    elecMinor,
			Quantity: 1,
			Name:     fmt.Sprintf("Biaya Listrik (%s)", periodLabel),
		})
		itemsSum += elecMinor
	}
	if waterMinor := int64(math.Round(bill.AmountWater)); waterMinor > 0 {
		items = append(items, payment.SnapItemDetail{
			ID:       "water",
			Price:    waterMinor,
			Quantity: 1,
			Name:     fmt.Sprintf("Biaya Air (%s)", periodLabel),
		})
		itemsSum += waterMinor
	}
	if otherMinor := int64(math.Round(bill.AmountOther)); otherMinor > 0 {
		items = append(items, payment.SnapItemDetail{
			ID:       "other",
			Price:    otherMinor,
			Quantity: 1,
			Name:     fmt.Sprintf("Biaya Lainnya / Denda (%s)", periodLabel),
		})
		itemsSum += otherMinor
	}

	grossAmount := bill.AmountMinor
	if grossAmount <= 0 {
		grossAmount = itemsSum
	}

	if itemsSum == 0 && grossAmount > 0 {
		items = append(items, payment.SnapItemDetail{
			ID:       "bill",
			Price:    grossAmount,
			Quantity: 1,
			Name:     fmt.Sprintf("Tagihan Kos (%s)", periodLabel),
		})
	} else if itemsSum > 0 && grossAmount > itemsSum {
		items = append(items, payment.SnapItemDetail{
			ID:       "adjustment",
			Price:    grossAmount - itemsSum,
			Quantity: 1,
			Name:     "Penyesuaian / Denda Tagihan",
		})
	} else if itemsSum > 0 && grossAmount < itemsSum {
		grossAmount = itemsSum
	}

	if grossAmount <= 0 {
		return nil, fmt.Errorf("%w: total bill amount must be greater than zero", payment.ErrInvalidSnapRequest)
	}

	now := uc.nowFn()
	var prevOrderID string

	uc.mu.RLock()
	cached, hasCached := uc.sessions[bill.ID]
	uc.mu.RUnlock()

	if hasCached {
		prevOrderID = cached.result.OrderID
		if !input.ForceNew && cached.grossAmount == grossAmount && now.Sub(cached.createdAt) < 23*time.Hour {
			resCopy := cached.result
			return &resCopy, nil
		}
	}

	if input.ForceNew {
		if coreGw, ok := uc.gateway.(payment.CoreTransactionGateway); ok {
			ordersToCancel := make(map[string]struct{})
			if prevOrderID != "" {
				ordersToCancel[prevOrderID] = struct{}{}
			}
			if input.PreviousOrderID != "" {
				ordersToCancel[strings.TrimSpace(input.PreviousOrderID)] = struct{}{}
			}
			if bill.ProviderRef != nil && strings.HasPrefix(strings.TrimSpace(*bill.ProviderRef), "LK-") {
				ordersToCancel[strings.TrimSpace(*bill.ProviderRef)] = struct{}{}
			}
			for oldOrderID := range ordersToCancel {
				_ = coreGw.CancelTransaction(ctx, oldOrderID)
			}
		}
	}

	customer := input.CustomerDetails
	if customer == nil && bill.Contract != nil && bill.Contract.User != nil {
		u := bill.Contract.User
		if u.Name != "" || u.Email != "" || u.Phone != "" {
			customer = &payment.SnapCustomerDetails{
				FirstName: u.Name,
				Email:     u.Email,
				Phone:     u.Phone,
			}
		}
	}

	ts := now.Unix()
	orderID := fmt.Sprintf("LK-%s-%d", bill.ID.String()[:8], ts)
	if (prevOrderID != "" && orderID == prevOrderID) || (input.PreviousOrderID != "" && orderID == input.PreviousOrderID) {
		ts++
		orderID = fmt.Sprintf("LK-%s-%d", bill.ID.String()[:8], ts)
	}

	snapReq := payment.SnapRequest{
		TransactionDetails: payment.SnapTransactionDetails{
			OrderID:     orderID,
			GrossAmount: grossAmount,
		},
		CustomerDetails: customer,
		ItemDetails:     items,
	}

	resp, err := uc.gateway.CreateSnapTransaction(ctx, snapReq)
	if err != nil {
		return nil, err
	}

	result := payment.SnapTokenResult{
		Token:       resp.Token,
		RedirectURL: resp.RedirectURL,
		OrderID:     orderID,
		ClientKey:   uc.gateway.ClientKey(),
	}

	uc.mu.Lock()
	uc.sessions[bill.ID] = cachedSnapSession{
		result:      result,
		grossAmount: grossAmount,
		createdAt:   now,
	}
	uc.mu.Unlock()

	return &result, nil
}

func (uc *GenerateSnapTokenUseCase) GetCachedOrderID(paymentID uuid.UUID) string {
	uc.mu.RLock()
	defer uc.mu.RUnlock()
	if s, ok := uc.sessions[paymentID]; ok {
		return s.result.OrderID
	}
	return ""
}

func (uc *GenerateSnapTokenUseCase) ClearSession(paymentID uuid.UUID) {
	uc.mu.Lock()
	defer uc.mu.Unlock()
	delete(uc.sessions, paymentID)
}