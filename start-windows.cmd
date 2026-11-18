@echo off
rem Double-click this file to update AlJazayeh to the latest version and start it.
rem It needs Git, Node.js and PostgreSQL installed, and a filled-in .env.local file.
cd /d "%~dp0"

rem The next command is ONE line on purpose. Updating can replace or remove this
rem file while it is running, and Windows reads a batch file one line at a time,
rem so everything after the update lives in scripts\windows-run.cmd.
git checkout main && git pull && (call "%~dp0scripts\windows-run.cmd" & exit /b) || (echo. & echo Could not get the latest version. Copy the text above and send it to Claude. & pause & exit /b 1)
