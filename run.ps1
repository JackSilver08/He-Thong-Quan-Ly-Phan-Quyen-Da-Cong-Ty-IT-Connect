$ErrorActionPreference = "Stop"

Write-Host "Starting IT Connect..." -ForegroundColor Cyan
docker compose up -d --build

$urls = @(
    "http://localhost:3000",
    "http://localhost:8080/health"
)

Write-Host "Waiting for services..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
        $ready = $true
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Host "Frontend did not become ready. Check: docker compose logs" -ForegroundColor Red
    exit 1
}

Start-Process "http://localhost:3000"
Write-Host "IT Connect is running: http://localhost:3000" -ForegroundColor Green
