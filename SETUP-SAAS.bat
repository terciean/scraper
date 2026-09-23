@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto installnode
goto checknode

:installnode
echo Node.js was not found on this machine. Installing it now via winget...
where winget >nul 2>nul
if errorlevel 1 (
  echo.
  echo winget is not available here, so Node.js can't be installed automatically.
  echo Install Node.js 22.13 or newer yourself from https://nodejs.org, then double-click this file again.
  pause
  exit /b 1
)
winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was installed, but this window can't see it yet.
  echo Close this window, open a new one, and double-click SETUP-SAAS.bat again.
  pause
  exit /b 1
)

:checknode
node scripts\onboard.mjs --install
if errorlevel 1 (
  echo.
  echo Setup stopped because a step failed. Fix the message above and run this file again.
)
pause
