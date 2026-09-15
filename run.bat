@echo off
setlocal
cd /d "%~dp0"

echo Starting IT Connect...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo Docker Compose failed. Check Docker Desktop and docker compose logs.
  pause
  exit /b 1
)

echo Waiting for frontend...
for /L %%i in (1,1,30) do (
  powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
  if not errorlevel 1 goto ready
  timeout /t 2 /nobreak >nul
)

echo.
echo Frontend did not become ready. Run: docker compose logs
pause
exit /b 1

:ready
start "IT Connect" "http://localhost:3000"
echo.
echo IT Connect is running at http://localhost:3000
echo.
pause
