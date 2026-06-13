package repository

import (
	"context"
	"fmt"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type RoomRepository struct {
	db *pgxpool.Pool
}

func NewRoomRepository(db *pgxpool.Pool) *RoomRepository {
	return &RoomRepository{db: db}
}

func (r *RoomRepository) Create(ctx context.Context, room *model.Room) error {
	query := `INSERT INTO rooms (room_number, price_per_month, description, status) 
	          VALUES ($1, $2, $3, $4) RETURNING id, created_at`
	return r.db.QueryRow(ctx, query, room.RoomNumber, room.PricePerMonth, room.Description, room.Status).
		Scan(&room.ID, &room.CreatedAt)
}

func (r *RoomRepository) CreateWithTenant(ctx context.Context, room *model.Room, user *model.User, contract *model.Contract, payment *model.Payment, ownerID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Create Room
	roomQuery := `INSERT INTO rooms (room_number, price_per_month, description, status, type, floor, is_draft) 
	              VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`
	err = tx.QueryRow(ctx, roomQuery, room.RoomNumber, room.PricePerMonth, room.Description, room.Status, room.Type, room.Floor, room.IsDraft).
		Scan(&room.ID, &room.CreatedAt)
	if err != nil {
		return err
	}

	// 2. Find or Create User
	var userID uuid.UUID
	
	hasUserData := user.Name != "" || user.Phone != ""
	if room.Status == "occupied" && hasUserData {
		if user.Email == "" && user.Phone != "" {
			user.Email = user.Phone + "@tenant.local"
		} else if user.Email == "" {
			user.Email = uuid.New().String() + "@tenant.local"
		}
		
		err = tx.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", user.Email).Scan(&userID)
		if err != nil {
			pass := user.Phone
			if pass == "" {
				pass = "password123"
			}
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
			if err != nil {
				return err
			}
			userID = uuid.New()
			userQuery := `INSERT INTO users (id, name, email, password_hash, role, is_verified, phone, ktp_url, selfie_url) 
			              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`
			err = tx.QueryRow(ctx, userQuery, userID, user.Name, user.Email, string(hashedPassword), "tenant", true, user.Phone, user.KtpURL, user.SelfieURL).Scan(&userID)
			if err != nil {
				return err
			}
		} else {
			// Update ktp/selfie/phone if provided
			updateQ := `UPDATE users SET phone = COALESCE(NULLIF($1, ''), phone), ktp_url = COALESCE($2, ktp_url), selfie_url = COALESCE($3, selfie_url) WHERE id = $4`
			_, err = tx.Exec(ctx, updateQ, user.Phone, user.KtpURL, user.SelfieURL, userID)
			if err != nil {
				return err
			}
		}

		// 3. Create Contract
		contractQuery := `INSERT INTO contracts (room_id, user_id, owner_id, start_date, end_date, rental_duration, monthly_rent, total_price, deposit, payment_due_day, status, notes, electricity_bill, water_bill, other_bills) 
						  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`
		
		startDate := contract.StartDate
		rentalDuration := contract.RentalDuration
		endDate := startDate.AddDate(0, rentalDuration, 0)
		dueDate := startDate.AddDate(0, 1, -3)
		
		paymentDueDay := contract.PaymentDueDay
		if paymentDueDay == 0 {
			paymentDueDay = dueDate.Day()
		}
		
		notes := contract.Notes
		if notes == "" {
			notes = fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", paymentDueDay)
		}
		
		err = tx.QueryRow(ctx, contractQuery, room.ID, userID, ownerID, startDate, endDate, rentalDuration, contract.MonthlyRent, contract.TotalPrice, contract.Deposit, paymentDueDay, "active", notes, contract.ElectricityBill, contract.WaterBill, contract.OtherBills).Scan(&contract.ID)
		if err != nil {
			return err
		}

		// 4. Create Initial Payment
		paymentID := uuid.New()
		payment.ID = paymentID
		payment.ContractID = contract.ID
		payment.OwnerID = &ownerID
		payment.PeriodMonth = int(startDate.Month())
		payment.PeriodYear = startDate.Year()
		payment.AmountRent = contract.MonthlyRent
		payment.AmountElectricity = contract.ElectricityBill
		payment.AmountWater = contract.WaterBill
		payment.AmountOther = contract.OtherBills
		payment.TotalPaid = 0
		payment.PaymentMethod = ""
		payment.Status = "unpaid"
		payment.DueDate = dueDate
		payment.Notes = "Initial payment generated on contract creation"

		paymentQuery := `INSERT INTO payments (id, contract_id, owner_id, period_month, period_year, amount_rent, amount_electricity, amount_water, amount_other, total_paid, payment_method, status, due_date, notes)
						 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
		_, err = tx.Exec(ctx, paymentQuery, payment.ID, payment.ContractID, payment.OwnerID, payment.PeriodMonth, payment.PeriodYear, payment.AmountRent, payment.AmountElectricity, payment.AmountWater, payment.AmountOther, payment.TotalPaid, payment.PaymentMethod, payment.Status, payment.DueDate, payment.Notes)
		if err != nil {
			return err
		}

		// 4. Update Room Status to Occupied (if not draft)
		if !room.IsDraft {
			_, err = tx.Exec(ctx, `UPDATE rooms SET status = 'occupied' WHERE id = $1`, room.ID)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func (r *RoomRepository) UpdateWithTenant(ctx context.Context, room *model.Room, user *model.User, contract *model.Contract, payment *model.Payment, ownerID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Update Room
	roomQuery := `UPDATE rooms SET room_number=$1, price_per_month=$2, description=$3, status=$4, type=$5, floor=$6, is_draft=$7 WHERE id=$8`
	_, err = tx.Exec(ctx, roomQuery, room.RoomNumber, room.PricePerMonth, room.Description, room.Status, room.Type, room.Floor, room.IsDraft, room.ID)
	if err != nil {
		return err
	}

	// 2. Find or Create User
	var userID uuid.UUID
	
	hasUserData := user.Name != "" || user.Phone != ""
	if room.Status == "occupied" && hasUserData {
		if user.Email == "" && user.Phone != "" {
			user.Email = user.Phone + "@tenant.local"
		} else if user.Email == "" {
			user.Email = uuid.New().String() + "@tenant.local"
		}
		
		err = tx.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", user.Email).Scan(&userID)
		if err != nil {
			pass := user.Phone
			if pass == "" {
				pass = "password123"
			}
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
			if err != nil {
				return err
			}
			userID = uuid.New()
			userQuery := `INSERT INTO users (id, name, email, password_hash, role, is_verified, phone, ktp_url, selfie_url) 
			              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`
			err = tx.QueryRow(ctx, userQuery, userID, user.Name, user.Email, string(hashedPassword), "tenant", true, user.Phone, user.KtpURL, user.SelfieURL).Scan(&userID)
			if err != nil {
				return err
			}
		} else {
			updateQ := `UPDATE users SET name = COALESCE(NULLIF($1, ''), name), phone = COALESCE(NULLIF($2, ''), phone), ktp_url = COALESCE($3, ktp_url), selfie_url = COALESCE($4, selfie_url) WHERE id = $5`
			_, err = tx.Exec(ctx, updateQ, user.Name, user.Phone, user.KtpURL, user.SelfieURL, userID)
			if err != nil {
				return err
			}
		}

		// 3. Upsert Contract (since it's updating draft, contract might or might not exist)
		var contractID uuid.UUID
		err = tx.QueryRow(ctx, "SELECT id FROM contracts WHERE room_id = $1 AND status = 'active'", room.ID).Scan(&contractID)
		
		startDate := contract.StartDate
		rentalDuration := contract.RentalDuration
		endDate := startDate.AddDate(0, rentalDuration, 0)
		dueDate := startDate.AddDate(0, 1, -3)
		
		paymentDueDay := contract.PaymentDueDay
		if paymentDueDay == 0 {
			paymentDueDay = dueDate.Day()
		}
		
		notes := contract.Notes
		if notes == "" {
			notes = fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", paymentDueDay)
		}

		if err != nil { // contract doesn't exist, insert
			contractQuery := `INSERT INTO contracts (room_id, user_id, owner_id, start_date, end_date, rental_duration, monthly_rent, total_price, deposit, payment_due_day, status, notes, electricity_bill, water_bill, other_bills) 
							  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`
			err = tx.QueryRow(ctx, contractQuery, room.ID, userID, ownerID, startDate, endDate, rentalDuration, contract.MonthlyRent, contract.TotalPrice, contract.Deposit, paymentDueDay, "active", notes, contract.ElectricityBill, contract.WaterBill, contract.OtherBills).Scan(&contract.ID)
			if err != nil {
				return err
			}

			paymentID := uuid.New()
			payment.ID = paymentID
			payment.ContractID = contract.ID
			payment.OwnerID = &ownerID
			payment.PeriodMonth = int(startDate.Month())
			payment.PeriodYear = startDate.Year()
			payment.AmountRent = contract.MonthlyRent
			payment.AmountElectricity = contract.ElectricityBill
			payment.AmountWater = contract.WaterBill
			payment.AmountOther = contract.OtherBills
			payment.TotalPaid = 0
			payment.PaymentMethod = ""
			payment.Status = "unpaid"
			payment.DueDate = dueDate
			payment.Notes = "Initial payment generated on contract creation"

			paymentQuery := `INSERT INTO payments (id, contract_id, owner_id, period_month, period_year, amount_rent, amount_electricity, amount_water, amount_other, total_paid, payment_method, status, due_date, notes)
							 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
			_, err = tx.Exec(ctx, paymentQuery, payment.ID, payment.ContractID, payment.OwnerID, payment.PeriodMonth, payment.PeriodYear, payment.AmountRent, payment.AmountElectricity, payment.AmountWater, payment.AmountOther, payment.TotalPaid, payment.PaymentMethod, payment.Status, payment.DueDate, payment.Notes)
			if err != nil {
				return err
			}

		} else { // contract exists, update
			contract.ID = contractID
			contractUpdate := `UPDATE contracts SET user_id=$1, start_date=$2, end_date=$3, rental_duration=$4, monthly_rent=$5, total_price=$6, payment_due_day=$7, notes=$8, electricity_bill=$9, water_bill=$10, other_bills=$11 WHERE id=$12`
			_, err = tx.Exec(ctx, contractUpdate, userID, startDate, endDate, rentalDuration, contract.MonthlyRent, contract.TotalPrice, paymentDueDay, notes, contract.ElectricityBill, contract.WaterBill, contract.OtherBills, contract.ID)
			if err != nil {
				return err
			}

			// Update the unpaid initial payment if it exists
			paymentUpdate := `UPDATE payments SET amount_rent=$1, amount_electricity=$2, amount_water=$3, amount_other=$4, due_date=$5 
							  WHERE contract_id=$6 AND status='unpaid' RETURNING id`
			err = tx.QueryRow(ctx, paymentUpdate, contract.MonthlyRent, contract.ElectricityBill, contract.WaterBill, contract.OtherBills, dueDate, contract.ID).Scan(&payment.ID)
			if err == nil {
				payment.ContractID = contract.ID
				payment.AmountRent = contract.MonthlyRent
				payment.AmountElectricity = contract.ElectricityBill
				payment.AmountWater = contract.WaterBill
				payment.AmountOther = contract.OtherBills
				payment.Status = "unpaid"
				payment.DueDate = dueDate
			}
		}

		// 4. Update Room Status to Occupied (if not draft)
		if !room.IsDraft {
			_, err = tx.Exec(ctx, `UPDATE rooms SET status = 'occupied' WHERE id = $1`, room.ID)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}


func (r *RoomRepository) AssignTenant(ctx context.Context, roomID uuid.UUID, user *model.User, contract *model.Contract, ownerID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var userID uuid.UUID
	if user.Email != "" {
		err = tx.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", user.Email).Scan(&userID)
		if err != nil {
			pass := user.Phone
			if pass == "" {
				pass = "password123"
			}
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
			if err != nil {
				return err
			}
			userID = uuid.New()
			userQuery := `INSERT INTO users (id, name, email, password_hash, role, is_verified, phone, ktp_url, selfie_url) 
			              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`
			err = tx.QueryRow(ctx, userQuery, userID, user.Name, user.Email, string(hashedPassword), "tenant", true, user.Phone, user.KtpURL, user.SelfieURL).Scan(&userID)
			if err != nil {
				return err
			}
		} else {
            // Update ktp/selfie/phone if provided
            updateQ := `UPDATE users SET phone = COALESCE(NULLIF($1, ''), phone), ktp_url = COALESCE($2, ktp_url), selfie_url = COALESCE($3, selfie_url) WHERE id = $4`
            _, err = tx.Exec(ctx, updateQ, user.Phone, user.KtpURL, user.SelfieURL, userID)
            if err != nil {
                return err
            }
        }
	} else {
		return fmt.Errorf("email is required")
	}

	contractQuery := `INSERT INTO contracts (room_id, user_id, owner_id, start_date, end_date, rental_duration, monthly_rent, total_price, deposit, payment_due_day, status, notes, electricity_bill, water_bill, other_bills) 
	                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`
	
	startDate := contract.StartDate
	rentalDuration := contract.RentalDuration
	endDate := startDate.AddDate(0, rentalDuration, 0)
	dueDate := startDate.AddDate(0, 1, -3)

	paymentDueDay := contract.PaymentDueDay
	if paymentDueDay == 0 {
		paymentDueDay = dueDate.Day()
	}
	
	notes := contract.Notes
	if notes == "" {
		notes = fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", paymentDueDay)
	}
	
	_, err = tx.Exec(ctx, contractQuery, roomID, userID, ownerID, startDate, endDate, rentalDuration, contract.MonthlyRent, contract.TotalPrice, contract.Deposit, paymentDueDay, "active", notes, contract.ElectricityBill, contract.WaterBill, contract.OtherBills)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `UPDATE rooms SET status = 'occupied' WHERE id = $1`, roomID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *RoomRepository) FindAll(ctx context.Context) ([]model.Room, error) {
	query := `SELECT id, room_number, price_per_month, description, status, created_at FROM rooms ORDER BY room_number ASC`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []model.Room
	for rows.Next() {
		var room model.Room
		err := rows.Scan(&room.ID, &room.RoomNumber, &room.PricePerMonth, &room.Description, &room.Status, &room.CreatedAt)
		if err != nil {
			return nil, err
		}
		rooms = append(rooms, room)
	}
	return rooms, nil
}

func (r *RoomRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.Room, error) {
	query := `SELECT id, room_number, price_per_month, description, status, created_at FROM rooms WHERE id = $1`
	room := &model.Room{}
	err := r.db.QueryRow(ctx, query, id).Scan(&room.ID, &room.RoomNumber, &room.PricePerMonth, &room.Description, &room.Status, &room.CreatedAt)
	if err != nil {
		return nil, err
	}
	return room, nil
}

func (r *RoomRepository) Update(ctx context.Context, room *model.Room) error {
	query := `UPDATE rooms SET room_number = $1, price_per_month = $2, description = $3, status = $4 WHERE id = $5`
	_, err := r.db.Exec(ctx, query, room.RoomNumber, room.PricePerMonth, room.Description, room.Status, room.ID)
	return err
}

func (r *RoomRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM rooms WHERE id = $1`, id)
	return err
}
