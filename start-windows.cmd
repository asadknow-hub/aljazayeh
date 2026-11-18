@echo off
rem Double-click this file to update AlJazayeh to the latest version and start it.
rem It needs Git, Node.js and PostgreSQL installed, and a filled-in .env.local file.
setlocal
cd /d "%~dp0"

echo.
echo === Stopping any copy that is already running ===
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>&1

echo === Getting the latest version ===
git checkout main || goto failed
git pull || goto failed

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
goto :eof

:failed
echo.
echo Something went wrong. Copy the text above and send it to Claude.
pause
