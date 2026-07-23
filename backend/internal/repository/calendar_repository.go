package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CalendarRepository struct {
	db *pgxpool.Pool
}

func NewCalendarRepository(db *pgxpool.Pool) *CalendarRepository {
	return &CalendarRepository{db: db}
}

func (r *CalendarRepository) FindEvents(ctx context.Context, propertyID uuid.UUID, month int, year int) ([]model.CalendarEvent, error) {
	var events []model.CalendarEvent
	now := time.Now()

	// Query contract expirations
	contractQuery := `
		SELECT 
			c.id, c.end_date, c.status, r.room_number, t.name
		FROM contracts c
		JOIN rooms r ON c.room_id = r.id AND c.property_id = r.property_id
		JOIN users t ON c.user_id = t.id
		WHERE c.property_id = $1
		  AND EXTRACT(MONTH FROM c.end_date) = $2
		  AND EXTRACT(YEAR FROM c.end_date) = $3
	`

	rows, err := r.db.Query(ctx, contractQuery, propertyID, month, year)
	if err != nil {
		return nil, fmt.Errorf("failed to query contracts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		var endDate time.Time
		var status string
		var roomNumber, tenantName string

		err := rows.Scan(&id, &endDate, &status, &roomNumber, &tenantName)
		if err != nil {
			return nil, err
		}

		var colorStatus string
		if status == "expired" || status == "cancelled" {
			colorStatus = "red"
		} else if status == "active" {
			daysUntilExpiry := endDate.Sub(now).Hours() / 24
			if daysUntilExpiry <= 30 && daysUntilExpiry >= 0 {
				colorStatus = "yellow"
			} else if endDate.Before(now) {
				colorStatus = "red"
			} else {
				colorStatus = "green"
			}
		} else {
			colorStatus = "green"
		}

		events = append(events, model.CalendarEvent{
			ID:          id.String(),
			PropertyID:  propertyID,
			Type:        "contract_expiry",
			Title:       fmt.Sprintf("Kontrak Habis: Kamar %s - %s", roomNumber, tenantName),
			Date:        endDate.Format("2006-01-02"),
			Status:      status,
			ColorStatus: colorStatus,
			Details: model.EventDetails{
				RoomNumber: roomNumber,
				TenantName: tenantName,
				EndDate:    endDate.Format("2006-01-02"),
			},
		})
	}

	// Query payment due dates
	paymentQuery := `
		SELECT 
			p.id, p.due_date, p.status, p.amount_rent + p.amount_electricity + p.amount_water + p.amount_other AS total_bill,
			r.room_number, t.name
		FROM payments p
		JOIN contracts c ON p.contract_id = c.id AND p.property_id = c.property_id
		JOIN rooms r ON c.room_id = r.id AND c.property_id = r.property_id
		JOIN users t ON c.user_id = t.id
		WHERE p.property_id = $1
		  AND EXTRACT(MONTH FROM p.due_date) = $2
		  AND EXTRACT(YEAR FROM p.due_date) = $3
	`

	rowsPay, err := r.db.Query(ctx, paymentQuery, propertyID, month, year)
	if err != nil {
		return nil, fmt.Errorf("failed to query payments: %w", err)
	}
	defer rowsPay.Close()

	for rowsPay.Next() {
		var id uuid.UUID
		var dueDate time.Time
		var status string
		var totalBill float64
		var roomNumber, tenantName string

		err := rowsPay.Scan(&id, &dueDate, &status, &totalBill, &roomNumber, &tenantName)
		if err != nil {
			return nil, err
		}

		var colorStatus string
		if status == "paid" {
			colorStatus = "green"
		} else if status == "overdue" {
			colorStatus = "red"
		} else {
			// unpaid, pending, partial
			if dueDate.Before(now) && dueDate.Format("2006-01-02") != now.Format("2006-01-02") {
				colorStatus = "red"
			} else {
				daysUntilDue := dueDate.Sub(now).Hours() / 24
				if daysUntilDue <= 7 {
					colorStatus = "yellow"
				} else {
					colorStatus = "green"
				}
			}
		}

		events = append(events, model.CalendarEvent{
			ID:          id.String(),
			PropertyID:  propertyID,
			Type:        "payment_due",
			Title:       fmt.Sprintf("Jatuh Tempo: Kamar %s - %s", roomNumber, tenantName),
			Date:        dueDate.Format("2006-01-02"),
			Status:      status,
			ColorStatus: colorStatus,
			Details: model.EventDetails{
				RoomNumber: roomNumber,
				TenantName: tenantName,
				Amount:     totalBill,
				DueDate:    dueDate.Format("2006-01-02"),
			},
		})
	}

	return events, nil
}
