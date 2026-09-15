@echo off
setlocal EnableExtensions
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

REM Fast startup: reuse already-built images.
REM Use: run.bat rebuild  only when source/Dockerfiles/dependencies changed.
if /I "%~1"=="rebuild" goto rebuild

docker compose up -d
if not errorlevel 1 goto wait

echo Application images are not available. Building once...
docker compose build
if errorlevel 1 goto fail
docker compose up -d
if errorlevel 1 goto fail
goto wait

:rebuild
echo Rebuilding application images...
docker compose build
if errorlevel 1 goto fail
docker compose up -d
if errorlevel 1 goto fail

:wait
echo Waiting for application (max 60 seconds)...
for /L %%i in (1,1,60) do (
  powershell -NoProfile -Command "try { $h=Invoke-WebRequest -Uri 'http://localhost:8080/health' -UseBasicParsing -TimeoutSec 2; $f=Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2; if ($h.StatusCode -eq 200 -and $f.StatusCode -ge 200 -and $f.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 goto ready
  timeout /t 1 /nobreak >nul
)

echo Application did not become ready.
docker compose ps
echo.
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

:fail
echo.
echo Docker could not build or start the project.
echo Run: docker compose ps
echo Run: docker compose logs --tail=100
pause
exit /b 1
