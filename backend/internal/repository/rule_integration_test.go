//go:build integration

package repository_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func TestRuleVersioningAndAcknowledgmentLifecycle(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is required")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	require.NoError(t, err)
	defer pool.Close()

	ruleRepo := repository.NewHouseRuleRepository(pool)
	contractRepo := repository.NewContractRepository(pool)
	lifecycle := repository.NewContractLifecycleRepository(pool, contractRepo)

	ownerID := uuid.New()
	tenantID := uuid.New()
	propertyID := uuid.New()
	roomID := uuid.New()

	// Seed users
	mustPoolExec(t, pool, `INSERT INTO users(id,name,email,password_hash,role,is_verified,is_active,phone) VALUES($1,'Owner',$2,'hash','owner',TRUE,TRUE,'628111111111')`, ownerID, ownerID.String()+"@example.test")
	mustPoolExec(t, pool, `INSERT INTO users(id,name,email,password_hash,role,is_verified,is_active,phone) VALUES($1,'Tenant',$2,'hash','tenant',TRUE,TRUE,'628222222222')`, tenantID, tenantID.String()+"@example.test")

	// Seed property & room
	mustPoolExec(t, pool, `INSERT INTO properties(id,name,address,timezone,currency,status,created_by) VALUES($1,'Kos Epic 11','Jl. Mawar','Asia/Jakarta','IDR','active',$2)`, propertyID, ownerID)
	mustPoolExec(t, pool, `INSERT INTO property_memberships(property_id,user_id,role,permissions,status,created_by) VALUES($1,$2,'property_owner','[]','active',$2)`, propertyID, ownerID)
	mustPoolExec(t, pool, `INSERT INTO rooms(id,property_id,room_number,price_per_month,status) VALUES($1,$2,'101',1500000,'available')`, roomID, propertyID)

	// Seed tenant profile & KTP
	var profileID uuid.UUID
	mustPoolQueryRow(t, pool, `INSERT INTO tenant_profiles(property_id,user_id,full_name,email,phone,status,created_by,activated_at) VALUES($1,$2,'Tenant Test',$3,'628222222222','active',$4,NOW()) RETURNING id`, []any{propertyID, tenantID, tenantID.String() + "@example.test", ownerID}, &profileID)
	fileID := uuid.New()
	mustPoolExec(t, pool, `INSERT INTO files(id,property_id,uploaded_by,object_key,mime_type,size_bytes,checksum_sha256) VALUES($1,$2,$3,$4,'image/jpeg',10,$5)`, fileID, propertyID, ownerID, "integration/"+fileID.String(), "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	mustPoolExec(t, pool, `INSERT INTO tenant_documents(property_id,tenant_profile_id,file_id,document_type,uploaded_by) VALUES($1,$2,$3,'ktp',$4)`, propertyID, profileID, fileID, ownerID)

	// =========================================================================
	// AC 1: Membaca peraturan tidak membuat atau mengubah data di database
	// =========================================================================
	t.Run("AC 1: Reading empty rules does not mutate DB", func(t *testing.T) {
		rules, err := ruleRepo.FindAllByProperty(ctx, propertyID)
		require.NoError(t, err)
		require.Empty(t, rules, "empty property must return empty rules")

		// Verify no rules or versions were created
		var count int
		err = pool.QueryRow(ctx, `SELECT COUNT(*) FROM rule_versions WHERE property_id = $1`, propertyID).Scan(&count)
		require.NoError(t, err)
		require.Equal(t, 0, count, "rule_versions table must still have 0 rows")

		err = pool.QueryRow(ctx, `SELECT COUNT(*) FROM house_rules WHERE property_id = $1`, propertyID).Scan(&count)
		require.NoError(t, err)
		require.Equal(t, 0, count, "house_rules table must still have 0 rows")
	})

	// =========================================================================
	// AC 2: Versi yang sudah diterbitkan tidak dapat diubah dan tetap tersedia untuk histori
	// =========================================================================
	var v1 *model.RuleVersion
	t.Run("AC 2: Save draft and publish version 1", func(t *testing.T) {
		draftReq := model.SaveDraftRulesRequest{
			Title:         "Tata Tertib Kos Harmoni",
			Description:   "Peraturan resmi hunian",
			ChangeSummary: "Draft awal peraturan v1",
			Items: []model.RuleItemInput{
				{
					Category:    model.RuleCategoryKeamanan,
					Title:       "Jam Malam",
					Description: "Gerbang ditutup pukul 23:00",
					Details:     []string{"Pintu dikunci jam 23:00", "Bawa kunci masing-masing"},
					Severity:    model.RuleSeverityMajor,
					OrderIndex:  1,
				},
				{
					Category:    model.RuleCategoryKebersihan,
					Title:       "Kebersihan Kamar",
					Description: "Kamar wajib dijaga kebersihannya",
					Details:     []string{"Buang sampah setiap hari"},
					Severity:    model.RuleSeverityStandard,
					OrderIndex:  2,
				},
			},
		}

		draft, err := ruleRepo.SaveDraft(ctx, propertyID, ownerID, draftReq)
		require.NoError(t, err)
		require.Equal(t, model.RuleStatusDraft, draft.Status)
		require.Equal(t, 1, draft.VersionNumber)
		require.Len(t, draft.Items, 2)

		// Publish version 1
		eff := time.Now().UTC()
		v1, err = ruleRepo.PublishDraft(ctx, propertyID, ownerID, draft.ID, &eff, "Versi 1 resmi diterbitkan")
		require.NoError(t, err)
		require.Equal(t, model.RuleStatusPublished, v1.Status)
		require.Equal(t, 1, v1.VersionNumber)

		// Verify immutability: direct update or delete on rule_versions should fail!
		_, err = pool.Exec(ctx, `UPDATE rule_versions SET change_summary = 'Hacked' WHERE id = $1`, v1.ID)
		require.Error(t, err, "database trigger must reject modifying published rule version content")

		_, err = pool.Exec(ctx, `DELETE FROM rule_versions WHERE id = $1`, v1.ID)
		require.Error(t, err, "database trigger must reject deleting published rule version")

		// Direct update or delete on rule_items belonging to published version should also fail!
		_, err = pool.Exec(ctx, `UPDATE rule_items SET title = 'Changed' WHERE rule_version_id = $1`, v1.ID)
		require.Error(t, err, "database trigger must reject updating items of published version")

		_, err = pool.Exec(ctx, `DELETE FROM rule_items WHERE rule_version_id = $1`, v1.ID)
		require.Error(t, err, "database trigger must reject deleting items of published version")
	})

	// =========================================================================
	// AC 3: Tenant baru harus mengakui versi aktif sebelum kontrak dapat diaktifkan
	// =========================================================================
	var contract *model.Contract
	t.Run("AC 3: Tenant must acknowledge active rules before activation", func(t *testing.T) {
		start := time.Now().UTC().Truncate(24 * time.Hour)
		contract = &model.Contract{
			RoomID:          &roomID,
			UserID:          &tenantID,
			StartDate:       start,
			EndDate:         start.AddDate(0, 1, 0),
			RentalDuration:  1,
			MonthlyRent:     1500000,
			TotalPrice:      1500000,
			PaymentInterval: "monthly",
			PaymentDueDay:   5,
		}
		err = contractRepo.Create(ctx, propertyID, ownerID, contract)
		require.NoError(t, err)

		err = lifecycle.Transition(ctx, propertyID, ownerID, contract.ID, model.ContractPendingTenant, "", nil)
		require.NoError(t, err)

		// Accept contract by tenant (which automatically records rule acknowledgment in AcceptByTenant)
		err = lifecycle.AcceptByTenant(ctx, tenantID, contract.ID, "127.0.0.1", "integration-test")
		require.NoError(t, err)

		// Activation should succeed because rule acknowledgment is recorded
		err = lifecycle.Transition(ctx, propertyID, ownerID, contract.ID, model.ContractActive, "", nil)
		require.NoError(t, err)

		// Verify contract is active and has rule_version_id pointing to v1
		var cRuleVersionID *uuid.UUID
		var cStatus string
		err = pool.QueryRow(ctx, `SELECT status, rule_version_id FROM contracts WHERE id = $1`, contract.ID).Scan(&cStatus, &cRuleVersionID)
		require.NoError(t, err)
		require.Equal(t, model.ContractActive, cStatus)
		require.NotNil(t, cRuleVersionID)
		require.Equal(t, v1.ID, *cRuleVersionID)
	})

	// =========================================================================
	// AC 4: Perubahan aturan tidak berlaku retroaktif tanpa proses amendment yang sah
	// =========================================================================
	var v2 *model.RuleVersion
	t.Run("AC 4: New rule version does not retroactively mutate existing contract", func(t *testing.T) {
		draftReq := model.SaveDraftRulesRequest{
			Title:         "Tata Tertib Kos Harmoni (Update)",
			Description:   "Peraturan revisi",
			ChangeSummary: "Penambahan aturan parkir",
			Items: []model.RuleItemInput{
				{
					Category:    model.RuleCategoryKeamanan,
					Title:       "Jam Malam",
					Description: "Gerbang ditutup pukul 23:00",
					Details:     []string{"Pintu dikunci jam 23:00"},
					Severity:    model.RuleSeverityMajor,
					OrderIndex:  1,
				},
				{
					Category:    model.RuleCategoryFasilitas,
					Title:       "Parkir Mobil",
					Description: "Wajib mendaftarkan nomor plat",
					Details:     []string{"1 kamar 1 slot"},
					Severity:    model.RuleSeverityStandard,
					OrderIndex:  2,
				},
			},
		}

		draft2, err := ruleRepo.SaveDraft(ctx, propertyID, ownerID, draftReq)
		require.NoError(t, err)
		require.Equal(t, 2, draft2.VersionNumber)

		eff := time.Now().UTC()
		v2, err = ruleRepo.PublishDraft(ctx, propertyID, ownerID, draft2.ID, &eff, "Versi 2 diterbitkan")
		require.NoError(t, err)
		require.Equal(t, model.RuleStatusPublished, v2.Status)
		require.Equal(t, 2, v2.VersionNumber)

		// Check version 1 is now superseded
		v1After, err := ruleRepo.GetVersion(ctx, propertyID, v1.ID)
		require.NoError(t, err)
		require.Equal(t, model.RuleStatusSuperseded, v1After.Status, "v1 must be superseded")

		// Verify existing contract still points to version 1 baseline! Not retroactively updated to v2!
		var cRuleVer *uuid.UUID
		err = pool.QueryRow(ctx, `SELECT rule_version_id FROM contracts WHERE id = $1`, contract.ID).Scan(&cRuleVer)
		require.NoError(t, err)
		require.Equal(t, v1.ID, *cRuleVer, "contract baseline must remain on v1, not retroactively changed")
	})

	// =========================================================================
	// AC 5: Acknowledgment menyimpan tenant, lease, version, dan waktu secara dapat diaudit
	// =========================================================================
	t.Run("AC 5: Acknowledgment stores audit fields and is immutable", func(t *testing.T) {
		// Tenant acknowledges the newly published version 2
		ack, err := ruleRepo.AcknowledgeVersion(
			ctx,
			propertyID,
			tenantID,
			&contract.ID,
			v2.ID,
			"192.168.1.100",
			"Mozilla/5.0 (Integration Test)",
			"Saya menyetujui Peraturan Kos Versi 2",
		)
		require.NoError(t, err)
		require.Equal(t, v2.ID, ack.RuleVersionID)
		require.Equal(t, tenantID, ack.TenantUserID)
		require.Equal(t, &contract.ID, ack.ContractID)
		require.Equal(t, "192.168.1.100", ack.SourceIP)
		require.Equal(t, "Mozilla/5.0 (Integration Test)", ack.UserAgent)
		require.Contains(t, ack.ConsentText, "Peraturan Kos Versi 2")
		require.False(t, ack.AcknowledgedAt.IsZero())

		// List acknowledgments audit trail
		acks, err := ruleRepo.ListAcknowledgments(ctx, propertyID, v2.ID)
		require.NoError(t, err)
		require.Len(t, acks, 1)
		require.Equal(t, "Tenant Test", acks[0].TenantName)

		// Verify append-only: trigger rejects UPDATE or DELETE on rule_acknowledgments!
		_, err = pool.Exec(ctx, `UPDATE rule_acknowledgments SET consent_text = 'Tampered' WHERE id = $1`, ack.ID)
		require.Error(t, err, "database trigger must reject modifying rule_acknowledgments")

		_, err = pool.Exec(ctx, `DELETE FROM rule_acknowledgments WHERE id = $1`, ack.ID)
		require.Error(t, err, "database trigger must reject deleting rule_acknowledgments")
	})
}
