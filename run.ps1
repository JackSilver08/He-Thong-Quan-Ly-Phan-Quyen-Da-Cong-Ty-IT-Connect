param(
    [switch]$NoBuild
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

# Normal development startup rebuilds changed application images automatically.
# Docker will reuse cached layers, so unchanged services remain fast.
# Use .\run.ps1 -NoBuild only when you explicitly want to start existing images.
if ($NoBuild) {
    Write-Host "Starting cached containers without rebuilding..." -ForegroundColor Yellow
    docker compose up -d
} else {
    Write-Host "Building changed images and starting containers..." -ForegroundColor Yellow
    docker compose up -d --build
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Compose failed to build or start the stack." -ForegroundColor Red
    Write-Host "Run: docker compose ps" -ForegroundColor Yellow
    Write-Host "Run: docker compose logs --tail=100" -ForegroundColor Yellow
    exit $LASTEXITCODE
}

Write-Host "Waiting for application..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
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
    Write-Host "Application did not become ready in 90 seconds." -ForegroundColor Red
    Write-Host "Run: docker compose ps" -ForegroundColor Yellow
    Write-Host "Run: docker compose logs --tail=100" -ForegroundColor Yellow
    exit 1
}

Start-Process "http://localhost:3000"
Write-Host "IT Connect is running: http://localhost:3000" -ForegroundColor Green
Write-Host "API: http://localhost:8080" -ForegroundColor DarkGray
Write-Host "Dashboard: http://localhost:8501" -ForegroundColor DarkGray
Write-Host "Nginx: http://localhost:8088" -ForegroundColor DarkGray
