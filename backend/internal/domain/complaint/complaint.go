package complaint

import (
	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type Complaint = model.Complaint
type ComplaintEvent = model.ComplaintEvent
type AISuggestion = model.AISuggestion
type SLADashboardStats = model.SLADashboardStats
type ApplyAISuggestionRequest = model.ApplyAISuggestionRequest

const (
	PriorityUrgent = model.ComplaintPriorityUrgent
	PriorityHigh   = model.ComplaintPriorityHigh
	PriorityMedium = model.ComplaintPriorityMedium
	PriorityLow    = model.ComplaintPriorityLow

	StatusPending       = model.ComplaintStatusPending
	StatusInProgress    = model.ComplaintStatusInProgress
	StatusScheduled     = model.ComplaintStatusScheduled
	StatusWaitingVendor = model.ComplaintStatusWaitingVendor
	StatusResolved      = model.ComplaintStatusResolved
	StatusConfirmed     = model.ComplaintStatusConfirmed
	StatusReopened      = model.ComplaintStatusReopened
	StatusCancelled     = model.ComplaintStatusCancelled
)
