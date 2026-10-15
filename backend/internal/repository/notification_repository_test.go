package repository

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/database"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNotificationRepository_Unit(t *testing.T) {
	dbURL := "postgres://postgres:postgres@localhost:5432/lapor_kos?sslmode=disable"
	ctx := context.Background()

	pool, err := database.Open(ctx, dbURL)
	if err != nil {
		t.Skip("PostgreSQL not accessible, skipping integration test:", err)
		return
	}
	defer pool.Close()

	repo := NewNotificationRepository(pool)

	// Fetch a test user and property from DB
	var userID, propertyID uuid.UUID
	err = pool.QueryRow(ctx, "SELECT id FROM users LIMIT 1").Scan(&userID)
	if err != nil {
		t.Skip("No users in DB, skipping:", err)
		return
	}
	err = pool.QueryRow(ctx, "SELECT id FROM properties LIMIT 1").Scan(&propertyID)
	if err != nil {
		t.Skip("No properties in DB, skipping:", err)
		return
	}

	t.Run("AC 4: Mark notification read preserves history", func(t *testing.T) {
		// Insert a test in-app notification
		var notifID uuid.UUID
		err := pool.QueryRow(ctx, `
			INSERT INTO in_app_notifications (property_id, user_id, category, title, message)
			VALUES ($1, $2, 'billing', 'Test Tagihan', 'Harap bayar segera')
			RETURNING id
		`, propertyID, userID).Scan(&notifID)
		require.NoError(t, err)

		// Verify listed as unread
		resp, err := repo.ListUserNotifications(ctx, userID, "billing", true, 10, 0)
		require.NoError(t, err)
		assert.True(t, resp.TotalCount >= 1)

		// Mark as read
		err = repo.MarkNotificationRead(ctx, userID, notifID)
		require.NoError(t, err)

		// Check that the notification STILL EXISTS in history (AC 4)
		respAll, err := repo.ListUserNotifications(ctx, userID, "billing", false, 10, 0)
		require.NoError(t, err)

		found := false
		for _, n := range respAll.Notifications {
			if n.ID == notifID {
				found = true
				assert.True(t, n.IsRead, "Notification should be marked read")
				assert.NotNil(t, n.ReadAt, "read_at timestamp should be set")
			}
		}
		assert.True(t, found, "Notification must remain in history after being marked read")

		// Clean up test notif
		_ = repo.DeleteNotification(ctx, userID, notifID)
	})

	t.Run("AC 5: Preferences and quiet hours applied", func(t *testing.T) {
		// Configure preferences for test user
		pref := &model.NotificationPreference{
			UserID:             userID,
			PropertyID:         &propertyID,
			EmailEnabled:       true,
			WhatsAppEnabled:    false, // opted out of WhatsApp
			InAppEnabled:       true,
			QuietHoursEnabled:  true,
			QuietHoursStart:    "00:00",
			QuietHoursEnd:      "23:59", // All day quiet hours for testing
			QuietHoursTimezone: "Asia/Jakarta",
			OptOutCategories:   []string{"marketing", "announcement"},
		}

		saved, err := repo.UpsertPreferences(ctx, pref)
		require.NoError(t, err)
		assert.False(t, saved.WhatsAppEnabled)
		assert.True(t, saved.QuietHoursEnabled)
		assert.Contains(t, saved.OptOutCategories, "marketing")

		// Read back preferences
		loaded, err := repo.GetPreferences(ctx, userID, &propertyID)
		require.NoError(t, err)
		assert.Equal(t, saved.QuietHoursStart, loaded.QuietHoursStart)
	})

	t.Run("AC 1: Duplicate event does not produce spam", func(t *testing.T) {
		dedupKey := "test-dedup-" + uuid.NewString()
		payload, _ := json.Marshal(map[string]interface{}{"msg": "payment"})

		item1 := &model.NotificationOutboxItem{
			PropertyID:    propertyID,
			EventType:     "payment_verified",
			AggregateType: "payment",
			AggregateID:   uuid.New(),
			RecipientID:   &userID,
			DedupKey:      &dedupKey,
			Payload:       payload,
			Channel:       "in_app",
		}

		id1, err := repo.EnqueueOutbox(ctx, item1)
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, id1)

		// Second item with SAME dedup key within window
		item2 := &model.NotificationOutboxItem{
			PropertyID:    propertyID,
			EventType:     "payment_verified",
			AggregateType: "payment",
			AggregateID:   item1.AggregateID,
			RecipientID:   &userID,
			DedupKey:      &dedupKey,
			Payload:       payload,
			Channel:       "in_app",
		}

		id2, err := repo.EnqueueOutbox(ctx, item2)
		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, id2)

		// Item 2 should have status 'deduplicated' (AC 1)
		outbox2, err := repo.GetOutboxItem(ctx, propertyID, id2)
		require.NoError(t, err)
		assert.Equal(t, model.OutboxStatusDeduplicated, outbox2.Status)
		assert.Contains(t, *outbox2.LastError, "Event duplikat diabaikan")
	})

	t.Run("AC 3: Owner outbox monitor and retry", func(t *testing.T) {
		// Enqueue an outbox item
		item := &model.NotificationOutboxItem{
			PropertyID:    propertyID,
			EventType:     "checkout_completed",
			AggregateType: "checkout",
			AggregateID:   uuid.New(),
			RecipientID:   &userID,
			Payload:       json.RawMessage(`{"room_number":"101"}`),
			Channel:       "in_app",
		}

		outboxID, err := repo.EnqueueOutbox(ctx, item)
		require.NoError(t, err)

		// Dispatch it
		dispatched, err := repo.DispatchOutboxItem(ctx, outboxID, nil, nil)
		require.NoError(t, err)
		assert.NotNil(t, dispatched)

		// Owner queries outbox list (AC 3)
		listResp, err := repo.ListOutbox(ctx, propertyID, "", "", 10, 0)
		require.NoError(t, err)
		assert.True(t, listResp.TotalCount >= 1)

		// Owner retries outbox item (AC 3)
		retried, err := repo.RetryOutboxItem(ctx, propertyID, outboxID, nil, nil)
		require.NoError(t, err)
		assert.NotNil(t, retried)
		assert.True(t, retried.RetryCount >= 1)
	})
}
