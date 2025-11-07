@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 🚀 EFRO Auto Build + Deploy

echo.
echo =====================================================
echo   🚀 EFRO FULL AUTO DEPLOY (Build + Push + Render)
echo =====================================================
echo.

:: === 1) ENVIRONMENT ===
set PROJECT_DIR=D:\efro
set RENDER_SERVICE_ID=srv-d457iqh5pdvs73brh48g
set RENDER_API_KEY=rnd_AHUKGporCmSrLjNtpJ5O4Z7uE168

cd /d "%PROJECT_DIR%"

:: === 2) Git Status ===
echo 🧭 Checking Git status...
git status
echo.

:: === 3) Build ===
echo 🏗️  Building project...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ BUILD FAILED! Bitte Fehler beheben.
    pause
    exit /b 1
)
echo ✅ Build abgeschlossen!
echo.

:: === 4) Commit + Push ===
echo 🔄 Git Commit + Push...
git add .
git commit -m "Auto Deploy via CMD"
git push origin main
if %errorlevel% neq 0 (
    echo ⚠️  Git push evtl. ohne Änderungen oder Fehler.
)
echo ✅ Git Vorgang abgeschlossen!
echo.

:: === 5) Render Deploy Trigger ===
if not "%RENDER_SERVICE_ID%"=="" (
    echo 🚀 Trigger Render Deployment...
    curl -X POST ^
        -H "Authorization: Bearer %RENDER_API_KEY%" ^
        -H "Content-Type: application/json" ^
        -d "{\"clearCache\":true}" ^
        https://api.render.com/v1/services/%RENDER_SERVICE_ID%/deploys
    echo ✅ Render Deploy ausgelöst!
) else (
    echo ⚠️  Kein Render API Key oder Service ID gesetzt — Deploy übersprungen.
)

echo.
echo =====================================================
echo ✅ Fertig! EFRO wurde erfolgreich gebaut und gepusht.
echo =====================================================
echo.
pause
