@echo off
setlocal
cd /d "%~dp0"

echo Starting IT Connect...

if not exist ".env" (
  if not exist ".env.example" (
    echo Missing .env.example. Cannot create .env.
    pause
    exit /b 1
  )
  copy /Y ".env.example" ".env" >nul
  echo Created .env from .env.example
)

docker compose up -d --build
if errorlevel 1 (
  echo.
  echo Docker Compose failed. Check Docker Desktop and run: docker compose logs
  pause
  exit /b 1
)

echo Waiting for frontend...
for /L %%i in (1,1,60) do (
  powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 goto ready
  timeout /t 2 /nobreak >nul
)

echo.
echo Frontend did not become ready.
echo Run: docker compose ps
 echo Run: docker compose logs --tail=100
pause
exit /b 1

:ready
start "IT Connect" "http://localhost:3000"
echo.
echo IT Connect is running at http://localhost:3000
echo API: http://localhost:8080
echo Dashboard: http://localhost:8501
echo Nginx: http://localhost:8088
echo.
pause
