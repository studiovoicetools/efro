@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 🧹 EFRO QuickFix + AutoDeploy

echo.
echo =====================================================
echo   🧩 EFRO QUICKFIX (Runtime/Dynamic Cleanup + Deploy)
echo =====================================================
echo.

:: === 1) Variablen ===
set "PROJECT_DIR=D:\efro"
set "RENDER_SERVICE_ID=srv-d457iqh5pdvs73brh48g"
set "RENDER_API_KEY=rnd_AHUKGporCmSrLjNtpJ5O4Z7uE168"

cd /d "%PROJECT_DIR%"

:: === 2) Temporäre PowerShell-Cleanup-Datei erstellen ===
echo 🧼 Scanne API-Dateien auf doppelte runtime/dynamic Definitionen...

set "CLEAN_SCRIPT=%TEMP%\efro_clean.ps1"
(
    echo param([string]$path^)
    echo $files = Get-ChildItem -Path $path -Recurse -Filter route.ts
    echo foreach ($f in $files^) {
    echo ^    $lines = Get-Content $f.FullName -Encoding UTF8
    echo ^    $out = @(^)
    echo ^    $runtime = $false
    echo ^    $dynamic = $false
    echo ^    foreach ($l in $lines^) {
    echo ^        if ($l -match "export\s+const\s+runtime" -and $runtime^) { continue }
    echo ^        if ($l -match "export\s+const\s+dynamic" -and $dynamic^) { continue }
    echo ^        if ($l -match "export\s+const\s+runtime"^) { $runtime = $true }
    echo ^        if ($l -match "export\s+const\s+dynamic"^) { $dynamic = $true }
    echo ^        $out += $l
    echo ^    }
    echo ^    $out ^| Set-Content $f.FullName -Encoding UTF8
    echo ^    Write-Host "Bereinigt:" $f.FullName
    echo }
) > "%CLEAN_SCRIPT%"

powershell -ExecutionPolicy Bypass -File "%CLEAN_SCRIPT%" "%PROJECT_DIR%\src\app\api"

del "%CLEAN_SCRIPT%"
echo ✅ Cleanup abgeschlossen!
echo.

:: === 3) Build ===
echo 🏗️  Starte Build-Prozess...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build fehlgeschlagen – bitte Fehler prüfen.
    pause
    exit /b 1
)
echo ✅ Build erfolgreich abgeschlossen!
echo.

:: === 4) Git Push ===
echo 🔄 Git Commit + Push...
git add .
git commit -m "QuickFix AutoDeploy"
git push origin main
if %errorlevel% neq 0 (
    echo ⚠️  Git push evtl. ohne Änderungen oder Fehler.
)
echo ✅ Git Push abgeschlossen!
echo.

:: === 5) Render Deploy ===
echo 🚀 Trigger Render Deployment...
curl -X POST ^
    -H "Authorization: Bearer %RENDER_API_KEY%" ^
    -H "Content-Type: application/json" ^
    -d "{\"clearCache\":true}" ^
    https://api.render.com/v1/services/%RENDER_SERVICE_ID%/deploys
echo ✅ Render Deploy ausgelöst!
echo.

echo =====================================================
echo ✅ QUICKFIX + DEPLOY erfolgreich abgeschlossen!
echo =====================================================
echo.
pause
