@echo off
rem Started by start-windows.cmd once the latest version is in place.
setlocal
cd /d "%~dp0.."

echo.
echo === Stopping any copy that is already running ===
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":3000 " ^| findstr /C:"LISTENING"') do taskkill /PID %%p /F >nul 2>&1

echo === Installing what it needs ===
call npm install || goto failed

echo === Updating the database ===
call npm run db:setup || goto failed
call npm run db:demo || goto failed

rem Pages cached by an older version can show as "not found" after an update.
if exist ".next" rmdir /s /q ".next"

echo.
echo === Starting. Keep this window open; close it to stop the system. ===
echo === Your browser opens in a few seconds at http://localhost:3000 ===
start "" /min cmd /c "timeout /t 10 >nul & start http://localhost:3000"
call npm run dev
exit /b 0

:failed
echo.
echo Something went wrong. Copy the text above and send it to Claude.
pause
exit /b 0
