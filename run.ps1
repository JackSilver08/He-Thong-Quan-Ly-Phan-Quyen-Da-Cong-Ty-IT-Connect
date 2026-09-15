param(
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "Starting IT Connect..." -ForegroundColor Cyan

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

# Fast path: start existing images/containers without forcing a rebuild.
# Use .\run.ps1 -Rebuild only when source dependencies or Dockerfiles changed.
if ($Rebuild) {
    Write-Host "Rebuild requested. Building application images..." -ForegroundColor Yellow
    docker compose build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker build failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host "Starting containers..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Containers are not built yet or are invalid. Building once..." -ForegroundColor Yellow
    docker compose build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker build failed. Check Docker Desktop/network and run: docker compose build" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker Compose could not start the stack." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host "Waiting for application..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $health = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 2
        $frontend = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
        if ($health.StatusCode -eq 200 -and $frontend.StatusCode -ge 200 -and $frontend.StatusCode -lt 500) {
            $ready = $true
            break
        }
    } catch {
        # Services are still starting.
    }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Host "Application did not become ready in 60 seconds." -ForegroundColor Red
    Write-Host "Run: docker compose ps" -ForegroundColor Yellow
    Write-Host "Run: docker compose logs --tail=100" -ForegroundColor Yellow
    exit 1
}

Start-Process "http://localhost:3000"
Write-Host "IT Connect is running: http://localhost:3000" -ForegroundColor Green
Write-Host "API: http://localhost:8080" -ForegroundColor DarkGray
Write-Host "Dashboard: http://localhost:8501" -ForegroundColor DarkGray
Write-Host "Nginx: http://localhost:8088" -ForegroundColor DarkGray
