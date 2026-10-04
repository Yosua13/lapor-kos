package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrIllegalContractTransition = errors.New("illegal contract status transition")
	ErrContractPrerequisite      = errors.New("contract activation prerequisite is not met")
	ErrContractHistoryImmutable  = errors.New("published contract history is immutable")
)

type ContractLifecycleRepository struct {
	db        *pgxpool.Pool
	contracts *ContractRepository
}

func NewContractLifecycleRepository(db *pgxpool.Pool, contracts *ContractRepository) *ContractLifecycleRepository {
	return &ContractLifecycleRepository{db: db, contracts: contracts}
}

func CanTransition(from, to string) bool {
	allowed := map[string]map[string]bool{
		model.ContractDraft:         {model.ContractPendingTenant: true, model.ContractCancelled: true},
		model.ContractPendingTenant: {model.ContractScheduled: true, model.ContractCancelled: true},
		model.ContractScheduled:     {model.ContractActive: true, model.ContractCancelled: true},
		model.ContractActive:        {model.ContractEnded: true, model.ContractTerminated: true, model.ContractRenewed: true},
	}
	return allowed[from][to]
}

func (r *ContractLifecycleRepository) Detail(ctx context.Context, propertyID, contractID uuid.UUID) (*model.ContractDetail, error) {
	base, err := r.contracts.FindByID(ctx, propertyID, contractID)
	if err != nil {
		return nil, err
	}
	detail := &model.ContractDetail{Contract: *base, Versions: []model.ContractVersion{}, Events: []model.ContractEvent{}, Occupancy: []model.OccupancyPeriod{}, Documents: []model.ContractDocument{}}

	rows, err := r.db.Query(ctx, `SELECT id,property_id,contract_id,version_number,snapshot,reason,created_by,created_at FROM contract_versions WHERE property_id=$1 AND contract_id=$2 ORDER BY version_number DESC`, propertyID, contractID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var item model.ContractVersion
		if err = rows.Scan(&item.ID, &item.PropertyID, &item.ContractID, &item.VersionNumber, &item.Snapshot, &item.Reason, &item.CreatedBy, &item.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		detail.Versions = append(detail.Versions, item)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	rows, err = r.db.Query(ctx, `SELECT id,property_id,contract_id,version_id,event_type,COALESCE(from_status,''),COALESCE(to_status,''),reason,metadata,actor_id,created_at FROM contract_events WHERE property_id=$1 AND contract_id=$2 ORDER BY created_at DESC,id DESC`, propertyID, contractID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var item model.ContractEvent
		if err = rows.Scan(&item.ID, &item.PropertyID, &item.ContractID, &item.VersionID, &item.EventType, &item.FromStatus, &item.ToStatus, &item.Reason, &item.Metadata, &item.ActorID, &item.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		detail.Events = append(detail.Events, item)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	rows, err = r.db.Query(ctx, `SELECT id,property_id,contract_id,room_id,user_id,start_date,end_date,closed_at,created_at FROM occupancy_periods WHERE property_id=$1 AND contract_id=$2 ORDER BY start_date DESC`, propertyID, contractID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var item model.OccupancyPeriod
		if err = rows.Scan(&item.ID, &item.PropertyID, &item.ContractID, &item.RoomID, &item.UserID, &item.StartDate, &item.EndDate, &item.ClosedAt, &item.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		detail.Occupancy = append(detail.Occupancy, item)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	rows, err = r.db.Query(ctx, `SELECT id,property_id,contract_id,version_id,version_number,file_name,mime_type,sha256,size_bytes,published_by,published_at FROM contract_documents WHERE property_id=$1 AND contract_id=$2 ORDER BY published_at DESC`, propertyID, contractID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var item model.ContractDocument
		if err = rows.Scan(&item.ID, &item.PropertyID, &item.ContractID, &item.VersionID, &item.VersionNumber, &item.FileName, &item.MimeType, &item.SHA256, &item.SizeBytes, &item.PublishedBy, &item.PublishedAt); err != nil {
			rows.Close()
			return nil, err
		}
		detail.Documents = append(detail.Documents, item)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	return detail, nil
}

type lockedContract struct {
	id, propertyID, roomID, userID                              uuid.UUID
	versionID                                                   *uuid.UUID
	renewedFrom                                                 *uuid.UUID
	status                                                      string
	startDate, endDate                                          time.Time
	monthlyRent, totalPrice, deposit, electricity, water, other float64
	rentalDuration, paymentDueDay                               int
	paymentInterval, notes                                      string
}

func lockContract(ctx context.Context, tx pgx.Tx, propertyID, id uuid.UUID) (*lockedContract, error) {
	var c lockedContract
	err := tx.QueryRow(ctx, `SELECT id,property_id,room_id,user_id,current_version_id,renewed_from_contract_id,status,start_date,end_date,monthly_rent,total_price,COALESCE(deposit,0),COALESCE(electricity_bill,0),COALESCE(water_bill,0),COALESCE(other_bills,0),rental_duration,COALESCE(payment_due_day,1),COALESCE(payment_interval,'monthly'),COALESCE(notes,'') FROM contracts WHERE property_id=$1 AND id=$2 FOR UPDATE`, propertyID, id).Scan(&c.id, &c.propertyID, &c.roomID, &c.userID, &c.versionID, &c.renewedFrom, &c.status, &c.startDate, &c.endDate, &c.monthlyRent, &c.totalPrice, &c.deposit, &c.electricity, &c.water, &c.other, &c.rentalDuration, &c.paymentDueDay, &c.paymentInterval, &c.notes)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func requireReason(to, reason string) error {
	if (to == model.ContractCancelled || to == model.ContractEnded || to == model.ContractTerminated || to == model.ContractRenewed) && strings.TrimSpace(reason) == "" {
		return fmt.Errorf("%w: reason is required", ErrContractPrerequisite)
	}
	return nil
}

func (r *ContractLifecycleRepository) Transition(ctx context.Context, propertyID, actorID, contractID uuid.UUID, to, reason string, effectiveDate *time.Time) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	c, err := lockContract(ctx, tx, propertyID, contractID)
	if err != nil {
		return err
	}
	if !CanTransition(c.status, to) || to == model.ContractScheduled || to == model.ContractRenewed {
		return fmt.Errorf("%w: %s -> %s", ErrIllegalContractTransition, c.status, to)
	}
	if err = requireReason(to, reason); err != nil {
		return err
	}
	if to == model.ContractActive {
		if err = r.activate(ctx, tx, c, actorID); err != nil {
			return err
		}
	}
	if to == model.ContractEnded || to == model.ContractTerminated {
		date := time.Now().UTC()
		if effectiveDate != nil {
			date = *effectiveDate
		}
		if date.Before(c.startDate) {
			return fmt.Errorf("%w: effective date is before contract start", ErrContractPrerequisite)
		}
		if _, err = tx.Exec(ctx, `UPDATE occupancy_periods SET end_date=LEAST(end_date,$1),closed_at=NOW() WHERE property_id=$2 AND contract_id=$3 AND closed_at IS NULL`, date, propertyID, contractID); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `UPDATE rooms SET status='available' WHERE property_id=$1 AND id=$2 AND NOT EXISTS(SELECT 1 FROM occupancy_periods WHERE property_id=$1 AND room_id=$2 AND closed_at IS NULL AND contract_id<>$3)`, propertyID, c.roomID, contractID); err != nil {
			return err
		}
		if err = revokeTenantSessionForProperty(ctx, tx, propertyID, c.userID, "contract_"+to); err != nil {
			return err
		}
	}
	command, err := tx.Exec(ctx, `UPDATE contracts SET status=$1::varchar,lifecycle_reason=$2,terminated_at=CASE WHEN $1::varchar='terminated' THEN NOW() ELSE terminated_at END,updated_at=NOW() WHERE property_id=$3 AND id=$4`, to, strings.TrimSpace(reason), propertyID, contractID)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}
	if _, err = tx.Exec(ctx, `INSERT INTO contract_events(property_id,contract_id,version_id,event_type,from_status,to_status,reason,actor_id) VALUES($1,$2,$3,'status_changed',$4,$5,$6,$7)`, propertyID, contractID, c.versionID, c.status, to, strings.TrimSpace(reason), actorID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *ContractLifecycleRepository) activate(ctx context.Context, tx pgx.Tx, c *lockedContract, actorID uuid.UUID) error {
	if c.versionID == nil || c.monthlyRent <= 0 || c.totalPrice <= 0 || c.endDate.Before(c.startDate) {
		return fmt.Errorf("%w: valid pricing snapshot is required", ErrContractPrerequisite)
	}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	if c.startDate.After(today) || c.endDate.Before(today) {
		return fmt.Errorf("%w: contract can only be activated during its effective period", ErrContractPrerequisite)
	}
	var profileOK, identityOK, accepted bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tenant_profiles WHERE property_id=$1 AND user_id=$2 AND status='active' AND btrim(full_name)<>'' AND btrim(email)<>'' AND btrim(phone)<>''),EXISTS(SELECT 1 FROM tenant_documents d JOIN tenant_profiles p ON p.id=d.tenant_profile_id AND p.property_id=d.property_id WHERE d.property_id=$1 AND p.user_id=$2 AND d.document_type='ktp')`, c.propertyID, c.userID).Scan(&profileOK, &identityOK); err != nil {
		return err
	}
	if !profileOK || !identityOK {
		return fmt.Errorf("%w: tenant profile and KTP are required", ErrContractPrerequisite)
	}
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM contract_policy_acceptances WHERE property_id=$1 AND contract_id=$2 AND version_id=$3 AND accepted_by=$4)`, c.propertyID, c.id, c.versionID, c.userID).Scan(&accepted); err != nil {
		return err
	}
	if !accepted {
		return fmt.Errorf("%w: tenant acceptance for the current version is required", ErrContractPrerequisite)
	}
	var roomStatus string
	if err := tx.QueryRow(ctx, `SELECT status FROM rooms WHERE property_id=$1 AND id=$2 FOR UPDATE`, c.propertyID, c.roomID).Scan(&roomStatus); err != nil {
		return err
	}
	if roomStatus != "available" {
		var parentOccupies bool
		if c.renewedFrom != nil {
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM occupancy_periods WHERE property_id=$1 AND contract_id=$2 AND room_id=$3 AND closed_at IS NULL)`, c.propertyID, *c.renewedFrom, c.roomID).Scan(&parentOccupies); err != nil {
				return err
			}
		}
		if !parentOccupies {
			return fmt.Errorf("%w: room is not available", ErrContractPrerequisite)
		}
	}
	var overlap bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM occupancy_periods WHERE property_id=$1 AND room_id=$2 AND contract_id<>$3 AND daterange(start_date,end_date,'[]') && daterange($4::date,$5::date,'[]') AND ($6::uuid IS NULL OR contract_id<>$6))`, c.propertyID, c.roomID, c.id, c.startDate, c.endDate, c.renewedFrom).Scan(&overlap); err != nil {
		return err
	}
	if overlap {
		return fmt.Errorf("%w: occupancy period overlaps another contract", ErrContractPrerequisite)
	}
	if c.renewedFrom != nil {
		var parentStatus string
		var parentEnd time.Time
		if err := tx.QueryRow(ctx, `SELECT status,end_date FROM contracts WHERE property_id=$1 AND id=$2 FOR UPDATE`, c.propertyID, *c.renewedFrom).Scan(&parentStatus, &parentEnd); err != nil {
			return err
		}
		if parentStatus != model.ContractActive || !c.startDate.Equal(parentEnd.AddDate(0, 0, 1)) {
			return fmt.Errorf("%w: renewal must start one day after active contract ends", ErrContractPrerequisite)
		}
		if _, err := tx.Exec(ctx, `UPDATE occupancy_periods SET closed_at=NOW() WHERE property_id=$1 AND contract_id=$2 AND closed_at IS NULL`, c.propertyID, *c.renewedFrom); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE contracts SET status='renewed',lifecycle_reason='Renewal activated',updated_at=NOW() WHERE property_id=$1 AND id=$2`, c.propertyID, *c.renewedFrom); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO contract_events(property_id,contract_id,version_id,event_type,from_status,to_status,reason,actor_id) SELECT property_id,id,current_version_id,'status_changed','active','renewed','Renewal contract activated',$3 FROM contracts WHERE property_id=$1 AND id=$2`, c.propertyID, *c.renewedFrom, actorID); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `INSERT INTO occupancy_periods(property_id,contract_id,room_id,user_id,start_date,end_date) VALUES($1,$2,$3,$4,$5,$6)`, c.propertyID, c.id, c.roomID, c.userID, c.startDate, c.endDate); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE rooms SET status='occupied' WHERE property_id=$1 AND id=$2`, c.propertyID, c.roomID); err != nil {
		return err
	}
	rentAmount, electricityAmount, waterAmount, otherAmount := initialBillAmounts(&model.Contract{RentalDuration: c.rentalDuration, MonthlyRent: c.monthlyRent, ElectricityBill: c.electricity, WaterBill: c.water, OtherBills: c.other, Deposit: c.deposit, PaymentInterval: c.paymentInterval})
	if _, err := tx.Exec(ctx, `INSERT INTO payments(id,property_id,contract_id,owner_id,period_month,period_year,amount_rent,amount_electricity,amount_water,amount_other,total_paid,payment_method,status,due_date,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,'','unpaid',$11,$12) ON CONFLICT(contract_id,period_month,period_year) DO NOTHING`, uuid.New(), c.propertyID, c.id, actorID, int(c.startDate.Month()), c.startDate.Year(), rentAmount, electricityAmount, waterAmount, otherAmount, c.startDate.AddDate(0, 1, -3), c.notes); err != nil {
		return err
	}
	return nil
}

func (r *ContractLifecycleRepository) AcceptByTenant(ctx context.Context, actorID, contractID uuid.UUID, sourceIP, userAgent string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var propertyID uuid.UUID
	var status string
	var versionID *uuid.UUID
	if err = tx.QueryRow(ctx, `SELECT property_id,status,current_version_id FROM contracts WHERE id=$1 AND user_id=$2 FOR UPDATE`, contractID, actorID).Scan(&propertyID, &status, &versionID); err != nil {
		return err
	}
	if status != model.ContractPendingTenant || versionID == nil {
		return fmt.Errorf("%w: %s -> scheduled", ErrIllegalContractTransition, status)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO contract_policy_acceptances(property_id,contract_id,version_id,accepted_by,source_ip,user_agent) VALUES($1,$2,$3,$4,NULLIF($5,'')::inet,$6)`, propertyID, contractID, *versionID, actorID, sourceIP, userAgent); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE contracts SET status='scheduled',updated_at=NOW() WHERE id=$1 AND property_id=$2`, contractID, propertyID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO contract_events(property_id,contract_id,version_id,event_type,from_status,to_status,reason,actor_id,metadata) VALUES($1,$2,$3,'tenant_accepted','pending_tenant','scheduled','Tenant accepted contract and property policy',$4,jsonb_build_object('source_ip',$5::text,'user_agent',$6::text))`, propertyID, contractID, *versionID, actorID, sourceIP, userAgent); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *ContractLifecycleRepository) Amend(ctx context.Context, propertyID, actorID uuid.UUID, amended *model.Contract, reason string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	current, err := lockContract(ctx, tx, propertyID, amended.ID)
	if err != nil {
		return err
	}
	if current.status == model.ContractEnded || current.status == model.ContractTerminated || current.status == model.ContractRenewed || current.status == model.ContractCancelled {
		return ErrContractHistoryImmutable
	}
	if current.status == model.ContractActive && !amended.StartDate.Equal(current.startDate) {
		return fmt.Errorf("%w: active contract start date cannot change", ErrContractHistoryImmutable)
	}
	if current.status == model.ContractActive && amended.EndDate.Before(time.Now().UTC().Truncate(24*time.Hour)) {
		return fmt.Errorf("%w: active contract end date cannot be in the past", ErrContractPrerequisite)
	}
	if amended.EndDate.Before(amended.StartDate) || amended.MonthlyRent <= 0 || amended.TotalPrice <= 0 {
		return fmt.Errorf("%w: invalid date or pricing", ErrContractPrerequisite)
	}
	if amended.PaymentDueDay < 1 || amended.PaymentDueDay > 31 || (amended.PaymentInterval != "monthly" && amended.PaymentInterval != "per_contract") {
		return fmt.Errorf("%w: invalid payment policy", ErrContractPrerequisite)
	}
	var next int
	if err = tx.QueryRow(ctx, `SELECT COALESCE(MAX(version_number),0)+1 FROM contract_versions WHERE contract_id=$1`, amended.ID).Scan(&next); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE contracts SET start_date=$1,end_date=$2,rental_duration=$3,monthly_rent=$4,total_price=$5,deposit=$6,payment_interval=$7,payment_due_day=$8,notes=$9,updated_at=NOW() WHERE property_id=$10 AND id=$11`, amended.StartDate, amended.EndDate, amended.RentalDuration, amended.MonthlyRent, amended.TotalPrice, amended.Deposit, amended.PaymentInterval, amended.PaymentDueDay, amended.Notes, propertyID, amended.ID); err != nil {
		return err
	}
	var versionID uuid.UUID
	if err = tx.QueryRow(ctx, `INSERT INTO contract_versions(property_id,contract_id,version_number,snapshot,reason,created_by) SELECT property_id,id,$1,jsonb_build_object('contract_id',id,'property_id',property_id,'room_id',room_id,'user_id',user_id,'start_date',start_date,'end_date',end_date,'rental_duration',rental_duration,'monthly_rent',monthly_rent,'total_price',total_price,'deposit',deposit,'electricity_bill',electricity_bill,'water_bill',water_bill,'other_bills',other_bills,'payment_interval',payment_interval,'payment_due_day',payment_due_day,'notes',notes),$2,$3 FROM contracts WHERE property_id=$4 AND id=$5 RETURNING id`, next, strings.TrimSpace(reason), actorID, propertyID, amended.ID).Scan(&versionID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE contracts SET current_version_id=$1 WHERE property_id=$2 AND id=$3`, versionID, propertyID, amended.ID); err != nil {
		return err
	}
	toStatus := current.status
	if current.status == model.ContractScheduled {
		// A scheduled contract was already accepted for its previous version.
		// Moving it back to tenant review prevents activation of an amendment
		// that the tenant has never accepted.
		toStatus = model.ContractPendingTenant
		if _, err = tx.Exec(ctx, `UPDATE contracts SET status=$1,updated_at=NOW() WHERE property_id=$2 AND id=$3`, toStatus, propertyID, amended.ID); err != nil {
			return err
		}
	}
	if current.status == model.ContractActive {
		if _, err = tx.Exec(ctx, `UPDATE occupancy_periods SET end_date=$1 WHERE property_id=$2 AND contract_id=$3 AND closed_at IS NULL`, amended.EndDate, propertyID, amended.ID); err != nil {
			return err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO contract_events(property_id,contract_id,version_id,event_type,from_status,to_status,reason,actor_id,metadata) VALUES($1,$2,$3,'amended',$4,$5,$6,$7,jsonb_build_object('version_number',$8::integer))`, propertyID, amended.ID, versionID, current.status, toStatus, strings.TrimSpace(reason), actorID, next); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *ContractLifecycleRepository) Renew(ctx context.Context, propertyID, actorID, contractID uuid.UUID, child *model.Contract, reason string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	parent, err := lockContract(ctx, tx, propertyID, contractID)
	if err != nil {
		return err
	}
	if parent.status != model.ContractActive {
		return fmt.Errorf("%w: renewal requires an active contract", ErrIllegalContractTransition)
	}
	if !child.StartDate.Equal(parent.endDate.AddDate(0, 0, 1)) || child.EndDate.Before(child.StartDate) {
		return fmt.Errorf("%w: renewal must start one day after the active contract", ErrContractPrerequisite)
	}
	if child.MonthlyRent <= 0 || child.TotalPrice <= 0 || child.PaymentDueDay < 1 || child.PaymentDueDay > 31 || (child.PaymentInterval != "monthly" && child.PaymentInterval != "per_contract") {
		return fmt.Errorf("%w: invalid renewal pricing or payment policy", ErrContractPrerequisite)
	}
	child.ID = uuid.New()
	child.PropertyID = propertyID
	child.RoomID = &parent.roomID
	child.UserID = &parent.userID
	child.OwnerID = actorID
	child.Status = model.ContractDraft
	child.RenewedFromContractID = &contractID
	if _, err = tx.Exec(ctx, `INSERT INTO contracts(id,property_id,room_id,user_id,owner_id,start_date,end_date,rental_duration,monthly_rent,total_price,deposit,payment_due_day,status,notes,electricity_bill,water_bill,other_bills,payment_interval,renewed_from_contract_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13,$14,$15,$16,$17,$18)`, child.ID, propertyID, parent.roomID, parent.userID, actorID, child.StartDate, child.EndDate, child.RentalDuration, child.MonthlyRent, child.TotalPrice, child.Deposit, child.PaymentDueDay, child.Notes, child.ElectricityBill, child.WaterBill, child.OtherBills, child.PaymentInterval, contractID); err != nil {
		return err
	}
	var versionID uuid.UUID
	if err = tx.QueryRow(ctx, `INSERT INTO contract_versions(property_id,contract_id,version_number,snapshot,reason,created_by) SELECT property_id,id,1,jsonb_build_object('contract_id',id,'property_id',property_id,'room_id',room_id,'user_id',user_id,'start_date',start_date,'end_date',end_date,'rental_duration',rental_duration,'monthly_rent',monthly_rent,'total_price',total_price,'deposit',deposit,'electricity_bill',electricity_bill,'water_bill',water_bill,'other_bills',other_bills,'payment_interval',payment_interval,'payment_due_day',payment_due_day,'notes',notes),$1,$2 FROM contracts WHERE property_id=$3 AND id=$4 RETURNING id`, strings.TrimSpace(reason), actorID, propertyID, child.ID).Scan(&versionID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE contracts SET current_version_id=$1 WHERE property_id=$2 AND id=$3`, versionID, propertyID, child.ID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO contract_events(property_id,contract_id,version_id,event_type,to_status,reason,actor_id,metadata) VALUES($1,$2,$3,'renewal_draft_created','draft',$4,$5,jsonb_build_object('renewed_from_contract_id',$6))`, propertyID, child.ID, versionID, strings.TrimSpace(reason), actorID, contractID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO contract_events(property_id,contract_id,version_id,event_type,from_status,to_status,reason,actor_id,metadata) VALUES($1,$2,$3,'renewal_linked','active','active',$4,$5,jsonb_build_object('renewal_contract_id',$6))`, propertyID, contractID, parent.versionID, strings.TrimSpace(reason), actorID, child.ID); err != nil {
		return err
	}
	child.CurrentVersionID = &versionID
	return tx.Commit(ctx)
}

func (r *ContractLifecycleRepository) CurrentSnapshot(ctx context.Context, propertyID, contractID uuid.UUID) (*model.ContractVersion, *model.Contract, error) {
	contract, err := r.contracts.FindByID(ctx, propertyID, contractID)
	if err != nil {
		return nil, nil, err
	}
	if contract.CurrentVersionID == nil {
		return nil, nil, pgx.ErrNoRows
	}
	var v model.ContractVersion
	err = r.db.QueryRow(ctx, `SELECT id,property_id,contract_id,version_number,snapshot,reason,created_by,created_at FROM contract_versions WHERE property_id=$1 AND contract_id=$2 AND id=$3`, propertyID, contractID, *contract.CurrentVersionID).Scan(&v.ID, &v.PropertyID, &v.ContractID, &v.VersionNumber, &v.Snapshot, &v.Reason, &v.CreatedBy, &v.CreatedAt)
	return &v, contract, err
}

func (r *ContractLifecycleRepository) SaveDocument(ctx context.Context, propertyID, contractID, versionID, actorID uuid.UUID, version int, fileName, hash string, content []byte) (*model.ContractDocument, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var d model.ContractDocument
	err = tx.QueryRow(ctx, `INSERT INTO contract_documents(property_id,contract_id,version_id,version_number,file_name,content,sha256,size_bytes,published_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,property_id,contract_id,version_id,version_number,file_name,mime_type,sha256,size_bytes,published_by,published_at`, propertyID, contractID, versionID, version, fileName, content, hash, len(content), actorID).Scan(&d.ID, &d.PropertyID, &d.ContractID, &d.VersionID, &d.VersionNumber, &d.FileName, &d.MimeType, &d.SHA256, &d.SizeBytes, &d.PublishedBy, &d.PublishedAt)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO contract_events(property_id,contract_id,version_id,event_type,reason,actor_id,metadata) VALUES($1,$2,$3,'document_published','Immutable PDF snapshot published',$4,jsonb_build_object('document_id',$5::uuid,'sha256',$6::text))`, propertyID, contractID, versionID, actorID, d.ID, hash)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *ContractLifecycleRepository) DocumentContent(ctx context.Context, propertyID, contractID, documentID, actorID uuid.UUID) (string, string, []byte, error) {
	var name, mime string
	var content []byte
	err := r.db.QueryRow(ctx, `SELECT file_name,mime_type,content FROM contract_documents WHERE property_id=$1 AND contract_id=$2 AND id=$3`, propertyID, contractID, documentID).Scan(&name, &mime, &content)
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO contract_events(property_id,contract_id,event_type,reason,actor_id,metadata) VALUES($1,$2,'document_accessed','Contract PDF downloaded',$3,jsonb_build_object('document_id',$4::uuid))`, propertyID, contractID, actorID, documentID)
	}
	return name, mime, content, err
}

func (r *ContractLifecycleRepository) TenantContract(ctx context.Context, actorID, contractID uuid.UUID) (uuid.UUID, error) {
	var propertyID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT property_id FROM contracts WHERE id=$1 AND user_id=$2`, contractID, actorID).Scan(&propertyID)
	return propertyID, err
}
