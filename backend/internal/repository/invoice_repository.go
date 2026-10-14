package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/billing"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvoiceNotFound     = errors.New("invoice not found")
	ErrInvoiceInvalidInput = errors.New("invalid invoice input")
)

type InvoiceRepository struct{ db *pgxpool.Pool }

func NewInvoiceRepository(db *pgxpool.Pool) *InvoiceRepository { return &InvoiceRepository{db: db} }

func scanPolicy(row pgx.Row) (*model.BillingPolicy, error) {
	var p model.BillingPolicy
	err := row.Scan(&p.ID, &p.PropertyID, &p.Timezone, &p.DueDay, &p.GenerateDaysBefore,
		&p.GenerationTime, &p.InvalidDayPolicy, &p.LateFeeEnabled, &p.LateFeeType,
		&p.LateFeeValueMinor, &p.LateFeeGraceDays, &p.UpdatedAt)
	return &p, err
}

func (r *InvoiceRepository) GetPolicy(ctx context.Context, propertyID uuid.UUID) (*model.BillingPolicy, error) {
	policy, err := scanPolicy(r.db.QueryRow(ctx, `SELECT id,property_id,timezone,due_day,generate_days_before,
		generation_time::text,invalid_day_policy,late_fee_enabled,late_fee_type,late_fee_value_minor,
		late_fee_grace_days,updated_at FROM billing_policies WHERE property_id=$1`, propertyID))
	if errors.Is(err, pgx.ErrNoRows) {
		_, _ = r.db.Exec(ctx, `INSERT INTO billing_policies(property_id, timezone, due_day)
			SELECT id, timezone, 1 FROM properties WHERE id=$1 ON CONFLICT(property_id) DO NOTHING`, propertyID)
		return scanPolicy(r.db.QueryRow(ctx, `SELECT id,property_id,timezone,due_day,generate_days_before,
			generation_time::text,invalid_day_policy,late_fee_enabled,late_fee_type,late_fee_value_minor,
			late_fee_grace_days,updated_at FROM billing_policies WHERE property_id=$1`, propertyID))
	}
	return policy, err
}

func (r *InvoiceRepository) UpdatePolicy(ctx context.Context, propertyID, actorID uuid.UUID, p *model.BillingPolicy) (*model.BillingPolicy, error) {
	if p.DueDay < 1 || p.DueDay > 31 || p.GenerateDaysBefore < 0 || p.GenerateDaysBefore > 60 || p.LateFeeGraceDays < 0 || p.LateFeeGraceDays > 90 || p.LateFeeValueMinor < 0 {
		return nil, ErrInvoiceInvalidInput
	}
	if _, err := time.LoadLocation(p.Timezone); err != nil {
		return nil, fmt.Errorf("%w: invalid timezone", ErrInvoiceInvalidInput)
	}
	if p.LateFeeType != "fixed" && p.LateFeeType != "percentage" {
		return nil, ErrInvoiceInvalidInput
	}
	updated, err := scanPolicy(r.db.QueryRow(ctx, `UPDATE billing_policies SET timezone=$1,due_day=$2,
		generate_days_before=$3,generation_time=$4::time,late_fee_enabled=$5,late_fee_type=$6,
		late_fee_value_minor=$7,late_fee_grace_days=$8,updated_by=$9,updated_at=NOW()
		WHERE property_id=$10 RETURNING id,property_id,timezone,due_day,generate_days_before,
		generation_time::text,invalid_day_policy,late_fee_enabled,late_fee_type,late_fee_value_minor,
		late_fee_grace_days,updated_at`, p.Timezone, p.DueDay, p.GenerateDaysBefore, p.GenerationTime,
		p.LateFeeEnabled, p.LateFeeType, p.LateFeeValueMinor, p.LateFeeGraceDays, actorID, propertyID))
	if err != nil {
		return nil, err
	}
	_, err = r.db.Exec(ctx, `INSERT INTO billing_policy_events(property_id,event_type,snapshot,actor_id)
		VALUES($1,'policy_updated',to_jsonb($2::json),$3)`, propertyID, fmt.Sprintf(`{"timezone":%q,"due_day":%d,"generate_days_before":%d,"late_fee_enabled":%t,"late_fee_type":%q,"late_fee_value_minor":%d,"late_fee_grace_days":%d}`, updated.Timezone, updated.DueDay, updated.GenerateDaysBefore, updated.LateFeeEnabled, updated.LateFeeType, updated.LateFeeValueMinor, updated.LateFeeGraceDays), actorID)
	return updated, err
}

type InvoiceFilter struct {
	Status, Period string
	Page, PageSize int
}

const invoiceSelect = `SELECT i.id,i.property_id,i.contract_id,i.tenant_id,i.source_invoice_id,
	i.invoice_number,i.billing_period,i.invoice_type,i.status,i.currency,i.due_at,i.total_minor,
	COALESCE((SELECT SUM(a.amount_minor) FROM invoice_allocations a WHERE a.invoice_id=i.id AND a.status='valid'),0),
	COALESCE((SELECT SUM(cr.amount_minor) FROM invoice_credit_applications cr WHERE cr.invoice_id=i.id AND cr.status='valid'),0),
	GREATEST(0,i.total_minor-
	 COALESCE((SELECT SUM(a.amount_minor) FROM invoice_allocations a WHERE a.invoice_id=i.id AND a.status='valid'),0)-
	 COALESCE((SELECT SUM(cr.amount_minor) FROM invoice_credit_applications cr WHERE cr.invoice_id=i.id AND cr.status='valid'),0)),
	i.calculation_snapshot,i.issued_at,i.created_at,u.name,COALESCE(r.room_number,'')
	FROM invoices i JOIN users u ON u.id=i.tenant_id
	JOIN contracts c ON c.id=i.contract_id AND c.property_id=i.property_id
	LEFT JOIN rooms r ON r.id=c.room_id AND r.property_id=i.property_id`

func scanInvoice(row interface{ Scan(...any) error }) (*model.Invoice, error) {
	var i model.Invoice
	err := row.Scan(&i.ID, &i.PropertyID, &i.ContractID, &i.TenantID, &i.SourceInvoiceID,
		&i.InvoiceNumber, &i.BillingPeriod, &i.InvoiceType, &i.Status, &i.Currency, &i.DueAt,
		&i.TotalMinor, &i.AllocatedMinor, &i.CreditAppliedMinor, &i.OutstandingMinor,
		&i.CalculationSnapshot, &i.IssuedAt, &i.CreatedAt, &i.TenantName, &i.RoomNumber)
	return &i, err
}

func normalizePage(page, pageSize int) (int, int) {
	if page < 1 { page = 1 }
	if pageSize < 1 { pageSize = 10 }
	if pageSize > 100 { pageSize = 100 }
	return page, pageSize
}

func (r *InvoiceRepository) List(ctx context.Context, propertyID uuid.UUID, filter InvoiceFilter) (*model.InvoiceList, error) {
	filter.Page, filter.PageSize = normalizePage(filter.Page, filter.PageSize)
	where := []string{"i.property_id=$1"}
	args := []any{propertyID}
	if filter.Status != "" {
		args = append(args, filter.Status); where = append(where, fmt.Sprintf("i.status=$%d", len(args)))
	}
	if filter.Period != "" {
		period, err := time.Parse("2006-01", filter.Period); if err != nil { return nil, ErrInvoiceInvalidInput }
		args = append(args, period); where = append(where, fmt.Sprintf("i.billing_period=$%d::date", len(args)))
	}
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM invoices i WHERE `+strings.Join(where," AND "), args...).Scan(&total); err != nil { return nil, err }
	args = append(args, filter.PageSize, (filter.Page-1)*filter.PageSize)
	rows, err := r.db.Query(ctx, invoiceSelect+` WHERE `+strings.Join(where," AND ")+fmt.Sprintf(` ORDER BY i.billing_period DESC,i.created_at DESC LIMIT $%d OFFSET $%d`,len(args)-1,len(args)), args...)
	if err != nil { return nil, err }
	defer rows.Close()
	items := make([]model.Invoice,0)
	for rows.Next() { item, scanErr := scanInvoice(rows); if scanErr != nil { return nil, scanErr }; items=append(items,*item) }
	return &model.InvoiceList{Items:items,Page:filter.Page,PageSize:filter.PageSize,TotalItems:total,TotalPages:(total+filter.PageSize-1)/filter.PageSize}, rows.Err()
}

func (r *InvoiceRepository) ListForTenant(ctx context.Context, tenantID uuid.UUID, filter InvoiceFilter) (*model.InvoiceList, error) {
	filter.Page, filter.PageSize = normalizePage(filter.Page, filter.PageSize)
	where := []string{"i.tenant_id=$1"}
	args := []any{tenantID}
	if filter.Status != "" {
		args = append(args, filter.Status)
		where = append(where, fmt.Sprintf("i.status=$%d", len(args)))
	}
	if filter.Period != "" {
		period, err := time.Parse("2006-01", filter.Period)
		if err != nil {
			return nil, ErrInvoiceInvalidInput
		}
		args = append(args, period)
		where = append(where, fmt.Sprintf("i.billing_period=$%d::date", len(args)))
	}
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM invoices i WHERE `+strings.Join(where, " AND "), args...).Scan(&total); err != nil {
		return nil, err
	}
	args = append(args, filter.PageSize, (filter.Page-1)*filter.PageSize)
	rows, err := r.db.Query(ctx, invoiceSelect+` WHERE `+strings.Join(where, " AND ")+fmt.Sprintf(` ORDER BY i.billing_period DESC,i.created_at DESC LIMIT $%d OFFSET $%d`, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]model.Invoice, 0)
	for rows.Next() {
		item, e := scanInvoice(rows)
		if e != nil {
			return nil, e
		}
		items = append(items, *item)
	}
	return &model.InvoiceList{Items: items, Page: filter.Page, PageSize: filter.PageSize, TotalItems: total, TotalPages: (total + filter.PageSize - 1) / filter.PageSize}, rows.Err()
}

func (r *InvoiceRepository) Get(ctx context.Context, propertyID, invoiceID uuid.UUID) (*model.Invoice,error) {
	invoice,err:=scanInvoice(r.db.QueryRow(ctx,invoiceSelect+` WHERE i.property_id=$1 AND i.id=$2`,propertyID,invoiceID))
	if errors.Is(err,pgx.ErrNoRows){return nil,ErrInvoiceNotFound};if err!=nil{return nil,err}
	return r.loadDetails(ctx,invoice)
}

func (r *InvoiceRepository) GetForTenant(ctx context.Context, tenantID, invoiceID uuid.UUID) (*model.Invoice,error) {
	invoice,err:=scanInvoice(r.db.QueryRow(ctx,invoiceSelect+` WHERE i.tenant_id=$1 AND i.id=$2`,tenantID,invoiceID))
	if errors.Is(err,pgx.ErrNoRows){return nil,ErrInvoiceNotFound};if err!=nil{return nil,err}
	return r.loadDetails(ctx,invoice)
}

func (r *InvoiceRepository) loadDetails(ctx context.Context, invoice *model.Invoice)(*model.Invoice,error){
	rows,err:=r.db.Query(ctx,`SELECT id,item_type,description,quantity::text,unit_amount_minor,amount_minor,reason,metadata,created_at FROM invoice_items WHERE property_id=$1 AND invoice_id=$2 ORDER BY created_at,id`,invoice.PropertyID,invoice.ID)
	if err!=nil{return nil,err};defer rows.Close();invoice.Items=[]model.InvoiceItem{}
	for rows.Next(){var item model.InvoiceItem;if err=rows.Scan(&item.ID,&item.ItemType,&item.Description,&item.Quantity,&item.UnitAmountMinor,&item.AmountMinor,&item.Reason,&item.Metadata,&item.CreatedAt);err!=nil{return nil,err};invoice.Items=append(invoice.Items,item)}
	events,err:=r.db.Query(ctx,`SELECT id,event_type,reason,metadata,actor_id,created_at FROM invoice_events WHERE property_id=$1 AND invoice_id=$2 ORDER BY created_at`,invoice.PropertyID,invoice.ID)
	if err!=nil{return nil,err};defer events.Close();invoice.Events=[]model.InvoiceEvent{}
	for events.Next(){var event model.InvoiceEvent;if err=events.Scan(&event.ID,&event.EventType,&event.Reason,&event.Metadata,&event.ActorID,&event.CreatedAt);err!=nil{return nil,err};invoice.Events=append(invoice.Events,event)}
	adjRows,err:=r.db.Query(ctx,invoiceSelect+` WHERE i.property_id=$1 AND i.source_invoice_id=$2 ORDER BY i.created_at`,invoice.PropertyID,invoice.ID)
	if err==nil{
		defer adjRows.Close()
		invoice.Adjustments=[]model.Invoice{}
		for adjRows.Next(){if adj,e:=scanInvoice(adjRows);e==nil{invoice.Adjustments=append(invoice.Adjustments,*adj)}}
	}
	return invoice,events.Err()
}

type billingCandidate struct {
	ContractID,PropertyID,TenantID uuid.UUID
	StartDate,EndDate time.Time
	MonthlyRent,Electricity,Water,Other int64
	PaymentInterval,Notes,Currency string
}

type lineItem struct{ Type,Description,Reason string; Amount int64; Metadata map[string]any }

func (r *InvoiceRepository) candidates(ctx context.Context,propertyID uuid.UUID,period time.Time)([]billingCandidate,error){
	periodEnd:=period.AddDate(0,1,-1)
	rows,err:=r.db.Query(ctx,`SELECT c.id,c.property_id,c.user_id,c.start_date,c.end_date,
		ROUND(c.monthly_rent)::bigint,ROUND(COALESCE(c.electricity_bill,0))::bigint,
		ROUND(COALESCE(c.water_bill,0))::bigint,ROUND(COALESCE(c.other_bills,0))::bigint,
		COALESCE(c.payment_interval,'monthly'),COALESCE(c.notes,''),p.currency
		FROM contracts c JOIN properties p ON p.id=c.property_id
		WHERE c.property_id=$1 AND c.status='active' AND c.start_date<=$3 AND c.end_date>=$2`,propertyID,period,periodEnd)
	if err!=nil{return nil,err};defer rows.Close();result:=[]billingCandidate{}
	for rows.Next(){var c billingCandidate;if err=rows.Scan(&c.ContractID,&c.PropertyID,&c.TenantID,&c.StartDate,&c.EndDate,&c.MonthlyRent,&c.Electricity,&c.Water,&c.Other,&c.PaymentInterval,&c.Notes,&c.Currency);err!=nil{return nil,err};result=append(result,c)}
	return result,rows.Err()
}

func (r *InvoiceRepository) buildItems(ctx context.Context,c billingCandidate,period time.Time)([]lineItem,map[string]any,error){
	active,total:=billing.ActiveDays(period,c.StartDate,c.EndDate)
	rent:=c.MonthlyRent
	if c.PaymentInterval=="per_contract" { if period.Year()!=c.StartDate.Year()||period.Month()!=c.StartDate.Month(){return nil,nil,nil}; rent=c.MonthlyRent*int64(max(1,int(c.EndDate.Sub(c.StartDate).Hours()/24/28)))} else { rent=billing.ProrateMinor(c.MonthlyRent,active,total) }
	items:=[]lineItem{{Type:"rent",Description:"Sewa kamar",Amount:rent,Metadata:map[string]any{"active_days":active,"days_in_period":total}}}
	static:=[]lineItem{{Type:"electricity",Description:"Biaya listrik",Amount:c.Electricity},{Type:"water",Description:"Biaya air",Amount:c.Water},{Type:"one_off",Description:"Biaya lain",Amount:c.Other}}
	for _,item:=range static{if item.Amount!=0{items=append(items,item)}}
	rows,err:=r.db.Query(ctx,`SELECT utility_type,amount_minor,previous_value::text,current_value::text,unit_price_minor,id FROM meter_readings WHERE property_id=$1 AND contract_id=$2 AND date_trunc('month', billing_period) = date_trunc('month', $3::date)`,c.PropertyID,c.ContractID,period.Format("2006-01-02"))
	if err!=nil{return nil,nil,err};defer rows.Close()
	for rows.Next(){var typ,prev,current string;var amount,unit int64;var id uuid.UUID;if err=rows.Scan(&typ,&amount,&prev,&current,&unit,&id);err!=nil{return nil,nil,err};items=append(items,lineItem{Type:"utility_meter",Description:"Pemakaian "+typ,Amount:amount,Metadata:map[string]any{"meter_reading_id":id,"previous":prev,"current":current,"unit_price_minor":unit}})}
	snapshot:=map[string]any{"contract_id":c.ContractID,"billing_period":period.Format("2006-01-02"),"contract_start":c.StartDate.Format("2006-01-02"),"contract_end":c.EndDate.Format("2006-01-02"),"payment_interval":c.PaymentInterval,"active_days":active,"days_in_period":total,"rounding":"integer_half_up"}
	return items,snapshot,rows.Err()
}

func shortID(id uuid.UUID)string{return strings.ToUpper(strings.ReplaceAll(id.String(),"-",""))[:8]}

func (r *InvoiceRepository) createInvoice(ctx context.Context,c billingCandidate,policy *model.BillingPolicy,period time.Time,invoiceType string,actorID *uuid.UUID)(bool,error){
	items,snapshot,err:=r.buildItems(ctx,c,period);if err!=nil{return false,err};if len(items)==0{return false,nil}
	loc,err:=time.LoadLocation(policy.Timezone);if err!=nil{return false,err};due:=billing.ClampDueDate(period.Year(),period.Month(),policy.DueDay,loc)
	snapshot["policy"] = map[string]any{"timezone":policy.Timezone,"due_day":policy.DueDay,"invalid_day_policy":policy.InvalidDayPolicy}
	snapshotJSON,_:=json.Marshal(snapshot);id:=uuid.New();key:=fmt.Sprintf("%s:%s:%s",c.ContractID,period.Format("2006-01"),invoiceType);number:=fmt.Sprintf("INV-%s-%s-%s",period.Format("200601"),shortID(c.ContractID),strings.ToUpper(invoiceType[:3]))
	tx,err:=r.db.Begin(ctx);if err!=nil{return false,err};defer tx.Rollback(ctx) //nolint:errcheck
	var createdID uuid.UUID
	err=tx.QueryRow(ctx,`INSERT INTO invoices(id,property_id,contract_id,tenant_id,invoice_number,billing_period,invoice_type,status,currency,due_at,calculation_snapshot,idempotency_key,issued_at,created_by)
		VALUES($1,$2,$3,$4,$5,$6,$7,'issued',$8,$9,$10,$11,NOW(),$12)
		ON CONFLICT(property_id,contract_id,billing_period,invoice_type) DO NOTHING RETURNING id`,id,c.PropertyID,c.ContractID,c.TenantID,number,period,invoiceType,c.Currency,due,snapshotJSON,key,actorID).Scan(&createdID)
	if errors.Is(err,pgx.ErrNoRows){return false,nil};if err!=nil{return false,err}
	for _,item:=range items{metadata,_:=json.Marshal(item.Metadata);_,err=tx.Exec(ctx,`INSERT INTO invoice_items(property_id,invoice_id,item_type,description,unit_amount_minor,amount_minor,reason,metadata,created_by) VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8)`,c.PropertyID,createdID,item.Type,item.Description,item.Amount,item.Reason,metadata,actorID);if err!=nil{return false,err}}
	_,err=tx.Exec(ctx,`INSERT INTO invoice_events(property_id,invoice_id,event_type,reason,metadata,actor_id) VALUES($1,$2,'issued','Invoice generated from immutable contract snapshot',$3,$4)`,c.PropertyID,createdID,snapshotJSON,actorID);if err!=nil{return false,err}
	return true,tx.Commit(ctx)
}

func (r *InvoiceRepository) Generate(ctx context.Context,propertyID uuid.UUID,period time.Time,triggerType,runKey string,actorID *uuid.UUID,force bool)(*model.BillingJobResult,error){
	policy,err:=r.GetPolicy(ctx,propertyID);if err!=nil{return nil,err};loc,err:=time.LoadLocation(policy.Timezone);if err!=nil{return nil,err};period=time.Date(period.Year(),period.Month(),1,0,0,0,0,loc)
	due:=billing.ClampDueDate(period.Year(),period.Month(),policy.DueDay,loc);generateAt:=due.AddDate(0,0,-policy.GenerateDaysBefore)
	now:=time.Now().In(loc);status:="running";if !force&&now.Before(generateAt){status="skipped"}
	job:=&model.BillingJobResult{ID:uuid.New(),PropertyID:propertyID,BillingPeriod:period,Status:status,StartedAt:time.Now().UTC()}
	err=r.db.QueryRow(ctx,`INSERT INTO billing_job_runs(id,property_id,billing_period,trigger_type,run_key,status,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT(property_id,run_key) DO UPDATE SET property_id=EXCLUDED.property_id RETURNING id,status,contracts_seen,invoices_created,invoices_skipped,error_summary,started_at,finished_at`,job.ID,propertyID,period,triggerType,runKey,status,actorID).Scan(&job.ID,&job.Status,&job.ContractsSeen,&job.InvoicesCreated,&job.InvoicesSkipped,&job.ErrorSummary,&job.StartedAt,&job.FinishedAt)
	if err!=nil{return nil,err};if status=="skipped"{finished:=time.Now().UTC();job.FinishedAt=&finished;_,err=r.db.Exec(ctx,`UPDATE billing_job_runs SET finished_at=$1 WHERE id=$2 AND status='skipped'`,finished,job.ID);return job,err}
	candidates,err:=r.candidates(ctx,propertyID,period);if err!=nil{return nil,r.finishJob(ctx,job,"failed",err)};job.ContractsSeen=len(candidates)
	var errs []string
	for _,candidate:=range candidates{invoiceType:="recurring";if candidate.PaymentInterval=="per_contract"{invoiceType="initial"};created,createErr:=r.createInvoice(ctx,candidate,policy,period,invoiceType,actorID);if createErr!=nil{errs=append(errs,createErr.Error());continue};if created{job.InvoicesCreated++}else{job.InvoicesSkipped++}}
	finalStatus:="succeeded";if len(errs)>0{finalStatus="partial";if job.InvoicesCreated==0{finalStatus="failed"};job.ErrorSummary=strings.Join(errs,"; ")}
	return job,r.finishJob(ctx,job,finalStatus,nil)
}

func (r *InvoiceRepository) finishJob(ctx context.Context,job *model.BillingJobResult,status string,source error)error{
	if source!=nil{job.ErrorSummary=source.Error()};job.Status=status;finished:=time.Now().UTC();job.FinishedAt=&finished
	_,err:=r.db.Exec(ctx,`UPDATE billing_job_runs SET status=$1,contracts_seen=$2,invoices_created=$3,invoices_skipped=$4,error_summary=$5,finished_at=$6 WHERE id=$7`,status,job.ContractsSeen,job.InvoicesCreated,job.InvoicesSkipped,job.ErrorSummary,finished,job.ID)
	if err==nil{_,err=r.db.Exec(ctx,`INSERT INTO billing_job_events(property_id,job_run_id,event_type,metadata) VALUES($1,$2,$3,jsonb_build_object('contracts_seen',$4,'invoices_created',$5,'invoices_skipped',$6,'error',$7::text))`,job.PropertyID,job.ID,status,job.ContractsSeen,job.InvoicesCreated,job.InvoicesSkipped,job.ErrorSummary)}
	return err
}

func (r *InvoiceRepository) ListJobs(ctx context.Context, propertyID uuid.UUID, limit int) ([]model.BillingJobResult, error) {
	if limit < 1 || limit > 100 { limit = 20 }
	rows, err := r.db.Query(ctx, `SELECT id,property_id,billing_period,status,contracts_seen,invoices_created,
		invoices_skipped,error_summary,started_at,finished_at FROM billing_job_runs
		WHERE property_id=$1 ORDER BY started_at DESC LIMIT $2`, propertyID, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	items := make([]model.BillingJobResult, 0)
	for rows.Next() {
		var item model.BillingJobResult
		if err = rows.Scan(&item.ID,&item.PropertyID,&item.BillingPeriod,&item.Status,&item.ContractsSeen,&item.InvoicesCreated,&item.InvoicesSkipped,&item.ErrorSummary,&item.StartedAt,&item.FinishedAt); err != nil { return nil, err }
		items = append(items,item)
	}
	return items, rows.Err()
}

func (r *InvoiceRepository) RecordMeter(ctx context.Context,propertyID,actorID uuid.UUID,req model.MeterReadingRequest)(uuid.UUID,error){
	contractID,err:=uuid.Parse(req.ContractID);if err!=nil{return uuid.Nil,ErrInvoiceInvalidInput};period,err:=time.Parse("2006-01",req.BillingPeriod);if err!=nil{return uuid.Nil,ErrInvoiceInvalidInput}
	if req.CurrentValue<req.PreviousValue||req.PreviousValue<0||req.UnitPriceMinor<0||!map[string]bool{"electricity":true,"water":true,"other":true}[req.UtilityType]{return uuid.Nil,ErrInvoiceInvalidInput}
	amount:=int64(math.Round((req.CurrentValue-req.PreviousValue)*float64(req.UnitPriceMinor)));id:=uuid.New()
	err=r.db.QueryRow(ctx,`INSERT INTO meter_readings(id,property_id,contract_id,billing_period,utility_type,previous_value,current_value,unit_price_minor,amount_minor,notes,recorded_by)
		SELECT $1,$2,c.id,$3,$4,$5,$6,$7,$8,$9,$10 FROM contracts c WHERE c.property_id=$2 AND c.id=$11 RETURNING id`,id,propertyID,period,req.UtilityType,req.PreviousValue,req.CurrentValue,req.UnitPriceMinor,amount,strings.TrimSpace(req.Notes),actorID,contractID).Scan(&id)
	if errors.Is(err,pgx.ErrNoRows){return uuid.Nil,ErrInvoiceNotFound};return id,err
}

func (r *InvoiceRepository) CreateAdjustment(ctx context.Context,propertyID,actorID,sourceID uuid.UUID,req model.AdjustmentRequest)(*model.Invoice,error){
	if strings.TrimSpace(req.Reason)==""||strings.TrimSpace(req.Description)==""||req.AmountMinor==0{return nil,ErrInvoiceInvalidInput}
	source,err:=r.Get(ctx,propertyID,sourceID);if err!=nil{return nil,err};period:=source.BillingPeriod;id:=uuid.New();key:="adjustment:"+id.String();number:=fmt.Sprintf("ADJ-%s-%s",period.Format("200601"),shortID(id));snapshot,_:=json.Marshal(map[string]any{"source_invoice_id":sourceID,"reason":strings.TrimSpace(req.Reason)})
	tx,err:=r.db.Begin(ctx);if err!=nil{return nil,err};defer tx.Rollback(ctx) //nolint:errcheck
	_,err=tx.Exec(ctx,`INSERT INTO invoices(id,property_id,contract_id,tenant_id,source_invoice_id,invoice_number,billing_period,invoice_type,status,currency,due_at,calculation_snapshot,idempotency_key,issued_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'adjustment','issued',$8,$9,$10,$11,NOW(),$12)`,id,propertyID,source.ContractID,source.TenantID,sourceID,number,period,source.Currency,source.DueAt,snapshot,key,actorID);if err!=nil{return nil,err}
	_,err=tx.Exec(ctx,`INSERT INTO invoice_items(property_id,invoice_id,item_type,description,unit_amount_minor,amount_minor,reason,metadata,created_by) VALUES($1,$2,'adjustment',$3,$4,$4,$5,$6,$7)`,propertyID,id,strings.TrimSpace(req.Description),req.AmountMinor,strings.TrimSpace(req.Reason),snapshot,actorID);if err!=nil{return nil,err}
	_,err=tx.Exec(ctx,`INSERT INTO invoice_events(property_id,invoice_id,event_type,reason,metadata,actor_id) VALUES($1,$2,'adjustment_issued',$3,$4,$5)`,propertyID,id,strings.TrimSpace(req.Reason),snapshot,actorID);if err!=nil{return nil,err}
	_,err=tx.Exec(ctx,`INSERT INTO invoice_events(property_id,invoice_id,event_type,reason,metadata,actor_id) VALUES($1,$2,'adjustment_applied',$3,$4,$5)`,propertyID,sourceID,strings.TrimSpace(req.Reason),snapshot,actorID);if err!=nil{return nil,err}
	if err=tx.Commit(ctx);err!=nil{return nil,err};return r.Get(ctx,propertyID,id)
}

func (r *InvoiceRepository) CreateFinalSettlement(ctx context.Context,propertyID,actorID,contractID uuid.UUID,req model.AdjustmentRequest)(*model.Invoice,error){
	if strings.TrimSpace(req.Reason)==""||strings.TrimSpace(req.Description)==""||req.AmountMinor==0{return nil,ErrInvoiceInvalidInput}
	var tenantID uuid.UUID;var currency,status string;var endDate time.Time
	err:=r.db.QueryRow(ctx,`SELECT c.user_id,p.currency,c.status,c.end_date FROM contracts c JOIN properties p ON p.id=c.property_id WHERE c.property_id=$1 AND c.id=$2`,propertyID,contractID).Scan(&tenantID,&currency,&status,&endDate)
	if errors.Is(err,pgx.ErrNoRows){return nil,ErrInvoiceNotFound};if err!=nil{return nil,err}
	if status!="ended"&&status!="terminated"&&status!="renewed"{return nil,fmt.Errorf("%w: final settlement requires a finished contract",ErrInvoiceInvalidInput)}
	period:=time.Date(endDate.Year(),endDate.Month(),1,0,0,0,0,time.UTC);id:=uuid.New();number:=fmt.Sprintf("FIN-%s-%s",period.Format("200601"),shortID(contractID));key:=fmt.Sprintf("%s:%s:final_settlement",contractID,period.Format("2006-01"));snapshot,_:=json.Marshal(map[string]any{"contract_id":contractID,"contract_status":status,"contract_end":endDate.Format("2006-01-02"),"reason":strings.TrimSpace(req.Reason)})
	tx,err:=r.db.Begin(ctx);if err!=nil{return nil,err};defer tx.Rollback(ctx) //nolint:errcheck
	err=tx.QueryRow(ctx,`INSERT INTO invoices(id,property_id,contract_id,tenant_id,invoice_number,billing_period,invoice_type,status,currency,due_at,calculation_snapshot,idempotency_key,issued_at,created_by) VALUES($1,$2,$3,$4,$5,$6,'final_settlement','issued',$7,NOW(),$8,$9,NOW(),$10) ON CONFLICT(property_id,contract_id,billing_period,invoice_type) DO NOTHING RETURNING id`,id,propertyID,contractID,tenantID,number,period,currency,snapshot,key,actorID).Scan(&id)
	if errors.Is(err,pgx.ErrNoRows){return nil,fmt.Errorf("%w: final settlement already exists",ErrInvoiceInvalidInput)};if err!=nil{return nil,err}
	_,err=tx.Exec(ctx,`INSERT INTO invoice_items(property_id,invoice_id,item_type,description,unit_amount_minor,amount_minor,reason,metadata,created_by) VALUES($1,$2,'adjustment',$3,$4,$4,$5,$6,$7)`,propertyID,id,strings.TrimSpace(req.Description),req.AmountMinor,strings.TrimSpace(req.Reason),snapshot,actorID);if err!=nil{return nil,err}
	_,err=tx.Exec(ctx,`INSERT INTO invoice_events(property_id,invoice_id,event_type,reason,metadata,actor_id) VALUES($1,$2,'final_settlement_issued',$3,$4,$5)`,propertyID,id,strings.TrimSpace(req.Reason),snapshot,actorID);if err!=nil{return nil,err}
	if err=tx.Commit(ctx);err!=nil{return nil,err};return r.Get(ctx,propertyID,id)
}

// createActivationInvoiceTx keeps room occupancy, contract activation and the
// first invoice in one transaction. A unique period key makes retries safe.
func createActivationInvoiceTx(ctx context.Context, tx pgx.Tx, c *lockedContract, actorID uuid.UUID) error {
	var timezone, currency string
	var dueDay int
	err := tx.QueryRow(ctx, `SELECT COALESCE(bp.timezone, p.timezone), COALESCE(bp.due_day, 1), p.currency FROM properties p LEFT JOIN billing_policies bp ON bp.property_id=p.id WHERE p.id=$1`, c.propertyID).Scan(&timezone,&dueDay,&currency)
	if err != nil { return err }
	_, _ = tx.Exec(ctx, `INSERT INTO billing_policies(property_id, timezone, due_day) SELECT p.id, p.timezone, 1 FROM properties p WHERE p.id=$1 ON CONFLICT(property_id) DO NOTHING`, c.propertyID)
	loc,err:=time.LoadLocation(timezone);if err!=nil{return err}
	period:=time.Date(c.startDate.Year(),c.startDate.Month(),1,0,0,0,0,loc);active,total:=billing.ActiveDays(period,c.startDate,c.endDate)
	rent:=int64(math.Round(c.monthlyRent));invoiceType:="recurring"
	if c.paymentInterval=="monthly"{rent=billing.ProrateMinor(rent,active,total)}else{invoiceType="initial";rent=int64(math.Round(c.monthlyRent*float64(c.rentalDuration)))}
	items:=[]lineItem{{Type:"rent",Description:"Sewa kamar",Amount:rent,Metadata:map[string]any{"active_days":active,"days_in_period":total}}}
	for _,item:=range []lineItem{{Type:"electricity",Description:"Biaya listrik",Amount:int64(math.Round(c.electricity))},{Type:"water",Description:"Biaya air",Amount:int64(math.Round(c.water))},{Type:"one_off",Description:"Biaya lain",Amount:int64(math.Round(c.other))},{Type:"one_off",Description:"Deposit",Amount:int64(math.Round(c.deposit))}}{if item.Amount!=0{items=append(items,item)}}
	snapshot,_:=json.Marshal(map[string]any{"contract_id":c.id,"billing_period":period.Format("2006-01-02"),"contract_version_id":c.versionID,"contract_start":c.startDate.Format("2006-01-02"),"contract_end":c.endDate.Format("2006-01-02"),"payment_interval":c.paymentInterval,"active_days":active,"days_in_period":total,"rounding":"integer_half_up","policy":map[string]any{"timezone":timezone,"due_day":dueDay,"invalid_day_policy":"last_day"}})
	id:=uuid.New();key:=fmt.Sprintf("%s:%s:%s",c.id,period.Format("2006-01"),invoiceType);number:=fmt.Sprintf("INV-%s-%s-%s",period.Format("200601"),shortID(c.id),strings.ToUpper(invoiceType[:3]));due:=billing.ClampDueDate(period.Year(),period.Month(),dueDay,loc)
	err=tx.QueryRow(ctx,`INSERT INTO invoices(id,property_id,contract_id,tenant_id,invoice_number,billing_period,invoice_type,status,currency,due_at,calculation_snapshot,idempotency_key,issued_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'issued',$8,$9,$10,$11,NOW(),$12) ON CONFLICT(property_id,contract_id,billing_period,invoice_type) DO NOTHING RETURNING id`,id,c.propertyID,c.id,c.userID,number,period,invoiceType,currency,due,snapshot,key,actorID).Scan(&id)
	if errors.Is(err,pgx.ErrNoRows){return nil};if err!=nil{return err}
	for _,item:=range items{metadata,_:=json.Marshal(item.Metadata);if _,err=tx.Exec(ctx,`INSERT INTO invoice_items(property_id,invoice_id,item_type,description,unit_amount_minor,amount_minor,metadata,created_by) VALUES($1,$2,$3,$4,$5,$5,$6,$7)`,c.propertyID,id,item.Type,item.Description,item.Amount,metadata,actorID);err!=nil{return err}}
	_,err=tx.Exec(ctx,`INSERT INTO invoice_events(property_id,invoice_id,event_type,reason,metadata,actor_id) VALUES($1,$2,'issued','Initial invoice created during contract activation',$3,$4)`,c.propertyID,id,snapshot,actorID)
	return err
}

