Write-Host "Starting Lapor Kos Services..." -ForegroundColor Cyan

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; go run main.go"
Write-Host "Backend starting on http://localhost:8081" -ForegroundColor Green

# Start Frontend
cd frontend
npm run dev
