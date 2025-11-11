# ============================================
# 🚀 EFRO AutoPush + AutoBuild (All-in-One)
# ============================================

Write-Host "=== EFRO AutoPush & AutoBuild gestartet ===" -ForegroundColor Cyan
Write-Host ""

# 1️⃣ Git Pull
Write-Host "🔄 Git Pull --Rebase (synchronisiere lokale Änderungen) ..." -ForegroundColor Yellow
git pull --rebase
Write-Host ""

# 2️⃣ Änderungen prüfen
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "🧩 Änderungen erkannt – bereite Commit & Push vor ..." -ForegroundColor Cyan

    git add .
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMessage = "EFRO AutoPush ($timestamp) – Build Fix & Supabase/Tailwind Check"

    git commit -m "$commitMessage"
    git push origin main

    Write-Host "✅ Git Push erfolgreich abgeschlossen!" -ForegroundColor Green
}
else {
    Write-Host "🟢 Keine Änderungen – überspringe Git-Push." -ForegroundColor Green
}

# 3️⃣ Node & NPM Version prüfen
Write-Host ""
Write-Host "📦 Node Version: $(node -v)"
Write-Host "📦 NPM Version: $(npm -v)"
Write-Host "----------------------------"

# 4️⃣ Tailwind prüfen
Write-Host "🧠 Prüfe Tailwind-Version ..."
$tailwind = (npm list tailwindcss 2>$null | Select-String "tailwindcss@" | ForEach-Object { ($_ -split "@")[-1] }) -join ""
if (-not $tailwind) {
    Write-Host "⚠️ Keine Tailwind-Version erkannt – installiere 3.4.18 ..." -ForegroundColor Yellow
    npm install -D tailwindcss@3.4.18 postcss@8.4.41 autoprefixer@10.4.20
} elseif ($tailwind.StartsWith("4")) {
    Write-Host "🚨 Tailwind v4 erkannt – Downgrade auf v3.4.18 ..." -ForegroundColor Red
    npm uninstall -D tailwindcss
    npm install -D tailwindcss@3.4.18 postcss@8.4.41 autoprefixer@10.4.20
} else {
    Write-Host "✅ Tailwind v3 aktiv" -ForegroundColor Green
}

# 5️⃣ PostCSS sichern
Write-Host "🧩 Erstelle kompatible postcss.config.cjs ..."
@"
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"@ | Set-Content -Path "./postcss.config.cjs" -Encoding UTF8

# 6️⃣ Supabase SSR prüfen
Write-Host "🧩 Prüfe @supabase/ssr ..."
if (-not (npm list @supabase/ssr 2>$null)) {
    Write-Host "Installiere fehlendes @supabase/ssr-Modul ..." -ForegroundColor Yellow
    npm install @supabase/ssr
} else {
    Write-Host "✅ @supabase/ssr bereits vorhanden" -ForegroundColor Green
}

# 7️⃣ TypeScript prüfen
if (-not (Test-Path "./node_modules/.bin/tsc")) {
    Write-Host "🧠 Installiere fehlendes TypeScript ..." -ForegroundColor Yellow
    npm install -D typescript @types/node @types/react @types/react-dom
} else {
    Write-Host "✅ TypeScript vorhanden" -ForegroundColor Green
}

# 8️⃣ Final Check
Write-Host ""
Write-Host "----------------------------"
Write-Host "✅ Final Check:"
Write-Host "   - Tailwind-Version: $(npx tailwindcss -v 2>$null)"
Write-Host "   - TypeScript: $(npx tsc -v 2>$null)"
Write-Host "   - Supabase SSR: $(npm list @supabase/ssr | Select-String @supabase/ssr 2>$null)"
Write-Host "----------------------------"

# 9️⃣ Next.js Build
Write-Host "🏗️  Starte Next.js Build ..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "✅ Alles erfolgreich abgeschlossen!" -ForegroundColor Green
Pause
