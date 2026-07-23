package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
)

type CalendarHandler struct {
	repo *repository.CalendarRepository
}

func NewCalendarHandler(repo *repository.CalendarRepository) *CalendarHandler {
	return &CalendarHandler{repo: repo}
}

func (h *CalendarHandler) GetEvents(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	monthStr := c.Query("month")
	yearStr := c.Query("year")

	now := time.Now()
	month := int(now.Month())
	year := now.Year()

	if monthStr != "" {
		if m, err := strconv.Atoi(monthStr); err == nil && m >= 1 && m <= 12 {
			month = m
		}
	}
	if yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil {
			year = y
		}
	}

	events, err := h.repo.FindEvents(c.Request.Context(), scope.PropertyID, month, year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch calendar events: " + err.Error()})
		return
	}

	if events == nil {
		events = []model.CalendarEvent{}
	}

	c.JSON(http.StatusOK, events)
}
