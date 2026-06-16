package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RoomHandler struct {
	repo           *repository.RoomRepository
	storageService *service.StorageService
}

func NewRoomHandler(repo *repository.RoomRepository, storageService *service.StorageService) *RoomHandler {
	return &RoomHandler{repo: repo, storageService: storageService}
}

func (h *RoomHandler) CreateRoom(c *gin.Context) {
	var req model.CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status == "" {
		req.Status = "available"
	}

	room := &model.Room{
		RoomNumber:    req.RoomNumber,
		PricePerMonth: req.PricePerMonth,
		Description:   req.Description,
		Status:        req.Status,
	}

	if err := h.repo.Create(c.Request.Context(), room); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}

	c.JSON(http.StatusCreated, room)
}

func (h *RoomHandler) GetRooms(c *gin.Context) {
	rooms, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}
	c.JSON(http.StatusOK, rooms)
}

func (h *RoomHandler) GetRoom(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	room, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}
	c.JSON(http.StatusOK, room)
}

func (h *RoomHandler) UpdateRoom(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	var req model.CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	room := &model.Room{
		ID:            id,
		RoomNumber:    req.RoomNumber,
		PricePerMonth: req.PricePerMonth,
		Description:   req.Description,
		Status:        req.Status,
		Floor:         req.Floor,
		Type:          req.Type,
	}

	if err := h.repo.Update(c.Request.Context(), room); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room"})
		return
	}

	c.JSON(http.StatusOK, room)
}

func (h *RoomHandler) DeleteRoom(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	deleteTenantStr := c.Query("delete_tenant")
	deleteTenant := deleteTenantStr == "true"

	if err := h.repo.DeleteWithTenant(c.Request.Context(), id, deleteTenant); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete room: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room deleted successfully"})
}

func (h *RoomHandler) AssignTenant(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	ownerID, _ := uuid.Parse(userIDStr.(string))

    roomID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form"})
		return
	}

	name := c.PostForm("name")
	phone := c.PostForm("phone")
	email := c.PostForm("email")
	entryDateStr := c.PostForm("entry_date")

	entryDate, _ := time.Parse("2006-01-02", entryDateStr)
	if entryDate.IsZero() {
		entryDate = time.Now()
	}

	rentalDurationStr := c.PostForm("rental_duration")
	rentalDuration, _ := strconv.Atoi(rentalDurationStr)
	if rentalDuration <= 0 {
		rentalDuration = 1
	}

    monthlyRentStr := c.PostForm("monthly_rent")
	monthlyRent, _ := strconv.ParseFloat(monthlyRentStr, 64)

	ktpPath, _ := h.uploadFile(c, "ktp")
	selfiePath, _ := h.uploadFile(c, "selfie")

    // Get room details for price if monthlyRent is not provided
    if monthlyRent <= 0 {
        room, err := h.repo.FindByID(c.Request.Context(), roomID)
        if err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
            return
        }
        monthlyRent = room.PricePerMonth
    }

	user := &model.User{
		Name:      name,
		Phone:     phone,
		Email:     email,
		KtpURL:    &ktpPath,
		SelfieURL: &selfiePath,
	}

	electricityBillStr := c.PostForm("electricity_bill")
	electricityBill, _ := strconv.ParseFloat(electricityBillStr, 64)
	waterBillStr := c.PostForm("water_bill")
	waterBill, _ := strconv.ParseFloat(waterBillStr, 64)
	otherBillsStr := c.PostForm("other_bills")
	otherBills, _ := strconv.ParseFloat(otherBillsStr, 64)
	paymentDueDayStr := c.PostForm("payment_due_day")
	paymentDueDay, _ := strconv.Atoi(paymentDueDayStr)
	notes := c.PostForm("notes")

    contract := &model.Contract{
        StartDate:      entryDate,
        RentalDuration: rentalDuration,
        MonthlyRent:    monthlyRent,
        TotalPrice:     (monthlyRent * float64(rentalDuration)) + electricityBill + waterBill + otherBills,
        ElectricityBill: electricityBill,
        WaterBill:      waterBill,
        OtherBills:     otherBills,
        PaymentDueDay:  paymentDueDay,
        Notes:          notes,
    }

	if err := h.repo.AssignTenant(c.Request.Context(), roomID, user, contract, ownerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign tenant to room: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Tenant assigned successfully"})
}

func (h *RoomHandler) CreateRoomWithTenant(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	ownerID, _ := uuid.Parse(userIDStr.(string))

	if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form"})
		return
	}

	roomNumber := c.PostForm("room_number")
	priceStr := c.PostForm("price_per_month")
	description := c.PostForm("description")
	status := c.PostForm("status")
	roomType := c.PostForm("type")
	floor := c.PostForm("floor")
	isDraftStr := c.PostForm("is_draft")
	roomIDStr := c.PostForm("room_id")

	price, _ := strconv.ParseFloat(priceStr, 64)
	if status == "" {
		status = "occupied"
	}
	if floor == "" {
		floor = "1"
	}
	isDraft := isDraftStr == "true"

	room := &model.Room{
		RoomNumber:    roomNumber,
		PricePerMonth: price,
		Description:   description,
		Status:        status,
		Type:          roomType,
		Floor:         floor,
		IsDraft:       isDraft,
	}
	
	if roomIDStr != "" {
		parsedID, err := uuid.Parse(roomIDStr)
		if err == nil {
			room.ID = parsedID
		}
	}

	name := c.PostForm("name")
	phone := c.PostForm("phone")
	email := c.PostForm("email")
	entryDateStr := c.PostForm("entry_date")

	entryDate, _ := time.Parse("2006-01-02", entryDateStr)
	if entryDate.IsZero() {
		entryDate = time.Now()
	}

	rentalDurationStr := c.PostForm("rental_duration")
	rentalDuration, _ := strconv.Atoi(rentalDurationStr)
	if rentalDuration <= 0 {
		rentalDuration = 1
	}

	genderStr := c.PostForm("gender")
	var gender *string
	if genderStr != "" {
		gender = &genderStr
	}

	jobStr := c.PostForm("job")
	var job *string
	if jobStr != "" {
		job = &jobStr
	}

	emergencyContactPhoneStr := c.PostForm("emergency_contact_phone")
	var emergencyContactPhone *string
	if emergencyContactPhoneStr != "" {
		emergencyContactPhone = &emergencyContactPhoneStr
	}

	emergencyContactRelationStr := c.PostForm("emergency_contact_relation")
	var emergencyContactRelation *string
	if emergencyContactRelationStr != "" {
		emergencyContactRelation = &emergencyContactRelationStr
	}

	emergencyContactNameStr := c.PostForm("emergency_contact_name")
	var emergencyContactName *string
	if emergencyContactNameStr != "" {
		emergencyContactName = &emergencyContactNameStr
	}

	dobStr := c.PostForm("date_of_birth")
	var dateOfBirth *time.Time
	if dobStr != "" {
		if t, err := time.Parse("2006-01-02", dobStr); err == nil {
			dateOfBirth = &t
		}
	}

	ktpPath, _ := h.uploadFile(c, "ktp")
	selfiePath, _ := h.uploadFile(c, "selfie")
	additionalDocPath, _ := h.uploadFile(c, "additional_doc")

	user := &model.User{
		Name:                     name,
		Phone:                    phone,
		Email:                    email,
		KtpURL:                   &ktpPath,
		SelfieURL:                &selfiePath,
		DateOfBirth:              dateOfBirth,
		Gender:                   gender,
		Job:                      job,
		EmergencyContactPhone:    emergencyContactPhone,
		EmergencyContactRelation: emergencyContactRelation,
		EmergencyContactName:     emergencyContactName,
		AdditionalDocURL:         &additionalDocPath,
		IsActive:                 true,
	}

	electricityBillStr := c.PostForm("electricity_bill")
	electricityBill, _ := strconv.ParseFloat(electricityBillStr, 64)
	waterBillStr := c.PostForm("water_bill")
	waterBill, _ := strconv.ParseFloat(waterBillStr, 64)
	otherBillsStr := c.PostForm("other_bills")
	otherBills, _ := strconv.ParseFloat(otherBillsStr, 64)
	paymentDueDayStr := c.PostForm("payment_due_day")
	paymentDueDay, _ := strconv.Atoi(paymentDueDayStr)
	notes := c.PostForm("notes")

	contract := &model.Contract{
		StartDate:      entryDate,
		RentalDuration: rentalDuration,
		MonthlyRent:    price,
		TotalPrice:     (price * float64(rentalDuration)) + electricityBill + waterBill + otherBills,
		ElectricityBill: electricityBill,
        WaterBill:      waterBill,
        OtherBills:     otherBills,
        PaymentDueDay:  paymentDueDay,
        Notes:          notes,
	}

	payment := &model.Payment{}

	hasTenantData := user.Name != "" || user.Phone != ""
	createMsg := "Room created successfully"
	updateMsg := "Room updated successfully"

	if room.Status == "occupied" && hasTenantData {
		createMsg = "Room, tenant, contract, and payment created successfully"
		updateMsg = "Room, tenant, contract, and payment updated successfully"
	}

	if room.ID != uuid.Nil {
		if err := h.repo.UpdateWithTenant(c.Request.Context(), room, user, contract, payment, ownerID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update draft room and tenant: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": updateMsg, 
			"room": room,
			"tenant": user,
			"contract": contract,
			"payment": payment,
		})
	} else {
		if err := h.repo.CreateWithTenant(c.Request.Context(), room, user, contract, payment, ownerID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room and tenant: " + err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{
			"message": createMsg, 
			"room": room,
			"tenant": user,
			"contract": contract,
			"payment": payment,
		})
	}
}

// uploadFile uploads a file from the multipart form to Supabase Storage and returns its public URL.
func (h *RoomHandler) uploadFile(c *gin.Context, fieldName string) (string, error) {
	fileHeader, err := c.FormFile(fieldName)
	if err != nil {
		return "", nil // ignore error if file not uploaded
	}
	return h.storageService.UploadFile(fileHeader, fieldName)
}
