package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/cron"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type InvoiceHandler struct {
	repo *repository.InvoiceRepository
	cron *cron.BillingCron
}

func NewInvoiceHandler(repo *repository.InvoiceRepository, billingCron *cron.BillingCron) *InvoiceHandler {
	return &InvoiceHandler{repo: repo, cron: billingCron}
}

func invoiceScope(c *gin.Context) (model.PropertyScope, bool) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok { c.JSON(http.StatusUnauthorized, gin.H{"error":"Unauthorized"}) }
	return scope, ok
}

func queryInt(c *gin.Context,key string,fallback int)int{value,err:=strconv.Atoi(c.Query(key));if err!=nil{return fallback};return value}

func (h *InvoiceHandler) List(c *gin.Context){scope,ok:=invoiceScope(c);if !ok{return};result,err:=h.repo.List(c.Request.Context(),scope.PropertyID,repository.InvoiceFilter{Status:strings.TrimSpace(c.Query("status")),Period:strings.TrimSpace(c.Query("period")),Page:queryInt(c,"page",1),PageSize:queryInt(c,"page_size",10)});if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusOK,result)}

func (h *InvoiceHandler) ListMine(c *gin.Context){actorID,ok:=actorID(c);if !ok{return};result,err:=h.repo.ListForTenant(c.Request.Context(),actorID,repository.InvoiceFilter{Status:strings.TrimSpace(c.Query("status")),Period:strings.TrimSpace(c.Query("period")),Page:queryInt(c,"page",1),PageSize:queryInt(c,"page_size",10)});if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusOK,result)}

func (h *InvoiceHandler) Get(c *gin.Context){scope,ok:=invoiceScope(c);if !ok{return};id,err:=uuid.Parse(c.Param("id"));if err!=nil{c.JSON(http.StatusBadRequest,gin.H{"error":"Invalid invoice ID"});return};item,err:=h.repo.Get(c.Request.Context(),scope.PropertyID,id);if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusOK,item)}

func (h *InvoiceHandler) GetMine(c *gin.Context){userID,ok:=actorID(c);if !ok{return};id,err:=uuid.Parse(c.Param("id"));if err!=nil{c.JSON(http.StatusBadRequest,gin.H{"error":"Invalid invoice ID"});return};item,err:=h.repo.GetForTenant(c.Request.Context(),userID,id);if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusOK,item)}

func (h *InvoiceHandler) GetPolicy(c *gin.Context){scope,ok:=invoiceScope(c);if !ok{return};policy,err:=h.repo.GetPolicy(c.Request.Context(),scope.PropertyID);if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusOK,policy)}

func (h *InvoiceHandler) UpdatePolicy(c *gin.Context){scope,ok:=invoiceScope(c);if !ok{return};var req model.BillingPolicy;if err:=c.ShouldBindJSON(&req);err!=nil{c.JSON(http.StatusBadRequest,gin.H{"error":"Invalid billing policy"});return};policy,err:=h.repo.UpdatePolicy(c.Request.Context(),scope.PropertyID,scope.ActorID,&req);if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusOK,policy)}

func (h *InvoiceHandler) Generate(c *gin.Context){scope,ok:=invoiceScope(c);if !ok{return};var req struct{Period string `json:"period" binding:"required"`};if err:=c.ShouldBindJSON(&req);err!=nil{c.JSON(http.StatusBadRequest,gin.H{"error":"Period is required (YYYY-MM)"});return};period,err:=time.Parse("2006-01",req.Period);if err!=nil{c.JSON(http.StatusUnprocessableEntity,gin.H{"error":"Period must use YYYY-MM"});return};result,err:=h.cron.TriggerProperty(c.Request.Context(),scope.PropertyID,scope.ActorID,period);if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusOK,result)}

func (h *InvoiceHandler) ListJobs(c *gin.Context){scope,ok:=invoiceScope(c);if !ok{return};items,err:=h.repo.ListJobs(c.Request.Context(),scope.PropertyID,queryInt(c,"limit",20));if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusOK,items)}

func (h *InvoiceHandler) RecordMeter(c *gin.Context){scope,ok:=invoiceScope(c);if !ok{return};var req model.MeterReadingRequest;if err:=c.ShouldBindJSON(&req);err!=nil{c.JSON(http.StatusBadRequest,gin.H{"error":"Invalid meter reading"});return};id,err:=h.repo.RecordMeter(c.Request.Context(),scope.PropertyID,scope.ActorID,req);if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusCreated,gin.H{"id":id})}

func (h *InvoiceHandler) PreviewAdjustment(c *gin.Context){scope,ok:=invoiceScope(c);if !ok{return};id,err:=uuid.Parse(c.Param("id"));if err!=nil{c.JSON(http.StatusBadRequest,gin.H{"error":"Invalid invoice ID"});return};var req model.AdjustmentRequest;if err=c.ShouldBindJSON(&req);err!=nil||strings.TrimSpace(req.Reason)==""||strings.TrimSpace(req.Description)==""||req.AmountMinor==0{c.JSON(http.StatusUnprocessableEntity,gin.H{"error":"Description, non-zero amount, and reason are required"});return};source,err:=h.repo.Get(c.Request.Context(),scope.PropertyID,id);if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusOK,gin.H{"source_invoice_id":id,"current_outstanding_minor":source.OutstandingMinor,"adjustment_minor":req.AmountMinor,"combined_outstanding_minor":max(int64(0),source.OutstandingMinor+req.AmountMinor),"reason":strings.TrimSpace(req.Reason)})}

func (h *InvoiceHandler) CreateAdjustment(c *gin.Context){scope,ok:=invoiceScope(c);if !ok{return};id,err:=uuid.Parse(c.Param("id"));if err!=nil{c.JSON(http.StatusBadRequest,gin.H{"error":"Invalid invoice ID"});return};var req model.AdjustmentRequest;if err=c.ShouldBindJSON(&req);err!=nil{c.JSON(http.StatusBadRequest,gin.H{"error":"Invalid adjustment"});return};item,err:=h.repo.CreateAdjustment(c.Request.Context(),scope.PropertyID,scope.ActorID,id,req);if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusCreated,item)}

func (h *InvoiceHandler) CreateFinalSettlement(c *gin.Context){scope,ok:=invoiceScope(c);if !ok{return};contractID,err:=uuid.Parse(c.Param("contract_id"));if err!=nil{c.JSON(http.StatusBadRequest,gin.H{"error":"Invalid contract ID"});return};var req model.AdjustmentRequest;if err=c.ShouldBindJSON(&req);err!=nil{c.JSON(http.StatusBadRequest,gin.H{"error":"Invalid final settlement"});return};item,err:=h.repo.CreateFinalSettlement(c.Request.Context(),scope.PropertyID,scope.ActorID,contractID,req);if err!=nil{invoiceError(c,err);return};c.JSON(http.StatusCreated,item)}

func actorID(c *gin.Context)(uuid.UUID,bool){value,exists:=c.Get("user_id");if !exists{c.JSON(http.StatusUnauthorized,gin.H{"error":"Unauthorized"});return uuid.Nil,false};id,err:=uuid.Parse(value.(string));if err!=nil{c.JSON(http.StatusUnauthorized,gin.H{"error":"Unauthorized"});return uuid.Nil,false};return id,true}

func invoiceError(c *gin.Context,err error){switch{case errors.Is(err,repository.ErrInvoiceNotFound):c.JSON(http.StatusNotFound,gin.H{"error":"Invoice resource not found"});case errors.Is(err,repository.ErrInvoiceInvalidInput):c.JSON(http.StatusUnprocessableEntity,gin.H{"error":err.Error()});default:c.JSON(http.StatusInternalServerError,gin.H{"error":"Invoice operation failed"})}}
