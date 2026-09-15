$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "Starting IT Connect..." -ForegroundColor Cyan

# Docker Compose currently expects a root .env file.
# Create a development .env automatically on first run from .env.example.
$envFile = Join-Path $ProjectRoot ".env"
$envExample = Join-Path $ProjectRoot ".env.example"

if (-not (Test-Path $envFile)) {
    if (-not (Test-Path $envExample)) {
        Write-Host "Missing .env.example. Cannot create .env." -ForegroundColor Red
        exit 1
    }

    Copy-Item $envExample $envFile
    Write-Host "Created .env from .env.example" -ForegroundColor Green
}

# Build and start the complete stack in the background.
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Compose failed. Run: docker compose logs" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Waiting for frontend..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            $ready = $true
            break
        }
    } catch {
        # Service is still starting.
    }
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    Write-Host "Frontend did not become ready." -ForegroundColor Red
    Write-Host "Run: docker compose ps" -ForegroundColor Yellow
    Write-Host "Run: docker compose logs --tail=100" -ForegroundColor Yellow
    exit 1
}

Start-Process "http://localhost:3000"
Write-Host "IT Connect is running: http://localhost:3000" -ForegroundColor Green
Write-Host "API: http://localhost:8080" -ForegroundColor DarkGray
Write-Host "Dashboard: http://localhost:8501" -ForegroundColor DarkGray
Write-Host "Nginx: http://localhost:8088" -ForegroundColor DarkGray
