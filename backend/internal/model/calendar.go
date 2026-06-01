package model

type CalendarEvent struct {
	ID          string       `json:"id"`
	Type        string       `json:"type"` // "contract_expiry" or "payment_due"
	Title       string       `json:"title"`
	Date        string       `json:"date"` // YYYY-MM-DD
	Status      string       `json:"status"`
	ColorStatus string       `json:"color_status"` // green, yellow, red
	Details     EventDetails `json:"details"`
}

type EventDetails struct {
	RoomNumber string  `json:"room_number"`
	TenantName string  `json:"tenant_name"`
	Amount     float64 `json:"amount,omitempty"`
	DueDate    string  `json:"due_date,omitempty"`
	EndDate    string  `json:"end_date,omitempty"`
}
