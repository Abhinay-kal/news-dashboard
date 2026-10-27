@echo off
echo ====================================================
echo Starting Site Visual Diff Monitor on Windows...
echo ====================================================

REM Ensure dependencies are installed
if not exist "node_modules" (
    echo [Setup] Installing root dependencies...
    call npm install
)
if not exist "client\node_modules" (
    echo [Setup] Installing client dependencies...
    call npm install --prefix client
)
if not exist "server\node_modules" (
    echo [Setup] Installing server dependencies...
    call npm install --prefix server
)

REM Ensure Playwright Chromium is present
call npx playwright install chromium

echo ====================================================
echo Launching monitor services...
echo Frontend will open on: http://localhost:5175
echo ====================================================
node scripts\start-monitor.js
pause
