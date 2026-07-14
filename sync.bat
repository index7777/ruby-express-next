@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title web-build-next sync tool (GitHub)

if not exist ".git" goto firstinit
goto menu

:firstinit
echo ============================================
echo   This folder is not linked to GitHub yet.
echo   Go to https://github.com/new and create a new EMPTY repo
echo   (suggested name: ruby-express-next - do NOT add a
echo   README / .gitignore / license, keep it fully empty).
echo   Then paste its HTTPS URL below, for example:
echo   https://github.com/ndex7777/ruby-express-next.git
echo ============================================
set /p remoteurl=Repo URL:
git init
git branch -M main
git remote add origin "%remoteurl%"
git add -A
git commit -m "init: web-build-next standalone git repo"
git push -u origin main
echo.
echo Setup complete. From now on just double-click sync.bat for the menu.
pause
goto menu

:menu
cls
echo ============================================
echo   web-build-next - Sync Tool (GitHub)
echo   Current folder: %cd%
echo ============================================
echo   [1] Pull latest   (do this BEFORE you start work)
echo   [2] Push changes  (do this AFTER you finish work)
echo   [3] Show status   (git status)
echo   [0] Exit
echo ============================================
set /p choice=Enter your choice:

if "%choice%"=="1" goto pull
if "%choice%"=="2" goto push
if "%choice%"=="3" goto status
if "%choice%"=="0" goto end
goto menu

:pull
echo.
echo --- Pulling latest ---
git pull
echo.
echo Done.
pause
goto menu

:push
echo.
echo --- Pushing changes ---
git add -A
set /p msg=Short description of this change (press Enter for default):
if "%msg%"=="" set msg=update
git commit -m "%msg%"
git push
echo.
echo Done.
pause
goto menu

:status
echo.
git status
echo.
pause
goto menu

:end
endlocal
