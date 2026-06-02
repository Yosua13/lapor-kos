# Lapor Kos - Backend

This is the backend for the Lapor Kos application, built with Go and Gin.

## Prerequisites

- Go (v1.22.x or later recommended)
- PostgreSQL database (or Supabase)

## Environment Variables

Create a `.env` file in the root of the `backend` directory with the following configuration:

```env
# Server Configuration
PORT=8081

# Database Configuration (PostgreSQL/Supabase)
# Note: If using Supabase Connection Pooler (PgBouncer) on port 6543, 
# you MUST append "?sslmode=require&default_query_exec_mode=exec&statement_cache_capacity=0" 
# to the URL to prevent "prepared statement does not exist" errors.
DATABASE_URL=postgresql://user:password@host:port/dbname?sslmode=require&default_query_exec_mode=exec&statement_cache_capacity=0

# Authentication
JWT_SECRET=your_jwt_secret_here

# Email SMTP Settings (For sending verifications/notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_SENDER=Lapor Kos <your_email@gmail.com>

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Google Gemini API Key (For AI features)
GEMINI_API_KEY=your_gemini_api_key

# WhatsApp Gateway (Fonnte)
WHATSAPP_API_URL=https://api.fonnte.com/send
WHATSAPP_API_TOKEN=your_fonnte_token

# Supabase Storage Configuration (For file uploads)
SUPABASE_URL=https://your_project_ref.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
SUPABASE_BUCKET=uploads
```

## Getting Started

1. Install dependencies:

```bash
go mod tidy
```

2. Run the development server:

```bash
go run main.go
```

The server will start on `http://localhost:8081` (or the port defined in `.env`).
