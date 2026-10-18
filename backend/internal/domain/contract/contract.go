package contract

import (
	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type Contract = model.Contract
type ContractDetail = model.ContractDetail
type ContractVersion = model.ContractVersion
type ContractEvent = model.ContractEvent
type OccupancyPeriod = model.OccupancyPeriod
type ContractDocument = model.ContractDocument
type CreateContractRequest = model.CreateContractRequest
type UpdateContractRequest = model.UpdateContractRequest
type ContractTransitionRequest = model.ContractTransitionRequest
type ContractAmendRequest = model.ContractAmendRequest
type ContractRenewRequest = model.ContractRenewRequest

const (
	ContractDraft         = model.ContractDraft
	ContractPendingTenant = model.ContractPendingTenant
	ContractScheduled     = model.ContractScheduled
	ContractActive        = model.ContractActive
	ContractEnded         = model.ContractEnded
	ContractTerminated    = model.ContractTerminated
	ContractRenewed       = model.ContractRenewed
	ContractCancelled     = model.ContractCancelled
)
