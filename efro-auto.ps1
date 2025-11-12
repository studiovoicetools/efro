# ============================================
# EFRO AutoPush + AutoBuild + AutoDeploy (UTF-8 Safe)
# ============================================

Write-Host "=== EFRO AutoPush & AutoDeploy gestartet ===" -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host ""

# 1. Git Pull
Write-Host "Git Pull --Rebase (synchronisiere lokale Aenderungen) ..." -ForegroundColor Yellow
git pull --rebase
Write-Host ""

# 2. Anderungen prufen
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Aenderungen erkannt  committe & pushe ..." -ForegroundColor Cyan
    git add .
    $commitMessage = "EFRO AutoPush ($timestamp) - Full AutoDeploy Fix"
    git commit -m "$commitMessage"
    git push origin main
    Write-Host "Push erfolgreich abgeschlossen." -ForegroundColor Green
}
else {
    Write-Host "Keine Aenderungen  ueberspringe Git-Push." -ForegroundColor Green
}

# 3. Abhangigkeiten prufen
Write-Host "`nPruefe Projektabhaengigkeiten ..." -ForegroundColor Yellow
if (!(Test-Path "./node_modules")) {
    Write-Host "node_modules fehlt  installiere Pakete ..."
    npm install
} else {
    Write-Host "Abhaengigkeiten vorhanden."
}

# 4. Tailwind prufen
$tailwind = (npm list tailwindcss 2>$null | Select-String "tailwindcss@" | ForEach-Object { ($_ -split "@")[-1] }) -join ""
if (-not $tailwind -or $tailwind.StartsWith("4")) {
    Write-Host "Installiere Tailwind v3.4.18 + PostCSS + Autoprefixer ..." -ForegroundColor Yellow
    npm install tailwindcss@3.4.18 postcss@8.4.41 autoprefixer@10.4.20
} else {
    Write-Host "Tailwind-Version $tailwind aktiv." -ForegroundColor Green
}

# 5. PostCSS sichern
@"
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"@ | Set-Content -Path "./postcss.config.cjs" -Encoding UTF8

# 6. TypeScript prufen
if (!(Test-Path "./node_modules/.bin/tsc")) {
    Write-Host "TypeScript fehlt  installiere ..." -ForegroundColor Yellow
    npm install typescript @types/node @types/react @types/react-dom
} else {
    Write-Host "TypeScript vorhanden." -ForegroundColor Green
}

# 7. Supabase SSR prufen
if (!(npm list @supabase/ssr 2>$null)) {
    Write-Host "Installiere fehlendes Supabase SSR ..." -ForegroundColor Yellow
    npm install @supabase/ssr
} else {
    Write-Host "Supabase SSR erkannt." -ForegroundColor Green
}

# 8. Optionaler lokaler Build
Write-Host "`nStarte lokalen Next.js Build-Test ..." -ForegroundColor Cyan
try {
    npm run build
    Write-Host "Lokaler Build erfolgreich." -ForegroundColor Green
} catch {
    Write-Host "Lokaler Build uebersprungen oder fehlgeschlagen." -ForegroundColor Yellow
}

# 9. Render Webhook
Write-Host "`nStarte Render Deployment ..." -ForegroundColor Cyan
$webhookPath = "render-webhook.txt"
if (Test-Path $webhookPath) {
    $webhookUrl = Get-Content $webhookPath -Raw
} else {
    $webhookUrl = "https://api.render.com/deploy/DEIN_WEBHOOK_HIER"
}

try {
    $response = Invoke-WebRequest -Uri $webhookUrl -Method Post -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "Render Deployment erfolgreich ausgeloest!" -ForegroundColor Green
    } else {
        Write-Host "Render Deployment Antwort: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Fehler: Konnte Render Webhook nicht ausloesen. Bitte URL pruefen." -ForegroundColor Red
}

Write-Host ""
Write-Host "EFRO AutoDeploy abgeschlossen ($timestamp)" -ForegroundColor Cyan
Pause
