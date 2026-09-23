@echo off
setlocal
cd /d "%~dp0"
node scripts\onboard.mjs --install
if errorlevel 1 (
  echo.
  echo Setup stopped because a step failed. Fix the message above and run this file again.
)
pause
