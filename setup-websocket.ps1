# Quick Start Script for WebSocket Setup
# Run this in PowerShell as Administrator

Write-Host "=== SariStorePOS WebSocket Setup ===" -ForegroundColor Green
Write-Host ""

# Check if Docker is installed
Write-Host "Checking for Docker..." -ForegroundColor Yellow
$dockerInstalled = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerInstalled) {
    Write-Host "✓ Docker found" -ForegroundColor Green
    
    # Check if Redis container exists
    $redisExists = docker ps -a --filter "name=redis-saristorepros" --format "{{.Names}}"
    
    if ($redisExists) {
        Write-Host "✓ Redis container exists" -ForegroundColor Green
        Write-Host "Starting Redis container..." -ForegroundColor Yellow
        docker start redis-saristorepros
    } else {
        Write-Host "Creating and starting Redis container..." -ForegroundColor Yellow
        docker run -d --name redis-saristorepros -p 6379:6379 redis:latest
    }
    
    Start-Sleep -Seconds 2
    Write-Host "✓ Redis is running on port 6379" -ForegroundColor Green
} else {
    Write-Host "✗ Docker not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Redis using one of these methods:" -ForegroundColor Yellow
    Write-Host "1. Install Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host "2. Install Memurai: https://www.memurai.com/get-memurai" -ForegroundColor Cyan
    Write-Host "3. Use WSL2: wsl --install, then apt install redis-server" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to continue after installing Redis"
}

# Install Python dependencies
Write-Host ""
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
Set-Location backend
pip install -r requirements.txt
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Python dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install Python dependencies" -ForegroundColor Red
    exit 1
}

# Test Redis connection
Write-Host ""
Write-Host "Testing Redis connection..." -ForegroundColor Yellow
python -c "import redis; r = redis.Redis(host='localhost', port=6379); print('✓ Redis connected:', r.ping())"
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Redis connection failed" -ForegroundColor Red
    Write-Host "Please make sure Redis is running on port 6379" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Yellow
Write-Host "1. Backend: python -m daphne -b 0.0.0.0 -p 8000 pos.asgi:application" -ForegroundColor Cyan
Write-Host "2. Frontend: cd ../frontend && npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "Real-time features will be available once both are running!" -ForegroundColor Green
