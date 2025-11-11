# EFRO Push & Build Script (UTF-8 Clean Version)

Write-Host "=== EFRO AutoPush gestartet ===" -ForegroundColor Cyan

# 1. Git Pull (Synchronisieren)
Write-Host "`nGit Pull --Rebase (synchronisiere lokale Aenderungen) ..." -ForegroundColor Yellow
git pull --rebase

# 2. Änderungen prüfen
Write-Host "`nGit Status pruefen ..." -ForegroundColor Yellow
$gitStatus = git status --porcelain

if (-not [string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Host "`nAenderungen erkannt – bereite Commit vor ..." -ForegroundColor Cyan

    git add .
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMessage = "EFRO AutoPush ($timestamp) - Build Fix Supabase Tailwind"
    
    git commit -m "$commitMessage"

    Write-Host "`nPushe Aenderungen nach GitHub ..." -ForegroundColor Cyan
    git push origin main

    Write-Host "`nPush erfolgreich abgeschlossen!" -ForegroundColor Green
}
else {
    Write-Host "`nKeine Aenderungen gefunden – Push uebersprungen." -ForegroundColor Yellow
}

# 3. Render Deployment
Write-Host "`nStarte Render Deployment (render-build-fix.sh) ..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File "./render-build-fix.ps1"


Write-Host "`nBuild-Prozess abgeschlossen. Zum Beenden eine Taste druecken ..." -ForegroundColor Green
Pause
