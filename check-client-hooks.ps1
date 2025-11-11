Write-Host "=== Prüfe und repariere React-Hooks ohne 'use client' ===" -ForegroundColor Cyan

$patternHooks = 'use(State|Effect|Ref|Callback|Memo|Context|Conversation|Mascot|Elevenlabs)'
$fixedFiles = @()

Get-ChildItem -Path "src/app" -Recurse -Include *.tsx | ForEach-Object {
    $file = $_.FullName
    $content = Get-Content $file -Raw -Encoding UTF8

    if ($content -match $patternHooks -and $content -notmatch "'use client'") {
        Write-Host ("Füge 'use client'; hinzu → " + $file) -ForegroundColor Yellow
        $newContent = "'use client';`r`n`r`n" + $content
        Set-Content -Path $file -Value $newContent -Encoding UTF8
        $fixedFiles += $file
    }
}

if ($fixedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Auto-Fix abgeschlossen! Folgende Dateien wurden korrigiert:" -ForegroundColor Green
    foreach ($file in $fixedFiles) {
        Write-Host (" - " + $file) -ForegroundColor Cyan
    }
}
else {
    Write-Host "Alle Hook-Komponenten sind bereits korrekt als Client markiert." -ForegroundColor Green
}
