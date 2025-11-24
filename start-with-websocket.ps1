# Start Django with WebSocket support (Daphne)
# Run this script instead of manage.py runserver

Write-Host "=== Starting SariStore POS with WebSocket Support ===" -ForegroundColor Green

# Check if Redis is running
Write-Host "`nChecking Redis..." -ForegroundColor Yellow
$redis = docker ps --filter "name=redis-saristorepros" --format "{{.Names}}"
if (-not $redis) {
    Write-Host "Redis not running. Starting Redis..." -ForegroundColor Yellow
    docker start redis-saristorepros
    if (-not $?) {
        Write-Host "Creating new Redis container..." -ForegroundColor Yellow
        docker run -d --name redis-saristorepros -p 6379:6379 redis:latest
    }
    Start-Sleep -Seconds 2
}
Write-Host "✓ Redis is running" -ForegroundColor Green

# Stop any running Django/Python processes
Write-Host "`nStopping existing Django servers..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -eq "python" -and $_.MainWindowTitle -like "*manage.py*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Navigate to backend directory
Set-Location -Path "$PSScriptRoot\backend"

# Check if migrations are up to date
Write-Host "`nChecking for pending migrations..." -ForegroundColor Yellow
python manage.py makemigrations --check --dry-run 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating migrations..." -ForegroundColor Yellow
    python manage.py makemigrations
    Write-Host "Applying migrations..." -ForegroundColor Yellow
    python manage.py migrate
} else {
    Write-Host "✓ Migrations are up to date" -ForegroundColor Green
}

# Start Daphne ASGI server
Write-Host "`n=== Starting Daphne ASGI Server ===" -ForegroundColor Green
Write-Host "Backend will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "WebSocket endpoint: ws://localhost:8000/ws/realtime/" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop the server`n" -ForegroundColor Yellow

python -m daphne -b 0.0.0.0 -p 8000 pos.asgi:application
