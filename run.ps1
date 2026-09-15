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

function Invoke-DockerRetry {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [string]$Label = "Docker operation",
        [int]$Attempts = 4,
        [int]$DelaySeconds = 5
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        Write-Host "$Label (attempt $attempt/$Attempts)..." -ForegroundColor DarkCyan
        & docker @Arguments
        if ($LASTEXITCODE -eq 0) { return $true }

        if ($attempt -lt $Attempts) {
            $delay = $DelaySeconds * [math]::Pow(2, $attempt - 1)
            Write-Host "Docker operation failed. Retrying in $delay seconds..." -ForegroundColor Yellow
            Start-Sleep -Seconds $delay
        }
    }
    return $false
}

# Pull base images separately so transient registry/TLS failures do not cancel
# the entire multi-service build. Images stay cached locally after a successful pull.
$baseImages = @(
    "postgres:18.6-alpine",
    "nginx:1.29-alpine",
    "node:22-alpine",
    "python:3.13-slim",
    "golang:1.27.1",
    "gcr.io/distroless/static-debian12:nonroot"
)

foreach ($image in $baseImages) {
    if (-not (Invoke-DockerRetry -Arguments @("pull", $image) -Label "Preparing $image")) {
        Write-Host "Unable to pull $image after multiple attempts." -ForegroundColor Red
        Write-Host "Check Docker Desktop network/proxy/VPN/DNS settings." -ForegroundColor Yellow
        exit 1
    }
}

# Compose build can also hit transient Go/npm/PyPI registry errors, so retry it.
$composeArgs = @("compose", "up", "-d", "--build")
if (-not (Invoke-DockerRetry -Arguments $composeArgs -Label "Building and starting IT Connect" -Attempts 3 -DelaySeconds 5)) {
    Write-Host "Docker Compose could not start the project after multiple attempts." -ForegroundColor Red
    Write-Host "Run: docker compose ps" -ForegroundColor Yellow
    Write-Host "Run: docker compose logs --tail=100" -ForegroundColor Yellow
    exit 1
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
    } catch {}
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
