package finance

import (
	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

// Re-export / alias domain entities for strict Clean Architecture.
type Expense = model.Expense
type ExpenseFilter = model.ExpenseFilter
type CreateExpenseRequest = model.CreateExpenseRequest
type UpdateExpenseRequest = model.UpdateExpenseRequest
type CategoryExpenseSummary = model.CategoryExpenseSummary

const (
	StatusDraft           = "draft"
	StatusPendingApproval = "pending_approval"
	StatusApproved        = "approved"
	StatusRejected        = "rejected"
	StatusPaid            = "paid"
	StatusCancelled       = "cancelled"
)
