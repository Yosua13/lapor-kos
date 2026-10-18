# Migration Plan: Fase 4 - Dekomposisi Domain & Refactoring "One Function Per File"

- **Track ID:** ARCH-04
- **Fokus:** Pemecahan repository monolitik (seperti `finance_repository.go`, `complaint_repository.go`) dan handler raksasa ke dalam Clean Architecture dengan prinsip murni 1 File = 1 Fungsi/Use Case.

---

## 1. Ruang Lingkup Pekerjaan

1. **Pembentukan 4 Lapisan Clean Architecture**:
   - **Domain Layer (`internal/domain/<domain>/`)**: Entitas murni, state transitions, dan interface repository. Bebas dari ketergantungan HTTP (Gin) atau DB spesifik (pgx).
   - **Use Case Layer (`internal/usecase/<domain>/`)**: Menerapkan logika alur bisnis murni. Setiap file hanya memiliki **satu use case struct dan satu method `Execute`**.
   - **Infrastructure Layer (`internal/infrastructure/postgres/<domain>/`)**: Mengurai method SQL dari repository monolitik ke file query individual (1 query/command per file).
   - **Delivery Layer (`internal/delivery/http/handler/<domain>/`)**: Setiap endpoint HTTP memiliki file handler mandiri (1 handler func per file).
2. **Urutan Prioritas Dekomposisi per Domain**:
   - **Gelombang 1 (High Mutability / Financial Risk)**:
     - Domain **Finance**: Mengurai `finance_repository.go` (48 KB) dan `finance_handler.go` (15 KB).
     - Domain **Payment**: Mengurai `payment_repository.go` (40 KB) dan `payment_handler.go` (26 KB).
   - **Gelombang 2 (Complex Business Workflows)**:
     - Domain **Room Transfer**: Mengurai `room_transfer_repository.go` (42 KB).
     - Domain **Checkout**: Mengurai `checkout_repository.go` (34 KB).
     - Domain **Complaint**: Mengurai `complaint_repository.go` (40 KB) dan `complaint_handler.go` (30 KB).
   - **Gelombang 3 (Core Identity & Property)**:
     - Domain **Auth & User**: Mengurai `user_repository.go` (24 KB).
     - Domain **Contract & Tenant Lifecycle**: Mengurai `contract_lifecycle_repository.go` (28 KB).
     - Domain **Visitor & Rules**: Mengurai `visitor_permit_repository.go` (27 KB).
3. **Pemberlakuan Unit Testing Terisolasi (1-to-1 Mapping)**:
   - Setiap file use case dipasangkan dengan unit test khusus:
     - `create_expense.go` <---> `create_expense_test.go`
     - `approve_expense.go` <---> `approve_expense_test.go`
     - `close_period.go` <---> `close_period_test.go`

---

## 2. Rincian Pemecahan Modul Finance sebagai Pola Baku

Contoh konkret bagaimana `finance_repository.go` dan `finance_handler.go` didekomposisi:

```text
backend/internal/
├── domain/finance/
│   ├── expense.go                                  # Struct Expense, ExpenseCategory, ExpenseStatus
│   ├── period_closure.go                           # Struct PeriodClosure, ClosureStatus
│   ├── adjustment.go                               # Struct Adjustment, AdjustmentType
│   └── repository.go                               # Interface ExpenseRepository, PeriodRepository, AdjustmentRepository
│
├── usecase/finance/                                # 1 FILE = 1 USE CASE / FUNCTION
│   ├── create_expense.go                           # func (uc *CreateExpenseUseCase) Execute(...)
│   ├── create_expense_test.go                      # Unit test CreateExpense
│   ├── approve_expense.go                          # func (uc *ApproveExpenseUseCase) Execute(...)
│   ├── approve_expense_test.go                     # Unit test ApproveExpense
│   ├── pay_expense.go                              # func (uc *PayExpenseUseCase) Execute(...)
│   ├── delete_expense.go                           # func (uc *DeleteExpenseUseCase) Execute(...)
│   ├── close_period.go                             # func (uc *ClosePeriodUseCase) Execute(...)
│   ├── reopen_period.go                            # func (uc *ReopenPeriodUseCase) Execute(...)
│   ├── create_adjustment.go                        # func (uc *CreateAdjustmentUseCase) Execute(...)
│   ├── approve_adjustment.go                       # func (uc *ApproveAdjustmentUseCase) Execute(...)
│   ├── get_dashboard.go                            # func (uc *GetDashboardUseCase) Execute(...)
│   └── get_receivables_aging.go                    # func (uc *GetReceivablesAgingUseCase) Execute(...)
│
├── infrastructure/postgres/finance/                # 1 FILE = 1 QUERY / SQL EXECUTION
│   ├── insert_expense.go                           # func (r *Repo) InsertExpense(...)
│   ├── find_expense_by_id.go                       # func (r *Repo) FindExpenseByID(...)
│   ├── list_expenses.go                            # func (r *Repo) ListExpenses(...)
│   ├── update_expense_status.go                    # func (r *Repo) UpdateExpenseStatus(...)
│   ├── delete_expense.go                           # func (r *Repo) DeleteExpense(...)
│   ├── insert_period_closure.go                    # func (r *Repo) InsertPeriodClosure(...)
│   ├── find_period_closure.go                      # func (r *Repo) FindPeriodClosure(...)
│   ├── insert_adjustment.go                        # func (r *Repo) InsertAdjustment(...)
│   └── approve_adjustment.go                       # func (r *Repo) ApproveAdjustment(...)
│
└── delivery/http/handler/finance/                  # 1 FILE = 1 GIN HANDLER FUNCTION
    ├── handle_create_expense.go                    # func HandleCreateExpense(uc) gin.HandlerFunc
    ├── handle_approve_expense.go                   # func HandleApproveExpense(uc) gin.HandlerFunc
    ├── handle_pay_expense.go                       # func HandlePayExpense(uc) gin.HandlerFunc
    ├── handle_delete_expense.go                    # func HandleDeleteExpense(uc) gin.HandlerFunc
    ├── handle_close_period.go                      # func HandleClosePeriod(uc) gin.HandlerFunc
    ├── handle_reopen_period.go                     # func HandleReopenPeriod(uc) gin.HandlerFunc
    ├── handle_create_adjustment.go                 # func HandleCreateAdjustment(uc) gin.HandlerFunc
    ├── handle_approve_adjustment.go                # func HandleApproveAdjustment(uc) gin.HandlerFunc
    └── handle_get_dashboard.go                     # func HandleGetDashboard(uc) gin.HandlerFunc
```

---

## 3. Kriteria Penerimaan (Acceptance Criteria)

- [x] Tidak ada file kode yang memiliki lebih dari 1 fungsi/use case utama dalam layer Use Case, HTTP Handler, dan Database Query.
- [x] Panjang setiap file rata-rata berkisar antara 30 hingga 120 baris, bebas dari "god-object".
- [x] Pengujian unit use case layer mencapai *code coverage* >85% tanpa perlu mock database yang berat.
- [x] Seluruh endpoint API lama tetap kompatibel 100% (*zero regression*) dengan frontend Next.js.
- [x] Seluruh integration test dan CI release gate script tetap lulus 100%.
