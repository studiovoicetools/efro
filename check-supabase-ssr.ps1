Write-Host "=== Prüfe Supabase SSR-Modul ===" -ForegroundColor Cyan

# Prüfen, ob @supabase/ssr installiert ist
$moduleInstalled = npm list @supabase/ssr --depth=0 2>$null | Select-String "@supabase/ssr"

if (-not $moduleInstalled) {
    Write-Host "@supabase/ssr fehlt – Installation wird gestartet..." -ForegroundColor Yellow
    npm install @supabase/ssr@latest --save > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Supabase SSR erfolgreich installiert." -ForegroundColor Green
    }
    else {
        Write-Host "❌ Fehler bei der Installation von @supabase/ssr." -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "✅ Supabase SSR ist bereits installiert." -ForegroundColor Green
}

# Prüfen, ob src/utils/supabase/client.ts existiert
$clientPath = "src/utils/supabase/client.ts"
if (Test-Path $clientPath) {
    $content = Get-Content $clientPath -Raw -Encoding UTF8
    if ($content -notmatch "@supabase/ssr") {
        Write-Host "🔧 Import von @supabase/ssr fehlt in client.ts – füge hinzu..." -ForegroundColor Yellow
        $newContent = "import { createBrowserClient } from '@supabase/ssr';`r`n" + $content
        Set-Content -Path $clientPath -Value $newContent -Encoding UTF8
        Write-Host "✅ Import hinzugefügt in src/utils/supabase/client.ts" -ForegroundColor Green
    }
    else {
        Write-Host "✅ client.ts enthält bereits korrekten Supabase-Import." -ForegroundColor Green
    }
}
else {
    Write-Host "⚠️ Datei src/utils/supabase/client.ts wurde nicht gefunden – überspringe diesen Schritt." -ForegroundColor Yellow
}

Write-Host "Supabase-Check abgeschlossen." -ForegroundColor Cyan
