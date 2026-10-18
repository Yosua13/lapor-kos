package visitor

import (
	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type VisitorPermit = model.VisitorPermit
type VisitorPermitStatus = model.VisitorPermitStatus
type VisitorPermitEventType = model.VisitorPermitEventType
type VisitorPermitEvent = model.VisitorPermitEvent
type VisitorPermitFilter = model.VisitorPermitFilter
type VisitorPassVerification = model.VisitorPassVerification
type VisitorPermitSummary = model.VisitorPermitSummary

const (
	StatusPending         = model.VisitorPermitStatusPending
	StatusApproved        = model.VisitorPermitStatusApproved
	StatusRejected        = model.VisitorPermitStatusRejected
	StatusChangeRequested = model.VisitorPermitStatusChangeRequested
	StatusActive          = model.VisitorPermitStatusActive
	StatusCompleted       = model.VisitorPermitStatusCompleted
	StatusCancelled       = model.VisitorPermitStatusCancelled
	StatusExpired         = model.VisitorPermitStatusExpired
)
