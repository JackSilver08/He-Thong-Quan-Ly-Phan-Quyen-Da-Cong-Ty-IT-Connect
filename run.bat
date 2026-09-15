@echo off
setlocal EnableExtensions EnableDelayedExpansion
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

set IMAGES=postgres:18.6-alpine nginx:1.29-alpine node:22-alpine python:3.13-slim golang:1.27.1 gcr.io/distroless/static-debian12:nonroot

for %%I in (%IMAGES%) do (
  call :docker_retry "docker pull %%I" "Preparing %%I" 4
  if errorlevel 1 (
    echo Unable to prepare %%I after multiple attempts.
    echo Check Docker Desktop network, proxy, VPN and DNS settings.
    pause
    exit /b 1
  )
)

call :docker_retry "docker compose up -d --build" "Building and starting IT Connect" 3
if errorlevel 1 (
  echo.
  echo Docker Compose could not start after multiple attempts.
  echo Run: docker compose ps
  echo Run: docker compose logs --tail=100
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
exit /b 0

:docker_retry
set "CMD=%~1"
set "LABEL=%~2"
set "MAX=%~3"
for /L %%A in (1,1,%MAX%) do (
  echo !LABEL! - attempt %%A/%MAX%...
  cmd /c "!CMD!"
  if not errorlevel 1 exit /b 0
  if %%A LSS %MAX% (
    set /a DELAY=5*2**(%%A-1)
    echo Docker operation failed. Retrying in !DELAY! seconds...
    timeout /t !DELAY! /nobreak >nul
  )
)
exit /b 1
